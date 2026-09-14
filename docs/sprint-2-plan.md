# Sprint 2 Plan — Vimbiso (Days 4–7)

Author: Product Manager · Status: LOCKED for kickoff · Last updated: 2026-09-12

Canonical source: `docs/backlog.md` (Section 2 = Data Model, Section 4 = Sprint Plan,
Section 5 = User Stories). Where anything here and `backlog.md` disagree,
`backlog.md` wins — flag it, don't silently follow this doc instead.

All ten schema tables already exist from Sprint 1's INF-2 migrations (including
`resources`, `pattern_matches`, `trusted_contacts`, `sms_alerts`, `counsellor_users`)
— **Sprint 2 needs zero new migrations**, only seed data and application logic.

---

## 1. Sprint Goal & Definition of Done

**Goal:** Every report — HIGH or STANDARD — produces its correct automatic response
end-to-end: a HIGH-risk report fires the full safety-plan sequence, a real Twilio SMS
to the on-call counsellor, and (if registered) a coded trusted-contact alert; a
STANDARD-risk report gets a real, sourced Kenyan resource. A logged-in counsellor
sees this in a working dashboard, HIGH pinned first, with a separate non-urgent
Pattern Watch tab. English is fully covered; Swahili and French safety-critical
content exists in draft form, honestly tiered.

