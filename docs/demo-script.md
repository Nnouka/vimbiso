# Demo Video — Shooting Script (SUB-1)

Status: **script/storyboard only, finalized and shootable — the recorded video itself has not been made.** Recording it requires a live Twilio WhatsApp Sandbox, a real on-call counsellor phone, and a real trusted-contact phone, none of which exist inside this build sandbox (no outbound access to Twilio's API here). This document is the closest achievable deliverable from inside this environment: every line of on-screen copy below is pulled verbatim from the real `content_strings` seeded in Sprint 2/3, and every beat is one Sprint 3 actually verified works against a real database (see `docs/qa-script.md`), so recording this script is a matter of following the steps against a real Twilio Sandbox — not a matter of hoping the product behaves as scripted. QA-2/QA-3 dependency (per `docs/backlog.md`'s SUB-1 note) is satisfied at the code/data level; a live Twilio round-trip is the one remaining precondition, and is Nnouka's/Tendai's to run on Days 9–10.

**Target length:** ~2:30–3:00. **Two phones + one laptop needed:** Phone A (survivor), Phone B (on-call counsellor + trusted contact — can be two phones if available, or narrated as two separate real sends from the same footage), laptop (counsellor dashboard).

---

## 0. Cold open (0:00–0:15)

Voiceover over Kenya's numbers on screen (pull directly from the pitch deck's stat slide, do not re-derive):

> "220 femicides in Kenya in 2025. 129 in the first three months alone. And in March 2025, the government stopped publishing the count. In Cameroon At least 50 women were killed in domestic violence incidents between January and April 2026 alone"

Cut to black, then the Vimbiso wordmark.

## 1. Language selection (0:15–0:25)

Phone A: message the Vimbiso WhatsApp Sandbox number. First reply is the language selector. Tap **Kiswahili**.

## 2. Main menu → report (0:25–0:35)

Real menu copy (English shown for reference; on-screen will be the Swahili equivalent, which is `PARTIAL`-tier and not yet reviewed by a fluent speaker — see the honesty note in §5):

> "What would you like to do?
> 1. Report something that happened
> 2. Find help near me
> 3. Know your rights
> 4. Set up a trusted contact"

Tap **"Report something that happened."**

## 3. Triage — the strangulation question (0:35–0:55)

The bot asks the 8 fixed-order questions one at a time via Yes/No/Prefer-not-to-say buttons. For the demo, answer the first question (STRANGLE) **Yes**, and the remaining 7 **No** — this is the HIGH-risk override path, verified in Sprint 3 to fire correctly in both English and Swahili (Journeys A and E in `docs/qa-script.md`).

