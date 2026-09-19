-- 013_create_counsellor_messages.sql
--
-- DASH-5 (docs/backlog.md): lets a counsellor send a follow-up WhatsApp
-- message to a survivor from the report detail view, on the same thread the
-- survivor already used, instead of switching to a phone.
--
-- Deliberately NOT the shared message_log table (012_create_message_log.sql)
-- — that table is Networking-owned, pseudonymizes the recipient, and exists
-- for anonymized cross-cutting analysis; a counsellor's own outbound replies
-- are the opposite case (an authenticated, attributable, case-management
-- action a counsellor needs to see attached to a specific report_id and see
-- WHO on their team sent it). Kept here, in the dashboard's own migration
-- lineage, rather than overloading message_log's schema/privacy posture.
--
-- sent_by references counsellor_users so DASH-4's transcript can show which
-- counsellor sent a given follow-up. ON DELETE SET NULL rather than CASCADE
-- so a deleted/deactivated counsellor account doesn't erase the historical
-- record of what was actually sent to a survivor.
CREATE TABLE IF NOT EXISTS counsellor_messages (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports (id),
  sent_by INTEGER REFERENCES counsellor_users (id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMP NOT NULL DEFAULT now(),
  twilio_sid TEXT,
  status TEXT
);

CREATE INDEX IF NOT EXISTS idx_counsellor_messages_report_id ON counsellor_messages (report_id);
