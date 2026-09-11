/**
 * Tests for scoreRisk(answers) — server/lib/riskScoring.ts (TRI-2)
 *
 * Written test-first, per QA's Sprint 1 role (backlog.md TRI-2 / sprint-1-plan.md
 * §5): this file is expected to FAIL with a "Cannot find module" error until
 * Backend implements server/lib/riskScoring.ts. That failure is correct and
 * expected right now — it is not a bug in this test file.
 *
 * Scoring rule (backlog.md Section 3, verbatim):
 *   IF STRANGLE=YES OR WEAPON=YES OR KILL_THREAT=YES → HIGH
 *   ELSE IF count(YES, all 8) >= 4 → HIGH
 *   ELSE → STANDARD
 *   SKIP counts as NO for scoring purposes.
 *
 * The 8 question keys, per backlog.md Section 3 (fixed order):
 *   STRANGLE, WEAPON, KILL_THREAT                (override questions)
 *   ESCALATION, SEPARATION, SEXUAL_COERCION, CONTROL, SELF_PERCEIVED_DANGER
 *                                                 (5 threshold questions)
 */

import { scoreRisk } from '../lib/riskScoring';

/**
 * A single triage answer value. `scoreRisk` only ever reads the 8 known
 * question keys (see ALL_KEYS below); the index signature on `Answers`
 * intentionally allows arbitrary extra keys, since several tests below
 * (malformed-input handling) deliberately pass unrecognized/extra keys and
 * missing keys to verify `scoreRisk` ignores/tolerates them.
 */
type AnswerValue = 'YES' | 'NO' | 'SKIP';
type Answers = Record<string, AnswerValue>;

const OVERRIDE_KEYS = ['STRANGLE', 'WEAPON', 'KILL_THREAT'] as const;
const THRESHOLD_KEYS = [
  'ESCALATION',
  'SEPARATION',
  'SEXUAL_COERCION',
  'CONTROL',
  'SELF_PERCEIVED_DANGER',
] as const;
const ALL_KEYS = [...OVERRIDE_KEYS, ...THRESHOLD_KEYS] as const;

/** Build a full 8-answer object, defaulting every key to NO unless overridden. */
function buildAnswers(overrides: Answers = {}): Answers {
  const answers: Answers = {};
  for (const key of ALL_KEYS) {
    answers[key] = 'NO';
  }
  return { ...answers, ...overrides };
}

/** Set exactly the given threshold keys to YES, all other keys (override + remaining threshold) NO. */
function withThresholdYes(yesKeys: string[]): Answers {
  const overrides: Answers = {};
  for (const key of yesKeys) {
    overrides[key] = 'YES';
  }
  return buildAnswers(overrides);
}

describe('scoreRisk — override rule (each override question independently sufficient)', () => {
  test.each(OVERRIDE_KEYS)(
    '%s=YES with all other 7 answers NO → HIGH',
    (overrideKey) => {
      const answers = buildAnswers({ [overrideKey]: 'YES' });
      expect(scoreRisk(answers)).toBe('HIGH');
    }
  );

  test('all 3 overrides YES simultaneously → HIGH', () => {
    const answers = buildAnswers({
      STRANGLE: 'YES',
      WEAPON: 'YES',
      KILL_THREAT: 'YES',
    });
    expect(scoreRisk(answers)).toBe('HIGH');
  });

  test('an override YES combined with otherwise all-NO/SKIP still resolves to HIGH (overrides win regardless of threshold count)', () => {
    const answers: Answers = {
      STRANGLE: 'YES',
      WEAPON: 'NO',
      KILL_THREAT: 'SKIP',
      ESCALATION: 'SKIP',
      SEPARATION: 'NO',
      SEXUAL_COERCION: 'SKIP',
      CONTROL: 'NO',
      SELF_PERCEIVED_DANGER: 'SKIP',
    };
    expect(scoreRisk(answers)).toBe('HIGH');
  });
});

describe('scoreRisk — all-NO baseline', () => {
  test('all 8 answers NO → STANDARD', () => {
    const answers = buildAnswers();
    expect(scoreRisk(answers)).toBe('STANDARD');
  });
});

