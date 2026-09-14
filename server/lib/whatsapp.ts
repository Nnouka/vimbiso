// server/lib/whatsapp.ts
//
// Networking-owned. This is the ONLY chokepoint for outbound WhatsApp traffic
// and inbound-signature verification, per docs/sprint-1-plan.md §3.1. The
// exported function names/signatures below are FROZEN for Sprint 1 — Backend
// codes against this exact shape. Do not rename or change signatures without
// flagging it to the whole team.
//
//   sendText(to, body)
//   sendButtons(to, body, buttons)
//   sendList(to, body, sections, buttonText?)   // buttonText is an ADDITIVE,
//                                                // optional 4th param with a
//                                                // default — see note above
//                                                // sendList() below. Existing
//                                                // 3-arg calls are unaffected.
//   verifyWebhookSignature(req)
//
// Credentials are read lazily (at call time, not at import time) from:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
// so this module can be safely imported in a dev environment before real
// Twilio credentials exist — it only throws when a function that actually
// needs a given credential is called. See docs/twilio-setup.md for how to
// obtain these.
//
// TS CONVERSION NOTE (this file was server/lib/whatsapp.js in Sprint 1):
// behavior is unchanged from the JS version. The only change strict mode
// forced is in verifyWebhookSignature() — see the comment there.

import twilio from 'twilio';
import type { Request } from 'express';

// LOG-1 (docs/backlog.md): logs every outbound message for data analysis,
// sender-pseudonymized at rest. See server/lib/messageLog.ts for the full
// design. Fire-and-forget everywhere below — logMessage() never throws (see
// its own header) and must never delay or block a real send.
import { logMessage } from './messageLog';

// ---------------------------------------------------------------------------
// Exported shapes
// ---------------------------------------------------------------------------

export interface QuickReplyButton {
  id: string;
  title: string;
}

/** One row inside a WhatsApp list-message section. */
export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

/** One named group of rows in a WhatsApp list message. */
export interface ListSection {
  title: string;
  rows: ListRow[];
}

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------
//
// The twilio SDK ships its own .d.ts files (there's no separate @types/twilio
// package), but the exact instance-type names (e.g. `MessageInstance`,
// `ContentInstance`) live deep under twilio/lib/rest/**/*.d.ts and their
// precise export paths can shift between minor SDK versions. Rather than
// hand-import a path we can't verify against the installed version in this
// sandbox (no node_modules — npm registry is blocked here), we derive the
// return types structurally straight off the client's own method signatures
// via ReturnType<>. This resolves to whatever twilio's real .d.ts declares
// (Promise<MessageInstance> / Promise<ContentInstance> per Twilio's public
// docs) once `npm install` brings in the real types — but that has NOT been
// verified against the actual installed types in this environment. A human
// running `npm run typecheck` should confirm these resolve as expected, and
// should also double check that `create`'s declared type isn't a true
// TypeScript overload set (ReturnType<> on an overloaded function picks the
// LAST overload signature, which could differ from the Promise-returning one
// if Twilio also declares a callback-style overload).
type TwilioClient = ReturnType<typeof twilio>;
type SendMessageResult = ReturnType<TwilioClient['messages']['create']>;
type CreateContentResult = ReturnType<TwilioClient['content']['v1']['contents']['create']>;
// The resolved (post-await) value of a content-create call, e.g. to read
// `.sid` off it — see the ReturnType note above for how this is derived.
type ContentInstance = Awaited<CreateContentResult>;

// ---------------------------------------------------------------------------
// Internal helpers (not exported — keeps the module's exports exactly
// matching the frozen §3.1 contract).
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `whatsapp.ts: ${name} is not set. Copy .env.example to .env and fill in ` +
        `your Twilio credentials — see docs/twilio-setup.md.`
    );
  }
  return value;
}

function getClient(): TwilioClient {
  const accountSid = requireEnv('TWILIO_ACCOUNT_SID');
  const authToken = requireEnv('TWILIO_AUTH_TOKEN');
  return twilio(accountSid, authToken);
}

function getWhatsappFrom(): string {
  const from = requireEnv('TWILIO_WHATSAPP_FROM');
  return toWhatsappAddress(from);
}

