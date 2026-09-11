# Sprint 1 Plan — Vimbiso (Days 1–3)

Author: Product Manager · Status: LOCKED for kickoff · Last updated: 2026-09-11

Canonical source: `docs/backlog.md` (Section 2 = Data Model Reference, Section 3 =
Triage Questions & Scoring Reference). This plan decomposes that backlog for
parallel kickoff; where anything here and `backlog.md` ever appear to disagree,
`backlog.md` wins — flag it, don't silently follow this doc instead. A clean,
standalone extract of Section 2 lives at `docs/data-model.md`.

**2026-09-11 update — TypeScript adopted.** Every `server/**/*.js` and `dashboard/**/*.js` file (and their test files) is being converted to `.ts`/`.tsx` equivalents with proper types. Any `.js` path named in this plan or in `backlog.md` should be read as its `.ts` equivalent. Build/run via `tsx` for dev and `tsc` for a compiled `dist/` build (see root `package.json`). Old `.js` files are being retired, not kept alongside their `.ts` replacements — delete the old file when its `.ts` replacement lands, don't leave both in the repo.

---

## 1. Sprint Goal & Definition of Done (plain language)

**Goal:** A person can message the WhatsApp sandbox number, choose a language, get a
one-time transit-privacy notice, walk through an 8-question triage (Yes / No / Prefer
not to say, one question at a time, via buttons), and have the system store every
answer and compute the correct `risk_level` on the `reports` row when the 8th answer
lands — with no legal/real name ever written to the database.

**Done means:** every Must story below (SEC-1, SEC-2, SEC-3, INF-1, INF-2, INF-3,
INF-4, TRI-1, TRI-2, TRI-3, LANG-1, LANG-2) is merged, covered by a passing test, and
demonstrable end-to-end against the live Twilio WhatsApp Sandbox in front of the team
at sprint review. INF-5 is Should and is the first thing cut if Day 3 is tight —
cutting it does not block the demo above.

### Resolved: Data Model Reference

~~This repo does not yet contain the canonical Data Model Reference~~ — resolved.
The full backlog, including Section 2's Data Model Reference and Section 3's Triage
Questions & Scoring Reference, is now in the repo at `docs/backlog.md`, and a
standalone annotated copy of Section 2 is at `docs/data-model.md`. Backend builds
INF-2's migrations directly from `docs/data-model.md` (or `backlog.md` Section 2 —
they must always match); no schema field is invented anywhere in this plan.

---

## 2. Ownership Map

| Role | Owns (story IDs) | Does NOT own |
|---|---|---|
| **Designer** | SEC-3 (copy), INF-3 (language-list copy), INF-4 (menu copy), INF-5 (copy), LANG-2, and `docs/conversation-design.md` (the master flow/copy spec everyone else implements against) | Any code. No `.js` files. |
| **QA** | Test-first specs for every Must story: failing Jest tests before implementation exists, plus a manual sandbox test script for the end-to-end demo | Implementation. QA doesn't fix code, it writes the tests that prove code is right and flags failures back to the owner. |
| **Networking / Twilio** | INF-1, `server/lib/whatsapp.js`, `server/routes/webhook.js` (skeleton only) | Conversation logic, state machine, scoring, DB writes beyond logging the raw inbound event |
| **Frontend** | Scaffold an empty, runnable `dashboard/` app skeleton (no dashboard stories exist until Sprint 2 — this is a head start so Sprint 2 opens with a running app, not a blank folder). Also reviews Designer's `conversation-design.md` for tone/terminology consistency with the eventual dashboard | Any Sprint 1 backend/bot behavior |
| **Backend** | SEC-1, SEC-2, INF-2, INF-3 (implementation), INF-4 (implementation), INF-5 (implementation, if time), TRI-1, TRI-2, TRI-3, LANG-1 (implementation) — i.e. everything that touches conversation state, scoring, and the DB | `whatsapp.js` internals, `webhook.js` request parsing/signature verification |

Backend is intentionally the largest owner — Sprint 1 is almost entirely server
logic. Networking's scope is deliberately narrow and self-contained so Backend can
build against a stable, small interface instead of a moving target.

---

## 3. Interface Contracts

These are frozen for Sprint 1. Changing a signature requires a message to the whole
team, not a silent edit.

### 3.1 `server/lib/whatsapp.js` (Networking-owned, Backend calls it, Backend never edits it)

```js
// Sends a plain text message. Resolves when Twilio accepts the send.
async function sendText(to, body) { }

// Sends up to 3 Quick Reply buttons (WhatsApp interactive "button" type).
// buttons: [{ id: string, title: string }]  (title ≤ 20 chars, WhatsApp limit)
async function sendButtons(to, body, buttons) { }

// Sends a WhatsApp interactive "list" message (used for language selection).
// sections: [{ title: string, rows: [{ id: string, title: string, description?: string }] }]
async function sendList(to, body, sections) { }

// Verifies the X-Twilio-Signature header on an incoming request.
// Returns boolean. Called by webhook.js before any payload is trusted.
function verifyWebhookSignature(req) { }

module.exports = { sendText, sendButtons, sendList, verifyWebhookSignature };
```

