// Runs the API as a normal long-running Node server: `npm run dev` / `npm start`.
// Use this for local development or to host the API on Render, Railway, a VPS, etc.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase } from './db.js';
import { deleteExpiredTests } from './lib/cleanup.js';

try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: that's fine, environment variables can come from the host.
}

const config = loadConfig();
if (!config.databaseUrl) {
  mkdirSync(dirname(config.sqliteStorage), { recursive: true });
  console.log(`[api] DATABASE_URL is empty, using local SQLite file ${config.sqliteStorage}`);
}

const db = createDatabase(config);
await db.sequelize.sync();

const app = createApp({ config, db });
const port = Number(process.env.PORT) || 5000;
app.listen(port, () => console.log(`[api] listening on http://localhost:${port}`));

// Long-running hosts don't have Vercel Cron, so clean up expired tests hourly.
setInterval(() => {
  deleteExpiredTests(db, { limit: 200 }).catch((error) => console.error('[cleanup]', error?.message));
}, 60 * 60 * 1000).unref();
