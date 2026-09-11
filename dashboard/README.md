# Vimbiso Counsellor Dashboard

Server-rendered Express + EJS web app for counsellors/reviewers to work
Vimbiso's report queue and Pattern Watch tab. This is a **standalone app**,
independent from the root WhatsApp bot backend — its own `package.json`, own
`node_modules`, own port. Nothing here touches the root project, and nothing
in the root project touches this directory.

Stack choice: Express + EJS, per `docs/mvp-spec.md` §2's named default
("a small server-rendered web app (Next.js or Express+EJS)"). Picked
Express+EJS over Next.js because it needs no build step, and the rest of the
backend is already Express — one less stack for whoever picks up DASH-1..4
next sprint to context-switch into.

## Status: scaffold only, Sprint 1

This is **not** a feature yet — there are no dashboard stories in Sprint 1.
This exists so Sprint 2's DASH-1..4 stories can start building real features
on day one instead of losing time on app setup. Right now:

- There is **no real authentication**. `/login` renders a form and `POST
  /login` just starts a placeholder session and redirects — it does not check
  `counsellor_users` or any password. Anyone who submits the form (or, right
  now, anyone who just navigates to `/dashboard` directly) gets in.
- There is **no real data**. The Reports Queue, Pattern Watch, and Report
  Detail pages render genuine empty-state copy, not a mocked table — because
  there is nothing behind them yet.
- Every spot the next stories need to fill in is marked with a
  `// TODO(DASH-n): ...` comment. Search for `TODO(DASH-` across this
  directory to find all of them.

## Install & run

```bash
cd dashboard
npm install
cp .env.example .env   # optional for now — nothing reads it yet except PORT/SESSION_SECRET
npm run dev            # or: npm start
```

Runs on **http://localhost:3001** by default (override with `PORT` in
`.env`) — a different port from the bot backend's `3000`, so both can run at
the same time without colliding.

`npm run dev` uses `node --watch` (no build step, no bundler — matches the
"simpler, faster for a 10-day sprint" rationale above).

## Pages that exist right now

| Route | What it does today |
|---|---|
| `GET /login` | Renders the login form. Not wired to real auth. |
| `POST /login` | Stub — starts a placeholder session, redirects to `/dashboard`. |
| `POST /logout` | Destroys the session, redirects to `/login`. |
| `GET /dashboard` | Reports Queue — empty-state placeholder. |
| `GET /dashboard/pattern-watch` | Pattern Watch tab — empty-state placeholder. |
| `GET /dashboard/reports/:id` | Report detail — empty-state placeholder. |

All four pages share one header/layout (`views/partials/header.ejs` +
`views/partials/footer.ejs`) so they read as one coherent app already, not
four unrelated stubs.

## What Sprint 2 fills in (per `docs/backlog.md`'s DASH epic)

- **DASH-1** — real login: check `counsellor_users` (bcrypt-hashed password),
  start a real session on success, error + no session on failure. See the
  `TODO(DASH-1)` markers in `server.js` and `views/login.ejs`.
- **DASH-2** — real Reports Queue: HIGH-risk rows pinned first (newest-first
  within group, flagged red), then STANDARD; each row shows id, timestamp,
  risk_level, YES-answer summary, region, connect status — never a real name.
  See the `TODO(DASH-2)` marker in `server.js` / `views/dashboard.ejs`.
- **DASH-3** — real Pattern Watch tab: reads `pattern_matches`, shows linked
  `report_ids`, `created_at`, a "Mark reviewed" action — visually calm, no
  urgent language. See `TODO(DASH-3)`.
- **DASH-4** — real report detail: all 8 `triage_answers` (question + answer),
  `risk_level`, `sms_alerts` timestamps for one report. See `TODO(DASH-4)`.

Data model these stories read from is `docs/data-model.md` (canonical:
`docs/backlog.md` §2) — specifically `counsellor_users`, `reports`,
`triage_answers`, and `pattern_matches`.

## Copy / tone note

`docs/conversation-design.md` (Designer's master flow/copy spec) did not
exist yet at the time this scaffold was written. The placeholder copy here
was written independently and should be reviewed against
`conversation-design.md` for tone/terminology consistency once it lands, per
the Sprint 1 plan's note that Frontend reviews that doc for dashboard voice
drift.

## Notes

- Session store is the `express-session` in-memory default — fine for a
  scaffold, not for anything real. DASH-1 should move this to a real store
  (e.g. `connect-pg-simple`) when it wires actual auth.
- `bcrypt` and `pg` are already in `package.json` as dependencies since
  DASH-1 will need them immediately — they are not yet `require()`'d
  anywhere in `server.js`.
