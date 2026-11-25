// Postgres row locks coordinate requests across serverless instances. SQLite is
// only used by a single local process and needs a queue for its shared connection.
const queues = new WeakMap();

export function transaction(db, work) {
  const run = () => db.sequelize.transaction(work);
  if (db.sequelize.getDialect() !== 'sqlite') return run();
  const pending = (queues.get(db) ?? Promise.resolve()).then(run);
  queues.set(db, pending.catch(() => {}));
  return pending;
}

/** Serialize creation quota checks and inserts across Postgres instances. */
export async function lockCreation(db, tx) {
  if (db.sequelize.getDialect() === 'postgres') {
    await db.sequelize.query('SELECT pg_advisory_xact_lock(1874563201)', { transaction: tx });
  }
}
