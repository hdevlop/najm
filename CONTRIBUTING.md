# Contributing

## Public API And Semver

Najm packages are released on a lockstep major line. Public API is defined by
the package `exports` map plus each package `src/index.ts` entrypoint.

- Patch releases may include bug fixes, docs, tests, and compatible internal
  refactors.
- Minor releases may add public exports, options, decorators, and behavior that
  is backward compatible by default.
- Major releases may remove deprecated APIs or make breaking contract changes.
- Do not remove, rename, or narrow a public export inside the same major unless
  the API was already documented as deprecated and the removal is explicitly
  called out in release notes.
- Prefer adding the replacement first, documenting the migration path, and
  keeping the old API as a compatibility shim until the next major.

Run `bun run api:check` when changing package entrypoints. If the change is
intentional, run `bun run api:snapshot` and include the snapshot diff.
