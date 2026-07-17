# najm-core

Core framework package for Najm — a decorator-driven TypeScript API framework built on Hono.js with dependency injection via diject.

## Install

```bash
bun add najm-core diject hono reflect-metadata
```

## What You Get

- **`Server`** — Main HTTP server class with plugin system, DI container, lifecycle hooks
- **Merged plugins** — `params`, `router`, `middleware`, `resolution` are auto-registered on first boot
- **DI re-exports** — `Service`, `Controller`, `Repository`, `Inject`, `DI`, `Scope` from diject
- **Tokens** — `REQUEST_ID`, `SERVER_OPTS`, `APP`, `BASE_PATH`, `LOGGER`
- **Logging** — `LoggerService`, `@Log()` decorator
- **Scanner** — `ScannerService`, `@Scan()`, `registerScanInjector`
- **Boot** — `BootService` lifecycle management
- **Errors** — `HttpError`, `AppError`, `DBError`, `GuardError`, `RouterError`
- **OpenAPI** — `server.openapi()` emits an OpenAPI 3.1 route/schema document

## Usage

```typescript
import 'reflect-metadata';
import { Server, Service, Controller, Get, Post, Body, Params } from 'najm-core';

@Service()
class UserService {
  getUsers() {
    return [{ id: 1, name: 'Alice' }];
  }
}

@Controller('/users')
class UserController {
  constructor(private users: UserService) {}

  @Get('/')
  list() {
    return this.users.getUsers();
  }

  @Get('/:id')
  get(@Params('id') id: string) {
    return { id, name: 'User ' + id };
  }

  @Post('/')
  create(@Body() data: any) {
    return { created: true, ...data };
  }
}

await new Server()
  .load(UserController, UserService)
  .listen(3000);
```

## Plugin Architecture

```typescript
import { Server } from 'najm-core';
import { plugin } from 'najm-core';

export const myPlugin = (config?: any) =>
  plugin('my-plugin')
    .version('1.0.0')
    .services(MyPluginService)
    .config(MY_CONFIG, config ?? {})
    .build();

await new Server()
  .use(myPlugin({ option: 'value' }))
  .load(MyController)
  .listen(3000);
```

## OpenAPI

Generate an OpenAPI 3.1 document after loading controllers. If
`najm-validation` is used, `@Validate()` metadata is reflected into path,
query, header, and JSON body schemas.

```typescript
const server = new Server()
  .base('/api')
  .load(MyController);

const document = await server.openapi({
  title: 'My API',
  version: '1.0.0',
  securitySchemes: {
    bearerAuth: { type: 'http', scheme: 'bearer' },
  },
  security: [{ bearerAuth: [] }],
});
```

## Observability & Operations

First-party plugins and options for running najm in production.

### Health checks — `health()`

```typescript
import { Server, health } from 'najm-core';

new Server()
  .use(health({
    // path: '/health'   (default)
    checks: {
      db: async () => { await db.execute('select 1'); return true; },
      cache: () => redis.status === 'ready',
    },
  }))
  .load(/* ... */);
```

- `GET /health` (and `/health/live`) — **liveness**: 200 while the process is
  up. Never runs checks.
- `GET /health/ready` — **readiness**: runs every check; 200 when all report
  `up`, **503** if any is `down` or throws. Each check has a `timeout`
  (default 5000ms) and a slow check is reported as `down`.
- Registered on the raw app (outside `.base()`), so ops tooling hits a stable
  prefix-free path.

### Metrics — `metrics()`

```typescript
import { Server, metrics } from 'najm-core';

new Server()
  .use(metrics({
    endpoint: '/metrics',            // Prometheus text format (default); false to disable
    onRequest: (m) => otel.record(m) // per-request hook for OTel/StatsD sinks
  }))
  .load(/* ... */);
```

Aggregates request count by status/method and a duration histogram, exposed at
`/metrics` in Prometheus exposition format. The `onRequest(sample)` hook is the
seam for full OpenTelemetry — `sample` is `{ method, path, status, durationMs }`
with `path` being the matched route pattern. `MetricsService.snapshot()` returns
the in-memory aggregates for custom sinks.

### Request IDs

Every request gets an id (from the incoming `x-request-id` header when present,
otherwise generated). It is echoed back on the response `x-request-id` header
for client/proxy correlation and tags every log line via ALS.

The generator is configurable through the middleware plugin config:

```typescript
middleware({ requestId: 'fast' })            // default: <pid>-<seq>, ~0 cost
middleware({ requestId: 'uuid' })            // crypto.randomUUID() per request
middleware({ requestId: (ctx) => myId() })   // custom generator
```

`'fast'` ids are unique per process (not across restarts) — right for log
correlation. Use `'uuid'` when ids must be globally unique across instances.
Change the header name with `requestIdHeader`.

### Graceful shutdown & drain

```typescript
new Server({ gracefulShutdown: true, shutdownTimeout: 15_000 })
```

- `gracefulShutdown: true` installs `SIGINT`/`SIGTERM` handlers that call
  `stop()` then `process.exit(0)`.
- `stop()` **stops accepting** new connections, then **drains** in-flight
  requests before running `onDestroy` lifecycle hooks.
- `shutdownTimeout` (ms, default **10000**) bounds the drain: if requests are
  still in flight when it elapses, najm logs a warning and proceeds with
  teardown. Setting `shutdownTimeout` alone enables drain tracking even without
  the signal handlers.

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## Production Notes

- `reflect-metadata` must be imported before any decorated class loads
- Auto-registered plugins (`params`, `router`, `middleware`, `resolution`) boot with default settings on first `listen()` or `fetch()` call
- Use `new Server({ isolated: true })` in tests to get a fresh DI container
- In bundled environments (Next.js, Vite SSR), use `.load(moduleObject)` instead of `.scan()`
