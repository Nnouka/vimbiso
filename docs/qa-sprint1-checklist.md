# QA Sprint 1 Definition-of-Done Checklist

Owner: QA · Status: unticked template for sprint review — **do not self-grade this
file**. Every box below is derived directly from each story's DoD/AC in
`docs/backlog.md` Section 5, for the stories in Sprint 1 scope (`docs/backlog.md`
Section 4 / `docs/sprint-1-plan.md` §1). Tick a box only at sprint review, against
the owning role's demonstrated evidence (a passing test, a live query, a manual
demo step) — not against a claim that it's done.

Where this checklist and `docs/backlog.md` ever disagree, `backlog.md` wins.

---

## SEC-1 — Perpetrator identifier hashing utility

- [ ] `server/lib/hashing.js` exports `normalizeAndHash(text)`
- [ ] Normalization = lowercase, trim, collapse internal whitespace, strip
      punctuation, applied before hashing
- [ ] Hash algorithm is HMAC-SHA256, secret read from `PERPETRATOR_HASH_SECRET`
      env var
- [ ] Same identifier under different casing/spacing/punctuation hashes to the
      same value (deterministic, case/spacing-insensitive equivalence)
- [ ] ≥5 unit tests passing (`server/__tests__/hashing.test.js`)
- [ ] Code review confirms no code path anywhere in the repo writes the raw
      perpetrator identifier to any table — only `perpetrator_hashes.hash_value`
      is ever stored
- [ ] Given no perpetrator text is supplied, no `perpetrator_hashes` row is
      created

## SEC-2 — No-real-name schema + consent flags

- [ ] `reports` schema contains no `name`, `legal_name`, or `id_number` column
      (confirmed by reading the actual migration files, not just the plan)
- [ ] `reports.perpetrator_consent_given boolean default false` exists at the
      DB level
- [ ] `reports.wants_counsellor_connect boolean default false` exists at the
      DB level
- [ ] `reports.connect_requested_at timestamp` defaults null
- [ ] `perpetrator_consent_given` false/null on report close → no
      `perpetrator_hashes` row is written for that report
- [ ] Survivor has not tapped "Yes, connect me" → `wants_counsellor_connect`
      stays false and no SMS fires
- [ ] Documented in README's Privacy section

## SEC-3 — Transit-privacy disclosure

- [ ] Disclosure message fires exactly once, immediately after language
      selection completes, before the main menu shows
- [ ] Message is never resent on subsequent contact within the same
      conversation/session (tracked via `conversation_state.disclosure_shown`)
- [ ] Copy is sourced verbatim from `docs/conversation-design.md`, content key
      `disclosure_message`, in the user's selected language (English required
      for Sprint 1)
- [ ] Verified manually against a live/sandbox conversation

## INF-1 — Twilio Sandbox + webhook

- [ ] `POST /webhook/whatsapp` route is live and verified against the Twilio
      WhatsApp Sandbox
- [ ] `verifyWebhookSignature(req)` rejects unsigned/invalid requests (403)
- [ ] A sent WhatsApp message receives a bot response within 5 seconds,
      demonstrated live in the Twilio console

## INF-2 — Full schema

- [ ] Migrations exist and run cleanly for all ten tables: `reports`,
      `triage_answers`, `perpetrator_hashes`, `pattern_matches`,
      `trusted_contacts`, `resources`, `counsellor_users`, `sms_alerts`,
      `content_strings`, `conversation_state`
- [ ] Field lists match `docs/data-model.md` (backlog.md Section 2) exactly —
      no invented or partial fields
- [ ] `npm run migrate` runs from a clean DB with no manual steps

## INF-3 — State machine + language selector

- [ ] Language selector is presented as a WhatsApp interactive list message
      with English / Kiswahili / Français options
- [ ] Selected language persists against the WhatsApp number in
      `conversation_state.language`
- [ ] Session resets after 24h of inactivity, verified with a test that
      manipulates timestamps (not a real 24h wait)
- [ ] State machine reads/writes only through Postgres — no in-memory session
      store anywhere in the process

## INF-4 — Main menu

- [ ] Exactly three translated options presented, exact copy per backlog.md
      INF-4: "Report something that happened" / "Find help near me" /
      "Know your rights" (content keys `menu.report` / `menu.find_help` /
      `menu.rights`)
