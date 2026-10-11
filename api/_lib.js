const crypto = require('crypto');
const { pipeline, toObj } = require('./_redis');

const USER = 'محمد صلاح';
const newAudit = () => ({ id: crypto.randomUUID(), startedAt: new Date().toISOString(), endedAt: null, user: USER });

async function getCurrent() {
  let [c] = await pipeline([['GET', 'fa:current']]);
  if (!c) {
    await pipeline([['SET', 'fa:current', JSON.stringify(newAudit()), 'NX']]);
    [c] = await pipeline([['GET', 'fa:current']]);
  }
  return typeof c === 'string' ? JSON.parse(c) : c;
}

function validDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return false;
  const now = new Date();
  return y >= now.getUTCFullYear() - 2 && y <= now.getUTCFullYear() + 10;
}

async function batchesOf(auditId) {
  const [h] = await pipeline([['HGETALL', 'fa:b:' + auditId]]);
  return Object.values(toObj(h)).map((v) => (typeof v === 'string' ? JSON.parse(v) : v));
}

module.exports = { USER, newAudit, getCurrent, validDate, batchesOf, crypto };