function toWhatsappAddress(number: string): string {
  return number.startsWith('whatsapp:') ? number : `whatsapp:${number}`;
}

// ---------------------------------------------------------------------------
// sendText
// ---------------------------------------------------------------------------

/**
 * Sends a plain WhatsApp text message via Twilio.
 * Resolves when Twilio accepts the send (does not wait for delivery).
 * @param to - destination number, e.g. "whatsapp:+2547XXXXXXXX" or "+2547XXXXXXXX"
 * @param body - message text
 */
export async function sendText(to: string, body: string): SendMessageResult {
  if (typeof to !== 'string' || !to.trim()) {
    throw new Error('sendText: "to" must be a non-empty string.');
  }
  if (typeof body !== 'string' || !body.trim()) {
    throw new Error('sendText: "body" must be a non-empty string.');
  }

  const client = getClient();
  const from = getWhatsappFrom();

  const result = await client.messages.create({
    from,
    to: toWhatsappAddress(to),
    body,
  });

  void logMessage({
    direction: 'outbound',
    channel: 'whatsapp',
    rawNumber: to,
    messageType: 'sent_text',
    buttonId: null,
    body,
  });

  return result;
}

// ---------------------------------------------------------------------------
// sendButtons
// ---------------------------------------------------------------------------

/**
 * Sends an interactive WhatsApp Quick Reply message (max 3 buttons).
 * @param to
 * @param body
 * @param buttons - max 3, title <= 20 chars
 */
export async function sendButtons(
  to: string,
  body: string,
  buttons: QuickReplyButton[]
): SendMessageResult {
  if (typeof to !== 'string' || !to.trim()) {
    throw new Error('sendButtons: "to" must be a non-empty string.');
  }
  if (typeof body !== 'string' || !body.trim()) {
    throw new Error('sendButtons: "body" must be a non-empty string.');
  }
  if (!Array.isArray(buttons) || buttons.length === 0) {
    throw new Error('sendButtons: "buttons" must be a non-empty array of {id, title}.');
  }
  // WhatsApp's own hard limit on Quick Reply buttons is 3. Validate here so
  // we fail with a clear message instead of an opaque Twilio API error.
  if (buttons.length > 3) {
    throw new Error(
      `sendButtons: WhatsApp allows a maximum of 3 quick-reply buttons, got ${buttons.length}.`
    );
  }
  buttons.forEach((btn, i) => {
    if (!btn || typeof btn.id !== 'string' || !btn.id.trim()) {
      throw new Error(`sendButtons: button at index ${i} is missing a valid "id".`);
    }
    if (typeof btn.title !== 'string' || !btn.title.trim()) {
      throw new Error(`sendButtons: button at index ${i} is missing a valid "title".`);
    }
    // WhatsApp's own limit on quick-reply button titles is 20 characters.
    if (btn.title.length > 20) {
      throw new Error(
        `sendButtons: button title "${btn.title}" is ${btn.title.length} chars; ` +
          `WhatsApp limits quick-reply button titles to 20 chars.`
      );
    }
  });

  const client = getClient();
  const from = getWhatsappFrom();

  // --- Twilio mechanics note (READ BEFORE DEBUGGING A SEND FAILURE) --------
  // Twilio does NOT accept raw interactive-message JSON in messages.create()
  // for WhatsApp (unlike Meta's own Cloud API). Quick Reply / List messages
  // must be sent by first creating a Content resource via Twilio's Content
  // API, then referencing it by contentSid on the outbound message. Because
  // this function's body/buttons are dynamic per call (a different question
  // each time), we create a fresh one-off Content resource per send rather
  // than a pre-registered reusable template — simplest correct approach for
  // Sprint 1, at the cost of one extra API round-trip per send.
  //
  // NOT VERIFIED LIVE: the exact JSON shape below (`types["twilio/quick-
  // reply"]` with a `body` + `actions: [{id, title}]` array) is written from
  // Twilio's public Content API documentation, but no Twilio account exists
  // in this environment to test an actual send against. If Twilio rejects
  // this payload, check the current schema at
  // https://www.twilio.com/docs/content/whatsapp-quick-reply — this is the
  // single highest-risk part of this file to double check first. It's also
  // the object literal below that `tsc` will validate against Twilio's own
  // declared parameter type for `content.v1.contents.create()` once real
  // types are installed — if that doesn't compile, that's a genuine schema
  // mismatch to resolve against the docs above, not a reason to `as any` it.
  const content: ContentInstance = await client.content.v1.contents.create({
    friendly_name: `vimbiso_quick_reply_${Date.now()}`,
    language: 'en',
    types: {
      'twilio/quick-reply': {
        body,
        actions: buttons.map((b) => ({ id: b.id, title: b.title })),
      },
    },
  });

  const result = await client.messages.create({
    from,
    to: toWhatsappAddress(to),
    contentSid: content.sid,
  });

  void logMessage({
    direction: 'outbound',
    channel: 'whatsapp',
    rawNumber: to,
    messageType: 'sent_buttons',
    buttonId: null,
    body,
  });

  return result;
}

