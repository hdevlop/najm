// Test environment setup. Runs as a Bun preload before any test module loads.
// Idempotent: subsequent invocations must not mutate state set by a previous run.
process.env.EMAIL_PROVIDER = process.env.EMAIL_PROVIDER ?? 'memory';
process.env.WS_NO_BUFFER_UTIL = process.env.WS_NO_BUFFER_UTIL ?? 'true';
