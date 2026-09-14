// server/lib/sms.ts
//
// Networking-owned. Plain SMS sender for HR-2 (Sprint 2: real Twilio SMS
// alert to the on-call counsellor phone on a HIGH-risk report). Built now,
// alongside whatsapp.ts, since it's a trivial, isolated addition on the same
// Twilio SDK/credentials pattern and removes a Sprint 2 dependency on
// Networking.
//
// Credentials are read lazily (at call time) from:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM
// so this module can be imported before real Twilio credentials exist — it
// only throws when sendSms() is actually called. See docs/twilio-setup.md.
//
// This module is plain SMS only (client.messages.create with no `whatsapp:`
// prefix) — it does not use the Content API machinery in whatsapp.ts, since
// SMS has no interactive buttons/lists to construct.
//
// TS CONVERSION NOTE (this file was server/lib/sms.js in Sprint 1): behavior
// is unchanged from the JS version.

import twilio from 'twilio';

import { query } from './db';

// LOG-1 (docs/backlog.md): logs every outbound message for data analysis,
// sender-pseudonymized at rest. See server/lib/messageLog.ts for the full
// design. Fire-and-forget — logMessage() never throws (see its own header)
// and must never delay or block a real send.
import { logMessage } from './messageLog';

// See the equivalent, longer comment in whatsapp.ts for why this return type
// is derived structurally via ReturnType<> rather than importing a Twilio
// instance-type name directly: not verified against the installed @types in
// this environment (no node_modules — npm registry is blocked here). A human
// running `npm run typecheck` should confirm this resolves to
// Promise<MessageInstance> as expected.
type TwilioClient = ReturnType<typeof twilio>;
type SendSmsResult = ReturnType<TwilioClient['messages']['create']>;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `sms.ts: ${name} is not set. Copy .env.example to .env and fill in your ` +
        `Twilio credentials — see docs/twilio-setup.md.`
    );
  }
  return value;
}

function getClient(): TwilioClient {
  const accountSid = requireEnv('TWILIO_ACCOUNT_SID');
  const authToken = requireEnv('TWILIO_AUTH_TOKEN');
  return twilio(accountSid, authToken);
}

/**
 * Sends a plain SMS via Twilio.
 * @param to - destination phone number in E.164 format, e.g. "+2547XXXXXXXX"
 * @param body - message text
 */
export async function sendSms(to: string, body: string): SendSmsResult {
  if (typeof to !== 'string' || !to.trim()) {
    throw new Error('sendSms: "to" must be a non-empty string.');
  }
  if (typeof body !== 'string' || !body.trim()) {
    throw new Error('sendSms: "body" must be a non-empty string.');
  }

  const client = getClient();
  const from = requireEnv('TWILIO_SMS_FROM');

  const result = await client.messages.create({ from, to, body });

  // Logged here, the one chokepoint every SMS send passes through (both
  // alertOnCallCounsellor() and alertOnCallCounsellors() below call this
  // function) — the counsellor's own phone is pseudonymized at rest exactly
  // like a survivor's would be, and the body logged here is already
  // PII-free by HR-2's own safety-critical constraint (report_id/risk_level/
  // timestamp only — see alertOnCallCounsellor()'s comment below).
  void logMessage({
    direction: 'outbound',
    channel: 'sms',
    rawNumber: to,
    messageType: 'sent_sms',
    buttonId: null,
    body,
  });

  return result;
}

// ---------------------------------------------------------------------------
// alertOnCallCounsellor
// ---------------------------------------------------------------------------
//
// NOTE (Backend): this landed from Networking while Backend was mid-Sprint-2
// implementation, matching sprint-2-plan.md §3.2's frozen signature exactly
// — Backend's HR-1 wiring in conversation.ts calls this function as-is and
// did not need to add or change it. Documented here only so it's clear this
// wasn't Backend's addition, per CONTRIBUTING.md's "flag it, don't silently
// absorb" rule for anything crossing an ownership boundary.

/**
 * Sends the on-call counsellor SMS alert for HR-2, fired when a survivor
 * taps "Yes, connect me" after a HIGH-risk report. Frozen signature — see
 * docs/sprint-2-plan.md §3.2; do not rename or change it without flagging it
 * to the team.
 *
 * Reads `ONCALL_COUNSELLOR_PHONE` lazily via requireEnv(), same pattern as
 * `TWILIO_SMS_FROM` above, then delegates the actual send to sendSms() so
 * there is exactly one place in this file that talks to Twilio.
 *
 * !!! SAFETY-CRITICAL — READ BEFORE EDITING THE LINE BELOW !!!
 * Per HR-2's AC (docs/backlog.md), the SMS body built here is allowed to
 * contain ONLY report_id, risk_level, and a timestamp. It must NEVER
 * contain a survivor name, a survivor/WhatsApp phone number, region, or any
 * other identifying detail — this on-call phone is a plain SMS inbox with
 * no access controls, unlike the dashboard. Do not add another field to
 * `body` below, no matter how useful it seems (e.g. "for debugging"). If a
 * future story needs more context delivered to the counsellor, it belongs
 * behind an authenticated dashboard lookup by report_id, not in this SMS.
 */
