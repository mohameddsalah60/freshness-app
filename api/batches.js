const { pipeline } = require('./_redis');
const { getCurrent, validDate, batchesOf, crypto } = require('./_lib');

// POST   /api/batches            {productId, expiry, barcode}  -> add a batch to the current audit
// PATCH  /api/batches            {id, expiry}                  -> change the expiry date
// DELETE /api/batches?id=...                                   -> remove a batch from the current audit
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const cur = await getCurrent();
    const key = 'fa:b:' + cur.id;
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

    if (req.method === 'POST') {
      const productId = String(body.productId || '').slice(0, 40);
      const barcode = String(body.barcode || '').replace(/\D/g, '').slice(0, 14);
      if (!productId || !validDate(body.expiry)) return res.status(400).json({ error: 'invalid' });
      const existing = await batchesOf(cur.id);
      if (existing.some((b) => b.productId === productId && b.expiry === body.expiry)) return res.status(409).json({ error: 'duplicate' });
      const batch = { id: crypto.randomUUID(), productId, barcode, expiry: body.expiry, addedAt: new Date().toISOString(), auditId: cur.id };
      await pipeline([['HSET', key, batch.id, JSON.stringify(batch)]]);
      return res.status(200).json({ batch });
    }

    if (req.method === 'PATCH') {
      if (!body.id || !validDate(body.expiry)) return res.status(400).json({ error: 'invalid' });
      const existing = await batchesOf(cur.id);
      const batch = existing.find((b) => b.id === body.id);
      if (!batch) return res.status(404).json({ error: 'not_found' });
      if (existing.some((b) => b.id !== batch.id && b.productId === batch.productId && b.expiry === body.expiry)) return res.status(409).json({ error: 'duplicate' });
      batch.expiry = body.expiry;
      await pipeline([['HSET', key, batch.id, JSON.stringify(batch)]]);
      return res.status(200).json({ batch });
    }

    if (req.method === 'DELETE') {
      const id = String((req.query && req.query.id) || '');
      if (!id) return res.status(400).json({ error: 'invalid' });
      await pipeline([['HDEL', key, id]]);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'method' });
  } catch (e) {
    res.status(500).json({ error: e.message === 'REDIS_NOT_CONFIGURED' ? 'redis_not_configured' : 'server' });
  }
};
