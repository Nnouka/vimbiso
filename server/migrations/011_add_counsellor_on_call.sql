-- 011_add_counsellor_on_call.sql
--
-- Closes a real gap found during live Twilio testing: counsellor_users had a
-- phone_number_for_sms column since Sprint 1 (007_create_counsellor_users.sql)
-- but nothing anywhere ever read or wrote it — HR-2's SMS alert was hardcoded
-- to a single ONCALL_COUNSELLOR_PHONE env var, so there was literally no way
-- for a counsellor to register their own number. See docs/backlog.md's HR-5.
--
-- is_on_call is a separate flag from "has a phone number on file" so a
-- counsellor can save their number once and toggle availability without
-- re-entering it — a counsellor with a number but is_on_call=false is not
-- alerted, matching real on-call-rotation behavior.

ALTER TABLE counsellor_users
  ADD COLUMN is_on_call BOOLEAN NOT NULL DEFAULT false;
