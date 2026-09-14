// dashboard/lib/db.ts
//
// Standalone Postgres connection pool for the dashboard process (DASH-1..4,
// Sprint 2). The dashboard is a SEPARATE Express+EJS app — its own
// package.json, its own tsconfig, its own running process — from the root
// WhatsApp bot backend under server/**, so it cannot import
// server/lib/db.ts directly (that file lives outside this package's
// compiled output / rootDir, and Sprint 2's ownership map keeps
// dashboard/** and server/** as separate owned trees — see
// docs/sprint-2-plan.md §2).
//
// This mirrors server/lib/db.ts's lazy-pool pattern exactly and reads the
// SAME `DATABASE_URL` env var, against the SAME physical Postgres database
// as the bot backend. Two connection pools (two processes) against one
// database is intentional per the architecture — the dashboard only ever
// reads/updates rows the bot backend already wrote — not an accidental
// duplication of server/lib/db.ts.

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
