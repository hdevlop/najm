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

## Install budget

Date: 2026-10-24. Candidate after `najm-next@0.13.0`; not yet released.

`installBudget: { attempts, windowMs }` (staged only) bounds failed downloads
of one `cacheVersion` within a sliding window. The install reserves its
attempt in an IndexedDB readwrite transaction before any asset request; a
spent budget fails the install before downloading, and a completed install
clears the recorded attempts. The Cache API is not used for the record:
Playwright WebKit discards every cache write made by an install that then
fails, while IndexedDB writes persist in all three engines.

| Check | Result |
| --- | --- |
| Generated-worker cases | PASS: 13 staged cases on `fake-indexeddb`. Two failures then three later checks: two downloads, no `skipWaiting`, old generation and status/consent messages kept; a reservation recorded while a download is still pending and counted after the install is killed; a new version's own budget; expiry after the window, one attempt at a time; a clock moved back; clearing after a completed install; no record or limit without the option; refusal without downloading when the budget cannot be recorded; invalid configuration |
| Built-worker browser fixture | PASS: Chromium, Firefox and WebKit (`bun run --cwd packages/najm-next test:pwa-updates:browser`). With `attempts: 3`, five `registration.update()` checks of a build whose asset fails fetch it exactly three times; the active build keeps answering status as ready; a new version then installs into a waiting state. The earlier scenarios pass unchanged |

Firefox ran a second failing install on its own after one explicit check of a
broken build, which is the browser-initiated retry this budget bounds; the
fixture budget allows for it before the build is fixed.
