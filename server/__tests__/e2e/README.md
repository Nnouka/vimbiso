# Dashboard E2E Tests (Playwright)

Real specs now live in this folder, written test-first per QA's Sprint 2 role
(`docs/sprint-2-plan.md` §2 Ownership Map / §5 Wave 1), against a `dashboard/`
app that is still a Sprint 1 scaffold (DASH-1..4 are not implemented yet — see
`docs/backlog.md`). **Every spec here is expected to fail until DASH-1 through
DASH-4 land** — that failure is correct and expected right now, not a bug in
these files. This mirrors how `patternMatch.test.ts` and Sprint 1's
`riskScoring.test.ts`/`hashing.test.ts` were written against not-yet-built
code.

## Files

- `dashboard-login.spec.ts` — DASH-1: wrong credentials show an error and
  don't redirect; correct credentials redirect to `/dashboard`;
  unauthenticated `/dashboard` redirects to `/login`.
- `dashboard-queue.spec.ts` — DASH-2: seeded HIGH-risk rows render before
  STANDARD rows; a HIGH row shows its risk badge; no real name renders in the
  queue.
- `pattern-watch.spec.ts` — DASH-3: a seeded Pattern Watch match renders;
  the tab carries no HIGH/urgent flagging; "Mark reviewed" updates a match's
  status.
- `report-detail.spec.ts` — DASH-4: clicking a report row shows
  `report-detail` with the report's risk level, triage data, and any SMS
  alert timestamp.

Each spec file's header comment states the fixture/seed data it assumes (e.g.
DASH-2's "3 seeded reports (2 HIGH, 1 STANDARD)" DoD fixture, or PW-3's demo
match) — none of these specs create their own seed data. `data-testid` values
used throughout come from `docs/sprint-2-plan.md` §3.4 (frozen) verbatim, not
guessed independently.

## Running these specs

This dev sandbox cannot run `npm install` (registry unreachable — see
`docs/ai-tool-usage-log.md`), so these specs have not been executed here; they
are written for correctness against the real Playwright API and the frozen
`data-testid` contract, ready to run once `dashboard/` is a real running app
with Sprint 2's seed data loaded and `playwright.config.ts`'s `baseURL` points
at it.
