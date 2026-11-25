# Quiz Maker

Create a test, share a link, see scores instantly. Free, no sign-up, works on any phone or computer, and installs like an app.

Quiz Maker is a small full-stack web app for teachers, trainers and anyone who needs a quick quiz:

- **Creators** build a test in the browser and publish it without an account. They get a public test link and a private results link.
- **Test-takers** open the link, enter their name, answer, and see their score immediately. Nothing to install or sign up for.
- **Results** appear live in a private dashboard with statistics, per-question breakdowns, individual answer sheets and an Excel download.

The app is designed to run for free on **Vercel + Neon Postgres**, with durable limits that keep a free deployment from being abused.

---

## Features

### Creating tests

- Four question types: **multiple choice**, **checkboxes** (multiple answers), **true/false**, and **fill in the blank**.
- Optional explanations per question, shown with the results when the creator allows it.
- Points per question (1–100), automatic grading, all-or-nothing scoring for multi-answer and multi-blank questions.
- Templates for a practice quiz, a timed exam, or a blank test.
- Autosaved drafts in the browser, so a refresh or a dead battery does not lose work.
- **Import questions from Excel or CSV**, with a downloadable template that includes every question type.
- Preview the test exactly as a taker will see it, before publishing.
- Reorder, duplicate and delete questions; duplicate a whole test to make structural changes after responses exist.

### Running the test

- One public link plus a QR code; copy, native share or email it.
- Optional name and one extra field (for example “Roll number”).
- Optional timer, question/option shuffling, and **a random N questions per person**.
- Optional pass mark, close date, and retakes.
- Answers are saved on the taker's device while they work, so reloads and phone sleep do not lose progress.
- Timed attempts lock at the deadline and submit automatically. A delayed submission can still be accepted shortly after (up to one hour for a timed test), but anything more than 90 seconds late is flagged **Overtime** for the creator.
- A non-punitive count of how many times the taker left the test screen is recorded and shown to the creator.
- No camera, microphone, or screen recording. The production security headers explicitly disable camera, microphone, geolocation and payment APIs.
- Result visibility per test: **score + correct answers + explanations**, **score + right/wrong only**, or **score only**.
- On the same device, a submitted result is remembered; retakes are controlled by the browser, not by verified identity.

### Results dashboard

- Response count, average/median score, pass rate, score distribution, and average time.
- Per-question statistics: how many got it right, and which options people chose.
- Open any response to see the full answer sheet, score, duration, overtime flag and screen-leave count.
- Delete a single response or the whole test.
- Close and reopen a test, extend its retention period, and duplicate it.
- **Download results as a real `.xlsx` file** with Responses, Questions and Summary sheets.

### Platform

- Mobile-first layout with large tap targets, tested at phone and desktop sizes; uses standard web APIs supported by current Chrome, Edge, Firefox and Safari.
- Installable **PWA** with an app icon, standalone display, offline app shell and a polite “new version available” prompt. The app never prompts to reload in the middle of a test.
- Server-side grading, signed attempt tokens, idempotent submissions, and rate/quota limits.
- No analytics, no ad cookies, no accounts, and test/results pages are excluded from search engines.

---

## How the accountless links work

When a test is published, the server returns two things:

| Link | Who has it | What it does |
| --- | --- | --- |
| `https://your-site/t/abcd234567` | Anyone | Opens the test. The 10-character code can also be entered on the home page. |
| `https://your-site/manage/abcd234567#key=…` | Only the creator | Opens the private results dashboard and editor. |

The part after `#` is never sent to the server in HTTP requests. The browser sends it as an `Authorization: Bearer …` header, and the server stores only a SHA-256 hash of the key. That means:

- **There is no password recovery.** If the private link is lost, the results cannot be recovered. Keep it somewhere safe (the browser remembers it under “My tests” on the same device).
- Anyone with the private link can see the results and edit the test. Treat it like a password.
- “My tests” and drafts are stored in `localStorage` on the creator's device, not in an account.

---

## Question types and fill-in syntax

| Type | How it is written | Grading |
| --- | --- | --- |
| Multiple choice | 2–6 options, exactly one correct | Exact option match |
| Checkboxes | 2–6 options, one or more correct | All correct options and no incorrect ones |
| True / false | A statement and the correct value | Exact match |
| Fill in the blank | Text with `[answers]` in brackets | Every blank must match; all-or-nothing |

