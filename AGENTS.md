# AGENTS.md - Najm Monorepo

## Scope

- Work from the repo root unless a command explicitly uses `--cwd`; the root package manager is `bun@1.2.10`.
- Workspaces are `packages/*` and `apps/*`; `diject` is consumed from npm, not a sibling checkout.
- `CLAUDE.md` exists but is stale in package names and test behavior; prefer `package.json`, `turbo.json`, and `scripts/workspaces.ts`.
- There is no root README, no root CI workflow, and no root lint/typecheck script as of this file; do not invent those verification steps.

## Package Map

- Core framework: `packages/najm-core`; `packages/najm-api` is the app-facing aggregate re-export surface.
- Plugins: `najm-guard`, `najm-validation`, `najm-cache`, `najm-rate`, `najm-cors`, `najm-cookies`, `najm-i18n`, `najm-mcp`, `najm-event`, `najm-database`, `najm-storage`, `najm-email`, `najm-auth`, `najm-rag`, `najm-chatbot`, `najm-whatsapp`.
- Tooling/UI: `najm-cli`, `najm-kit`, `najm-next`; standalone RAG Studio app is `apps/rag-studio`.
- Apps: `apps/playground` is the real integration harness; `apps/website` is docs; `apps/rag-studio` is a standalone Next static-export studio on port `4100`.
- Package source entrypoints are `packages/*/src/index.ts`; update these plus `package.json` `exports`, `tsup.config.ts`, and root `tsconfig.json` paths/references when changing public surfaces.

## Commands

- Install: `bun install`.
- Build all packages: `bun run build` (`turbo run build`, with dependency builds from `turbo.json`).
- Build one package with root shortcuts when present, for example `bun run build:core`, `bun run build:auth`, `bun run build:mcp`, `bun run build:ui`.
- If no shortcut exists, use `turbo run build --filter=<package-name>` or `bun run --cwd <workspace> build`.
- `najm-rag` uses a custom Bun build script; prefer `bun run build:rag`. The standalone RAG Studio app uses `bun run build:rag-studio`.
- `najm-kit` build runs `tsup` and `scripts/build-css.mjs`; use `bun run build:ui` for package output.
- Clean all package build output: `bun run clean`.

## Tests

- Full test: `bun run test`; this is an alias for `bun run test:seq`, which first runs `turbo run build` and then runs `bun test <workspace>` sequentially in `scripts/workspaces.ts` order, including `apps/playground`.
- `bun run test:parallel` runs `turbo run test`; avoid it for integration suites that bind ports unless you know the package is safe.
- Focused package tests: use root shortcuts such as `bun run test:core`, `bun run test:auth`, `bun run test:mcp`, `bun run test:rag`, `bun run test:ui`, or run `bun test packages/<name>`.
- Focused file tests: `bun test packages/<name>/test/<file>.test.ts`.
- Decorator tests usually need `import 'reflect-metadata';` first, `new Server({ isolated: true })`, and `await server.stop()` in cleanup; use `await reset()` from `diject` when registering global injectables outside an isolated server.
- Use unique ports in tests that call `server.listen`; the sequential runner avoids package-level collisions but not duplicate ports inside a file.

## Apps And Runtime

- Playground backend: `bun run playground`; entrypoint is `apps/playground/src/server/main.ts`, server wiring is `apps/playground/src/server/index.ts`.
- Playground Next frontend: `bun run playground:next`; production path is `bun run playground:next:prod`.
- Background Next helpers: `bun run playground:next:bg`, `bun run playground:next:status`, `bun run playground:next:stop`.
- Docs site: `bun run web`; website-local lint exists as `bun run --cwd apps/website lint`.
- RAG Studio app: `bun run --cwd apps/rag-studio dev`.
- Playground backend defaults to SQLite `./playground.db`; reset/seed with `bun run --cwd apps/playground db:reset-seed`.
- Playground MCP endpoint is `/api/mcp` because the server base is `/api` and the MCP plugin path is `/mcp`.
- Playground uses `.load(modulesModule, listenersModule)`, not `.scan()`; preserve this for bundled/Next-compatible code paths.
- `apps/playground/next.config.ts` is `defineNajmNextConfig` from `najm-next/configurable`; the preset externalizes `reflect-metadata` and the playground adds `better-sqlite3`, `sqlite-vec`, `@whiskeysockets/baileys`, and `sharp`. Keep this in mind for server-side dependency changes.

## Build And Export Quirks

- Packages are ESM-only (`"type": "module"`) and publish only `dist`.
- Most framework packages build with `tsup`, bundle ESM, emit `.mjs`, and use a custom `preserve-metadata` esbuild plugin so decorators keep `experimentalDecorators` and `emitDecoratorMetadata`; do not remove it casually.
- `najm-kit` and `apps/rag-studio` have React/Tailwind/CSS outputs; verify CSS/static export when touching UI build config.
- `najm-api` intentionally re-exports common plugin factories, decorators, auth helpers, tokens, and types; package-level exports may also need aggregate exports here.

## Najm Conventions

- Import `reflect-metadata` before decorated classes are loaded in entrypoints and tests.
- Cross-package imports should use package names (`najm-core`, `najm-auth/sqlite`, etc.), not deep relative paths across workspaces.
- In Next.js or other bundled environments, load exported module objects with `.load(moduleObject)` instead of filesystem `.scan()`.
- Keep module boundaries consistent with the playground: controllers own decorators/transport, services orchestrate business logic, repositories own database access, validators own reusable domain checks, DTO files own Zod schemas.
- Prefer constructor injection or `@Inject()`/`@DI()` property injection; use `container.get(...)` mainly for dynamic tokens, request ALS values, or framework internals.
- Use the `plugin()` builder from `najm-core` for plugins; lifecycle services that need ordering use `@Meta({ layer: 'plugin', order: N })` and implement `scan`, `configure`, `activate`, or `onReady`.
- When using auth schemas, import dialect-specific schemas such as `najm-auth/sqlite` and spread `authSchema`; do not duplicate auth tables. The playground schema also spreads chatbot, RAG, storage, and WhatsApp schemas.

## Publishing

- Publishing is custom script based, not changesets/lerna.
- Publish order is the exact `PACKAGE_TARGETS` order in `scripts/workspaces.ts`: `najm-core`, `najm-guard`, `najm-validation`, `najm-cache`, `najm-rate`, `najm-cors`, `najm-cookies`, `najm-i18n`, `najm-mcp`, `najm-event`, `najm-database`, `najm-storage`, `najm-email`, `najm-auth`, `najm-api`, `najm-rag`, `najm-chatbot`, `najm-whatsapp`, `najm-cli`, `najm-kit`, `najm-theme`, `najm-next`.
- `publish-all.ts` replaces `workspace:*` dependencies with `^<version>` in the publish manifest, applies `publishConfig` export overrides, then restores package files.
- Dry-run all packages: `bun run publish:all:dry`; publish all: `bun run publish:all`.
- Single-package publish shortcuts publish the already-versioned, committed
  candidate and require a clean worktree, package tests, public API checks, and
  a build. Version flags (`--patch`, `--minor`, `--major`) only prepare the
  package version and exit so that change can be reviewed and committed before
  packing or publication. Generic form:
  `bun scripts/publish-package.ts <name> [--dry-run|--patch|--minor|--major|--tag <tag>|--otp <code>]`.
