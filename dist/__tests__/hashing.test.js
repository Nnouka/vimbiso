"use strict";
/**
 * Tests for normalizeAndHash(text) — server/lib/hashing.ts (SEC-1)
 *
 * Written test-first, per QA's Sprint 1 role (backlog.md SEC-1 / sprint-1-plan.md
 * §5): this file is expected to FAIL with a "Cannot find module" error until
 * Backend implements server/lib/hashing.ts. That failure is correct and expected
 * right now — it is not a bug in this test file.
 *
 * Per backlog.md SEC-1 technical notes / AC:
 *   - Node `crypto` module, HMAC-SHA256, secret from env var PERPETRATOR_HASH_SECRET.
 *   - Normalization = lowercase, trim, collapse internal whitespace, strip punctuation.
 *   - Same identifier under different casing/spacing/punctuation → identical hash.
 *   - Deterministic across repeated calls.
 *   - The raw text must never be recoverable from / equal to the output.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
// SEC-1 requires the secret to come from PERPETRATOR_HASH_SECRET. Set a fixed
// test value before requiring the module, so hashing.ts reads a real secret
// in this test environment regardless of what's in the developer's shell.
process.env.PERPETRATOR_HASH_SECRET =
    process.env.PERPETRATOR_HASH_SECRET || 'test-secret-do-not-use-in-prod';
const hashing_1 = require("../lib/hashing");
// HMAC-SHA256 hex digest is always 64 hex characters.
const HEX_64_RE = /^[0-9a-f]{64}$/;
describe('normalizeAndHash — normalization equivalence', () => {
    test('different casing produces the same hash ("John Mwangi" vs "john mwangi")', () => {
        expect((0, hashing_1.normalizeAndHash)('John Mwangi')).toBe((0, hashing_1.normalizeAndHash)('john mwangi'));
    });
    test('different spacing (leading/trailing/collapsed internal) produces the same hash', () => {
        expect((0, hashing_1.normalizeAndHash)('John Mwangi')).toBe((0, hashing_1.normalizeAndHash)('  john   mwangi  '));
    });
    test('different punctuation produces the same hash ("John Mwangi" vs "John, Mwangi!")', () => {
        expect((0, hashing_1.normalizeAndHash)('John Mwangi')).toBe((0, hashing_1.normalizeAndHash)('John, Mwangi!'));
    });
    test('all three variations together normalize to the same hash as the canonical form', () => {
        const canonical = (0, hashing_1.normalizeAndHash)('John Mwangi');
        expect((0, hashing_1.normalizeAndHash)('  JOHN,   MWANGI!!  ')).toBe(canonical);
    });
});
describe('normalizeAndHash — distinctness', () => {
    test('two genuinely different identifiers produce different hashes', () => {
        expect((0, hashing_1.normalizeAndHash)('John Mwangi')).not.toBe((0, hashing_1.normalizeAndHash)('Peter Otieno'));
    });
    test('near-miss identifiers (different person, similar spelling) still hash differently', () => {
        expect((0, hashing_1.normalizeAndHash)('John Mwangi')).not.toBe((0, hashing_1.normalizeAndHash)('John Mwang'));
    });
});
describe('normalizeAndHash — determinism', () => {
    test('the same input produces the same hash across repeated calls', () => {
        const first = (0, hashing_1.normalizeAndHash)('John Mwangi');
        const second = (0, hashing_1.normalizeAndHash)('John Mwangi');
        const third = (0, hashing_1.normalizeAndHash)('John Mwangi');
        expect(first).toBe(second);
        expect(second).toBe(third);
    });
});
describe('normalizeAndHash — output shape / non-reversibility', () => {
    test('output is a fixed-length hex string consistent with an HMAC-SHA256 digest', () => {
        const result = (0, hashing_1.normalizeAndHash)('John Mwangi');
        expect(typeof result).toBe('string');
        expect(result).toMatch(HEX_64_RE);
    });
    test('output does not contain the original input as a substring', () => {
        const result = (0, hashing_1.normalizeAndHash)('John Mwangi');
        expect(result.toLowerCase()).not.toContain('john');
        expect(result.toLowerCase()).not.toContain('mwangi');
    });
    test('output matches an independently computed HMAC-SHA256 of the normalized string using the same secret', () => {
        const expected = crypto_1.default
            .createHmac('sha256', process.env.PERPETRATOR_HASH_SECRET)
            .update('john mwangi')
            .digest('hex');
        expect((0, hashing_1.normalizeAndHash)('John, Mwangi!')).toBe(expected);
    });
});
describe('normalizeAndHash — empty/null/undefined input handling', () => {
    // ASSUMPTION (not fully specified upstream, documented per QA task instructions):
    // normalizeAndHash throws on empty string, null, or undefined rather than
    // silently returning a hash of an empty/placeholder value. Rationale: SEC-1's
    // AC says "given no perpetrator text is supplied, no perpetrator_hashes row
    // is created" — that decision (whether to call this function at all) belongs
    // to the caller (conversation.js / PW-1's optional prompt), *before* calling
    // normalizeAndHash. The hashing utility itself should never be asked to hash
    // "nothing" and silently succeed — a thrown error makes a caller bug (calling
    // this with no real input) loud and immediate instead of quietly writing a
    // meaningless hash row into perpetrator_hashes. Backend should treat this as
    // the reference defensive behavior unless told otherwise.
    test('empty string throws', () => {
        expect(() => (0, hashing_1.normalizeAndHash)('')).toThrow();
    });
    test('whitespace-only string (normalizes to empty) throws', () => {
        expect(() => (0, hashing_1.normalizeAndHash)('   ')).toThrow();
    });
    test('null throws', () => {
        // @ts-expect-error — deliberately exercising normalizeAndHash's runtime
        // guard against non-string input; the JS original had no type system to
        // stop this call, so we assert the intent explicitly instead of loosening
        // normalizeAndHash's real (string) parameter type.
        expect(() => (0, hashing_1.normalizeAndHash)(null)).toThrow();
    });
    test('undefined throws', () => {
        // @ts-expect-error — see null case above: deliberately passing a value
        // outside the declared (string) parameter type to verify the runtime guard.
        expect(() => (0, hashing_1.normalizeAndHash)(undefined)).toThrow();
    });
});
//# sourceMappingURL=hashing.test.js.map