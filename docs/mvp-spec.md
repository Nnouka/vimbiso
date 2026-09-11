# Vimbiso — 10-Day MVP Build Spec

*Prepared with Tendai Moyo. Track: Safety, Reporting & Protection (Transparency & Accountability cross-track element via Pattern Watch). Constraint: 10 days to complete a working PoC, GitHub repo, demo video, pitch deck, and written summary. USSD is out of scope for the build; WhatsApp is the primary and only citizen-facing channel for the demo.*

**Pilot country: Kenya** *(changed from an initial Zimbabwe default — see §0 for why).*

---

## 0. Why Kenya — and why not Zimbabwe, Cameroon, Rwanda, or Tanzania

The original Zimbabwe framing wasn't the result of comparing countries — it followed from how the founder persona was set up, not from where the problem is worst or the product would work best. Once challenged, a real comparison across Zimbabwe, Kenya, Cameroon, Rwanda, and Tanzania was run on: severity/currency of the crisis, existing hotline and institutional infrastructure to route into, language fit with the multilingual plan, mobile/USSD penetration, and relevant civic-tech heritage.

**Kenya wins on the merits:**

- **The strongest, most current, most multi-sourced crisis data of the five.** 220 femicides documented in Kenya in 2025, 129 in Q1 alone (roughly one a day), 1,069 killed 2016–2025, with boyfriend-perpetrated killings rising sharply — corroborated by the Heinrich Böll Foundation, Africa Uncensored/Africa Data Hub, UN Women, and UNESCO. Critically, **the Kenyan government stopped publishing femicide data after March 2025** — a live, current transparency failure, not just a severity statistic.
- **Real infrastructure to route into.** HAK/1195 is a dedicated, UN-backed, actively-promoted national toll-free GBV helpline — exactly the kind of partner that makes Vimbiso's "warm handoff to a real counsellor" step credible rather than aspirational.
- **Ushahidi is Kenyan** — built in Nairobi after the 2007–08 post-election violence, and directly cited as inspiration for Vimbiso's corroboration model from the very first pitch. Building for Kenya makes that lineage honest, not opportunistic.
- **Kenya (@KEN) is an actual participating Andela community chapter for this hackathon**, alongside Cameroon (@CMR) and Rwanda (@RWA) — unlike Zimbabwe and Tanzania, which are not represented at all. This turns translation-reviewer sourcing from hopeful cold outreach into a concrete ask in a channel where engaged hackathon participants already are.

**Why not Cameroon**, despite its femicide data being what originally forced the fix to the core safety mechanism: Vimbiso's whole premise is a smart front door into services that already exist. Human Rights Watch's own account of Cameroon describes weak institutions, chronic underinvestment, and a climate of impunity — there may not yet be a reliable door for Vimbiso to stand in front of. That's a market-readiness problem a translation reviewer can't fix. The Cameroon data still did its job: it's the reason risk-triage is now the primary safety mechanism regardless of geography.

**Trade-off accepted honestly:** the USSD/low-bandwidth story is less dramatic in Kenya, which skews smartphone-heavy, than it would be in Zimbabwe or Cameroon. USSD stays on the roadmap slide, reframed as serving the ~60% of Kenyans not yet online rather than as the pitch's central differentiator. The founder is also Harare-based, not Kenya-based — mitigated by committing, in the written summary, to building with real Kenyan civil-society partners (HAK, UN Women Kenya, the State Department for Gender) rather than designing for Nairobi in isolation.

---

## How reports get seen by counsellors

**A web dashboard is the system of record for every report, plus a real SMS alert (not WhatsApp) that fires only on High-Risk reports. Pattern Watch matches get no real-time alert — they sit in a periodic review queue.**

Reasoning:

- **WhatsApp is the wrong channel for counsellor-side urgency, and fragile to build on in 10 days.** Outside a 24-hour user-initiated session, WhatsApp Business only allows pre-approved template messages, which requires Meta review — not something to bet a live hackathon demo on. It's also a poor fit for how helplines like HAK/1195 actually operate: a call-center/hotline model, not a shared team WhatsApp inbox.
- **SMS has none of those constraints** — instant, no session window, no template approval. This mirrors Maryland's Lethality Assessment Program (officer scores risk, a human on the other end of a phone is looped in immediately), which produced an 82% increase in survivors actually receiving services in Pitt County, NC after adoption.
- **A dashboard, not a chat feed, because this is case management.** Counsellors need triage answers, timestamp, risk level, and status at a glance, sorted, with High-Risk visually pinned — a queue, not a scrolling chat log.
- **Pattern Watch deliberately gets no real-time alert.** By design it isn't urgent — nobody's safety depends on an institution checking it within minutes.

---

## 1. Scope: IN vs OUT for the 10-day build