// ---------------------------------------------------------------------------
// sendList
// ---------------------------------------------------------------------------

interface ListPickerItem {
  item: string;
  id: string;
  description?: string;
}

/**
 * Sends an interactive WhatsApp List Message.
 * @param to
 * @param body
 * @param sections
 * @param buttonText - the label of the button that opens the list (WhatsApp
 *   limit: 20 chars). Defaults to 'Select'. This is an ADDITIVE optional 4th
 *   parameter, not part of the original §3.1 signature — the frozen contract
 *   describes `sections` but has no field for the list-opening button's own
 *   label, which WhatsApp's list-message format requires. Adding it as an
 *   optional trailing parameter with a sane default keeps every existing
 *   3-argument call working unchanged. Flagging this loudly per the sprint
 *   plan's "flag it, don't silently follow" rule for anything that touches
 *   an interface contract.
 */
export async function sendList(
  to: string,
  body: string,
  sections: ListSection[],
  buttonText: string = 'Select'
): SendMessageResult {
  if (typeof to !== 'string' || !to.trim()) {
    throw new Error('sendList: "to" must be a non-empty string.');
  }
  if (typeof body !== 'string' || !body.trim()) {
    throw new Error('sendList: "body" must be a non-empty string.');
  }
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error('sendList: "sections" must be a non-empty array.');
  }
  if (typeof buttonText !== 'string' || !buttonText.trim()) {
    throw new Error('sendList: "buttonText" must be a non-empty string.');
  }
  // WhatsApp's own limit on the list message's button label.
  if (buttonText.length > 20) {
    throw new Error(
      `sendList: buttonText "${buttonText}" is ${buttonText.length} chars; ` +
        `WhatsApp limits the list button label to 20 chars.`
    );
  }

  const items: ListPickerItem[] = [];
  sections.forEach((section, si) => {
    if (!section || typeof section.title !== 'string' || !section.title.trim()) {
      throw new Error(`sendList: section at index ${si} is missing a valid "title".`);
    }
    if (!Array.isArray(section.rows) || section.rows.length === 0) {
      throw new Error(`sendList: section "${section.title}" is missing a non-empty "rows" array.`);
    }
    section.rows.forEach((row, ri) => {
      if (!row || typeof row.id !== 'string' || !row.id.trim()) {
        throw new Error(`sendList: row at section "${section.title}" index ${ri} is missing a valid "id".`);
      }
      if (typeof row.title !== 'string' || !row.title.trim()) {
        throw new Error(`sendList: row at section "${section.title}" index ${ri} is missing a valid "title".`);
      }
      // WhatsApp's own limit on list row titles.
      if (row.title.length > 24) {
        throw new Error(
          `sendList: row title "${row.title}" is ${row.title.length} chars; ` +
            `WhatsApp limits list row titles to 24 chars.`
        );
      }
      // WhatsApp's own limit on list row descriptions (not explicitly asked
      // for in the deliverable spec, but cheap to check and consistent with
      // "Twilio's own error messages for this are unhelpful").
      if (row.description && row.description.length > 72) {
        throw new Error(
          `sendList: row description for "${row.title}" is ${row.description.length} chars; ` +
            `WhatsApp limits list row descriptions to 72 chars.`
        );
      }
      items.push({ item: row.title, id: row.id, description: row.description });
    });
  });

  const client = getClient();
  const from = getWhatsappFrom();

  // --- Twilio mechanics note (READ BEFORE DEBUGGING A SEND FAILURE) --------
  // Same Content-API mechanism as sendButtons() above — see that comment for
  // why a raw JSON list message can't be sent directly.
  //
  // NOT VERIFIED LIVE, and less confident than sendButtons()'s shape: to the
  // best of available documentation, Twilio's `twilio/list-picker` Content
  // Type does NOT support grouping rows under named sections the way
  // WhatsApp's native Cloud API list message does — it takes one flat
  // `items` array. Section `title` values from the caller are validated
  // above (for interface fidelity with the frozen §3.1 contract) but are
  // NOT sent to Twilio — all rows from all sections are flattened into one
  // list. If real multi-section grouping turns out to matter (Sprint 1's own
  // usage — the language selector — only ever needs one section, so this is
  // unlikely to bite immediately), this needs re-checking against Twilio's
  // current docs at https://www.twilio.com/docs/content/list-picker before
  // relying on it. This is the second-highest-risk area of this file after
  // sendButtons()'s Content API shape.
  const content: ContentInstance = await client.content.v1.contents.create({
    friendly_name: `vimbiso_list_picker_${Date.now()}`,
    language: 'en',
    types: {
      'twilio/list-picker': {
        body,
        button: buttonText,
        items,
      },
    },
  });

  const result = await client.messages.create({
    from,
    to: toWhatsappAddress(to),
    contentSid: content.sid,
  });

  void logMessage({
    direction: 'outbound',
    channel: 'whatsapp',
    rawNumber: to,
    messageType: 'sent_list',
    buttonId: null,
    body,
  });

  return result;
}

