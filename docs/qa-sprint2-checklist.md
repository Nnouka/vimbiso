# QA Sprint 2 Definition-of-Done Checklist

Owner: QA · Status: unticked template for sprint review — **do not self-grade this
file**. Every box below is derived directly from each story's AC/DoD in
`docs/backlog.md` Section 5, for the stories in Sprint 2 scope (`docs/backlog.md`
Section 4 / `docs/sprint-2-plan.md` §1). Tick a box only at sprint review, against
the owning role's demonstrated evidence (a passing test, a live query, a real SMS
received, a manual demo step, a screenshot) — not against a claim that it's done.

Where this checklist and `docs/backlog.md` ever disagree, `backlog.md` wins. Where
`docs/backlog.md` and `docs/sprint-2-plan.md` ever disagree, `backlog.md` wins too
(`sprint-2-plan.md` §0 says so explicitly) — flag the mismatch instead of silently
picking one.

`docs/backlog.md` Section 5 carries a `[x]`/`[ ]` box and a one-line `Status:` note
per story, kept current as PRs land (see `CONTRIBUTING.md` §"Opening a pull
request"). That's the running, story-by-story picture; this file stays the
stricter box — every item here ticks only against live/demonstrated evidence at
actual sprint review, regardless of what backlog.md's interim status says.

**Environment note carried over from Sprint 1:** this dev sandbox cannot run
`npm install` (package registry unreachable — see `docs/ai-tool-usage-log.md`).
QA's Sprint 2 test files (`server/__tests__/patternMatch.test.ts` and the
Playwright specs under `server/__tests__/e2e/`) were written correctly against
the real Jest/Playwright APIs and the frozen contracts in
`docs/sprint-2-plan.md` §3.1/§3.4, but have **not** been executed in this
environment. A real `npm test` / `npx playwright test` run, in an environment
where the tests can actually execute, is required before any box below that
depends on them can be honestly ticked.

---

## HR-1 — Immediate safety-plan sequence

- [ ] Given `risk_level='HIGH'`, all 4 parts fire, in order: danger-intro line,
      the 4-item safety-plan list (pack a bag, identify a safe neighbor,
      memorize one number, keep phone charged), the real hotline number, and
      a Yes/No "connect me to a counsellor now?" prompt
- [ ] Content comes from keys `highrisk.intro` / `highrisk.plan_1..4` /
      `highrisk.connect_prompt` — no hardcoded copy in `conversation.ts`
- [ ] Hotline number is queried live from `resources` (`category='hotline'`,
      `country='KE'`) at send time — never a hardcoded string anywhere in code
- [ ] All 4 parts arrive within 5 seconds of the 8th triage answer, verified
      manually in English
- [ ] Same verified manually in Swahili (DoD explicitly requires both
      languages)

## HR-2 — Counsellor-connect logging + real SMS alert

- [ ] "Yes" tapped → `wants_counsellor_connect=true` and
      `connect_requested_at` set on the report row
- [ ] "Yes" tapped → exactly one `sms_alerts` row is written
      (`report_id`, `sent_to`, `sent_at`, `twilio_sid`, `status`)
