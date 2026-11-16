const { sql, init } = require('../lib/db');
const { ADMIN_USER, ADMIN_SEED_HASH, verifyPassword, setSession } = require('../lib/auth');

const MAX_FAILS = 8; // per IP per 15 minutes
const DUMMY = 'scrypt$00000000000000000000000000000000$' + '00'.repeat(64);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await init();
    const q = sql();
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();

    const recent = await q.query(
      "select count(*)::int as n from login_attempts where ip = $1 and at > now() - interval '15 minutes'",
      [ip]
    );
    if (recent[0].n >= MAX_FAILS) {
      return res.status(429).json({ error: 'Too many failed attempts. Please wait 15 minutes and try again.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    // Make sure the first-run admin account exists in the database.
    await q.query('insert into users (username, pass_hash) values ($1, $2) on conflict (username) do nothing', [
      ADMIN_USER,
      ADMIN_SEED_HASH
    ]);

    const rows = await q.query('select pass_hash from users where username = $1', [username]);
    const ok = verifyPassword(password, rows.length ? rows[0].pass_hash : DUMMY) && rows.length > 0;

    if (!ok) {
      await q.query('insert into login_attempts (ip) values ($1)', [ip]);
      await q.query("delete from login_attempts where at < now() - interval '1 day'");
      return res.status(401).json({ error: 'Wrong username or password.' });
    }

    await q.query('delete from login_attempts where ip = $1', [ip]);
    setSession(res, username);
    return res.status(200).json({ ok: true, user: username });
  } catch (e) {
    console.error('login error', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
};
