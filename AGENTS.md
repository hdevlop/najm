# AGENTS.md — Najm Monorepo

> This file is intended for AI coding agents. It describes the architecture, conventions, and workflows of the Najm project so you can be productive without prior knowledge.

---

## Project Overview

**Najm** is a TypeScript decorator-based web framework library built on [Hono.js](https://hono.dev). It provides dependency injection, 40+ parameter decorators, guards, transactions, events, i18n, MCP (Model Context Protocol) tool exposure, and CLI tooling for rapid API development. The primary runtime target is **Bun**, with Node.js fallback support.

The project lives in a **modular monorepo** managed with **Bun workspaces** and **Turbo**. Each feature is an independently versioned package under `packages/`. Two applications under `apps/` demonstrate and document the framework:

- `apps/playground` — Full-stack reference implementation (Next.js frontend + Najm backend)
- `apps/website` — Documentation website (Next.js)

**Dependency Injection:** Najm uses [`diject`](https://www.npmjs.com/package/diject) as its DI container. Diject is a standalone library with decorators, scopes (`SINGLETON`, `REQUEST`, `TRANSIENT`), and `AsyncLocalStorage` support. It was originally developed inside this repo and is now maintained as an independent package. The `diject` workspace is referenced from `../diject`.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun (primary), Node.js (fallback) |
| Language | TypeScript 5.x |
| HTTP Framework | Hono.js |
| DI Container | diject |
| Monorepo | Bun workspaces + Turbo |
| Build Tool | tsup (custom esbuild plugin for decorator metadata) |
| Test Runner | Bun native test runner (`bun:test`) |
| ORM | Drizzle ORM (used in auth, database, storage, chatbot) |
| Validation | Zod |
| Events | mitt |
| Cache | ioredis (Redis) |
| Frontend (apps) | Next.js 15 + React 19 + Tailwind CSS |

---

## Monorepo Structure

```
packages/
├── najm-core/        # Framework core — Server, plugin system, boot, DI re-exports
├── najm-api/         # Meta-package that simply re-exports najm-core
├── najm-guard/       # Authorization guards (@Guards, createGuard, composeGuards)
├── najm-validation/  # Request validation (@Validate, DTOs)
├── najm-cache/       # Redis caching
├── najm-rate/        # Rate limiting with route-scoped keys
├── najm-cors/        # CORS handling
├── najm-cookies/     # Cookie management
├── najm-i18n/        # Internationalization
├── najm-mcp/         # Model Context Protocol tool exposure
├── najm-event/       # Event system (@On, @Events)
├── najm-database/    # Database connections & transactions (@DB, @Transaction)
├── najm-storage/     # File storage (local + DB backends)
├── najm-email/       # Email sending
├── najm-auth/        # JWT authentication, RBAC, PBAC, built-in auth controllers
├── najm-chatbot/     # AI chatbot (LLM providers, MCP adapter, React UI)
├── najm-whatsapp/    # WhatsApp Cloud API webhooks
└── najm-cli/         # CLI scaffolding (create, init, new controller/service/module)

apps/
├── playground/       # Full demo app with Next.js frontend
└── website/          # Docs website
```

### Package Dependency Model

- `najm-core` depends on `diject` (external npm package).
- All plugin packages depend on `najm-core` and `diject`.
- `najm-api` re-exports `najm-core`.
- `najm-auth` is the heaviest plugin; it depends on many other plugins (guard, database, cache, cookies, i18n, email, rate, validation) and auto-registers them.

---

## Key Configuration Files

| File | Purpose |
|------|---------|
| `package.json` (root) | Workspace definition, shared dev deps, root scripts |
| `turbo.json` | Turbo pipeline: `build` depends on `^build`; `test` depends on `build`; `dev` and `clean` are uncached |
| `tsconfig.json` (root) | Path mapping for every package (`"najm-core": ["./packages/najm-core/src"]`) and project references |
| `packages/*/tsup.config.ts` | Per-package build config. ESM output (`.mjs`), bundled, with a custom esbuild plugin that transpiles TypeScript while preserving `experimentalDecorators` and `emitDecoratorMetadata` |
| `packages/*/package.json` | Per-package metadata, exports, peer dependencies |
| `scripts/workspaces.ts` | Canonical list of packages in publish/test order |
| `scripts/publish-all.ts` | Publishes all packages to npm, replacing `workspace:*` with caret semver |
| `scripts/test-sequential.ts` | Runs tests sequentially (parallel tests cause port collisions) |

### TypeScript Compiler Requirements

Every consuming project **must** enable:

```json
{
  "experimentalDecorators": true,
  "emitDecoratorMetadata": true
}
```

Also import `reflect-metadata` before any decorated class is loaded:

```typescript
import 'reflect-metadata';
```

---

## Build & Development Commands

All commands assume you are in the repo root and have Bun installed.

### Build

```bash
# Build all packages in dependency order (Turbo)
bun run build

# Build a single package
bun run build:core       # najm-core
bun run build:auth       # najm-auth
bun run build:cli        # najm-cli
# ... etc (see root package.json scripts)

# Build diject (external workspace)
bun run build:diject

# Clean all build artifacts
bun run clean
```

### Test

```bash
# Run all tests sequentially (recommended — avoids port collisions)
bun run test
# alias: bun run test:seq

# Run tests for a single package
bun run test:core
bun run test:auth
bun run test:guard
# ... etc

# Run tests in parallel (Turbo) — only safe if packages don't bind ports
bun run test:parallel
```

### Development

```bash
# Run the playground backend
bun run playground

# Run the playground Next.js frontend
bun run playground:next

# Run the docs website
bun run web
```

### Publishing

```bash
# Dry-run publish all packages
bun run publish:all:dry

# Publish all packages for real
bun run publish:all

# Publish and bump a single package (example)
bun run pub:auth    # bumps najm-auth patch version and publishes
```

---

## Code Style Guidelines

1. **Language:** All code, comments, and documentation are in English.
2. **Module system:** ESM only (`"type": "module"`). No CommonJS.
3. **Decorators:** Use experimental TypeScript decorators. Framework code and user code rely heavily on them.
4. **Naming conventions:**
   - Classes: `PascalCase` (e.g., `AuthService`, `UserController`)
   - Files: `kebab-case.ts` for general files, but the repo also uses `camelCase.ts` frequently inside packages. Follow the existing folder.
   - Decorators: `camelCase` with `@` (e.g., `@mcpTool`, `@validate`, `@transaction`)
   - Tokens / ALS tokens: `SCREAMING_SNAKE_CASE` (e.g., `REQUEST_ID`, `USER`)
5. **Imports:**
   - Always import `reflect-metadata` first in entry files.
   - Prefer absolute imports within a package (no relative `../../` if avoidable).
   - Cross-package imports use the package name (e.g., `import { Server } from 'najm-core'`).
6. **Error handling:**
   - Use framework error classes from `najm-core/errors`: `HttpError`, `AppError`, `DBError`, `GuardError`, `RouterError`.
   - Use `Err.circularDependency(...)`, `Err.missingDependency(...)` shorthand helpers where available.
7. **Plugin authoring:**
   - Use the fluent `plugin()` builder from `najm-core`.
   - Name the default export factory after the feature (e.g., `export const auth = (config?) => plugin('auth')...`).
   - Declare dependencies with `.depends(...)` (auto-registers) or `.requires(...)` (must be present).
   - Services that need lifecycle hooks should implement `scan()`, `configure()`, `activate()`, or `onReady()` and be decorated with `@Meta({ layer: 'plugin', order: N })`.

---

## Testing Instructions

### Test Framework

- **Runner:** Bun's built-in test runner (`bun:test`).
- **Assertion style:** `expect(...).toBe(...)`, `expect(...).toEqual(...)`, etc.
- **Test files:** Named `*.test.ts` and located in `test/` or `tests/` directories inside each package.

### Writing Tests

A typical integration test spins up a real HTTP server, sends `fetch` requests, and asserts on responses:

```typescript
import 'reflect-metadata';
import { describe, test, expect, afterEach } from 'bun:test';
import { Server, Controller, Get } from 'najm-core';
import { guards } from 'najm-guard';

describe('My Feature', () => {
  let server: Server;

  afterEach(async () => {
    await server?.stop();
  });

  test('should respond with 200', async () => {
    @Controller('/api')
    class TestController {
      @Get('/')
      get() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true })
      .use(guards())
      .load(TestController);

    await server.listen(3100);

    const res = await fetch('http://localhost:3100/api');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

### Important Testing Rules

1. **Use `isolated: true`** when creating a `Server` in tests. This gives each test its own DI container and prevents state leakage.
2. **Always `await server.stop()` in `afterEach`** to free the port.
3. **Use unique ports** per test file to avoid collisions when running sequentially (the default test runner does not randomize ports).
4. **Import `reflect-metadata`** at the top of every test file that uses decorators.
5. **Reset global DI state** with `await reset()` from `diject` if tests register injectables outside of an isolated server.

### Why Sequential Testing?

The default `bun run test` runs `scripts/test-sequential.ts` because multiple packages binding to the same localhost ports would collide if Turbo ran them in parallel. `turbo run test` is available as `bun run test:parallel` but is mainly useful when you know the filtered packages do not conflict.

---

## Runtime Architecture

### Server Lifecycle

The `Server` class in `najm-core` manages initialization through a state machine (`IDLE` → `INITIALIZING` → `READY` → `FAILED`).

```typescript
const server = new Server(opts?)
  .use(guards())
  .use(database({ default: db }))
  .use(events())
  .base('/api')
  .load(UserController, UserService)
  .set('port', 3000);

await server.listen(3000);
```

**Boot sequence:**
1. `.use(plugin)` registers plugins immediately with circular-dependency detection.
2. `.load(...classes)` queues application services/controllers.
3. `.listen(port)` or `.fetch` triggers initialization (if not `READY`):
   - Auto-registers default plugins (`middleware`, `params`, `router`) if missing.
   - Collects plugin services and app services.
   - Runs `BootService.boot()` across three stations:
     1. `bootInfrastructure()` — resolve core + plugin services.
     2. `runLifecycle()` — execute `scan` → `configure` → `activate` → `onReady`.
     3. `bootAppServices()` — resolve all user-defined services/controllers.
   - Starts the Hono server via `Bun.serve` or returns a `fetch` handler for serverless.

### Request Processing Pipeline

1. **Hono router** receives the request.
2. **MiddlewareService** stores context, assigns `requestId`, runs user middleware.
3. **RouterService** matches the route and resolves the controller.
4. **GuardService / GuardExecutor** runs guards; stores results in ALS.
5. **ParamResolver** resolves parameter decorators (`@Body`, `@Params`, `@Query`, `@User`, etc.).
6. **Controller method** executes with injected arguments.
7. **ResponseFormatter** formats the return value (JSON, HTML, text, stream).

### Dependency Injection Scopes

- `SINGLETON` (default) — one instance for the application lifetime.
- `REQUEST` — one instance per HTTP request (backed by `AsyncLocalStorage`).
- `TRANSIENT` — new instance on every injection.

### ALS Store (Request Context)

Access request-scoped values inside services:

```typescript
import { REQUEST_ID } from 'najm-core';
import { CONTEXT, USER, LANG } from 'najm-core'; // and other tokens

@Service()
class MyService {
  @DI() container!: Container;

  doSomething() {
    const requestId = this.container.get(REQUEST_ID);
    const user = this.container.get(USER);
  }
}
```

---

## Project-Specific Conventions

### Decorator Taxonomy

| Type | Examples |
|------|----------|
| Class decorators | `@Controller('/path')`, `@Service()`, `@Repository('db')`, `@Injectable()` |
| Method decorators | `@Get('/'), @Post('/'), @Put('/:id'), @Patch('/:id'), @Delete('/:id')`, `@Guards(...)`, `@Transaction({ retries: 3 })`, `@On('event.name')`, `@McpTool('desc')` |
| Property decorators | `@Inject()`, `@DB('postgres')`, `@I18n('prefix')`, `@Log()`, `@Events()` |
| Parameter decorators | `@Body(), @Params(), @Query(), @Headers(), @Ctx(), @Cookie(), @User(), @IP(), @GuardParams()`, and 30+ more |

### Recommended Application Structure

The playground (`apps/playground/src/server/`) demonstrates the recommended layout:

```
src/
├── features/           # Feature modules (co-located controller, service, repository)
│   ├── product/
│   │   ├── product.controller.ts
│   │   ├── product.service.ts
│   │   ├── product.repository.ts
│   │   └── index.ts
├── config/             # Plugin configuration factories
├── shared/             # Guards, middleware, utilities
├── database/           # Drizzle schema & connection
├── locales/            # i18n translation files
├── listeners/          # Event listeners
└── main.ts             # Server entry point
```

### Schema Composition (Critical)

When using `najm-auth`, **never duplicate auth tables**. Import the schema and spread it:

```typescript
import { authSchema } from 'najm-auth';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const products = sqliteTable('products', { /* ... */ });

export const schema = {
  ...authSchema,   // users, roles, permissions, tokens, rolePermissions
  products,
};
```

### Next.js Integration

In bundled environments (Next.js, Vite SSR), **do not use `.scan()`** (it relies on dynamic filesystem imports). Use `.load(moduleObject)` instead — `Server` extracts all `@Injectable` classes from the module exports.

Required `next.config.ts`:

```typescript
const nextConfig = {
  serverExternalPackages: ['reflect-metadata', 'better-sqlite3'],
};
```

---

## Security Considerations

1. **JWT Secrets:** `najm-auth` requires `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. Generate them with `openssl rand -base64 32`. Never commit secrets.
2. **Cookie Secrets:** Cookie plugin requires a strong `secret` for signing.
3. **Password Hashing:** Uses bcrypt (via `bcryptjs` in auth).
4. **Token Revocation:** Refresh tokens are blacklisted in Redis/cache on logout for immediate revocation.
5. **Rate Limiting:** Built-in rate-limit plugin supports global and per-route keys.
6. **Guard Authorization:** Guards run before route handlers. Return `true` to allow, `false` or throw to deny (returns 401/403).
7. **Environment Files:** `.env` and `.env.*.local` are gitignored. Use `.env.example` to document required variables.

---

## Deployment Notes

- **Package publishing** is done via custom scripts, not `changesets` or `lerna`.
- `workspace:*` dependencies are automatically rewritten to caret semver (`^version`) during publish.
- The publish order is defined in `scripts/workspaces.ts` and ensures dependencies are published before dependents.
- Each package builds to a `dist/` folder which is the only folder included in the npm tarball (`"files": ["dist"]`).

---

## Quick Reference

| Task | Command |
|------|---------|
| Install dependencies | `bun install` |
| Build everything | `bun run build` |
| Test everything | `bun run test` |
| Clean build artifacts | `bun run clean` |
| Run playground | `bun run playground` |
| Publish all (dry run) | `bun run publish:all:dry` |
| Publish all | `bun run publish:all` |
