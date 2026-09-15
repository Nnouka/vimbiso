"use strict";
// server/index.ts
//
// Backend-owned. The actual Express app entry point (flagged by Networking
// as an unowned gap in docs/sprint-1-plan.md — Backend picks it up here).
//
// Responsibilities, in order:
//   1. Load environment variables (dotenv), and validate the ones the
//      process cannot usefully boot without.
//   2. Configure the Express app, including `trust proxy` — Networking
//      flagged this as required so verifyWebhookSignature() (whatsapp.ts)
//      sees the real original protocol/host via X-Forwarded-* headers when
//      running behind ngrok, rather than plain http://localhost.
//   3. Mount the webhook router.
//   4. In non-production environments, run migrations automatically on boot
//      (dev convenience). In production, migrations are expected to run as
//      an explicit, separate release step via `npm run migrate` — see the
//      README/"Running the server" note below for why.
//   5. Load the content_strings cache (server/lib/content.ts) before
//      accepting traffic, so t() never serves a cold/empty cache to a real
//      conversation.
//   6. Start listening on process.env.PORT || 3000.
//
// --- Mounting note (deviation from the literal task wording, done to avoid
// a real bug — flagged per "flag it, don't silently follow" from
// sprint-1-plan.md) ---------------------------------------------------------
// server/routes/webhook.ts (Networking-owned, frozen) already declares its
// full route internally as `router.post('/webhook/whatsapp', ...)`. Mounting
// that router AT '/webhook/whatsapp' here (i.e. `app.use('/webhook/whatsapp',
// webhookRouter)`) would make the live path
// '/webhook/whatsapp/webhook/whatsapp', not '/webhook/whatsapp' — since
// Express concatenates the mount path with the router's own internal path.
// Backend does not edit webhook.ts (Networking-owned), so the fix belongs
// here: mount the router at the app root so its own internal path is the
// full, correct, final path.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const webhook_1 = __importDefault(require("./routes/webhook"));
const db_1 = require("./lib/db");
const content_1 = require("./lib/content");
const run_1 = require("./migrations/run");
/**
 * Reads a required environment variable, throwing a clear, actionable error
 * at startup if it's missing rather than letting `undefined` silently flow
 * into whatever reads `process.env[name]` next (e.g. `pg`'s Pool only
 * failing much later, on the first query, with a far less obvious error).
 * Strict mode flags every bare `process.env.X` as possibly `undefined` —
 * this is the "validate the critical ones at startup" half of the fix (the
 * other half being: modules that read optional/lazily-needed credentials,
 * like whatsapp.ts's Twilio vars or hashing.ts's PERPETRATOR_HASH_SECRET,
 * intentionally keep checking for themselves at the point of use, since
 * those aren't required just to boot the process).
 */
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`[startup] Required environment variable ${name} is not set. Copy .env.example to .env and fill it in.`);
    }
    return value;
}
// DATABASE_URL is the one environment variable nothing in this process can
// do anything useful without (migrations, the content cache, and every
// conversation-state read/write all depend on it) — validated here, before
// anything else runs, so a missing .env fails immediately and obviously.
requireEnv('DATABASE_URL');
const app = (0, express_1.default)();
// Required for verifyWebhookSignature() (server/lib/whatsapp.ts) to correctly
// reconstruct the original request URL from X-Forwarded-* headers when the
// app runs behind ngrok or any other reverse proxy.
app.set('trust proxy', true);
// See "Mounting note" above: webhookRouter already owns the full
// '/webhook/whatsapp' path internally, so it's mounted at the app root here,
// not re-prefixed with '/webhook/whatsapp' again.
app.use(webhook_1.default);
app.get('/health', (req, res) => {
    res.status(200).send('ok');
});
// process.env.PORT is a string when set (e.g. from .env's `PORT=3000`) —
// converted to a real `number` here (rather than keeping the original JS's
// `string | number` union from `process.env.PORT || 3000`) both because
// Express/Node's `listen()` overloads want a definite `number` for a TCP
// port, and so this is unambiguous rather than relying on Node's internal
// numeric-string parsing.
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
async function start() {
    // Dev convenience: auto-run migrations on boot. Deliberately gated to
    // non-production so a production deploy doesn't race multiple booting
    // instances against the same DB running migrations concurrently — in
    // production, run `npm run migrate` explicitly as its own release step
    // before starting the app (see README "Setup" section).
    if (process.env.NODE_ENV !== 'production') {
        console.log('[startup] NODE_ENV != production — running migrations automatically...');
        await (0, run_1.runMigrations)((0, db_1.getPool)());
    }
    try {
        await (0, content_1.loadContentCache)();
        console.log('[startup] content_strings cache loaded.');
        // Real bug found during live Twilio Sandbox testing: migrations
        // auto-run above, but seeding is a separate manual `npm run seed` step —
        // so a fresh boot can load a successfully-EMPTY cache with no error at
        // all, and the first real message then fails 3 function calls deep in a
        // way that's easy to misdiagnose as a WhatsApp API problem. See
        // content.ts's assertCriticalContentSeeded() for the full story.
        (0, content_1.assertCriticalContentSeeded)();
    }
    catch (err) {
        // Don't crash the whole process over a content-cache load failure (e.g.
        // DB briefly unreachable, or content_strings not seeded yet) — t() falls
        // back to returning the bare key, which is loud/obvious in manual
        // testing rather than a hard crash. Log clearly so it isn't missed.
        const message = err instanceof Error ? err.message : String(err);
        console.error('[startup] failed to load content_strings cache — t() will return bare keys until ' +
            'this succeeds. Did you run `npm run seed`? Error:', message);
    }
    app.listen(PORT, () => {
        console.log(`[startup] Vimbiso server listening on port ${PORT}`);
    });
}
start().catch((err) => {
    console.error('[startup] fatal error during startup:', err);
    process.exit(1);
});
exports.default = app;
//# sourceMappingURL=index.js.map