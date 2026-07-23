# Najm

[![CI](https://github.com/hdevlop/najm/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/hdevlop/najm/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/najm-api.svg)](https://www.npmjs.com/package/najm-api)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Najm is a modular TypeScript framework for building APIs with decorators,
dependency injection, Hono, and a composable plugin system. It runs on Bun and
supports Node.js production runtimes.

## Highlights

- Decorator-driven controllers, routing, validation, and authorization
- Dependency injection powered by [`diject`](https://www.npmjs.com/package/diject)
- Composable plugins for auth, databases, events, caching, storage, email,
  internationalization, MCP, RAG, chatbots, and WhatsApp
- Automatic transaction handling and request-scoped context
- OpenAPI 3.1 document generation
- Next.js App Router integration
- Bun-first development with Node.js runtime coverage

## Install

Use the aggregate package for the common framework and plugin APIs:

```bash
bun add najm-api
```

Or install only the packages your application needs:

```bash
bun add najm-core diject hono reflect-metadata
```

Enable decorators in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true
  }
}
```

## Quick start

```typescript
import 'reflect-metadata';
import {
  Body,
  Controller,
  Get,
  Post,
  Server,
  Service,
} from 'najm-api';

@Service()
class UserService {
  list() {
    return [{ id: 1, name: 'Najm' }];
  }
}

@Controller('/users')
class UserController {
  constructor(private readonly users: UserService) {}

  @Get('/')
  list() {
    return this.users.list();
  }

  @Post('/')
  create(@Body() input: { name: string }) {
    return { id: 2, ...input };
  }
}

await new Server()
  .load(UserController, UserService)
  .listen(3000);
```

The API is available at `http://localhost:3000/users`.

## Packages

| Area | Packages |
| --- | --- |
| Framework | `najm-api`, `najm-core`, `najm-cli` |
| Security | `najm-auth`, `najm-guard`, `najm-validation`, `najm-rate`, `najm-cors`, `najm-cookies` |
| Data and infrastructure | `najm-database`, `najm-cache`, `najm-storage`, `najm-event`, `najm-email`, `najm-i18n` |
| AI and integrations | `najm-mcp`, `najm-rag`, `najm-chatbot`, `najm-whatsapp` |
| UI | `najm-kit` |

Package-specific guides live beside their source under
[`packages/`](packages). The documentation site source is in
[`apps/website`](apps/website), and [`apps/playground`](apps/playground)
provides the integration application.

## Next.js

Use one shared server instance and load exported module objects instead of
runtime filesystem scanning:

```typescript
import 'reflect-metadata';
import { Server, handle } from 'najm-api';
import * as modules from './modules';

export const server = new Server()
  .base('/api')
  .load(modules);

export const GET = handle(server);
export const POST = handle(server);
```

See the [`najm-api` guide](packages/najm-api/README.md) for plugin setup,
feature subpaths, and a complete Next.js catch-all route example.

## Repository development

This is a Bun workspace monorepo.

```bash
bun install
bun run build
bun run test
```

Useful focused commands:

```bash
bun run build:core
bun run build:auth
bun run test:core
bun run test:auth
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance and
[SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

[MIT](LICENSE)
