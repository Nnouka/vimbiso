# Vimbiso — Build Backlog (Epics, Sprints, User Stories)

*Prepared with Tendai Moyo — locked against the finalized MVP spec (`vimbiso-mvp-spec.md`): Kenya pilot, WhatsApp-only, risk-triage-first safety mechanism, English/Swahili/French at FULL tier, Arabic/Kinyarwanda conditional, web dashboard + SMS alerting, Pattern Watch demoted to a non-urgent institutional signal.*

This document is meant to be handed story-by-story to a developer or a coding agent. Nothing below re-opens a decision already made in the MVP spec — it decomposes locked decisions into buildable work. Update it as the build progresses; it's a living backlog, not a frozen spec.

---

## 1. Epics

| Epic | Goal | Done when |
|---|---|---|
| **SEC** — Security & Privacy Foundations | Establish the no-real-name, consent-gated, hashed-identifier data model everything else builds on | No table anywhere stores a legal name or raw perpetrator text; every cross-report action requires explicit consent |
| **INF** — Infrastructure & WhatsApp Bot Skeleton | Stand up the channel, backend, DB, and conversation state machine | A tester can message the sandbox number, pick a language, and reach the main menu, fully logged to Postgres |
| **TRI** — Risk Triage & Scoring Engine | Implement the 8-question triage and deterministic scoring | Any completed triage produces a stored risk_level matching the documented override/threshold rules, proven by unit tests |
| **HR** — High-Risk Automatic Response | Fire safety plan, counsellor SMS alert, and trusted-contact alert automatically on a single HIGH-risk report | A HIGH-risk test report triggers all four actions with zero human trigger and zero dependency on a second report |
| **DIR** — Resource Directory / Standard-Risk Path | Serve a real, sourced, dated Kenyan resource directory | Every resource response includes a name, phone, source, and last-verified date |
| **PW** — Pattern Watch | Consent-gated, hashed, non-urgent repeat-perpetrator matching, clearly demoted from the primary safety path | Two seeded reports naming the same identifier produce a visible dashboard match, with zero plaintext perpetrator data anywhere |
| **DASH** — Counsellor Web Dashboard | Give counsellors/reviewers a queue view (High-Risk pinned) and a separate Pattern Watch tab | A logged-in reviewer sees reports sorted correctly and matches in a clearly non-urgent separate tab |
| **LANG** — Multilingual Content Pipeline | Key-based content schema serving English/Swahili/French at FULL tier, Arabic/Kinyarwanda conditionally, Shona/Ndebele as architecture-only | All bot-facing strings come from the schema, tier labels are accurate, and English+Swahili+French pass the parity check |
| **QA** — Testing & QA | Verify every language path and every risk branch before recording anything | A signed-off test script confirms all Must-priority flows work end-to-end on the deployed environment |
| **SUB** — Submission Deliverables | Produce the demo video, pitch deck, written summary, README | All four artifacts exist, are accurate to what was actually built, and are submitted |

---

## 2. Data Model Reference (source of truth — extend here, not inline per story)

```
reports (
  id, created_at, channel, language, risk_level ['STANDARD'|'HIGH'|null],
  status ['IN_PROGRESS'|'SCORED'|'CLOSED'], whatsapp_number,
  region, wants_counsellor_connect boolean default false,
  connect_requested_at timestamp null,
  perpetrator_consent_given boolean default false
)
triage_answers (id, report_id FK, question_key, answer ['YES'|'NO'|'SKIP'], created_at)
perpetrator_hashes (id, report_id FK, hash_value, algorithm, created_at)
pattern_matches (id, hash_value, report_ids integer[], status ['NEW'|'REVIEWED'], created_at, reviewed_by, reviewed_at)   -- added by PW-2
trusted_contacts (id, survivor_whatsapp_number, contact_whatsapp_number, registered_at, alert_sent_at null)              -- keyed to survivor, not report — see HR-3
resources (id, country, region, category, name, phone, address, hours, source_name, source_url, last_verified_date, language_support text[])
counsellor_users (id, name, username, password_hash, phone_number_for_sms, role ['counsellor'|'institutional_reviewer'|'admin'])
sms_alerts (id, report_id FK, sent_to, sent_at, twilio_sid, status)          -- added by HR-2
content_strings (key, language, text, tier ['FULL'|'PARTIAL'|'ARCHITECTURE_ONLY'], reviewed_by null, reviewed_at null)  -- added by LANG-1
conversation_state (whatsapp_number PK, current_step, language, temp_answers jsonb, disclosure_shown boolean, updated_at)  -- added by INF-3
```

