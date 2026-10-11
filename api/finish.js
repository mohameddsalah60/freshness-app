const { pipeline } = require('./_redis');
const { getCurrent, newAudit } = require('./_lib');

// POST /api/finish {auditId} -> archives the current audit into the history and starts a new one.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const cur = await getCurrent();
    if (body.auditId !== cur.id) return res.status(200).json({ ok: true, already: true }); // someone else already finished it
    const [n] = await pipeline([['HLEN', 'fa:b:' + cur.id]]);
    if (!n) return res.status(400).json({ error: 'empty' });
    cur.endedAt = new Date().toISOString();
    await pipeline([
      ['HSET', 'fa:audits', cur.id, JSON.stringify(cur)],
      ['SET', 'fa:current', JSON.stringify(newAudit())],
    ]);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message === 'REDIS_NOT_CONFIGURED' ? 'redis_not_configured' : 'server' });
  }
};
