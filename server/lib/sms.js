// server/lib/sms.js
//
// Networking-owned. Plain SMS sender for HR-2 (Sprint 2: real Twilio SMS
// alert to the on-call counsellor phone on a HIGH-risk report). Built now,
// alongside whatsapp.js, since it's a trivial, isolated addition on the same
// Twilio SDK/credentials pattern and removes a Sprint 2 dependency on
// Networking.
//
// Credentials are read lazily (at call time) from:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM
// so this module can be required before real Twilio credentials exist — it
// only throws when sendSms() is actually called. See docs/twilio-setup.md.
//
// This module is plain SMS only (client.messages.create with no `whatsapp:`
// prefix) — it does not use the Content API machinery in whatsapp.js, since
// SMS has no interactive buttons/lists to construct.

const twilio = require('twilio');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `sms.js: ${name} is not set. Copy .env.example to .env and fill in your ` +
        `Twilio credentials — see docs/twilio-setup.md.`
    );
  }
  return value;
}

function getClient() {
  const accountSid = requireEnv('TWILIO_ACCOUNT_SID');
  const authToken = requireEnv('TWILIO_AUTH_TOKEN');
  return twilio(accountSid, authToken);
}

/**
 * Sends a plain SMS via Twilio.
 * @param {string} to - destination phone number in E.164 format, e.g. "+2547XXXXXXXX"
 * @param {string} body - message text
 */
async function sendSms(to, body) {
  if (typeof to !== 'string' || !to.trim()) {
    throw new Error('sendSms: "to" must be a non-empty string.');
  }
  if (typeof body !== 'string' || !body.trim()) {
    throw new Error('sendSms: "body" must be a non-empty string.');
  }

  const client = getClient();
  const from = requireEnv('TWILIO_SMS_FROM');

  return client.messages.create({ from, to, body });
}

module.exports = { sendSms };
