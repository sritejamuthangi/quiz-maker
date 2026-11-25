import { Router } from 'express';
import { testSchema, updateTestSchema } from '../../shared/schema.js';
import { answerKeyChanges, buildReview } from '../../shared/grading.js';
import { computeStats } from '../../shared/stats.js';
import { HttpError, parseOrThrow } from '../lib/http.js';
import { PUBLIC_ID_RE, adminKeyMatches, bearerToken } from '../lib/security.js';
import { managedTest, responseSummary, testStatus } from '../lib/views.js';
import { transaction } from '../lib/transactions.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const PRIVATE_FIELDS = ['ipHash', 'nonce'];

/** Everything here requires the private admin key: Authorization: Bearer <key>. */
export function manageRoutes({ config, db }) {
  const router = Router();

  async function authorize(req, tx) {
    const key = bearerToken(req);
    const { publicId } = req.params;
    const test = PUBLIC_ID_RE.test(publicId)
      ? await db.Test.findOne({ where: { publicId }, transaction: tx, lock: tx.LOCK.UPDATE })
      : null;
    // Same response whether the test is missing or the key is wrong.
    if (!adminKeyMatches(key, test?.adminKeyHash) || !test) {
      throw new HttpError(
        401,
        'This results link is not valid. Make sure you copied the whole link, including the part after "#".',
        'bad_key',
      );
    }
    return test;
  }

  async function findResponse(test, rawId, tx) {
    const id = Number(rawId);
    const attempt = Number.isSafeInteger(id) ? await db.Attempt.findOne({ where: { id, testId: test.id }, transaction: tx }) : null;
    if (!attempt) throw new HttpError(404, 'This response no longer exists.', 'not_found');
    return attempt;
  }

  const etagOf = (test) => `W/"${new Date(test.updatedAt).getTime()}-${test.responseCount}-${testStatus(test, config.limits)}"`;

  const withTest = (req, work) => transaction(db, async (tx) => work(await authorize(req, tx), tx));

  // Dashboard: test, stats and the response list. Supports If-None-Match for cheap polling.
  router.get('/:publicId', async (req, res) => {
    const { tag, body } = await withTest(req, async (test, tx) => {
      const tag = etagOf(test);
      if (req.get('if-none-match') === tag) return { tag };
      const attempts = await db.Attempt.findAll({
        where: { testId: test.id },
        attributes: { exclude: PRIVATE_FIELDS },
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
        transaction: tx,
      });
      return { tag, body: {
        test: managedTest(test, config.limits),
        stats: computeStats(test, attempts),
        responses: attempts.map((a) => responseSummary(a, test.settings.passPercent)),
      } };
    });
    res.set('ETag', tag);
    if (!body) return res.status(304).end();
    res.json(body);
  });

  // Edit the test, open/close it, or extend how long it is kept.
  router.patch('/:publicId', async (req, res) => {
    const input = parseOrThrow(updateTestSchema, req.body ?? {});
    const updated = await withTest(req, async (test, tx) => {
    const changes = {};

    const contentChange =
      input.title !== undefined ||
      input.description !== undefined ||
      input.settings !== undefined ||
      input.questions !== undefined;

    if (contentChange) {
      const merged = parseOrThrow(testSchema, {
        title: input.title ?? test.title,
        description: input.description ?? test.description,
        settings: { ...test.settings, ...(input.settings ?? {}) },
        questions: input.questions ?? test.questions,
      });
      if (input.questions !== undefined && test.responseCount > 0) {
        const problems = answerKeyChanges(test.questions, merged.questions);
        if (problems.length > 0) {
          throw new HttpError(409, problems[0], 'locked', {
            issues: problems.map((message) => ({ path: 'questions', message })),
          });
        }
      }
      Object.assign(changes, merged);
    }
    if (input.isOpen !== undefined) changes.isOpen = input.isOpen;
    if (input.extendDays !== undefined) changes.expiresAt = new Date(Date.now() + input.extendDays * DAY_MS);
    if (Object.keys(changes).length === 0) throw new HttpError(400, 'Nothing to update.', 'empty_update');

    await test.update(changes, { transaction: tx });
    return managedTest(test, config.limits);
    });
    res.json({ test: updated });
  });

  // One person's full answer sheet.
  router.get('/:publicId/responses/:responseId', async (req, res) => {
    const body = await withTest(req, async (test, tx) => {
      const attempt = await findResponse(test, req.params.responseId, tx);
      return {
        response: { ...responseSummary(attempt, test.settings.passPercent), questionIds: attempt.questionIds },
        review: buildReview(test, attempt.questionIds, attempt.answers, attempt.results, 'full'),
      };
    });
    res.json(body);
  });

  router.delete('/:publicId/responses/:responseId', async (req, res) => {
    await withTest(req, async (test, tx) => {
      const attempt = await findResponse(test, req.params.responseId, tx);
      await attempt.destroy({ transaction: tx });
      await test.update({ responseCount: Math.max(0, test.responseCount - 1) }, { transaction: tx });
    });
    res.json({ ok: true });
  });

  // Everything needed to build the Excel file in the browser.
  router.get('/:publicId/export', async (req, res) => {
    const body = await withTest(req, async (test, tx) => {
    const attempts = await db.Attempt.findAll({
      where: { testId: test.id },
      attributes: { exclude: PRIVATE_FIELDS },
      transaction: tx,
      order: [
        ['createdAt', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    return {
      test: managedTest(test, config.limits),
      stats: computeStats(test, attempts),
      responses: attempts.map((a) => ({
        ...responseSummary(a, test.settings.passPercent),
        questionIds: a.questionIds,
        answers: a.answers,
        results: a.results,
      })),
    };
    });
    res.json(body);
  });

  router.delete('/:publicId', async (req, res) => {
    await withTest(req, (test, tx) => test.destroy({ transaction: tx }));
    res.json({ ok: true });
  });

  return router;
}
