// server/migrations/run.js
//
// Backend-owned (INF-2). Small, dependency-free migration runner: applies
// every server/migrations/*.sql file in filename order, tracking what's
// already been applied in a `schema_migrations` table, so `npm run migrate`
// is idempotent and safe to re-run on a DB that already has some/all tables.
//
// This is deliberately not node-pg-migrate/Prisma (backlog.md's suggested
// technical note) — per sprint-1-plan.md's explicit call-out, "a small Node
// runner is fine — you don't need a heavy migration framework for a 10-day
// sprint." Each numbered .sql file is one migration; add new ones as
// `0NN_description.sql` and they'll be picked up automatically, in order.
//
// Usable two ways:
//   1. CLI: `npm run migrate` (=> `node server/migrations/run.js`) — opens
//      its own short-lived pg Pool, runs, and exits.
//   2. Programmatically: `const { runMigrations } = require('./run');
//      await runMigrations(pool);` — e.g. server/index.js calls this with
//      the app's shared pool (server/lib/db.js) on dev boot, so it doesn't
//      open a second pool for migrations alone.

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = __dirname;

/**
 * Runs every not-yet-applied .sql file in this directory, in filename order.
 * Each migration runs inside its own transaction; a failure rolls back that
 * one migration and stops (later files are not attempted).
 *
 * @param {import('pg').Pool} [pool] - an existing pg Pool to reuse. If
 *   omitted, a new one is created from DATABASE_URL and closed when done
 *   (the CLI entry point below does this).
 */
async function runMigrations(pool) {
  const ownsPool = !pool;
  const client =
    pool ||
    // eslint-disable-next-line global-require
    new (require('pg').Pool)({ connectionString: process.env.DATABASE_URL });

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const { rows: appliedRows } = await client.query('SELECT filename FROM schema_migrations');
    const applied = new Set(appliedRows.map((r) => r.filename));

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`[migrate] applying ${file}...`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`[migrate] ${file} failed, rolled back: ${err.message}`);
      }
    }

    console.log('[migrate] done — schema up to date.');
  } finally {
    if (ownsPool) {
      await client.end();
    }
  }
}

if (require.main === module) {
  // CLI entry point: `npm run migrate`.
  // eslint-disable-next-line global-require
  require('dotenv').config();
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runMigrations };
