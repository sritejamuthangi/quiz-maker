import { Sequelize } from 'sequelize';
import pg from 'pg';
import { defineModels } from './models.js';

/**
 * Production: Postgres (Neon) from DATABASE_URL.
 * Local development and tests: a SQLite file (or ":memory:"), so no database setup is needed.
 */
export function createDatabase(config) {
  let sequelize;

  if (config.databaseUrl) {
    const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//.test(config.databaseUrl);
    sequelize = new Sequelize(config.databaseUrl, {
      dialect: 'postgres',
      // Passing the driver explicitly makes sure Vercel bundles it.
      dialectModule: pg,
      logging: false,
      // Skips two SET statements on every new connection (faster cold starts, pooler-friendly).
      keepDefaultTimezone: true,
      dialectOptions: {
        ssl: isLocal ? false : { rejectUnauthorized: true },
        clientMinMessages: 'ignore',
        application_name: 'quiz-maker',
        connectionTimeoutMillis: 10_000,
        statement_timeout: 15_000,
        keepAlive: true,
      },
      pool: { max: 3, min: 0, idle: 10_000, acquire: 20_000, evict: 10_000 },
    });
  } else {
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: config.sqliteStorage,
      logging: false,
    });
  }

  return { sequelize, ...defineModels(sequelize) };
}
