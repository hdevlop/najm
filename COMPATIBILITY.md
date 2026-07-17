# Najm Compatibility

Najm 2.x is the launch line for the public package set. All publishable
packages in `packages/*` are versioned in lockstep as `2.0.0`.

## Supported Runtimes

| Surface | Supported range | Notes |
| --- | --- | --- |
| Bun | `>=1.2.10` | Primary runtime and package manager for development, tests, and publishing. |
| Node.js | `20.x`, `22.x` | Supported through `@hono/node-server` for server listening. Bun-only APIs remain limited to tests, scripts, and Bun-specific integrations. |
| TypeScript | `>=5.7` | Decorators require `experimentalDecorators` and `emitDecoratorMetadata`. |
| Hono | `^4.7` | Najm builds on Hono's request/response primitives. |

## Platform Support

CI must stay green on Ubuntu and Windows for Bun builds/tests. Node runtime
smoke coverage runs on Node 20 and Node 22.

## Storage And Database Dialects

Najm packages expose schemas for SQLite, PostgreSQL, and MySQL where supported.
SQLite is exercised in-process. PostgreSQL and MySQL jobs run on Ubuntu with
service containers so dialect-specific regressions are visible before release.

## Package Policy

- Publishable packages are the workspaces listed in `scripts/workspaces.ts`.
- Apps, benchmarks, and playground workspaces are not published.
- All publishable packages stay on the same major/minor/patch version for the
  2.x launch line.
- Breaking changes require a new major and a migration note.
