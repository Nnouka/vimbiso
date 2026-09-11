-- reports: core entity, one row per triage/report session.
-- Deliberately has NO name/legal_name/id_number column (SEC-2 — enforced by
-- this table's shape, not application code).
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  channel TEXT,
  language TEXT,
  risk_level TEXT CHECK (risk_level IN ('STANDARD', 'HIGH')),
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS'
    CHECK (status IN ('IN_PROGRESS', 'SCORED', 'CLOSED')),
  whatsapp_number TEXT NOT NULL,
  region TEXT,
  wants_counsellor_connect BOOLEAN NOT NULL DEFAULT false,
  connect_requested_at TIMESTAMP,
  perpetrator_consent_given BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_reports_whatsapp_number ON reports (whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_reports_risk_level ON reports (risk_level);
