# Sprint 3 QA Report — QA-3 (dashboard verification) + QA-4 (privacy audit)

Owner: QA/PM · Day 8. This report is the evidence artifact `docs/backlog.md`'s
QA-3 and QA-4 both call for ("screenshot-verified checklist item" / "signed
checklist with query output saved as evidence"). Where a real screenshot isn't
possible in this sandbox, the substitute evidence and its limits are stated
explicitly rather than glossed over. `docs/qa-script.md` covers QA-2's
conversation-flow verification; this report covers the dashboard and the
database itself.

---

## 0. Environment used for this pass

This dev sandbox cannot run `npm install` (package registry returns HTTP 403)
and has no outbound access to a real Twilio account — both constraints carried
over from Sprints 1–2 and documented in `docs/ai-tool-usage-log.md`. Two
capabilities discovered this sprint changed what's actually verifiable:

1. **A global TypeScript compiler (`tsc`) and `tsx` runtime** were already
   available, letting the project's *actual* `.ts` files execute (via `tsx`)
   rather than being re-implemented in a hand-rolled harness, as Sprints 1–2
   had to do.
2. **PostgreSQL 16 is pre-installed** in this sandbox. A real local database
   (`vimbiso_test`) was created, migrated with the project's real
   `server/migrations/run.ts`, and seeded with the real `server/seeds/run_all.ts`
   and `dashboard/seed.ts`.

Since `pg` (and `twilio`/`dotenv`/`bcrypt`) still can't be `npm install`ed, this
pass used hand-built runtime shims for those four packages — routing `pg`'s
`Pool.query()` through the real `psql` CLI against the real database instead of
an in-memory mock, and capturing (never sending) outbound Twilio calls. This
means `server/lib/conversation.ts`, `server/lib/db.ts`, `server/lib/patternMatch.ts`,
`dashboard/server.ts`'s query logic, and every migration/seed file ran as their
**actual, real code** against a **real database** — not a simulation of them.
The shims themselves went through five rounds of bugs found and fixed before
being trusted (wrong `psql` flags misreading empty result sets, Postgres
command-completion tags parsed as bogus data rows, jsonb/array/plain-string
column values initially confused with each other) — documented in full in
`docs/ai-tool-usage-log.md`'s Sprint 3 entry, since a shim bug produces exactly
the same symptom as a real one and each had to be independently root-caused
before assuming the *application* code was at fault or not.

What this environment still cannot do, and this report does not claim to have
done: a live Twilio WhatsApp Sandbox round-trip, a real SMS arriving on a real
phone, or actually running Express/EJS to render and screenshot the dashboard's
HTML (no real `express`/`ejs` packages either). Where the dashboard's rendering
itself is the open item, this report substitutes the next best real evidence —
the dashboard's own SQL query strings, copied verbatim from `dashboard/server.ts`
and run directly against the real, populated database — and says so plainly
rather than presenting that as equivalent to a screenshot.

The database used for this whole pass was first populated by the real seeds
(`server/seeds/run_all.ts`: `content_en`/`content_sw`/`content_fr`,
`resources_kenya`, `pattern_watch_demo`), then exercised by a real end-to-end
driver (`/tmp/vimbiso-e2e/drive.ts` and `drive2.ts`/`drive3.ts`, not part of
this repo — scratch test harnesses) calling `handleIncomingMessage()` directly
with synthetic messages through 5 full conversation journeys (see
`docs/qa-script.md`). Every query below runs against that same real,
already-exercised data.

---

## 1. QA-3 — Dashboard verification

`dashboard/server.ts`'s three data-bearing routes were checked by running their
**exact SQL query strings** (copy-pasted, not paraphrased) directly via `psql`
against the real database, then separately re-checking the pure-JS logic
(`maskPhoneNumber()`, the login decision) that dashboard/server.ts applies to
those rows before rendering.

### 1.1 DASH-2 — Reports queue, HIGH pinned

Query run (verbatim from `dashboard/server.ts` lines 302–321):

```sql
SELECT
  r.id, r.risk_level, r.region, r.wants_counsellor_connect, r.whatsapp_number,
  COUNT(ta.id) FILTER (WHERE ta.answer = 'YES') AS yes_count,
  COALESCE(array_agg(ta.question_key ORDER BY ta.id) FILTER (WHERE ta.answer = 'YES'), ARRAY[]::text[]) AS yes_keys
FROM reports r
LEFT JOIN triage_answers ta ON ta.report_id = r.id
WHERE r.risk_level IS NOT NULL
GROUP BY r.id
ORDER BY CASE r.risk_level WHEN 'HIGH' THEN 0 WHEN 'STANDARD' THEN 1 ELSE 2 END, r.created_at DESC;
```

Result:

```
 id | risk_level | region  | wants_counsellor_connect |    whatsapp_number    | yes_count |  yes_keys
----+------------+---------+--------------------------+-----------------------+-----------+------------
  4 | HIGH       |         | t                        | whatsapp:+19995550001 |         1 | {STRANGLE}
  2 | HIGH       |         | f                        | whatsapp:+10000000002 |         0 | {}
  5 | STANDARD   | Nairobi | f                        | whatsapp:+19995550002 |         0 | {}
  3 | STANDARD   |         | f                        | whatsapp:+10000000003 |         0 | {}
  1 | STANDARD   |         | f                        | whatsapp:+10000000001 |         0 | {}
```

Confirms: HIGH before STANDARD (rows 4, 2 before 5, 3, 1); newest-first within
each group (4 newer than 2; 5 newer than 3 newer than 1); DASH-2's DoD dataset
shape (≥2 HIGH, ≥1 STANDARD) is present. `yes_count`/`yes_keys` correctly
reflect report 4's single STRANGLE=YES answer and zero for every all-NO report.

`maskPhoneNumber()` (pure JS, not SQL — re-run directly against these rows'
`whatsapp_number` values):

```
whatsapp:+19995550001 -> •••• 0001
whatsapp:+10000000002 -> •••• 0002
whatsapp:+19995550002 -> •••• 0002
whatsapp:+10000000003 -> •••• 0003
whatsapp:+10000000001 -> •••• 0001
```

No row ever exposes more than the last 4 digits — confirmed for every row
currently in the table, not just a hand-picked example.

### 1.2 DASH-3 — Pattern Watch tab + mark-reviewed action

Query run (verbatim, lines 354–357):

```sql
SELECT id, hash_value, report_ids, status, created_at, reviewed_by, reviewed_at
FROM pattern_matches ORDER BY status ASC, created_at DESC;
```

Result:

```
 id |                            hash_value                            | report_ids | status | reviewed_by | reviewed_at
----+------------------------------------------------------------------+------------+--------+-------------+-------------
  1 | f834c9362467066def5df01d6284c781301fb419bb376bcba6b165a7c5cec4b3 | {2,3,1,4}  | NEW    |             |
```

Confirms PW-3's seeded 3-report match (`{1,2,3}`) plus Journey A's PW-1 consent
using the same fake identifier merged into the *same* row (report 4 added,
`status`/`hash_value` untouched) — exactly PW-2's dedup/merge contract, now
proven against a real cross-report scenario spanning both seed data and a live
conversation.

Mutation run (verbatim, lines 391–396):

```sql
UPDATE pattern_matches SET status = 'REVIEWED', reviewed_by = 'Test Counsellor', reviewed_at = now() WHERE id = 1;
```

Result: `UPDATE 1`; re-querying confirmed `status='REVIEWED'`, `reviewed_by='Test Counsellor'`, `reviewed_at` populated. Reverted afterward (`status='NEW'`, `reviewed_by`/`reviewed_at` cleared) to leave the fixture data in its original demo-ready state for anyone else who runs this later.

### 1.3 DASH-4 — Report detail view

Queries run (verbatim, lines 411–434) for report id 4:

```sql
SELECT id, created_at, risk_level, region, whatsapp_number FROM reports WHERE id = 4;
SELECT question_key, answer FROM triage_answers WHERE report_id = 4 ORDER BY id ASC;
SELECT sent_to, sent_at, status FROM sms_alerts WHERE report_id = 4 ORDER BY sent_at ASC;
```

Results: report row (HIGH, `whatsapp:+19995550001`); all 8 `triage_answers` in
the fixed question order with STRANGLE=YES and the rest NO; exactly one
`sms_alerts` row (`sent_to=+15005550006`, `status='sent'`). Matches the real
conversation history for this report exactly — confirmed by cross-referencing
against `docs/qa-script.md` §3's independently-recorded journey steps.

### 1.4 DASH-1 — Authenticated dashboard shell

`dashboard/seed.ts` was run against the real database (creates
`counsellor_users` row `demo-counsellor` via a real `bcrypt.hash` call). The
exact login decision logic from `dashboard/server.ts`'s `POST /login` handler
(query by username, `bcrypt.compare` against the stored hash, session starts
only if both a user is found and the password matches) was then run directly:

```
login(demo-counsellor, "demo-password") -> user found=true, passwordMatches=true, session starts=true
login(demo-counsellor, "wrong-password") -> user found=true, passwordMatches=false, session starts=false
login(nonexistent-user, "anything") -> user found=false, passwordMatches=false, session starts=false
```

All three cases resolve correctly. **Caveat:** the `bcrypt` package itself is
shimmed (uses Node's built-in `crypto.scryptSync` instead of real bcrypt, since
`npm install` can't fetch the real native module here) — self-consistent for
this test (the same shim both hashed and compared), but this is not proof that
the *real* `bcrypt` package behaves identically, only that the application's
own auth-decision logic is correct given whatever password-hashing library sits
behind it. Actual Express session/redirect behavior (`/dashboard/*` redirecting
an unauthenticated request to `/login`) was not run — no real `express`
package here — and remains checked only by code reading against
`dashboard-login.spec.ts`, per Sprint 2's existing note.

### 1.5 What QA-3 still has not verified

- Actual rendered HTML/EJS output — no real `express`/`ejs` in this sandbox.
- The Playwright specs under `server/__tests__/e2e/` (written in Sprint 2)
  still have not been executed by a real Playwright runner.
- Real screenshots, as `docs/backlog.md`'s QA-3 DoD literally asks for.

---

## 2. QA-4 — Privacy audit

Full schema of all 11 tables was inspected directly (`\d <table>` for each).
Findings:

- No table anywhere has a `name`, `legal_name`, `id_number`, or any column that
  could hold a legal name. `reports` and `trusted_contacts` were checked
  specifically per SEC-2's own AC; the audit extended this check to all 11
  tables, not just those two.
- `perpetrator_hashes` has exactly two data columns beyond its id/timestamp:
  `hash_value text` and `algorithm text`. No column exists that could hold raw
  perpetrator text.
- `sms_alerts` has no `body` column — the actual SMS text is never persisted,
  only metadata about the fact that a send happened.

A live query searched **every** `text`/`varchar`/`jsonb` column in **every**
table for the literal test identifier used in this sprint's live journeys
(`TEST-DEMO-PERPETRATOR-DO-NOT-USE`):

```sql
DO $$
DECLARE r RECORD; cnt INT;
BEGIN
  FOR r IN SELECT table_name, column_name FROM information_schema.columns
           WHERE table_schema='public' AND data_type IN ('text','character varying','jsonb')
  LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE %I::text ILIKE %L', r.table_name, r.column_name, '%TEST-DEMO-PERPETRATOR%') INTO cnt;
    IF cnt > 0 THEN RAISE NOTICE 'FOUND raw identifier in %.% (% rows)', r.table_name, r.column_name, cnt; END IF;
  END LOOP;
END $$;
```

Result: **zero** `NOTICE` lines emitted — the raw identifier does not appear in
any text-bearing column of any table, anywhere, including columns that were
never intended to hold it. (`perpetrator_hashes.hash_value` correctly holds
only the *hashed* value, `f834c936...`, which does not match this ILIKE search
against the raw string, as expected.)

Consent-gate enforcement was checked directly against real data, not just read
in the code:

```sql
SELECT r.id, r.perpetrator_consent_given, ph.id IS NOT NULL AS has_hash_row
FROM reports r LEFT JOIN perpetrator_hashes ph ON ph.report_id = r.id ORDER BY r.id;
```
```
 id | perpetrator_consent_given | has_hash_row
----+---------------------------+--------------
  1 | t                         | t
  2 | t                         | t
  3 | t                         | t
  4 | t                         | t
  5 | f                         | f
```

Report 5 (Journey B, PW-1 declined) correctly has no `perpetrator_hashes` row.
Every report with `perpetrator_consent_given=true` has exactly one hash row
(none double-hashed).

```sql
SELECT r.id, r.risk_level, r.wants_counsellor_connect, sa.id IS NOT NULL AS has_sms_row
FROM reports r LEFT JOIN sms_alerts sa ON sa.report_id = r.id ORDER BY r.id;
```
```
 id | risk_level | wants_counsellor_connect | has_sms_row
----+------------+--------------------------+-------------
  1 | STANDARD   | f                        | f
  2 | HIGH       | f                        | f
  3 | STANDARD   | f                        | f
  4 | HIGH       | t                        | t
  5 | STANDARD   | f                        | f
```

Report 2 is HIGH but `wants_counsellor_connect=false` (its seed data never
"tapped" connect-yes) and correctly has no SMS row — confirming the gate is on
the survivor's actual choice, not merely on risk level.

Disclosure-once check (SEC-3):

```sql
SELECT whatsapp_number, disclosure_shown FROM conversation_state WHERE whatsapp_number LIKE 'whatsapp:+1999%';
```
All exercised numbers show `disclosure_shown=t`, and none were ever re-sent the
disclosure across a multi-message conversation (confirmed by the absence of a
duplicate disclosure line in any captured message log across all 5 journeys).

### QA-4 verdict

**No raw perpetrator string, legal name, or banned column was found anywhere in
this database.** This audit covers only the data actually produced during this
sprint's testing (seed data plus 5 synthetic journeys) — it is real evidence
about how the schema and code behave, not a substitute for re-running the same
audit against a production database before any real launch. The query text
above is reusable verbatim for that future audit.

---

## 3. Summary for `docs/backlog.md`

This report's findings are the evidence behind this sprint's checkbox updates
in `docs/backlog.md` (see that file's per-story Status: notes for exactly which
box each piece of evidence above justifies flipping, and which DoD clauses
remain explicitly open — a live Twilio send chief among them).