**In scope:** HR-1, HR-2, HR-3, HR-4 · DIR-1, DIR-2, DIR-3 · PW-1, PW-2, PW-3 ·
DASH-1, DASH-2, DASH-3, DASH-4 · LANG-3 (draft), LANG-4 (safety-critical subset,
draft pending Nnouka's real review).

**Done means:** every Must story is merged, covered by whatever tests this
environment can run, and each story's `docs/backlog.md` checkbox reflects its real
state (per the convention in `CONTRIBUTING.md`) — not silently marked `[x]` for
something that still needs a live Twilio/Postgres run to actually prove.

---

## 2. Ownership Map (Sprint 2)

| Role | Owns (story IDs) | Does NOT own |
|---|---|---|
| **Designer** | Copy for HR-1, HR-3, DIR-2, DIR-3, PW-1; the 4th main-menu entry; Swahili + French draft translations of the safety-critical subset (tiered PARTIAL, explicitly unreviewed) | Any code |
| **QA** | Failing tests for `patternMatch.ts` (PW-2) before it exists; Playwright specs for the now-real dashboard (DASH-1..4); `docs/qa-sprint2-checklist.md` | Implementation |
| **Backend** | HR-1, HR-3, DIR-1, DIR-2, DIR-3, PW-1, PW-2 (implementation against QA's tests), PW-3, `content_en.ts` updates | `whatsapp.ts`/`sms.ts` internals, `dashboard/**` |
| **Networking** | HR-2's `alertOnCallCounsellor()` helper in `sms.ts`; confirms HR-4 uses `whatsapp.ts`'s existing `sendText`; reviews Backend's PRs touching `server/lib/*` (per `CONTRIBUTING.md` pairing) | Conversation state, scoring, DB writes |
| **Frontend** | DASH-1, DASH-2, DASH-3, DASH-4 — all of `dashboard/**` | Bot backend (`server/**`) |

Reviewer pairing for Sprint 2 PRs is exactly `CONTRIBUTING.md`'s table: Backend↔Networking,
Frontend reviewed by QA (functional) + Designer (copy), tests reviewed by whoever
owns the code under test.

---

## 3. Frozen Interface Contracts

### 3.1 `server/lib/patternMatch.ts` (Backend-owned, PW-2)

A pure decision function, no DB access — QA writes tests against this exact shape
before Backend implements it:

```ts
export interface MatchDecision {
  isMatch: boolean;           // true if hashValue matches a hash from >=1 other report
  allReportIds: number[];     // deduped [...otherReportIds, reportId] if isMatch; [] otherwise
}

export function evaluateHashMatch(
  hashValue: string,
  reportId: number,
  otherReportIdsWithSameHash: number[], // report_ids (already excluding reportId) found in
                                          // perpetrator_hashes with the same hash_value
): MatchDecision
```

Backend wraps this with the actual DB round-trip (a separate, non-pure function,
e.g. `recordAndCheckPattern(reportId, hashValue)` in the same file or in
`conversation.ts`): `SELECT report_id FROM perpetrator_hashes WHERE hash_value = $1
AND report_id != $2`, call `evaluateHashMatch`, then upsert `pattern_matches`
(create if no row with that `hash_value` exists; otherwise merge `reportId` into its
`report_ids` array, deduped).

### 3.2 `server/lib/sms.ts` addition (Networking-owned, HR-2)

```ts
// Formats and sends the on-call counsellor alert. The ONLY thing this function
// is allowed to put in the SMS body is report_id, risk_level, and a timestamp —
// per HR-2's AC, never a survivor name or WhatsApp number.
export async function alertOnCallCounsellor(
  reportId: number,
  riskLevel: 'HIGH' | 'STANDARD',
): Promise<{ sid: string }>
```

Reads `ONCALL_COUNSELLOR_PHONE` internally (same lazy-env-read pattern as the rest
of this file). Backend calls this one function from `conversation.ts` — it does not
hand-format the SMS body itself, so the "no PII in the SMS" guarantee lives in the
file that owns Twilio, not scattered into Backend's code.

### 3.3 Main menu — 4th option (Designer copy, Backend wiring)

Add a 4th main-menu row: **"Set up a trusted contact"** (content keys
`menu.trusted_contact` / `menu.trusted_contact_row`), routing to HR-3's registration
flow. Existing 3 options (`menu.report` / `menu.find_help` / `menu.rights`) keep
their content keys and routing unchanged — this is additive, not a renumbering.

### 3.4 Dashboard `data-testid` conventions (Frontend implements, QA's Playwright specs assume these)

| Element | `data-testid` |
|---|---|
| Login form username field | `login-username` |
| Login form password field | `login-password` |
| Login submit button | `login-submit` |
| Each row in the reports queue | `report-row` (repeated; use `data-risk="HIGH"` / `data-risk="STANDARD"` alongside it so tests can assert ordering) |
| Risk badge inside a report row | `risk-badge` |
| Each row in the Pattern Watch tab | `pattern-match-row` |
| "Mark reviewed" button | `mark-reviewed-btn` |
| Report detail container | `report-detail` |

Frontend adds these attributes as it builds; QA's specs reference them exactly as
listed here, not guessed independently.

### 3.5 `resources` seed shape (Backend-owned, DIR-1)

`server/seeds/resources_kenya.ts`, seeding `country='KE'` rows covering at minimum:
the national hotline (HAK/1195), one Nairobi-region resource, the Kenya Police
Gender & Children's Desk, and the State Department for Gender's reporting channel.
Every row needs non-null `name`, `phone`, `source_name`, `source_url`,
`last_verified_date`. **Every entry must be a real, currently-findable resource —
if a phone number or URL can't be confirmed live, mark it clearly in a code comment
as "needs verification before demo" rather than inventing a plausible-looking one.**

---

## 4. Content Keys Needed (Designer authors exact copy; Backend wires the key names below)

- `highrisk.intro`, `highrisk.plan_1` … `highrisk.plan_4`, `highrisk.hotline_prefix`, `highrisk.connect_prompt`, `highrisk.connect_yes_ack`, `highrisk.connect_no_ack` (HR-1)
- `trusted_contact.prompt`, `trusted_contact.ask_number`, `trusted_contact.confirm`, `trusted_contact.invalid_number` (HR-3)
- `trusted_contact.alert_message` — fixed per backlog.md HR-4 AC: *"Thinking of you — call me when you can."* (do not paraphrase this one; it's specified verbatim in the backlog)
- `menu.trusted_contact`, `menu.trusted_contact_row` (main menu 4th option)
- `dir.region_prompt`, `dir.region_nairobi`, `dir.region_mombasa`, `dir.region_other`, `dir.result_format` (DIR-2)
- `rights.disclaimer`, `rights.point_1`, `rights.point_2`, `rights.point_3` (DIR-3)
- `pw.consent_prompt`, `pw.consent_yes_ack`, `pw.consent_no_ack` (PW-1)

Swahili/French: draft the same keys for the safety-critical subset (`highrisk.*`,
`pw.consent_prompt`) at minimum — full parity is a stretch goal, not required for
Sprint 2 done.

---

## 5. Sequencing

**Wave 1 (parallel, start immediately):**
- Designer writes all Sprint 2 copy + draft translations.
- QA writes failing tests for `patternMatch.ts` against §3.1's frozen contract, and
  Playwright specs against §3.4's `data-testid` conventions (specs can be written
  before the dashboard has real data — they assert against seeded fixtures Backend/
  Frontend will provide).

**Wave 2 (parallel, after Wave 1 lands):**
- Backend implements HR-1/3, DIR-1/2/3, PW-1/2/3 using Designer's copy and
  satisfying QA's `patternMatch.ts` tests without editing them.
- Networking adds `alertOnCallCounsellor()` to `sms.ts`.
- Frontend implements DASH-1..4 against real DB data, adding the `data-testid`
  attributes QA's specs expect.

**Integration:**
- Backend wires `alertOnCallCounsellor()` and the trusted-contact `sendText` alert
  into `conversation.ts` at the right points (HR-1's connect-prompt "Yes" branch;
  immediately after HR-1 fires, if a trusted contact is registered).
- PM reconciles `docs/backlog.md` checkboxes against what's actually demonstrated
  in this environment (most stories will land as "code-complete, pending live
  Twilio/Postgres verification" — same honesty bar Sprint 1 used).

---

## 6. What does NOT change

`server/lib/whatsapp.ts`, `server/routes/webhook.ts`, `server/lib/riskScoring.ts`,
`server/lib/hashing.ts`, `server/lib/content.ts`, `server/lib/db.ts`, and the
Sprint 1 conversation flow up through TRI-3 are frozen — Sprint 2 extends
`conversation.ts` with new branches, it does not rewrite Sprint 1's flow. Any
change to a Sprint 1 file's exported signature must be flagged in the PR
description per `CONTRIBUTING.md`, not silently absorbed.
