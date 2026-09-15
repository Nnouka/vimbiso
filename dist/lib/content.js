"use strict";
// server/lib/content.ts
//
// Backend-owned (LANG-1). t(key, language) reads user-facing copy from the
// `content_strings` table, falling back to English (with a console warning)
// when the requested (key, language) pair is missing — never throws, never
// returns undefined to a caller.
//
// Implementation choice (documented per the sprint-1 task instructions,
// since this was left to Backend's judgment): content is loaded into an
// in-memory cache ONCE at process startup (server/index.ts calls
// loadContentCache() before app.listen), rather than hitting Postgres on
// every t() call. Rationale:
//   - t() is called many times per single inbound WhatsApp message (every
//     button label, every question), so a synchronous, allocation-free
//     lookup keeps conversation.ts's handler code simple (no `await t(...)`
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadContentCache = loadContentCache;
exports.t = t;
exports.assertCriticalContentSeeded = assertCriticalContentSeeded;
exports._resetCacheForTests = _resetCacheForTests;
const db_1 = require("./db");
/** key = `${key}::${language}` -> text */
let cache = null;
/**
 * Loads (or reloads) the entire content_strings table into the in-memory
 * cache. Call once at startup before serving traffic; safe to call again to
 * pick up content edits.
 */
async function loadContentCache() {
    const pool = (0, db_1.getPool)();
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
// Real bug found during live Twilio Sandbox testing (not a hypothetical):
// on an environment where content_strings was empty (migrations auto-run on
// boot per server/index.ts, but seeding does NOT — it's a separate manual
// `npm run seed` step), every t() call fell through to this bare-key
// fallback as designed... except the bare KEY STRING ITSELF, e.g.
// "lang_select.row_kiswahili" (25 chars), is longer than WhatsApp's own
// 20/24-char limits on button/list-row titles (see whatsapp.ts's sendButtons/
// sendList validation) — so instead of a merely ugly-but-working degraded
// message, `handleIncomingMessage` threw and the survivor got NO response at
// all, on the very first screen every single conversation depends on.
//
// Fix: cap the bare-key fallback at the TIGHTEST WhatsApp UI-chrome limit
// across every call site that can render one (20 chars — quick-reply button
// titles and the list button label; list row titles get 4 more chars of
// slack at 24, so 20 is always safe there too). A truncated key still looks
// obviously wrong in testing (the whole point of returning the bare key at
// all) — it just can no longer crash the send.
const MAX_SAFE_FALLBACK_LENGTH = 20;
function safeFallback(key) {
    return key.length > MAX_SAFE_FALLBACK_LENGTH ? key.slice(0, MAX_SAFE_FALLBACK_LENGTH) : key;
}
/**
 * Returns the copy for `key` in `language`, falling back to English if that
 * exact (key, language) row doesn't exist, and finally to the bare key string
 * (truncated to `MAX_SAFE_FALLBACK_LENGTH` — see that constant's comment) if
 * even the English fallback is missing, so a user-facing message is never
 * `undefined` and never long enough to crash a WhatsApp send on its own — at
 * worst a visibly-wrong-looking key name, which is loud and easy to spot in
 * testing rather than a crash or blank message.
 */
function t(key, language = 'en') {
    if (!cache) {
        console.warn(`content.ts: t("${key}", "${language}") called before loadContentCache() completed — ` +
            `returning the bare key as a last-resort fallback.`);
        return safeFallback(key);
    }
    const direct = cache.get(cacheKey(key, language));
    if (direct !== undefined) {
        return direct;
    }
    if (language !== 'en') {
        console.warn(`content.ts: missing content for key="${key}" language="${language}" — falling back to English.`);
    }
    const englishFallback = cache.get(cacheKey(key, 'en'));
    if (englishFallback !== undefined) {
        return englishFallback;
    }
    console.warn(`content.ts: missing content for key="${key}" in language="${language}" AND in the English ` +
        `fallback — returning the bare key (truncated for WhatsApp's UI-chrome length limits). ` +
        `Seed this key in server/seeds/.`);
    return safeFallback(key);
}
// The exact set `sendLanguageSelector` (conversation.ts) needs to send the
// FIRST message of every single conversation — INF-1's entry point. If any
// of these is missing in English, literally no survivor can start a
// conversation in any language, not just a translation gap. Worth a loud,
// startup-time check of its own rather than relying on t()'s per-key,
// per-message console.warn (easy to miss buried in webhook traffic) plus
// whatever downstream crash happens to surface it first (see the real bug
// this fixed, in t()'s header comment above).
const CRITICAL_CONTENT_KEYS = [
    'lang_select.body',
    'lang_select.button',
    'lang_select.section_title',
    'lang_select.row_english',
    'lang_select.row_kiswahili',
    'lang_select.row_francais',
];
/**
 * Call once, right after `loadContentCache()` succeeds (see server/index.ts).
 * Logs one unmissable `[startup]`-prefixed error naming exactly which
 * language-selector keys are missing, if any — a strong, specific signal
 * that content_strings hasn't been seeded (or was seeded against a
 * different `DATABASE_URL` than this process is using) well before the
 * first real message arrives and fails obscurely three function calls deep.
 * Deliberately does not throw: same "don't crash the whole process over a
 * content problem" judgment call server/index.ts already makes around
 * `loadContentCache()` itself.
 */
function assertCriticalContentSeeded() {
    if (!cache)
        return; // loadContentCache() itself already failed/warned loudly.
    const missing = CRITICAL_CONTENT_KEYS.filter((key) => !cache.has(cacheKey(key, 'en')));
    if (missing.length === 0)
        return;
    console.error(`[startup] CRITICAL: content_strings is missing ${missing.length} of the ` +
        `language-selector keys every single conversation needs just to start: ` +
        `${missing.join(', ')}. Every incoming message will fail until this is fixed. ` +
        `Run \`npm run seed\` against the SAME DATABASE_URL this server is using, then ` +
        `restart this process — content is cached once at startup with no live reload ` +
        `(see this file's header comment).`);
}
/** Test/dev helper: clears the cache so a fresh loadContentCache() is required. */
function _resetCacheForTests() {
    cache = null;
}
//# sourceMappingURL=content.js.map