---

## 3. Triage Questions & Scoring Reference

Use this exact content and logic — do not re-derive it.

| # | Key | Question (English) | Role in scoring |
|---|---|---|---|
| 1 | STRANGLE | Has he ever choked, strangled, or tried to suffocate you? | **Override** — YES alone → HIGH |
| 2 | WEAPON | Does he have a weapon, or has he threatened you with one? | **Override** — YES alone → HIGH |
| 3 | KILL_THREAT | Has he said he would kill you, or someone close to you? | **Override** — YES alone → HIGH |
| 4 | ESCALATION | Is the violence happening more often, or getting worse? | Counts toward threshold |
| 5 | SEPARATION | Have you left, or tried to leave, recently — or talked about leaving? | Counts toward threshold |
| 6 | SEXUAL_COERCION | Has he forced you into sex you didn't want? | Counts toward threshold |
| 7 | CONTROL | Is he watching, following, or controlling where you go and who you talk to? | Counts toward threshold |
| 8 | SELF_PERCEIVED_DANGER | Do you feel that if nothing changes, you could be seriously hurt or killed? | Counts toward threshold |

**Scoring rule:** `IF STRANGLE=YES OR WEAPON=YES OR KILL_THREAT=YES → HIGH`. `ELSE IF count(YES, all 8) >= 4 → HIGH`. `ELSE → STANDARD`. `SKIP` counts as `NO` for scoring purposes.

---

## 4. Sprint Plan (10 days → 3 sprints)

### Sprint 1 — Foundations (Days 1–3)
**Goal:** A user can message the bot, pick a language, complete the 8-question triage, and get a correctly stored, correctly scored `risk_level`.
**In scope:** SEC-1, SEC-2, SEC-3 · INF-1, INF-2, INF-3, INF-4, INF-5 · TRI-1, TRI-2, TRI-3 · LANG-1, LANG-2 (started) · content-track: Swahili/French drafting begins in parallel, off the critical path.
**Sprint done when:** TRI-3's DoD passes manually in English; SEC's unit tests are green; INF-2's migrations run clean.
**Dependency note:** TRI-1/TRI-3 cannot start until INF-3/INF-4 exist; TRI-2 can be built in parallel (pure function, no bot dependency).

### Sprint 2 — Core Safety Features (Days 4–7)
**Goal:** Every report — HIGH or STANDARD — produces its correct automatic response end-to-end, visible in a working dashboard, in English, Swahili, and (safety-plan subset) French.
**In scope:** HR-1, HR-2, HR-3, HR-4 · DIR-1, DIR-2, DIR-3 · PW-1, PW-2, PW-3 · DASH-1, DASH-2, DASH-3, DASH-4 · LANG-3, LANG-4 (+ LANG-5/6/7 opportunistically) · SEC-3 disclosure wired in.
**Sprint done when:** QA-1 tests pass; a HIGH-risk test report fires safety plan + real SMS + (if registered) trusted-contact alert; dashboard shows it pinned; a seeded Pattern Watch match renders in its own tab.
**Dependency note:** HR-1 depends on TRI-3 (Sprint 1) and DIR-1 (hotline number must be seeded first, since HR-1 pulls it from `resources`, not a hardcoded string). DASH depends on data existing from HR/DIR/PW. PW-1 depends on SEC-1/SEC-2.

### Sprint 3 — Testing & Submission (Days 8–10)
**Goal:** A judge can watch a demo showing a real, working, multilingual safety journey and read a submission package that's honest about scope.
**In scope:** QA-2, QA-3, QA-4 (Day 8) · SUB-1, SUB-2, SUB-3, SUB-4 (Days 9–10).
**Sprint done when:** All four submission artifacts exist and match what was actually built — no feature claimed in the deck/video that isn't real in the repo.
**Dependency note:** QA-2/QA-3 must pass *before* SUB-1 recording starts — never script a demo around a feature that hasn't been verified working.