export async function alertOnCallCounsellor(
  reportId: number,
  riskLevel: 'HIGH' | 'STANDARD'
): Promise<{ sid: string }> {
  const to = requireEnv('ONCALL_COUNSELLOR_PHONE');

  // ISO 8601 (UTC). Chosen over a locale-formatted string because it's
  // unambiguous regardless of the on-call counsellor's timezone and matches
  // how every other timestamp in this schema is stored (reports.created_at,
  // sms_alerts.sent_at, etc. — see docs/backlog.md Section 2).
  const timestamp = new Date().toISOString();

  const body = `Vimbiso alert: report #${reportId}, risk=${riskLevel}, ${timestamp}`;

  const result = await sendSms(to, body);
  return { sid: result.sid };
}

// ---------------------------------------------------------------------------
// alertOnCallCounsellors (plural) — HR-5
// ---------------------------------------------------------------------------
//
// Supersedes alertOnCallCounsellor() above as conversation.ts's HR-2 call
// site (see conversation.ts's handleConnectResponse), closing a real gap
// found during live Twilio testing: counsellor_users.phone_number_for_sms
// has existed since Sprint 1's schema but nothing ever read or wrote it —
// the SMS alert was hardcoded to a single ONCALL_COUNSELLOR_PHONE env var
// with no way for a counsellor to register their own number. See
// docs/backlog.md's HR-5 for the full story.
//
// alertOnCallCounsellor() (singular) is kept, unmodified and still exported,
// rather than deleted or changed — per CONTRIBUTING.md's "flag it, don't
// silently change a frozen contract" rule, since Sprint 2 froze its
// signature in docs/sprint-2-plan.md §3.2. It's simply no longer called from
// conversation.ts.

export interface CounsellorAlertResult {
  phone: string;
  sid: string | null;
  status: 'sent' | 'failed';
}

/**
 * Sends the on-call counsellor SMS alert for HR-2 to every counsellor who
 * has marked themselves on-call AND has a phone number on file
 * (counsellor_users.is_on_call = true AND phone_number_for_sms IS NOT NULL).
 *
 * Falls back to the single ONCALL_COUNSELLOR_PHONE env var (the original
 * Sprint 2 behavior) ONLY if zero counsellors are currently configured as
 * on-call — this keeps a fresh checkout / the demo seed working with zero
 * dashboard setup, while a real on-call counsellor who registers their own
 * number takes over from the env var automatically, with no code change.
 *
 * Never throws for an individual counsellor's send failure — each recipient
 * is attempted independently so one bad number doesn't suppress the alert
 * to everyone else on-call. The caller (conversation.ts) writes one
 * sms_alerts row per result, exactly as it already does for the singular
 * function, so a failed send to any one recipient stays visible for audit.
 *
 * !!! SAFETY-CRITICAL — see alertOnCallCounsellor()'s comment above; the
 * same "report_id/risk_level/timestamp only, never survivor PII" rule
 * applies to the body built here.
 */
export async function alertOnCallCounsellors(
  reportId: number,
  riskLevel: 'HIGH' | 'STANDARD'
): Promise<CounsellorAlertResult[]> {
  const timestamp = new Date().toISOString();
  const body = `Vimbiso alert: report #${reportId}, risk=${riskLevel}, ${timestamp}`;

  const { rows } = await query<{ phone_number_for_sms: string }>(
    `SELECT phone_number_for_sms FROM counsellor_users
     WHERE is_on_call = true AND phone_number_for_sms IS NOT NULL`
  );

  const recipients: string[] =
    rows.length > 0
      ? rows.map((r) => r.phone_number_for_sms)
      : [requireEnv('ONCALL_COUNSELLOR_PHONE')]; // fallback — see comment above

  const results: CounsellorAlertResult[] = [];
  for (const phone of recipients) {
    try {
      const result = await sendSms(phone, body);
      results.push({ phone, sid: result.sid, status: 'sent' });
    } catch (err) {
      console.error(`sms.ts: alertOnCallCounsellors failed to reach ${phone}:`, err);
      results.push({ phone, sid: null, status: 'failed' });
    }
  }
  return results;
}
