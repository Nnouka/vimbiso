-- perpetrator_hashes: written only on explicit survivor consent (PW-1,
-- Sprint 2). Holds ONLY hash_value (SEC-1's HMAC-SHA256 output) — never raw
-- perpetrator text.
CREATE TABLE IF NOT EXISTS perpetrator_hashes (
  id SERIAL PRIMARY KEY,
  report_id INTEGER REFERENCES reports (id),
  hash_value TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'HMAC-SHA256',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perpetrator_hashes_hash_value ON perpetrator_hashes (hash_value);
