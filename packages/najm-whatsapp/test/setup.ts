import '../../../scripts/bun-test-legacy-decorators';

// Test environment setup. Runs as a Bun preload before any test module loads.
// Idempotent: subsequent invocations must not mutate state set by a previous run.
process.env.EMAIL_PROVIDER = process.env.EMAIL_PROVIDER ?? 'memory';
process.env.NAJM_AUTH_LOGIN_RATE_LIMIT_ENABLED =
  process.env.NAJM_AUTH_LOGIN_RATE_LIMIT_ENABLED ?? 'false';
process.env.WS_NO_BUFFER_UTIL = process.env.WS_NO_BUFFER_UTIL ?? 'true';
