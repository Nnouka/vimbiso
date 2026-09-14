// dashboard/seed.ts
//
// DASH-1 needs at least one real counsellor_users row to log in against —
// there's no dashboard-owned seed for that anywhere yet (DIR-1/PW-3's seeds
// under server/seeds/ are Backend-owned and cover resources/pattern_matches,
// not counsellor_users). server/__tests__/e2e/dashboard-login.spec.ts (and
// every other dashboard spec, which logs in first) explicitly documents this
// as a "FIXTURE ASSUMPTION" it does not create itself — "seeded by whatever
// fixture DASH-1's implementation ships with." This is that fixture.
//
// Idempotent: safe to run repeatedly (upserts on `username`). Run with:
//   npm run seed --prefix dashboard
// (or `tsx dashboard/seed.ts` directly). Requires DATABASE_URL to point at
// the same Postgres database the bot backend uses.

import 'dotenv/config';

import bcrypt from 'bcrypt';

import { getPool, query } from './lib/db';

const USERNAME = process.env.E2E_DEMO_USERNAME || 'demo-counsellor';
const PASSWORD = process.env.E2E_DEMO_PASSWORD || 'demo-password';

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  await query(
    `INSERT INTO counsellor_users (name, username, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    ['Demo Counsellor', USERNAME, passwordHash, 'counsellor']
  );

  console.log(`[dashboard] seeded demo counsellor login: ${USERNAME} / ${PASSWORD}`);
  await getPool().end();
}

main().catch((err) => {
  console.error('[dashboard] seed failed:', err);
  process.exitCode = 1;
});
