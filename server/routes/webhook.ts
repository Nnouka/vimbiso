// server/routes/webhook.ts
//
// Networking-owned skeleton, per docs/sprint-1-plan.md §3.2. This route does
// exactly three things, in order, and nothing else:
//   1. Verifies the Twilio signature (verifyWebhookSignature) — 403 if invalid.
//   2. Normalizes the raw Twilio webhook payload into the frozen shape:
//      { from, body, buttonId, timestamp }
//   3. Calls Backend-owned handleIncomingMessage(normalizedMsg) and acks Twilio.
//
// This file must never contain conversation state, scoring, or DB logic —
// all of that lives in server/lib/conversation.ts (Backend-owned). This file
// also never reads Twilio credentials directly; all Twilio access goes
// through server/lib/whatsapp.ts.
//
// --- GET /webhook/whatsapp -------------------------------------------------
// Deliberately NOT implemented. Twilio's WhatsApp Sandbox/webhook setup does
// not use a GET "verification challenge" handshake — that pattern belongs to
// Meta's raw Graph API webhooks (hub.mode/hub.challenge). Twilio instead
// authenticates every POST via the X-Twilio-Signature header, which is what
// verifyWebhookSignature() checks below. Adding a GET handler here would be
// unused code for Twilio specifically.
//
// TS CONVERSION NOTE (this file was server/routes/webhook.js in Sprint 1):
// behavior is unchanged from the JS version. Exported as `export =` (rather
// than `export default`) so the compiled CommonJS output is exactly
// `module.exports = router`, matching the original file's shape for any
// consumer (converted or not yet converted) that does
// `require('./routes/webhook')`.

import express, { Request, Response, Router } from 'express';
import { verifyWebhookSignature } from '../lib/whatsapp';

// server/lib/conversation.ts is Backend-owned and is being converted to TS in
// parallel with this file, per the sprint sequencing in
// docs/sprint-1-plan.md §5. Imported extension-less, same as the original
// `require('../lib/conversation')` — once both files are .ts, TypeScript's
// module resolution finds server/lib/conversation.ts here with no changes
// needed on this end.
import { handleIncomingMessage } from '../lib/conversation';

/** The frozen normalized-message shape passed to handleIncomingMessage(). */
interface NormalizedMessage {
  from: string | null;
  body: string | null;
  buttonId: string | null;
  timestamp: string;
}

/** The subset of Twilio's raw WhatsApp inbound-webhook fields this file reads. */
interface TwilioInboundWebhookBody {
  From?: string;
  Body?: string;
  ButtonPayload?: string;
}

const router: Router = express.Router();

// Twilio posts WhatsApp webhooks as application/x-www-form-urlencoded. This
// router parses its own body so it's self-contained regardless of what
// global body-parser middleware (if any) server/index.ts applies.
router.use(express.urlencoded({ extended: false }));

router.post('/webhook/whatsapp', async (req: Request, res: Response) => {
  let signatureValid: boolean;
  try {
    signatureValid = verifyWebhookSignature(req);
  } catch (err) {
    // e.g. TWILIO_AUTH_TOKEN missing — a config problem, not a forged
    // request. Distinguished from an invalid signature (403) so a dev
    // environment without credentials yet fails loudly and obviously
    // instead of looking like "every request is rejected as unsigned."
    const message = err instanceof Error ? err.message : String(err);
    console.error('webhook: verifyWebhookSignature threw:', message);
    res.status(500).send('Server misconfigured: ' + message);
    return;
  }

  if (!signatureValid) {
    res.status(403).send('Invalid Twilio signature');
    return;
  }

  // --- Normalize the raw Twilio payload -------------------------------
  // Real Twilio WhatsApp inbound-webhook field names (per Twilio's public
  // messaging-webhook request parameter reference):
  //   From          - e.g. "whatsapp:+254712345678"
  //   Body          - free-text message body; present only if the user
  //                   typed text rather than tapping a button/list row
  //   ButtonPayload - the developer-defined `id` of whatever the user
  //                   tapped — this is the SAME field for both a
  //                   sendButtons() quick-reply tap and a sendList() row
  //                   tap (Twilio does not use a separate "ListId" field;
  //                   that name in earlier drafts of this interface was a
  //                   placeholder, not a real Twilio field)
  //   ButtonText    - the display text of what was tapped (not surfaced in
  //                   the normalized shape below — Backend's content.ts
  //                   already knows the display text for a given
  //                   buttonId, so this would be redundant)
  //
  // NOT VERIFIED against a live payload — no Twilio account exists in this
  // environment to capture a real inbound webhook yet. Before relying on
  // this in the integration/smoke-test step, confirm ButtonPayload's exact
  // behavior for a list-picker row tap specifically (as opposed to a
  // quick-reply button tap) by inspecting a real captured POST — e.g. via
  // ngrok's local request inspector at http://127.0.0.1:4040. See
  // docs/twilio-setup.md. This is the single highest-risk assumption in
  // this file.
  //
  // Twilio's standard webhook body carries no field for "when Twilio
  // received the message" (there is no `Timestamp` param), so we stamp
  // receipt time on our own server as the practical equivalent — accurate
  // to network latency (milliseconds to a low number of seconds).
  //
  // req.body is typed `any` by Express (no body-parser type augmentation is
  // in play), so it's cast to the narrow shape this file actually reads
  // rather than left as `any` past this point.
  const body = req.body as TwilioInboundWebhookBody;
  const normalizedMsg: NormalizedMessage = {
    from: body.From || null,
    body: body.Body || null,
    buttonId: body.ButtonPayload || null,
    timestamp: new Date().toISOString(),
  };

  try {
    // Awaited deliberately. handleIncomingMessage is what actually sends
    // the survivor's reply (by calling sendText/sendButtons/sendList
    // internally), so it must run before we consider this webhook request
    // handled. This does NOT block the "reply within 5 seconds" goal from
    // INF-1 — that's driven by how fast handleIncomingMessage's own outbound
    // API call completes, not by when THIS function returns 200 to Twilio.
    // We are only avoiding waiting on side effects beyond what's needed to
    // send that reply, per §3.2 — which in practice means: don't add any
    // extra work here after the await, just ack.
    await handleIncomingMessage(normalizedMsg);
  } catch (err) {
    // Backend owns retry/idempotency semantics for its own function. We only
    // log here so one broken message doesn't crash the process, and still
    // ack Twilio with 200 so Twilio doesn't treat this as a webhook delivery
    // failure and retry the same inbound message.
    console.error('webhook: handleIncomingMessage failed:', err);
  }

  res.status(200).send('');
});

export = router;