Fill-in examples:

```text
The capital of France is [Paris].
It is spelled [colour|color] in the UK and the US.
Use \[ and \] for literal brackets.
France is [Paris], Spain is [Madrid].
```

- `|` separates accepted alternatives inside one blank.
- Up to 10 blanks per question and 10 alternatives per blank.
- Matching ignores letter case by default, extra spaces, curly quotes/dashes, and trailing punctuation. A creator can mark a question case-sensitive.
- Empty answers never count as correct.

Up to 100 questions per test, 1–100 points per question.

---

## Test settings

| Setting | Default | Notes |
| --- | --- | --- |
| Time limit | none | Up to 600 minutes |
| Require name | on | Name is stored with the response |
| Extra field | none | One optional label, e.g. “Roll number” |
| Shuffle questions | off | Order differs per attempt |
| Shuffle options | off | Option order differs per attempt |
| Random questions per person | all | Pick N from the full set |
| Results visibility | full | `full`, `marks` or `score` |
| Pass mark | none | Percentage; shown as pass/fail |
| Allow retakes | off | Enforced by browser storage, not identity |
| Close date | none | Stop accepting responses at a chosen time |
| Retention | 30 days | 7, 30 or 90 days; can be extended later |

**Answer-key locking:** after the first response arrives, the parts that determine grading are locked: question types, points, adding/removing questions or options, correct options, true/false values and the answers in `[brackets]`. Title, description, question and option wording, explanations, ordering and result visibility stay editable. To change the answer key, duplicate the test as a new one.

---

## Local development

### Requirements

- **Node.js 22.12 or newer, below 25** (see `engines` in `package.json`).
- npm.
- No database server is needed locally: the API uses SQLite in `.data/dev.sqlite`.

### Start the app

```bash
npm install
npm run dev
```

- Website: <http://localhost:5173>
- API: <http://localhost:5000> (the Vite dev server proxies `/api`)

The first run creates the SQLite file automatically. To use Postgres locally instead, set `DATABASE_URL` in `.env` and run `npm run db:sync` once.

### Optional `.env`

```bash
cp .env.example .env
```

Everything has a safe local default. Production values are covered in [DEPLOY.md](./DEPLOY.md). Never commit `.env`.

### Production build locally

```bash
npm run build
npm run dev:api      # terminal 1: API on :5000
npm run preview      # terminal 2: built site on :4173
```

