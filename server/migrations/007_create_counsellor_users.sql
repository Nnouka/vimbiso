-- counsellor_users: dashboard auth (DASH-1, Sprint 2). password_hash is
-- bcrypt, per the root package.json's bcrypt dependency. "name" here is the
-- counsellor/staff member's own name (a legitimate field per Section 2) --
-- distinct from SEC-2's ban on a survivor legal-name field on `reports`.
CREATE TABLE IF NOT EXISTS counsellor_users (
  id SERIAL PRIMARY KEY,
  name TEXT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone_number_for_sms TEXT,
  role TEXT CHECK (role IN ('counsellor', 'institutional_reviewer', 'admin'))
);
