# QA Script — End-to-End Language-Path Test (QA-2)

Owner: QA · Sprint 3, Day 8. Required by `docs/backlog.md`'s QA-2 (`docs/backlog.md`
Section 5): "a written script covering English, Swahili, French journeys," verified
against language selection, all 3 menu paths, one HIGH and one STANDARD journey, and
all 4 HR actions.

**How this script was actually run in this environment:** this sandbox has no
outbound access to a real Twilio account, so every step below was executed by
calling the real `handleIncomingMessage()` function in `server/lib/conversation.ts`
directly with a synthetic inbound-message object — the exact function a real Twilio
webhook calls after signature verification — against a real local PostgreSQL 16
instance, with a capturing (never-network) stand-in for the `twilio` package that
records what would have been sent instead of sending it. See
`docs/qa-sprint3-report.md` §1 for the full methodology and its limits. Every
result quoted below is a real row from that real database, not a hand-simulated
trace. **A real Twilio WhatsApp Sandbox round-trip has not happened** and is not
claimed here — that remains an open item, tracked against HR-2/INF-1.

Run the same steps yourself against a live Twilio Sandbox with:
```bash
ngrok http 3000   # then paste the webhook URL into the Twilio console — see docs/twilio-setup.md
```

---

## 1. Language selection (all 3 languages)

| Step | English | Swahili | French |
|---|---|---|---|
| First message → language selector sent | ✅ verified (Journey A, C, D) | ✅ verified (Journey B, E) | ❌ not run this sprint |
| Selection persists across the session (`conversation_state.language`) | ✅ | ✅ | ❌ |
| Re-prompts after 24h inactivity | ❌ not verified (requires real elapsed time or a mocked clock — not attempted) | ❌ | ❌ |

**Gap, stated plainly:** no French journey was driven this sprint. French shares the
exact same `PARTIAL`-tier safety-critical content as Swahili (11 keys — see
README's Language coverage table) and the exact same code path, so there is no
reason to expect different *behavior* — but "no reason to expect a difference" is
not the same as "verified," and this script does not claim it's verified. Running
Journeys A/E's steps with `lang_fr` substituted for `lang_sw`/`lang_en` is the
immediate next step before this box can be honestly ticked complete.

## 2. All 3 main-menu paths (English)

| Path | Verified | Evidence |
|---|---|---|
| "Report something that happened" (`menu_report`) | ✅ | Journeys A, B, E — each produces a `reports` row and 8 `triage_answers` rows. |
| "Find help near me" (`menu_find_help`) | ✅ | Journey C (`region_mombasa`) and Journey D (`region_other`, national fallback) — see §4. |
| "Know your rights" (`menu_rights`) | ✅ | Journey C — disclaimer + all 3 points sent, confirmed via `conversation.ts`'s `sendRightsContent`. |
| "Set up a trusted contact" (`menu_trusted_contact`, HR-3's 4th option) | ✅ | Journey A — see §3. |

## 3. One HIGH journey (English) — Journey A

STRANGLE=YES, all other 7 questions=NO (override rule) → `risk_level='HIGH'`.

1. `reports` row created, `status` progresses `IN_PROGRESS` → `SCORED`, `risk_level='HIGH'` — confirmed (report id 4).
2. HR-1 safety-plan sequence fires in the same handling cycle as the 8th answer (danger-intro, 4-item plan, hotline number pulled live from `resources`, connect prompt) — confirmed via the captured outbound message log (52 total sends across the full driver run).
3. "Yes, connect me" tapped → `wants_counsellor_connect=true`, `connect_requested_at` set, one `sms_alerts` row written (`sent_to=+15005550006`, `status='sent'`) — confirmed.
4. A trusted contact registered *before* the report (HR-3) → HR-4 fires automatically: `trusted_contacts.alert_sent_at` set — confirmed.
5. PW-1 consent prompt fires after the connect ack → "Yes" → identifier submitted → matched against the pre-existing PW-3 seed data (same fake identifier) → `pattern_matches` row updated to include this new report — confirmed (`report_ids={2,3,1,4}`).

## 4. One STANDARD journey — Journey B (Swahili) + Journey D (English, region_other)

Journey B: all 8 answers NO → `risk_level='STANDARD'` (report id 5) → automatic DIR-2
handoff → Nairobi region picked → returns the GVRC Nairobi resource with source
attribution → PW-1 consent declined → confirmed no `perpetrator_hashes` row for
this report.

Journey D (isolated re-run, English, menu-triggered rather than post-score):
"Other / National" region option tapped → falls back to the national hotline
(`National GBV & Child Protection Helpline (1195)`) — confirmed by inspecting the
actual captured message body.

Between Journeys B and D, all 3 of DIR-2's region options (Nairobi, Mombasa,
Other/National) have now been exercised at least once against real data.

## 5. All 4 HR actions

| Action | Verified | Language(s) |
|---|---|---|
| HR-1 safety-plan sequence | ✅ | English (Journey A), Swahili (Journey E) |
| HR-2 real-code-path SMS alert (capturing shim, not a live Twilio send) | ✅ (as code; not yet as a live SMS) | English |
| HR-3 trusted-contact registration | ✅ | English |
| HR-4 automatic trusted-contact alert | ✅ (as code; not yet as a live WhatsApp send) | English |

Journey E (added specifically to close this gap) repeated the HIGH-risk override
(STRANGLE=YES) in Swahili and confirmed every `highrisk.*`/`pw.consent_prompt` key
resolved to real Swahili text with zero fallback warnings, while unrelated
menu/triage strings honestly fell back to English (expected — those keys were
never in Swahili's `PARTIAL`-tier scope).

---

## Failures logged

None found that reflect a real defect in the shipped code. Two issues surfaced
during this sprint's harness-building were bugs in the *test harness* (a local
`pg`-over-`psql` shim built because `npm install` is blocked here), not in
`server/`'s or `dashboard/`'s own code — see `docs/ai-tool-usage-log.md`'s Sprint 3
entry for the full account, and `docs/qa-sprint3-report.md` §1 for how each was
caught and fixed before being trusted as evidence.

## Explicitly deferred (with reasoning)

- **French journey.** Same content/code path as Swahili; not independently driven
  this sprint. Low risk given the shared code path, but unverified is unverified —
  flagged rather than assumed.
- **Real Twilio Sandbox round-trip; real SMS to a real phone.** Categorically
  impossible in this sandboxed dev environment (no outbound Twilio API access).
  Required before HR-2/INF-1's own DoD can be honestly ticked; required before
  SUB-1's demo video can be recorded, per `docs/backlog.md`'s dependency note.
- **24-hour session-reset behavior (INF-3).** Requires either real elapsed time or
  a mocked clock; not attempted this sprint.
- **Real Express/EJS dashboard rendering / screenshots.** No real `express`/`ejs`
  packages installable here. Substituted with direct verification of the
  dashboard's actual SQL query strings against the real database — see
  `docs/qa-sprint3-report.md`. That is strong evidence about correctness, but it
  is not a screenshot and this script does not present it as one.
