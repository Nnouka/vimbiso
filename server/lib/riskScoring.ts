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

/** One triage question's answer. A missing key is treated identically to SKIP/NO. */
export type Answer = 'YES' | 'NO' | 'SKIP';

/**
 * The 8-question triage answer set. Every field is optional because a
 * missing key is valid input (treated as NO for scoring) rather than an
 * error — see server/__tests__/riskScoring.test.ts's "malformed input
 * handling" cases.
 */
export interface TriageAnswers {
  STRANGLE?: Answer;
  WEAPON?: Answer;
  KILL_THREAT?: Answer;
  ESCALATION?: Answer;
  SEPARATION?: Answer;
  SEXUAL_COERCION?: Answer;
  CONTROL?: Answer;
  SELF_PERCEIVED_DANGER?: Answer;
}

export type RiskLevel = 'HIGH' | 'STANDARD';

export const OVERRIDE_KEYS: (keyof TriageAnswers)[] = ['STRANGLE', 'WEAPON', 'KILL_THREAT'];
export const THRESHOLD_KEYS: (keyof TriageAnswers)[] = [
  'ESCALATION',
  'SEPARATION',
  'SEXUAL_COERCION',
  'CONTROL',
  'SELF_PERCEIVED_DANGER',
];
export const ALL_KEYS: (keyof TriageAnswers)[] = [...OVERRIDE_KEYS, ...THRESHOLD_KEYS];

const HIGH_THRESHOLD = 4;

/**
 * Scores an 8-question triage answer set into 'HIGH' or 'STANDARD'.
 *
 * Only the 8 known keys (ALL_KEYS) are read; any other keys present on
 * `answers` are ignored. A missing key is treated exactly like 'NO'/'SKIP'
 * (never counted as YES).
 */
export function scoreRisk(answers: TriageAnswers): RiskLevel {
  const safeAnswers: TriageAnswers = answers && typeof answers === 'object' ? answers : {};
  const isYes = (key: keyof TriageAnswers): boolean => safeAnswers[key] === 'YES';

  if (OVERRIDE_KEYS.some(isYes)) {
    return 'HIGH';
  }

  const yesCount = ALL_KEYS.reduce((count, key) => (isYes(key) ? count + 1 : count), 0);
  if (yesCount >= HIGH_THRESHOLD) {
    return 'HIGH';
  }

  return 'STANDARD';
}
