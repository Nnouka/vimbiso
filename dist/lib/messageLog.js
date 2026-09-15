"use strict";
// server/lib/messageLog.ts
//
// Backend/Networking-owned (LOG-1/LOG-3, docs/backlog.md). Logs every
// inbound/outbound WhatsApp/SMS message to `message_log` for data analysis,
// WITHOUT identifying who sent or received it by default, plus a separate,
// deliberately harder-to-reach mechanism for lawful re-identification.
//
// --- Why two different cryptographic mechanisms, not one -------------------
//
// The original ask was "anonymize sender ids." The natural first instinct —
// reuse SEC-1's `normalizeAndHash` pattern (a one-way HMAC) — cannot also
// satisfy the follow-up requirement ("but we need to recover it under a
// lawsuit/government order"), because a cryptographic hash is irreversible
// BY CONSTRUCTION: there is no key that turns a hash back into its input.
// "Anonymous by default, reversible under lawful process" needs two
// genuinely different primitives, not one function used two ways:
//
//   1. `pseudonymize()` — HMAC-SHA256, one-way, under MESSAGE_LOG_HASH_SECRET.
//      Used for `message_log.sender_pseudonym`. Stable per real number (so
//      one sender's conversation groups together for analysis/replay), but
//      NO key this application holds can ever reverse it. This is the value
//      every normal analysis query runs against.
//
//   2. `encryptSenderIdentity()` / (decrypt, in server/scripts/
//      recoverSenderIdentity.ts only) — AES-256-GCM, REVERSIBLE, under
//      SENDER_IDENTITY_RECOVERY_KEY — a THIRD secret, distinct from both
//      MESSAGE_LOG_HASH_SECRET above and MESSAGE_LOG_ENCRYPTION_KEY below.
//      Written once per unique sender to `sender_identity_map`. The privacy
//      control here is KEY CUSTODY, not the algorithm: this key must never
//      live alongside this application's normal runtime secrets (`.env`,
//      the hosting platform's env-var config) — see docs/backlog.md's LOG-3
//      for the full requirement. No code in this file, or anywhere in the
//      normally-running application, ever decrypts `sender_identity_map`.
//
// Message BODY content is encrypted with a fourth, separate mechanism again
// (AES-256-GCM under MESSAGE_LOG_ENCRYPTION_KEY) — reversible, because LOG-2's
// dev-only console mirror and any future legitimate analysis tooling need to
// read message content back, which is a different concern from sender
// identity entirely. Using one secret per concern (four secrets, four
// purposes) means compromising any one of them never automatically
// compromises the others.
//
// --- Failure handling --------------------------------------------------
//
// logMessage() must NEVER throw or block a real send/receive (LOG-1's AC) —
// every call site below is wrapped so a bug or missing env var in this file
// degrades to "this message wasn't logged," never "the survivor didn't get
// their reply."
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.pseudonymizeSender = pseudonymizeSender;
exports.encryptMessageBody = encryptMessageBody;
exports.decryptMessageBody = decryptMessageBody;
exports.encryptSenderIdentity = encryptSenderIdentity;
exports.logMessage = logMessage;
const crypto = __importStar(require("crypto"));
const db_1 = require("./db");
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`messageLog.ts: ${name} is not set. See .env.example.`);
    }
    return value;
}
// AES-256-GCM needs a 32-byte key. Accepts the env var as hex or base64
// (whichever is 32 bytes once decoded) so `openssl rand -hex 32` (this
// project's existing convention for PERPETRATOR_HASH_SECRET) works directly.
function loadAesKey(envVarName) {
    const raw = requireEnv(envVarName);
    const hexKey = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : null;
    const key = hexKey ?? Buffer.from(raw, 'base64');
    if (key.length !== 32) {
        throw new Error(`messageLog.ts: ${envVarName} must decode to exactly 32 bytes (got ${key.length}). ` +
            `Generate one with \`openssl rand -hex 32\`.`);
    }
    return key;
}
// Phone numbers arrive as either "whatsapp:+2547XXXXXXXX" (WhatsApp channel)
// or plain "+2547XXXXXXXX" (SMS channel, e.g. ONCALL_COUNSELLOR_PHONE). Both
// forms of the SAME real number must pseudonymize to the SAME value, so the
// "whatsapp:" prefix is stripped before hashing — this is deliberately NOT
// hashing.ts's `normalize()` (SEC-1), which strips `+` as punctuation and
// would corrupt E.164 numbers; phone numbers need their own normalization.
function normalizePhoneForLog(rawNumber) {
    return rawNumber.replace(/^whatsapp:/, '').trim();
}
/**
 * One-way HMAC-SHA256 pseudonym for a phone number. Deliberately irreversible
 * — see this file's header. Same real number always produces the same
 * pseudonym (so a conversation can be grouped/replayed), but no key can turn
 * this value back into the number it came from.
 */
