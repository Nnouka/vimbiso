"use strict";
// server/lib/db.ts
//
// Backend-owned. Single shared Postgres connection pool, per
// docs/sprint-1-plan.md §3.3 ("Postgres is the only place conversation/
// session state, triage answers, and risk scores live... don't cache state
// outside it"). Every other Backend file (conversation.ts, content.ts,
// migrations/run.ts when invoked from index.ts) imports getPool()/query()
// from here rather than constructing its own `pg` Pool, so the process holds
// exactly one connection pool.
//
// DATABASE_URL validation: this module intentionally does NOT throw if
// DATABASE_URL is unset (matching original behavior — `pg`'s Pool accepts an
// undefined connectionString and only fails once a query is actually
// attempted). server/index.ts validates DATABASE_URL is present at startup,
// before the app accepts traffic, so a missing DB URL fails loudly and early
// there rather than being silently tolerated here.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPool = getPool;
exports.query = query;
const pg_1 = require("pg");
let pool = null;
function getPool() {
    if (!pool) {
        pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
    }
    return pool;
}
function query(text, params) {
    return getPool().query(text, params);
}
//# sourceMappingURL=db.js.map