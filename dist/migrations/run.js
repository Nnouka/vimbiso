"use strict";
// server/migrations/run.ts
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
//   1. CLI: `npm run migrate` (=> `tsx server/migrations/run.ts`) — opens
//      its own short-lived pg Pool, runs, and exits.
//   2. Programmatically: `import { runMigrations } from './run';
//      await runMigrations(pool);` — e.g. server/index.ts calls this with
//      the app's shared pool (server/lib/db.ts) on dev boot, so it doesn't
//      open a second pool for migrations alone.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const pg_1 = require("pg");
const MIGRATIONS_DIR = __dirname;
/**
 * Runs every not-yet-applied .sql file in this directory, in filename order.
 * Each migration runs inside its own transaction; a failure rolls back that
 * one migration and stops (later files are not attempted).
 *
 * @param pool - an existing pg Pool to reuse. If omitted, a new one is
 *   created from DATABASE_URL and closed when done (the CLI entry point
 *   below does this).
 */
async function runMigrations(pool) {
    const ownsPool = !pool;
    const client = pool || new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
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
            }
            catch (err) {
                await client.query('ROLLBACK');
                const message = err instanceof Error ? err.message : String(err);
                throw new Error(`[migrate] ${file} failed, rolled back: ${message}`);
            }
        }
        console.log('[migrate] done — schema up to date.');
    }
    finally {
        if (ownsPool) {
            await client.end();
        }
    }
}
if (require.main === module) {
    // CLI entry point: `npm run migrate`.
    dotenv_1.default.config();
    runMigrations()
        .then(() => process.exit(0))
        .catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
//# sourceMappingURL=run.js.map