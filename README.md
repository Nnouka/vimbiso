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

## Where to read more

- `docs/backlog.md` — the complete Epics/Sprints/User Stories backlog this was built against, including the exact triage questions and scoring rules.
- `docs/mvp-spec.md` — product rationale: why Kenya, why WhatsApp-only, why risk-triage-first rather than the original matching-escrow design.
- `docs/data-model.md` — a clean extract of the full Postgres schema.
- `docs/conversation-design.md` — the exact WhatsApp copy, button labels, and content keys.
- `docs/twilio-setup.md` — step-by-step Twilio Sandbox + ngrok setup.
- `docs/sprint-1-plan.md` — Sprint 1's role assignments and interface contracts (still the default area split for later sprints).
- `docs/ai-tool-usage-log.md` — a running record of how AI tools were used to build this, kept for the hackathon's written-summary requirement.
- `CONTRIBUTING.md` — branching, PR, and code review workflow.
