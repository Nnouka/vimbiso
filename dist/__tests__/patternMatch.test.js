"use strict";
/**
 * Tests for evaluateHashMatch(hashValue, reportId, otherReportIdsWithSameHash) —
 * server/lib/patternMatch.ts (PW-2)
 *
 * Written test-first, per QA's Sprint 2 role (backlog.md PW-2 / sprint-2-plan.md
 * §2 Ownership Map / §5 Wave 1): this file is expected to FAIL with a "Cannot
 * find module" error until Backend implements server/lib/patternMatch.ts. That
 * failure is correct and expected right now — it is not a bug in this test file.
 *
 * Contract under test (sprint-2-plan.md §3.1, FROZEN — do not invent a
 * different function shape):
 *
 *   export interface MatchDecision {
 *     isMatch: boolean;           // true if hashValue matches a hash from >=1 other report
 *     allReportIds: number[];     // deduped [...otherReportIds, reportId] if isMatch; [] otherwise
 *   }
 *
 *   export function evaluateHashMatch(
 *     hashValue: string,
 *     reportId: number,
 *     otherReportIdsWithSameHash: number[],
 *   ): MatchDecision
 *
 * `evaluateHashMatch` is a pure decision function — no DB access. Backend's
 * caller is responsible for the `SELECT report_id FROM perpetrator_hashes
 * WHERE hash_value = $1 AND report_id != $2` query that produces
 * `otherReportIdsWithSameHash`; this file tests only the decision logic, not
 * that query.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const patternMatch_1 = require("../lib/patternMatch");
const SAMPLE_HASH = 'a3f9c1d2b4e5f60718293a4b5c6d7e8f9012a3b4c5d6e7f8091a2b3c4d5e6f70';
describe('evaluateHashMatch — no match', () => {
    test('no other reports share this hash → isMatch: false, allReportIds: []', () => {
        const result = (0, patternMatch_1.evaluateHashMatch)(SAMPLE_HASH, 101, []);
        expect(result.isMatch).toBe(false);
        expect(result.allReportIds).toEqual([]);
    });
});
describe('evaluateHashMatch — single match', () => {
    test('exactly one other report shares this hash → isMatch: true, allReportIds contains both report ids', () => {
        const result = (0, patternMatch_1.evaluateHashMatch)(SAMPLE_HASH, 101, [55]);
        expect(result.isMatch).toBe(true);
        expect(result.allReportIds).toHaveLength(2);
        expect(result.allReportIds).toEqual(expect.arrayContaining([55, 101]));
    });
    test('single match preserves the documented order: [...otherReportIds, reportId]', () => {
        const result = (0, patternMatch_1.evaluateHashMatch)(SAMPLE_HASH, 101, [55]);
        expect(result.allReportIds).toEqual([55, 101]);
    });
});
describe('evaluateHashMatch — multiple matches', () => {
    test('several other reports share this hash → isMatch: true, every id present', () => {
        const result = (0, patternMatch_1.evaluateHashMatch)(SAMPLE_HASH, 101, [12, 34, 56]);
        expect(result.isMatch).toBe(true);
        expect(result.allReportIds).toEqual(expect.arrayContaining([12, 34, 56, 101]));
        expect(result.allReportIds).toHaveLength(4);
    });
    test('multiple matches preserve the documented order: otherReportIds first (as given), then reportId last', () => {
        const result = (0, patternMatch_1.evaluateHashMatch)(SAMPLE_HASH, 101, [12, 34, 56]);
        expect(result.allReportIds).toEqual([12, 34, 56, 101]);
    });
});
describe('evaluateHashMatch — deduplication', () => {
    // ASSUMPTION (documented per QA task instructions): the interface's own
    // comment — "deduped [...otherReportIds, reportId]" — is read here as
    // applying dedup to the whole resulting array, not only to a reportId
    // collision. A caller bug (e.g. the same report_id row read twice off
    // perpetrator_hashes) should not surface as a visibly duplicated id in the
    // dashboard's Pattern Watch tab.
    test('duplicate entries within otherReportIdsWithSameHash are deduped in the output', () => {
        const result = (0, patternMatch_1.evaluateHashMatch)(SAMPLE_HASH, 101, [55, 55, 55]);
        expect(result.isMatch).toBe(true);
        expect(result.allReportIds).toEqual([55, 101]);
    });
    test('the current reportId is never duplicated in the output, even if it appears (defensively/erroneously) in otherReportIdsWithSameHash', () => {
        const result = (0, patternMatch_1.evaluateHashMatch)(SAMPLE_HASH, 101, [55, 101]);
        expect(result.isMatch).toBe(true);
        // 101 must appear exactly once, not twice.
        const occurrences = result.allReportIds.filter((id) => id === 101).length;
        expect(occurrences).toBe(1);
        expect(result.allReportIds).toEqual(expect.arrayContaining([55, 101]));
        expect(result.allReportIds).toHaveLength(2);
    });
    test('reportId as the ONLY entry in otherReportIdsWithSameHash (no genuine other report) does not count as a match', () => {
        // If the only "other" id supplied is actually the current report's own
        // id (e.g. a caller bug that failed to exclude it via the `!= $2`
        // clause), there is no genuine *other* report — this must not be
        // reported as a match.
        const result = (0, patternMatch_1.evaluateHashMatch)(SAMPLE_HASH, 101, [101]);
        expect(result.isMatch).toBe(false);
        expect(result.allReportIds).toEqual([]);
    });
});
describe('evaluateHashMatch — empty/malformed input handling', () => {
    test('empty otherReportIdsWithSameHash array (explicit, not omitted) → isMatch: false, allReportIds: []', () => {
        const result = (0, patternMatch_1.evaluateHashMatch)(SAMPLE_HASH, 101, []);
        expect(() => (0, patternMatch_1.evaluateHashMatch)(SAMPLE_HASH, 101, [])).not.toThrow();
        expect(result.isMatch).toBe(false);
        expect(result.allReportIds).toEqual([]);
    });
    // ASSUMPTION (not fully specified upstream, documented per QA task
    // instructions): evaluateHashMatch is a pure, defensive decision function
    // and must never throw on malformed input — a bad upstream DB read should
    // surface as "no match found" rather than crashing the conversation/PW-2
    // wiring that calls it. This mirrors the defensive-input posture already
    // established for scoreRisk() (riskScoring.test.ts) and normalizeAndHash()
    // (hashing.test.ts) in this repo. Backend should treat this as the
    // reference defensive behavior unless told otherwise.
    test('null passed instead of an array does not throw, and resolves to no match', () => {
        // @ts-expect-error — deliberately exercising evaluateHashMatch's runtime
        // guard against a non-array value for otherReportIdsWithSameHash.
        expect(() => (0, patternMatch_1.evaluateHashMatch)(SAMPLE_HASH, 101, null)).not.toThrow();
        // @ts-expect-error — see above.
        const result = (0, patternMatch_1.evaluateHashMatch)(SAMPLE_HASH, 101, null);
        expect(result.isMatch).toBe(false);
        expect(result.allReportIds).toEqual([]);
    });
    test('undefined passed instead of an array does not throw, and resolves to no match', () => {
        // @ts-expect-error — deliberately exercising evaluateHashMatch's runtime
        // guard against a missing/undefined otherReportIdsWithSameHash.
        expect(() => (0, patternMatch_1.evaluateHashMatch)(SAMPLE_HASH, 101, undefined)).not.toThrow();
        // @ts-expect-error — see above.
        const result = (0, patternMatch_1.evaluateHashMatch)(SAMPLE_HASH, 101, undefined);
        expect(result.isMatch).toBe(false);
        expect(result.allReportIds).toEqual([]);
    });
    test('an empty-string hashValue does not affect the decision logic and does not throw (hashValue is not otherwise validated by this pure function)', () => {
        expect(() => (0, patternMatch_1.evaluateHashMatch)('', 101, [55])).not.toThrow();
        const result = (0, patternMatch_1.evaluateHashMatch)('', 101, [55]);
        expect(result.isMatch).toBe(true);
        expect(result.allReportIds).toEqual([55, 101]);
    });
    test('a large number of genuinely distinct matching reports all appear in allReportIds, deduped, with reportId present exactly once', () => {
        const others = Array.from({ length: 25 }, (_, i) => i + 1); // [1..25]
        const result = (0, patternMatch_1.evaluateHashMatch)(SAMPLE_HASH, 999, others);
        expect(result.isMatch).toBe(true);
        expect(result.allReportIds).toHaveLength(26);
        expect(new Set(result.allReportIds).size).toBe(26);
        expect(result.allReportIds).toEqual(expect.arrayContaining([...others, 999]));
    });
});
//# sourceMappingURL=patternMatch.test.js.map