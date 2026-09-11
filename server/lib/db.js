// server/lib/db.js
//
// Backend-owned. Single shared Postgres connection pool, per
// docs/sprint-1-plan.md §3.3 ("Postgres is the only place conversation/
// session state, triage answers, and risk scores live... don't cache state
// outside it"). Every other Backend file (conversation.js, content.js,
// migrations/run.js when invoked from index.js) imports getPool()/query()
// from here rather than constructing its own `pg` Pool, so the process holds
// exactly one connection pool.

const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

function query(text, params) {
  return getPool().query(text, params);
}

module.exports = { getPool, query };
