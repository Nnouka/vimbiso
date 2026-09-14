-- 012_create_message_log.sql
--
-- LOG-1/LOG-3 (docs/backlog.md). Adds a parallel, analysis-only audit trail
-- of every WhatsApp/SMS message vimbiso sends or receives, for data
-- analysis, WITHOUT identifying who anyone is by default — plus a
-- deliberately separate, harder-to-reach mechanism for lawful
-- re-identification when privacy protections are properly lifted (a court
-- order, a government request, or a survivor's own request for their own
-- data). See server/lib/messageLog.ts for the full design rationale.
--
-- Three tables, three different privacy postures:
--
--   message_log          — high-volume, one row per message. sender_pseudonym
--                           is a true one-way HMAC-SHA256 hash: no key this
--                           application holds can ever turn it back into a
--                           phone number. This is the table normal analysis
--                           queries run against.
--
--   sender_identity_map   — low-volume, ONE row per unique real sender (not
--                           per message, to keep the reversible-PII surface
--                           as small as possible). Holds the real number
--                           REVERSIBLY encrypted under a key
--                           (SENDER_IDENTITY_RECOVERY_KEY) that is NOT part
--                           of this application's normal runtime
--                           configuration — see docs/backlog.md's LOG-3 for
--                           the key-custody requirement. No code path in the
--                           running application ever decrypts this table;
--                           only the standalone, manually-run
--                           server/scripts/recoverSenderIdentity.ts does.
--
--   identity_recovery_log — append-only. One row per actual use of the
--                           recovery script above. Re-identifying a survivor
--                           must never be silent, even when it's lawfully
--                           justified.
--
-- This migration does NOT touch reports/conversation_state/counsellor_users
-- — those must keep real phone numbers to keep the product's own alerting
-- and session-resume behavior working; this is a separate, parallel surface.

CREATE TABLE IF NOT EXISTS message_log (
  id SERIAL PRIMARY KEY,
  occurred_at TIMESTAMP NOT NULL DEFAULT now(),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms')),
  sender_pseudonym TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (
    message_type IN (
      'text', 'button_reply', 'list_reply',
      'sent_text', 'sent_buttons', 'sent_list', 'sent_sms'
    )
  ),
  button_id TEXT,
  body_ciphertext BYTEA,
  body_iv BYTEA,
  body_auth_tag BYTEA,
  report_id INTEGER REFERENCES reports (id)
);

CREATE INDEX IF NOT EXISTS idx_message_log_sender_pseudonym ON message_log (sender_pseudonym);
CREATE INDEX IF NOT EXISTS idx_message_log_report_id ON message_log (report_id);

CREATE TABLE IF NOT EXISTS sender_identity_map (
  sender_pseudonym TEXT PRIMARY KEY,
  encrypted_real_number BYTEA NOT NULL,
  iv BYTEA NOT NULL,
  auth_tag BYTEA NOT NULL,
  first_seen_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS identity_recovery_log (
  id SERIAL PRIMARY KEY,
  sender_pseudonym TEXT NOT NULL,
  recovered_by TEXT NOT NULL,
  recovered_at TIMESTAMP NOT NULL DEFAULT now(),
  legal_basis TEXT NOT NULL,
  case_reference TEXT
);
