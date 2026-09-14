// server/__tests__/e2e/dashboard-login.spec.ts
//
// Written test-first, per QA's Sprint 2 role (sprint-2-plan.md §2 Ownership Map /
// §5 Wave 1): DASH-1 (authenticated dashboard shell) is not implemented yet —
// login currently always succeeds regardless of credentials (see
// dashboard/server.ts's `TODO(DASH-1)` stub). These specs describe the REAL
// behavior DASH-1 must implement (backlog.md DASH-1 AC) and are expected to
// fail until that story lands.
//
// FIXTURE ASSUMPTION: assumes a `counsellor_users` row exists for a known
// demo login (e.g. username `demo-counsellor` / a fixed test password),
// seeded by whatever fixture DASH-1's implementation ships with. This spec
// does not create that row itself — see PW-3/DASH seeding notes in
// docs/sprint-2-plan.md §3.5 and this repo's server/seeds/ directory for
// where that seed is expected to live.

import { test, expect } from '@playwright/test';

const VALID_USERNAME = process.env.E2E_DEMO_USERNAME || 'demo-counsellor';
const VALID_PASSWORD = process.env.E2E_DEMO_PASSWORD || 'demo-password';

test.describe('Dashboard login (DASH-1)', () => {
  test('wrong credentials show an error and do not redirect', async ({ page }) => {
    await page.goto('/login');

    await page.getByTestId('login-username').fill('not-a-real-user');
    await page.getByTestId('login-password').fill('definitely-wrong');
    await page.getByTestId('login-submit').click();

    // Must stay on /login — no session should be created for bad credentials.
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('correct credentials redirect to the reports queue', async ({ page }) => {
    await page.goto('/login');

    await page.getByTestId('login-username').fill(VALID_USERNAME);
    await page.getByTestId('login-password').fill(VALID_PASSWORD);
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('an unauthenticated request to /dashboard redirects to /login', async ({ page }) => {
    // No login performed in this test — a fresh browser context per Playwright
    // test means no session cookie exists yet.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });
});
