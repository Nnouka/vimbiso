# Vimbiso

A WhatsApp-first risk-triage and safety-response tool for gender-based violence reporting — Kenya pilot, built for the OSF/Andela hackathon (Safety, Reporting & Protection track).

Every report runs through an 8-question risk screen first; a survivor scored high-risk gets an immediate, automatic safety response (safety plan, real-time counsellor alert, trusted-contact check-in) from a single report — nobody has to wait for a second person to corroborate before getting help. See `docs/mvp-spec.md` for the full product rationale and `docs/backlog.md` for the complete Epics/Sprints/User Stories this was built against.

This repo has **two independent Node apps**:

- **root** (`/`) — the WhatsApp bot backend: Express + TypeScript + Postgres, talks to Twilio.
- **`dashboard/`** — the counsellor-facing web dashboard: its own Express + TypeScript + EJS app, own `package.json`, runs on a different port.

They share a database but are otherwise separate processes — run both if you want the full picture, or just one if you're only working on that half.

---

## Prerequisites

- **Node.js 20+** and npm (project uses `tsx` for TypeScript execution in dev and `tsc` for a compiled build — no other global tooling needed).
- **PostgreSQL** — either running locally, or a free hosted instance (Supabase and Render both offer one; see [Using a hosted Postgres instead of local](#using-a-hosted-postgres-instead-of-local) below).
- **A Twilio account** (free trial is enough for development) with the **WhatsApp Sandbox** enabled — see `docs/twilio-setup.md` for the full walkthrough, including how to get a public webhook URL via `ngrok` for local dev.
- **ngrok** (or an equivalent tunnel) only if you want to actually exchange messages with the WhatsApp Sandbox from your machine — everything else (migrations, unit tests, the dashboard UI) works without it.

---

## 1. Clone and install

```bash
git clone <this-repo-url> vimbiso
cd vimbiso
npm install          # installs the root (bot backend) app
cd dashboard
npm install          # installs the dashboard app separately — it's its own project
cd ..
```

## 2. Configure environment variables

Both apps read from their own `.env` file (gitignored). Copy the examples and fill them in:

```bash
cp .env.example .env
cp dashboard/.env.example dashboard/.env
```

Root `.env` needs (see the comments in `.env.example` for exactly where each value comes from):

| Variable | What it's for |
|---|---|
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | From the Twilio Console dashboard homepage. |
| `TWILIO_WHATSAPP_FROM` | The WhatsApp Sandbox's number, e.g. `whatsapp:+14155238886`. |
| `TWILIO_SMS_FROM` | A Twilio number capable of sending plain SMS (used for the on-call counsellor alert on a HIGH-risk report). |
| `DATABASE_URL` | Postgres connection string. |
| `PERPETRATOR_HASH_SECRET` | A long random secret (`openssl rand -hex 32`) — salts the hash used for Pattern Watch. Never reuse this across environments. |
| `ONCALL_COUNSELLOR_PHONE` | E.164-format phone number the real Twilio SMS alert fires to when a report scores HIGH. |
| `MESSAGE_LOG_HASH_SECRET` | A long random secret (`openssl rand -hex 32`), separate from `PERPETRATOR_HASH_SECRET` — the message-audit log's (LOG-1) one-way sender pseudonym. |
| `MESSAGE_LOG_ENCRYPTION_KEY` | A long random secret (`openssl rand -hex 32`) — reversible encryption for logged message content (LOG-1/LOG-2), so the dev-only console mirror can read it back. |
| `SENDER_IDENTITY_RECOVERY_KEY` | **Do not set this in `.env`.** The only key that can turn a logged sender pseudonym back into a real number (LOG-3) — see `.env.example`'s comment and `server/scripts/recoverSenderIdentity.ts`. It's supplied only at the moment that script is deliberately, manually run, never stored in normal app config. |
| `PORT` | Defaults to `3000`. |

Dashboard `.env` (`dashboard/.env`) needs `PORT` (defaults to `3001`, deliberately different from the root app so both can run at once) and `SESSION_SECRET`. It will also read `DATABASE_URL` once DASH-1 wires up real authentication (Sprint 2) — set it now to the same value as the root app's if you want to be ready.

**Nobody needs to guess at Twilio/Supabase/Render credentials themselves** — if you're setting up a shared dev or staging environment rather than your own local sandbox, ask Nnouka for the real values rather than provisioning a second parallel account.

## 3. Set up the database

With `DATABASE_URL` pointing at a running Postgres instance:

```bash
npm run migrate   # runs every file in server/migrations/, in order, idempotently
npm run seed      # loads the English content_strings (LANG-2) so the bot has copy to send
```

## 4. Run it

In one terminal, the bot backend:

```bash
npm run dev       # tsx watch server/index.ts — restarts on file changes, http://localhost:3000
```

In another terminal, the dashboard:

```bash
cd dashboard
npm run dev       # tsx watch server.ts — http://localhost:3001
```

The dashboard is browsable immediately (`http://localhost:3001/login`) even with no real data yet — Sprint 1 shipped it as a working, navigable skeleton; DASH-1..4 (Sprint 2) fill in real authentication and real report data.

### Actually exchanging WhatsApp messages

The bot backend only does something interesting once Twilio can reach its webhook. Locally, that means a tunnel:

```bash
ngrok http 3000
```

Then paste the `https://...ngrok-free.app/webhook/whatsapp` URL into the Twilio Console's WhatsApp Sandbox settings (exact steps in `docs/twilio-setup.md`), and message the Sandbox number from your own WhatsApp after joining it with the Sandbox's join code.

## 5. Tests and type-checking

```bash
npm run typecheck   # tsc --noEmit — root app
npm test            # jest, via ts-jest — currently covers scoreRisk and normalizeAndHash

cd dashboard
npm run typecheck   # separate tsconfig, separate check
```

Playwright end-to-end tests (`playwright.config.ts`) start landing in Sprint 2 once the dashboard has real data to assert against — see `server/__tests__/e2e/README.md` for the template.

## 6. Building for deployment

```bash
npm run build   # compiles server/**/*.ts to dist/
npm start       # runs the compiled dist/index.js

cd dashboard
npm run build
npm start
```

Deployment targets (Render for both app services, a hosted Postgres such as Supabase or Render's own Postgres) aren't wired up yet — when we get to that step, ping Nnouka for the real Render/Supabase/Twilio production credentials rather than improvising placeholder ones.

---

## Using a hosted Postgres instead of local

If you don't want to install Postgres locally, both Supabase and Render offer a free hosted instance — create one, copy its connection string into `DATABASE_URL` in both `.env` files, and run `npm run migrate && npm run seed` as above. Nothing else in the app changes; it's a plain `pg` connection string either way.

---

## Project structure

```
.
├── server/                  # bot backend (root app)
│   ├── index.ts             # Express entry point
│   ├── lib/                 # hashing, risk scoring, content/i18n, DB pool, conversation state machine, Twilio wrappers
│   ├── routes/               # webhook.ts — the Twilio inbound webhook
│   ├── migrations/           # numbered SQL files, run in order
│   ├── seeds/                 # content_en.ts — English copy for content_strings
│   └── __tests__/            # jest specs (unit) + e2e/ (Playwright, Sprint 2+)
├── dashboard/                # counsellor-facing web app — independent Node project
│   ├── server.ts
│   └── views/                 # EJS templates
├── docs/                      # planning docs — see below
├── .github/                   # PR template + CODEOWNERS
└── CONTRIBUTING.md            # branching, PR, and review workflow — read this before opening a PR
```

## Privacy

Vimbiso is built so that a data breach or a subpoena of this database cannot expose a survivor's abuser. In practice:

- **No legal-name field exists anywhere.** `reports` and `trusted_contacts` have no `name`, `legal_name`, or `id_number` column — confirmed by direct schema inspection (`\d reports`, `\d trusted_contacts`) as part of Sprint 3's live database audit (see `docs/qa-sprint3-report.md`).
- **A perpetrator is never named in text, only matched by a salted hash.** `perpetrator_hashes` stores only `hash_value` (HMAC-SHA256, secret in `PERPETRATOR_HASH_SECRET`) and `algorithm` — never the raw identifier text. Sprint 3's audit ran a live query for the literal test identifier across every text/jsonb column in every table and found zero matches outside the one hash column that's supposed to hold its hash.
- **Every cross-report and outbound action is consent-gated, and the gate is enforced in the schema's own data, not just in the code that writes it.** `reports.perpetrator_consent_given` and `reports.wants_counsellor_connect` default to `false`; live data confirms no `perpetrator_hashes` row exists for any report where consent is `false`, and no `sms_alerts` row exists for any report where `wants_counsellor_connect` is `false`.
- **A phone number is never shown in full on a shared screen.** The counsellor dashboard's reports queue masks `whatsapp_number` to its last 4 digits (`•••• 0001`) before rendering — this isn't in SEC-2's original AC, but is a judgment call carried through Sprint 2 and confirmed against real data in Sprint 3.
- **An SMS alert to the on-call counsellor never carries the survivor's number or name** — only `report_id`, `risk_level`, and a timestamp (see `sms.ts`'s `alertOnCallCounsellor`, and `sms_alerts`'s own schema, which has no `body` column — the message text itself is never persisted).
- **A one-time transit-privacy disclosure** ("This chat runs over WhatsApp... consider deleting this chat afterward") fires once per new conversation before any menu shows, tracked via `conversation_state.disclosure_shown` — confirmed firing exactly once for every number exercised in Sprint 3's live-database pass.

What this PoC does **not** do: end-to-end encrypt beyond what WhatsApp/Twilio itself provides, run on infrastructure audited by a third party, or promise that Twilio/WhatsApp/your hosting provider can't see that a conversation happened — the disclosure above says this to the user directly rather than overclaiming.

## Language coverage

Every user-facing string is served from `content_strings`, keyed by `(key, language)`, with an explicit `tier` column (`FULL` / `PARTIAL` / `ARCHITECTURE_ONLY`) so a language is never silently presented as more complete than it is. `server/lib/content.ts` falls back to English (logging the fallback) whenever a key is missing for the selected language — verified live in Sprint 3 (a full Swahili HIGH-risk journey correctly used the real Swahili safety-plan text for every `highrisk.*`/`pw.consent_prompt` key, while every menu/triage string it hit honestly fell back to English rather than showing anything untranslated or broken).

| Language | Tier | Keys seeded | What's actually covered |
|---|---|---|---|
| English (`en`) | `FULL` | 87 | Every user-facing string in the product. |
| Swahili (`sw`) | `PARTIAL`, unreviewed | 11 | Only the safety-critical HR-1 sequence (`highrisk.intro`, `highrisk.plan_1..4`, `highrisk.hotline_prefix`, `highrisk.connect_prompt`, `highrisk.connect_yes_ack`, `highrisk.connect_no_ack`, `highrisk.bridge`) and the PW-1 consent prompt. Everything else (menu, triage questions, rights content) falls back to English for a Swahili-selecting user. AI-drafted; not yet reviewed by a fluent speaker — do not treat this as verified-accurate translation. |
| French (`fr`) | `PARTIAL`, unreviewed | 11 | Same safety-critical subset as Swahili, same caveats. Nnouka (fluent French speaker, this project's own team) has offered to review this subset personally — that review has not happened yet as of Sprint 3. |

Counts above are the actual row counts in a freshly migrated-and-seeded database (`SELECT language, tier, count(*) FROM content_strings GROUP BY language, tier`), not a plan or an estimate.

## Real vs. simulated

Built for a hackathon. Sprint 3 added genuine local-Postgres verification (see `docs/qa-sprint3-report.md`); as of 2026-09-19, the full stack is deployed and live-verified: Postgres on Supabase, the bot backend and the counsellor dashboard both on Render (two separate Render services, one shared Supabase database — matching `dashboard/lib/db.ts`'s "two processes, one database" design), against a real Twilio account. A full live round-trip has been run and confirmed: a real WhatsApp message through the Twilio Sandbox drove the complete flow (language → triage → HIGH-risk score → safety plan), a real SMS reached the on-call counsellor and was confirmed in the Twilio console, and the resulting report appeared correctly — High-Risk pinned, masked phone, triage transcript — on the live, Supabase-backed dashboard. That closes what used to be this section's three biggest gaps (no live Twilio round-trip, no real SMS delivered, dashboard rendering unverified). What's still simulated, honestly:

- **The counsellor-connect "on-call counsellor" is a single demo phone number (`ONCALL_COUNSELLOR_PHONE` / a counsellor's own registered number via HR-5), not a live integration with HAK/1195 or any real Kenyan GBV organization.** No such integration exists or has been discussed with a real organization — see the Phase 2 roadmap's "Real HAK/1195 handoff" item.
- **The WhatsApp number a survivor messages from is used directly as their identifier** (`reports.whatsapp_number`, masked only when *displayed* on the dashboard) — there's no masked-relay-number layer between a survivor's real WhatsApp number and this system, beyond what Twilio/WhatsApp themselves provide.
- **"Know your rights" content is explicitly unreviewed** — every message it sends is prefixed, verbatim, with "This is example information and has not yet been reviewed by a legal partner," and that's true: no lawyer or legal-aid partner has reviewed it.
- **Directory entries' phone numbers/URLs have not been called or clicked to confirm they're live** — `docs/backlog.md`'s DIR-1 entry is explicit that this is still a human task, not something any AI agent building this could do without real internet access.
- **Swahili and French are `PARTIAL` tier, AI-drafted, and unreviewed** — see [Language coverage](#language-coverage) above.
- **The HR-4 trusted-contact alert and DASH-5 counsellor reply-in-channel have real code and passing typechecks/builds, but have not yet been exercised in the same live round-trip described above** — pending a follow-up live test, not yet claimed as verified.

## Where to read more

- `docs/backlog.md` — the complete Epics/Sprints/User Stories backlog this was built against, including the exact triage questions and scoring rules.
- `docs/mvp-spec.md` — product rationale: why Kenya, why WhatsApp-only, why risk-triage-first rather than the original matching-escrow design.
- `docs/data-model.md` — a clean extract of the full Postgres schema.
- `docs/conversation-design.md` — the exact WhatsApp copy, button labels, and content keys.
- `docs/twilio-setup.md` — step-by-step Twilio Sandbox + ngrok setup.
- `docs/sprint-1-plan.md` — Sprint 1's role assignments and interface contracts (still the default area split for later sprints).
- `docs/ai-tool-usage-log.md` — a running record of how AI tools were used to build this, kept for the hackathon's written-summary requirement.
- `docs/qa-script.md` — the language-path test script (QA-2) and its real results.
- `docs/qa-sprint3-report.md` — Sprint 3's QA sign-off: real Postgres-backed verification of the dashboard queries and a full privacy audit, with query output as evidence.
- `CONTRIBUTING.md` — branching, PR, and code review workflow.
