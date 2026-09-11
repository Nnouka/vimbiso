-- triage_answers: one row per answered triage question, tied to a report.
CREATE TABLE IF NOT EXISTS triage_answers (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports (id),
  question_key TEXT NOT NULL,
  answer TEXT NOT NULL CHECK (answer IN ('YES', 'NO', 'SKIP')),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_triage_answers_report_id ON triage_answers (report_id);
