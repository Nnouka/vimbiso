"use strict";
// server/lib/patternMatch.ts
//
// Backend-owned (PW-2). Implements the frozen contract in
// docs/sprint-2-plan.md §3.1:
//
//   evaluateHashMatch(hashValue, reportId, otherReportIdsWithSameHash) — a
//   pure decision function, no DB access, tested exactly (and exclusively)
//   against server/__tests__/patternMatch.test.ts (QA-authored, test-first;
//   this file does not edit that test).
//
//   recordAndCheckPattern(reportId, hashValue) — the DB-touching wrapper
//   named in §3.1's prose: runs the `perpetrator_hashes` lookup, calls
//   evaluateHashMatch, and upserts `pattern_matches` accordingly.
//
// PM-resolved ambiguities in the frozen contract (see the task brief this was
// built against — not independently re-derived here):
//   - Dedup applies to the WHOLE resulting array (any duplicate report id
//     collapses), not just a reportId collision.
//   - null/undefined/non-array `otherReportIdsWithSameHash` must not throw —
//     treated as "no other reports" (same as an empty array).
//   - If `reportId` is the ONLY entry in `otherReportIdsWithSameHash` (i.e.
//     no genuine *other* report — most likely a caller bug that failed to
//     exclude it via the `!= $2` clause), that is NOT a match.
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateHashMatch = evaluateHashMatch;
exports.recordAndCheckPattern = recordAndCheckPattern;
const db_1 = require("./db");
/**
 * Pure decision function — no DB access. See file header for the frozen
 * contract and the PM-resolved ambiguities this implements.
 *
 * Never throws: `otherReportIdsWithSameHash` is defensively treated as `[]`
 * if it isn't a real array (mirrors the defensive posture already
 * established for scoreRisk()/normalizeAndHash() elsewhere in this repo).
 */
function evaluateHashMatch(hashValue, reportId, otherReportIdsWithSameHash) {
    const rawOthers = Array.isArray(otherReportIdsWithSameHash) ? otherReportIdsWithSameHash : [];
    // Dedup the whole set, and exclude reportId itself defensively — a caller
    // that failed to apply its own `report_id != $2` clause must not turn its
    // own id into a fake "genuine other report."
    const seen = new Set();
    const genuineOthers = [];
    for (const id of rawOthers) {
        if (id === reportId)
            continue;
        if (seen.has(id))
            continue;
        seen.add(id);
        genuineOthers.push(id);
    }
    if (genuineOthers.length === 0) {
        return { isMatch: false, allReportIds: [] };
    }
    return { isMatch: true, allReportIds: [...genuineOthers, reportId] };
}
/**
 * DB-touching wrapper (not pure, not part of the frozen §3.1 test contract).
 *
 *   1. SELECT report_id FROM perpetrator_hashes WHERE hash_value = $1 AND
 *      report_id != $2 (deduplicated defensively, though a well-formed table
 *      shouldn't produce duplicates here).
 *   2. Calls evaluateHashMatch() with the result.
 *   3. If it's a match: upserts `pattern_matches` — creates a new row
 *      (status='NEW') if none exists yet for this hash_value, otherwise
 *      merges reportId into the existing row's report_ids array (deduped)
 *      WITHOUT touching its status/reviewed_by/reviewed_at (an
 *      already-reviewed match must not silently flip back to looking
 *      unreviewed just because another report came in).
 *
 * Called from conversation.ts's PW-1 flow, immediately after a
 * perpetrator_hashes row is written under genuine survivor consent.
 */
async function recordAndCheckPattern(reportId, hashValue) {
    const { rows } = await (0, db_1.query)('SELECT DISTINCT report_id FROM perpetrator_hashes WHERE hash_value = $1 AND report_id != $2', [hashValue, reportId]);
    const otherReportIds = rows.map((r) => r.report_id);
    const decision = evaluateHashMatch(hashValue, reportId, otherReportIds);
    if (decision.isMatch) {
        const { rows: existingRows } = await (0, db_1.query)('SELECT id, report_ids FROM pattern_matches WHERE hash_value = $1', [hashValue]);
        const existing = existingRows[0];
        if (!existing) {
            await (0, db_1.query)(`INSERT INTO pattern_matches (hash_value, report_ids, status)
         VALUES ($1, $2, 'NEW')`, [hashValue, decision.allReportIds]);
        }
        else {
            const merged = Array.from(new Set([...existing.report_ids, ...decision.allReportIds]));
            // Deliberately does NOT touch status/reviewed_by/reviewed_at — a match
            // an institutional reviewer already marked 'REVIEWED' must stay that
            // way when a later report merely adds another report_id to the same
            // hash, per PW-2's contract.
            await (0, db_1.query)('UPDATE pattern_matches SET report_ids = $1 WHERE id = $2', [merged, existing.id]);
        }
    }
    return decision;
}
//# sourceMappingURL=patternMatch.js.map