`npm run preview` serves the real `dist/` output with the same security headers as Vercel in `vercel.json`, proxying `/api` to the local API.

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | API + Vite dev server together |
| `npm run dev:api` | API only, with `node --watch` |
| `npm run dev:web` | Vite only |
| `npm run build` | Production frontend build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm start` | Run the API as a standalone Node server (no static files) |
| `npm run db:sync` | Create missing tables from `DATABASE_URL` (no-op locally without it) |
| `npm test` | Unit and API integration tests (Vitest) |
| `npm run test:e2e` | Full browser flows against Vite + isolated SQLite |
| `npm run test:pwa` | Build and verify manifest, service worker and headers |
| `npm run vercel-build` | What Vercel runs: sync the database, then build |

`npm run test:e2e` and `npm run test:pwa` need Playwright's Chromium once:

```bash
npx playwright install chromium
```

The E2E suites create their own SQLite files under `test-results/`, start their own servers on ports 5174/5175 and 5055/5056, and never touch `.data/dev.sqlite`.

---

## Importing questions

Download the `.xlsx` or `.csv` template from the import dialog. Each row is one question. A header row is used when present; columns can be in any order and common alternative names are accepted (`Answer`, `Marks`, `Choice A`, …). Without a header row, the template order is assumed.

| Column | Values |
| --- | --- |
| Type | `Multiple choice`, `Checkboxes`, `True/False`, `Fill in the blank` |
| Question | The question text. For blanks, use `[answers]` or mark gaps with `___`. |
| Option A–F | Option text (choice and checkbox questions) |
| Correct | Option letter (`B`, or `A, C`), `True`/`False`, or blank answers separated by `;` |
| Explanation | Optional |
| Points | Optional, defaults to 1 |

Fill-in questions can either put answers in brackets in the Question column or use `___` gaps plus the Correct column, for example question `Water is H2O: [hydrogen] and [oxygen].` or `Water is made of hydrogen and ___.` with Correct `oxygen`. For several `___` gaps, separate the answers with `;`.

Reading is forgiving: UTF-8 BOMs, quoted commas, CRLF line endings and blank rows are handled. Rows with problems are listed with their row number and skipped; valid rows can still be added. Old `.xls` files are rejected — save as `.xlsx` first. Files are limited to 5 MB and 100 imported questions per test.

---

## Limits and abuse controls

Defaults in production (all configurable through environment variables):

| Control | Default |
| --- | --- |
| Tests per IP per hour | 10 |
| Tests per IP per day | 30 |
| Tests site-wide per day | 1,000 |
| Responses per test | 1,000 |
| Submissions per IP per test per hour | 300 |
| API requests per IP per minute | 600 |
| Questions per test | 100 |
| Request body size | 512 KB |

Additional protections:

- Durable creation quotas counted in the database, so they survive restarts and work across serverless instances.
- A honeypot field that real users never fill in.
- Optional **Cloudflare Turnstile** check when publishing.
- An emergency switch, `CREATION_ENABLED=false`, that pauses new tests while existing tests keep working.
- Expired tests are deleted opportunistically whenever a test is created and by a daily cleanup job.
- All grading is done on the server. The browser never receives correct answers for a test whose results are set to `marks` or `score`.

Local development uses very generous limits so testing does not trip them.

---

## Data, privacy and retention

Stored on the server:

- The test: title, description, questions, answer key, settings, timestamps, and a one-way hash of the creator's IP address for quotas.
- Each response: the name and optional extra field the test asks for, the answers, score, time taken, start time, screen-leave count, overtime flag, and a one-way hash of the IP address.
- No raw IP addresses, no passwords, no email addresses, no tracking cookies.
- Deleting a test deletes all of its responses through a database foreign-key cascade.

Stored only in the browser (`localStorage`, prefix `qm:`):

- Drafts and unsaved edits.
- The creator's “My tests” list, including private keys.
- An attempt in progress (so reloads can resume).
- The last result on that device, and the taker's name/extra field for convenience.

Retention:

- The creator chooses 7, 30 or 90 days at publishing time and can extend it later.
- Expired tests and their responses are deleted automatically. The daily Vercel Cron job calls `/api/cron/cleanup`; expired tests are also cleaned opportunistically on new test creation.
- Creators can delete an individual response or the entire test at any time.
- Database backups (for example Neon's history) may retain deleted rows for their own retention window. Check your database provider's policy.

Privacy and search engines:

- `/t/*` and `/manage/*` send `X-Robots-Tag: noindex, nofollow` in production and are disallowed in `robots.txt`.
- The app has no analytics or advertising scripts.
- A plain-language privacy page is built into the app at `/privacy`.

If you collect personal data from test-takers, you are the data controller for your deployment. Adjust the privacy page and retention settings to fit your organization's rules.

---

## Architecture

```text
Browser (React + Vite + MUI)
   │  /api/* (same origin in production)
   ▼
Express 5 app ──────────────► Sequelize
   │                            ├─ Postgres (Neon) in production
   │                            └─ SQLite file locally/tests
   ├─ POST /api/tests                 create a test
   ├─ GET  /api/tests/:id             public test metadata
   ├─ POST /api/tests/:id/start       questions without answers + signed token
   ├─ POST /api/tests/:id/submit      server-side grading, idempotent by nonce
   ├─ GET/PATCH/DELETE /api/manage/:id… private dashboard, edit, export, delete
   ├─ GET  /api/health                database health check
   └─ GET  /api/cron/cleanup          daily retention job (Bearer CRON_SECRET)
```

Why the design is safe with no accounts:

- The **private key is 192 bits**, generated on the server, stored only as a hash, and sent as a bearer token. Comparison is constant-time.
- **Start tokens are HMAC-signed** and bind the test id, start time, a random nonce, the question-selection seed, and an attempt version derived from the current answer key and settings.
- The server re-derives exactly which questions were shown and grades them itself.
- **Submissions are idempotent by nonce**, so a retry after a dropped connection returns the original result instead of creating a duplicate.
- If the creator changes the questions (including wording) or the timing/selection rules after an attempt started, the version check rejects the stale attempt and asks the taker to restart.
- Database row locks plus a Postgres advisory lock coordinate concurrent edits, submissions and quota checks; SQLite is serialized.
- If a timed submission is interrupted, the browser freezes and reuses the same answer snapshot, so a retry cannot change answers.

### Project structure

```text
api/index.js                 Vercel serverless entry point
backend/
  app.js                     Express app (runs on Vercel and as a Node server)
  server.js                  Standalone Node server for local/other hosts
  config.js                  Environment configuration and limits
  db.js, models.js           Sequelize setup and models
  routes/                    Public tests, management, system/health/cron
  lib/                       Security, quotas, transactions, views, cleanup, Turnstile
  scripts/predeploy.js       Env checks + table creation during deploy
  __tests__/                 API integration tests
shared/                      Code used by both browser and server
  schema.js                  Zod validation
  grading.js                 Question selection, grading, review, answer-key diffing
  blanks.js                  Fill-in-the-blank parser and answer matching
  stats.js, templates.js, limits.js, random.js
frontend/src/
  pages/                     Home, Create/builder, Take, Manage, Privacy
  components/                Builder, taking, dashboard, sharing, install/update UI
  lib/                       API client, storage, Excel, import, formatting
  __tests__/                 Frontend unit tests
e2e/                         Playwright functional and PWA suites
vercel.json                  Rewrites, cron, security and cache headers
```

The builder preview runs the same grading code as the server. Validation, statistics and limits are also shared modules, so the browser and the API stay in sync.

### Tech stack

React 19, Vite 8, MUI 9, React Router 7, Express 5, Sequelize 6, Zod 4, Neon Postgres (production), SQLite (local/tests), Playwright, Vitest, `vite-plugin-pwa`/Workbox.

---

## Testing

| Suite | Command | Covers |
| --- | --- | --- |
| Unit + API | `npm test` | Validation, blanks, grading, stats, drafts, import (including CSV edge cases), real `.xlsx` round-trips, and the full API including quotas, locking, idempotent retry and overtime |
| Functional E2E | `npm run test:e2e` | Build → publish → share/copy → take with reloads and resume → submit → score/review → dashboard/details → real Excel download → answer-key lock; timed auto-submit; dropped-connection retry; 390×844 mobile layout |
| Production PWA | `npm run test:pwa` | Real `dist/` build: manifest fields/icons, activated service worker, controlled page after reload, precache contents, `/api/health`, CSP and `X-Frame-Options` |

Current status on the development machine:

- `npm test`: **89 tests across 8 files, all passing**
- `npm run test:e2e`: **4/4 passing**
- `npm run test:pwa`: **1/1 passing**
- `npm run build`: passes, 49 precached entries (~1,032 KiB uncompressed)

Live Neon and Vercel behavior cannot be verified from a local machine; see the post-deploy checklist in [DEPLOY.md](./DEPLOY.md).

---

## Deployment

The short version:

1. Create a free Neon Postgres database and copy the **pooled** connection string.
2. Generate `APP_SECRET` and `CRON_SECRET`.
3. Import this repository into Vercel and set the environment variables.
4. Deploy. The build creates the tables and the daily cleanup cron is configured in `vercel.json`.
5. Open `/api/health`, create a test and take it once.

Full step-by-step instructions, configuration reference, backups and troubleshooting: **[DEPLOY.md](./DEPLOY.md)**.

---

## Customizing

- **App name/tagline:** `frontend/src/config.js`, plus `frontend/index.html` and the manifest in `vite.config.js`.
- **Colours/theme:** `frontend/src/theme.js` (the default teal is `#0b5a72`).
- **Size limits, question types and retention choices:** `shared/limits.js`.
- **Starting templates:** `shared/templates.js`.
- **Deployment quotas and rate limits:** environment variables, defaults in `backend/config.js`.

The frontend assets, including icons, live in `frontend/public/`. Regenerate PWA icons with `npx pwa-assets-generator` if you change the logo.

---

## License

MIT. See [LICENSE](./LICENSE).