---

## 5. User Stories

### EPIC: SEC — Security & Privacy Foundations

**SEC-1 — Perpetrator identifier hashing utility**
Story: As a backend developer, I want a reusable server-side function that normalizes and salt-hashes a perpetrator identifier string, so that no raw perpetrator-identifying text is ever persisted.
Priority: **Must**
AC:
- Given a raw string like "John, my husband, Kibera", when passed through `normalizeAndHash(text)`, then it returns a deterministic HMAC-SHA256 hash of the lowercased, trimmed, punctuation-stripped string.
- Given the same identifier typed with different casing/spacing, when hashed twice, then both calls produce the same hash.
- Given any input, when processed, then the raw text is never written to any table — only `perpetrator_hashes.hash_value` is stored.
- Given no perpetrator text is supplied, when a report is submitted, then no row is created in `perpetrator_hashes`.
Technical notes: Node `crypto` module, HMAC-SHA256, secret in env var `PERPETRATOR_HASH_SECRET`; normalization = lowercase, trim, collapse whitespace, strip punctuation; implement in `/server/lib/hashing.js` with tests in `hashing.test.js`.
Dependencies: none.
DoD: Function implemented, ≥5 unit tests passing, code review confirms no code path writes raw text anywhere.

**SEC-2 — No-real-name schema + consent flags**
Story: As a product owner, I want `reports` and `trusted_contacts` to have no legal-name field and to gate every cross-report or outbound action behind an explicit consent flag.
Priority: **Must**
AC:
- Given the `reports` schema, when inspected, then it contains no `name`, `legal_name`, or `id_number` column.
- Given `perpetrator_consent_given` is false/null, when a report closes, then no `perpetrator_hashes` row is written for it.
- Given a survivor hasn't tapped "Yes, connect me," when the HIGH-risk flow runs, then `wants_counsellor_connect` stays false and no SMS fires.
Technical notes: add `perpetrator_consent_given boolean default false`, `wants_counsellor_connect boolean default false`, `connect_requested_at timestamp null` to `reports` (per Section 2).
Dependencies: none.
DoD: Migration applied; schema matches this checklist; documented in README's Privacy section.

**SEC-3 — Transit-privacy disclosure**
Story: As a survivor, I want to be told, before typing anything sensitive, that this chat runs over WhatsApp/Twilio and isn't a zero-knowledge system, so I can decide what to share.
Priority: **Should**
AC: Given language selection just completed, when the main menu is about to show, then a one-line disclosure fires first (per language): *"This chat runs over WhatsApp. We don't store your name, but WhatsApp/our phone provider can see this conversation exists. Consider deleting this chat afterward."* Fires exactly once per conversation.
Technical notes: content key `disclosure_message`; track via `conversation_state.disclosure_shown`.
Dependencies: INF-3.
DoD: Fires once per new conversation, in the selected language, verified manually.

---

### EPIC: INF — Infrastructure & WhatsApp Bot Skeleton

