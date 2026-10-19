# Staged public-shell update proof

Date: 2026-10-19. Candidate `najm-next@0.13.0`.

Build then run `bun run --cwd packages/najm-next test:pwa-updates:browser`.
The isolated Bun origin serves the built package entries, not source aliases.
Raw results: `packages/najm-next/integration/pwa-updates/.output/results.json`.

Chromium 156.0.8078.4, Firefox 157.0 and Playwright WebKit 27.2 pass:

- A failed manifest download never becomes ready; retry installs a waiting build.
- Each of two editing tabs blocks activation independently. An unmanaged,
  unresponsive window also blocks activation.
- Eviction after installation makes readiness false and denies activation.
- After explicit consent, both old documents retain their input and old build;
  there is no forced reload. Old and unrelated asset caches remain.
- With the origin process stopped, an old lazy asset remains available and a
  new document boots the new shell. An IndexedDB pending marker is unchanged.

Executable generated-worker tests additionally reject cache-version reuse,
same-version changed bytes without overwriting active assets, mutable shared
asset URLs, and missing explicit version/shell. Client tests cover live
registration lookup, parent-scope isolation and disposal. Initial fixture
polling used asynchronous page predicates that did not reliably wait for
registration settlement in two engines; polling awaited `evaluate` results
before making assertions. The native matrix now waits for actual stable state.

This protocol retains old assets conservatively; it does not reclaim historical
builds automatically. Downloading temporarily needs candidate plus active cache
space. Consent is a point-in-time response, not a lock on later user input;
retaining documents/assets prevents update-driven draft loss. Schema upgrades,
durable local drafts, entitlement and browser storage eviction are separate
contracts. No installed-phone or Safari application result is claimed.
