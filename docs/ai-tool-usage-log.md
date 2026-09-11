# Vimbiso — AI Tool Usage Log

*A running record of how AI tools were used to build this project, kept from ideation through the 10-day build. This is the source material for the hackathon's required written summary (SUB-3) and for judging on "AI Coding Usage" — update it as the build proceeds so the eventual summary is a report of what actually happened, not a reconstruction.*

The running principle across every phase below: **AI drafts, a human verifies before anything ships**, especially anywhere safety, trust, or accuracy is at stake. That standard was set early (translation review) and then applied recursively to research claims, product mechanisms, and even the country/market selection itself.

---

## Phase 1 — Competitive ideation (multiple independent AI agents, web-grounded)

Rather than developing one idea top-down, four independent AI agents were each briefed with the hackathon rubric and assigned a track, then sent to research the web and produce a fully-sourced venture proposal and pitch, competing against each other:

- **Amara Okafor** (Transparency & Accountability, Nigeria) — a WhatsApp/USSD budget-project tracker, grounded in real BudgIT/ICPC/GSMA data.
- **Tendai Moyo** (Safety, Reporting & Protection) — became Vimbiso, the eventual winner.
- **Fatou Diallo** (Stability & Social Cohesion, Sahel) — a voice/USSD mediation-routing line for farmer-herder conflict.
- **Youssef El-Amin** (cross-track, Tunisia) — a refugee rights/safety/rumor-correction tool.

Each agent was required to cite real sources for every claim rather than invent statistics, and each was judged against the brief's four equally-weighted criteria (Uniqueness, Scalability, AI Coding Usage, Presentation). Vimbiso won on the strength of its cryptographic matching-escrow mechanism (adapted from Stanford's Callisto project) and its disciplined AI-coding story.

**AI's role:** generating and researching multiple competing directions in parallel, at a speed no single founder could match, so the selection was made from real, sourced options rather than the first idea that came to mind.
**Human/oversight role:** the judge (Nnouka) selected the winner and set the evaluation criteria.

---

## Phase 2 — Critical stress-testing, using real-world evidence to correct a safety-critical design flaw

The winning design's original safety mechanism — a survivor's report stays sealed unless a second, independent survivor names the same perpetrator — was challenged directly: does this mean a lone survivor is left unprotected? AI web search was used to verify this wasn't hypothetical: real, current reporting (Human Rights Watch, Aug 2026; Cameroon's Ministry of Women's Empowerment; multiple local outlets) documented an active, escalating femicide crisis in Cameroon, overwhelmingly involving intimate partners — a pattern the matching-escrow design structurally cannot help, since intimate partner violence has one victim per perpetrator, not multiple victims to eventually "match."

This evidence was put back to the agent (in the Tendai Moyo persona) as a direct challenge, not accepted as a flaw to defend. The agent's response redesigned the core mechanism: every report now runs through mandatory risk-triage first (based on validated real-world tools — Johns Hopkins' Danger Assessment, the UK's DASH checklist, Maryland's Lethality Assessment Program), with an automatic high-risk response that fires from a single, solo report. The matching-escrow feature was kept but demoted to a secondary, non-urgent signal for a different, better-suited threat model (serial institutional predators, not intimate partners).

**AI's role:** surfacing the disconfirming evidence via web search, and then doing the actual mechanism redesign once challenged.
**Human/oversight role:** asking the question that exposed the flaw in the first place, and requiring the agent to fix the design rather than defend it — the single most consequential correction in the project's development.

---

## Phase 3 — Comparative, evidence-based market/geography selection