### IN — built, working, demoable
- WhatsApp bot as the sole citizen-facing channel, via **Twilio WhatsApp Sandbox** (instant onboarding, no business-verification wait).
- Language selector: **English, Swahili, and French fully built and translated** (Swahili reviewer recruited via @KEN/@UGA; French reviewed by team member Nnouka, a native speaker — see §6); Arabic partial and Kinyarwanda architecture-only depending on volunteer/network response (see §6); Shona/Ndebele kept as already-built architecture-only proof of Southern African reach, no longer pilot-relevant.
- The 8-question risk-triage flow via WhatsApp button/list messages (emoji + short text, no free-typing required for core questions).
- Scoring logic: override rules (strangulation / weapon / kill-threat = automatic High Risk) plus a 4-of-8 threshold otherwise.
- Automatic High-Risk response: safety-plan message sequence, hotline number, "connect me now" button.
- Real Twilio SMS alert to an on-call demo counsellor phone, fired only on High Risk.
- Trusted-contact registration and a coded WhatsApp check-in alert.
- Counsellor web dashboard: report queue with High-Risk visually flagged, triage summary shown, a separate Pattern Watch tab.
- Seeded resource directory for Kenya, each entry tagged with source and last-verified date:
  - **HAK / 1195** — national toll-free GBV helpline (UN Women-backed).
  - **State Department for Gender** — reporting/escalation channel.
  - **Kenya Police Gender and Children's Desks** — nearest-desk lookup by county/region picker (Nairobi, Mombasa, Kisumu, National), not geolocation.
  - Remaining 3–5 entries to a full 5–8-entry directory get their own fresh Day-1 sourcing/verification pass — no shortcuts, since that verification step is the product's actual trust promise.
- Pattern Watch: consent-gated optional perpetrator-identifier field, salted-hash matching logic, a working match demo on 2–3 seeded test reports, surfaced only in the dashboard's separate tab — framed explicitly as "counting what the state stopped counting" after Kenya's government halted femicide-data publication in March 2025.

### OUT — cut, or described-only in the pitch deck as production roadmap
- USSD / feature-phone channel — dropped from the build; shown as a wireframe in the deck, framed around Kenya's offline ~60%, rural, and lower-income households rather than as the headline differentiator.
- Voice/IVR input for low-literacy users — roadmap item.
- Real telephony warm handoff to HAK/1195 — simulated (see §5).
- Masked-number/relay telephony so a survivor's real number never reaches the backend — not built for the PoC; disclosed as a pre-production hardening item.
- Full legal-partner-reviewed rights content — no signed legal partner within 10 days; any "know your rights" copy is marked "example content, pending legal partner review."
- The disguised-icon / quick-exit PWA feature — no dedicated app now that WhatsApp is the surface; mitigated with in-chat guidance to save the contact under a neutral name and use WhatsApp's own chat-clear/archive features, disclosed as weaker than a disguised app.
- Full review of every architecture-only language (Kinyarwanda unless a reviewer is found, Shona, Ndebele) — scaffolded, not claimed as production-ready.

---

## 2. Architecture (kept deliberately simple)

- **Channel:** Twilio WhatsApp Sandbox (a test number; testers join once via a join code).
- **Backend:** Node.js/Express webhook receiver plus bot logic (a conversation state machine), hosted on Railway or Render for one-command redeploys.
- **Database:** Postgres — tables for `reports`, `triage_answers`, `perpetrator_hashes`, `trusted_contacts`, `resources`, `counsellor_users`.
- **Risk engine:** a pure, isolated, unit-tested function — `scoreRisk(answers) -> {level, triggeredFactors}`.
- **Alerting:** Twilio SMS API, fired server-side on any `level == HIGH` write.
- **Counsellor dashboard:** a small server-rendered web app (Next.js or Express+EJS), single shared login for the demo, two views — Reports queue (High-Risk pinned red) and Pattern Watch queue.
- **Pattern Watch matching:** salted HMAC of a normalized perpetrator-identifier string, computed server-side at write time; a simple hash lookup surfaces matches.
- **Content model:** key-based, language-agnostic content schema from day one — adding a language is "add more values to existing keys," not a rebuild. This is what makes the multilingual tiering in §6 possible without extra developer time.

---

## 3. Day-by-day plan

