// How many times the recovery endpoint has been asked to validate a refresh
// session. The counter lives on `globalThis` because Next bundles route
// handlers and pages into separate chunks, so a module-level variable would not
// be the same variable on both sides.
const KEY = '__najmAuthFixtureRecoveryCount';

type Counter = { [KEY]?: number };

export function countRecovery(): void {
  const store = globalThis as Counter;
  store[KEY] = (store[KEY] ?? 0) + 1;
}

export function recoveryCount(): number {
  return (globalThis as Counter)[KEY] ?? 0;
}