Show 2–3 of the question taps on screen (don't show all 8 — pace the video), then cut to the score firing.

## 4. Automatic HIGH-risk response (0:55–1:20)

This fires automatically, same handling cycle, no further input. Real copy, verbatim (English shown; the Swahili version is the actual `tier='PARTIAL'` text used in Sprint 3's Journey E, already verified to resolve correctly with zero fallback):

> "What you've told me suggests you could be in serious danger right now. Here's what to do, in order:"
> 1. "Pack a small bag now, if you can do it without being noticed — ID, some cash, a phone charger, a change of clothes."
> 2. "Think of one neighbor or nearby person you trust, and how you'd get to them quickly if you needed to."
> 3. "Memorize one phone number by heart — a trusted contact or the hotline below — in case your phone isn't with you."
> 4. "Keep your phone charged, and know where the charger is."
>
> "If you can, call this number now — it's free and available:
> [real HAK/1195 number, pulled live from `resources` at send time]"
>
> "Would you like me to connect you to a counsellor right now?"

Tap **Yes**.

> "Okay. A counsellor has been notified and will try to reach you. Keep the hotline number above in case you need it before then."

## 5. Cut to counsellor's phone — real SMS (1:20–1:35)

Phone B receives a real Twilio SMS. On-screen, the message body should show only `report_id`, `risk_level`, and a timestamp — no survivor name or number, per HR-2's own privacy contract. Narrate: "This is a real SMS, sent by a real Twilio account — not a mockup."

**This is the one shot in the whole video this sandbox cannot produce itself** — everything else in this script has been run for real against a real database; this beat needs a live Twilio Sandbox and a real phone.

## 6. Cut to laptop — counsellor dashboard (1:35–1:55)

Show the reports queue: the new HIGH-risk report pinned in red at the top, phone number masked (`•••• 0001`, never shown in full — this masking was verified in Sprint 3 against real data, see `docs/qa-sprint3-report.md` §1.1), triage summary visible, no name anywhere.

## 6a. Counsellor replies in-channel (1:55–2:00) — DASH-5

From the same report detail view, open the report and show the counsellor typing a short follow-up ("Hi, this is Vimbiso — I'm here, are you safe to talk?") into the new reply box and hitting Send. Cut back to Phone A: the message arrives on the survivor's existing WhatsApp thread with the bot — same number, same conversation, no new app or channel.

Narrate: "The counsellor can keep talking to the survivor right here, on the same WhatsApp thread — no need to switch to a personal phone."

**Honesty note (on-screen caption):** this only works inside WhatsApp's 24-hour session window after the survivor's last message — the dashboard hides the reply box and explains why once that window closes, rather than silently failing or offering a fake send.

## 7. Cut to trusted contact's phone (1:55–2:05)

If a trusted contact was registered earlier in the flow (do this as an earlier, unshown step, or narrate it), their phone receives, verbatim, untranslated, exactly:

> "Thinking of you — call me when you can."

Narrate: "Vague on purpose — coded, not alarming, in case someone else sees the phone."

## 8. Second scenario, quick — STANDARD path (2:05–2:20)

New number, all 8 answers No → STANDARD risk → automatic region picker. Tap **Nairobi**. Real result format (verbatim template, real data):

> "[Resource name]
> [phone]
> Source: [source name], last verified [date]"

Narrate: "Every resource is real, sourced, and dated — never invented."

## 9. Pattern Watch cutaway (2:20–2:30)

Dashboard's Pattern Watch tab, seeded demo data (obviously-fake, labeled `TEST-DEMO-PERPETRATOR-DO-NOT-USE`). Narrate:

> "Counting what the state stopped counting — but never something a survivor waits on. This runs quietly in the background, gated by consent, and never delays a single person's own safety response."

## 10. Close (2:30–2:45)

One line tying back to the track:

> "Information you can trust, when it matters most — verified against a real database, not just claimed. Vimbiso."

---

## What's guaranteed to work if shot exactly as scripted

Every beat above except §5 (the real SMS arriving) and §7 (the real WhatsApp alert arriving) was independently verified in Sprint 3 by running the actual product code against a real Postgres database — not hand-waved. See `docs/qa-script.md` for the full journey-by-journey evidence and `docs/qa-sprint3-report.md` for the underlying query output. §5 and §7's code paths are equally verified (the exact SMS body and WhatsApp message text were confirmed byte-for-byte against a capturing test double) — what's unverified is only the live network delivery itself, which requires the real Twilio account this sandbox does not have access to.

## Explicit honesty notes for the video's own on-screen captions

- Caption during §4/§5: "Connect me now fires a demo on-call SMS via our own Twilio account — in production this triggers a real handoff via Kenya's existing HAK/1195 helpline; we simulate the counsellor side since we have no live integration agreement with a real organization yet."
- Caption during §2/§4 if Swahili is shown: "Swahili content shown here is AI-drafted and not yet reviewed by a fluent speaker (tier: PARTIAL)."
- Caption during "Know your rights" if included: "Example content, not yet reviewed by a legal partner."
- Do not show Arabic, Kinyarwanda, Shona, or Ndebele live — those remain deck-only, static screenshots labeled architecture-only/unreviewed, per `docs/mvp-spec.md` §4.
