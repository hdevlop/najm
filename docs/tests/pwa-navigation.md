# Opt-in public-shell navigation fallback

Date: 2026-10-19. Candidate: `najm-next@0.12.0` in the authorized
`school/offline-ui-runtime` worktree, after regular release `ef5682a`.

`navigationFallback` accepts canonical exact paths or trailing `/*` subtree
patterns and an optional response-header timeout (default 10,000 ms; 1-60,000).
It requires an explicit public `offlineUrl`. The cached shell can replace a
network rejection, a timed request or gateway 502/503/504. No online response
is cached. Missing-shell and legacy behavior retain their separate tests.

| Check | Result |
| --- | --- |
| Executable generated-worker cases | PASS: 20 cases. Gateway fallback; preservation of 200/302/307/401/403/404/500, downloads, redirects and Flight content; route/method/origin/RSC exclusions; timeout/abort/late response and caller cancellation; unavailable cache; invalid configuration; legacy behavior |
| Package source/test typecheck | PASS |
| Full Next package suite | PASS: 168 passed, 6 skipped, plus 4 DOM and 7 RSC tests |
| Public API snapshot | PASS; new navigation option type explicitly exported |
| Next 16.3.8 production compatibility | PASS: CSP/proxy and application/server fixtures |
| Built-worker browser fixture | PASS: Chromium 156.0.8078.4, Firefox 157.0, Playwright WebKit 27.2. `bun run --cwd packages/najm-next test:pwa:browser` after the package build. Gateway fallback, 401/403/404/500 preservation, redirects including login 503, API/RSC isolation, download, deadline, late response, missing shell and real origin loss |

The browser fixture uses a 500 ms timeout and synthetic data on a disposable
loopback origin. It stops/restarts its server for connection loss rather than
using offline emulation. Raw report:
`packages/najm-next/integration/pwa-navigation/.output/results.json`.

The initial Chromium test attempted to force `Accept: text/x-component` on a
document navigation. Its final test sends Flight through the real browser
`fetch` transport instead; other RSC-header navigation cases are retained.
An unlisted offline URL is checked in a disposable page so Chromium's error
document cannot race the next independent navigation. These are test harness
corrections; they do not bypass the worker's classification.

The deadline is for response headers; it does not buffer or impose a deadline
on an already-started streaming body. A missing cached shell preserves gateway
responses and waits for the network after the deadline. Cached authorization,
School data/sync, installed devices, complete cache readiness under eviction,
staged activation and retaining old assets for editing tabs remain unproven.
The previous immediate activation/cleanup policy is unchanged.

Redirect behavior is exercised in native navigations, including the browser's
opaque redirect response handling. See the [respondWith response restrictions](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent/respondWith)
and [Request redirect modes](https://developer.mozilla.org/en-US/docs/Web/API/Request/redirect).