| Day | Focus |
|---|---|
| 1 | Repo scaffold (via Claude Code); Twilio WhatsApp Sandbox + Postgres stood up; DB schema finalized; risk-scoring rules locked on paper; Kenya resource-directory entries sourced and verified. **Post volunteer-reviewer asks in @KEN/@UGA (Swahili, priority) and @EGY (Arabic); Nnouka asks around their CMU Africa Kigali network for a Kinyarwanda speaker, in parallel with an @RWA post.** French needs no ask — Nnouka is the confirmed reviewer. Swahili translation of the 8 triage questions + safety-plan copy begins; AI-assisted French drafting also starts. |
| 2 | Bot skeleton live end-to-end: language selector, main menu (Report / Find Help / My Rights), webhook round-trips a reply. |
| 3 | Full triage flow built (8 questions as button/list messages), scoring function unit-tested, report written to DB, High-Risk vs Standard branching confirmed. **In parallel:** AI-assisted Arabic and French drafts of the core ~35–40 strings (RTL rendering checked for Arabic); AI-drafted (unreviewed) Kinyarwanda scaffold strings for 1–2 screens. |
| 4 | High-Risk automatic response built: safety-plan sequence, "connect me now" button → logs request + fires real Twilio SMS to demo on-call phone; trusted-contact registration + coded alert send. |
| 5 | Resource directory + Swahili full integration/testing. **Nnouka's French review call happens today — a scheduled commitment, not a hoped-for response.** Incorporate any @KEN/@UGA/@EGY reviewer responses as they land. |
| 6 | Pattern Watch: consent-gated perpetrator field, hashing, matching logic, seeded test reports proving a real match fires. **Incorporate Nnouka's French corrections; wire Swahili and any other landed-review languages into the schema (~1–2 hrs dev time each, since it's just new keys on an existing structure).** |
| 7 | Counsellor dashboard built: queue view, High-Risk flagged red, Pattern Watch tab, basic auth. |
| 8 | Full end-to-end test pass in English, Swahili, and French (plus Arabic if reviewed in time), edge cases (timeouts, bad input, restart mid-flow), one full live dry-run of the exact demo script over real WhatsApp. Unreviewed languages checked for correct rendering only — not certified for a live safety decision. |
| 9 | Record the demo video (see §4); start the pitch deck. |
| 10 | Finish deck (with tiered language-coverage slide), written summary (track, sources, trust/accuracy approach, AI-tool usage, country-selection rationale), polish the GitHub README, package submission, buffer for last-minute fixes. |

Two full days (9–10) are protected for video and deck — separately judged deliverables, not an afterthought.

---

## 4. Demo video — shot list

1. 15-second cold open: voiceover, Kenya's numbers on screen — **220 femicides in 2025, 129 in the first three months alone, and the government stopped publishing the count after March 2025.**
2. Real phone screen: someone messages the Vimbiso WhatsApp number, picks Swahili from the language menu.
3. Selects "Report," walks through the triage — answers "yes" to the strangulation question.
4. No waiting, no match required — the bot immediately responds: "You are in serious danger," safety-plan card, HAK/1195 hotline number, "Connect me to a counsellor now" button.
5. Cut to a second phone: the on-call counsellor's phone receiving a real Twilio SMS — proof this is a live alert, not a mockup.
6. Cut to a laptop: the counsellor dashboard, the new report pinned red at the top with the triage summary, no name shown.
7. Cut to the trusted contact's WhatsApp receiving the coded check-in message.
8. Second scenario, quick: the Standard-risk path — "Find Help" returns a real seeded Kenyan resource with source + last-verified date visible.
9. 10-second cutaway: Pattern Watch's dashboard tab, "3 reports matched this identifier" on seeded data, narrated as "counting what the state stopped counting" — explicitly separate, not urgent, never something a survivor waits on.
10. Close: one line tying the demo back to the judging criteria.

French appears as a short, fully-confident safety-plan cutaway (guaranteed reviewer). Arabic, if @EGY responds in time, gets the same treatment; if not, it — along with Kinyarwanda and any other unreviewed language — appears only as a static deck screenshot with an "AI-drafted, pending review" label visible, never attempted live.

---

## 5. Real vs. simulated — disclosed explicitly in the demo and written summary

**Real:** the WhatsApp bot and conversation flow; the risk-scoring logic and branching; the Twilio SMS alert to the on-call phone; the trusted-contact WhatsApp alert; the resource-directory data (sourced and dated, displayed as text, not auto-dialed during testing); the Pattern Watch hashing and matching logic; the counsellor dashboard.

**Simulated/mocked, and disclosed as such:** "Connect me now" fires a demo on-call SMS rather than ringing an actual HAK/1195 line — framed as "in production this triggers a real handoff via Kenya's existing helpline; for the PoC we simulate the counsellor side since we have no live integration agreement yet." "Know your rights" copy is example content pending legal review. Arabic/French/Kinyarwanda translation quality depends on whether a volunteer reviewer responded in time — the deck states exactly which languages were reviewed and which weren't. Voice/IVR and USSD are not built — roadmap only. The masked-callback telephony layer is not built — the survivor's WhatsApp number is used directly, stated openly.

---

## 6. Multilingual scope — final priority order