- [ ] "Report something that happened" routes correctly to TRI-1's triage
      entry point
- [ ] "Find help near me" and "Know your rights" route to DIR-2/DIR-3
      respectively (Sprint 2 — stubs acceptable in Sprint 1 as long as routing
      itself is correct and doesn't dead-end silently)
- [ ] All three paths manually verified in English

## INF-5 — Device-safety guidance (Should, cut-first)

- [ ] If shipped: sending "0" or "help hiding this" from the main menu
      triggers content key `guidance.device_safety`
- [ ] If shipped: guidance covers saving the contact under a neutral name,
      WhatsApp's own Clear Chat/Archive, and an honest note that this PoC has
      no disguised app
- [ ] If shipped: copy checked against current WhatsApp UI terminology
- [ ] If cut: explicitly called out as cut in sprint review, not silently
      dropped

## TRI-1 — 8-question triage flow

- [ ] Exactly 8 questions asked, one at a time, in the fixed order from
      backlog.md Section 3: STRANGLE → WEAPON → KILL_THREAT → ESCALATION →
      SEPARATION → SEXUAL_COERCION → CONTROL → SELF_PERCEIVED_DANGER
- [ ] Each question presented via Quick Reply buttons: Yes / No / Prefer not
      to say, using the exact English question text in backlog.md Section 3
      (not a paraphrase)
- [ ] Each answer is written to `triage_answers` (with the correct
      `question_key`) before advancing to the next question
- [ ] "Prefer not to say" stores as `SKIP`
- [ ] A `reports` row is created with `status='IN_PROGRESS'` at flow start
- [ ] Mid-flow disconnect and resume (within the 24h session window) resumes
      at the correct question, not from the start
- [ ] A full English run produces 8 `triage_answers` rows tied to one
      `report_id`, verified in the DB

## TRI-2 — `scoreRisk(answers)` in `server/lib/riskScoring.js`

- [ ] Pure function, no DB access, unit-testable in isolation
- [ ] Override rule implemented: `STRANGLE=YES OR WEAPON=YES OR
      KILL_THREAT=YES → HIGH`, each independently sufficient regardless of
      other answers
- [ ] Threshold rule implemented: `ELSE IF count(YES, all 8) >= 4 → HIGH`,
      `ELSE → STANDARD`
- [ ] `SKIP` counts as `NO` for scoring
- [ ] ≥10 unit tests passing (`server/__tests__/riskScoring.test.js`) covering
      every override key individually, the 4-vs-3 threshold boundary, and the
      all-NO case

## TRI-3 — Wire scoring into the flow

- [ ] Immediately after the 8th answer is stored, `scoreRisk` runs against
      all 8 answers for that report
- [ ] `reports.risk_level` and `reports.status = 'SCORED'` are set in the same
      transaction/flow as the 8th answer — no window where the report sits
      answered-but-unscored
- [ ] Manual test: YES to Q1 (STRANGLE) only auto-triggers the HIGH branch
      with no further input

## LANG-1 — `content_strings` + `t()` helper

- [ ] `content_strings` table keyed by `key` + `language`
- [ ] `t(key, language)` returns the requested language's string
- [ ] `t(key, language)` falls back to English (logging a warning) if the
      requested language/key combination is missing
- [ ] `t()` never throws and never returns `undefined` to a user-facing
      message

## LANG-2 — Full English content

- [ ] Every content key referenced anywhere in Sprint 1 code has a
      corresponding English row in `content_strings` (seeded via
      `server/seeds/`)
- [ ] Diff script (key list in code vs. `content_strings WHERE language='en'`)
      returns zero missing keys
- [ ] No hardcoded user-facing English strings remain in `conversation.js` —
      everything user-facing goes through `t()`

---

## Sprint-level Definition of Done

- [ ] End-to-end demo performed: message the Sandbox number, pick English,
      receive the one-time disclosure, answer all 8 triage questions via
      buttons, confirm (via DB query, shown live) that `triage_answers` has 8
      rows and `reports.risk_level` / `status` are correctly set
- [ ] Full automated test suite (`npm test`) green
- [ ] No raw perpetrator identifier or legal name present anywhere in the DB,
      confirmed by a live query at review
- [ ] INF-5, if cut, is explicitly called out as cut at sprint review (not
      silently dropped)
