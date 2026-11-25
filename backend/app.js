import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { loadConfig } from './config.js';
import { createDatabase } from './db.js';
import { errorHandler } from './lib/http.js';
import { clientIp } from './lib/security.js';
import { publicRoutes } from './routes/tests.js';
import { manageRoutes } from './routes/manage.js';
import { systemRoutes } from './routes/system.js';

/**
 * Builds the Express app. The same app runs:
 *  - on Vercel as a serverless function (api/index.js),
 *  - locally or on any Node host via backend/server.js.
 */
export function createApp({ config = loadConfig(), db = createDatabase(config) } = {}) {
  const app = express();
  app.locals.config = config;
  app.locals.db = db;

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  const crossOrigin = config.corsOrigins.length > 0;
  app.use(helmet({ crossOriginResourcePolicy: { policy: crossOrigin ? 'cross-origin' : 'same-origin' } }));
  if (crossOrigin) {
    app.use(
      '/api',
      cors({
        origin: config.corsOrigins,
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'If-None-Match'],
        exposedHeaders: ['ETag', 'Retry-After'],
        maxAge: 600,
      }),
    );
  }

  // API responses are never cached unless a route says otherwise.
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // Burst protection per IP (generous: a whole classroom can share one IP).
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: config.limits.apiRequestsPerMinute,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      keyGenerator: (req) => ipKeyGenerator(clientIp(req, config)),
      validate: { trustProxy: false, xForwardedForHeader: false },
      handler: (req, res) =>
        res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.', code: 'rate_limited' }),
    }),
  );

  app.use('/api', express.json({ limit: '512kb' }));

  const context = { config, db };
  app.use('/api', systemRoutes(context));
  app.use('/api/tests', publicRoutes(context));
  app.use('/api/manage', manageRoutes(context));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.', code: 'not_found' }));
  app.use(errorHandler);

  return app;
}
