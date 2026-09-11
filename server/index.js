// server/index.js
//
// Backend-owned. The actual Express app entry point (flagged by Networking
// as an unowned gap in docs/sprint-1-plan.md — Backend picks it up here).
//
// Responsibilities, in order:
//   1. Load environment variables (dotenv).
//   2. Configure the Express app, including `trust proxy` — Networking
//      flagged this as required so verifyWebhookSignature() (whatsapp.js)
//      sees the real original protocol/host via X-Forwarded-* headers when
//      running behind ngrok, rather than plain http://localhost.
//   3. Mount the webhook router.
//   4. In non-production environments, run migrations automatically on boot
//      (dev convenience). In production, migrations are expected to run as
//      an explicit, separate release step via `npm run migrate` — see the
//      README/"Running the server" note below for why.
//   5. Load the content_strings cache (server/lib/content.js) before
//      accepting traffic, so t() never serves a cold/empty cache to a real
//      conversation.
//   6. Start listening on process.env.PORT || 3000.
//
// --- Mounting note (deviation from the literal task wording, done to avoid
// a real bug — flagged per "flag it, don't silently follow" from
// sprint-1-plan.md) ---------------------------------------------------------
// server/routes/webhook.js (Networking-owned, frozen) already declares its
// full route internally as `router.post('/webhook/whatsapp', ...)`. Mounting
// that router AT '/webhook/whatsapp' here (i.e. `app.use('/webhook/whatsapp',
// webhookRouter)`) would make the live path
// '/webhook/whatsapp/webhook/whatsapp', not '/webhook/whatsapp' — since
// Express concatenates the mount path with the router's own internal path.
// Backend does not edit webhook.js (Networking-owned), so the fix belongs
// here: mount the router at the app root so its own internal path is the
// full, correct, final path.
require('dotenv').config();

const express = require('express');
const webhookRouter = require('./routes/webhook');
const { getPool } = require('./lib/db');
const { loadContentCache } = require('./lib/content');
const { runMigrations } = require('./migrations/run');

const app = express();

// Required for verifyWebhookSignature() (server/lib/whatsapp.js) to correctly
// reconstruct the original request URL from X-Forwarded-* headers when the
// app runs behind ngrok or any other reverse proxy.
app.set('trust proxy', true);

// See "Mounting note" above: webhookRouter already owns the full
// '/webhook/whatsapp' path internally, so it's mounted at the app root here,
// not re-prefixed with '/webhook/whatsapp' again.
app.use(webhookRouter);

app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

const PORT = process.env.PORT || 3000;

async function start() {
  // Dev convenience: auto-run migrations on boot. Deliberately gated to
  // non-production so a production deploy doesn't race multiple booting
  // instances against the same DB running migrations concurrently — in
  // production, run `npm run migrate` explicitly as its own release step
  // before starting the app (see README "Setup" section).
  if (process.env.NODE_ENV !== 'production') {
    console.log('[startup] NODE_ENV != production — running migrations automatically...');
    await runMigrations(getPool());
  }

  try {
    await loadContentCache();
    console.log('[startup] content_strings cache loaded.');
  } catch (err) {
    // Don't crash the whole process over a content-cache load failure (e.g.
    // DB briefly unreachable, or content_strings not seeded yet) — t() falls
    // back to returning the bare key, which is loud/obvious in manual
    // testing rather than a hard crash. Log clearly so it isn't missed.
    console.error(
      '[startup] failed to load content_strings cache — t() will return bare keys until ' +
        'this succeeds. Did you run `npm run seed`? Error:',
      err.message
    );
  }

  app.listen(PORT, () => {
    console.log(`[startup] Vimbiso server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('[startup] fatal error during startup:', err);
  process.exit(1);
});

module.exports = app;
