# najm-api

`najm-api` is the convenience/meta package for the Najm framework. It re-exports `najm-core` plus the commonly used Najm backend plugins from one stable package.

## Najm Framework 🚀

A modern, modular TypeScript framework for building scalable APIs with decorators, dependency injection, and plugin architecture.

**Najm** is built on [Hono.js](https://hono.dev/) and uses [diject](https://www.npmjs.com/package/diject) for dependency injection. It provides a powerful decorator-driven development experience with first-class support for transactions, events, guards, i18n, and more.

## ✨ Key Features

- 🎯 **Decorator-Driven** — Clean, declarative API with TypeScript decorators
- 🔌 **Modular Plugin System** — Install only what you need
- 💉 **Powerful DI Container** — Advanced dependency injection with scopes (via [diject](https://www.npmjs.com/package/diject))
- 🛡️ **Guards & Security** — Class-based route protection
- 💾 **Transaction Management** — Automatic transactions with retry logic
- 📡 **Event System** — Built-in event emitter with decorator support
- 🌐 **i18n Support** — Multi-language with automatic detection
- 🍪 **Cookie Management** — Secure cookie handling
- 🔄 **CORS Configuration** — Flexible CORS setup
- 📝 **Built-in Logging** — Structured logging with request ID tracking
- 🌱 **Database Seeding** — Idempotent seeding with conflict resolution

## 📦 Installation

```bash
bun add najm-api
```

`najm-api` depends on the common backend packages for you, so application code can use one import source for the framework, core plugins, auth, validation, database, events, MCP, storage, email, cookies, CORS, cache, i18n, and rate limiting.

## 🔧 Setup

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "target": "ES2020",
    "module": "ESNext"
  }
}
```

### Import reflect-metadata

```typescript
import 'reflect-metadata';
```

## 🚀 Quick Start

### Basic Server

```typescript
import 'reflect-metadata';
import { Server, Service, Controller, Get, Post, Body, Params } from 'najm-api';

@Service()
class UserService {
  getUsers() {
    return [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
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

## Plugin System

```typescript
import { Server, guards, database, events, cors, cookies, i18n } from 'najm-api';

await new Server()
  .use(cors({ origin: '*' }))
  .use(database({ default: myDb }))
  .use(i18n({ translations: { en, fr } }))
  .use(guards())
  .use(events())
  .base('/api')
  .scan('./src/features')
  .listen(3000);
```

## Feature Subpaths

Use the root entry for common APIs, or feature subpaths when you want a smaller, explicit import surface:

```typescript
import { Server, Controller, Get, Validate, auth, database } from 'najm-api';
import { authSchema } from 'najm-api/auth';
import { Transaction } from 'najm-api/database';
import { McpTool } from 'najm-api/mcp';
```

Available subpaths:

```text
najm-api/auth
najm-api/cache
najm-api/cookies
najm-api/cors
najm-api/database
najm-api/email
najm-api/event
najm-api/guard
najm-api/i18n
najm-api/mcp
najm-api/rate
najm-api/storage
najm-api/validation
```

## Next.js Integration

Najm works as an API backend inside Next.js App Router using a catch-all route.

**1. Configure `next.config.ts`:**

```typescript
const nextConfig = {
  serverExternalPackages: ['reflect-metadata', 'better-sqlite3'],
};

export default nextConfig;
```

**2. Create a shared server instance:**

Use `.load()` with barrel imports instead of `.scan()` — bundlers can't resolve dynamic filesystem imports.

```typescript
// src/server.ts
import 'reflect-metadata';
import { Server, database } from 'najm-api';
import * as features from './features';

export const server = new Server()
  .use(database({ default: db }))
  .base('/api')
  .load(features);
```

**3. Create the catch-all API route:**

```typescript
// app/api/[...route]/route.ts
import { handle } from 'najm-api';
import { server } from '@/server';

export const GET = handle(server);
export const POST = handle(server);
export const PUT = handle(server);
export const PATCH = handle(server);
export const DELETE = handle(server);
```

`handle()` wraps `server.fetch` for Next.js route handlers.

## 📖 Documentation

- [Full Documentation](https://najm.dev) — Complete guides, tutorials, and API reference
- [Quick Start](https://najm.dev/docs/quick-start) — Build your first API in 5 minutes
- [Installation Guide](https://najm.dev/docs/installation) — Setup and configuration

## License

MIT
