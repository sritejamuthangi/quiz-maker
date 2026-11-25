import { Router } from 'express';
import { createTestSchema, submitSchema } from '../../shared/schema.js';
import { gradeAttempt, prepareAttempt, selectQuestionIds } from '../../shared/grading.js';
import { OVERTIME_GRACE_SECONDS } from '../../shared/limits.js';
import { HttpError, parseOrThrow } from '../lib/http.js';
import {
  PUBLIC_ID_RE,
  attemptVersion,
  clientIp,
  hashAdminKey,
  hashIp,
  newAdminKey,
  newAttemptNonce,
  newPublicId,
  newSeed,
  signAttemptToken,
  verifyAttemptToken,
} from '../lib/security.js';
import { enforceCreateQuota, enforceSubmitQuota } from '../lib/quotas.js';
import { deleteExpiredTests } from '../lib/cleanup.js';
import { verifyTurnstile } from '../lib/turnstile.js';
import { attemptResult, isExpired, publicTestMeta, takerSettings, testStatus } from '../lib/views.js';
import { lockCreation, transaction } from '../lib/transactions.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_MESSAGES = {
  closed: "This test is closed and isn't accepting responses.",
  full: 'This test has reached its maximum number of responses.',
  expired: 'This test has expired and is no longer available.',
};

