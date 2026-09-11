-- pattern_matches: added by PW-2 (Sprint 2). Not populated in Sprint 1, but
-- INF-2's AC requires every Section 2 table to exist after migrations run.
CREATE TABLE IF NOT EXISTS pattern_matches (
  id SERIAL PRIMARY KEY,
  hash_value TEXT NOT NULL,
  report_ids INTEGER[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'REVIEWED')),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMP
);
