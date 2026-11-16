const { neon } = require('@neondatabase/serverless');

let _sql = null;
let _ready = null;

function sql() {
  if (!_sql) {
    const url =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_URL_NON_POOLING;
    if (!url) throw new Error('DATABASE_URL is not set. Connect a Neon database in Vercel > Storage.');
    _sql = neon(url);
  }
  return _sql;
}

// Creates the tables the first time any API route runs (safe to run repeatedly).
function init() {
  if (!_ready) {
    _ready = (async () => {
      const q = sql();
      await q.query(`create table if not exists records (
        id bigserial primary key,
        k text not null,
        r jsonb not null,
        upload text,
        created_at timestamptz not null default now()
      )`);
      await q.query('create index if not exists records_k_idx on records (k)');
      await q.query('create index if not exists records_upload_idx on records (upload)');
      await q.query(`create table if not exists users (
        username text primary key,
        pass_hash text not null
      )`);
      await q.query(`create table if not exists login_attempts (
        ip text not null,
        at timestamptz not null default now()
      )`);
      await q.query('create index if not exists login_attempts_ip_idx on login_attempts (ip, at)');
      await q.query(`create table if not exists meta (
        key text primary key,
        value text
      )`);
    })().catch((e) => {
      _ready = null;
      throw e;
    });
  }
  return _ready;
}

module.exports = { sql, init };