- [ ] The SMS is sent via `alertOnCallCounsellor(reportId, riskLevel)` in
      `server/lib/sms.ts` (sprint-2-plan.md §3.2's frozen contract) — Backend
      does not hand-format the SMS body itself elsewhere
- [ ] SMS body contains only `report_id`, `risk_level`, and a timestamp — no
      survivor name or WhatsApp number anywhere in the body (spot-checked by
      reading the actual sent message text, not just the code)
- [ ] "No" tapped → no SMS fires, and the hotline number remains visible for
      self-service
- [ ] A real SMS arrives on a real test phone within 10 seconds — verified
      live against the real Twilio account, not mocked, before video
      recording

## HR-3 — Trusted-contact registration

- [ ] Main menu's 4th option ("Set up a trusted contact") is present and
      routes here, without breaking or renumbering the existing 3 options
      (`menu.report` / `menu.find_help` / `menu.rights` keep their content
      keys and routing unchanged, per sprint-2-plan.md §3.3)
- [ ] A submitted WhatsApp number creates a `trusted_contacts` row keyed to
      `survivor_whatsapp_number` — **not** `report_id`
- [ ] Registration persists independently of any single report (retrievable
      in a later, separate report for the same survivor number)
- [ ] Registration is retrievable by HR-4 in a live test

## HR-4 — Automatic trusted-contact alert

- [ ] Given a registered trusted contact and a HIGH-risk report firing, the
      contact receives exactly: *"Thinking of you — call me when you can."*
      (verbatim — not paraphrased; sprint-2-plan.md §4 flags this string as
      fixed)
- [ ] `trusted_contacts.alert_sent_at` updates when the alert sends
- [ ] Given no contact is registered, this step silently no-ops (no error, no
      crash, no message sent to anyone)
- [ ] Verified with a real test HIGH-risk report against a registered contact

## DIR-1 — Seed real, sourced Kenyan directory

- [ ] `server/seeds/resources_kenya.ts` exists and runs clean
- [ ] `resources` contains, at minimum: the HAK/1195 national hotline, ≥1
      Nairobi-region resource, the Kenya Police Gender & Children's Desk
      contact, and the State Department for Gender's reporting channel
- [ ] Every seeded row has non-null `name`, `phone`, `source_name`,
      `source_url`, `last_verified_date`
- [ ] Every entry has been spot-checked against its live `source_url` (not
      just assumed correct from when it was written) before Day 5
- [ ] Any entry whose phone/URL could not be live-confirmed is marked in a
      code comment as "needs verification before demo" — none are invented
      to look plausible (sprint-2-plan.md §3.5)

## DIR-2 — "Find Help" region picker

- [ ] "Find help near me" (main menu) and the Standard-risk branch (post-TRI-3)
      both trigger the same region picker
- [ ] Offers exactly "Nairobi / Mombasa / Other-National"
- [ ] Each of the 3 region options returns a real, non-empty resource: name,
      phone, and "Source: {source_name}, last verified {date}"
- [ ] A region with no region-specific match falls back to the national
      hotline rather than returning empty/erroring

## DIR-3 — "Know your rights" example content

- [ ] "Know your rights" sends 2–3 short points
- [ ] Every response is prefixed with: *"This is example information and has
      not yet been reviewed by a legal partner."* (verbatim disclaimer)
- [ ] Disclaimer is visible in every language this content ships in for
      Sprint 2 — not just English
- [ ] If cut for time, explicitly called out as cut at sprint review (backlog
      priority is **Could** — first item cut if Sprint 2 runs long)

## PW-1 — Optional consent-gated perpetrator capture

- [ ] After a report is scored, the closing step offers a skippable prompt
      using content key `pw.consent_prompt`, matching backlog.md's specified
      wording in intent (not necessarily verbatim — Designer owns final copy)
- [ ] "Yes" sets `perpetrator_consent_given=true` and passes the raw text to
      `normalizeAndHash()` (SEC-1) — the raw text itself is never persisted
      anywhere
- [ ] "No" / skip ends the flow with zero `perpetrator_hashes` row written
- [ ] Consenting produces **exactly one** `perpetrator_hashes` row, verified
      by direct DB inspection with zero raw perpetrator text present anywhere
      in that row or any other table

## PW-2 — Hash matching logic

- [ ] `server/lib/patternMatch.ts` exports `evaluateHashMatch(hashValue,
      reportId, otherReportIdsWithSameHash)` matching sprint-2-plan.md §3.1's
      frozen shape exactly — no invented alternative signature
- [ ] `server/__tests__/patternMatch.test.ts` (QA-authored, test-first) passes
      against Backend's implementation, unedited by Backend
- [ ] The DB-touching wrapper (e.g. `recordAndCheckPattern`) correctly
      excludes the current `report_id` from its own
      `SELECT ... WHERE hash_value = $1 AND report_id != $2` query
- [ ] A new `perpetrator_hashes` row whose `hash_value` matches an existing
      row from a *different* `report_id` creates or updates exactly one
      `pattern_matches` row (`hash_value`, `report_ids[]`, `status='NEW'`)
- [ ] No match → no `pattern_matches` row is created
- [ ] Two live test reports with the same normalized identifier are
      confirmed, by direct DB query, to produce exactly one `pattern_matches`
      row referencing both `report_id`s

## PW-3 — Seed demo match data

- [ ] Seed script produces ≥1 matched pair using an obviously-fake, clearly
      test-labeled identifier (e.g. a name no real seed data would plausibly
      contain)
- [ ] Running the seed and loading the dashboard's Pattern Watch tab shows at
      least one matched pair, visible before Day 9's recording
- [ ] Confirmed this seed contains zero real/plausible-real perpetrator data
      (it exists purely for demo credibility, per backlog.md's rationale)

## DASH-1 — Authenticated dashboard shell

- [ ] No session → `/login` shows a real login form
- [ ] Correct `counsellor_users` credentials (bcrypt-verified password) start
      a real session and load the queue
- [ ] Wrong credentials show an error and create **no** session
- [ ] `/dashboard/*` redirects any unauthenticated request to `/login`
- [ ] Login/logout both work end-to-end, manually verified
- [ ] `dashboard-login.spec.ts` (QA-authored Playwright spec) passes against
      the real implementation, using the frozen `data-testid` values
      (`login-username` / `login-password` / `login-submit`) from
      sprint-2-plan.md §3.4

## DASH-2 — Reports queue, High-Risk pinned

- [ ] Given mixed-risk reports, HIGH-risk rows render before all STANDARD
      rows
- [ ] Within each risk group, rows are newest-first
- [ ] HIGH rows are visually flagged (red)
- [ ] Each row shows: id, timestamp, `risk_level`, a YES-answer summary,
      region, and connect status — and never a real name
- [ ] 3 seeded reports (2 HIGH, 1 STANDARD) render in the correct order with
      the correct flags — the exact fixture named in backlog.md's DoD
- [ ] `dashboard-queue.spec.ts` passes, asserting ordering via
      `[data-testid="report-row"][data-risk="HIGH"]` per sprint-2-plan.md
      §3.4's frozen convention

## DASH-3 — Pattern Watch tab

- [ ] Given `pattern_matches` rows exist, the tab shows linked `report_ids`,
      `created_at`, and a "Mark reviewed" button per row
- [ ] Visually distinct from the Reports queue — no red flags, no urgent
      language anywhere on this tab
- [ ] PW-3's seeded match renders on this tab
- [ ] Clicking "Mark reviewed" actually updates `pattern_matches.status` to
      `'REVIEWED'` (not just a client-side visual change)
- [ ] `pattern-watch.spec.ts` passes, using the frozen `pattern-match-row` /
      `mark-reviewed-btn` `data-testid` values

## DASH-4 — Report detail view

- [ ] Clicking a report row navigates to that report's detail view
- [ ] Detail view shows all 8 `triage_answers` (question text + the given
      answer), the report's `risk_level`, and any `sms_alerts` timestamps for
      that report
- [ ] Detail view's displayed values match the underlying DB rows exactly for
      a test report (spot-checked by direct query comparison)
- [ ] `report-detail.spec.ts` passes, asserting against the frozen
      `report-detail` `data-testid`

---

## Sprint-level Definition of Done (docs/sprint-2-plan.md §1 / docs/backlog.md §4)

- [ ] A HIGH-risk test report fires the full safety-plan sequence (HR-1) end
      to end
- [ ] That same test fires a real Twilio SMS to the on-call counsellor (HR-2)
      — verified live, not mocked
- [ ] If a trusted contact is registered, that same test fires the coded
      trusted-contact alert (HR-3/HR-4)
- [ ] The dashboard (DASH-2) shows that HIGH-risk report pinned at the top of
      the queue
- [ ] A seeded Pattern Watch match (PW-3) renders correctly in its own,
      clearly non-urgent tab (DASH-3)
- [ ] A STANDARD-risk report returns a real, sourced Kenyan resource (DIR-1/
      DIR-2)
- [ ] `server/__tests__/patternMatch.test.ts` is green against Backend's real
      `server/lib/patternMatch.ts`, executed in an environment where
      `npm install`/`npm test` actually run (not just reviewed for
      correctness, as it was in this sandbox)
- [ ] The four Playwright specs under `server/__tests__/e2e/` are green
      against a real, running `dashboard/` app with Sprint 2 seed data
      loaded, executed in an environment where `npx playwright test`
      actually runs
- [ ] English is fully covered across all Sprint 2 stories in scope
- [ ] Swahili and French safety-critical content (LANG-3 draft, LANG-4
      safety-critical subset) exists, honestly tiered (`PARTIAL`/`FULL` as
      actually reviewed, not aspirationally marked `FULL` before review
      happens)
- [ ] Every Sprint 2 story's `docs/backlog.md` checkbox reflects its real,
      demonstrated state — not silently marked `[x]` for something that still
      needs a live Twilio/Postgres/browser run to actually prove (same
      honesty bar as Sprint 1, per sprint-2-plan.md §1)
