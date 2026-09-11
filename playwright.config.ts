// Playwright configuration — scaffolding only.
//
// Sprint 1 has no browser UI (the counsellor dashboard is a Sprint 2+ deliverable,
// see docs/backlog.md DASH-1..4). This config exists now so Sprint 2's QA work can
// start writing real Playwright specs on day one, instead of first wiring up
// tooling. See server/__tests__/e2e/README.md for what lands here and when.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Real specs land here starting Sprint 2, once dashboard/ is a running app.
  testDir: './server/__tests__/e2e',
  testMatch: '**/*.spec.ts',

  timeout: 30 * 1000,
  expect: {
    timeout: 5 * 1000,
  },

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: 'list',

  use: {
    // Placeholder: the future Sprint 2 dashboard is expected to run here locally.
    // Update once dashboard/ has a real dev-server port/start script.
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'dashboard-e2e',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
