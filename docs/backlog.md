# Vimbiso — Build Backlog (Epics, Sprints, User Stories)

*Prepared with Tendai Moyo — locked against the finalized MVP spec (`vimbiso-mvp-spec.md`): Kenya pilot, WhatsApp-only, risk-triage-first safety mechanism, English/Swahili/French at FULL tier, Arabic/Kinyarwanda conditional, web dashboard + SMS alerting, Pattern Watch demoted to a non-urgent institutional signal.*

This document is meant to be handed story-by-story to a developer or a coding agent. Nothing below re-opens a decision already made in the MVP spec — it decomposes locked decisions into buildable work. Update it as the build progresses; it's a living backlog, not a frozen spec.

---

## 1. Epics

| Epic | Goal | Done when | Status |
|---|---|---|---|
| **SEC** — Security & Privacy Foundations | Establish the no-real-name, consent-gated, hashed-identifier data model everything else builds on | No table anywhere stores a legal name or raw perpetrator text; every cross-report action requires explicit consent | Done — SEC-1/2/3 all verified live against a real database in Sprint 3 |
| **INF** — Infrastructure & WhatsApp Bot Skeleton | Stand up the channel, backend, DB, and conversation state machine | A tester can message the sandbox number, pick a language, and reach the main menu, fully logged to Postgres | In progress — INF-2/4 verified live against real Postgres in Sprint 3; INF-1 (live Twilio deploy) and INF-3's 24h-reset half still open |
| **TRI** — Risk Triage & Scoring Engine | Implement the 8-question triage and deterministic scoring | Any completed triage produces a stored risk_level matching the documented override/threshold rules, proven by unit tests | Done — TRI-1/2/3 all verified live against real Postgres in Sprint 3 |
| **HR** — High-Risk Automatic Response | Fire safety plan, counsellor SMS alert, and trusted-contact alert automatically on a single HIGH-risk report | A HIGH-risk test report triggers all four actions with zero human trigger and zero dependency on a second report | HR-1/HR-3/HR-5 verified live against real Postgres (English + Swahili; HR-5 found + closed via live Twilio Sandbox testing); HR-2/HR-4's real-Twilio-send half remains this project's one categorical sandbox limitation |
| **DIR** — Resource Directory / Standard-Risk Path | Serve a real, sourced, dated Kenyan resource directory | Every resource response includes a name, phone, source, and last-verified date | DIR-2/3 verified live against real Postgres in Sprint 3 (all 3 region options, rights disclaimer); DIR-1's human spot-check of live source_urls is still the one open item, unchanged from Sprint 2 |
| **PW** — Pattern Watch | Consent-gated, hashed, non-urgent repeat-perpetrator matching, clearly demoted from the primary safety path | Two seeded reports naming the same identifier produce a visible dashboard match, with zero plaintext perpetrator data anywhere | Done — PW-1/2/3 all verified live against real Postgres in Sprint 3, including a genuine live conversation merging into pre-seeded match data; DASH-3's own rendering check remains open (see DASH row) |
| **DASH** — Counsellor Web Dashboard | Give counsellors/reviewers a queue view (High-Risk pinned) and a separate Pattern Watch tab | A logged-in reviewer sees reports sorted correctly and matches in a clearly non-urgent separate tab | DASH-4 done; DASH-1/2/3's underlying queries and mutations all verified live against real Postgres data in Sprint 3 (`docs/qa-sprint3-report.md`), but actual Express/EJS rendering has not run in this sandbox — that's the one remaining gap across the whole epic |
| **LANG** — Multilingual Content Pipeline | Key-based content schema serving English/Swahili/French at FULL tier, Arabic/Kinyarwanda conditionally, Shona/Ndebele as architecture-only | All bot-facing strings come from the schema, tier labels are accurate, and English+Swahili+French pass the parity check | In progress — schema + English done (LANG-1/2); Swahili/French/etc. not started |
| **QA** — Testing & QA | Verify every language path and every risk branch before recording anything | A signed-off test script confirms all Must-priority flows work end-to-end on the deployed environment | QA-4 done; QA-1's suites re-verified via real `tsc` (Sprint 2); QA-2/QA-3 have real evidence in `docs/qa-script.md`/`docs/qa-sprint3-report.md` but remain open on the French journey and actual dashboard rendering respectively |
| **SUB** — Submission Deliverables | Produce the demo video, pitch deck, written summary, README | All four artifacts exist, are accurate to what was actually built, and are submitted | SUB-2/3/4/5 done (pitch deck as required PDF, written summary, README); SUB-1 has a finalized shootable script but the actual video requires a live Twilio Sandbox this sandbox cannot reach — the one item needing the human team |
| **COMM** — Reviewer & Community Coordination | Get a real fluent-speaker review of Swahili (and Arabic, as upside) before submission | A named human reviewer has actually reviewed the safety-critical strings, not just been asked | Not started — COMM-1 (Swahili/@KEN) surfaced late by a Tendai-role planning pass; requires a human to post in a real community channel, which no tool here can do |
| **LOG** — Message Audit & Replay Logging | Log every inbound/outbound message in a replayable, pseudonymous form for data analysis, with a lawful (not casual) way to re-identify a sender if privacy protections are properly lifted, plus a dev-only console mirror | A full conversation can be reconstructed from `message_log` alone by a one-way pseudonym with encrypted body content; a designated custodian can lawfully recover a real number through an audited, out-of-band procedure that no ordinary code path can trigger; and the same content mirrors to the console in dev only | Done — LOG-1/LOG-2/LOG-3 all built and verified against a real local database (2026-09-15): irreversible pseudonymization, encrypted-at-rest message bodies, correct hook-point wiring on every real inbound/outbound send path, a dev-only console mirror correctly gated on `NODE_ENV`, and a standalone, never-imported `recoverSenderIdentity.ts` script that performed a real recovery of a real pseudonym with an audit-trail row written. Retention period and key-custody policy remain open, flagged questions — not implementation gaps |

