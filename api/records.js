const { sql, init } = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { sanitize, keyOf } = require('../lib/records');

const PAGE = 3000;      // records per download chunk (keeps each response well under Vercel's 4.5 MB limit)
const MAX_POST = 3000;  // records per upload request

const cleanId = (v) => String(v || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!requireAuth(req, res)) return;
    await init();
    const q = sql();

    if (req.method === 'GET') {
      const after = Math.max(0, parseInt(req.query.after, 10) || 0);
      let total;
      if (after === 0) {
        const m = await q.query("select value from meta where key = 'seeded'");
        if (!m.length) return res.status(200).json({ needsSeed: true, recs: [], last: 0, done: false, total: 0 });
        total = (await q.query('select count(*)::int as n from records'))[0].n;
      }
      const rows = await q.query('select id, r from records where id > $1 order by id limit $2', [after, PAGE]);
      return res.status(200).json({
        recs: rows.map((x) => x.r),
        last: rows.length ? Number(rows[rows.length - 1].id) : after,
        done: rows.length < PAGE,
        total
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const upload = cleanId(body.upload);
      if (!upload || upload === 'seed') return res.status(400).json({ error: 'Missing upload id.' });
      const list = Array.isArray(body.records) ? body.records : [];
      if (list.length > MAX_POST) return res.status(413).json({ error: 'Too many records in one request.' });

      const seen = new Set();
      const items = [];
      for (const raw of list) {
        const o = sanitize(raw);
        if (!o) continue;
        const k = keyOf(o);
        if (seen.has(k)) continue;
        seen.add(k);
        items.push([k, o]);
      }
      let fresh = items;
      if (items.length) {
        const ex = await q.query('select distinct k from records where k = any($1::text[])', [items.map((i) => i[0])]);
        const have = new Set(ex.map((x) => x.k));
        fresh = items.filter((i) => !have.has(i[0]));
      }
      if (fresh.length) {
        await q.query(
          'insert into records (k, r, upload) select t.k, t.r::jsonb, $3::text from unnest($1::text[], $2::text[]) as t(k, r)',
          [fresh.map((i) => i[0]), fresh.map((i) => JSON.stringify(i[1])), upload]
        );
      }
      return res.status(200).json({ added: fresh.length, skipped: list.length - fresh.length });
    }

    if (req.method === 'DELETE') {
      const upload = cleanId(req.query.upload);
      if (!upload || upload === 'seed') return res.status(400).json({ error: 'Missing upload id.' });
      const d = await q.query('delete from records where upload = $1 returning id', [upload]);
      return res.status(200).json({ deleted: d.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('records error', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
};