Backend's conversation logic imports and calls these four functions only. Backend
does not add functions to this file, does not read Twilio credentials directly, and
does not construct Twilio API calls anywhere else in the codebase — `whatsapp.js` is
the single chokepoint for all outbound WhatsApp traffic.

**Unblocking rule:** Backend does not wait for the real implementation. Backend
writes/uses a mock module with this exact same shape (e.g.
`server/__tests__/mocks/whatsapp.mock.js`) to develop and unit-test the state machine
against, and swaps to the real `whatsapp.js` for integration testing once Networking
lands it. This is the reason Backend and Networking can work fully in parallel.

### 3.2 Webhook handoff (`server/routes/webhook.js`, Networking-owned skeleton)

Networking's route does exactly three things, in order:

1. Verifies the request via `verifyWebhookSignature(req)` — reject with 403 if it
   fails.
2. Parses the raw Twilio webhook POST body into a normalized shape:

```js
// Normalized inbound message — the ONLY thing Backend's logic ever sees.
{
  from: string,        // WhatsApp number, e.g. "whatsapp:+2547XXXXXXXX"
  body: string | null, // free text, if the user typed instead of tapping a button
  buttonId: string | null, // the `id` from sendButtons/sendList, if the user tapped one
  timestamp: string,   // ISO 8601, when Twilio received it
}
```

3. Calls `handleIncomingMessage(normalizedMsg)` — a function **exported by
   Backend's** `server/lib/conversation.js` — and responds `200 OK` to Twilio
   immediately (within the 5s window from INF-1), not waiting on
   `handleIncomingMessage`'s side effects beyond what's needed to send a reply.

```js
// Backend-owned. Networking calls this; Backend owns everything inside it.
async function handleIncomingMessage(normalizedMsg) { }
module.exports = { handleIncomingMessage };
```

Networking never writes conversation state, never touches `triage_answers`,
`reports`, or any state-machine logic — its file ends at the call above. Backend
never edits `webhook.js` or touches raw Twilio payload parsing — it only receives
the normalized shape.

### 3.3 Single source of truth

Postgres is the only place conversation/session state, triage answers, and risk
scores live. No in-memory maps, module-level caches, or process-local session
objects that only Backend's process can see — `conversation_state` is a table, read
and written on every message. This matters now because it's the only way the
dashboard (Sprint 2, Frontend) will later read the same data Backend's bot writes,
without a second, parallel channel being invented later. If Backend needs fast
lookups, index the table — don't cache state outside it.

---

## 4. File Ownership Map

| Path | Owner | Notes |
|---|---|---|
| `server/lib/whatsapp.js` | Networking | Backend imports, never edits |
| `server/routes/webhook.js` | Networking | Thin skeleton per §3.2 |
| `server/lib/hashing.js` | Backend | Implements SEC-1 against QA's failing test |
| `server/lib/riskScoring.js` | Backend | Pure function `scoreRisk(answers)`, implements TRI-2 (path per backlog.md's TRI-2 technical notes) |
| `server/lib/content.js` | Backend | `t(key, language)` helper, LANG-1 |
| `server/lib/conversation.js` | Backend | State machine, `handleIncomingMessage`, INF-3/INF-4/INF-5/TRI-1/TRI-3 |
| `server/migrations/*` | Backend | Full schema, INF-2/SEC-2 |
| `server/seeds/*` | Backend | Seeds `content_strings` from Designer's LANG-2 copy; seeds `resources` if data supplied |
| `server/__tests__/*` | QA | QA writes and owns these files first; Backend may add narrower unit tests for its own internals alongside, but does not delete or weaken a QA-authored test to make it pass |
| `docs/conversation-design.md` | Designer | Full copy + flow spec: language list text, disclosure text, menu text, all 8 triage questions verbatim, device-safety copy |
| `docs/data-model.md` | PM | Published; annotated extract of `backlog.md` Section 2. Backend reads it for exact INF-2 field lists |
| `dashboard/**` | Frontend | Entirely Frontend's; nobody else touches this directory in Sprint 1 |
| `dashboard/package.json` | Frontend | Separate from root `package.json` — Frontend's dependency choices don't touch the server's `package.json` and vice versa |
| root `package.json` | Backend / Networking, coordinate before adding deps | Whoever adds a dependency runs `npm install` and commits the lockfile in the same commit to avoid churn |

Rule of thumb: if you're about to edit a file another role owns, stop and ask in
standup instead — that's exactly the collision this map exists to prevent.

---

## 5. Sequencing

**Can start immediately, Day 1, no dependencies:**
- Designer starts `docs/conversation-design.md` (language list copy, disclosure
  text, menu copy, the 8 triage questions, device-safety copy) — needs only the
  locked backlog.
- QA starts writing failing tests for the pure/isolated pieces: `hashing.js`,
  `riskScoring.js`, `content.js`/`t()`, and a signature-verification test stub for
  `whatsapp.js` — these need only the interface contracts in §3, not running code.
- Networking starts Twilio Sandbox setup, `whatsapp.js`, and the `webhook.js`
  skeleton — needs only Twilio credentials/env vars, not Backend's code.
- Backend starts SEC-1 (`hashing.js`) and TRI-2 (`riskScoring.js`) against QA's
  failing tests — both are pure functions with zero DB/Twilio dependency.
- Frontend starts scaffolding the `dashboard/` skeleton — needs nothing from anyone.

**Already unblocked:**
- `docs/data-model.md` (full field lists) is published — Backend can start INF-2
  migrations immediately, no waiting required.

**Should land before Backend starts INF-3/TRI-1 (ideally by end of Day 1):**
- Designer's `docs/conversation-design.md` — Backend needs exact copy/flow to wire
  the state machine and triage flow correctly the first time instead of
  re-wiring after the fact.
- QA's failing tests for the state machine, main menu, and triage flow (even as
  higher-level/integration-style tests) — these define "done" before Backend
  writes the behavior.

