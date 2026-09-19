# Najm Kit global actions closeout

Date: 2026-09-18

## Outcome

- `najm-kit@2.16.3` introduced the flat `NNotify*` compound API,
  `NNotifyMenu`, `NGlobalActions`, `NLanguageMenu`, `NThemeToggle`, and
  `NFullscreenToggle`.
- `najm-kit@2.16.4` widened awaited command callback results to
  `void | Promise<unknown>`, allowing React Query mutations to return their own
  result without adapters or discarded promises.
- Kafil and School independently adopted the package-owned presentation while
  retaining their own records, queries, mutations, routing, language commands,
  catalogs, and persistence.

## Najm package evidence

- Feature commit: `a2a95c5`.
- Async command compatibility fix: `4aca635`.
- Release commit and packing commit: `37ebe67`.
- Exact tarball: `dist-publish/najm-kit-2.16.4.tgz`.
- SHA-256: `169830f7fbdeaca64d06ae5bab1ab86aef509a947eb7dd8fdf35e1c512dd8aae`.
- Registry integrity:
  `sha512-AvlSJPLNwTHmoRUg8wnh6IEnjBE31PSl+2NWq1Kgugouwa/Pp6zH0NYULmLp2AJa7ZYJW9ye7urkQOb6raaeaw==`.
- Registry shasum: `8abbbcd768f86a82f0b661030927b785b26b5dc0`.
- Focused notification tests: 46 passed, 0 failed.
- Focused global-action tests: 37 passed, 0 failed.
- Full Kit suite: 1,416 passed, 14 skipped, 0 failed; RSC suite: 9 passed.
- Kit lint, production bundle, preview build, Next 16 production fixture,
  acceptance typecheck, public API snapshot, and whitespace checks passed.

The original root-level focused-test commands skipped Kit's package-local DOM
preload and failed with `document is not defined`. The plan now uses
`bun --cwd packages/najm-kit test ...`, which exercises the intended Happy DOM
configuration.

## Consumer evidence

Kafil resolves `najm-kit@2.16.4`. Its focused provider, notification, status,
and theme tests passed 50/50. The full non-browser gate passed: lint, typecheck,
467 web tests, 424 server tests with 83 opt-in database skips, 90 seed tests,
production build, and `db:generate` with no schema changes.

School resolves `najm-kit@2.16.4`. Its 77 dashboard tests and production build
passed. Lint passed with the three pre-existing `no-img-element` warnings.
School remains a separately dirty, uncommitted consumer worktree; this Najm
closeout does not claim a School Git publication.

## Browser boundary

No browser, Playwright, responsive, keyboard, RTL, or connected acceptance test
was run during this closeout. The existing screenshots in this directory are
historical implementation evidence and were not regenerated. Deployment was
also not performed.
