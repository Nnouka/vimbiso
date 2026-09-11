// server/lib/content.js
//
// Backend-owned (LANG-1). t(key, language) reads user-facing copy from the
// `content_strings` table, falling back to English (with a console warning)
// when the requested (key, language) pair is missing — never throws, never
// returns undefined to a caller.
//
// Implementation choice (documented per the sprint-1 task instructions,
// since this was left to Backend's judgment): content is loaded into an
// in-memory cache ONCE at process startup (server/index.js calls
// loadContentCache() before app.listen), rather than hitting Postgres on
// every t() call. Rationale:
//   - t() is called many times per single inbound WhatsApp message (every
//     button label, every question), so a synchronous, allocation-free
//     lookup keeps conversation.js's handler code simple (no `await t(...)`
//     scattered through the state machine).
//   - content_strings changes only when someone re-seeds/edits content, not
//     on the hot path of a survivor's conversation — a short-lived cache is
//     an acceptable trade for a hackathon-scale pilot, not a general
//     production content-management system.
//   - Section 3.3 of the sprint plan requires conversation/session STATE to
//     live only in Postgres, not in-memory — content_strings is reference
//     data (closer to a config/i18n bundle), not conversation state, so this
//     doesn't violate that rule; the cache is a read-through copy, never a
//     write target.
// If content is edited via the DB directly while the process is running, call
// loadContentCache() again (or restart) to pick up the change — there is no
// automatic invalidation in Sprint 1.

const { getPool } = require('./db');

/** @type {Map<string,string>|null} key = `${key}::${language}` */
let cache = null;

/**
 * Loads (or reloads) the entire content_strings table into the in-memory
 * cache. Call once at startup before serving traffic; safe to call again to
 * pick up content edits.
 * @returns {Promise<Map<string,string>>}
 */
async function loadContentCache() {
  const pool = getPool();
  const { rows } = await pool.query('SELECT key, language, text FROM content_strings');
  const next = new Map();
  for (const row of rows) {
    next.set(cacheKey(row.key, row.language), row.text);
  }
  cache = next;
  return cache;
}

function cacheKey(key, language) {
  return `${key}::${language}`;
}

/**
 * Returns the copy for `key` in `language`, falling back to English if that
 * exact (key, language) row doesn't exist, and finally to the bare key string
 * if even the English fallback is missing (so a user-facing message is never
 * `undefined` — it's at worst a visibly-wrong-looking key name, which is loud
 * and easy to spot in testing rather than a crash or blank message).
 *
 * @param {string} key
 * @param {string} [language='en']
 * @returns {string}
 */
function t(key, language = 'en') {
  if (!cache) {
    console.warn(
      `content.js: t("${key}", "${language}") called before loadContentCache() completed — ` +
        `returning the bare key as a last-resort fallback.`
    );
    return key;
  }

  const direct = cache.get(cacheKey(key, language));
  if (direct !== undefined) {
    return direct;
  }

  if (language !== 'en') {
    console.warn(
      `content.js: missing content for key="${key}" language="${language}" — falling back to English.`
    );
  }

  const englishFallback = cache.get(cacheKey(key, 'en'));
  if (englishFallback !== undefined) {
    return englishFallback;
  }

  console.warn(
    `content.js: missing content for key="${key}" in language="${language}" AND in the English ` +
      `fallback — returning the bare key. Seed this key in server/seeds/.`
  );
  return key;
}

/** Test/dev helper: clears the cache so a fresh loadContentCache() is required. */
function _resetCacheForTests() {
  cache = null;
}

module.exports = { t, loadContentCache, _resetCacheForTests };
