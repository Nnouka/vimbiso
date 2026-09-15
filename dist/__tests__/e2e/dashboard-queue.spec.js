"use strict";
// server/__tests__/e2e/dashboard-queue.spec.ts
//
// Written test-first, per QA's Sprint 2 role (sprint-2-plan.md §2 Ownership Map /
// §5 Wave 1): DASH-2 (reports queue, High-Risk pinned) is not implemented yet —
// /dashboard currently always renders an empty placeholder list (see
// dashboard/server.ts's `TODO(DASH-2)` stub). This spec describes the REAL
// behavior DASH-2 must implement (backlog.md DASH-2 AC/DoD) and is expected to
// fail until that story lands.
//
// FIXTURE ASSUMPTION: assumes DASH-2's own DoD seed fixture has been loaded —
// "3 seeded reports (2 HIGH, 1 STANDARD)" — before this spec runs, via
// whichever seed script Backend/Frontend provide for Sprint 2 (this spec does
// not seed data itself). Also assumes a logged-in session, established via the
// same demo credentials used in dashboard-login.spec.ts.
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const VALID_USERNAME = process.env.E2E_DEMO_USERNAME || 'demo-counsellor';
const VALID_PASSWORD = process.env.E2E_DEMO_PASSWORD || 'demo-password';
async function login(page) {
    await page.goto('/login');
    await page.getByTestId('login-username').fill(VALID_USERNAME);
    await page.getByTestId('login-password').fill(VALID_PASSWORD);
    await page.getByTestId('login-submit').click();
    await (0, test_1.expect)(page).toHaveURL(/\/dashboard$/);
}
test_1.test.describe('Reports queue — HIGH-risk pinned first (DASH-2)', () => {
    test_1.test.beforeEach(async ({ page }) => {
        await login(page);
    });
    (0, test_1.test)('HIGH-risk report rows render before STANDARD rows', async ({ page }) => {
        const rows = page.getByTestId('report-row');
        await (0, test_1.expect)(rows.first()).toBeVisible();
        const riskAttrs = await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-risk')));
        // Every HIGH must appear before every STANDARD — i.e. once the first
        // STANDARD is seen, no HIGH may follow it.
        const firstStandardIndex = riskAttrs.indexOf('STANDARD');
        if (firstStandardIndex !== -1) {
            const anyHighAfterFirstStandard = riskAttrs
                .slice(firstStandardIndex)
                .includes('HIGH');
            (0, test_1.expect)(anyHighAfterFirstStandard).toBe(false);
        }
        // Sanity check the fixture actually contains both risk levels — an empty
        // or all-one-level queue would make the ordering assertion above
        // vacuously true and hide a real regression.
        (0, test_1.expect)(riskAttrs).toContain('HIGH');
        (0, test_1.expect)(riskAttrs).toContain('STANDARD');
    });
    (0, test_1.test)('a HIGH-risk row displays its risk badge', async ({ page }) => {
        // data-risk lives on the row itself per sprint-2-plan.md §3.4.
        const highRow = page.locator('[data-testid="report-row"][data-risk="HIGH"]').first();
        await (0, test_1.expect)(highRow).toBeVisible();
        await (0, test_1.expect)(highRow.getByTestId('risk-badge')).toBeVisible();
    });
    (0, test_1.test)('no report row ever renders a real name (privacy check on the rendered DOM)', async ({ page }) => {
        // Best-effort guard, not a substitute for QA-4's direct DB audit: the
        // queue must show id / timestamp / risk_level / YES-answer summary /
        // region / connect status only (backlog.md DASH-2 AC) — never a name
        // field. We can't assert the absence of an unknown string, but we can at
        // least assert the row text is exactly the documented fields' shape by
        // confirming no row contains a "Name:" label anywhere in the page.
        await (0, test_1.expect)(page.getByText(/name\s*:/i)).toHaveCount(0);
    });
});
//# sourceMappingURL=dashboard-queue.spec.js.map