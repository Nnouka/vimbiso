-- content_strings: added by LANG-1 (Sprint 1). Keyed by (key, language).
-- t(key, language) in server/lib/content.js reads from here.
CREATE TABLE IF NOT EXISTS content_strings (
  key TEXT NOT NULL,
  language TEXT NOT NULL,
  text TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'FULL'
    CHECK (tier IN ('FULL', 'PARTIAL', 'ARCHITECTURE_ONLY')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  PRIMARY KEY (key, language)
);