// ---------------------------------------------------------------------------
// verifyWebhookSignature
// ---------------------------------------------------------------------------

/**
 * Validates the X-Twilio-Signature header on an incoming Express request
 * using Twilio's official signature-validation helper.
 */
export function verifyWebhookSignature(req: Request): boolean {
  const authToken = requireEnv('TWILIO_AUTH_TOKEN');

  // TS CONVERSION FIX (strict-mode-surfaced latent bug): Express/Node types
  // this header as `string | string[] | undefined` (a client could in theory
  // send the header twice). The original JS's `if (!signature) return false`
  // only ruled out the falsy cases (undefined/empty string) — a non-empty
  // ARRAY is truthy and would have silently sailed past that check and into
  // twilio.validateRequest(), which expects a single string signature. Under
  // strict mode this is a real compile error (string | string[] is not
  // assignable to the string parameter), and it's not just a type-checker
  // technicality — passing an array through unchanged would also have been
  // wrong at runtime. Fixed by taking the first value when Node parsed
  // multiple; behavior for the normal single-header case is unchanged.
  const rawSignature = req.headers['x-twilio-signature'];
  const signature = Array.isArray(rawSignature) ? rawSignature[0] : rawSignature;
  if (!signature) {
    return false;
  }

  // Twilio signs the exact URL it POSTed to, including protocol and host.
  // Behind ngrok (or any reverse proxy) the request Express sees is usually
  // plain http on localhost, so we prefer X-Forwarded-* headers (what the
  // proxy tells us the original request looked like) and fall back to
  // Express's own req.protocol/req.get('host'). For this to be correct in
  // practice, whatever process boots the Express app should call
  // `app.set('trust proxy', true)` — noted in docs/twilio-setup.md since
  // that line lives in server/index.ts, which is outside this file's
  // ownership.
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const url = `${protocol}://${host}${req.originalUrl}`;

  // req.body must already be the parsed application/x-www-form-urlencoded
  // fields Twilio sent (webhook.ts's router applies express.urlencoded()
  // before this is called). Express types req.body as `any` by default (no
  // body-parser type augmentation is in play here), so this passes through
  // to twilio.validateRequest without a cast.
  return twilio.validateRequest(authToken, signature, url, req.body || {});
}