export function publicRoutes({ config, db }) {
  const router = Router();

  async function findTest(publicId, tx) {
    const test = PUBLIC_ID_RE.test(publicId)
      ? await db.Test.findOne({ where: { publicId }, transaction: tx, ...(tx ? { lock: tx.LOCK.UPDATE } : {}) })
      : null;
    if (!test) throw new HttpError(404, "We couldn't find this test. Check the link and try again.", 'not_found');
    if (isExpired(test)) throw new HttpError(410, STATUS_MESSAGES.expired, 'expired');
    return test;
  }

  // Create a test --------------------------------------------------------------
  router.post('/', async (req, res) => {
    const body = req.body ?? {};
    if (!config.creationEnabled) {
      throw new HttpError(503, 'Creating new tests is paused right now. Please try again later.', 'creation_paused');
    }
    // Honeypot field that real people never see or fill in.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      throw new HttpError(400, 'Could not create the test.', 'rejected');
    }

    const input = parseOrThrow(createTestSchema, body);
    const ip = clientIp(req, config);
    const ipHash = hashIp(config.appSecret, ip);

    if (config.turnstileSecret) {
      const human = await verifyTurnstile(config.turnstileSecret, body.turnstileToken, ip);
      if (!human) throw new HttpError(403, 'The bot check failed. Please try publishing again.', 'bot_check_failed');
    }

    // Opportunistic cleanup so storage stays bounded even without the daily cron.
    await deleteExpiredTests(db, { limit: 10 }).catch((error) => console.warn('[cleanup]', error?.message));

    const adminKey = newAdminKey();
    const expiresAt = new Date(Date.now() + input.expiryDays * DAY_MS);
    let test;
    for (let attempt = 0; ; attempt += 1) {
      try {
        test = await transaction(db, async (tx) => {
          await lockCreation(db, tx);
          await enforceCreateQuota(db, config.limits, ipHash, tx);
          return db.Test.create({
            publicId: newPublicId(),
            adminKeyHash: hashAdminKey(adminKey),
            title: input.title,
            description: input.description,
            questions: input.questions,
            settings: input.settings,
            creatorIpHash: ipHash,
            expiresAt,
          }, { transaction: tx });
        });
        break;
      } catch (error) {
        if (error?.name === 'SequelizeUniqueConstraintError' && attempt < 3) continue; // id collision: retry
        throw error;
      }
    }

    res.status(201).json({ publicId: test.publicId, adminKey, expiresAt: test.expiresAt });
  });

  // Public information shown before starting (cached briefly at the CDN) ------
  router.get('/:publicId', async (req, res) => {
    const test = await findTest(req.params.publicId);
    res.set('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
    res.json(publicTestMeta(test, config.limits));
  });

  // Start: returns the questions (without answers) and a signed attempt token ---
  router.post('/:publicId/start', async (req, res) => {
    const test = await findTest(req.params.publicId);
    const status = testStatus(test, config.limits);
    if (status !== 'open') throw new HttpError(403, STATUS_MESSAGES[status], status);

    const seed = newSeed();
    const startedAt = Date.now();
    const token = signAttemptToken(config.appSecret, {
      t: test.publicId,
      s: startedAt,
      n: newAttemptNonce(),
      r: seed,
      v: attemptVersion(config.appSecret, test),
    });
    const { questions } = prepareAttempt(test, seed);
    res.json({
      token,
      startedAt,
      title: test.title,
      settings: takerSettings(test.settings),
      questions,
    });
  });

  // Submit: grades on the server and returns the result immediately -----------
  router.post('/:publicId/submit', async (req, res) => {
    const input = parseOrThrow(submitSchema, req.body ?? {});
    const token = verifyAttemptToken(config.appSecret, input.token);
    if (!token || token.t !== req.params.publicId) {
      throw new HttpError(400, 'This attempt is not valid. Please reload the test and start again.', 'bad_token');
    }

    const outcome = await transaction(db, async (tx) => {
      // This lock also coordinates answer-key edits, deletions and quota checks.
      const test = await findTest(req.params.publicId, tx);
      const existing = await db.Attempt.findOne({ where: { nonce: token.n }, transaction: tx });
      if (existing) {
        if (existing.testId !== test.id) throw new HttpError(400, 'This attempt is not valid.', 'bad_token');
        return { result: attemptResult(test, existing), duplicate: true };
      }
      if (token.v !== attemptVersion(config.appSecret, test)) {
        throw new HttpError(409, 'The creator changed the questions or test rules after you started. Please start a fresh attempt.', 'test_changed');
      }
      const settings = test.settings;
      const elapsedSeconds = Math.max(0, Math.round((Date.now() - token.s) / 1000));
      const limitSeconds = settings.timeLimitMinutes ? settings.timeLimitMinutes * 60 : null;
      const maxAgeSeconds = limitSeconds ? limitSeconds + 60 * 60 : 7 * 24 * 60 * 60;
      if (elapsedSeconds > maxAgeSeconds) {
        throw new HttpError(410, 'This attempt has expired, so it can no longer be submitted.', 'attempt_expired');
      }
      if (settings.requireName !== false && !input.name) {
        throw new HttpError(400, 'Please enter your name.', 'name_required');
      }
      if (settings.extraFieldLabel && !input.extra) {
        throw new HttpError(400, `Please fill in "${settings.extraFieldLabel}".`, 'extra_required');
      }
      if (test.responseCount >= config.limits.responsesPerTest) {
        throw new HttpError(403, STATUS_MESSAGES.full, 'full');
      }
      const ipHash = hashIp(config.appSecret, clientIp(req, config));
      await enforceSubmitQuota(db, config.limits, test.id, ipHash, tx);
      const questionIds = selectQuestionIds(test.questions, settings, token.r);
      const graded = gradeAttempt(test, questionIds, input.answers);
      const overtime = limitSeconds != null && elapsedSeconds > limitSeconds + OVERTIME_GRACE_SECONDS;
      const attempt = await db.Attempt.create({
        testId: test.id,
        nonce: token.n,
        name: input.name,
        extra: input.extra,
        questionIds,
        answers: graded.answers,
        results: graded.results,
        score: graded.score,
        maxScore: graded.maxScore,
        percent: graded.percent,
        durationSeconds: elapsedSeconds,
        tabLeaves: input.tabLeaves,
        overtime,
        ipHash,
        startedAt: new Date(token.s),
      }, { transaction: tx });
      await test.update({ responseCount: test.responseCount + 1 }, { transaction: tx });
      return { result: attemptResult(test, attempt) };
    });
    res.status(outcome.duplicate ? 200 : 201).json(outcome);
  });

  return router;
}