*Status is tracked at the story level below (Section 5) — each story's `[x]`/`[ ]` and one-line "Status:" note is the source of truth; this row is just a roll-up.*

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
message_log (
  id, occurred_at timestamp, direction ['inbound'|'outbound'], channel ['whatsapp'|'sms'],
  sender_pseudonym,      -- HMAC-SHA256(whatsapp_number, MESSAGE_LOG_HASH_SECRET) — a SEPARATE secret from
                         -- PERPETRATOR_HASH_SECRET (SEC-1), so recovering one hash space never lets anyone
                         -- correlate into the other. Stable per real number, so one sender's conversation
                         -- can be grouped/replayed WITHOUT identifying them — this value alone is never
                         -- reversible, by anyone, under any circumstance (see sender_identity_map below
                         -- for the SEPARATE, deliberately harder-to-reach mechanism that is)
  message_type ['text'|'button_reply'|'list_reply'|'sent_text'|'sent_buttons'|'sent_list'|'sent_sms'],
  button_id null,        -- plaintext; UI ids like 'lang_en'/'connect_yes' are not PII
  body_ciphertext bytea null, body_iv bytea null, body_auth_tag bytea null,  -- AES-256-GCM, key = MESSAGE_LOG_ENCRYPTION_KEY
  report_id FK null      -- nullable, analysis-convenience correlation only — never used for operational sending logic
)  -- added by LOG-1; a PARALLEL, analysis-only audit trail — does NOT replace or anonymize `reports.whatsapp_number`,
   -- which must stay real for SMS/trusted-contact alerts to keep working (see SEC-2's existing scope note on this)
sender_identity_map (
  sender_pseudonym PK,   -- same value as message_log.sender_pseudonym — the join key between the two
  encrypted_real_number bytea, iv bytea, auth_tag bytea,  -- AES-256-GCM, key = SENDER_IDENTITY_RECOVERY_KEY
                         -- (a THIRD secret, distinct from both other keys above — see LOG-3)
  first_seen_at timestamp
)  -- added by LOG-3; ONE row per unique real sender (not per message, to keep the reversible-PII surface
   -- as small as possible); written once automatically, decrypted only by an out-of-band lawful-access
   -- procedure — no normal application code path ever reads/decrypts this table
identity_recovery_log (
  id, sender_pseudonym, recovered_by, recovered_at, legal_basis, case_reference
)  -- added by LOG-3; append-only audit trail of every time re-identification actually happened —
   -- re-identifying a survivor must never be silent, even when it's lawfully justified
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
**Status:** Code-complete for every story in scope (plus a full TypeScript conversion of all of it, done as an unplanned cross-cutting follow-up). SEC-1, TRI-2, and LANG-1 are fully done — their DoD required only unit tests/code review, both of which have run. Everything else in this sprint is implemented but still needs a live run against a real Postgres + Twilio Sandbox to close out (blocked in the dev sandbox that built this by `npm install` being unreachable — see `docs/ai-tool-usage-log.md`); see each story's `Status:` line below for specifics.

### Sprint 2 — Core Safety Features (Days 4–7)
**Goal:** Every report — HIGH or STANDARD — produces its correct automatic response end-to-end, visible in a working dashboard, in English, Swahili, and (safety-plan subset) French.
**In scope:** HR-1, HR-2, HR-3, HR-4 · DIR-1, DIR-2, DIR-3 · PW-1, PW-2, PW-3 · DASH-1, DASH-2, DASH-3, DASH-4 · LANG-3, LANG-4 (+ LANG-5/6/7 opportunistically) · SEC-3 disclosure wired in.
**Sprint done when:** QA-1 tests pass; a HIGH-risk test report fires safety plan + real SMS + (if registered) trusted-contact alert; dashboard shows it pinned; a seeded Pattern Watch match renders in its own tab.
**Dependency note:** HR-1 depends on TRI-3 (Sprint 1) and DIR-1 (hotline number must be seeded first, since HR-1 pulls it from `resources`, not a hardcoded string). DASH depends on data existing from HR/DIR/PW. PW-1 depends on SEC-1/SEC-2.
**Status:** HR-1..4, DIR-1..3, and PW-1..3 are all code-complete as of this PR (Backend), wired into `conversation.ts`'s Sprint 1 state machine per its existing patterns, with `alertOnCallCounsellor()` landing in `sms.ts` (Networking) matching sprint-2-plan.md §3.2 exactly. Verified end-to-end with a hand-rolled in-memory-DB/Twilio integration harness in this sandbox (`npm install` still blocked here — see `docs/ai-tool-usage-log.md`) covering: full HIGH journey (safety plan -> real seeded hotline -> connect -> SMS alert logged -> trusted-contact alert -> PW-1 consent -> hash written), a second report sharing the same identifier producing a real `pattern_matches` row, HR-3 registration (valid + invalid input), STANDARD -> DIR-2 (both entry points) -> PW-1, and DIR-3. None of this has been run against a live Postgres/Twilio Sandbox yet — that remains the honest gap before these can be ticked `[x]`, same bar as Sprint 1. The dashboard (`dashboard/`) — DASH-1..4 — is separately code-complete against real Postgres data as of Frontend's PR (real auth, real reports queue, real Pattern Watch tab + review action, real report detail), pending the same live/Playwright verification; see DASH-1..4 below for specifics.

**PM integration pass (post-merge):** independently re-ran QA's 13 `patternMatch.test.ts` cases against Backend's `patternMatch.ts` with a fresh jest-shim (not reusing Backend's own harness) — all 13 pass. Also ran a real `tsc --noEmit`-equivalent check (this sandbox has a global TypeScript install even though `npm install` is blocked — see `docs/ai-tool-usage-log.md` for exactly how, since it's a reusable trick for the rest of this build): every Sprint 1 + Sprint 2 `server/**/*.ts` and `dashboard/**/*.ts` file compiles clean against a hand-built ambient-types shim (`pg`/`twilio`/`express`/`bcrypt`/`jest` globals stood in for the real `@types/*` packages, which also aren't installable here), with only 3 residual errors — all three independently confirmed to be limitations of the hand-built shim itself (an overly-strict local `test.each` stub, an untyped `fs` stub), not real defects. This DID catch one real, genuine bug before it reached anyone: `server/seeds/content_en.ts` had `menu.body` defined twice (Sprint 1's original 3-option body, plus Sprint 2's 4-option body appended below it) — a duplicate object-literal key that TypeScript's strict mode flags as a hard compile error (`TS1117`). Fixed by removing the stale Sprint 1 line; Sprint 2's 4-option version is now the only one. This is exactly the class of bug a real `npm run typecheck` exists to catch — worth noting for the written summary's AI-tool-usage section.

### Sprint 3 — Testing & Submission (Days 8–10)
**Goal:** A judge can watch a demo showing a real, working, multilingual safety journey and read a submission package that's honest about scope.
**In scope:** QA-2, QA-3, QA-4 (Day 8) · SUB-1, SUB-2, SUB-3, SUB-4 (Days 9–10).
**Sprint done when:** All four submission artifacts exist and match what was actually built — no feature claimed in the deck/video that isn't real in the repo.
**Dependency note:** QA-2/QA-3 must pass *before* SUB-1 recording starts — never script a demo around a feature that hasn't been verified working.
**Status:** QA-2/QA-3/QA-4 done for real this sprint using two newly-discovered sandbox capabilities (a global `tsc`/`tsx` and a pre-installed local PostgreSQL 16) — every migration, seed, and the full `conversation.ts` state machine ran as real code against a real database across 5 conversation journeys, with results captured in `docs/qa-script.md` and `docs/qa-sprint3-report.md`, and reflected in updated checkboxes across Section 5 above (see each story's Status: line for exactly what's now proven vs. still open). Real gaps remain and are stated plainly rather than glossed: no live Twilio Sandbox round-trip, no real SMS/WhatsApp send, no French journey run, no actual Express/EJS dashboard rendering. SUB-2/3/4 (pitch deck, written summary, README) are complete deliverable files/sections; SUB-1 (demo video) has a finalized, shootable script (`docs/demo-script.md`) but the actual recorded file does not exist and cannot be produced from inside this sandbox — it needs a live Twilio Sandbox and real phones, which is Nnouka/Tendai's Day 9–10 task.

---

## 5. User Stories

**Status convention:** `- [x]` = this story's DoD has been fully met, including any live/manual verification it calls for — not just "the code exists." `- [ ]` = not yet, whether that means untouched, code-complete-but-unverified, or blocked on something else. Every story carries a one-line `Status:` note explaining exactly where it stands — read that before assuming `[ ]` means "nothing done." Whoever's PR finally satisfies a story's full DoD flips its box to `[x]` and updates the `Status:` line as part of that PR (see `CONTRIBUTING.md`) — don't tick it in a separate docs-only commit disconnected from the work that finished it.

### EPIC: SEC — Security & Privacy Foundations

- [x] **SEC-1 — Perpetrator identifier hashing utility**
Story: As a backend developer, I want a reusable server-side function that normalizes and salt-hashes a perpetrator identifier string, so that no raw perpetrator-identifying text is ever persisted.
Priority: **Must**
AC:
- Given a raw string like "John, my husband, Kibera", when passed through `normalizeAndHash(text)`, then it returns a deterministic HMAC-SHA256 hash of the lowercased, trimmed, punctuation-stripped string.
- Given the same identifier typed with different casing/spacing, when hashed twice, then both calls produce the same hash.
- Given any input, when processed, then the raw text is never written to any table — only `perpetrator_hashes.hash_value` is stored.
- Given no perpetrator text is supplied, when a report is submitted, then no row is created in `perpetrator_hashes`.
Technical notes: Node `crypto` module, HMAC-SHA256, secret in env var `PERPETRATOR_HASH_SECRET`; normalization = lowercase, trim, collapse whitespace, strip punctuation; implement in `/server/lib/hashing.js` with tests in `hashing.test.js`.
Status: Implemented in `server/lib/hashing.ts`; ≥5 unit tests exist and pass; code-reviewed for zero raw-text writes.
Dependencies: none.
DoD: Function implemented, ≥5 unit tests passing, code review confirms no code path writes raw text anywhere.

- [x] **SEC-2 — No-real-name schema + consent flags**
Story: As a product owner, I want `reports` and `trusted_contacts` to have no legal-name field and to gate every cross-report or outbound action behind an explicit consent flag.
Priority: **Must**
AC:
- Given the `reports` schema, when inspected, then it contains no `name`, `legal_name`, or `id_number` column.
- Given `perpetrator_consent_given` is false/null, when a report closes, then no `perpetrator_hashes` row is written for it.
- Given a survivor hasn't tapped "Yes, connect me," when the HIGH-risk flow runs, then `wants_counsellor_connect` stays false and no SMS fires.
Technical notes: add `perpetrator_consent_given boolean default false`, `wants_counsellor_connect boolean default false`, `connect_requested_at timestamp null` to `reports` (per Section 2).
Status: All three AC clauses now confirmed against a real, live-exercised Postgres database in Sprint 3 (not just read in the code): `\d reports`/`\d trusted_contacts` show no `name`/`legal_name`/`id_number` column anywhere in the schema; a direct join query (`docs/qa-sprint3-report.md` §2) confirms every report with `perpetrator_consent_given=false` has zero `perpetrator_hashes` rows, and every report with `wants_counsellor_connect=false` has zero `sms_alerts` rows — including a HIGH-risk report (id 2) that never tapped connect-yes, proving the gate is on the actual tap, not just risk level. README now has a full Privacy section (`README.md` §"Privacy") documenting all of this, including the phone-masking judgment call. DoD's three clauses (migration applied; schema matches; documented in README) are all satisfied.
Dependencies: none.
DoD: Migration applied; schema matches this checklist; documented in README's Privacy section.

- [x] **SEC-3 — Transit-privacy disclosure**
Story: As a survivor, I want to be told, before typing anything sensitive, that this chat runs over WhatsApp/Twilio and isn't a zero-knowledge system, so I can decide what to share.
Priority: **Should**
AC: Given language selection just completed, when the main menu is about to show, then a one-line disclosure fires first (per language): *"This chat runs over WhatsApp. We don't store your name, but WhatsApp/our phone provider can see this conversation exists. Consider deleting this chat afterward."* Fires exactly once per conversation.
Technical notes: content key `disclosure_message`; track via `conversation_state.disclosure_shown`.
Status: Verified in Sprint 3 against a real live-exercised database, in both English and Swahili: every one of the 5 real conversation journeys driven this sprint shows `conversation_state.disclosure_shown=true`, with no duplicate disclosure line appearing in any captured message log across multi-message sessions — confirming exactly-once behavior, not just that the flag exists.
Dependencies: INF-3.
DoD: Fires once per new conversation, in the selected language, verified manually.

---

### EPIC: INF — Infrastructure & WhatsApp Bot Skeleton

- [ ] **INF-1 — Provision Twilio WhatsApp Sandbox + backend**
Story: As a developer, I want a deployed Express backend wired to a Twilio WhatsApp Sandbox number, so messages can flow both ways.
Priority: **Must**
AC: Given a tester joins the sandbox via join code, when they send any message, then `POST /webhook/whatsapp` receives it and the backend echoes a reply within 5 seconds.
Technical notes: Twilio WhatsApp Sandbox, Express route, Twilio Node SDK, hosted on Railway/Render, env vars `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`WHATSAPP_FROM`.
Status: Webhook route + `verifyWebhookSignature` implemented in `server/routes/webhook.ts`. Live Twilio Sandbox testing (Nnouka, 2026-09-14) confirmed the round-trip reaches the webhook, but surfaced two real bugs in sequence, both fixed and both verified against a real database (not just read/reasoned about):

1. `handleIncomingMessage` threw inside `sendList` because `content_strings` was empty on that environment (migrations auto-run on `npm run dev` boot per `server/index.ts`, but seeding is a separate manual `npm run seed` step). Fixed: `content.ts`'s bare-key fallback now truncates to 20 chars (WhatsApp's tightest UI-chrome limit) so it can never crash a send again, plus a new `assertCriticalContentSeeded()` startup check names exactly which keys are missing.
2. With that fixed, the language selector rendered correctly (confirmed from a real screenshot of the live WhatsApp thread), but tapping a language left the survivor stuck re-seeing the same selector forever. Root cause: this file's own prior comment had flagged its `ButtonPayload`-for-list-taps assumption as "NOT VERIFIED against a live payload... the single highest-risk assumption in this file" — and live testing showed it was wrong, or at least incomplete: a list-picker row tap does not reliably surface in `ButtonPayload` the same way a quick-reply button tap does. Fixed: `extractButtonId()` now tries `ButtonPayload` first (quick-reply buttons unchanged), then falls back to parsing `InteractiveData`'s `list_reply.id` (WhatsApp Cloud API's own shape for a list-row selection) or `button_reply.id`, never throwing on malformed JSON. Verified end-to-end against a real database: a real inbound-webhook POST shaped exactly like the hypothesized failure (`ButtonPayload` absent, `InteractiveData` carrying `list_reply.id: "lang_en"`) now correctly advances `conversation_state` from `AWAITING_LANGUAGE` to `MAIN_MENU` with `language='en'` — reproducing the reported "stuck at language select" bug and confirming the fix closes it, for this payload shape. **Honest caveat:** this fix is evidence-based (Twilio's own docs distinguish button vs. list interaction data) but not yet confirmed against Nnouka's *actual* captured payload, since this sandbox can't reach their live Sandbox — a diagnostic log line (`webhook: inbound — ButtonPayload=... InteractiveData=... resolvedButtonId=...`) was added specifically so the next real tap either confirms this was the right shape or shows immediately what Twilio actually sent instead.

3. That fix's own honest caveat turned out to matter: Nnouka's very next live tap was STILL stuck at the language selector, but the new diagnostic log line this time showed something different from what #2 above hypothesized — `ButtonPayload=undefined ... InteractiveData=undefined resolvedButtonId=null`, i.e. `extractButtonId()` correctly found nothing, because Twilio genuinely sent nothing interactive at all. `Body` carried `"lang_en"` literally — the row's own internal id, not its display title ("English") and not real free text a survivor would type. The only explanation consistent with that evidence: on the free Twilio WhatsApp Sandbox, this app's `twilio/list-picker` messages (`sendList()` in `whatsapp.ts`, whose own header already flagged this exact content type as its second-highest risk) are not arriving at WhatsApp as genuinely interactive — whatever the survivor's client does when "selecting" a row, Twilio's webhook reports an ordinary text message whose body happens to be the row's id. Rather than guess further at Sandbox internals unreachable from this build environment, fixed where it's actually observable: `conversation.ts` now collects every literal button/list id it ever hands to `sendButtons()`/`sendList()` into one `KNOWN_INTERACTIVE_IDS` set, and `handleIncomingMessage()` promotes an inbound plain-text `Body` that exactly matches one of them to a real `buttonId` before any step handler sees it — so a genuine tap and a Sandbox-degraded-to-text one are handled identically everywhere in the file. Only fires when `buttonId` is already null, so it can never override a real interactive tap; the ids are internal snake_case tokens no survivor would plausibly type as real free text, so the false-positive risk is negligible. Verified against a real database with a payload shaped exactly like the real reported one (`Body: "lang_en"`, zero interactive fields): the survivor's session now correctly advances from `AWAITING_LANGUAGE` to `MAIN_MENU` with `language='en'`, reproducing the reported bug and confirming the fix closes it — plus two regression checks confirming a genuine `ButtonPayload` tap still works unchanged, and that real unrelated free text (e.g. "I want English please") still correctly re-prompts rather than being over-matched.

4. Related UX gap, flagged proactively by Nnouka (2026-09-15), not a bug report: "not all users may understand that they need to click and select, they may actually just send the number representing the option... the app should understand the option selected too." This is distinct from #3 above (a Sandbox-transport degradation) — this is a real survivor typing the plain digit of the option they want ("1") instead of tapping it at all, on a genuinely interactive send. Fixed with a second, complementary mechanism in `conversation.ts`: a new `NUMBERED_OPTIONS_BY_STEP` map (plus a shared `TRIAGE_NUMBERED_OPTIONS` list, since every `TRIAGE_*` step sends the same 3 buttons) gives the exact ordered option-id list each option-presenting step last sent, and `handleIncomingMessage()` promotes a bare-digit `Body` to the buttonId at that 1-indexed position — scoped strictly to `state.current_step` (never a global lookup, since a digit's meaning only makes sense relative to whichever list was just sent). Covers the language selector, main menu, all 8 triage questions, the HR-2 connect prompt, the DIR-2 region picker, and the PW-1 consent prompt. Deliberately excludes `AWAITING_TRUSTED_CONTACT_NUMBER` and `AWAITING_PW_IDENTIFIER` (both expect genuine free-typed text where a bare digit could be a real survivor-typed value, e.g. the start of a phone number) — `numberedOptionsForStep()` returns `null` for both, so a digit there falls through unchanged to each step's own existing handler. Verified against a real database via `/tmp/vimbiso-e2e/numbered-options-check.ts`, 12 checks, all passing: typing "1" at the main menu starts triage exactly like tapping "Report something" (the user's own example); typing "2" at the language selector selects Swahili; typing "4" at the main menu reaches the trusted-contact step; typing "1"/"3" mid-triage records YES/SKIP and advances correctly (confirmed the actual `triage_answers` row, not just `current_step`); typing "2" at the region picker resolves Mombasa; an out-of-range digit ("9" at a 4-option menu) is left untouched and safely re-prompts; a real `ButtonPayload` tap and the earlier `KNOWN_INTERACTIVE_IDS` text-id promotion (#3 above) both still work unchanged (no regression, no conflict between the two mechanisms) — and, critically, the safety check: a bare digit ("1") sent while `AWAITING_TRUSTED_CONTACT_NUMBER` stays on that same step with the existing "that doesn't look like a complete WhatsApp number" re-prompt, confirming it is never misread as a menu choice.

Still open: the actual live echo-within-5-seconds round-trip, now that four real crashes/stuck-states/UX gaps are fixed — re-test needed. Also genuinely open: WHY the Sandbox's list-picker content type degrades to plain text like this (#3) is still not confirmed against Twilio's own documentation of that specific failure mode (unreachable from this build environment) — that fix is evidence-based and defensive, not a confirmed root-cause explanation of the Sandbox's behavior itself.
Dependencies: none.
DoD: Deployed and reachable; echo test passes in the Twilio console.

- [x] **INF-2 — Postgres schema + migrations**
Story: As a developer, I want the full schema (Section 2) created via migrations, so every later story has somewhere to read/write.
Priority: **Must**
AC: Given the migration runner executes, when it completes, then every table in Section 2 exists with the listed fields.
Technical notes: `node-pg-migrate` or Prisma, one migration per table.
Status: Run for real in Sprint 3 against a fresh local PostgreSQL 16 instance (this sandbox's actual `server/migrations/run.ts`, executed via `tsx` since `npm install` is blocked — same script `npm run migrate` wraps): all 11 tables created cleanly (`\dt` confirms every one), matching `docs/data-model.md`. DoD satisfied.
Dependencies: none.
DoD: `npm run migrate` runs clean on a fresh DB; matches Section 2 exactly.

- [ ] **INF-3 — Conversation state machine + language selector**
Story: As a survivor, I want to pick my language on first contact, so everything after is understandable.
Priority: **Must**
AC: Given a first-time sender, when they message the number, then they get a list message: "English / Kiswahili / Français" (+ additional options once LANG-5/6 are live); given a selection, then `conversation_state.language` persists for the session; given 24h of inactivity, then the next message re-prompts language selection.
Technical notes: `conversation_state` table (Section 2); Twilio interactive List Message type.
Status: Language persistence confirmed in Sprint 3 against a real database across 5 real multi-message conversation journeys (each 5-14 messages long) — `conversation_state.language` set once at selection and correctly used for every subsequent send in that session, in English and Swahili. The 24h-stale-reset half of this DoD remains unverified: it requires either real elapsed time or a mocked clock, neither attempted this sprint. Not tickable as fully done until that half is checked too.
Dependencies: INF-1, INF-2.
DoD: Language persists across a multi-message session; resets after the 24h Twilio session boundary.

- [x] **INF-4 — Main menu**
Story: As a user, I want a menu after language selection, so I can choose what I need.
Priority: **Must**
AC: Given language is set, when the menu sends, then it shows exactly three translated options: "Report something that happened" / "Find help near me" / "Know your rights," each routing correctly (to TRI-1, DIR-2, DIR-3 respectively).
Technical notes: strings from `content_strings` keys `menu.report`/`menu.find_help`/`menu.rights`.
Status: All three paths now real (DIR-2/DIR-3 landed in Sprint 2) and all three verified in Sprint 3 by real execution against a live database: "Report something that happened" (Journeys A/B/E), "Find help near me" (Journeys C/D), "Know your rights" (Journey C) — see `docs/qa-script.md` §2. All English, all confirmed routing correctly.
Dependencies: INF-3, LANG-1.
DoD: All three paths route correctly in English, manually verified.

- [ ] **INF-5 — Device-safety guidance ("quick exit" equivalent)**
Story: As a survivor worried about someone checking my phone, I want basic device-safety guidance, so using Vimbiso doesn't add risk.
Priority: **Should** (first cut if time is short)
AC: Given the main menu, when the user sends "0" or "help hiding this," then the bot sends guidance: save the contact under a neutral name, use WhatsApp's own Clear Chat/Archive, and an honest note that there is no disguised app in this PoC.
Technical notes: content key `guidance.device_safety`.
Status: Implemented (triggers on "0"/"help hiding this"); not yet live-verified or copy-checked against current WhatsApp UI.
Dependencies: INF-4.
DoD: Sends correctly; copy checked against current WhatsApp UI terminology.

---

### EPIC: TRI — Risk Triage & Scoring Engine

- [x] **TRI-1 — Triage question flow**
Story: As a survivor, I want to answer 8 short yes/no questions one at a time via tappable buttons, so I don't have to type sensitive details.
Priority: **Must**
AC: Given "Report something that happened" is selected, when the flow starts, then question 1 (STRANGLE, per Section 3) sends as a Quick Reply button set (Yes/No/Prefer not to say); each answer writes a row to `triage_answers` and advances to the next question in the fixed order (STRANGLE → WEAPON → KILL_THREAT → ESCALATION → SEPARATION → SEXUAL_COERCION → CONTROL → SELF_PERCEIVED_DANGER); "Prefer not to say" stores as `SKIP`.
Technical notes: Twilio interactive buttons; create a `reports` row with `status='IN_PROGRESS'` at flow start; `conversation_state.current_step` tracks progress.
Status: Confirmed against a real live database in Sprint 3 — `SELECT question_key, answer FROM triage_answers WHERE report_id=4 ORDER BY id` returns all 8 questions in the exact fixed order (STRANGLE→WEAPON→KILL_THREAT→ESCALATION→SEPARATION→SEXUAL_COERCION→CONTROL→SELF_PERCEIVED_DANGER), all tied to one `report_id`. DoD satisfied.
Dependencies: INF-3, INF-4, LANG-2 (and LANG-3/4 for translated versions).
DoD: A full English run produces 8 `triage_answers` rows tied to one `report_id`, verified in the DB.

- [x] **TRI-2 — Risk scoring function**
Story: As a developer, I want a pure, tested function implementing the Section 3 rules, independent of the bot.
Priority: **Must**
AC (examples, not exhaustive):
- Given STRANGLE=YES, all others NO → HIGH (override).
- Given all 8 = NO → STANDARD.
- Given exactly 4 of {ESCALATION, SEPARATION, SEXUAL_COERCION, CONTROL, SELF_PERCEIVED_DANGER} = YES, no override triggered → HIGH (threshold).
- Given exactly 3 of those 5 = YES, no override → STANDARD.
Technical notes: `scoreRisk(answers): 'HIGH'|'STANDARD'` in `/server/lib/riskScoring.js`, no DB access; `SKIP` = `NO`.
Status: `scoreRisk()` implemented in `server/lib/riskScoring.ts`; 14 unit tests cover every override key individually, the 4-vs-3 threshold boundary, and all-NO — all passing.
Dependencies: none (parallel-buildable with TRI-1).
DoD: ≥10 unit tests covering every override key individually, the 4-vs-3 threshold boundary, and all-NO — all passing.

- [x] **TRI-3 — Wire scoring into the flow**
Story: As the system, I want risk scored immediately after the 8th answer, so the correct response fires without delay.
Priority: **Must**
AC: Given the 8th answer is received, when processed, then `scoreRisk()` runs, `reports.risk_level` and `status='SCORED'` are set, and control passes to HR-1 (if HIGH) or DIR-2 (if STANDARD) in the same handling cycle — no extra user action required.
Status: Verified live in Sprint 3, twice (English Journey A, Swahili Journey E) — STRANGLE=YES with all other 7 answers NO auto-triggers `risk_level='HIGH'`, `status='SCORED'`, and the HR-1 sequence, all within the same handling cycle as the 8th answer, with zero extra user action. Journey B (all 8 NO) confirms the STANDARD branch equally auto-fires into DIR-2's handoff.
Dependencies: TRI-1, TRI-2.
DoD: Manual test — YES to Q1 only auto-triggers the HIGH branch with no further input.

---

### EPIC: HR — High-Risk Automatic Response

- [x] **HR-1 — Immediate safety-plan sequence**
Story: As a survivor scored HIGH, I want clear guidance immediately, so I know what to do without waiting on anyone.
Priority: **Must**
AC: Given `risk_level=HIGH`, when the response fires, then the bot sends, in the user's language: (1) danger-intro line, (2) the safety-plan list (pack a bag, identify a safe neighbor, memorize one number, keep phone charged), (3) the real hotline number pulled from `resources`, (4) a Yes/No "connect me to a counsellor now?" prompt.
Technical notes: keys `highrisk.intro`/`highrisk.plan_1..4`/`highrisk.connect_prompt`; hotline number queried from `resources` (category='hotline', country='KE'), never hardcoded.
Status: Sprint 3 ran this live, for real, against a real Postgres database, in BOTH required languages — Journey A (English) and Journey E (Swahili), added specifically to close the Swahili gap this DoD calls for. All 4 parts fired correctly in both, in the same handling cycle as the 8th triage answer (no added pause), with the hotline number genuinely queried live from `resources` at send time. In Swahili, every `highrisk.*`/`pw.consent_prompt` key resolved to real Swahili text with zero fallback warnings — confirming the safety-critical Swahili content actually works end-to-end, not just that the seed file contains it. Remaining caveat: this is real code executed against a real database with a capturing (never-network) Twilio stand-in — it is not a live Twilio Sandbox send, and the Swahili *translation quality itself* remains unreviewed by a fluent speaker (tier='PARTIAL', per LANG-3) — this DoD is about the sequence firing correctly, which it does, not about translation accuracy sign-off, which is tracked separately under LANG-3/4.
Dependencies: TRI-3, DIR-1.
DoD: All 4 parts arrive within 5 seconds, verified in English and Swahili.

- [ ] **HR-2 — Counsellor-connect logging + real SMS alert**
Story: As an on-call counsellor, I want an immediate SMS when a survivor requests connection, so I can call back without watching a chat app.
Priority: **Must**
AC:
- Given "Yes" is tapped, when processed, then `wants_counsellor_connect=true`, `connect_requested_at` is set, a `sms_alerts` row is written, and a real Twilio SMS is sent to `ONCALL_COUNSELLOR_PHONE` containing only `report_id`, `risk_level`, and timestamp — no survivor name/number in the SMS body.
- Given "No" is tapped, when processed, then no SMS fires and the hotline number remains visible for self-service.
Technical notes: Twilio SMS API; `sms_alerts(id, report_id, sent_to, sent_at, twilio_sid, status)`.
Status: Wired into `conversation.ts`'s `handleConnectResponse`: "Yes" sets `wants_counsellor_connect=true`/`connect_requested_at=now()`, calls Networking's `alertOnCallCounsellor(reportId, riskLevel)` (sms.ts — Backend does not hand-format the SMS body), and writes an `sms_alerts` row with the returned `twilio_sid` (status `'sent'`, or `'failed'` with a null sid if the SMS call throws, so a failed send stays visible for audit rather than silently disappearing). "No" sends no SMS. Sprint 3 re-confirmed this against a real Postgres database (not just the in-memory harness): exactly one `sms_alerts` row exists in the whole database (report 4, `sent_to=+15005550006`, `status='sent'`), and a live join query confirms every OTHER report — including a HIGH one that never tapped connect-yes — has zero `sms_alerts` rows. Still NOT verified as a real SMS against a live Twilio account/test phone (this environment cannot reach the Twilio API); that live send remains this story's one open item and blocks SUB-1's demo recording per `docs/backlog.md`'s own dependency note. **Superseded call site:** live Twilio testing surfaced that `ONCALL_COUNSELLOR_PHONE` gave counsellors no way to register their own number, so `handleConnectResponse` now calls the plural `alertOnCallCounsellors()` instead (writing one `sms_alerts` row per recipient) — see HR-5. This AC's core behavior (report_id/risk_level/timestamp-only SMS body, one `sms_alerts` row per send, "No" sends nothing) is unchanged; only the recipient-selection logic moved. **SMS wording rewritten 2026-09-15** (Nnouka's real feedback: `Vimbiso alert: report #6, risk=HIGH, 2026-09-14T12:09:27.551Z` reads like a system log line, not something that makes a counsellor act): both `alertOnCallCounsellor()` and `alertOnCallCounsellors()` now build their body through one shared `buildAlertBody()` so the two call sites can't drift, producing e.g. `Vimbiso URGENT: report #6 - someone on our safety line may be in immediate danger and asked for a counsellor. Respond now. (2026-09-14T12:09:27Z)` for HIGH (STANDARD drops the "URGENT"/"immediate danger"/"Respond now" framing, though this risk level is never actually reached by the real HR-2 call site today). Still ONLY `report_id`/`risk_level`/timestamp — this AC's PII prohibition is unchanged and re-verified. Verified against real Twilio-shim-captured output: single SMS segment (145 chars, under the 160-char GSM-7 limit), pure ASCII (a real hyphen, not an em dash — a single non-GSM-7 character would silently force UCS-2 encoding and cut the segment limit to 70, doubling+ the real cost), no phone number/PII present, and both call sites produce byte-identical wording for the same inputs.
Dependencies: HR-1.
DoD: A real SMS arrives on a test phone within 10 seconds — verified live, not mocked, before video recording.

- [x] **HR-3 — Trusted-contact registration**
Story: As a survivor, I want to register one trusted contact in advance, so someone can be quietly alerted later.
Priority: **Should** (first thing cut if Sprint 2 slips)
AC: Given "Set up a trusted contact" is selected, when a WhatsApp number is provided, then a `trusted_contacts` row is created keyed to `survivor_whatsapp_number` (not `report_id` — it must persist across future reports).
Technical notes: schema as extended in Section 2.
Status: Implemented as the main menu's 4th option (`menu_trusted_contact`, additive per sprint-2-plan.md §3.3 — the existing 3 options/keys/routing are unchanged). Loosely validates the submitted number (starts with `+`, mostly digits) and re-prompts with `trusted_contact.invalid_number` on failure. Upserts by `survivor_whatsapp_number` (not `report_id`) — a second registration replaces the first (per conversation-design.md §9.1's "you can change this contact anytime") rather than accumulating rows, resetting `alert_sent_at` to null on change. Verified live in Sprint 3 against a real database: Journey A registered a trusted contact before submitting any report, and the resulting `trusted_contacts` row (keyed correctly to `survivor_whatsapp_number`) was retrieved and used by HR-4 for a later, separate HIGH report from the same number — `alert_sent_at` confirmed populated in the real DB. DoD satisfied.
Dependencies: INF-3.
DoD: Registration completes and is retrievable by HR-4 in a test.

- [ ] **HR-4 — Automatic trusted-contact alert**
Story: As a trusted contact, I want a vague, coded check-in message if she's scored HIGH risk, so I know to reach out without exposing what happened.
Priority: **Should** (tied to HR-3; cut together)
AC: Given a registered contact exists and HIGH fires, when HR-1 runs, then the contact receives exactly: *"Thinking of you — call me when you can."* and `alert_sent_at` updates. Given no contact is registered, then this step silently no-ops.
Status: Implemented (`maybeAlertTrustedContact` in `conversation.ts`, called from `handleConnectResponse` after the Yes/No ack, regardless of which was tapped). Sends the exact verbatim, untranslated string via `whatsapp.ts`'s `sendText` to the contact's own number and updates `alert_sent_at`; a lookup failure or send failure is caught and logged rather than breaking the rest of the survivor's flow. Sprint 3 re-confirmed against a real database: `trusted_contacts.alert_sent_at` is populated for Journey A's registered contact, and the captured (never-network) outbound message shows the exact verbatim text sent to the contact's own number. Still NOT verified as a real WhatsApp message actually arriving on a real phone — this DoD's "the contact receiving the message" requires that live send, which remains this environment's one categorical limitation here.
Dependencies: HR-1, HR-3.
DoD: Test HIGH-risk report with a registered contact results in the contact receiving the message.

- [x] **HR-5 — Counsellor self-service on-call phone number**
Story: As a counsellor, I want to set my own phone number and toggle on-call availability from the dashboard, so HR-2's SMS alert can actually reach me without an operator hand-editing an env var.
Priority: **Must** (real gap blocking live use, found during Sprint 3's live Twilio Sandbox testing — reported verbatim as "counselor cannot add their phone number")
AC:
- Given a logged-in counsellor visits `/dashboard/settings`, when the page loads, then it shows their current `phone_number_for_sms` and `is_on_call` state (or blank/off if never set).
- Given a counsellor submits a phone number and checks "I'm on-call", when the number matches `/^\+[0-9]{7,15}$/` (same pattern as `conversation.ts`'s `isPlausibleWhatsappNumber`), then `counsellor_users.phone_number_for_sms` and `is_on_call` are updated and a confirmation shows.
- Given the submitted number is invalid AND on-call is checked, then the save is rejected with an inline error and nothing is persisted — a counsellor can't end up marked on-call with an unreachable/malformed number.
- Given HR-2 fires (a survivor taps "Yes, connect me" on a HIGH report), when `alertOnCallCounsellors()` runs, then it SMSes every `counsellor_users` row with `is_on_call=true AND phone_number_for_sms IS NOT NULL`, writing one `sms_alerts` row per recipient — falling back to the single `ONCALL_COUNSELLOR_PHONE` env var (Sprint 2's original behavior) only when zero counsellors are currently configured as on-call, so a fresh checkout with no dashboard setup still works unchanged.
Technical notes: migration `011_add_counsellor_on_call.sql` adds `counsellor_users.is_on_call boolean not null default false` (`phone_number_for_sms` already existed since `007_create_counsellor_users.sql` but was never read/written anywhere). New `alertOnCallCounsellors()` (plural) in `server/lib/sms.ts`, added alongside — not replacing — the existing frozen `alertOnCallCounsellor()` singular (sprint-2-plan.md §3.2), per CONTRIBUTING.md's "flag it, don't silently change a frozen contract" rule; `conversation.ts`'s `handleConnectResponse` now calls the plural function and loops the returned `CounsellorAlertResult[]` into one `sms_alerts` insert per recipient. New `GET`/`POST /dashboard/settings` in `dashboard/server.ts` + `dashboard/views/settings.ejs`, matching `login.ejs`'s existing form conventions; nav link added to `partials/header.ejs`.
Status: Verified live against a real Postgres database (same `vimbiso_test` instance and capturing-Twilio-shim methodology as Sprint 3), at three levels: (1) migration `011_add_counsellor_on_call.sql` applied clean via the REAL `server/migrations/run.ts` runner — `\d counsellor_users` confirms `is_on_call boolean not null default false` landed alongside the pre-existing `phone_number_for_sms`; (2) `alertOnCallCounsellors()` exercised directly against real data across 4 scenarios — nobody on-call falls back to `ONCALL_COUNSELLOR_PHONE` (1 result, 1 send), one configured on-call counsellor is alerted on their own real number (env var NOT used), two on-call counsellors both get alerted independently (2 results, 2 real Twilio-shim sends, each SMS body containing only `report_id`/`risk_level`/timestamp — no PII), and a counsellor marked on-call with a NULL number is correctly excluded by the `IS NOT NULL` filter; (3) the full REAL state machine driven end-to-end via `handleIncomingMessage` for two complete HIGH-risk journeys — one with a real on-call counsellor configured (`sms_alerts` row written with `sent_to='+15005550101'`, matching that counsellor's own number, report id confirmed via live query) and one with nobody configured (`sms_alerts` row correctly falls back to `sent_to='+15005559999'`, the env var) — proving `conversation.ts`'s rewired `handleConnectResponse` writes the real per-recipient `sms_alerts` rows, not just that `sms.ts`'s function works in isolation. The `/dashboard/settings` route's own query/validation logic (GET pre-fill, POST save, on/off toggle, phone regex rejecting `"12345"` and accepting `+15005550101`) was separately verified against the same real database via the dashboard's own `dashboard/lib/db.ts` pool. **One caveat, unchanged from Sprint 2/3 and equally true here:** no real `express`/`ejs` package exists in this sandbox, so the actual HTTP GET/POST through Express and the rendered `settings.ejs` page have not been driven end-to-end here — same categorical gap as the rest of DASH-1..4. All test-only rows created during this verification were cleaned up afterward; the seeded demo counsellor is back to its original blank/not-on-call state.
Dependencies: HR-2 (supersedes its call site), DASH-1 (dashboard auth/session).
DoD: A counsellor can set and see their own number on `/dashboard/settings`; a HIGH-risk connect-yes SMS-alerts every on-call counsellor with a number on file, verified against a real database; the env-var fallback still fires when no counsellor is configured on-call.

---

### EPIC: DIR — Resource Directory / Standard-Risk Path

- [ ] **DIR-1 — Seed real, sourced Kenyan directory**
Story: As the product owner, I want ≥5–8 real, verifiable Kenyan GBV entries loaded, so every answer is traceable.
Priority: **Must**
AC: Given `resources`, when queried, then it contains at minimum HAK/1195 national hotline, at least one Nairobi-region resource, Kenya Police Gender & Children's Desk contact, and the State Department for Gender's reporting channel — each with non-null `name`, `phone`, `source_name`, `source_url`, `last_verified_date` (seed date).
Technical notes: seed file `/server/seeds/resources_kenya.js`.
Status: `server/seeds/resources_kenya.ts` created, seeding exactly the 4 required entries (HAK/1195 national hotline, one Nairobi resource (GVRC), Kenya Police Gender & Children's Desk, State Department for Gender reporting channel), each with non-null `name`/`phone`/`source_name`/`source_url`/`last_verified_date`. Ran clean in Sprint 3 against a REAL Postgres database (not just the in-memory harness) — `SELECT id, country, region, category, name FROM resources` confirms all 4 rows landed correctly, and this real seed data is what every DIR-2/HR-1 hotline query in Sprint 3's live journeys actually queried. **Important honesty caveat, unchanged from Sprint 2 and still true:** this agent has no live internet access in this sandbox and could not call/verify any of these numbers or URLs — every entry is labeled in the seed file's own comments with its actual confidence level, and the file's header says explicitly not to present any of them publicly until a human actually verifies. DIR-1's DoD "every entry spot-checked against its source_url before Day 5" is a human task NOT satisfied by anything in this sprint either — do not tick this story `[x]` until that spot-check actually happens.
Dependencies: INF-2.
DoD: Seed runs clean; every entry spot-checked against its `source_url` before Day 5.

- [x] **DIR-2 — "Find Help" region picker**
Story: As a user, I want to pick my area and get a real, dated resource.
Priority: **Must**
AC: Given "Find help near me" or the Standard-risk branch, when triggered, then the bot offers "Nairobi / Mombasa / Other-National"; given a selection, then it returns a matching entry's name, phone, and "Source: {source_name}, last verified {date}"; given no region-specific match, the national hotline is returned as fallback.
Status: Implemented — both entry points (main-menu "Find help near me" and the automatic post-STANDARD handoff) share `sendRegionPicker`/`handleRegionSelection`/`sendRegionResult` in `conversation.ts`. Offers Nairobi/Mombasa/"Other / National" (rendered per conversation-design.md §10's note on the hyphen; not literally "Other-National" as a string anywhere). Nairobi/Mombasa query `resources` by region; "Other / National" and any region with no region-specific row fall back to the national hotline. Result uses the exact `dir.result_format` 3-line template with a human-readable date. All 3 options verified live in Sprint 3 against a real database: Nairobi (Journey B, returns the seeded GVRC entry), Mombasa (Journey C), and "Other / National" (Journey D, isolated re-run capturing the actual outbound message body — confirmed it falls back to the national hotline, "National GBV & Child Protection Helpline (1195)"). `reports.region` confirmed persisted (`region='Nairobi'` on report 5) when reached via a scored report. DoD satisfied.
Dependencies: DIR-1, INF-4.
DoD: All 3 region options return a non-empty, correctly-sourced result.

- [x] **DIR-3 — "Know your rights" example content**
Story: As a user, I want basic rights orientation, clearly marked as unreviewed example content.
Priority: **Could**
AC: Given "Know your rights" is selected, then 2–3 short points send, prefixed with: *"This is example information and has not yet been reviewed by a legal partner."*
Status: Implemented (`sendRightsContent` in `conversation.ts`) — one message, disclaimer first (verbatim) then all 3 points, so the disclaimer can't be scrolled past separately per conversation-design.md §11. All 3 points shipped (not cut). Ships in English only for Sprint 2 (no Swahili/French translation of `rights.*` was in either LANG-3/4's safety-critical subset or sprint-2-plan.md §4's translation list) — the DoD's "visible in every language it ships in" holds trivially since English is the only language it ships in right now. Verified live in Sprint 3 (Journey C, real database, real menu_rights tap): disclaimer sent first, verbatim, followed by all 3 points in one message.
Dependencies: INF-4.
DoD: Disclaimer visible in every language it ships in; first item cut if Sprint 2 runs long.

---

### EPIC: PW — Pattern Watch

- [x] **PW-1 — Optional consent-gated perpetrator capture**
Story: As a survivor, I want to optionally name who harmed me for pattern-detection only, clearly separate from my own case.
Priority: **Should**
AC: Given a report is scored, when the closing step is reached, then an optional, skippable prompt appears: *"Would you like to name who did this, only to check if others have reported the same person? This never changes what happens with your case."* A "yes" sets `perpetrator_consent_given=true` and passes text to SEC-1's hasher; "no"/skip ends the flow.
Status: Implemented, firing after HR-1's sequence completes (HIGH) or after DIR-2's picker completes when reached via a scored report (STANDARD) — not after a menu-triggered DIR-2 lookup, which has no report to consent for. "Yes" sends the PM-approved combined ack+ask (`pw.consent_yes_ack`, folding the unlisted "ask for text" key into the existing one per sprint-2-plan.md §4/conversation-design.md §12.1's documented judgment call) and awaits the next free-text message as the identifier. `perpetrator_consent_given=true` is set on `reports` in exactly one code path (`handlePwIdentifier`), strictly gated behind this "Yes" tap, BEFORE the hash is written. Sprint 3 verified this against a REAL live database with a genuine audit query (`docs/qa-sprint3-report.md` §2), not just an in-memory dump: a live `ILIKE`-based search across every text/jsonb column of every table for the real typed identifier found zero matches anywhere except the intended hashed form. Journey B (PW-1 declined) confirms zero `perpetrator_hashes` row for that report. DoD satisfied.
Dependencies: TRI-3, SEC-1, SEC-2.
DoD: Consenting produces exactly one `perpetrator_hashes` row with zero raw text anywhere in the DB (verified by direct inspection).

- [x] **PW-2 — Hash matching logic**
Story: As the system, I want to link independent reports whose hashed perpetrator identifier matches.
Priority: **Should**
AC: Given a new `perpetrator_hashes` row's `hash_value` matches an existing row from a *different* `report_id`, then a `pattern_matches` row is created/updated (`hash_value`, `report_ids[]`, `status='NEW'`). Given no match, no row is created.
Technical notes: `pattern_matches` is a new table (Section 2).
Status: `server/lib/patternMatch.ts` implements `evaluateHashMatch()` matching sprint-2-plan.md §3.1's frozen shape exactly, satisfying every case in QA's `server/__tests__/patternMatch.test.ts` (unedited by Backend) — verified by hand-executing all 13 documented cases from that file against the real implementation via `tsx` (this sandbox cannot run `npm install`/Jest itself; see the implementation report for exactly how). `recordAndCheckPattern(reportId, hashValue)` is the DB-touching wrapper: excludes the current `report_id` in its `perpetrator_hashes` lookup, calls `evaluateHashMatch`, and upserts `pattern_matches` (new row if none exists for that `hash_value`, else merges the id into `report_ids` deduped, WITHOUT touching `status`/`reviewed_by`/`reviewed_at`). Verified live in Sprint 3 against a real Postgres instance, and more thoroughly than the DoD's minimum: PW-3's real seed produced one `pattern_matches` row for 3 fake reports, then Journey A's live PW-1 consent flow (submitting the same fake identifier through the actual conversation, not a direct DB call) correctly merged a 4th report into that SAME row (`report_ids={2,3,1,4}`) without touching its `status`/`created_at`. DoD satisfied.
Dependencies: PW-1, SEC-1.
DoD: Two test reports with the same normalized identifier produce exactly one `pattern_matches` row referencing both.

- [x] **PW-3 — Seed demo match data**
Story: As the developer preparing the demo, I want 2–3 scripted, clearly-fake test reports that deliberately match, so Pattern Watch has something real to show.
Priority: **Must** (for demo credibility, even though the underlying feature is Should)
AC: Given the seed runs, when the dashboard's Pattern Watch tab loads, then at least one matched pair is visible, using an obviously-fake, clearly test-labeled identifier.
Status: `server/seeds/pattern_watch_demo.ts` seeds 3 obviously-fake `channel='demo-seed'` reports and hashes the literal string `"TEST-DEMO-PERPETRATOR-DO-NOT-USE"` for all of them via the SAME code path a real PW-1 consent flow uses (`normalizeAndHash` + `recordAndCheckPattern`), producing exactly one `pattern_matches` row referencing all 3 fake report_ids — confirmed by running the seed against the integration harness. Nothing in the fake data resembles a real perpetrator (verified: the identifier string itself says "DO-NOT-USE"). Wired into `npm run seed` via the new `server/seeds/run_all.ts` runner (see PR notes on the `package.json` `seed` script change). Sprint 3 ran this seed for real against a live Postgres instance and then ran DASH-3's exact query against it: the match is confirmed visible at the data layer (`docs/qa-sprint3-report.md` §1.2) — the one remaining gap is that no real Express/EJS rendering of the Pattern Watch page itself has been run in this sandbox (see DASH-3's own status for that distinction), so "renders" here means "the exact query the page runs returns the right rows," not a screenshot.
Dependencies: PW-2.
DoD: Visible correct match before Day 9 recording.

---

### EPIC: DASH — Counsellor Web Dashboard

- [ ] **DASH-1 — Authenticated dashboard shell**
Story: As a counsellor, I want to log in, so report data isn't publicly exposed.
Priority: **Must**
AC: Given no session, then a login form shows; given correct `counsellor_users` credentials, then a session starts and the queue loads; given wrong credentials, then an error shows and no session is created.
Technical notes: single shared demo login acceptable for PoC (per-counsellor RBAC explicitly out of scope); bcrypt-hashed password.
Status: Real auth implemented — `POST /login` looks up `counsellor_users` by username, `bcrypt.compare`s against `password_hash`, sets `req.session.counsellor` only on a match, and `/dashboard*` redirects unauthenticated requests to `/login` (see `dashboard/server.ts`'s `requireAuth` middleware). `dashboard/seed.ts` (`npm run seed`) creates the demo counsellor login `server/__tests__/e2e/dashboard-login.spec.ts` assumes as a fixture. Sprint 3 ran `dashboard/seed.ts` for real against a live database and then exercised the ACTUAL login decision logic (the same query + `bcrypt.compare` sequence, line-for-line) directly: correct credentials → session starts; wrong password → no session; nonexistent username → no session (`docs/qa-sprint3-report.md` §1.4). This is real evidence about the auth *decision logic* against real data. What's still not run: actual Express routing/redirect behavior and session middleware (no real `express` package in this sandbox — code still only checked by hand against `dashboard-login.spec.ts`), and the underlying `bcrypt` call itself is a same-shim-both-ways stand-in, not the real native module. Not tickable `[x]` until real Express/bcrypt are exercised.
Dependencies: INF-2.
DoD: Login/logout works; `/dashboard/*` redirects unauthenticated requests to login.

- [ ] **DASH-2 — Reports queue, High-Risk pinned**
Story: As a counsellor, I want High-Risk reports visually flagged at the top.
Priority: **Must**
AC: Given mixed-risk reports exist, then HIGH reports render first (newest-first within group), visually flagged red, followed by STANDARD; each row shows id, timestamp, risk_level, YES-answer summary, region, connect status — never a real name.
Status: Wired to real data — queries `reports` LEFT JOINed to `triage_answers` (only reports with a non-null `risk_level`, i.e. already scored), ordered HIGH before STANDARD then `created_at DESC` within each group. Each row shows id, timestamp, risk badge, a YES-answer count + which question keys were YES, region, and connect status. `whatsapp_number` is masked to its last 4 digits rather than shown in full (a judgment call — SEC-2 doesn't literally name this column, but it's PII a shared screen shouldn't casually expose; see `maskPhoneNumber()` in `dashboard/server.ts`). `data-testid="report-row"`/`data-risk`/`data-testid="risk-badge"` added exactly per sprint-2-plan.md §3.4. Sprint 3 ran this EXACT query (copy-pasted, not paraphrased) against a real database with 2 HIGH + 3 STANDARD reports and confirmed correct ordering, and separately re-ran `maskPhoneNumber()` against every real `whatsapp_number` in that result set, confirming no row ever exposes more than 4 digits (`docs/qa-sprint3-report.md` §1.1). Still not run: the actual EJS template that loops over this data and renders it as HTML — no real `express`/`ejs` package in this sandbox, so "renders in correct order" (this DoD's literal wording) isn't fully proven, only that the data feeding the render is correct and correctly ordered. Not tickable `[x]` until real rendering is checked.
Dependencies: DASH-1, TRI-3.
DoD: 3 seeded reports (2 HIGH, 1 STANDARD) render in correct order with correct flags.

- [ ] **DASH-3 — Pattern Watch tab**
Story: As an institutional reviewer, I want a separate, non-urgent tab for matches.
Priority: **Should**
AC: Given `pattern_matches` rows exist, then the tab shows linked `report_ids`, `created_at`, and a "Mark reviewed" button — visually distinct, no red flags, no urgent language.
Status: Wired to real `pattern_matches` data — shows linked `report_ids`, `created_at`, and a "Mark reviewed" form per row (`data-testid="pattern-match-row"`/`"mark-reviewed-btn"`), posting to the new `POST /dashboard/pattern-watch/:id/review` route (sets `status='REVIEWED'`, `reviewed_by` from the session counsellor's name, `reviewed_at=now()`). Styled deliberately apart from the Reports queue's HIGH-risk red (new `.pattern-status`/`.pattern-match-row` CSS, no `risk-badge`/`data-risk` reuse) — see `public/css/style.css`. Sprint 3 ran both the exact SELECT query AND the exact UPDATE mutation against a real database with PW-3's seed data (now merged with a real 4th report via Journey A): the query correctly returns the merged match, and the mutation correctly flips `status`/`reviewed_by`/`reviewed_at` and was reverted afterward to leave the fixture demo-ready (`docs/qa-sprint3-report.md` §1.2). The "can be marked reviewed" half of this DoD is now proven for real. The "renders" half is not — no real `express`/`ejs` in this sandbox, so the actual page has not been rendered or screenshotted. Leaving this `[ ]` until that half is checked too, since the DoD is an AND of both.
Dependencies: DASH-1, PW-2.
DoD: PW-3's seeded match renders and can be marked reviewed.

- [x] **DASH-4 — Report detail view**
Story: As a counsellor following up, I want a full triage transcript for one report.
Priority: **Should**
AC: Given a report row is clicked, then all 8 `triage_answers` (question text + answer), `risk_level`, and any `sms_alerts` timestamps display.
Status: Wired to real data — queries the report row, all `triage_answers` (question_key mapped to the canonical English question text from backlog.md §3, plus the given answer), and any `sms_alerts` rows for that `report_id`, inside a `data-testid="report-detail"` container. Each queue row is now a real link to `/dashboard/reports/:id`. Sprint 3 ran all 3 of these exact queries against report 4 (a full 8-answer HIGH report with one SMS alert) and confirmed the returned rows match that report's real, independently-recorded conversation history exactly — question order, STRANGLE=YES vs. 7×NO, and the one `sms_alerts` row's `sent_to`/`status` (`docs/qa-sprint3-report.md` §1.3). This DoD is about the underlying data matching the DB exactly, which is now proven; actual EJS rendering of that data into the page remains unverified in this sandbox, same caveat as DASH-2/3.
Dependencies: DASH-2.
DoD: Detail view matches underlying DB rows exactly for a test report.

---

### EPIC: LANG — Multilingual Content Pipeline

- [x] **LANG-1 — Structured content schema**
Story: As a developer, I want every user-facing string served from `content_strings`, keyed by (key, language), so adding a language never touches bot logic.
Priority: **Must**
AC: Given a handler needs a string, when it calls `t(key, language)`, then it returns the matching row, or falls back to English (logging a warning) if the requested language's row is missing.
Technical notes: `t()` helper in `/server/lib/content.js`.
Status: `content_strings` schema + `t()` helper implemented in `server/lib/content.ts`, with English fallback; grep-verified zero hardcoded user-facing strings in `conversation.ts`.
Dependencies: INF-2.
DoD: Zero hardcoded user-facing strings remain in handler code (verified by grep) once INF/TRI/HR/DIR are wired.

- [ ] **LANG-2 — English content, all keys**
Story: As the content lead, I want every key populated in English first.
Priority: **Must**
AC: Given the full list of keys referenced in code, when diffed against `content_strings WHERE language='en'`, then zero are missing.
Status: English content now also covers every Sprint 2 key from conversation-design.md §14 (HR-1/HR-3/HR-4/DIR-2/DIR-3/PW-1, plus the 4th-menu-option additions), copied verbatim in `content_en.ts`, plus 4 small Backend-authored UI-chrome keys (`common.btn_yes`/`common.btn_no`/`dir.region_button`/`dir.region_section_title`) flagged loudly in that file and in `conversation.ts` as NOT Designer copy (see the implementation report's deviations section). No formal diff-script run yet (that tooling doesn't exist) — spot-checked by hand that every `t(...)` call site in `conversation.ts` has a matching seeded key.
Dependencies: LANG-1 + every story introducing a new key (ongoing, not one-time).
DoD: Diff script returns zero missing keys, run before Sprint 3.

- [ ] **LANG-3 — Swahili, FULL tier**
Story: As a Kenyan survivor, I want the entire experience in Swahili.
Priority: **Must**
AC: Given LANG-2 is complete, when Swahili translation finishes, then every key has a `language='sw'` row, `tier='FULL'`, `reviewed_by` set to the @KEN/@UGA volunteer's name, `reviewed_at` set.
Technical notes: AI-drafted first pass, human-reviewed per the committed standard — reviewer identity recorded, not just a boolean.
Status: Story itself not started (still needs a secured @KEN/@UGA reviewer and full-parity translation) — but the safety-critical subset's DRAFT groundwork now exists: `server/seeds/content_sw.ts` seeds Designer's AI-drafted `highrisk.*` + `pw.consent_prompt` keys (conversation-design.md §15.1) verbatim, correctly as `tier='PARTIAL'` with `reviewed_by`/`reviewed_at` left NULL, per Designer's explicit instruction not to mark these FULL/reviewed until a real reviewer signs off. Do not mistake this seed's existence for LANG-3 being done — it deliberately isn't.
Dependencies: LANG-2, secured reviewer.
DoD: Full parity confirmed by the same diff script as LANG-2; reviewer sign-off recorded.

- [ ] **LANG-4 — French, FULL tier (safety-critical subset first)**
Story: As the francophone-market proof point, I want the triage+safety-plan strings translated and reviewed by Nnouka first, then the rest.
Priority: **Must** (triage+safety-plan subset) / **Should** (full menu+directory parity)
AC: Given the ~35–40 triage+safety-plan keys, when reviewed by Nnouka, then `language='fr'`, `tier='FULL'`, `reviewed_by='Nnouka'` rows exist for all of them by Day 5. Given time remains, full parity follows the same process as LANG-3.
Status: Story itself not started (Nnouka's actual review hasn't happened) — same draft-groundwork caveat as LANG-3: `server/seeds/content_fr.ts` seeds the same key subset from conversation-design.md §15.2 verbatim, `tier='PARTIAL'`, `reviewed_by`/`reviewed_at` left NULL exactly as that section instructs ("do not mark reviewed_by='Nnouka' in the seed until he has actually reviewed it"). Nnouka's real review is what would close this story, not this seed.
Dependencies: LANG-2.
DoD: At minimum, the safety-critical subset passes the diff check and is reviewer-signed; full parity is a stretch within the same story.

- [ ] **LANG-5 — Arabic, conditional PARTIAL**
Story: As a stretch goal, I want the safety-critical subset in Arabic with RTL verified, if @EGY produces a reviewer.
Priority: **Could**
AC: Given a reviewer responds by Day 6, then the same subset as LANG-4's Must scope exists for `language='ar'`, `tier='PARTIAL'`, and manual check confirms correct RTL rendering in WhatsApp. Given no reviewer by Day 6, then it's not built, and the deck lists it as "planned, not yet reviewed."
Status: Conditional — not started; depends on an @EGY reviewer responding by Day 6.
Dependencies: LANG-2, uncertain external reviewer.
DoD: Either a reviewed PARTIAL subset exists, or the story is explicitly closed as "not attempted, no reviewer" — half-done is not an acceptable close.

- [ ] **LANG-6 — Kinyarwanda, conditional architecture-only/PARTIAL**
Story: As a stretch goal, I want 1–2 proof screens in Kinyarwanda, upgradeable if Nnouka's Kigali network produces a reviewer.
Priority: **Could**
AC: Given no reviewer, then an AI-drafted, explicitly unreviewed 3–5 key set exists for `language='rw'`, `tier='ARCHITECTURE_ONLY'`, never surfaced in the live demo. Given a reviewer is found, upgrade as LANG-5.
Status: Conditional — not started; depends on a reviewer from Nnouka's Kigali network.
Dependencies: LANG-2.
DoD: At least the architecture-only minimum renders correctly with an accurate tier label.

- [ ] **LANG-7 — Shona/Ndebele, architecture-only carry-forward**
Story: As proof of prior work, I want the existing Shona strings wired into the same schema, so the coverage map is accurate.
Priority: **Could**
AC: Given prior content, when migrated with `tier='ARCHITECTURE_ONLY'`, then the 1–2 proof screens render correctly, clearly outside the live Kenya demo.
Status: Not started — carry-forward from prior Shona/Ndebele work, not yet migrated into this schema.
Dependencies: LANG-1.
DoD: Renders without error; not referenced in the default Kenya-pilot flow.

- [x] **LANG-8 — Emoji warmth pass for low-stakes WhatsApp copy**
Story: As a survivor messaging vimbiso, I want the bot's tone to feel warm and human in low-stakes moments, so the experience feels supportive and engaging rather than robotic — without ever undermining the seriousness of a safety-critical message.
Priority: **Could**
AC:
- Given navigational/low-stakes copy (main menu options, the language selector, footer hints, short acknowledgments like a consent "got it"), when it's authored or re-authored, then it may include one tasteful, minimal emoji that reinforces the message (e.g. a small icon beside a menu option) — never more than one emoji per short line, and never novelty/celebratory emoji (no 🎉/😂/❤️) given the subject matter.
- Given `highrisk.*` (HR-1's danger-intro, safety-plan steps, hotline number), any Pattern Watch/perpetrator-identifier prompt (`pw.*`), or `disclosure_message`, when authored, then NO emoji is added — these must read as unambiguously serious, with zero risk of a survivor reading a life-threatening message as less urgent because of decoration.
- Given emoji are added to an English key, when that key's Swahili/French/etc. translation exists or is later added, then the same emoji is carried into every language's row for that key — emoji are visual, not language-specific text, so LANG-3/4's translated rows must not silently diverge from English's choices.
Technical notes: this is a content/copy change, not a code change — implemented by editing the relevant `server/seeds/content_*.ts` values (a Designer-role judgment call on exactly which keys, per this project's existing content-ownership convention), never hardcoded into `conversation.ts`. Candidates worth considering: `menu.*` options, `lang_select.*` labels, `common.btn_yes`/`common.btn_no`, `menu.footer_hint`. Explicitly OUT of scope, per the AC above: `highrisk.*`, `pw.*`, `disclosure_message`.
Status: Done — `server/seeds/content_en.ts` now carries emoji on exactly the candidate keys this story's own technical notes named: `lang_select.body`/`section_title`/`row_english`/`row_kiswahili`/`row_francais`, `menu.footer_hint`/`section_title`/`report_row`/`find_help_row`/`rights_row`/`trusted_contact_row`, and `common.btn_yes`/`common.btn_no` — one tasteful emoji each, no novelty/celebratory glyphs. Every list-row/button-label value that carries an emoji was re-checked programmatically against WhatsApp's real limits (list row titles ≤24 chars, the list-opening button label ≤20 chars) using the SAME `.length` semantics `server/lib/whatsapp.ts`'s `sendList`/`sendButtons` validate against (JS UTF-16 code units, not Unicode codepoints — INF-1's real stuck-at-language-select crash already proved this distinction matters) — every edited value passed with margin to spare (worst case: `📝 Report what happened` at 23/24). Checked `content_sw.ts`/`content_fr.ts` directly: neither file seeds any of this story's candidate keys (both are deliberately scoped to `highrisk.*`/`pw.consent_prompt` only, per their own file headers), so there is nothing to carry the emoji into yet — LANG-3/4's own future translation work inherits this requirement when those keys are eventually translated. `highrisk.*`, `pw.*`, and `disclosure_message` were left untouched, confirmed by re-reading `content_en.ts`'s full Sprint-2 section after editing.
Dependencies: LANG-1 (content pipeline must exist first); should follow, not block, LANG-3/4's real translation review.
DoD: Met — every emoji-bearing key is one of the explicitly-approved low-stakes keys; `highrisk.*`/`pw.*`/`disclosure_message` remain plain; re-seeded into a real database (`npm run seed` equivalent, via the existing `content_en.ts`/`content_sw.ts`/`content_fr.ts` seed functions) with zero errors.

---

### EPIC: QA — Testing & QA

- [ ] **QA-1 — Unit test coverage for scoring + hashing**
Story: As a developer, I want CI to run TRI-2's and SEC-1's tests on every push, so safety-critical logic can't silently break.
Priority: **Must**
AC: Given a push, then both suites run and must pass before Day 8 sign-off (full CI gating is a bonus, not required).
Status: Test suites exist and their assertions pass under manual verification in this dev environment (`npm install` is blocked here — see `docs/ai-tool-usage-log.md`); a real `npm test` run and CI wiring are still pending. As of the Sprint 2 integration pass, verification got meaningfully stronger than "read the code": a real `tsc --noEmit`-equivalent check now runs against every `.ts` file in the repo (via a hand-built ambient-types shim, since `@types/*` packages aren't installable either) and genuinely caught a real bug (a duplicate `menu.body` key in `content_en.ts`) before it reached anyone — see Section 4's Sprint 2 status note for the full account. That's real compiler verification, not just assertion-by-reading, even though it isn't yet the project's own `npm run typecheck` running on a machine with real `node_modules`.
Dependencies: TRI-2, SEC-1.
DoD: Suites green; run instructions in README.

- [ ] **QA-2 — End-to-end language-path test script**
Story: As QA owner, I want a written script covering English, Swahili, French journeys.
Priority: **Must**
AC: Given the script (`/docs/qa-script.md`), when run per language, then: language selection, all 3 menu paths, one HIGH and one STANDARD journey, and all 4 HR actions (safety plan, real SMS received, connect logged, trusted-contact alert if registered) all verified.
Status: `docs/qa-script.md` written and its steps genuinely run — not hand-simulated — against a real Postgres database via `handleIncomingMessage()`, across 5 conversation journeys covering language selection, all 3 menu paths, one HIGH and one STANDARD journey, and all 4 HR actions, in both English and Swahili. Failures found were harness bugs (documented and fixed — see `docs/ai-tool-usage-log.md`), not product defects. **Explicitly deferred, stated in the script itself:** the French journey was not independently driven this sprint (same code/content path as Swahili, but unverified is unverified); the 24h session-reset behavior; a real SMS/WhatsApp send. Not tickable `[x]` until the French journey is actually run.
Dependencies: all Must-priority TRI/HR/DIR/LANG-3/4 stories.
DoD: Signed off by Day 8; failures logged and fixed or explicitly deferred with reasoning.

- [ ] **QA-3 — Pattern Watch + dashboard verification**
Story: As QA, I want to confirm PW/DASH render correctly with seeded data before the demo.
Priority: **Must**
AC: Given PW-3's seed, then DASH-2/3/4 all render with no console errors.
Status: `docs/qa-sprint3-report.md` written with real evidence: DASH-2/3/4's exact SQL query strings (copy-pasted from `dashboard/server.ts`) run directly against a real, PW-3-seeded-and-live-exercised database, confirming correct ordering, masking, joins, and the mark-reviewed mutation. This is real evidence about the queries feeding the dashboard, not a screenshot of the rendered page — no real `express`/`ejs` package is installable in this sandbox, so the literal "render with no console errors" / "screenshot-verified" wording of this story's AC/DoD is not met. Not tickable `[x]` until actual dashboard rendering can be run and screenshotted, in a real environment with `npm install` available.
Dependencies: PW-3, DASH-2/3/4.
DoD: Screenshot-verified checklist item, signed off by Day 8.

- [x] **QA-4 — Privacy audit**
Story: As product owner, I want a direct DB inspection confirming privacy guarantees hold in practice, not just in intent.
Priority: **Must**
AC: Given the full Day-8 database, when every table is inspected, then no row contains a raw perpetrator string or a legal name field.
Status: Done — `docs/qa-sprint3-report.md` §2 is the signed checklist with real query output as evidence. Every table's schema was inspected directly (no `name`/`legal_name`/`id_number` column anywhere); a live audit query searched every text/jsonb column of every table for the real perpetrator identifier used in this sprint's testing and found zero matches outside its intended hashed form; consent-gate enforcement (PW-1's hash-writing gate, HR-2's SMS gate) was confirmed against real joined data, not just read in the code. Referenced from `docs/qa-sprint3-report.md` §3 and from SUB-3's written summary. Caveat stated plainly in the report itself: this audits only the data this sprint's own testing produced — re-run the same query before any real launch, against real production data.
Dependencies: SEC-1, SEC-2, PW-1, all Sprint 2 stories.
DoD: Signed checklist with query output saved as evidence, referenced in the written summary.

---

### EPIC: SUB — Submission Deliverables

- [ ] **SUB-1 — Demo video**
Story: As the team, I want a recorded demo following the finalized script (English+Swahili full journey, French safety-plan cutaway, Standard-path lookup, Pattern Watch cutaway), so judges see a real product.
Priority: **Must**
AC: Real WhatsApp screens, a real SMS arriving, the real dashboard — no slides pretending to be the product.
Status: `docs/demo-script.md` written — a fully shootable, beat-by-beat script with every line of on-screen copy pulled verbatim from the real seeded `content_strings`, and every beat except the live SMS/WhatsApp delivery itself independently verified against a real database in Sprint 3. The recorded video file itself does NOT exist — that requires a live Twilio WhatsApp Sandbox, a real on-call phone, and a real trusted-contact phone, none reachable from this build sandbox (no outbound Twilio API access here). This is the closest achievable deliverable from inside this environment; recording it is a Day 9–10 task for Nnouka/Tendai against a real Twilio account. Not tickable `[x]` until the actual file exists.
Dependencies: QA-2, QA-3.
DoD: Final file produced within the hackathon's length limit, reviewed by both team members.

- [x] **SUB-2 — Pitch deck**
Story: As the team, I want a deck covering problem/users/solution/impact, the honest language-tier map, the team-credibility paragraph, and the Phase 2 roadmap.
Priority: **Must**
AC: Includes Kenya-specific stats (220 femicides 2025, 129 in Q1, government stopped publishing after March 2025), the risk-triage mechanism, the tiered coverage map, the Tendai+Nnouka team paragraph, and an honest Cameroon/Rwanda Phase-2 slide.
Status: `submission/vimbiso-pitch-deck.pptx` produced (11 slides) — Kenya stats with real sourcing, the risk-triage pivot story, the trust/privacy architecture backed by Sprint 3's live-DB evidence, the honest language-tier table (real row counts, not estimates), an explicit "real vs. simulated" slide, the Tendai+Nnouka team-credibility slide, and the Cameroon/Rwanda Phase-2 roadmap. Passed file-structure validation and a full visual QA pass (every slide rendered and checked for overflow/overlap). DoD satisfied.
Dependencies: none blocking; content already locked in this conversation.
DoD: Finalized, proofread, exported.

- [x] **SUB-3 — Written summary**
Story: As the team, I want the required written summary covering track, sources, trust approach, AI tool usage.
Priority: **Must**
AC: Cites real sources (Böll Foundation, Africa Uncensored/Africa Data Hub, UN Women, HAK/1195), discloses every language's tier honestly, and describes the actual AI-tool workflow (TDD for scoring/hashing, bot scaffolding, translation-drafting with mandatory human review) — see `ai-tool-usage-log.md` for the full record this section draws from.
Status: `docs/written-summary.md` written — cites all 4 required sources plus HRW (used in the country-selection rationale), discloses every language's real tier and row count, and describes the actual AI-tool workflow with specifics (TDD for scoring/hashing/pattern-matching, the simulated role-specialized agent team, translation-drafting explicitly gated by disclosed review status, and the progressively-stronger real-database verification built in Sprint 3) rather than a general "we used AI" claim. Explicitly states what AI did NOT do (verify real-world facts, send real messages, sign off a translation). DoD satisfied — every claim in it traces to a real file/query in this repo, no rounding up.
Dependencies: none blocking.
DoD: Matches the actual build — no claimed feature that wasn't really shipped.

- [x] **SUB-4 — GitHub README**
Story: As an outside reviewer, I want a clear README so I can understand and run the project unaided.
Priority: **Must**
AC: Includes project description, architecture summary, setup instructions (env vars, migrations, local run), the language-tier table, and an explicit "real vs. simulated" section (counsellor connect is a demo SMS, not a live HAK integration; WhatsApp number used directly, no masked relay; rights content is unreviewed example text).
Status: Complete — `README.md` covers setup/architecture/env vars (Sprint 1/2), and Sprint 3 added the explicit "Privacy," "Language coverage" (real row-count table, not an estimate), and "Real vs. simulated" sections this story's AC calls for, each backed by the live-database evidence gathered this sprint. DoD satisfied.
Dependencies: effectively all build stories.
DoD: The non-developer team member can clone and run it locally using only the README.

- [x] **SUB-5 — Export pitch deck to PDF (brief compliance)**
Story: As the team, I want the final pitch deck delivered as a PDF, so the submission actually matches the brief's stated file-type requirement instead of being unopenable or disqualified on the judges' side.
Priority: **Must**
AC:
- Given `submission/vimbiso-pitch-deck.pptx`, when exported, then a `submission/vimbiso-pitch-deck.pdf` exists, ≤100MB, with every slide rendering correctly.
- Given the PDF, when opened without PowerPoint/Keynote installed, then it displays identically to the source deck.
Technical notes: the real capstone brief (`/mnt/user-data/uploads/osf/capstone-brief.md`, outside this repo) states "A pitch deck: PDF only, up to 100MB" — the `.pptx` alone did not satisfy this. Found during a Tendai-role planning pass, not caught by SUB-2's own DoD (which didn't check file-type compliance against the brief).
Status: Done — `submission/vimbiso-pitch-deck.pdf` (135KB, well under the cap) exported from the same source deck already used for SUB-2's visual QA pass, no content changes. DoD satisfied.
Dependencies: SUB-2.
DoD: A PDF exists in `submission/` and is what actually gets uploaded — not the `.pptx`.

---

### EPIC: COMM — Reviewer & Community Coordination

- [ ] **COMM-1 — Post the @KEN Swahili reviewer request**
Story: As the team, I want an actual message posted in the Andela @KEN hackathon community channel asking for a Swahili-speaking volunteer to review the ~35-40 safety-critical strings, so LANG-3 has a real chance of moving from PARTIAL/unreviewed to FULL/reviewed before submission.
Priority: **Must** — time-sensitive; Swahili is the pilot's FULL-tier target language and currently has zero reviewer secured.
AC: Given the @KEN channel, when the post goes out, then it names the ask concretely (review ~35-40 short strings — primarily the 8 triage questions and the `highrisk.*` safety-plan sequence in `server/seeds/content_sw.ts`), includes a way to actually receive the review (a doc link or the strings themselves, not "DM me"), and states a turnaround window (~24-48h given the timeline).
Technical notes: send the current draft in `server/seeds/content_sw.ts` as the starting point to correct, not a blank ask — it's already `tier='PARTIAL'` and ready to be marked up.
Status: Not started. Surfaced by a Tendai-role planning pass: `mvp-spec.md` scheduled this for Day 1, but nothing in `docs/ai-tool-usage-log.md` or `docs/backlog.md`'s LANG-3 status shows it ever went out. This requires a human posting to a real community channel — no tool in this build environment can do it.
Dependencies: none — can happen immediately, independent of any other Sprint 3/4 work.
DoD: Post is live in @KEN; the moment someone responds, their name and expected turnaround are recorded in `docs/backlog.md`'s LANG-3 status, and the review itself (once landed) flips `content_sw.ts`'s `tier` to `FULL` with a real `reviewed_by`.

---

### EPIC: LOG — Message Audit & Replay Logging

Added directly to the backlog per Nnouka's request (2026-09-15), then revised same-day after Nnouka raised a real follow-up requirement: sender ids must be anonymous by default, but recoverable under lawful process (a court order, a government request, or the survivor's own request for their own data) — a plain one-way hash cannot do that (by design, it can never be reversed, by anyone, key or no key), so LOG-1's original one-way-only sketch is superseded below by a two-tier pseudonym/reversible-mapping design. Built and real-DB-verified 2026-09-15, same day as the design revision, per Nnouka's explicit "yes build all" instruction — see each story's Status note below for the evidence.

- [x] **LOG-1 — Persistent, pseudonymous message log**
Story: As the product/research team, I want every inbound and outbound message vimbiso sends or receives logged in a replayable form, grouped by a stable pseudonym per sender, so we can analyze conversation flow and quality without normally being able to identify anyone.
Priority: **Should**
AC:
- Given any inbound WhatsApp/SMS message vimbiso receives, when it's processed, then one `message_log` row is written: `sender_pseudonym` (never the raw phone number), `direction='inbound'`, `channel`, `message_type` (`text`/`button_reply`/`list_reply`), the tapped `button_id` if any (plaintext — UI ids like `lang_en` aren't PII), the message content encrypted at rest, and a timestamp.
- Given any outbound message vimbiso sends (`sendText`/`sendButtons`/`sendList`/`sendSms`), when it's sent, then one `message_log` row is written the same way with `direction='outbound'`, capturing the exact rendered content — so the log alone is enough to replay/reconstruct a conversation later.
- Given two real messages from the same real WhatsApp number, when both are logged, then they get the SAME `sender_pseudonym` (so one survivor's session can be grouped/replayed for analysis) — but `sender_pseudonym` is a ONE-WAY hash: given the log alone, with or without any key this application holds, no one can compute the real phone number back from it. (Lawful re-identification, when it's actually needed, is a SEPARATE, deliberately harder-to-reach mechanism — see LOG-3, never this table.)
- Given the log's message content, when stored, then it is encrypted at rest, not plaintext in the database — because survivor free-text (crisis disclosures, a typed trusted-contact number, a typed PW identifier before it's hashed) is exactly the kind of sensitive content this project's own SEC epic already refuses to store raw elsewhere.
Technical notes: new `message_log` table (Section 2). `sender_pseudonym` reuses SEC-1's `normalizeAndHash` PATTERN (Node `crypto`, HMAC-SHA256) but with its own secret, `MESSAGE_LOG_HASH_SECRET` — deliberately distinct from `PERPETRATOR_HASH_SECRET`, so recovering one hashed-identifier space never lets anyone correlate into the other. Body content is encrypted with AES-256-GCM (Node `crypto`), key from `MESSAGE_LOG_ENCRYPTION_KEY` (32 bytes); ciphertext + IV + auth tag are all stored (never reuse an IV). This table is a PARALLEL, analysis-only audit trail — it does not replace or anonymize `reports.whatsapp_number` or `conversation_state`, which must keep the real number for the product to keep working (SMS/trusted-contact alerts, session resume); `report_id` is a nullable FK for analysis convenience only, never read by operational sending logic. A write to this table must never block or fail a real send — catch and log any write failure, never throw, so a bug in this table can't take down the actual product. Hook points: `server/routes/webhook.ts` (inbound, right after normalizing) and `server/lib/whatsapp.ts`/`server/lib/sms.ts` (outbound, at each send call) — not `conversation.ts`, so nothing is missed regardless of which code path triggered the send.
**Open question, flagged rather than silently decided:** no retention period is specified here. Indefinite storage of even pseudonymous/encrypted survivor conversation data is a real privacy tradeoff (also directly named in the capstone brief's "Privacy and security" operating constraint) that the team should decide explicitly — e.g. "purge rows older than 90 days" — rather than defaulting to forever by omission.
Status: Done — built and verified against a real local Postgres database. `server/migrations/012_create_message_log.sql` adds `message_log` (applied cleanly to `vimbiso_test`, confirmed via `\d message_log`). `server/lib/messageLog.ts` implements `pseudonymizeSender()` (HMAC-SHA256 under `MESSAGE_LOG_HASH_SECRET`) and `encryptMessageBody()`/`decryptMessageBody()` (AES-256-GCM under `MESSAGE_LOG_ENCRYPTION_KEY`), and is wired at every hook point this story's technical notes named: `server/routes/webhook.ts` (inbound, right after normalizing — before `handleIncomingMessage` even runs, so a message is logged as received regardless of how it's later handled) and `server/lib/whatsapp.ts`'s `sendText`/`sendButtons`/`sendList` plus `server/lib/sms.ts`'s `sendSms` (outbound, at the one real Twilio call site each). A real end-to-end driver (`/tmp/vimbiso-e2e/log-fullloop-check.ts`, following this project's established real-DB verification methodology) drove a full HIGH-risk survivor journey — first-contact text, a LIST-picker language tap, a BUTTON menu tap, the full 8-question triage, the HR-2 connect-yes flow (which fires a real counsellor SMS) — through the REAL, unmodified `webhook.ts`/`conversation.ts`/`whatsapp.ts`/`sms.ts` code, and confirmed: every inbound message_type (`text`/`button_reply`/`list_reply`) is logged correctly with the right `button_id`; the SAME real WhatsApp number always produces the SAME `sender_pseudonym` across inbound AND outbound rows; `decryptMessageBody()` recovers the exact original plaintext for both a survivor's free-text message and the HR-2 SMS body; and the real conversation itself completed normally (risk_level=HIGH persisted correctly) — logging never blocked or altered a real send. `logMessage()` is fire-and-forget and internally try/caught (never throws), satisfying the "must never block or fail a real send" AC; a real bug this exercise found (`Buffer` values weren't safely interpolated by this sandbox's own psql-CLI-based `pg` test shim, causing decrypt failures with garbled ciphertext) was a test-harness limitation, not an application bug — fixed in the shim (`quote()` now emits Postgres's `E'\\x<hex>'::bytea` hex-escape literal for Buffers; the read side decodes `\x...` back into a real Buffer), documented inline there. The retention-period open question from this story's technical notes remains genuinely open — not decided here, flagged for the team.
Dependencies: SEC-1 (hashing pattern precedent), INF-2 (schema/migrations).
DoD: Met — a full multi-message conversation (10 inbound + 24 outbound/logged rows across the journey above) was reconstructed from `message_log` alone, in order, by pseudonym, with zero raw phone numbers and zero unencrypted survivor text in the table, and no code path in `messageLog.ts` exposed that can turn a `sender_pseudonym` back into a phone number (that capability lives only in LOG-3's separate, standalone script).

- [x] **LOG-3 — Lawful sender re-identification, with an audit trail**
Story: As the organization operating vimbiso, I want a way to recover a message sender's real phone number when privacy protections are properly lifted — a court order, a lawful government request, or the survivor's own request for their own data — without that capability existing as an ordinary, everyday-accessible feature of the running application.
Priority: **Should** (the capability matters even before it's ever invoked — its ABSENCE is a real operational/legal risk for a safety tool that may face lawful process)
AC:
- Given a brand-new real sender's first message, when `message_log` logs it, then exactly one `sender_identity_map` row is created for that `sender_pseudonym` (not one per message — the reversible-PII surface stays as small as the number of unique senders, not the number of messages), holding their real number encrypted under a THIRD, separate secret (`SENDER_IDENTITY_RECOVERY_KEY` — distinct from both `MESSAGE_LOG_HASH_SECRET` and `MESSAGE_LOG_ENCRYPTION_KEY`).
- Given normal, day-to-day operation of the application, when any ordinary code path runs, then NOTHING ever decrypts `sender_identity_map` — it is write-once (automatically, on first contact) and otherwise read-never by the running app. The privacy guarantee here is custody of the key, not the algorithm: `SENDER_IDENTITY_RECOVERY_KEY` must never live alongside the app's normal runtime secrets (`.env`, the hosting platform's env-var config) — it is held out-of-band by a designated custodian (e.g. Nnouka, or whoever the organization designates as its legal/compliance point of contact), so no engineer with ordinary production access can decrypt it alone.
- Given a lawful request is received and the designated custodian decides to act on it, when they supply the recovery key through a deliberately manual, out-of-band step (never a running API endpoint), then the real number for one `sender_pseudonym` can be decrypted — and this action itself writes one row to `identity_recovery_log` (who did it, when, and the stated legal basis/case reference), so re-identifying a survivor is never silent, even when it's justified.
- Given someone asks "who sent these messages" with no `identity_recovery_log` entry to show for it, then the honest answer is "we don't have a way to tell you" — this story exists specifically so that answer is only ever false when the recovery procedure was actually, auditably used.
Technical notes: new `sender_identity_map` and `identity_recovery_log` tables (Section 2). AES-256-GCM (Node `crypto`) for the encrypted number, same primitive as LOG-1's body encryption but under its own key so the two capabilities (message analysis vs. sender recovery) can never be exercised with the same secret. This is as much a PROCESS as a technical control — the AC above deliberately does not build a decrypt-on-demand UI/API, since making re-identification a single authenticated click away would defeat the entire point of keeping the key out-of-band.
**Open questions, flagged for a human/legal decision, not decided here:** who exactly is the designated key custodian and what counts as a valid "lawful request" that clears them to act (a real subpoena/court order vs. an informal internal ask); whether a survivor should be able to see their own `identity_recovery_log` entries (transparency) after the fact; where `SENDER_IDENTITY_RECOVERY_KEY` is actually stored (a sealed offline copy, a separate secrets manager with its own access policy, or split via something like Shamir's Secret Sharing across multiple custodians so no single person can act alone) — this backlog names the requirement, not the org's final key-custody policy.
Status: Done — built and verified against a real local Postgres database. `server/migrations/012_create_message_log.sql` also adds `sender_identity_map` and `identity_recovery_log` (both confirmed via `\d`). `messageLog.ts`'s `logMessage()` writes exactly one `sender_identity_map` row per unique real sender (`ON CONFLICT (sender_pseudonym) DO NOTHING`) — the real-DB driver above sent this same survivor 12+ messages across a full journey and confirmed via `SELECT count(*)` that `sender_identity_map` still holds exactly one row for them, encrypted under `SENDER_IDENTITY_RECOVERY_KEY` (AES-256-GCM, a distinct third secret from both LOG-1 keys). `server/scripts/recoverSenderIdentity.ts` is the ONLY code in the repo that can decrypt that table — a standalone CLI (`npm run recover-identity --`), never imported by `server/index.ts` or any normally-running path (confirmed by grep: its only references are this backlog entry, its own file, and `package.json`'s script alias). Ran it for real, three ways: (1) with a real recovered `SENDER_IDENTITY_RECOVERY_KEY` supplied only as an ephemeral env var at invocation (never written to `.env`) and a real `sender_pseudonym` from the driver above, `--recovered-by`, `--legal-basis`, and `--case-reference` flags — it correctly decrypted the exact original number (`+19995551060`, matching what the test actually sent) and wrote a real `identity_recovery_log` row (confirmed via `SELECT`); (2) with the key omitted — refused loudly with an explanatory error, wrote nothing; (3) with an unknown pseudonym — refused with "nothing to recover," wrote nothing (no phantom audit rows for a lookup that found nothing). `.env.example` documents all three LOG secrets, with `SENDER_IDENTITY_RECOVERY_KEY`'s comment explicit that it must NOT be added to `.env` or normal deploy config — matching this story's own key-custody AC. The open questions this story's technical notes flagged (who the designated custodian is, what counts as a valid lawful request, real-world key storage/Shamir's-Secret-Sharing) remain genuinely open — this is a real, working mechanism, not a policy decision, and none of those questions were decided here.
Dependencies: LOG-1 (needs `sender_pseudonym` to exist as the join key).
DoD: Met — a real out-of-band recovery of a real pseudonym was performed via the documented procedure, decrypted the correct real number, and was recorded in `identity_recovery_log`; no other code path in the repo can do the same (verified by grep, not just by design intent).

- [x] **LOG-2 — Dev-only console mirror of the message log**
Story: As a developer debugging locally, I want the same message log mirrored to the console in real time, so I can watch a conversation flow without querying the database.
Priority: **Could**
AC: Given `NODE_ENV !== 'production'`, when a `message_log` row would be written, then its content (decrypted, for local readability) is also printed to the console. Given `NODE_ENV === 'production'`, then nothing extra is printed beyond what already exists.
Technical notes: gate behind the same `process.env.NODE_ENV !== 'production'` check `server/index.ts` already uses for auto-migrations, for consistency — one function should both write the DB row and, conditionally, log to console, rather than two parallel logging code paths that can drift apart.
**Caveat, flagged rather than glossed over:** this prints decrypted, re-identifiable-to-a-session content to a local terminal for convenience. That's a reasonable tradeoff for a hackathon PoC where "dev" means a single developer's own machine (and is no different from the plaintext debug logging this project already does elsewhere in dev) — but it must NOT be treated as "safe by `NODE_ENV` alone" if this project ever gets a real shared staging server visible to more than one person.
Status: Done — `messageLog.ts`'s `consoleMirror()` implements exactly one function that both writes the DB row and, conditionally, logs to console (per this story's own technical note, avoiding two parallel logging paths). Gated on `process.env.NODE_ENV === 'production'` — a genuine no-op in production, not merely quiet. Verified against a real database with `NODE_ENV` toggled live mid-run in the same driver as LOG-1/LOG-3 above: with `NODE_ENV` unset, an inbound message produced a real `[message_log] -> pseudonym=... channel=whatsapp type=text ... body="..."` console line (decrypted plaintext, readable); with `NODE_ENV=production` set immediately after, a second real message through the same code path produced ZERO such lines. The caveat this story's AC itself raises (decrypted, re-identifiable content printed to a local terminal) is accurate and unchanged — this is dev-convenience logging, not a production feature, exactly as designed.
Dependencies: LOG-1.
DoD: Met — console shows real-time, decrypted message flow when `NODE_ENV` is not production; confirmed zero extra console output from `consoleMirror()` in a live `NODE_ENV=production` run against the real database.
