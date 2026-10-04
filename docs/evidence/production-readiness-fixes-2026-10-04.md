# Najm production readiness fixes — 2026-10-04

The four blockers from the framework review are addressed in the local working
tree: public server error details, spoofable default rate-limit addresses,
vulnerable dependencies, and WhatsApp test contamination. Local checks pass.
This evidence does not establish package publication, a fresh remote CI run,
consumer adoption, browser acceptance, or deployment.

## Runtime fixes

- `najm-core` returns generic production 5xx responses and logs the original
  error on the server. Response status is preserved; actionable 4xx messages
  and development diagnostics remain available. Tests include a real isolated
  server request that throws a private marker.
- `najm-rate` treats omitted `trustedProxyHops` as zero. It uses the socket peer
  instead of trusting client-supplied forwarded headers. When no usable peer
  exists, requests share a fixed bucket. The middleware regression verifies
  that changing forwarded headers still produces a 429 on the second request.
- WhatsApp tests inject the instance factory per manager and configure/reset
  the Baileys loader per test. They no longer replace a shared engine module
  globally, which contaminated neighboring suites in the failing CI run.

## Dependencies and release compatibility

The lockfile and relevant workspace manifests now use patched Hono, Next,
Nodemailer, Sharp, Axios, Fastify, and affected tooling dependencies. The raw
Bun audit fell from 42 findings to one locally patched advisory.

- Hono consumers must satisfy `^4.13.12`.
- Next peers require `^15.5.24 || ^16.3.6`; installed workspace versions are
  15.5.27 and 16.3.8. `najm-next` rejects earlier versions during configuration.
  The npm audit endpoint reported no advisories for either declared minimum
  on this date.
- `najm-email` now requires Nodemailer `^10.0.14` and uses its native types. A
  loopback SMTP fixture verifies connection, recipient envelope, message body,
  and attachment delivery.
- Reverse-proxy consumers must declare their actual trusted hop count.
  Omitting it now groups requests by the socket peer, which may be the proxy.
  Set `trustedProxyHops: 1` only for a controlled single-proxy topology.

These changes need versioned package releases and consumer installation before
existing applications receive them. The workspace Bun patch described below
does not automatically propagate into independently installed consumers.

## Temporary braces mitigation

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
affects `braces@3.0.3` and has no upstream patched release as of this review.
`patches/braces@3.0.3.patch` limits nesting in the parser and recursive compile,
expand, and stringify walkers. The guard also covers caller-supplied ASTs.

`bun run audit:security` first checks normal glob expansion and rejection of
deeply nested strings/ASTs, then audits with only this advisory excluded.
OSV uses the corresponding documented exception in `osv-scanner.toml`, expiring
November 4, 2026. The Bun gate fails from November 5 rather than silently
continuing the exception. Replace the patch and remove both exclusions when a
fixed upstream version is available; otherwise review the mitigation before
expiry.

Raw `bun audit` still reports this one high-severity version-based finding and
exits unsuccessfully. It is not a zero-finding raw audit.

## Validation

Local platform: Windows, Bun 1.3.14, Node 24.16.0.

| Check | Result |
| --- | --- |
| `bun install --frozen-lockfile` | PASS |
| `bun run test` | PASS: build succeeded and 23/23 sequential workspace test targets passed |
| `bun run api:check` | PASS: public API snapshot current |
| `bun run test:node-runtime` | PASS on Node 24.16.0 |
| `bun run --cwd packages/najm-next typecheck` | PASS |
| Next production CSP/proxy integration | PASS on Next 16.3.8 |
| Next production app/server integration | PASS on Next 16.3.8 |
| Auth production proxy/recovery integration | PASS on Next 16.3.8 |
| WhatsApp direct tests on Bun 1.4.2 | PASS: 269 tests |
| WhatsApp engine/database tests in reversed file order | PASS: 51 tests |
| `bun run audit:security` | PASS with verified, expiring braces exception |
| OSV Scanner 2.6.0, `scan source --lockfile=bun.lock` | PASS with the same exception; 1,394 package records extracted |
| `git diff --check` | PASS |

The auth integration harness now computes Next's `_rsc` cache key for flight
requests. This preserves Next 16.3.8 header validation while testing recovery;
the harness still rejects unexpected redirects. All three integrations build
and run actual production fixtures.

CI pins Bun 1.3.14 on all jobs and adds these three production integrations to
both Bun platforms. The changed workflow has not run remotely. Node 20/22 and
PostgreSQL/MySQL service jobs have not been rerun for this candidate locally.
OSV skipped two upstream Git dependencies (`libsignal-node` and
`whiskeysockets/eslint-config`) because the lockfile records abbreviated commits
that its API cannot query. Its passing result does not cover those commits.

## Release candidate

The user authorized commit, push, CI verification, publication, and Playground
consumer checks after the local review. The candidate versions and migration
notes are recorded in
[`2026-10-04-production-hardening.json`](../releases/2026-10-04-production-hardening.json).
It contains 19 releases. Rate 3 and Email 3 change the default proxy trust and
Nodemailer peer contract; Auth 6 and API 5 adopt those requirements. Kit 3 drops
older Next peers, with Storage 4, RAG 3, Chatbot 3, WhatsApp 3, Theme 0.3, and
Next 0.9 recording their corresponding dependency changes.

The registry had RAG 2.3.0 while the checkout declared 2.2.1. Its published
Darija query rewriter was restored into source, including root exports, the
`query-rewrites` subpath, declarations, and nine compatibility regressions.
The existing core lifecycle release notes were retained in Core 3.0.3.

The versioned candidate passed `bun run test` again (23/23 targets), public API
validation, `najm-next` typecheck, the security gate, and whitespace checks.
The release script regressions passed (30 tests), and Playground's production
build passed on Next 15.5.27.
Playground declares zero trusted proxy hops explicitly. Its build helper
resolves its installed Next package, including when it is hoisted.

Remote CI, publication, and consumer acceptance results will be recorded
separately. Deployment remains outside this release verification.

The pre-publication tarball inspection caught a missing CLI declaration entry.
CLI clean now removes `tsconfig.tsbuildinfo`, so two consecutive builds emit
the declared executable and types. Its 24 tests pass, including the new built
entry regression. All release artifacts will be repacked from the corrected
source commit before publication.
