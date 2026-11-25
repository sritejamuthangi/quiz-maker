import { Router } from 'express';
import { HttpError } from '../lib/http.js';
import { bearerToken, safeEqual } from '../lib/security.js';
import { deleteAllExpiredTests } from '../lib/cleanup.js';

export function systemRoutes({ config, db }) {
  const router = Router();

  router.get('/health', async (req, res) => {
    try {
      await db.sequelize.authenticate();
      res.json({ ok: true, database: 'up' });
    } catch (error) {
      console.error('[health] database check failed', error?.message);
      res.status(503).json({ ok: false, database: 'down' });
    }
  });

  // Called once a day by Vercel Cron (which sends "Authorization: Bearer <CRON_SECRET>").
  router.get('/cron/cleanup', async (req, res) => {
    if (!config.cronSecret || !safeEqual(bearerToken(req), config.cronSecret)) {
      throw new HttpError(401, 'Unauthorized.', 'unauthorized');
    }
    const deleted = await deleteAllExpiredTests(db);
    res.json({ ok: true, deleted });
  });

  return router;
}
