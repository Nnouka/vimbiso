"use strict";
// server/lib/riskScoring.ts
//
// Backend-owned (TRI-2). Pure function, no DB access, no I/O — implements the
// exact override + threshold scoring rules from docs/backlog.md Section 3:
//
//   IF STRANGLE=YES OR WEAPON=YES OR KILL_THREAT=YES → HIGH
//   ELSE IF count(YES, all 8) >= 4 → HIGH
//   ELSE → STANDARD
//   SKIP counts as NO for scoring purposes.
//
// Defensive behavior (per server/__tests__/riskScoring.test.ts's documented
// assumptions, treated as the reference spec since QA's tests are the source
// of truth for this file):
//   - A missing answer key is treated as NO (never as YES), and never throws
//     — hence every field on TriageAnswers below is optional, not required.
//   - An unrecognized/extra key is ignored entirely (enforced structurally
//     here: scoreRisk only ever reads the 8 named keys off the object).
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_KEYS = exports.THRESHOLD_KEYS = exports.OVERRIDE_KEYS = void 0;
exports.scoreRisk = scoreRisk;
exports.OVERRIDE_KEYS = ['STRANGLE', 'WEAPON', 'KILL_THREAT'];
exports.THRESHOLD_KEYS = [
    'ESCALATION',
    'SEPARATION',
    'SEXUAL_COERCION',
    'CONTROL',
    'SELF_PERCEIVED_DANGER',
];
exports.ALL_KEYS = [...exports.OVERRIDE_KEYS, ...exports.THRESHOLD_KEYS];
const HIGH_THRESHOLD = 4;
/**
 * Scores an 8-question triage answer set into 'HIGH' or 'STANDARD'.
 *
 * Only the 8 known keys (ALL_KEYS) are read; any other keys present on
 * `answers` are ignored. A missing key is treated exactly like 'NO'/'SKIP'
 * (never counted as YES).
 */
function scoreRisk(answers) {
    const safeAnswers = answers && typeof answers === 'object' ? answers : {};
    const isYes = (key) => safeAnswers[key] === 'YES';
    if (exports.OVERRIDE_KEYS.some(isYes)) {
        return 'HIGH';
    }
    const yesCount = exports.ALL_KEYS.reduce((count, key) => (isYes(key) ? count + 1 : count), 0);
    if (yesCount >= HIGH_THRESHOLD) {
        return 'HIGH';
    }
    return 'STANDARD';
}
//# sourceMappingURL=riskScoring.js.map