**Explicitly NOT a blocker:**
- Networking finishing the *real* `whatsapp.js` does not block Backend — Backend
  develops against the mock described in §3.1 and only needs the real module for
  final integration testing, which happens once both sides are ready (see below).

**Mid-sprint (Day 2):**
- Backend runs INF-2 migrations against `docs/data-model.md`.
- Backend implements LANG-1 + seeds `content_strings` once Designer's LANG-2 copy
  is available.
- Backend implements INF-3 (state machine + language selector), INF-4 (main menu),
  TRI-1/TRI-3 (triage flow + scoring wire-up) against the mock `whatsapp.js`.
- Frontend, once the dashboard skeleton runs, reviews
  `docs/conversation-design.md` for tone/terminology drift against the dashboard's
  eventual voice and flags anything back to Designer.

**Integration (Day 2 end / Day 3 start):**
- Backend swaps the mock for the real `whatsapp.js`; Backend and Networking jointly
  wire `webhook.js` → `handleIncomingMessage` and smoke-test one real message
  round-trip through the actual Sandbox.
- QA runs the full automated suite plus the manual end-to-end WhatsApp sandbox
  script (language select → disclosure → 8 questions → correct `risk_level`
  stored) and files bugs against the owning role.

**Day 3:**
- Bug-fix pass against QA's findings.
- INF-5 goes in if time allows; cut first if not, per the Sprint goal in §1.
- Sprint review demo.

---

## 6. Sprint 1 Definition of Done — Checklist

**SEC-1 — Hashing utility**
- [ ] `server/lib/hashing.js` exports `normalizeAndHash(text)` (per backlog.md's
      SEC-1 technical notes), which normalizes input (lowercase, trim, collapse
      internal whitespace, strip punctuation) before hashing
- [ ] Hash is HMAC-SHA256, secret read from `PERPETRATOR_HASH_SECRET` env var
- [ ] No code path anywhere in the repo stores the raw perpetrator identifier —
      only the hash reaches `perpetrator_hashes.hash_value`
- [ ] ≥5 unit tests passing (backlog.md DoD), covering deterministic hashing and
      case/spacing-insensitive equivalence
- [ ] No perpetrator text supplied → no `perpetrator_hashes` row created

**SEC-2 — No legal-name field / consent defaults**
- [ ] `reports` schema contains no `name`, `legal_name`, or `id_number` column
- [ ] `reports.perpetrator_consent_given boolean default false` and
      `reports.wants_counsellor_connect boolean default false` exist with those
      exact defaults at the DB level, not just in application code
- [ ] `reports.connect_requested_at timestamp` defaults null
- [ ] Confirmed by reading the actual migration files, not just the plan

**SEC-3 — Transit-privacy disclosure**
- [ ] Disclosure message sent exactly once, immediately after language selection
- [ ] Message never resent on subsequent contact within the same
      conversation/session
- [ ] Copy sourced verbatim from `docs/conversation-design.md`, in the
      user's selected language (English required for Sprint 1; other languages
      per LANG-2 scope)

**INF-1 — Twilio Sandbox + webhook**
- [ ] `POST /webhook/whatsapp` route live, verified against Twilio Sandbox
- [ ] Signature verification (`verifyWebhookSignature`) rejects unsigned/invalid
      requests
- [ ] A sent WhatsApp message receives a bot response within 5 seconds,
      demonstrated live

