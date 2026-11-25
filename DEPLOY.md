# Deploying Quiz Maker

This guide takes you from an empty Neon account to a working public site on Vercel. It should take about 15 minutes. The free tiers described here do not normally require a credit card.

The recommended stack:

| Piece | Service | Cost |
| --- | --- | --- |
| Website + API | [Vercel](https://vercel.com) (Hobby) | Free |
| Postgres database | [Neon](https://neon.tech) | Free tier |
| Bot check (optional) | [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) | Free |

> Check the providers' current plan terms and limits before relying on them for production, especially for commercial use. Free tiers change over time.

---

## Before you start

You need:

- This project in a Git repository on GitHub, GitLab or Bitbucket (Vercel deploys from Git), **or** the Vercel CLI.
- A Vercel account.
- A Neon account.
- Node.js 22.12–24 locally if you want to run commands or test the production build.

If the project is not in Git yet:

```bash
git init
git add .
git commit -m "Quiz Maker"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/quiz-maker.git
git push -u origin main
```

`.env`, `node_modules/`, `dist/`, `test-results/` and local SQLite files are already ignored. Do not commit secrets.

---

## Step 1 — Create the Neon database

1. Sign in at <https://console.neon.tech> and choose **New Project**.
2. Pick a region close to where your Vercel functions will run (for example, both in US East or both in EU Central). Latency between the function and the database matters more than latency to you.
3. Keep the default database name (`neondb`) or choose your own. Postgres 17 is fine.
4. After the project is created, open **Connect** (or **Connection Details**).
5. Turn **Connection pooling** **on** and copy the connection string. It looks like:

   ```text
   postgresql://neondb_owner:PASSWORD@ep-cool-name-123456-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

   The host contains `-pooler`. **Use this pooled URL** for `DATABASE_URL`: serverless functions open many short-lived connections, and the pooler keeps them under control.
6. Save the string somewhere private. You can also copy the **direct** (non-pooled) URL; you will want it for manual backups, but not for the app.

Notes:

- The app enforces SSL for non-local databases. Neon's certificate works with the default Node trust store, so no extra CA file is needed.
- Neon's free plan may suspend a database after inactivity. The first request after a pause is slower (usually a few seconds) but wakes it automatically. Keep that in mind for the first visit of the day.
- You do **not** need to create tables by hand. The build does it (Step 4).

---

## Step 2 — Generate secrets

Generate two independent random values. Run this twice:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

- **`APP_SECRET`** — signs attempt tokens and hashes IP addresses. Must be **at least 32 characters**. Keep it secret and stable.
- **`CRON_SECRET`** — authenticates the daily cleanup request. Any long random value works.

> Changing `APP_SECRET` later does not break private results links (those use a separate hash), but it invalidates attempts that are in progress: those takers will have to start again. Rotate it only if it leaks.

On PowerShell you can also use:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

But prefer the Node command: it uses a cryptographic random source.

---

## Step 3 — Optional: enable Cloudflare Turnstile

Turnstile adds an invisible (usually) “are you a human?” check when someone publishes a test. It is optional but recommended for a public site.

1. In the Cloudflare dashboard, open **Turnstile** → **Add widget**.
2. Add the hostnames you will use, for example `your-project.vercel.app` and your custom domain if you have one.
3. Choose **Managed** mode.
4. Copy the **Site Key** and **Secret Key**.
5. Set both on Vercel:

   | Variable | Value | Where it is used |
   | --- | --- | --- |
   | `VITE_TURNSTILE_SITE_KEY` | Site key | Baked into the frontend at **build time** |
   | `TURNSTILE_SECRET_KEY` | Secret key | Checked by the API at runtime |

Important: the site key is compiled into the JavaScript bundle. After adding or changing it, **redeploy** (a new build). Setting only one of the two keys leaves the check disabled or makes publishing fail; set both or neither.

The production CSP in `vercel.json` already allows `https://challenges.cloudflare.com`.

---

## Step 4 — Deploy to Vercel

### 4a. Import the project

1. Sign in at <https://vercel.com/new>.
2. Import your Git repository.
3. Use these settings:
   - **Framework preset:** Vite
   - **Root directory:** the repository root (leave empty)
   - **Build command:** leave the default / “from vercel.json” — it is `npm run vercel-build`
   - **Output directory:** `dist` (also from `vercel.json`)
   - **Install command:** `npm install`
4. Under **Settings → General → Node.js Version**, choose **22.x**. The project requires Node `>=22.12 <25`.

Do not override the build command or output directory: `vercel.json` already contains the correct values, the API rewrites, the cron job and the security headers.

### 4b. Add environment variables

In **Settings → Environment Variables**, add these for **Production** (and for **Preview** too if you use preview deployments):

| Variable | Required | Example / notes |
| --- | --- | --- |
| `DATABASE_URL` | **Yes** | Neon **pooled** connection string |
| `APP_SECRET` | **Yes** | 32+ random characters |
| `CRON_SECRET` | **Yes** in practice | Random; without it the cleanup endpoint returns 401 |
| `TURNSTILE_SECRET_KEY` | Optional | Cloudflare secret key |
| `VITE_TURNSTILE_SITE_KEY` | Optional | Cloudflare site key; requires a rebuild |
| `CREATION_ENABLED` | Optional | Set to `false` to pause new tests |
| `LIMIT_TESTS_PER_IP_HOUR` | Optional | Default `10` |
| `LIMIT_TESTS_PER_IP_DAY` | Optional | Default `30` |
| `LIMIT_TESTS_PER_DAY_GLOBAL` | Optional | Default `1000` |
| `LIMIT_RESPONSES_PER_TEST` | Optional | Default `1000` |
| `LIMIT_SUBMITS_PER_IP_PER_TEST_HOUR` | Optional | Default `300` |
| `LIMIT_API_REQUESTS_PER_MIN` | Optional | Default `600` |

Vercel applies variables per environment. A build that runs without `DATABASE_URL` or `APP_SECRET` **fails on purpose** with a message telling you which one is missing. Preview deployments need the same variables if you deploy previews, because the build connects to the database.

### 4c. Deploy

Click **Deploy**. During the build you should see:

```text
[predeploy] Database tables are ready.
...
PWA ... precache 49 entries ...
```

The first build creates the `tests` and `attempts` tables and their indexes. There is no manual migration step.

If you prefer the CLI:

```bash
npx vercel          # preview deployment
npx vercel --prod   # production deployment
```

The CLI still needs the environment variables configured in the Vercel project.

### 4d. Make sure the site is public

Vercel can protect deployments with **Deployment Protection**. Preview deployments are often protected by default; production normally is not. If opening a test link asks you to log in to Vercel, go to **Settings → Deployment Protection** and disable protection for **Production** (or use a custom domain with protection off).

---

## Step 5 — Verify the deployment

### Health check

Open:

```text
https://YOUR-PROJECT.vercel.app/api/health
```

Expected:

```json
{ "ok": true, "database": "up" }
```

A `503` with `"database": "down"` means the function is running but cannot reach Postgres. Recheck `DATABASE_URL` and whether the Neon project is suspended.

### Full smoke test

1. Open the home page and create a test with one question of each type.
2. Publish it. The share dialog should show a public link and a private link.
3. Open the public link in a private/incognito window, enter a name, answer, and submit.
4. Confirm the score and review screen appear.
5. Open the private link (the one containing `#key=`) and confirm the response, statistics and details are visible.
6. Click **Download Excel** and open the `.xlsx` file.
7. Reload the private link; it should still work. The key must be present after `#`.
8. On a phone, open the site and use the install prompt (Android/desktop Chrome or Edge), or **Share → Add to Home Screen** on iPhone.

### Cleanup job

The cron in `vercel.json` runs daily at **03:17 UTC**. Vercel calls it with `Authorization: Bearer <CRON_SECRET>` automatically.

Test it manually (PowerShell):

```powershell
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }  # or paste the secret value
Invoke-RestMethod -Uri "https://YOUR-PROJECT.vercel.app/api/cron/cleanup" -Headers $headers
```

Expected: `{"ok":true,"deleted":0}` (or however many expired tests were removed).

Without the header it must return `401`. That is the correct behaviour, not a bug.

Expired tests are also deleted opportunistically whenever a new test is created, so storage stays bounded even if the cron is misconfigured.

### Security headers

```bash
curl -I https://YOUR-PROJECT.vercel.app/
```

You should see `Content-Security-Policy`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `Permissions-Policy` (camera/microphone disabled), and `Strict-Transport-Security`. API responses get Helmet's headers from Express.

---

## Step 6 — Custom domain (optional)

1. In Vercel: **Settings → Domains → Add**, then follow the DNS instructions.
2. If you use Turnstile, add the new hostname to the widget in Cloudflare. No key change is needed.
3. Redeploy only if you changed a `VITE_*` variable.

Nothing in the app hard-codes the domain: links are built from `window.location.origin`.

---

## Configuration reference

### Runtime variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | empty (SQLite locally) | Postgres connection string; **required on Vercel** |
| `APP_SECRET` | dev-only fallback locally | Token signing and IP hashing; **required in production** |
| `CRON_SECRET` | empty | Bearer token for `/api/cron/cleanup` |
| `TURNSTILE_SECRET_KEY` | empty (disabled) | Enables the server-side bot check |
| `VITE_TURNSTILE_SITE_KEY` | empty (disabled) | Frontend widget; build-time value |
| `CREATION_ENABLED` | `true` | Set `false` to stop new tests (existing tests keep working) |
| `SQLITE_STORAGE` | `.data/dev.sqlite` | Local/test SQLite path |
| `PORT` | `5000` | Standalone Node server port |
| `CORS_ORIGINS` | empty | Comma-separated origins, only if the API is on another domain |
| `VITE_API_URL` | same origin | API base URL, only if the API is on another domain; build-time value |
| `TRUST_PROXY` | `1` | Number of proxies in front of a standalone server |

### Limits

| Variable | Production default |
| --- | --- |
| `LIMIT_TESTS_PER_IP_HOUR` | 10 |
| `LIMIT_TESTS_PER_IP_DAY` | 30 |
| `LIMIT_TESTS_PER_DAY_GLOBAL` | 1000 |
| `LIMIT_RESPONSES_PER_TEST` | 1000 |
| `LIMIT_SUBMITS_PER_IP_PER_TEST_HOUR` | 300 |
| `LIMIT_API_REQUESTS_PER_MIN` | 600 |

Guidance:

- **A whole classroom often shares one public IP.** The per-IP submission limit (300 per test per hour) is deliberately generous, but a very large exam on one school network could reach it. Raise `LIMIT_SUBMITS_PER_IP_PER_TEST_HOUR` if needed.
- The per-IP creation quotas matter less for takers; they only apply to publishing tests.
- `LIMIT_TESTS_PER_DAY_GLOBAL` is the main protection for your database bill. On a small free Neon plan, consider lowering it (for example to 200) and raising it only if you need to.
- Changes to environment variables take effect on the next deployment or after Vercel redeploys the project. `VITE_*` changes always require a new build.
- `CREATION_ENABLED=false` is the emergency brake. It does not affect taking existing tests.

### Retention

Creators choose 7, 30 or 90 days. The default is 30. The creator can extend a test later from the dashboard. Expired tests are deleted with their responses.

---

## Operating notes

### Backups

The Excel export is convenient for results but is **not** a full backup: it does not contain private keys, and it is generated per test.

For a real backup, use Neon's branching/history features (availability depends on plan), or `pg_dump` with the **direct** (non-pooled) connection string:

```bash
pg_dump "postgresql://USER:PASSWORD@ep-xxx.REGION.aws.neon.tech/neondb?sslmode=require" \
  --format=custom --file=quiz-maker-backup.dump
```

Restore into a new Neon database:

```bash
pg_restore --dbname="postgresql://.../neondb?sslmode=require" --clean --if-exists quiz-maker-backup.dump
```

Use a `pg_dump` version that matches or is newer than the Postgres server version. Keep backups private: they contain names and answers.

### Schema changes

The project uses `sequelize.sync()` during the build. It **creates missing tables and indexes**, but it does **not** alter existing columns. For future schema changes, add a proper migration (or run reviewed SQL against Neon) instead of assuming `sync()` will change a column type. For the initial deployment, no action is needed.

### Updating the app

Push to the connected branch. Vercel builds, runs `predeploy` (which re-checks the environment and ensures tables exist), and publishes. The PWA prompts existing users to update; it intentionally does not prompt while someone is taking a test.

### Rolling back

Vercel can instantly promote an earlier deployment (**Deployments → … → Promote to Production**). This rolls back code only. Database rows created by the newer version remain, and schema changes are **not** undone automatically. If you added columns or tables with manual SQL, review them before rolling back.

### Deleting everything

- Delete the Vercel project to remove the site and cron.
- Delete the Neon project to remove all tests and responses.
- Deleting the Git repository does not delete either.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Build fails: `APP_SECRET is missing or too short` | Missing or short secret | Set a 32+ character `APP_SECRET` for the environment being built, then redeploy |
| Build fails: `DATABASE_URL is required on Vercel` | Variable missing | Add the Neon pooled URL in Vercel environment variables |
| Build fails: `Could not set up the database` | Bad URL, database missing, suspended project, SSL/network issue | Copy the pooled URL again, confirm the database exists and the Neon project is active, then redeploy |
| Site loads, but publishing says “server is not configured correctly” | The serverless function threw during startup (usually an env var) | Check **Deployments → Functions logs** and the environment variables |
| `/api/health` returns 503 | Database unreachable | Check `DATABASE_URL`, Neon status, and whether the project is suspended |
| Publishing returns `429` | A quota or rate limit was reached | Wait, or raise the relevant `LIMIT_*` value |
| Many students behind one school IP get `429` | Per-IP submission limit | Raise `LIMIT_SUBMITS_PER_IP_PER_TEST_HOUR` |
| Cleanup returns `401` | `CRON_SECRET` missing or different | Set it, redeploy, and call with the same value |
| Private link says “not valid” | The `#key=…` part was lost, or the test expired/was deleted | Use the full link copied from the share dialog; keys cannot be recovered if lost |
| Turnstile never passes | Only one key set, wrong domain, or blocked script | Set both keys, add the site's hostname to the widget, redeploy after changing the site key |
| “New version available” keeps appearing | An old tab or service worker is still active | Close all tabs for the site and reopen; the worker updates on the next load |
| PWA does not offer installation | Not HTTPS, already installed, unsupported browser, or dev mode | Test the production build over HTTPS; on iPhone use Share → Add to Home Screen |
| First request of the day is slow | Neon free tier woke from suspend | Expected; retry or keep the database warm |
| Excel download is empty | No responses yet | The export is available once at least one response exists |

### Logs

- **Vercel:** Project → **Deployments** → select a deployment → **Functions** / **Build Logs**. Look for `[api]`, `[predeploy]`, `[health]` and `[turnstile]` messages.
- **Neon:** the SQL editor and monitoring tabs show connections and slow queries.
- **Browser:** the Network tab shows the exact API error; the app surfaces most messages in a snackbar or alert.

---

## Alternative: API on a separate host

The API is also a normal Node server (`npm start`), so it can run on Render, Railway, Fly.io, a VPS, etc. This is optional and not needed for Vercel.

If you split the deployment:

1. Build the frontend with `VITE_API_URL=https://your-api.example.com` (build-time).
2. Set `CORS_ORIGINS=https://your-site.example.com` on the API.
3. Set `TRUST_PROXY` to the number of proxies in front of the API (often `1`).
4. The standalone server runs `sync()` at startup and cleans up expired tests **hourly**; no Vercel cron is needed.

The rest of the environment variables are the same. Keep `APP_SECRET` identical across API instances.

---

## Post-deploy checklist

- [ ] Neon project created; pooled connection string copied.
- [ ] `APP_SECRET` (32+) and `CRON_SECRET` generated and stored safely.
- [ ] Vercel project imported with Node 22.x.
- [ ] `DATABASE_URL`, `APP_SECRET`, `CRON_SECRET` set for production (and preview, if used).
- [ ] Optional Turnstile keys set; site rebuilt after changing `VITE_TURNSTILE_SITE_KEY`.
- [ ] Build shows `[predeploy] Database tables are ready.`
- [ ] `/api/health` returns `{"ok":true,"database":"up"}`.
- [ ] Test created and published; both links work.
- [ ] Test taken in incognito; score and review correct.
- [ ] Dashboard shows the response; Excel download opens.
- [ ] Cleanup endpoint returns 401 without a token and 200 with it.
- [ ] Security headers present; `/t/…` and `/manage/…` send `noindex`.
- [ ] App installs on a phone and opens standalone.
- [ ] Deployment Protection does not block production.
- [ ] Backups or Neon history understood and enabled as needed.

Once these pass, the deployment is complete. See [README.md](./README.md) for local development, features and the data model.
