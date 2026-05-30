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