The pilot country (initially Zimbabwe, an artifact of how the founder persona was first set up rather than a deliberate choice) was challenged and re-decided through a structured comparison across five countries (Zimbabwe, Kenya, Cameroon, Rwanda, Tanzania) on crisis severity/currency, existing institutional infrastructure to route survivors into, language fit, mobile/USSD penetration, and civic-tech heritage — using fresh web research for each. Kenya was selected on the merits (current, multi-sourced femicide data; a real national helpline, HAK/1195; Ushahidi's own Kenyan origin as the direct inspiration for the corroboration model), and this was independently confirmed by checking the actual Andela hackathon community's participating country chapters.

**AI's role:** running the multi-factor comparison and web research across five candidate countries and defending a specific, ranked recommendation rather than an "any could work" hedge.
**Human/oversight role:** naming the omission (why Zimbabwe and not X?) that triggered the re-analysis, and supplying the real hackathon community data that sharpened the final call.

---

## Phase 4 — Re-planning around real team facts

When the actual team make-up was disclosed — Nnouka, Cameroonian, based at CMU Africa in Kigali, fluent in English/French/Pidgin, available to review French translation personally — the multilingual plan and the country narrative were both reworked to reflect it honestly: French moved from a speculative "hope a volunteer answers" slot to a guaranteed FULL-tier language with a named, real reviewer; the earlier decision to keep Kenya (not Cameroon) as the pilot was re-examined on its merits rather than assumed to flip just because the founder has personal ties to Cameroon, and held — for a stated institutional-readiness reason, not inertia. Cameroon and Rwanda were instead written into the plan as named, honest next-expansion markets.

**AI's role:** re-deriving the language-tier priority order and demo plan under the new facts, and explicitly re-litigating (rather than reflexively reversing) the Cameroon-as-pilot question on its actual merits.
**Human/oversight role:** supplying the real constraint (an actual bilingual reviewer, actual lived ties to two relevant markets) that the plan had to be honestly re-priced against.

---

## Phase 5 — Structured decomposition into an agent-buildable backlog

The finalized product and MVP scope were decomposed into a full Epics → Sprints → User Stories backlog (`vimbiso-backlog.md`), written at a level of detail intended for a coding agent (e.g. Claude Code) to pick up a single story and implement it correctly without further clarification: every story carries Given/When/Then acceptance criteria, exact technical notes (data model fields, endpoints, libraries), explicit dependencies, and a definition of done. The safety-critical content (the 8 triage questions and their override-scoring rules) was written once as a reference table other stories point to, rather than re-derived per story — reducing the chance an implementing agent invents its own version of safety-critical logic.

**AI's role:** the actual decomposition — turning a product spec into buildable, testable units of work.
**Human/oversight role:** requesting the level of detail needed specifically because the work would be handed to agents, and reviewing the resulting backlog before build start.

---

## Phase 6 — The build itself (log entries added as the 10 days progress)

This section is a template — append one entry per significant AI-assisted build session, so the written summary can quote specifics rather than assert "we used AI to build this" in the abstract.

**Where AI pair-programming is expected to matter most, per the backlog's own technical notes:**
- Test-driven development of the risk-scoring function (TRI-2) and the perpetrator-hashing utility (SEC-1) — both are safety/privacy-critical, both are pure functions well-suited to writing the test first, then generating and verifying the implementation against it.
- Scaffolding the WhatsApp bot's conversation state machine (INF-1/INF-3) and the Twilio SMS alerting integration (HR-2).
- Drafting first-pass translations (Swahili, French, and any stretch languages) for human review — never shipped unreviewed for safety-critical strings.
- Building the counsellor dashboard (DASH epic) and the Pattern Watch hash-matching logic (PW epic).
- Generating the seed data ingestion for the Kenyan resource directory (DIR-1), with every entry still manually source-checked against its cited URL before use.

**Log format (copy this row per entry):**

| Date | Story ID(s) | What AI did | What a human verified/changed | Notes |
|---|---|---|---|---|
| 2026-09-11 | Sprint 1 kickoff (all) | Six role-specialized AI agents (PM, Designer, QA, Networking, Backend, Frontend) worked from the locked backlog: PM wrote the interface contracts and file-ownership map before anyone touched code; Designer wrote the full WhatsApp conversation script; QA wrote failing Jest tests for `scoreRisk`/`normalizeAndHash` *before* those functions existed (TDD); Networking built the Twilio WhatsApp/SMS integration layer against a frozen function-signature contract; Frontend scaffolded a standalone dashboard app ahead of its Sprint 2 stories; Backend implemented the schema, hashing, scoring, content pipeline, and conversation state machine against QA's tests and Designer's copy. | A human (Nnouka) reviewed and approved the role split and the "coordinate first, then build" sequencing before work started. Backend could not run `npm install` or real `npx jest` in the build environment (npm registry blocked at the network-policy level, confirmed via direct `curl` test, not just proxy config) — verified logic instead by running QA's actual, unedited test assertions through a hand-rolled Jest-compatible shim (18/18 riskScoring cases, 14/14 hashing cases passed) and by `node --check` syntax-validation on every file. Real `npm install && npm test` on a machine with normal registry access is still required as the authoritative check before Sprint 1 is signed off. | Two interface deviations were surfaced and explicitly flagged rather than silently absorbed: `sendList()` needed a 4th optional parameter beyond the originally frozen contract (additive, non-breaking); an env var naming mismatch between the backlog's shorthand and Networking's actual code was caught and resolved by standardizing on one name. Both are the kind of integration friction real teams hit, surfaced by agents holding each other to the written contract instead of silently reconciling differences. |

---

## Notes for the written summary (SUB-3)

When drafting the final submission text from this log, be specific and honest rather than general: name which parts were AI-drafted-then-human-reviewed (translations, especially) versus AI-and-human-collaboratively-designed (the risk-triage mechanism, the country selection) versus AI-generated-and-directly-used (research citations, the backlog itself, boilerplate code). The strongest, most credible claim available from this project's actual history is not "we used AI a lot" — it's "AI was used to generate and stress-test multiple real options fast, and every safety-critical or trust-critical output was still gated by explicit human verification," which is demonstrably true across every phase above.
