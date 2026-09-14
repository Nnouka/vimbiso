// server/__tests__/e2e/pattern-watch.spec.ts
//
// Written test-first, per QA's Sprint 2 role (sprint-2-plan.md §2 Ownership Map /
// §5 Wave 1): DASH-3 (Pattern Watch tab) is not implemented yet — the tab
// currently always renders an empty placeholder list (see dashboard/server.ts's
// `TODO(DASH-3)` stub), and PW-2/PW-3 (the matching logic and seeded demo match
// this tab reads) are also not implemented yet. This spec describes the REAL
// behavior DASH-3 must implement (backlog.md DASH-3 AC/DoD) and is expected to
// fail until PW-2, PW-3, and DASH-3 all land.
//
// FIXTURE ASSUMPTION: assumes PW-3's demo seed has run — at least one
// `pattern_matches` row exists, using an obviously-fake, clearly test-labeled
// identifier (backlog.md PW-3 AC) — before this spec runs. This spec does not
// create that seed data itself. Also assumes a logged-in session (see
// dashboard-login.spec.ts).

import { test, expect } from '@playwright/test';

const VALID_USERNAME = process.env.E2E_DEMO_USERNAME || 'demo-counsellor';
const VALID_PASSWORD = process.env.E2E_DEMO_PASSWORD || 'demo-password';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByTestId('login-username').fill(VALID_USERNAME);
  await page.getByTestId('login-password').fill(VALID_PASSWORD);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe('Pattern Watch tab (DASH-3)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/dashboard/pattern-watch');
  });

  test('a seeded match renders in the Pattern Watch tab', async ({ page }) => {
    const matchRows = page.getByTestId('pattern-match-row');
    await expect(matchRows.first()).toBeVisible();
  });

  test('the Pattern Watch tab carries no urgent/red styling (non-urgent institutional signal, per backlog.md DASH-3)', async ({ page }) => {
    // This is a structural smoke check, not a full visual-design audit: the
    // reports queue uses `[data-risk="HIGH"]` for its urgent red flag
    // (DASH-2); Pattern Watch rows must never carry that same attribute.
    const highFlaggedInPatternWatch = page.locator(
      '[data-testid="pattern-match-row"][data-risk="HIGH"]'
    );
    await expect(highFlaggedInPatternWatch).toHaveCount(0);
  });

  test('clicking "Mark reviewed" updates the match status', async ({ page }) => {
    const firstRow = page.getByTestId('pattern-match-row').first();
    const reviewButton = firstRow.getByTestId('mark-reviewed-btn');

    await expect(reviewButton).toBeVisible();
    await reviewButton.click();

    // After marking reviewed, the button either disappears or the row
    // otherwise reflects the new status — assert the row's status text
    // updates to reflect `pattern_matches.status = 'REVIEWED'`
    // (backlog.md PW-2 data model), rather than assuming exactly which of
    // those two UI treatments Frontend chooses.
    await expect(firstRow).toContainText(/reviewed/i);
  });
});