**INF-2 — Full schema**
- [ ] Migrations exist and run cleanly for all ten tables: `reports`,
      `triage_answers`, `perpetrator_hashes`, `pattern_matches`,
      `trusted_contacts`, `resources`, `counsellor_users`, `sms_alerts`,
      `content_strings`, `conversation_state`
- [ ] Field lists match `docs/data-model.md` exactly — no invented/partial fields
- [ ] `npm run migrate` runs from a clean DB with no manual steps

**INF-3 — State machine + language selector**
- [ ] Language selector presented as a WhatsApp list message with
      English / Kiswahili / Français options
- [ ] Selected language persisted against the WhatsApp number in
      `conversation_state`
- [ ] Session resets after 24h of inactivity (verified with a test that
      manipulates timestamps, not a real 24h wait)
- [ ] State machine reads/writes only through Postgres — no in-memory session
      store

**INF-4 — Main menu**
- [ ] Three translated options presented, exact copy per backlog.md INF-4:
      "Report something that happened" / "Find help near me" / "Know your rights"
      (content keys `menu.report` / `menu.find_help` / `menu.rights`)
- [ ] Each routes correctly — "Report..." → TRI-1's triage entry point; the other
      two route to DIR-2/DIR-3 respectively (Sprint 2 — may be stubs in Sprint 1
      as long as routing itself is correct and doesn't dead-end silently)

**INF-5 — Device-safety guidance (Should, cut-first)**
- [ ] If shipped: triggered by the user sending "0" or "help hiding this" from
      the main menu (content key `guidance.device_safety`); guidance covers
      saving the contact under a neutral name, WhatsApp's own Clear Chat/Archive,
      and an honest note that this PoC has no disguised app
- [ ] Copy checked against current WhatsApp UI terminology (backlog.md DoD)
- [ ] If cut: explicitly called out as cut in sprint review, not silently
      dropped

**TRI-1 — 8-question triage flow**
- [ ] Exactly 8 questions asked, one at a time, in the fixed order from
      backlog.md Section 3: STRANGLE → WEAPON → KILL_THREAT → ESCALATION →
      SEPARATION → SEXUAL_COERCION → CONTROL → SELF_PERCEIVED_DANGER
- [ ] Each question presented via Quick Reply buttons: Yes / No / Prefer not to
      say, using the exact English question text in backlog.md Section 3 (not a
      paraphrase)
- [ ] Each answer written to `triage_answers` (with the correct `question_key`)
      before advancing to the next question; "Prefer not to say" stores as `SKIP`
- [ ] A `reports` row is created with `status='IN_PROGRESS'` at flow start
- [ ] Mid-flow disconnect and resume (within 24h session window) resumes at the
      correct question, not from the start

**TRI-2 — `scoreRisk(answers)` in `server/lib/riskScoring.js`**
- [ ] Pure function, no DB access, unit-testable in isolation
- [ ] Override rule per backlog.md Section 3: `STRANGLE=YES OR WEAPON=YES OR
      KILL_THREAT=YES → HIGH`, each independently sufficient regardless of other
      answers
- [ ] Threshold rule: `ELSE IF count(YES, all 8) >= 4 → HIGH`, `ELSE → STANDARD`
- [ ] SKIP counts as NO for scoring
- [ ] ≥10 unit tests (backlog.md DoD) covering every override key individually,
      the 4-vs-3 threshold boundary (4 of the 5 non-override questions = HIGH,
      3 of them = STANDARD), and the all-NO case

**TRI-3 — Wire-up**
- [ ] Immediately after the 8th answer is stored, `scoreRisk` runs against all 8
      answers for that report
- [ ] `reports.risk_level` and `reports.status = 'SCORED'` are set in the same
      transaction/flow as the 8th answer — no window where the report sits
      answered-but-unscored

**LANG-1 — `content_strings` + `t()` helper**
- [ ] `content_strings` table keyed by `key` + `language`
- [ ] `t(key, language)` returns the requested language's string, or falls back
      to English if the language/key combination is missing — never throws,
      never returns `undefined` to a user-facing message

**LANG-2 — Full English content**
- [ ] Every content key referenced anywhere in Sprint 1 code has a
      corresponding English row in `content_strings` (seeded via
      `server/seeds/`)
- [ ] No hardcoded user-facing English strings remain in `conversation.js` —
      everything user-facing goes through `t()`

**Sprint-level**
- [ ] End-to-end demo: message the Sandbox number, pick English, receive the
      one-time disclosure, answer all 8 triage questions via buttons, confirm
      (via DB query, shown live) that `triage_answers` has 8 rows and
      `reports.risk_level`/`status` are correctly set
- [ ] Full automated test suite (`npm test`) green
- [ ] No raw perpetrator identifier or legal name present anywhere in the DB,
      confirmed by a live query at review
