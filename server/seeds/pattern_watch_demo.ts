// server/seeds/pattern_watch_demo.ts
//
// Backend-owned (PW-3). Seeds 2-3 CLEARLY FAKE, clearly test-labeled reports
// and perpetrator_hashes rows that deliberately share a hash, so the
// dashboard's Pattern Watch tab (DASH-3) has a real, visible match to show
// for the demo — per backlog.md PW-3's AC/DoD.
//
// Everything in this file is fake, obviously so, both in the data itself
// (the identifier literally says "DO-NOT-USE") and in comments — this exists
// purely for demo credibility, not as a real report. Confirmed here as
// required by PW-3's own DoD: "zero real/plausible-real perpetrator data."
//
// Uses the SAME code path as a real PW-1 consent flow would
// (normalizeAndHash + recordAndCheckPattern), rather than hand-writing rows
// that skip that logic, so this also doubles as a live smoke test of PW-1/
// PW-2's actual implementation, not just of the dashboard's rendering.
//
// Run with: `npm run seed` (=> `tsx server/seeds/run_all.ts`), or standalone:
// `tsx server/seeds/pattern_watch_demo.ts`.

import dotenv from 'dotenv';
import { getPool, query } from '../lib/db';
import { normalizeAndHash } from '../lib/hashing';
import { recordAndCheckPattern } from '../lib/patternMatch';

// Obviously-fake identifier text — chosen so nobody could mistake this for a
// real survivor's report. Never presented as real anywhere in the app; only
// its hash is ever stored (same guarantee as a real PW-1 consent flow —
// SEC-1's normalizeAndHash never leaves the raw string reachable downstream).
const FAKE_IDENTIFIER_TEXT = 'TEST-DEMO-PERPETRATOR-DO-NOT-USE';

// A fake, obviously-not-real WhatsApp number per demo report — distinct
// numbers so these look like independent survivors reporting the same
// person, which is exactly the scenario PW-2 exists to surface.
const FAKE_REPORTS = [
  { whatsapp_number: 'whatsapp:+10000000001', language: 'en', risk_level: 'STANDARD' as const },
  { whatsapp_number: 'whatsapp:+10000000002', language: 'en', risk_level: 'HIGH' as const },
  { whatsapp_number: 'whatsapp:+10000000003', language: 'sw', risk_level: 'STANDARD' as const },
];

export async function seedPatternWatchDemo(): Promise<void> {
  const pool = getPool();
  const hashValue = normalizeAndHash(FAKE_IDENTIFIER_TEXT);
  const reportIds: number[] = [];

  for (const fake of FAKE_REPORTS) {
    // Idempotent: re-running this seed should not pile up duplicate fake
    // reports — key on whatsapp_number, which is unique to this fake set.
    const { rows: existing } = await pool.query<{ id: number }>(
      `SELECT id FROM reports WHERE whatsapp_number = $1 AND channel = 'demo-seed'`,
      [fake.whatsapp_number]
    );

    let reportId: number;
    if (existing.length > 0) {
      reportId = existing[0].id;
      await query(
        `UPDATE reports SET risk_level = $1, status = 'SCORED', perpetrator_consent_given = true WHERE id = $2`,
        [fake.risk_level, reportId]
      );
    } else {
      const { rows } = await query<{ id: number }>(
        `INSERT INTO reports (channel, language, risk_level, status, whatsapp_number, perpetrator_consent_given)
         VALUES ('demo-seed', $1, $2, 'SCORED', $3, true)
         RETURNING id`,
        [fake.language, fake.risk_level, fake.whatsapp_number]
      );
      reportId = rows[0].id;
    }
    reportIds.push(reportId);

    // Only write a perpetrator_hashes row if one doesn't already exist for
    // this fake report (idempotent re-run) — mirrors PW-1's real "exactly
    // one perpetrator_hashes row per consenting report" guarantee.
    const { rows: existingHash } = await pool.query<{ id: number }>(
      'SELECT id FROM perpetrator_hashes WHERE report_id = $1',
      [reportId]
    );
    if (existingHash.length === 0) {
      await query(
        `INSERT INTO perpetrator_hashes (report_id, hash_value, algorithm) VALUES ($1, $2, 'HMAC-SHA256')`,
        [reportId, hashValue]
      );
    }
  }

  // Runs the SAME matching logic PW-1's live flow calls (recordAndCheckPattern),
  // once per fake report, exactly as a real sequence of consenting survivors
  // would trigger it — this is what actually produces the visible
  // pattern_matches row DASH-3 reads, not a hand-inserted row.
  let lastDecision;
  for (const reportId of reportIds) {
    lastDecision = await recordAndCheckPattern(reportId, hashValue);
  }

  console.log(
    `[seed] pattern_watch_demo: ${FAKE_REPORTS.length} obviously-fake demo reports ` +
      `(report_ids ${reportIds.join(', ')}) sharing hash "${hashValue.slice(0, 12)}..." ` +
      `of the literal fake string "${FAKE_IDENTIFIER_TEXT}". Final match decision: ` +
      `isMatch=${lastDecision?.isMatch}, allReportIds=[${lastDecision?.allReportIds.join(', ')}].`
  );
}

if (require.main === module) {
  dotenv.config();
  seedPatternWatchDemo()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] pattern_watch_demo failed:', err);
      process.exit(1);
    });
}
