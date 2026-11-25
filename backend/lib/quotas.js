import { Op } from 'sequelize';
import { HttpError } from './http.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Durable limits on creating tests, counted in the database so they hold across
 * restarts and across serverless instances.
 */
export async function enforceCreateQuota(db, limits, ipHash, transaction) {
  const now = Date.now();
  const [lastHour, lastDay, siteWideToday] = await Promise.all([
    db.Test.count({ where: { creatorIpHash: ipHash, createdAt: { [Op.gt]: new Date(now - HOUR) } }, transaction }),
    db.Test.count({ where: { creatorIpHash: ipHash, createdAt: { [Op.gt]: new Date(now - DAY) } }, transaction }),
    db.Test.count({ where: { createdAt: { [Op.gt]: new Date(now - DAY) } }, transaction }),
  ]);

  if (siteWideToday >= limits.testsPerDayGlobal) {
    throw new HttpError(
      429,
      'So many tests were created today that new ones are paused for a while. Please try again later.',
      'quota_global',
      { headers: { 'Retry-After': '3600' } },
    );
  }
  if (lastHour >= limits.testsPerIpPerHour) {
    throw new HttpError(
      429,
      `You've created ${lastHour} tests in the last hour, which is the limit. Please try again a bit later.`,
      'quota_hour',
      { headers: { 'Retry-After': '900' } },
    );
  }
  if (lastDay >= limits.testsPerIpPerDay) {
    throw new HttpError(
      429,
      `You've created ${lastDay} tests today, which is the daily limit. Please try again tomorrow.`,
      'quota_day',
      { headers: { 'Retry-After': '3600' } },
    );
  }
}

/** Stops one network from flooding a single test with responses. */
export async function enforceSubmitQuota(db, limits, testId, ipHash, transaction) {
  const count = await db.Attempt.count({
    where: { testId, ipHash, createdAt: { [Op.gt]: new Date(Date.now() - HOUR) } },
    transaction,
  });
  if (count >= limits.submitsPerIpPerTestPerHour) {
    throw new HttpError(
      429,
      'Too many responses to this test came from your network in the last hour. Please try again later.',
      'quota_submit',
      { headers: { 'Retry-After': '900' } },
    );
  }
}
