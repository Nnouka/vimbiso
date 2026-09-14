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

## Status: DASH-1..4 implemented, Sprint 2

Real auth, real data, all wired to Postgres. Not yet run against a live
database or Playwright in this dev environment (`npm install` is blocked
here — see `docs/ai-tool-usage-log.md`); see `docs/backlog.md`'s DASH-1..4
`Status:` lines for the precise state.

- **Real authentication.** `POST /login` looks up `counsellor_users` by
  `username`, `bcrypt.compare`s the password, and only starts a session on a
  match. `/dashboard*` redirects to `/login` without a session.
- **Real data.** Reports Queue, Pattern Watch, and Report Detail all query
  Postgres directly via `dashboard/lib/db.ts` (this app's own connection
  pool — see that file's header comment for why it's separate from
  `server/lib/db.ts` rather than shared).
- `npm run seed` creates/updates a demo counsellor login (`demo-counsellor` /
  `demo-password` by default — override via `E2E_DEMO_USERNAME` /
  `E2E_DEMO_PASSWORD`) so `server/__tests__/e2e/*.spec.ts` has something to
  log in with; those specs document this as a fixture assumption they don't
  create themselves.

## Install & run

```bash
cd dashboard
npm install
cp .env.example .env   # set DATABASE_URL to the same DB the bot backend uses
npm run seed           # creates the demo counsellor login (see above)
npm run dev            # runs server.ts directly via tsx, with watch/reload
```

Runs on **http://localhost:3001** by default (override with `PORT` in
`.env`) — a different port from the bot backend's `3000`, so both can run at
the same time without colliding.

`npm run dev` uses `tsx watch server.ts` — runs the TypeScript entry point
directly, no manual build step needed for local dev. For a production-style
run, compile first and run the emitted JS:

```bash
npm run build   # tsc -> dist/
npm start       # node dist/server.js
```

`npm run typecheck` runs `tsc --noEmit` to check types without emitting
anything — useful in CI or before opening a PR.

## Pages that exist right now

| Route | What it does today |
|---|---|
| `GET /login` | Renders the login form. |
| `POST /login` | Real auth against `counsellor_users` (bcrypt); error + no session on failure. |
| `POST /logout` | Destroys the session, redirects to `/login`. |
| `GET /dashboard` | Reports Queue — scored reports, HIGH pinned first (newest-first within group). |
| `GET /dashboard/pattern-watch` | Pattern Watch tab — real `pattern_matches` rows. |
| `POST /dashboard/pattern-watch/:id/review` | Marks a pattern match `REVIEWED`. |
| `GET /dashboard/reports/:id` | Report detail — triage transcript, risk level, SMS alert timestamps. |

All routes under `/dashboard*` require a session (redirect to `/login`
otherwise). All pages share one header/layout (`views/partials/header.ejs` +
`views/partials/footer.ejs`).

## Notable implementation choices (DASH-1..4)

- **WhatsApp number masking.** The Reports Queue and Report Detail views show
  `whatsapp_number` masked to its last 4 digits, never in full. SEC-2 doesn't
  literally ban this column (unlike a legal-name column, which doesn't
  exist), but a full phone number on a shared counsellor screen is the kind
  of PII exposure this project treats carefully elsewhere (e.g. HR-2's SMS
  body). See `maskPhoneNumber()` in `server.ts` for the full reasoning.
- **YES-answer summary (DASH-2).** Shown as "N of 8" plus the list of
  question keys that were YES (e.g. `STRANGLE, WEAPON`), not translated
  question text — kept terse for a queue row; the full question text is
  reserved for the detail view.
- **Triage question text (DASH-4)** is a hardcoded English map in
  `server.ts` (`TRIAGE_QUESTION_TEXT`), not a `content_strings` lookup — the
  dashboard doesn't own the language pipeline (`server/lib/content.ts`) and
  DASH-4's AC only asks for English. See the comment above that constant if
  this ever needs to go multilingual.
- **Demo login seed.** No other Sprint 2 story seeds a `counsellor_users`
  row, so `dashboard/seed.ts` was added here — see `npm run seed` above.

Data model these routes read from is `docs/data-model.md` (canonical:
`docs/backlog.md` §2) — specifically `counsellor_users`, `reports`,
`triage_answers`, `pattern_matches`, and `sms_alerts`.

## Copy / tone note

`docs/conversation-design.md` (Designer's master flow/copy spec) did not
exist yet at the time this scaffold was written. The placeholder copy here
was written independently and should be reviewed against
`conversation-design.md` for tone/terminology consistency once it lands, per
the Sprint 1 plan's note that Frontend reviews that doc for dashboard voice
drift.

## Notes

- Session store is still the `express-session` in-memory default.
  DASH-1's DoD only requires working login/logout plus the
  redirect-when-unauthenticated behavior, both of which this satisfies at
  hackathon PoC scale — but it means sessions don't survive a process
  restart and won't work across multiple dashboard instances. Move to a real
  store (e.g. `connect-pg-simple`) before that matters.
- `npm install` could not be run in the environment this was built in (see
  `docs/ai-tool-usage-log.md`), so none of this has been executed — only
  read carefully against the migrations and QA's Playwright specs. Typecheck
  and the four `server/__tests__/e2e/*.spec.ts` specs are the first things
  to run once `npm install` works.
