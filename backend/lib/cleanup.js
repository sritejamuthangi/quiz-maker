import { Op } from 'sequelize';
import { transaction } from './transactions.js';

/** Deletes up to `limit` expired tests and their responses. Returns how many tests were deleted. */
export async function deleteExpiredTests(db, { limit = 200, now = new Date() } = {}) {
  return transaction(db, async (tx) => {
    const expired = await db.Test.findAll({
      where: { expiresAt: { [Op.lte]: now } },
      attributes: ['id'],
      limit,
      raw: true,
      transaction: tx,
    });
    if (expired.length === 0) return 0;
    // Recheck expiry at delete time: an owner may have extended it meanwhile.
    // Foreign-key CASCADE deletes responses atomically with their parent test.
    return db.Test.destroy({
      where: { id: expired.map((t) => t.id), expiresAt: { [Op.lte]: now } },
      transaction: tx,
    });
  });
}

/** Keeps deleting in batches until done or the time budget runs out. */
export async function deleteAllExpiredTests(db, { budgetMs = 20_000 } = {}) {
  const started = Date.now();
  let total = 0;
  while (Date.now() - started < budgetMs) {
    const deleted = await deleteExpiredTests(db, { limit: 200 });
    total += deleted;
    if (deleted < 200) break;
  }
  return total;
}
