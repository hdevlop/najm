# Router-independent UI provider release

Date: 2026-10-19. Worktree: `school/offline-ui-runtime`, based on
`eb8a0c5c1602ec84ee00d2e3ad4e69c03908d5a4`.

Candidates are `najm-kit@3.7.0-offline.0` and
`najm-next@0.11.0-offline.0`. Both were published under `offline` after separate
owner authorization; stable `latest` tags remain unchanged. The release source
is `58bf499b82758cb28a1790f5c2c5d5ade6056796`. The change adds Kit's
`uiRuntime` preference callbacks, used by the full Next application provider
through its existing Kit prop forwarding. Omitting the option keeps the Next
provider, preference endpoints and refresh behavior.

The owner subsequently requested normal publication without a custom tag.
Prepared `najm-kit@3.7.0` and `najm-next@0.11.0` with the same runtime source,
removing the prerelease-only Kit peer alternative. Their publisher commands
omit `--tag` and use npm's default `latest` channel. This promotion does not
complete School's offline-access acceptance.

School's generated-shell experiment reproduced `invariant expected app router
to be mounted` against the existing published packages. The new option selects
the framework-independent UI provider inside the same composition; tests use
no synthetic Next router context for this mode.

| Check | Result |
| --- | --- |
| Dependency installation | Bun 1.4.2; `bun install --ignore-scripts`. The repository declares Bun 1.3.14. Lockfile updates include the candidate workspace versions, Playwright 1.64.1, and stale auth/email workspace metadata corrected to their already-existing manifests; no auth/email source change |
| `bun run build:next` | PASS, 16 dependency/package build tasks including Kit CSS and declarations |
| Kit source/test typechecks | PASS |
| Next source/test typecheck | PASS |
| Kit full suite | PASS: 1,553 passed, 14 skipped; 9 additional RSC tests passed. The new runtime tests cover mounting, persistence, callback replacement/draft retention, errors, no catalog, and invalid runtime values |
| Next full suite | PASS: 148 passed, 6 skipped; 4 DOM tests and 7 RSC tests passed |
| `bun run --cwd packages/najm-next test:ui-runtime:browser` | PASS in Chromium 156.0.8078.4, Firefox 157.0 and Playwright WebKit 27.2. Built public entries mount without Next's router; local preference callbacks work disconnected; child input, preferences, auth identity and QueryClient survive callback replacement and reconnection |
| `bun run --cwd packages/najm-next test:next16` | PASS: CSP/proxy and application/server production fixtures |
| `bun run --cwd packages/najm-kit test:next16` | PASS: UI bootstrap production fixture, including the existing preference route handlers |
| `bun run api:check` | PASS |
| Publication | PASS: owning publisher consumed the approved tarballs and reran its checks. Downloaded registry SHA-512/SHA-256 match both artifacts; metadata is in `packages/najm-next/integration/ui-runtime/.output/publication.json` |

The browser command writes its raw report under
`packages/najm-next/integration/ui-runtime/.output/results.json`. Build/test
logs are retained in that ignored output directory. The fixture bundles the
owning repository's built exports; School does not consume a local package,
link or tarball.

This proves the provider option, not School offline boot, downloaded coverage,
cached authorization, financial saves, durable synchronization, worker update
safety or installed-phone behavior. Next integration fixtures run against the
owning repository's Next version; School retains its own production/browser
acceptance after adopting published exact pins.
