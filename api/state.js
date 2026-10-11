const { pipeline, toObj } = require('./_redis');
const { getCurrent, batchesOf } = require('./_lib');

// GET /api/state -> { current, audits, batches } shared by everyone who opens the site.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method' });
  try {
    const current = await getCurrent();
    const [aud] = await pipeline([['HGETALL', 'fa:audits']]);
    const audits = Object.values(toObj(aud))
      .map((v) => (typeof v === 'string' ? JSON.parse(v) : v))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const lists = await Promise.all([current, ...audits].map((a) => batchesOf(a.id)));
    res.status(200).json({ current, audits, batches: lists.flat() });
  } catch (e) {
    res.status(500).json({ error: e.message === 'REDIS_NOT_CONFIGURED' ? 'redis_not_configured' : 'server' });
  }
};
