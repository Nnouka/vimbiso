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

import { Pool, QueryResult, QueryResultRow } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}
