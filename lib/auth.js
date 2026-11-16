const crypto = require('crypto');

const COOKIE = 'esearch_session';
const MAX_AGE = 60 * 60 * 24 * 14; // stay signed in for 14 days

// First-run admin account. Only a salted scrypt hash is stored here, never the password itself.
// On the first login it is copied into the database "users" table; after that the database is the source of truth.
const ADMIN_USER = 'admin';
const ADMIN_SEED_HASH = 'scrypt$5a6d520c98d4395d681f6b84af4ae3b2$cf91a2bf5706e80990950bf08b83e9bb27b3eb4078b20c486122f4b0c3c162dad6dd128b224f6d201e2dc708ef4b281c3bf37502a4804e950441360624389f83';

function verifyPassword(password, stored) {
  try {
    const [scheme, saltHex, hashHex] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);
    return crypto.timingSafeEqual(actual, expected);
  } catch (e) {
    return false;
  }
}

function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const base = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'esearch-dev-secret';
  return crypto.createHash('sha256').update('esearch-session:' + base).digest('hex');
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

function makeToken(user) {
  const payload = Buffer.from(JSON.stringify({ u: user, exp: Date.now() + MAX_AGE * 1000 })).toString('base64url');
  return payload + '.' + sign(payload);
}

function readCookie(req, name) {
  const h = req.headers && req.headers.cookie;
  if (!h) return null;
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function getUser(req) {
  const tok = readCookie(req, COOKIE);
  if (!tok) return null;
  const [payload, sig] = tok.split('.');
  if (!payload || !sig) return null;
  const good = sign(payload);
  const a = Buffer.from(sig), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!d.u || !d.exp || d.exp < Date.now()) return null;
    return d.u;
  } catch (e) {
    return null;
  }
}

function setSession(res, user) {
  res.setHeader('Set-Cookie', COOKIE + '=' + makeToken(user) + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=' + MAX_AGE);
}
function clearSession(res) {
  res.setHeader('Set-Cookie', COOKIE + '=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
}

// Returns the signed-in username, or sends 401 and returns null.
function requireAuth(req, res) {
  const u = getUser(req);
  if (!u) {
    res.status(401).json({ error: 'Please sign in.' });
    return null;
  }
  return u;
}

module.exports = { ADMIN_USER, ADMIN_SEED_HASH, verifyPassword, setSession, clearSession, getUser, requireAuth };