function pseudonymizeSender(rawNumber) {
    const secret = requireEnv('MESSAGE_LOG_HASH_SECRET');
    const normalized = normalizePhoneForLog(rawNumber);
    return crypto.createHmac('sha256', secret).update(normalized).digest('hex');
}
function aesEncrypt(plaintext, key) {
    const iv = crypto.randomBytes(12); // 96-bit IV, the GCM-recommended size
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return { ciphertext, iv, authTag: cipher.getAuthTag() };
}
function aesDecrypt(ciphertext, iv, authTag, key) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
/** Encrypts message content for `message_log.body_ciphertext` (reversible — see this file's header). */
function encryptMessageBody(plaintext) {
    return aesEncrypt(plaintext, loadAesKey('MESSAGE_LOG_ENCRYPTION_KEY'));
}
/**
 * Decrypts `message_log` body content. Used ONLY by LOG-2's dev-only console
 * mirror in this codebase — this is a different, less sensitive capability
 * than lawful sender re-identification (see encryptSenderIdentity below) and
 * intentionally uses a different key, but is still real survivor content:
 * callers must respect the same "never in production" discipline LOG-2's
 * own AC requires.
 */
function decryptMessageBody(ciphertext, iv, authTag) {
    return aesDecrypt(ciphertext, iv, authTag, loadAesKey('MESSAGE_LOG_ENCRYPTION_KEY'));
}
/**
 * Encrypts a real phone number for `sender_identity_map`, under the THIRD,
 * separate secret this file's header describes. Exported only so
 * `logMessage()` below can write the map; there is deliberately no matching
 * `decryptSenderIdentity()` export here — decryption lives ONLY in
 * server/scripts/recoverSenderIdentity.ts, a standalone tool never imported
 * by the running application, per LOG-3's "no decrypt-on-demand API" AC.
 */
function encryptSenderIdentity(rawNumber) {
    return aesEncrypt(normalizePhoneForLog(rawNumber), loadAesKey('SENDER_IDENTITY_RECOVERY_KEY'));
}
/**
 * LOG-2: mirrors a logged message to the console, decrypted, for local
 * debugging — NEVER in production. Deliberately a no-op (not just "quiet")
 * outside dev, so this can be called unconditionally from logMessage()
 * without every call site re-checking NODE_ENV itself.
 */
function consoleMirror(params, pseudonym) {
    if (process.env.NODE_ENV === 'production') {
        return;
    }
    const arrow = params.direction === 'inbound' ? '->' : '<-';
    console.log(`[message_log] ${arrow} pseudonym=${pseudonym.slice(0, 12)}… channel=${params.channel} ` +
        `type=${params.messageType} buttonId=${params.buttonId ?? 'null'} ` +
        `body=${JSON.stringify(params.body ?? null)}`);
}
/**
 * Logs one message to `message_log`, and — the first time a real sender is
 * seen — writes their one `sender_identity_map` row. Never throws: every
 * failure is caught and logged, because a bug in this file must never block
 * or fail a real send (LOG-1's AC). Call this AFTER a send/receive is
 * already confirmed to have happened — never let a logging failure look
 * like a send failure to the caller.
 */
async function logMessage(params) {
    try {
        const pseudonym = pseudonymizeSender(params.rawNumber);
        let bodyCiphertext = null;
        let bodyIv = null;
        let bodyAuthTag = null;
        if (params.body) {
            const enc = encryptMessageBody(params.body);
            bodyCiphertext = enc.ciphertext;
            bodyIv = enc.iv;
            bodyAuthTag = enc.authTag;
        }
        await (0, db_1.query)(`INSERT INTO message_log
         (direction, channel, sender_pseudonym, message_type, button_id,
          body_ciphertext, body_iv, body_auth_tag, report_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
            params.direction,
            params.channel,
            pseudonym,
            params.messageType,
            params.buttonId ?? null,
            bodyCiphertext,
            bodyIv,
            bodyAuthTag,
            params.reportId ?? null,
        ]);
        // ON CONFLICT DO NOTHING: sender_identity_map holds exactly one row per
        // unique real sender (LOG-3's AC) — every message after the first is a
        // no-op write here, keeping the reversible-PII surface as small as the
        // number of unique senders, not the number of messages.
        const identity = encryptSenderIdentity(params.rawNumber);
        await (0, db_1.query)(`INSERT INTO sender_identity_map (sender_pseudonym, encrypted_real_number, iv, auth_tag)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (sender_pseudonym) DO NOTHING`, [pseudonym, identity.ciphertext, identity.iv, identity.authTag]);
        consoleMirror(params, pseudonym);
    }
    catch (err) {
        console.error('messageLog.ts: logMessage failed (message itself was NOT affected):', err);
    }
}
//# sourceMappingURL=messageLog.js.map