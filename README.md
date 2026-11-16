# E-Search via Team Pitipiwpiw — online (Vercel + Neon database + login)

Same search page as before, now hosted on Vercel behind a username/password login.
Records live in a Neon Postgres database, so every upload or paste is saved for the whole team.

## Deploy (about 5 minutes)

1. **Put these files in a PRIVATE GitHub repository** (upload everything in this folder, keeping the folders as they are:
   `api/`, `lib/`, `public/`, `data/`, `package.json`, `vercel.json`).
2. On vercel.com choose **Add New → Project**, import the repo, leave all settings as they are, and click **Deploy**.
   (The first deploy will load but show a database error until step 3 is done.)
3. In the Vercel project open **Storage → Create Database → Neon (Postgres)**, create it, and **Connect** it to this project
   for all environments. This adds `DATABASE_URL` automatically.
4. Go to **Deployments → ⋯ → Redeploy** so the new variable is picked up.
5. Open your site and sign in. The very first sign-in loads the original 16,904 records into the database
   (about 10–20 seconds, only once).

Optional: add an environment variable `SESSION_SECRET` (any long random text) for the login cookies.
If you skip it, one is derived from the database URL.

## Login

The first-run account is `admin`. Its password is stored only as a salted scrypt hash, and on first sign-in
it is copied into the database `users` table. Failed logins are rate-limited (8 wrong tries per 15 minutes per IP).

## Using it

* **+ Add .txt file** / **📋 Paste new notes** work as before, but now save into the shared database.
  A green box appears after saving, with **Undo this upload** if you added the wrong thing.
* Duplicate rows (same rule as before) are skipped automatically.
* **Log out** is in the top bar.

## What is where

| Path | Purpose |
|---|---|
| `public/index.html` | The page (no records inside it any more) |
| `api/login.js`, `logout.js`, `me.js` | Sign in / out / session check |
| `api/records.js` | Loads records (in chunks), saves uploads, undo |
| `api/seed.js` + `data/seed.ndjson.gz` | One-time loading of the original records |
| `lib/` | Database + login helpers |

All record APIs refuse anyone who is not signed in. The `data/` folder is not served publicly.
