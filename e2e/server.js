// End-to-end test server: the normal API plus one isolated control endpoint.
import { createServer } from 'node:http';
import { createApp } from '../backend/app.js';
import { loadConfig } from '../backend/config.js';
import { createDatabase } from '../backend/db.js';
import { signAttemptToken, verifyAttemptToken } from '../backend/lib/security.js';

const config = loadConfig();
const db = createDatabase(config);
await db.sequelize.sync();
const app = createApp({ config, db });

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

// This endpoint is intercepted before Express's JSON API 404 handler. It makes a
// genuinely started, still-valid token appear older, so timed-submission and
// overtime behaviour can be tested without waiting in real time.
async function ageAttemptToken(req, res) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  let body;
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return json(res, 400, { error: 'invalid json' });
  }
  const claims = verifyAttemptToken(config.appSecret, body.token);
  if (!claims) return json(res, 400, { error: 'invalid token' });
  const ageSeconds = Math.max(0, Math.min(6 * 60 * 60, Number(body.ageSeconds) || 600));
  const token = signAttemptToken(config.appSecret, { ...claims, s: Date.now() - ageSeconds * 1000 });
  return json(res, 200, { token });
}

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/test/age-attempt-token') {
    ageAttemptToken(req, res).catch((error) => json(res, 500, { error: error.message }));
    return;
  }
  app(req, res);
});

server.listen(Number(process.env.PORT) || 5055, '127.0.0.1', () => console.log('[e2e] API ready'));
