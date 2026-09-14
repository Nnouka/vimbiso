# Twilio WhatsApp Sandbox + SMS — Setup Guide

This is a step-by-step guide for a human to actually provision Twilio for
Vimbiso's local dev environment. It has **not** been run against a real
Twilio account by the agent that wrote it — no Twilio credentials exist in
this build environment. Everything Twilio-console-UI-specific below is
written from documented/training knowledge of Twilio's product, not from a
live walkthrough just now, and Twilio's console UI does change over time. If
a described click path doesn't match exactly what you see, look for a
similarly-named menu item nearby — the field names and overall flow (Sandbox
→ join code → webhook URL field) have been stable for a long time even when
Twilio reskins the console around them.

---

## 1. Create a Twilio account

1. Go to https://www.twilio.com/try-twilio and sign up (email + phone
   verification). Free trial accounts get trial credit, which is enough for
   Sandbox testing and a handful of test SMS/WhatsApp messages.
2. During signup, Twilio may ask "what are you building?" — any answer is
   fine, it doesn't gate features you need here.
3. Once signed in, you land on the **Twilio Console** dashboard
   (https://console.twilio.com).

## 2. Get your Account SID and Auth Token

1. On the Console dashboard homepage, look for the **Account Info** panel
   (usually near the top).
2. Copy **Account SID** — starts with `AC...`.
3. Copy **Auth Token** — hidden by default, click **Show** to reveal it.
4. Paste both into your local `.env` file (copied from `.env.example`):
   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   ```
   Treat the Auth Token like a password. Never commit it — `.env` is already
   in `.gitignore`.

## 3. Find the WhatsApp Sandbox and get the join code

1. In the Console left sidebar, navigate to **Messaging**.
2. Look for **Try it out** → **Send a WhatsApp message** (Twilio has moved
   this around the console over the years — if you don't see it under
   Messaging, search the Console's top search bar for "WhatsApp sandbox" or
   "Try WhatsApp"; it will get you to the same sandbox page).
3. This page shows:
   - A **sandbox phone number** (a shared Twilio number, commonly
     `+1 415 523 8886`, though Twilio may assign differently).
   - A **join code** — a phrase like `join <two-random-words>`.
4. Copy the sandbox number into `.env`:
   ```
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
   ```
   (use the actual number shown on your sandbox page, keep the `whatsapp:`
   prefix — the code in `server/lib/whatsapp.js` adds it automatically if you
   forget, but it's clearer to include it here).

## 4. Join the sandbox from a personal WhatsApp number

1. On a phone with WhatsApp installed, open a chat with the sandbox number
   from step 3.
2. Send the exact join code shown in the console, e.g. `join happy-tiger`.
3. Twilio replies confirming you're connected to the sandbox. This links
   *that one WhatsApp number* to your sandbox for a rolling window (Twilio's
   sandbox sessions expire after a period of inactivity — if messages stop
   getting a response after a few days of not using it, rejoin with the same
   code).
4. Every person who wants to test the bot (teammates, demo phones) needs to
   send this same join code from their own WhatsApp number first — the
   sandbox only talks to numbers that have joined.

## 5. Expose your local server with ngrok (or similar)

Twilio needs a **public** HTTPS URL to send webhooks to — it cannot reach
`localhost:3000` directly. For local development, use a tunnel:

1. Install ngrok: https://ngrok.com/download (or `brew install ngrok` on
   macOS, or your package manager of choice).
2. Create a free ngrok account and follow their one-time
   `ngrok config add-authtoken <token>` step (shown on their dashboard after
   signup).
3. Start your local server first (`npm run dev`, per `package.json` — this
   assumes `server/index.js` exists and listens on `PORT` from `.env`; if it
   doesn't exist yet, coordinate with Backend, since that entry point isn't
   part of this file's ownership).
4. In a separate terminal, run:
   ```
   ngrok http 3000
   ```
   (replace `3000` with whatever `PORT` is set to in `.env`).
5. ngrok prints a **Forwarding** URL like:
   ```
   Forwarding   https://abcd-1234.ngrok-free.app -> http://localhost:3000
   ```
   Copy the `https://...ngrok-free.app` URL. This changes every time you
   restart ngrok on a free plan — you'll need to re-paste it into the Twilio
   console (step 6) each time it changes.
6. ngrok also runs a local web inspector at http://127.0.0.1:4040 while it's
   running — open that in a browser to see every request Twilio sends,
   including the raw POST body. This is the fastest way to check the actual
   field names Twilio sends (see the "not verified live" notes in
   `server/routes/webhook.js`) once you have real credentials.

## 6. Paste the webhook URL into the Twilio console

1. Back on the **WhatsApp Sandbox** page from step 3, scroll to the section
   titled **Sandbox Configuration** (sometimes labeled "When a message
   comes in").
2. There is a field labeled **"WHEN A MESSAGE COMES IN"** — paste your
   ngrok URL followed by the webhook path this repo uses:
   ```
   https://abcd-1234.ngrok-free.app/webhook/whatsapp
   https://palatable-plenty-mossy.ngrok-free.dev/webhook/whatsapp
   ```
3. Make sure the method dropdown next to that field is set to **HTTP POST**
   (Twilio's WhatsApp webhook is a POST; the route in
   `server/routes/webhook.js` only handles `POST /webhook/whatsapp`, not GET
   — see that file's comments for why no GET handler is needed for Twilio).
4. There is a second, similar field lower on the page for a **status
   callback URL** — you can leave that blank for Sprint 1; it's for delivery
   receipts, not incoming messages.
5. Click **Save** at the bottom of the page.
6. Send a WhatsApp message to the sandbox number from your joined phone —
   it should hit your local server within a second or two (visible in your
   server's console logs and in the ngrok inspector).

## 7. A note on signature verification behind ngrok

`verifyWebhookSignature()` in `server/lib/whatsapp.js` reconstructs the exact
URL Twilio signed and compares it against the `X-Twilio-Signature` header.
Behind ngrok (or any reverse proxy), Express's own `req.protocol` typically
reports `http` even though the *actual* request Twilio made was `https` —
this makes the reconstructed URL wrong and signature verification silently
fails. Two things need to be true for this to work correctly:

1. Whoever writes `server/index.js` (outside this file's ownership) should
   call `app.set('trust proxy', true)` so Express respects `X-Forwarded-*`
   headers.
2. `whatsapp.js`'s `verifyWebhookSignature()` already prefers
   `X-Forwarded-Proto`/`X-Forwarded-Host` over `req.protocol`/`req.get('host')`
   for this reason — but this has not been tested against a real ngrok
   tunnel + real Twilio signature, since no credentials exist in the
   environment this was built in. If signature verification rejects every
   request once you have real credentials, this URL-reconstruction mismatch
   is the first thing to check (print the reconstructed URL and compare it
   character-for-character against what ngrok's inspector shows as the
   request's actual URL).

## 8. SMS sender number (for HR-2, Sprint 2)

The Twilio Sandbox WhatsApp number cannot send plain SMS. For
`server/lib/sms.js` (`sendSms`), you need a separate Twilio phone number that
supports SMS:

1. In the Console, go to **Phone Numbers** → **Manage** → **Active Numbers**.
2. A trial account is typically given one free trial phone number
   automatically; if not, click **Buy a number** and pick any number with SMS
   capability (trial accounts can usually get one at no cost, within trial
   limits — check the price shown before confirming).
3. Copy that number (E.164 format, e.g. `+15551234567`, **no** `whatsapp:`
   prefix) into `.env`:
   ```
   TWILIO_SMS_FROM=+15551234567
   ```
4. Trial accounts can only send SMS to phone numbers that have been
   **verified** in the Console (**Phone Numbers** → **Manage** →
   **Verified Caller IDs**) until you upgrade out of trial. Verify the
   on-call demo counsellor's phone this way before relying on HR-2's real SMS
   alert for a demo.

---

## What's confirmed vs. what still needs you

**Confirmed by the agent that wrote `server/lib/whatsapp.js` / `sms.js` /
`webhook.js`:** the code matches Twilio's documented Node SDK API surface
(`client.messages.create`, `client.content.v1.contents.create`,
`twilio.validateRequest`) as of that agent's training knowledge, and the
webhook field names (`From`, `Body`, `ButtonPayload`) match Twilio's
documented WhatsApp inbound webhook parameters.

**Not verified, and needs a human with real credentials to check, in this
order:**
1. That `sendButtons`/`sendList`'s Content API JSON shape
   (`types["twilio/quick-reply"]` / `types["twilio/list-picker"]`) is
   accepted by a live send — this is the single riskiest piece of code in
   this deliverable, flagged in detail in `server/lib/whatsapp.js`'s comments.
2. That `ButtonPayload` is really the field Twilio sends for both a
   quick-reply tap and a list-row tap (as opposed to two different field
   names) — check via ngrok's inspector against a real tap.
3. That signature verification actually passes end-to-end through an ngrok
   tunnel (see §7 above).
4. The exact current Twilio console menu labels/paths in this document —
   confirm they match what you actually see; Twilio reskins its console
   periodically.
