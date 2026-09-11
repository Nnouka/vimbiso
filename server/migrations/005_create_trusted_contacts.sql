-- trusted_contacts: see HR-3 (Sprint 2). Keyed to survivor_whatsapp_number,
-- NOT report_id — must persist across a survivor's future reports.
CREATE TABLE IF NOT EXISTS trusted_contacts (
  id SERIAL PRIMARY KEY,
  survivor_whatsapp_number TEXT NOT NULL,
  contact_whatsapp_number TEXT NOT NULL,
  registered_at TIMESTAMP NOT NULL DEFAULT now(),
  alert_sent_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trusted_contacts_survivor
  ON trusted_contacts (survivor_whatsapp_number);