The content is key-based, not hardcoded, so adding a language is "add more values to existing keys," not a rebuild — but translation and *review* are still real work for the ~35–40 safety-critical strings (risk-triage questions and scoring branches, plus the High-Risk safety-plan sequence). Menus/navigation/resource-directory copy (~20–25 strings) are lower-stakes; "know your rights" content is already example-only pending legal review in every language.

**Reviewer sourcing now combines two paths:** the actual Andela hackathon community channels (Kenya @KEN, Uganda @UGA, Egypt @EGY, Cameroon @CMR, Rwanda @RWA — all real, active participating chapters for this event) for languages without a team member, and a real, committed team reviewer for French — Nnouka, Cameroonian, based at CMU Africa in Kigali, fluent in English/French/Pidgin, offered to review personally. A guaranteed on-team reviewer beats a speculative community post regardless of any other consideration, which is why French now ranks ahead of Arabic below despite Arabic's stronger brief-alignment case.

**Final priority order:**

1. **English** — FULL (baseline).
2. **Swahili** — FULL, pilot-critical. Reviewer sourced via @KEN (primary — the pilot community itself) and @UGA (parallel backup). High-confidence ask: engaged hackathon participants, not a cold network ping.
3. **French** — FULL, guaranteed reviewer. An AI-assisted first pass drafts the full corpus (safety-critical strings plus menus/directory copy); Nnouka reviews all of it as a native speaker and core team member — schedulable as a Day 3 draft → Day 5 review, not a hope-someone-answers slot. Doubles as a team-credibility point: Cameroon's own femicide data is what corrected Vimbiso's core safety mechanism during development, and the team now has a real French speaker with lived ties to that market.
4. **Arabic** — PARTIAL if @EGY responds in time; otherwise stays honestly labeled architecture-only. Still worth pursuing: the brief explicitly names Arabic as one of OSF's core operating languages, and it's the only language on this list that exercises right-to-left rendering inside WhatsApp's button/list messages — a real architecture proof, not just another Latin-script translation.
5. **Kinyarwanda** — architecture-only by default; upgradeable to PARTIAL via two parallel funnels: the @RWA community post, and Nnouka asking around their own CMU Africa Kigali network — a findable, ask-in-person lead, not a cold channel drop.
6. **Shona / Ndebele** — architecture-only, kept as already-built proof of Southern African reach from the pre-pivot work; not pilot-relevant, not chased further.

**Decisive rule if multiple volunteers respond at once:** Swahili and French are both committed (pilot-critical and team-guaranteed respectively) — neither is at risk. Arabic gets the next real translation/review slot given its brief-alignment and RTL proof value if @EGY responds. Kinyarwanda goes to whichever of the two funnels lands first; if neither does, it stays honestly labeled architecture-only in the deck and written summary — never quietly upgraded without a real review behind it.

**Demo discipline:** a thin or broken translation live on camera costs more on Presentation than the language count gains on Scalability. English, Swahili, and French (as a short safety-plan cutaway) are the only languages shown live in the demo video — French replaces the previously-provisional Arabic slot now that it has a guaranteed reviewer. Arabic, Kinyarwanda, Shona, and Ndebele appear only as static, labeled screenshots on the deck's coverage-tier slide.

---

## 7. Team assumption

Three core people: **product/pitch/deck/video/resource research and reviewer coordination** (Tendai's role); **one full-stack developer** using Claude Code as a genuine pair-programmer for the bot state machine, risk engine, matching logic, and dashboard — the load-bearing, tightest-resourced role; **Nnouka** — Cameroonian, based at CMU Africa in Kigali, working with Andela, fluent in English/French/Pidgin — leading the French-language build and review, and coordinating the Kinyarwanda lead through their own Kigali network.

Added need beyond the core team: **1–2 unpaid volunteer reviewers recruited from @KEN/@UGA (Swahili) and @EGY (Arabic)**, contacted asynchronously starting Day 1, costing the build itself close to zero time. French is no longer a recruitment risk. If only Swahili and French land — the pilot-critical language and the team-guaranteed one — that's still a credible, honestly-scoped submission; Arabic and Kinyarwanda are upside, not dependencies.

**Team paragraph for the deck / written summary:**

*Vimbiso is built by a team with lived, not theoretical, reach across the geographies it's designed to serve: Tendai Moyo, a Harare-based civic-tech founder and native Shona speaker, leads product and the Zimbabwe-origin research that shaped the risk-triage design; Nnouka, Cameroonian, based at CMU Africa in Kigali and working with Andela, is fluent in English, French, and Pidgin, and leads the French-language build — the same market whose 2026 femicide data corrected our core safety mechanism during development. Kenya is our hackathon pilot, chosen for its documented crisis data and its real, functioning national GBV helpline (HAK/1195) to hand survivors off to. Cameroon and Rwanda are named next-expansion targets, not overclaimed pilot markets — reflecting where our own team already has real standing to build the institutional partnerships each new market genuinely requires before Vimbiso should operate there.*
