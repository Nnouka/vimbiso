// server/lib/hashing.js
//
// Backend-owned (SEC-1). Implements normalizeAndHash(text): a deterministic,
// one-way HMAC-SHA256 hash of a normalized perpetrator-identifier string, so
// that no raw perpetrator-identifying text is ever persisted anywhere in the
// database — only perpetrator_hashes.hash_value (this function's output).
//
// Per backlog.md SEC-1 technical notes:
//   - Node `crypto` module, HMAC-SHA256.
//   - Secret from env var PERPETRATOR_HASH_SECRET.
//   - Normalization = lowercase, trim, collapse internal whitespace, strip
//     punctuation.
//
// No code path in this file (or anywhere else in the repo) writes the raw
// input to any table — the only output of this module is the hash digest.

const crypto = require('crypto');

/**
 * Normalizes a raw identifier string for hashing:
 *   1. lowercase
 *   2. strip punctuation (anything that isn't a Unicode letter, digit, or
 *      whitespace — Unicode-aware so accented letters in Swahili/French
 *      names are preserved as letters, not stripped as symbols)
 *   3. collapse internal whitespace runs to a single space
 *   4. trim leading/trailing whitespace
 *
 * @param {string} text
 * @returns {string}
 */
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes and HMAC-SHA256-hashes a perpetrator identifier string.
 *
 * Throws (deliberately, per SEC-1's DoD and the reference test suite) when:
 *   - input is null/undefined
 *   - input is not a string
 *   - input normalizes to an empty string (e.g. "", "   ", or punctuation-only)
 *   - PERPETRATOR_HASH_SECRET is not configured
 *
 * The decision of WHETHER to call this function at all (i.e. "was any
 * perpetrator text supplied") belongs to the caller (conversation.js's PW-1
 * prompt, Sprint 2) — this utility never silently hashes "nothing" and
 * succeeds, so a caller bug can't quietly produce a meaningless
 * perpetrator_hashes row.
 *
 * @param {string} text - raw perpetrator identifier text
 * @returns {string} 64-character lowercase hex HMAC-SHA256 digest
 */
function normalizeAndHash(text) {
  if (text === null || text === undefined) {
    throw new Error('normalizeAndHash: text must be a non-empty string (got null/undefined).');
  }
  if (typeof text !== 'string') {
    throw new Error('normalizeAndHash: text must be a string.');
  }

  const normalized = normalize(text);
  if (normalized.length === 0) {
    throw new Error('normalizeAndHash: text normalizes to an empty string — refusing to hash "nothing".');
  }

  const secret = process.env.PERPETRATOR_HASH_SECRET;
  if (!secret) {
    throw new Error(
      'normalizeAndHash: PERPETRATOR_HASH_SECRET is not set. Copy .env.example to .env and set it.'
    );
  }

  return crypto.createHmac('sha256', secret).update(normalized).digest('hex');
}

module.exports = { normalizeAndHash, normalize };
