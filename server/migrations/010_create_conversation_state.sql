-- conversation_state: added by INF-3 (Sprint 1). One row per active
-- conversation, keyed by the WhatsApp number itself (not per report).
-- disclosure_shown gates SEC-3's one-time transit-privacy message and is
-- deliberately NOT reset by the 24h session-reset logic in conversation.js
-- (per docs/conversation-design.md §1.1 — "conversation" for this one flag
-- means "this WhatsApp number," permanently).
CREATE TABLE IF NOT EXISTS conversation_state (
  whatsapp_number TEXT PRIMARY KEY,
  current_step TEXT,
  language TEXT,
  temp_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  disclosure_shown BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
