// One-time setup: loads the original records (data/seed.ndjson.gz) into the database in slices.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { sql, init } = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { sanitize, keyOf } = require('../lib/records');

const SIZE = 2500;
let cache = null;

function lines() {
  if (!cache) {
    const buf = zlib.gunzipSync(fs.readFileSync(path.join(__dirname, '..', 'data', 'seed.ndjson.gz')));
    cache = buf.toString('utf8').split('\n').filter(Boolean);
  }
  return cache;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    if (!requireAuth(req, res)) return;
    await init();
    const q = sql();

    const m = await q.query("select value from meta where key = 'seeded'");
    if (m.length) return res.status(200).json({ done: true, next: 0, total: 0, already: true });

    const all = lines();
    const total = all.length;
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    if (offset === 0) await q.query("delete from records where upload = 'seed'"); // restart cleanly if a previous attempt stopped half-way

    const ks = [];
    const rs = [];
    for (const line of all.slice(offset, offset + SIZE)) {
      const o = sanitize(JSON.parse(line));
      if (!o) continue;
      ks.push(keyOf(o));
      rs.push(JSON.stringify(o));
    }
    if (ks.length) {
      await q.query(
        "insert into records (k, r, upload) select t.k, t.r::jsonb, 'seed' from unnest($1::text[], $2::text[]) as t(k, r)",
        [ks, rs]
      );
    }
    const next = Math.min(total, offset + SIZE);
    const done = next >= total;
    if (done) await q.query("insert into meta (key, value) values ('seeded', '1') on conflict (key) do nothing");
    return res.status(200).json({ done, next, total });
  } catch (e) {
    console.error('seed error', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
};
