// server/lib/riskScoring.js
//
// Backend-owned (TRI-2). Pure function, no DB access, no I/O — implements the
// exact override + threshold scoring rules from docs/backlog.md Section 3:
//
//   IF STRANGLE=YES OR WEAPON=YES OR KILL_THREAT=YES → HIGH
//   ELSE IF count(YES, all 8) >= 4 → HIGH
//   ELSE → STANDARD
//   SKIP counts as NO for scoring purposes.
//
// Defensive behavior (per server/__tests__/riskScoring.test.js's documented
// assumptions, treated as the reference spec since QA's tests are the source
// of truth for this file):
//   - A missing answer key is treated as NO (never as YES), and never throws.
//   - An unrecognized/extra key is ignored entirely.

const OVERRIDE_KEYS = ['STRANGLE', 'WEAPON', 'KILL_THREAT'];
const THRESHOLD_KEYS = [
  'ESCALATION',
  'SEPARATION',
  'SEXUAL_COERCION',
  'CONTROL',
  'SELF_PERCEIVED_DANGER',
];
const ALL_KEYS = [...OVERRIDE_KEYS, ...THRESHOLD_KEYS];

const HIGH_THRESHOLD = 4;

/**
 * Scores an 8-question triage answer set into 'HIGH' or 'STANDARD'.
 *
 * @param {Object<string,string>} answers - map of question_key -> 'YES'|'NO'|'SKIP'.
 *   Only the 8 known keys (ALL_KEYS) are read; any other keys are ignored.
 *   A missing key is treated exactly like 'NO'/'SKIP' (never counted as YES).
 * @returns {'HIGH'|'STANDARD'}
 */
function scoreRisk(answers) {
  const safeAnswers = answers && typeof answers === 'object' ? answers : {};
  const isYes = (key) => safeAnswers[key] === 'YES';

  if (OVERRIDE_KEYS.some(isYes)) {
    return 'HIGH';
  }

  const yesCount = ALL_KEYS.reduce((count, key) => (isYes(key) ? count + 1 : count), 0);
  if (yesCount >= HIGH_THRESHOLD) {
    return 'HIGH';
  }

  return 'STANDARD';
}

module.exports = { scoreRisk, OVERRIDE_KEYS, THRESHOLD_KEYS, ALL_KEYS };
