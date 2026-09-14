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

// LOG-1 (docs/backlog.md): logs every inbound/outbound message for data
// analysis, sender-pseudonymized at rest. See server/lib/messageLog.ts for
// the full design (why sender ids are hashed, not encrypted, and how lawful
// re-identification still works via a separate mechanism).
import { logMessage, type MessageType } from '../lib/messageLog';

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
  ButtonText?: string;
  ButtonType?: string;
  InteractiveData?: string;
}

// Real bug found during live Twilio Sandbox testing (2026-09-14): a survivor
// tapping a language in sendLanguageSelector's LIST message got re-shown the
// same selector forever instead of advancing — this file's own header
// comment had flagged exactly this as "the single highest-risk assumption
// in this file," never verified against a real payload because no Twilio
// account existed until now. `ButtonPayload` is confirmed (Twilio's public
// messaging-webhook reference) to carry a quick-reply BUTTON tap's id, but
// is NOT confirmed to also carry a LIST-picker row's id the same way — that
// doc explicitly says list-specific detail may only be present inside the
// `InteractiveData` JSON blob instead.
//
// Rather than guess a single field name and risk being wrong twice, this
// tries `ButtonPayload` first (unchanged from before — quick-reply buttons
// keep working exactly as they did), then falls back to parsing
// `InteractiveData` for a `list_reply.id` (WhatsApp's own Cloud API shape
// for a list-row tap) or `button_reply.id` (in case Twilio nests button taps
// the same way in some payload variants). Never throws on malformed JSON —
// a parsing failure here must not crash the whole webhook handler.
function extractButtonId(body: TwilioInboundWebhookBody): string | null {
  if (body.ButtonPayload) {
    return body.ButtonPayload;
  }

  if (body.InteractiveData) {
    try {
      const parsed = JSON.parse(body.InteractiveData);
      const id = parsed?.list_reply?.id ?? parsed?.button_reply?.id;
      if (typeof id === 'string' && id) {
        return id;
      }
    } catch (err) {
      console.error('webhook: failed to parse InteractiveData as JSON:', err);
    }
  }

  return null;
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
  //   ButtonPayload - the developer-defined `id` of a quick-reply BUTTON
  //                   tap. Confirmed real (Twilio's docs) for that case.
  //   InteractiveData - raw JSON Twilio passes through for richer
  //                   interaction types; see extractButtonId() above for
  //                   why a LIST-picker row's id may live here instead of
  //                   in ButtonPayload.
  //
  // UPDATE 2026-09-14 (live Twilio Sandbox testing, Nnouka): this file's own
  // prior comment here flagged ButtonPayload-for-list-rows as "the single
  // highest-risk assumption in this file," never verified against a real
  // payload. It turned out to matter — live testing showed a survivor
  // tapping a language in the LIST message got re-shown the same selector
  // forever (see docs/backlog.md's INF-3 status note). extractButtonId()
  // above now tries ButtonPayload first, then InteractiveData's
  // `list_reply.id`, and the diagnostic log below prints the raw fields on
  // every inbound message so the very next real tap either confirms this
  // fix or tells us exactly what Twilio actually sent instead.
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
  const buttonId = extractButtonId(body);

  // Diagnostic logging for the exact bug above — deliberately logs every
  // interactive-related field EXCEPT `Body`, which can carry a survivor's
  // free-text disclosure and has no reason to sit in a local terminal's
  // scrollback. Keep this until a real list-picker tap has been confirmed
  // working end-to-end; safe to remove after (see docs/backlog.md's INF-3
  // status note for the tracking story).
  console.log(
    `webhook: inbound — ButtonPayload=${JSON.stringify(body.ButtonPayload)} ` +
      `ButtonText=${JSON.stringify(body.ButtonText)} ButtonType=${JSON.stringify(body.ButtonType)} ` +
      `InteractiveData=${JSON.stringify(body.InteractiveData)} resolvedButtonId=${JSON.stringify(buttonId)}`
  );

  const normalizedMsg: NormalizedMessage = {
    from: body.From || null,
    body: body.Body || null,
    buttonId,
    timestamp: new Date().toISOString(),
  };

  // LOG-1: log this inbound message for data analysis, before we even
  // attempt to handle it — the message was genuinely received regardless of
  // how handleIncomingMessage goes on to process it. messageType mirrors
  // extractButtonId()'s own precedence (ButtonPayload = a quick-reply BUTTON
  // tap; a buttonId resolved with no ButtonPayload = a LIST-row tap found
  // via InteractiveData; otherwise free text). Fire-and-forget: logMessage()
  // never throws (see its own header) and must never delay or block the
  // actual reply to the survivor.
  if (body.From) {
    const messageType: MessageType = body.ButtonPayload
      ? 'button_reply'
      : buttonId
        ? 'list_reply'
        : 'text';
    void logMessage({
      direction: 'inbound',
      channel: 'whatsapp',
      rawNumber: body.From,
      messageType,
      buttonId,
      body: body.Body || null,
    });
  }

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
