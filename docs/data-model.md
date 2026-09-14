# Vimbiso — Data Model Reference

Extracted verbatim (no fields added, removed, or renamed) from
[`docs/backlog.md`](./backlog.md), Section 2 — "Data Model Reference (source of
truth — extend here, not inline per story)". This file is a clean, standalone
reference for whoever implements INF-2 (Postgres schema + migrations); the
annotations below are explanatory only. **`backlog.md` Section 2 remains the
source of truth** — if this file and `backlog.md` ever disagree, `backlog.md`
wins and this file needs to be re-synced.

Story reference: **INF-2 — Postgres schema + migrations** (Must). DoD: `npm run
migrate` runs clean on a fresh DB; schema matches `backlog.md` Section 2 exactly.

---

## Tables

### `reports`

```
reports (
  id, created_at, channel, language, risk_level ['STANDARD'|'HIGH'|null],
  status ['IN_PROGRESS'|'SCORED'|'CLOSED'], whatsapp_number,
  region, wants_counsellor_connect boolean default false,
  connect_requested_at timestamp null,
  perpetrator_consent_given boolean default false
)
```

The core entity: one row per triage/report session. `risk_level` starts `null`
and is set by TRI-3 once scoring runs (Sprint 1). `status` starts
`IN_PROGRESS` at the start of TRI-1's flow, becomes `SCORED` when TRI-3 fires,
and later `CLOSED` (Sprint 2+ lifecycle). Deliberately has **no** `name`,
`legal_name`, or `id_number` column — that's SEC-2's contract, enforced by this
table's shape, not by application code. `wants_counsellor_connect`,
`connect_requested_at`, and `perpetrator_consent_given` all default to
false/null and are only ever flipped by an explicit user action later in the
flow (HR-2 and PW-1 respectively, both Sprint 2) — Sprint 1 just needs the
columns to exist with the correct defaults (SEC-2's Sprint 1 scope).

### `triage_answers`

```
triage_answers (id, report_id FK, question_key, answer ['YES'|'NO'|'SKIP'], created_at)
```

One row per answered triage question. `report_id` FKs to `reports.id`.
`question_key` is one of the 8 keys in `docs/backlog.md` Section 3 (`STRANGLE`,
`WEAPON`, `KILL_THREAT`, `ESCALATION`, `SEPARATION`, `SEXUAL_COERCION`,
`CONTROL`, `SELF_PERCEIVED_DANGER`). "Prefer not to say" (TRI-1) is stored here
as `SKIP`, and `SKIP` counts as `NO` for scoring purposes (TRI-2) — that
conversion happens in `scoreRisk()`, not by rewriting the stored answer.

### `perpetrator_hashes`

```
perpetrator_hashes (id, report_id FK, hash_value, algorithm, created_at)
```

Written only when a survivor consents (PW-1, Sprint 2) and only ever holds
`hash_value` — the HMAC-SHA256 output of SEC-1's `normalizeAndHash()` — never
raw perpetrator text. If no perpetrator text is supplied, no row is created
here at all (SEC-1's AC).

### `pattern_matches` — added by PW-2 (Sprint 2)

```
pattern_matches (id, hash_value, report_ids integer[], status ['NEW'|'REVIEWED'], created_at, reviewed_by, reviewed_at)
```

Links independent reports whose `perpetrator_hashes.hash_value` matches. Not
in Sprint 1 scope to populate, but the table exists from INF-2's migrations
since INF-2 must create every table in Section 2 up front.

### `trusted_contacts` — see HR-3 (Sprint 2)

```
trusted_contacts (id, survivor_whatsapp_number, contact_whatsapp_number, registered_at, alert_sent_at null)
```

Keyed to `survivor_whatsapp_number`, **not** `report_id` — it must persist
across a survivor's future reports, not be scoped to a single one.

### `resources`

```
resources (id, country, region, category, name, phone, address, hours, source_name, source_url, last_verified_date, language_support text[])
```

The sourced resource directory (DIR-1, Sprint 2). Every entry is expected to
carry non-null `name`, `phone`, `source_name`, `source_url`, `last_verified_date`.

### `counsellor_users`

```
counsellor_users (id, name, username, password_hash, phone_number_for_sms, is_on_call boolean default false, role ['counsellor'|'institutional_reviewer'|'admin'])
```

Dashboard auth (DASH-1, Sprint 2). `password_hash` is bcrypt per the root
`package.json`'s existing `bcrypt` dependency.

`is_on_call` — added by migration `011_add_counsellor_on_call.sql` (HR-5,
Sprint 3.5). `phone_number_for_sms` existed since Sprint 1 but nothing read
or wrote it until HR-5's dashboard settings page (`/dashboard/settings`)
let a counsellor set their own number and toggle `is_on_call`.
`server/lib/sms.ts`'s `alertOnCallCounsellors()` (plural) alerts every row
with `is_on_call = true AND phone_number_for_sms IS NOT NULL`, falling back
to the single `ONCALL_COUNSELLOR_PHONE` env var only when zero counsellors
are configured — so a fresh checkout with no dashboard setup still works.

### `sms_alerts` — added by HR-2 (Sprint 2)

```
sms_alerts (id, report_id FK, sent_to, sent_at, twilio_sid, status)
```

One row per real Twilio SMS sent to the on-call counsellor. Never contains a
survivor name or number in its own fields beyond what's needed for delivery
bookkeeping — the SMS body itself (per HR-2's AC) contains only `report_id`,
`risk_level`, and timestamp.

### `content_strings` — added by LANG-1 (Sprint 1)

```
content_strings (key, language, text, tier ['FULL'|'PARTIAL'|'ARCHITECTURE_ONLY'], reviewed_by null, reviewed_at null)
```

Keyed by `(key, language)`. `t(key, language)` (LANG-1, `server/lib/content.js`)
reads from here, falling back to the English row (logging a warning) if the
requested language/key combination is missing. `tier` tracks translation
maturity per language (`FULL` for English/Swahili/French, `PARTIAL` or
`ARCHITECTURE_ONLY` for the conditional languages) — Sprint 1 only needs
English (`LANG-2`) populated with `tier='FULL'`.

### `conversation_state` — added by INF-3 (Sprint 1)

```
conversation_state (whatsapp_number PK, current_step, language, temp_answers jsonb, disclosure_shown boolean, updated_at)
```

Primary key is the WhatsApp number itself — one row per active conversation,
not per report. `current_step` drives the state machine (INF-3/INF-4/TRI-1).
`temp_answers` (jsonb) can hold in-progress triage state before/alongside the
authoritative `triage_answers` rows, if the implementation needs a fast
in-flight buffer — but `triage_answers` remains the durable record any other
process (dashboard, later) reads. `disclosure_shown` gates SEC-3's one-time
transit-privacy message. `updated_at` is what the 24h session-reset check
(INF-3) compares against.

### `message_log` — added by LOG-1 (built and real-DB-verified 2026-09-15)

```
message_log (
  id, occurred_at timestamp, direction ['inbound'|'outbound'], channel ['whatsapp'|'sms'],
  sender_pseudonym, message_type ['text'|'button_reply'|'list_reply'|'sent_text'|'sent_buttons'|'sent_list'|'sent_sms'],
  button_id null, body_ciphertext bytea null, body_iv bytea null, body_auth_tag bytea null,
  report_id FK null
)
```

A parallel, analysis-only audit trail of every message vimbiso sends or
receives, added at Nnouka's request for data analysis — it does not replace
or anonymize `reports.whatsapp_number`/`conversation_state`, which must stay
real for the product's own alerts and session resume to keep working.
`sender_pseudonym` is `HMAC-SHA256(whatsapp_number, MESSAGE_LOG_HASH_SECRET)`
— a secret deliberately SEPARATE from `PERPETRATOR_HASH_SECRET` (SEC-1), so
recovering one hashed-identifier space never lets anyone correlate into the
other. It is stable per real number (so one sender's messages group together
for replay/analysis) but **irreversible by design** — no key this
application holds can turn a pseudonym back into a phone number; that is
deliberately a different, separate capability (see `sender_identity_map`
below), not a property of this column. `body_ciphertext`/`body_iv`/
`body_auth_tag` hold the message content under AES-256-GCM,
`MESSAGE_LOG_ENCRYPTION_KEY`, since survivor free-text is exactly the kind of
content this schema already refuses to store raw elsewhere (see SEC-1/SEC-2).
`report_id` is a nullable FK for analysis convenience only, never read by
operational sending logic. Wired at every real send/receive chokepoint
(`server/routes/webhook.ts` inbound; `server/lib/whatsapp.ts`'s
`sendText`/`sendButtons`/`sendList` and `server/lib/sms.ts`'s `sendSms`
outbound) and verified against a real Postgres database: a full HIGH-risk
survivor journey correctly logged every inbound message type, grouped
consistently under one pseudonym across inbound and outbound rows, and
`decryptMessageBody()` round-tripped the exact original plaintext — see
`backlog.md`'s LOG-1 status for the full evidence. **Open question, not yet
decided:** retention period — indefinite storage of even
pseudonymous/encrypted conversation data is a real tradeoff the team should
decide explicitly.

### `sender_identity_map` / `identity_recovery_log` — added by LOG-3 (built and real-DB-verified 2026-09-15)

```
sender_identity_map (sender_pseudonym PK, encrypted_real_number bytea, iv bytea, auth_tag bytea, first_seen_at)
identity_recovery_log (id, sender_pseudonym, recovered_by, recovered_at, legal_basis, case_reference)
```

Added at Nnouka's follow-up request: sender ids must be anonymous by
default, but a real phone number must still be lawfully recoverable — a
court order, a lawful government request, or the survivor's own request for
their own data — since a one-way hash like `sender_pseudonym` above can
never satisfy that by itself. `sender_identity_map` holds ONE row per unique
real sender (not per message, keeping the reversible-PII surface as small as
possible), with the real number encrypted under a THIRD secret,
`SENDER_IDENTITY_RECOVERY_KEY`, deliberately distinct from both other keys in
this schema. The privacy control here is key CUSTODY, not the algorithm:
this key must never live alongside the app's normal runtime secrets — it is
held out-of-band by a designated custodian, so no engineer with ordinary
production access can decrypt this table alone, and no normal application
code path ever does. `identity_recovery_log` is the append-only record of
every time the mapping was actually decrypted (who, when, on what legal
basis) — re-identifying a survivor must never be silent, even when it's
justified. **Open questions, not yet decided:** who the designated key
custodian is; what counts as a valid "lawful request"; where the recovery
key is actually stored (a sealed offline copy, a separate secrets manager,
or split across multiple custodians) — these remain real, undecided policy
questions even though the mechanism itself is built. The mechanism is
`server/scripts/recoverSenderIdentity.ts`, a standalone CLI never imported by
the running application (no decrypt-on-demand API exists anywhere else in
the repo). Verified against a real database: it correctly decrypted a real
sender's real number from a real `sender_identity_map` row, refused loudly
when the recovery key was missing, and refused (writing nothing) for an
unknown pseudonym — and every successful recovery wrote a real
`identity_recovery_log` row. See `backlog.md`'s LOG-3 for the full evidence —
this is a genuine trust/accountability design point worth surfacing in the
written summary and pitch deck, not just an implementation detail.

---

## Sprint 1 scope note

INF-2 must create **all ten tables above** in one pass, even though several
(`pattern_matches`, `trusted_contacts`, `resources`, `counsellor_users`,
`sms_alerts`) aren't populated or read until Sprint 2 — per backlog.md's INF-2
AC: "every table in Section 2 exists with the listed fields" once migrations
run. Don't defer table creation just because a table's consuming story hasn't
started yet.