describe('scoreRisk — 4-vs-3 threshold boundary on the 5 non-override questions', () => {
  test('exactly 4 of 5 (ESCALATION, SEPARATION, SEXUAL_COERCION, CONTROL) YES, SELF_PERCEIVED_DANGER NO, no override → HIGH', () => {
    const answers = withThresholdYes([
      'ESCALATION',
      'SEPARATION',
      'SEXUAL_COERCION',
      'CONTROL',
    ]);
    expect(scoreRisk(answers)).toBe('HIGH');
  });

  test('exactly 4 of 5 (a different combination: SEPARATION, SEXUAL_COERCION, CONTROL, SELF_PERCEIVED_DANGER) YES, ESCALATION NO, no override → HIGH', () => {
    const answers = withThresholdYes([
      'SEPARATION',
      'SEXUAL_COERCION',
      'CONTROL',
      'SELF_PERCEIVED_DANGER',
    ]);
    expect(scoreRisk(answers)).toBe('HIGH');
  });

  test('exactly 3 of 5 (ESCALATION, SEPARATION, SEXUAL_COERCION) YES, no override → STANDARD (boundary - 1)', () => {
    const answers = withThresholdYes([
      'ESCALATION',
      'SEPARATION',
      'SEXUAL_COERCION',
    ]);
    expect(scoreRisk(answers)).toBe('STANDARD');
  });
});

describe('scoreRisk — SKIP counts as NO for scoring', () => {
  test('a mix of SKIP and NO across all 8 answers (no YES anywhere) → STANDARD', () => {
    const answers: Answers = {
      STRANGLE: 'SKIP',
      WEAPON: 'NO',
      KILL_THREAT: 'SKIP',
      ESCALATION: 'NO',
      SEPARATION: 'SKIP',
      SEXUAL_COERCION: 'NO',
      CONTROL: 'SKIP',
      SELF_PERCEIVED_DANGER: 'NO',
    };
    expect(scoreRisk(answers)).toBe('STANDARD');
  });

  test.each(OVERRIDE_KEYS)(
    '%s=SKIP (not YES) with all others NO does NOT trigger HIGH on its own → STANDARD',
    (overrideKey) => {
      const answers = buildAnswers({ [overrideKey]: 'SKIP' });
      expect(scoreRisk(answers)).toBe('STANDARD');
    }
  );

  test('4 of the 5 threshold questions answered SKIP (not YES) → STANDARD, since SKIP is not YES and does not count toward the threshold', () => {
    const answers = buildAnswers({
      ESCALATION: 'SKIP',
      SEPARATION: 'SKIP',
      SEXUAL_COERCION: 'SKIP',
      CONTROL: 'SKIP',
    });
    expect(scoreRisk(answers)).toBe('STANDARD');
  });
});

describe('scoreRisk — malformed input handling', () => {
  // ASSUMPTION (not fully specified upstream, documented per QA task instructions):
  // A missing answer key is treated exactly like an explicit NO/SKIP — it is not
  // counted as YES and does not itself throw. This matches the spirit of
  // "SKIP counts as NO for scoring": an absent answer is at least as ambiguous
  // as an explicit "prefer not to say" and must never be silently treated as a
  // YES, since that could wrongly suppress a real HIGH-risk signal in reverse
  // (an override key missing must NOT accidentally read as YES) or wrongly
  // inflate the threshold count. Backend should treat this as the reference
  // defensive behavior unless told otherwise.
  test('a missing key (e.g. SELF_PERCEIVED_DANGER absent entirely) is treated as NO, not as YES, and does not throw', () => {
    const answers = buildAnswers();
    delete answers.SELF_PERCEIVED_DANGER;
    expect(() => scoreRisk(answers)).not.toThrow();
    expect(scoreRisk(answers)).toBe('STANDARD');
  });

  test('a missing key does not count toward the 4-of-5 threshold (3 explicit YES + 1 missing key stays STANDARD, not HIGH)', () => {
    const answers = withThresholdYes([
      'ESCALATION',
      'SEPARATION',
      'SEXUAL_COERCION',
    ]);
    delete answers.CONTROL; // missing, must not be silently counted as YES
    expect(scoreRisk(answers)).toBe('STANDARD');
  });

  // ASSUMPTION: an unrecognized/extra key (typo, future question, stray field)
  // is ignored for scoring purposes rather than causing a throw — scoreRisk
  // should only ever read the 8 known question keys. This keeps the function
  // forgiving of upstream shape drift (e.g. conversation.js accidentally
  // passing along a stray metadata field) without masking real scoring bugs.
  test('an unrecognized/extra key in answers is ignored and does not affect the result', () => {
    const answers = buildAnswers({ SOME_UNKNOWN_KEY: 'YES' });
    expect(scoreRisk(answers)).toBe('STANDARD');
  });

  test('an unrecognized key set to YES alongside a genuine 4-of-5 threshold case still correctly returns HIGH (extra key neither blocks nor is required)', () => {
    const answers = withThresholdYes([
      'ESCALATION',
      'SEPARATION',
      'SEXUAL_COERCION',
      'CONTROL',
    ]);
    answers.NOT_A_REAL_QUESTION = 'YES';
    expect(scoreRisk(answers)).toBe('HIGH');
  });
});
