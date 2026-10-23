# Opt-in public-shell navigation fallback

Date: 2026-10-19. Release: `najm-next@0.12.0` from
`57a7716503e39e822cca4ceff90ed0fa61cd304a` in the authorized
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
| Publication | PASS: owning publisher's pack and exact-tarball publication commands, without `--tag`. All 33 dist files match the validated build. Downloaded npm tarball SHA-512/SHA-256 match the artifact from the source-commit sidecar; `latest` resolves to `0.12.0`. School records the registry evidence separately |
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

School adopted the published exact `0.12.0` pin and passed the three-engine
synthetic proof with the real 10-second default (10,325 / 11,222 / 10,371 ms
to render in Chromium / Firefox / WebKit). It also passed lint, typecheck,
555 configuration tests, 28 boundary tests, schema check, production build
and normal Next sign-in/guard/worker smoke. School enables the policy only
in its isolated fixture; its product worker does not enable it. This remains
synthetic shell evidence, not protected offline access or synchronization.

Redirect behavior is exercised in native navigations, including the browser's
opaque redirect response handling. See the [respondWith response restrictions](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent/respondWith)
and [Request redirect modes](https://developer.mozilla.org/en-US/docs/Web/API/Request/redirect).
