// Runs during the Vercel build (`npm run vercel-build`) and via `npm run db:sync`.
// 1. Checks that required environment variables are set (fails the production build if not).
// 2. Creates the database tables and indexes if they don't exist yet.
import { loadConfig } from '../config.js';
import { createDatabase } from '../db.js';

try {
  process.loadEnvFile('.env');
} catch {
  // No .env file locally: fine.
}

const env = process.env.VERCEL_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'development');
const isProduction = env === 'production';

const problems = [];
if (!process.env.DATABASE_URL) problems.push('DATABASE_URL is not set (your Neon pooled connection string).');
if ((process.env.APP_SECRET || '').length < 32) problems.push('APP_SECRET is not set or shorter than 32 characters.');
if (!process.env.CRON_SECRET) problems.push('CRON_SECRET is not set, so the daily cleanup job will be rejected.');

for (const problem of problems) console.warn(`[predeploy] ${problem}`);

const fatal = problems.filter((p) => !p.startsWith('CRON_SECRET'));
if ((isProduction || process.env.VERCEL) && fatal.length > 0) {
  console.error('[predeploy] Fix the environment variables above in Vercel → Project → Settings → Environment Variables, then redeploy.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.warn(`[predeploy] Skipping database setup (${env}).`);
  process.exit(0);
}

const config = loadConfig();
const db = createDatabase(config);
try {
  await db.sequelize.authenticate();
  await db.sequelize.sync();
  console.log('[predeploy] Database tables are ready.');
} catch (error) {
  console.error('[predeploy] Could not set up the database:', error?.message);
  process.exitCode = 1;
} finally {
  await db.sequelize.close();
}
