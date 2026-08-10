// ============================================================================
// najm-kit — browser acceptance for the component playground
// ============================================================================
//
// Runs against a *production* preview build, not the dev server. The suite
// asserts a clean console, and React's development build narrates warnings that
// would either mask a real problem or force a filter broad enough to hide one.
// `vite preview` serves `playground/dist`, so `webServer.command` builds first.
//
// Specs are named `*.acceptance.ts` rather than `*.spec.ts` on purpose: the
// package's `test` script is a bare `bun test`, which recursively claims every
// `*.test.*` and `*.spec.*` file it can find and would try to run these under
// the Bun runner.
//
// Chromium only. Clipboard permissions, which this suite needs to drive the
// copy flow in both directions, are a Chromium-specific context capability.
// ============================================================================

import { defineConfig, devices } from '@playwright/test';

const PORT = 5178;

export default defineConfig({
  testDir: './acceptance',
  testMatch: '**/*.acceptance.ts',

  // Each test drives shared UI controls (per-example theme and RTL toggles) on
  // one page. Parallel workers get their own browser, but serial execution
  // keeps the captured screenshots in a readable, reproducible order.
  fullyParallel: false,
  workers: 1,

  // A flake that passes on retry is not evidence.
  retries: 0,
  forbidOnly: true,

  outputDir: '../../.runtime/playwright-kit',
  reporter: [['list']],

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',

    // The copy flow is the point of the component. Without this the very first
    // writeText rejects with NotAllowedError and the success path is untestable.
    permissions: ['clipboard-read', 'clipboard-write'],
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

  webServer: {
    command: `bun run build:preview && bunx vite preview --port ${PORT} --host 127.0.0.1 --strictPort`,
    url: `http://127.0.0.1:${PORT}`,

    // Never reuse. `vite preview` serves a build, so a server left running from
    // an earlier invocation keeps serving the *previous* bundle: the suite then
    // reports green against source that is no longer on disk. That is not a
    // hypothetical — it hid a fix during this component's own acceptance. The
    // rebuild costs about fifteen seconds and is what makes the run repeatable.
    reuseExistingServer: false,

    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
