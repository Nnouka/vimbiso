// server/lib/whatsapp.js
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
// Credentials are read lazily (at call time, not at require() time) from:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
// so this module can be safely required in a dev environment before real
// Twilio credentials exist — it only throws when a function that actually
// needs a given credential is called. See docs/twilio-setup.md for how to
// obtain these.

const twilio = require('twilio');

// ---------------------------------------------------------------------------
// Internal helpers (not exported — keeps module.exports exactly matching the
// frozen §3.1 contract).
// ---------------------------------------------------------------------------

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `whatsapp.js: ${name} is not set. Copy .env.example to .env and fill in ` +
        `your Twilio credentials — see docs/twilio-setup.md.`
    );
  }
  return value;
}

function getClient() {
  const accountSid = requireEnv('TWILIO_ACCOUNT_SID');
  const authToken = requireEnv('TWILIO_AUTH_TOKEN');
  return twilio(accountSid, authToken);
}

function getWhatsappFrom() {
  const from = requireEnv('TWILIO_WHATSAPP_FROM');
  return toWhatsappAddress(from);
}

function toWhatsappAddress(number) {
  return number.startsWith('whatsapp:') ? number : `whatsapp:${number}`;
}

// ---------------------------------------------------------------------------
// sendText
// ---------------------------------------------------------------------------

/**
 * Sends a plain WhatsApp text message via Twilio.
 * Resolves when Twilio accepts the send (does not wait for delivery).
 * @param {string} to - destination number, e.g. "whatsapp:+2547XXXXXXXX" or "+2547XXXXXXXX"
 * @param {string} body - message text
 */
async function sendText(to, body) {
  if (typeof to !== 'string' || !to.trim()) {
    throw new Error('sendText: "to" must be a non-empty string.');
  }
  if (typeof body !== 'string' || !body.trim()) {
    throw new Error('sendText: "body" must be a non-empty string.');
  }

  const client = getClient();
  const from = getWhatsappFrom();

  return client.messages.create({
    from,
    to: toWhatsappAddress(to),
    body,
  });
}

// ---------------------------------------------------------------------------
// sendButtons
// ---------------------------------------------------------------------------

/**
 * Sends an interactive WhatsApp Quick Reply message (max 3 buttons).
 * @param {string} to
 * @param {string} body
 * @param {{id: string, title: string}[]} buttons - max 3, title <= 20 chars
 */
async function sendButtons(to, body, buttons) {
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
  // single highest-risk part of this file to double check first.
  const content = await client.content.v1.contents.create({
    friendly_name: `vimbiso_quick_reply_${Date.now()}`,
    language: 'en',
    types: {
      'twilio/quick-reply': {
        body,
        actions: buttons.map((b) => ({ id: b.id, title: b.title })),
      },
    },
  });

  return client.messages.create({
    from,
    to: toWhatsappAddress(to),
    contentSid: content.sid,
  });
}

// ---------------------------------------------------------------------------
// sendList
// ---------------------------------------------------------------------------

/**
 * Sends an interactive WhatsApp List Message.
 * @param {string} to
 * @param {string} body
 * @param {{title: string, rows: {id: string, title: string, description?: string}[]}[]} sections
 * @param {string} [buttonText='Select'] - the label of the button that opens
 *   the list (WhatsApp limit: 20 chars). This is an ADDITIVE optional 4th
 *   parameter, not part of the original §3.1 signature — the frozen contract
 *   describes `sections` but has no field for the list-opening button's own
 *   label, which WhatsApp's list-message format requires. Adding it as an
 *   optional trailing parameter with a sane default keeps every existing
 *   3-argument call working unchanged. Flagging this loudly per the sprint
 *   plan's "flag it, don't silently follow" rule for anything that touches
 *   an interface contract.
 */
async function sendList(to, body, sections, buttonText = 'Select') {
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

  const items = [];
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
  const content = await client.content.v1.contents.create({
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

  return client.messages.create({
    from,
    to: toWhatsappAddress(to),
    contentSid: content.sid,
  });
}

// ---------------------------------------------------------------------------
// verifyWebhookSignature
// ---------------------------------------------------------------------------

/**
 * Validates the X-Twilio-Signature header on an incoming Express request
 * using Twilio's official signature-validation helper.
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function verifyWebhookSignature(req) {
  const authToken = requireEnv('TWILIO_AUTH_TOKEN');

  const signature = req.headers['x-twilio-signature'];
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
  // that line lives in server/index.js, which is outside this file's
  // ownership.
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const url = `${protocol}://${host}${req.originalUrl}`;

  // req.body must already be the parsed application/x-www-form-urlencoded
  // fields Twilio sent (webhook.js's router applies express.urlencoded()
  // before this is called).
  return twilio.validateRequest(authToken, signature, url, req.body || {});
}

module.exports = { sendText, sendButtons, sendList, verifyWebhookSignature };