**INF-1 — Provision Twilio WhatsApp Sandbox + backend**
Story: As a developer, I want a deployed Express backend wired to a Twilio WhatsApp Sandbox number, so messages can flow both ways.
Priority: **Must**
AC: Given a tester joins the sandbox via join code, when they send any message, then `POST /webhook/whatsapp` receives it and the backend echoes a reply within 5 seconds.
Technical notes: Twilio WhatsApp Sandbox, Express route, Twilio Node SDK, hosted on Railway/Render, env vars `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`WHATSAPP_FROM`.
Dependencies: none.
DoD: Deployed and reachable; echo test passes in the Twilio console.

**INF-2 — Postgres schema + migrations**
Story: As a developer, I want the full schema (Section 2) created via migrations, so every later story has somewhere to read/write.
Priority: **Must**
AC: Given the migration runner executes, when it completes, then every table in Section 2 exists with the listed fields.
Technical notes: `node-pg-migrate` or Prisma, one migration per table.
Dependencies: none.
DoD: `npm run migrate` runs clean on a fresh DB; matches Section 2 exactly.

**INF-3 — Conversation state machine + language selector**
Story: As a survivor, I want to pick my language on first contact, so everything after is understandable.
Priority: **Must**
AC: Given a first-time sender, when they message the number, then they get a list message: "English / Kiswahili / Français" (+ additional options once LANG-5/6 are live); given a selection, then `conversation_state.language` persists for the session; given 24h of inactivity, then the next message re-prompts language selection.
Technical notes: `conversation_state` table (Section 2); Twilio interactive List Message type.
Dependencies: INF-1, INF-2.
DoD: Language persists across a multi-message session; resets after the 24h Twilio session boundary.

**INF-4 — Main menu**
Story: As a user, I want a menu after language selection, so I can choose what I need.
Priority: **Must**
AC: Given language is set, when the menu sends, then it shows exactly three translated options: "Report something that happened" / "Find help near me" / "Know your rights," each routing correctly (to TRI-1, DIR-2, DIR-3 respectively).
Technical notes: strings from `content_strings` keys `menu.report`/`menu.find_help`/`menu.rights`.
Dependencies: INF-3, LANG-1.
DoD: All three paths route correctly in English, manually verified.

**INF-5 — Device-safety guidance ("quick exit" equivalent)**
Story: As a survivor worried about someone checking my phone, I want basic device-safety guidance, so using Vimbiso doesn't add risk.
Priority: **Should** (first cut if time is short)
AC: Given the main menu, when the user sends "0" or "help hiding this," then the bot sends guidance: save the contact under a neutral name, use WhatsApp's own Clear Chat/Archive, and an honest note that there is no disguised app in this PoC.
Technical notes: content key `guidance.device_safety`.
Dependencies: INF-4.
DoD: Sends correctly; copy checked against current WhatsApp UI terminology.

---

### EPIC: TRI — Risk Triage & Scoring Engine

**TRI-1 — Triage question flow**
Story: As a survivor, I want to answer 8 short yes/no questions one at a time via tappable buttons, so I don't have to type sensitive details.
Priority: **Must**
AC: Given "Report something that happened" is selected, when the flow starts, then question 1 (STRANGLE, per Section 3) sends as a Quick Reply button set (Yes/No/Prefer not to say); each answer writes a row to `triage_answers` and advances to the next question in the fixed order (STRANGLE → WEAPON → KILL_THREAT → ESCALATION → SEPARATION → SEXUAL_COERCION → CONTROL → SELF_PERCEIVED_DANGER); "Prefer not to say" stores as `SKIP`.
Technical notes: Twilio interactive buttons; create a `reports` row with `status='IN_PROGRESS'` at flow start; `conversation_state.current_step` tracks progress.
Dependencies: INF-3, INF-4, LANG-2 (and LANG-3/4 for translated versions).
DoD: A full English run produces 8 `triage_answers` rows tied to one `report_id`, verified in the DB.

**TRI-2 — Risk scoring function**
Story: As a developer, I want a pure, tested function implementing the Section 3 rules, independent of the bot.
Priority: **Must**
AC (examples, not exhaustive):
- Given STRANGLE=YES, all others NO → HIGH (override).
- Given all 8 = NO → STANDARD.
- Given exactly 4 of {ESCALATION, SEPARATION, SEXUAL_COERCION, CONTROL, SELF_PERCEIVED_DANGER} = YES, no override triggered → HIGH (threshold).
- Given exactly 3 of those 5 = YES, no override → STANDARD.
Technical notes: `scoreRisk(answers): 'HIGH'|'STANDARD'` in `/server/lib/riskScoring.js`, no DB access; `SKIP` = `NO`.
Dependencies: none (parallel-buildable with TRI-1).
DoD: ≥10 unit tests covering every override key individually, the 4-vs-3 threshold boundary, and all-NO — all passing.

**TRI-3 — Wire scoring into the flow**
Story: As the system, I want risk scored immediately after the 8th answer, so the correct response fires without delay.
Priority: **Must**
AC: Given the 8th answer is received, when processed, then `scoreRisk()` runs, `reports.risk_level` and `status='SCORED'` are set, and control passes to HR-1 (if HIGH) or DIR-2 (if STANDARD) in the same handling cycle — no extra user action required.
Dependencies: TRI-1, TRI-2.
DoD: Manual test — YES to Q1 only auto-triggers the HIGH branch with no further input.

---

### EPIC: HR — High-Risk Automatic Response

**HR-1 — Immediate safety-plan sequence**
Story: As a survivor scored HIGH, I want clear guidance immediately, so I know what to do without waiting on anyone.
Priority: **Must**
AC: Given `risk_level=HIGH`, when the response fires, then the bot sends, in the user's language: (1) danger-intro line, (2) the safety-plan list (pack a bag, identify a safe neighbor, memorize one number, keep phone charged), (3) the real hotline number pulled from `resources`, (4) a Yes/No "connect me to a counsellor now?" prompt.
Technical notes: keys `highrisk.intro`/`highrisk.plan_1..4`/`highrisk.connect_prompt`; hotline number queried from `resources` (category='hotline', country='KE'), never hardcoded.
Dependencies: TRI-3, DIR-1.
DoD: All 4 parts arrive within 5 seconds, verified in English and Swahili.

**HR-2 — Counsellor-connect logging + real SMS alert**
Story: As an on-call counsellor, I want an immediate SMS when a survivor requests connection, so I can call back without watching a chat app.
Priority: **Must**
AC:
- Given "Yes" is tapped, when processed, then `wants_counsellor_connect=true`, `connect_requested_at` is set, a `sms_alerts` row is written, and a real Twilio SMS is sent to `ONCALL_COUNSELLOR_PHONE` containing only `report_id`, `risk_level`, and timestamp — no survivor name/number in the SMS body.
- Given "No" is tapped, when processed, then no SMS fires and the hotline number remains visible for self-service.
Technical notes: Twilio SMS API; `sms_alerts(id, report_id, sent_to, sent_at, twilio_sid, status)`.
Dependencies: HR-1.
DoD: A real SMS arrives on a test phone within 10 seconds — verified live, not mocked, before video recording.

**HR-3 — Trusted-contact registration**
Story: As a survivor, I want to register one trusted contact in advance, so someone can be quietly alerted later.
Priority: **Should** (first thing cut if Sprint 2 slips)
AC: Given "Set up a trusted contact" is selected, when a WhatsApp number is provided, then a `trusted_contacts` row is created keyed to `survivor_whatsapp_number` (not `report_id` — it must persist across future reports).
Technical notes: schema as extended in Section 2.
Dependencies: INF-3.
DoD: Registration completes and is retrievable by HR-4 in a test.

**HR-4 — Automatic trusted-contact alert**
Story: As a trusted contact, I want a vague, coded check-in message if she's scored HIGH risk, so I know to reach out without exposing what happened.
Priority: **Should** (tied to HR-3; cut together)
AC: Given a registered contact exists and HIGH fires, when HR-1 runs, then the contact receives exactly: *"Thinking of you — call me when you can."* and `alert_sent_at` updates. Given no contact is registered, then this step silently no-ops.
Dependencies: HR-1, HR-3.
DoD: Test HIGH-risk report with a registered contact results in the contact receiving the message.

---

### EPIC: DIR — Resource Directory / Standard-Risk Path

**DIR-1 — Seed real, sourced Kenyan directory**
Story: As the product owner, I want ≥5–8 real, verifiable Kenyan GBV entries loaded, so every answer is traceable.
Priority: **Must**
AC: Given `resources`, when queried, then it contains at minimum HAK/1195 national hotline, at least one Nairobi-region resource, Kenya Police Gender & Children's Desk contact, and the State Department for Gender's reporting channel — each with non-null `name`, `phone`, `source_name`, `source_url`, `last_verified_date` (seed date).
Technical notes: seed file `/server/seeds/resources_kenya.js`.
Dependencies: INF-2.
DoD: Seed runs clean; every entry spot-checked against its `source_url` before Day 5.

**DIR-2 — "Find Help" region picker**
Story: As a user, I want to pick my area and get a real, dated resource.
Priority: **Must**
AC: Given "Find help near me" or the Standard-risk branch, when triggered, then the bot offers "Nairobi / Mombasa / Other-National"; given a selection, then it returns a matching entry's name, phone, and "Source: {source_name}, last verified {date}"; given no region-specific match, the national hotline is returned as fallback.
Dependencies: DIR-1, INF-4.
DoD: All 3 region options return a non-empty, correctly-sourced result.

**DIR-3 — "Know your rights" example content**
Story: As a user, I want basic rights orientation, clearly marked as unreviewed example content.
Priority: **Could**
AC: Given "Know your rights" is selected, then 2–3 short points send, prefixed with: *"This is example information and has not yet been reviewed by a legal partner."*
Dependencies: INF-4.
DoD: Disclaimer visible in every language it ships in; first item cut if Sprint 2 runs long.

---

### EPIC: PW — Pattern Watch

**PW-1 — Optional consent-gated perpetrator capture**
Story: As a survivor, I want to optionally name who harmed me for pattern-detection only, clearly separate from my own case.
Priority: **Should**
AC: Given a report is scored, when the closing step is reached, then an optional, skippable prompt appears: *"Would you like to name who did this, only to check if others have reported the same person? This never changes what happens with your case."* A "yes" sets `perpetrator_consent_given=true` and passes text to SEC-1's hasher; "no"/skip ends the flow.
Dependencies: TRI-3, SEC-1, SEC-2.
DoD: Consenting produces exactly one `perpetrator_hashes` row with zero raw text anywhere in the DB (verified by direct inspection).

**PW-2 — Hash matching logic**
Story: As the system, I want to link independent reports whose hashed perpetrator identifier matches.
Priority: **Should**
AC: Given a new `perpetrator_hashes` row's `hash_value` matches an existing row from a *different* `report_id`, then a `pattern_matches` row is created/updated (`hash_value`, `report_ids[]`, `status='NEW'`). Given no match, no row is created.
Technical notes: `pattern_matches` is a new table (Section 2).
Dependencies: PW-1, SEC-1.
DoD: Two test reports with the same normalized identifier produce exactly one `pattern_matches` row referencing both.

**PW-3 — Seed demo match data**
Story: As the developer preparing the demo, I want 2–3 scripted, clearly-fake test reports that deliberately match, so Pattern Watch has something real to show.
Priority: **Must** (for demo credibility, even though the underlying feature is Should)
AC: Given the seed runs, when the dashboard's Pattern Watch tab loads, then at least one matched pair is visible, using an obviously-fake, clearly test-labeled identifier.
Dependencies: PW-2.
DoD: Visible correct match before Day 9 recording.

---

### EPIC: DASH — Counsellor Web Dashboard

**DASH-1 — Authenticated dashboard shell**
Story: As a counsellor, I want to log in, so report data isn't publicly exposed.
Priority: **Must**
AC: Given no session, then a login form shows; given correct `counsellor_users` credentials, then a session starts and the queue loads; given wrong credentials, then an error shows and no session is created.
Technical notes: single shared demo login acceptable for PoC (per-counsellor RBAC explicitly out of scope); bcrypt-hashed password.
Dependencies: INF-2.
DoD: Login/logout works; `/dashboard/*` redirects unauthenticated requests to login.

**DASH-2 — Reports queue, High-Risk pinned**
Story: As a counsellor, I want High-Risk reports visually flagged at the top.
Priority: **Must**
AC: Given mixed-risk reports exist, then HIGH reports render first (newest-first within group), visually flagged red, followed by STANDARD; each row shows id, timestamp, risk_level, YES-answer summary, region, connect status — never a real name.
Dependencies: DASH-1, TRI-3.
DoD: 3 seeded reports (2 HIGH, 1 STANDARD) render in correct order with correct flags.

**DASH-3 — Pattern Watch tab**
Story: As an institutional reviewer, I want a separate, non-urgent tab for matches.
Priority: **Should**
AC: Given `pattern_matches` rows exist, then the tab shows linked `report_ids`, `created_at`, and a "Mark reviewed" button — visually distinct, no red flags, no urgent language.
Dependencies: DASH-1, PW-2.
DoD: PW-3's seeded match renders and can be marked reviewed.

**DASH-4 — Report detail view**
Story: As a counsellor following up, I want a full triage transcript for one report.
Priority: **Should**
AC: Given a report row is clicked, then all 8 `triage_answers` (question text + answer), `risk_level`, and any `sms_alerts` timestamps display.
Dependencies: DASH-2.
DoD: Detail view matches underlying DB rows exactly for a test report.

---

### EPIC: LANG — Multilingual Content Pipeline

**LANG-1 — Structured content schema**
Story: As a developer, I want every user-facing string served from `content_strings`, keyed by (key, language), so adding a language never touches bot logic.
Priority: **Must**
AC: Given a handler needs a string, when it calls `t(key, language)`, then it returns the matching row, or falls back to English (logging a warning) if the requested language's row is missing.
Technical notes: `t()` helper in `/server/lib/content.js`.
Dependencies: INF-2.
DoD: Zero hardcoded user-facing strings remain in handler code (verified by grep) once INF/TRI/HR/DIR are wired.

**LANG-2 — English content, all keys**
Story: As the content lead, I want every key populated in English first.
Priority: **Must**
AC: Given the full list of keys referenced in code, when diffed against `content_strings WHERE language='en'`, then zero are missing.
Dependencies: LANG-1 + every story introducing a new key (ongoing, not one-time).
DoD: Diff script returns zero missing keys, run before Sprint 3.

**LANG-3 — Swahili, FULL tier**
Story: As a Kenyan survivor, I want the entire experience in Swahili.
Priority: **Must**
AC: Given LANG-2 is complete, when Swahili translation finishes, then every key has a `language='sw'` row, `tier='FULL'`, `reviewed_by` set to the @KEN/@UGA volunteer's name, `reviewed_at` set.
Technical notes: AI-drafted first pass, human-reviewed per the committed standard — reviewer identity recorded, not just a boolean.
Dependencies: LANG-2, secured reviewer.
DoD: Full parity confirmed by the same diff script as LANG-2; reviewer sign-off recorded.

**LANG-4 — French, FULL tier (safety-critical subset first)**
Story: As the francophone-market proof point, I want the triage+safety-plan strings translated and reviewed by Nnouka first, then the rest.
Priority: **Must** (triage+safety-plan subset) / **Should** (full menu+directory parity)
AC: Given the ~35–40 triage+safety-plan keys, when reviewed by Nnouka, then `language='fr'`, `tier='FULL'`, `reviewed_by='Nnouka'` rows exist for all of them by Day 5. Given time remains, full parity follows the same process as LANG-3.
Dependencies: LANG-2.
DoD: At minimum, the safety-critical subset passes the diff check and is reviewer-signed; full parity is a stretch within the same story.

**LANG-5 — Arabic, conditional PARTIAL**
Story: As a stretch goal, I want the safety-critical subset in Arabic with RTL verified, if @EGY produces a reviewer.
Priority: **Could**
AC: Given a reviewer responds by Day 6, then the same subset as LANG-4's Must scope exists for `language='ar'`, `tier='PARTIAL'`, and manual check confirms correct RTL rendering in WhatsApp. Given no reviewer by Day 6, then it's not built, and the deck lists it as "planned, not yet reviewed."
Dependencies: LANG-2, uncertain external reviewer.
DoD: Either a reviewed PARTIAL subset exists, or the story is explicitly closed as "not attempted, no reviewer" — half-done is not an acceptable close.

**LANG-6 — Kinyarwanda, conditional architecture-only/PARTIAL**
Story: As a stretch goal, I want 1–2 proof screens in Kinyarwanda, upgradeable if Nnouka's Kigali network produces a reviewer.
Priority: **Could**
AC: Given no reviewer, then an AI-drafted, explicitly unreviewed 3–5 key set exists for `language='rw'`, `tier='ARCHITECTURE_ONLY'`, never surfaced in the live demo. Given a reviewer is found, upgrade as LANG-5.
Dependencies: LANG-2.
DoD: At least the architecture-only minimum renders correctly with an accurate tier label.

**LANG-7 — Shona/Ndebele, architecture-only carry-forward**
Story: As proof of prior work, I want the existing Shona strings wired into the same schema, so the coverage map is accurate.
Priority: **Could**
AC: Given prior content, when migrated with `tier='ARCHITECTURE_ONLY'`, then the 1–2 proof screens render correctly, clearly outside the live Kenya demo.
Dependencies: LANG-1.
DoD: Renders without error; not referenced in the default Kenya-pilot flow.

---

### EPIC: QA — Testing & QA

**QA-1 — Unit test coverage for scoring + hashing**
Story: As a developer, I want CI to run TRI-2's and SEC-1's tests on every push, so safety-critical logic can't silently break.
Priority: **Must**
AC: Given a push, then both suites run and must pass before Day 8 sign-off (full CI gating is a bonus, not required).
Dependencies: TRI-2, SEC-1.
DoD: Suites green; run instructions in README.

**QA-2 — End-to-end language-path test script**
Story: As QA owner, I want a written script covering English, Swahili, French journeys.
Priority: **Must**
AC: Given the script (`/docs/qa-script.md`), when run per language, then: language selection, all 3 menu paths, one HIGH and one STANDARD journey, and all 4 HR actions (safety plan, real SMS received, connect logged, trusted-contact alert if registered) all verified.
Dependencies: all Must-priority TRI/HR/DIR/LANG-3/4 stories.
DoD: Signed off by Day 8; failures logged and fixed or explicitly deferred with reasoning.

**QA-3 — Pattern Watch + dashboard verification**
Story: As QA, I want to confirm PW/DASH render correctly with seeded data before the demo.
Priority: **Must**
AC: Given PW-3's seed, then DASH-2/3/4 all render with no console errors.
Dependencies: PW-3, DASH-2/3/4.
DoD: Screenshot-verified checklist item, signed off by Day 8.

**QA-4 — Privacy audit**
Story: As product owner, I want a direct DB inspection confirming privacy guarantees hold in practice, not just in intent.
Priority: **Must**
AC: Given the full Day-8 database, when every table is inspected, then no row contains a raw perpetrator string or a legal name field.
Dependencies: SEC-1, SEC-2, PW-1, all Sprint 2 stories.
DoD: Signed checklist with query output saved as evidence, referenced in the written summary.

---

### EPIC: SUB — Submission Deliverables

**SUB-1 — Demo video**
Story: As the team, I want a recorded demo following the finalized script (English+Swahili full journey, French safety-plan cutaway, Standard-path lookup, Pattern Watch cutaway), so judges see a real product.
Priority: **Must**
AC: Real WhatsApp screens, a real SMS arriving, the real dashboard — no slides pretending to be the product.
Dependencies: QA-2, QA-3.
DoD: Final file produced within the hackathon's length limit, reviewed by both team members.

**SUB-2 — Pitch deck**
Story: As the team, I want a deck covering problem/users/solution/impact, the honest language-tier map, the team-credibility paragraph, and the Phase 2 roadmap.
Priority: **Must**
AC: Includes Kenya-specific stats (220 femicides 2025, 129 in Q1, government stopped publishing after March 2025), the risk-triage mechanism, the tiered coverage map, the Tendai+Nnouka team paragraph, and an honest Cameroon/Rwanda Phase-2 slide.
Dependencies: none blocking; content already locked in this conversation.
DoD: Finalized, proofread, exported.

**SUB-3 — Written summary**
Story: As the team, I want the required written summary covering track, sources, trust approach, AI tool usage.
Priority: **Must**
AC: Cites real sources (Böll Foundation, Africa Uncensored/Africa Data Hub, UN Women, HAK/1195), discloses every language's tier honestly, and describes the actual AI-tool workflow (TDD for scoring/hashing, bot scaffolding, translation-drafting with mandatory human review) — see `ai-tool-usage-log.md` for the full record this section draws from.
Dependencies: none blocking.
DoD: Matches the actual build — no claimed feature that wasn't really shipped.

**SUB-4 — GitHub README**
Story: As an outside reviewer, I want a clear README so I can understand and run the project unaided.
Priority: **Must**
AC: Includes project description, architecture summary, setup instructions (env vars, migrations, local run), the language-tier table, and an explicit "real vs. simulated" section (counsellor connect is a demo SMS, not a live HAK integration; WhatsApp number used directly, no masked relay; rights content is unreviewed example text).
Dependencies: effectively all build stories.
DoD: The non-developer team member can clone and run it locally using only the README.
