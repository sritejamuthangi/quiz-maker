// All server configuration comes from environment variables (see .env.example).

const DEV_SECRET = 'local-development-secret-do-not-use-in-production';

function int(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseTrustProxy(value) {
  if (value === undefined || value === '') return 1;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const n = Number(value);
  return Number.isInteger(n) ? n : value;
}

export function loadConfig(env = process.env) {
  const isVercel = Boolean(env.VERCEL);
  const deployed = isVercel || env.NODE_ENV === 'production';
  const appSecret = env.APP_SECRET || '';
  if (deployed && appSecret.length < 32) {
    throw new Error(
      'APP_SECRET is missing or too short. Set it to a random string of at least 32 characters ' +
        '(see .env.example for a command that generates one).',
    );
  }
  if (isVercel && !env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required on Vercel. Set your Neon Postgres connection string.');
  }

  // Local development gets very generous limits so testing doesn't trip them.
  const relaxed = !deployed;

  return {
    deployed,
    isVercel,
    databaseUrl: env.DATABASE_URL || '',
    sqliteStorage: env.SQLITE_STORAGE || '.data/dev.sqlite',
    appSecret: appSecret || DEV_SECRET,
    cronSecret: env.CRON_SECRET || '',
    turnstileSecret: env.TURNSTILE_SECRET_KEY || '',
    corsOrigins: (env.CORS_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    creationEnabled: env.CREATION_ENABLED !== 'false',
    limits: {
      testsPerIpPerHour: int(env, 'LIMIT_TESTS_PER_IP_HOUR', relaxed ? 1000 : 10),
      testsPerIpPerDay: int(env, 'LIMIT_TESTS_PER_IP_DAY', relaxed ? 5000 : 30),
      testsPerDayGlobal: int(env, 'LIMIT_TESTS_PER_DAY_GLOBAL', relaxed ? 100000 : 1000),
      responsesPerTest: int(env, 'LIMIT_RESPONSES_PER_TEST', 1000),
      submitsPerIpPerTestPerHour: int(env, 'LIMIT_SUBMITS_PER_IP_PER_TEST_HOUR', relaxed ? 100000 : 300),
      apiRequestsPerMinute: int(env, 'LIMIT_API_REQUESTS_PER_MIN', relaxed ? 100000 : 600),
    },
  };
}
