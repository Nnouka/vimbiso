# Dashboard E2E Tests (Playwright)

This folder is scaffolding, not a suite. Sprint 1 has no browser UI to test — the
counsellor dashboard (`dashboard/**`) doesn't exist as a working app with real data
until Sprint 2's DASH-1 through DASH-4 stories land (`docs/backlog.md`). Do not add
real Playwright specs here yet; there is nothing for them to exercise.

## Why this folder exists now

The team lead asked QA to set up the Playwright harness during Sprint 1, even
though there's nothing to point it at, so that Sprint 2's QA work starts by writing
tests on day one instead of first wiring up tooling. The config at the repo root
(`playwright.config.ts`) already points `testDir` at this folder.

## What lands here, and when

Once DASH-1 (authenticated dashboard shell), DASH-2 (reports queue, High-Risk
pinned), DASH-3 (Pattern Watch tab), and DASH-4 (report detail view) exist with a
real, running `dashboard/` app, QA should add real `*.spec.ts` files here covering
at minimum:

- DASH-1: login with valid/invalid `counsellor_users` credentials; unauthenticated
  requests to `/dashboard/*` redirect to login.
- DASH-2: seeded mixed-risk reports render HIGH-risk first (newest-first within
  group), visually flagged, followed by STANDARD; no real name ever rendered.
- DASH-3: seeded `pattern_matches` rows render in a separate, non-urgent tab; "Mark
  reviewed" works.
- DASH-4: clicking a report row shows the full triage transcript matching the
  underlying DB rows exactly.

## Example test skeleton (intended pattern for Sprint 2)

The commented-out example below is a template, not a real test — it is skipped and
will not run. It shows the shape Sprint 2 specs should follow: seed data first (or
rely on a seed fixture), log in through the real login form, then assert on
rendered output rather than on internal state.

```ts
// server/__tests__/e2e/dashboard-queue.spec.ts
//
// import { test, expect } from '@playwright/test';
//
// test.skip('a seeded HIGH-risk report is pinned at the top of the queue', async ({ page }) => {
//   // Assumes a seed script has already loaded 2 HIGH-risk and 1 STANDARD report
//   // (mirrors DASH-2's DoD fixture: "3 seeded reports (2 HIGH, 1 STANDARD)").
//   await page.goto('/login');
//   await page.getByLabel('Username').fill('demo-counsellor');
//   await page.getByLabel('Password').fill('demo-password');
//   await page.getByRole('button', { name: 'Log in' }).click();
//
//   await expect(page).toHaveURL(/\/dashboard/);
//
//   const firstRow = page.getByTestId('report-row').first();
//   await expect(firstRow).toHaveAttribute('data-risk-level', 'HIGH');
// });
```

Remove this file's guidance once real specs exist and this README would otherwise
just be stale narration.
