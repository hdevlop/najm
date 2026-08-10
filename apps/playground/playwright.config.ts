// ============================================================================
// Playground — browser acceptance for the najm-theme convention
// ============================================================================
//
// One suite, run against a production server the operator already started. See
// `test/e2e/globalSetup.ts` for why there is deliberately no `webServer` here.
//
// Chromium only for the blocking run: the release evidence this configuration
// exists to produce targets Chrome. A Firefox or WebKit pass is welcome, but it
// is a bonus rather than a substitute, so adding projects for them would make
// the required set ambiguous.
// ============================================================================

import { defineConfig, devices } from '@playwright/test';

import { BASE_URL } from './test/e2e/support/constants';

export default defineConfig({
  testDir: './test/e2e',
  globalSetup: './test/e2e/globalSetup.ts',

  // The sequence in the acceptance plan is one continuous story per viewport —
  // upload, reload, fall back, reset — against a single shared server and one
  // database. Running files in parallel would let two workers reset each
  // other's branding mid-assertion.
  fullyParallel: false,
  workers: 1,

  // A flake that passes on retry is not evidence. Failing once and keeping the
  // trace is the outcome this suite wants.
  retries: 0,
  forbidOnly: true,

  // Scratch output only — traces and failure shots. The evidence screenshots
  // are written to the repository by the spec itself.
  outputDir: '../../.runtime/playwright',

  reporter: [['list'], ['html', { outputFolder: '../../.runtime/playwright-report', open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, isMobile: true },
    },
  ],
});
