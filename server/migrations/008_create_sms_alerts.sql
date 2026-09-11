-- sms_alerts: added by HR-2 (Sprint 2). One row per real Twilio SMS sent to
-- the on-call counsellor. Never holds a survivor name/number in its own
-- fields beyond delivery bookkeeping.
CREATE TABLE IF NOT EXISTS sms_alerts (
  id SERIAL PRIMARY KEY,
  report_id INTEGER REFERENCES reports (id),
  sent_to TEXT,
  sent_at TIMESTAMP,
  twilio_sid TEXT,
  status TEXT
);

CREATE INDEX IF NOT EXISTS idx_sms_alerts_report_id ON sms_alerts (report_id);
