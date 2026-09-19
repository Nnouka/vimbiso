// dashboard/lib/whatsapp.ts
//
// DASH-5: minimal outbound-WhatsApp sender for the counsellor dashboard's
// own reply-in-channel feature (see server.ts's POST /dashboard/reports/:id/reply
// and docs/backlog.md's DASH-5).
//
// This is a SEPARATE, deliberately smaller Twilio client from
// server/lib/whatsapp.ts, for the same reason dashboard/lib/db.ts has its
// own connection pool instead of importing server/lib/db.ts (see that
// file's header comment): the dashboard is a standalone package — its own
// package.json, its own tsconfig, its own running process — and does not
// import from server/** across the package boundary. It reads the SAME
// Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
// TWILIO_WHATSAPP_FROM — copied into dashboard/.env, see .env.example) and
// talks to the SAME Twilio WhatsApp sender number as server/lib/whatsapp.ts,
// so a reply sent from here lands in the exact same WhatsApp thread the
// survivor already has with the bot.
//
// Only a plain-text send is implemented — a counsellor's follow-up is free
// text, not an interactive button/list flow, so this deliberately does not
// duplicate whatsapp.ts's Content-API machinery for sendButtons/sendList.
//
// NOT wired into server/lib/messageLog.ts's anonymized message_log — that
// table's pseudonymization/encryption keys (MESSAGE_LOG_HASH_SECRET,
// MESSAGE_LOG_ENCRYPTION_KEY, SENDER_IDENTITY_RECOVERY_KEY) are not part of
// the dashboard's own .env and messageLog.ts lives under server/**, outside
// this package. A counsellor's outbound replies are instead recorded in
// their own attributable `counsellor_messages` table (013 migration) — see
// that migration's header for why this is the right table for this case
// rather than overloading message_log's anonymized posture. Flagging this
// as a known gap rather than silently working around it: if a future story
// wants counsellor replies folded into the same cross-cutting analysis
// surface as bot messages, that needs a real decision about exposing (or
// duplicating) those three secrets to the dashboard process, not a quiet
// import.

import twilio from 'twilio';

type TwilioClient = ReturnType<typeof twilio>;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `dashboard/lib/whatsapp.ts: ${name} is not set. Copy .env.example to .env and fill in ` +
        `your Twilio credentials (same account as the bot backend).`
    );
  }
  return value;
}

function getClient(): TwilioClient {
  const accountSid = requireEnv('TWILIO_ACCOUNT_SID');
  const authToken = requireEnv('TWILIO_AUTH_TOKEN');
  return twilio(accountSid, authToken);
}

function toWhatsappAddress(number: string): string {
  return number.startsWith('whatsapp:') ? number : `whatsapp:${number}`;
}

/**
 * Sends a plain WhatsApp text message via Twilio, from the same sender
 * number the bot backend uses, so it lands on the survivor's existing
 * thread. Resolves when Twilio accepts the send (does not wait for
 * delivery). Throws on failure — callers (server.ts) are responsible for
 * catching this and recording status='failed' rather than silently losing
 * the error, since this is a real, attributable counsellor action.
 */
// Declared as a concrete Promise<{sid}> rather than deriving the type off
// twilio's own overloaded messages.create() via ReturnType<> (the pattern
// server/lib/whatsapp.ts uses) — that pattern is exactly what THIS file's
// header/server/lib/whatsapp.ts's own comments warn is fragile across twilio
// SDK versions (ReturnType<> on an overloaded function can pick a non-Promise
// overload), and it did in fact fail `tsc` here even pinned to the same
// twilio version root uses. Only `.sid` is ever used by this file's caller,
// so returning a small concrete shape sidesteps the whole issue.
export async function sendWhatsappText(to: string, body: string): Promise<{ sid: string }> {
  if (typeof to !== 'string' || !to.trim()) {
    throw new Error('sendWhatsappText: "to" must be a non-empty string.');
  }
  if (typeof body !== 'string' || !body.trim()) {
    throw new Error('sendWhatsappText: "body" must be a non-empty string.');
  }

  const client = getClient();
  const from = toWhatsappAddress(requireEnv('TWILIO_WHATSAPP_FROM'));

  const result = await client.messages.create({
    from,
    to: toWhatsappAddress(to),
    body,
  });

  return { sid: result.sid };
}
