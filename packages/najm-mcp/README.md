<div align="center">

# najm-mcp

**MCP (Model Context Protocol) plugin for the [Najm](https://github.com/hichamjaberadev/najm) framework**

Build MCP tools, resources, and prompts with decorators — connect any LLM to your API in minutes.

[![npm version](https://img.shields.io/npm/v/najm-mcp.svg?style=flat)](https://www.npmjs.com/package/najm-mcp)
[![license](https://img.shields.io/npm/l/najm-mcp.svg)](LICENSE)
[![najm](https://img.shields.io/badge/najm-compatible-blue)](https://github.com/hichamjaberadev/najm)

</div>

---

## What is this?

`najm-mcp` is a [Najm](https://github.com/hichamjaberadev/najm) plugin that exposes your API as an **MCP server** — compatible with Claude, ChatGPT, Gemini, Cursor, Windsurf, VS Code Copilot, and any other MCP-enabled LLM client.

You write one decorator. Every LLM can use it.

```typescript
@McpServer()
export class ProductTools {
  constructor(private svc: ProductService) {} // same DI as your REST controllers

  @Tool({ name: 'search_products', description: 'Search the product catalog' })
  async search(
    @Arg('query', z.string()) query: string,
    @Arg('limit', z.number().default(10)) limit: number,
  ) {
    return this.svc.search(query, limit); // reuse your existing service
  }
}
```

**That's it.** No transport config. No SDK boilerplate. No duplicate business logic.

---

## LLM Compatibility

| Client | Transport | Config key |
|---|---|---|
| Claude.ai | Streamable HTTP | Remote URL |
| Claude Desktop | SSE or stdio | Config file |
| ChatGPT | Streamable HTTP | Remote URL |
| Gemini / AI Studio | Streamable HTTP | Remote URL |
| Cursor | SSE or stdio | `.cursor/mcp.json` |
| Windsurf | SSE | `mcp_config.json` |
| VS Code Copilot | SSE | `.vscode/mcp.json` |

All three MCP transports supported: **Streamable HTTP**, **SSE**, **stdio**.

---

## Installation

```bash
bun add najm-mcp @modelcontextprotocol/sdk zod
# or
npm install najm-mcp @modelcontextprotocol/sdk zod
```

**Peer dependencies:** `najm-core`, `hono`, `reflect-metadata`, `zod`

---

## What's New (DX)

Latest DX enhancements make MCP tools much leaner:

- Automatic return normalization in tools (`string`, object/array, `null`/`undefined`, and explicit `content` payloads)
- Pretty JSON serialization by default for object/array returns
- `null` / `undefined` tool returns now normalize to `"OK"`
- New helpers: `McpResult(...)` and `McpError(...)`
- New arg presets: `IdArg(...)` and `IntArg(...)`
- Optional `catchErrors` on `@Tool(...)` and `@Bridge(...)` for stable fallback errors

Quick migration example:

```typescript
// Before
@Tool({ name: 'list_books', description: 'List books' })
async listBooks() {
  try {
    const books = await this.repo.list();
    return McpJson(books);
  } catch (error) {
    return McpError(`Failed to fetch books: ${String(error)}`);
  }
}

// After
@Tool({ name: 'list_books', description: 'List books', catchErrors: 'Failed to fetch books' })
async listBooks() {
  return await this.repo.list();
}
```

---

## Quick Start

### 1. Register the plugin

```typescript
// src/server.ts
import 'reflect-metadata';
import { Server } from 'najm-core';
import { mcp } from 'najm-mcp';
import * as features from './features';

export const server = new Server()
  .use(mcp({
    name: 'my-api',
    version: '1.0.0',
  }))
  .base('/api')
  .load(features);
```

### 2. Define tools

```typescript
// src/features/products/product.tools.ts
import { McpServer, Tool, Arg } from 'najm-mcp';
import { z } from 'zod';
import { ProductService } from './product.service';

@McpServer()
export class ProductTools {
  constructor(private svc: ProductService) {}

  @Tool({ name: 'get_product', description: 'Get a product by ID' })
  async getProduct(
    @Arg('id', z.string().uuid().describe('Product ID')) id: string,
  ) {
    return this.svc.findById(id);
  }
}
```

### 3. Export from barrel

```typescript
// src/features/products/index.ts
export { ProductController } from './product.controller';
export { ProductService }    from './product.service';
export { ProductTools }      from './product.tools'; // add this
```

### 4. Start server

```bash
bun run src/main.ts
```

Your MCP server is now live:
- `POST /api/mcp` — Streamable HTTP (Claude.ai, ChatGPT, Gemini)
- `GET  /api/mcp` — Server probe
- `GET  /api/mcp/tools` — Human-readable discovery

---

## Transports

Configure which transports to enable:

```typescript
.use(mcp({
  name: 'my-api',
  version: '1.0.0',
  transports: ['http', 'sse'], // default: ['http']
  path: '/mcp',                // default: '/mcp'
  cors: true,                  // default: true
}))
```

### Streamable HTTP (default)

Stateless. Works in serverless, Next.js, Vercel, and any runtime.

```
POST /mcp   ← Claude.ai, ChatGPT, Gemini
GET  /mcp   ← probe endpoint
GET  /mcp/tools ← discovery endpoint
```

### SSE (legacy, opt-in)

Persistent connection. Requires a long-lived server (Bun, Node.js). Not suitable for serverless.

```
GET  /mcp/sse       ← opens session (Claude Desktop, Cursor, Windsurf)
POST /mcp/messages  ← sends messages into session
```

### stdio (local dev, CLI)

For local LLM clients (Claude Desktop, Cursor). Runs as a separate process.

Create an entrypoint file in your project:

```typescript
// src/mcp.ts
import 'reflect-metadata';
import { serveMcpStdio } from 'najm-mcp';
import { server } from './server';

await serveMcpStdio(server);
```

---

## Connecting LLM Clients

### Claude Desktop

**SSE (local server):**
```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "my-api": {
      "url": "http://localhost:3000/mcp/sse"
    }
  }
}
```

**stdio (recommended for local dev):**
```json
{
  "mcpServers": {
    "my-api": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/src/mcp.ts"]
    }
  }
}
```

### Claude.ai (remote)

In Claude.ai → Settings → Integrations → Add MCP Server:
```
URL:    https://your-domain.com/mcp
Header: Authorization: Bearer <your-token>
```

### Cursor

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "my-api": {
      "url": "http://localhost:3000/mcp/sse"
    }
  }
}
```

### Windsurf

```json
// ~/.codeium/windsurf/mcp_config.json
{
  "mcpServers": {
    "my-api": {
      "serverUrl": "http://localhost:3000/mcp/sse"
    }
  }
}
```

### VS Code Copilot

```json
// .vscode/mcp.json
{
  "servers": {
    "my-api": {
      "type": "sse",
      "url": "http://localhost:3000/mcp/sse"
    }
  }
}
```

### Verify with MCP Inspector

```bash
# Streamable HTTP
npx @modelcontextprotocol/inspector http://localhost:3000/mcp

# SSE
npx @modelcontextprotocol/inspector sse http://localhost:3000/mcp/sse

# stdio
npx @modelcontextprotocol/inspector bun src/mcp.ts
```

---

## Next.js Integration

`najm-mcp` works inside the existing Najm + Next.js setup with **zero changes** to your route file.

```typescript
// src/server.ts
import 'reflect-metadata';
import { Server } from 'najm-core';
import { mcp } from 'najm-mcp';
import * as features from './features';

export const server = new Server()
  .use(mcp({
    name: 'my-api',
    version: '1.0.0',
    path: '/mcp',              // final route becomes /api/mcp with base('/api')
    transports: ['http'],      // stateless — serverless safe
  }))
  .base('/api')
  .load(features);

// app/api/[...route]/route.ts — unchanged
import { handle } from 'najm-core';
import { server } from '@/server';

export const GET    = handle(server);
export const POST   = handle(server);
export const PUT    = handle(server);
export const PATCH  = handle(server);
export const DELETE = handle(server);
```

```typescript
// next.config.ts
const nextConfig = {
  serverExternalPackages: ['reflect-metadata'],
};
```

MCP available at `POST /api/mcp` — works from Claude.ai, ChatGPT, and Gemini.

---

## API Reference

### `mcp(config)` — plugin factory

```typescript
import { mcp } from 'najm-mcp';

.use(mcp({
  name: string;       // required — shown in LLM client
  version: string;    // required — e.g. '1.0.0'
  path?: string;      // default: '/mcp'
  transports?: ('http' | 'sse' | 'stdio')[];  // default: ['http']
  cors?: boolean;     // default: true
  auth?: {
    type: 'bearer' | 'api-key';
    validate: (token: string) => boolean | Promise<boolean>;
  };
}))
```

---

### `@McpServer()` — class decorator

Marks a class as an MCP tool/resource/prompt provider.
Registers it in the DI container automatically — no need to also add `@Service()`.

```typescript
@McpServer()
export class WeatherTools {
  constructor(private weatherSvc: WeatherService) {} // DI works exactly like @Controller
}
```

---

### `@Tool(meta)` — method decorator

Exposes a method as an MCP tool.

Supports both forms:

```typescript
@Tool({
  name: string;        // tool identifier (snake_case recommended)
  description: string; // shown to the LLM
  catchErrors?: string; // optional fallback prefix for unexpected errors
})

@Tool('Get current weather for a city')
// name auto-derived from method name (camelCase -> snake_case)
```

```typescript
@Tool('Get current weather for a city')
async getWeather(
  @Arg('city', z.string().describe('City name')) city: string
) {
  return this.svc.fetch(city);
}
```

`catchErrors` is useful for converting unexpected throws into a stable error message:

```typescript
@Tool({ name: 'list_books', description: 'List books', catchErrors: 'Failed to fetch books' })
async listBooks() {
  return await this.repo.list();
}
// -> on unexpected throw: { isError: true, content: [{ type: 'text', text: 'Failed to fetch books: <details>' }] }
```

---

### `@ToolGroup(prefix)` — class decorator

Prefixes all tool names in a class to avoid collisions and improve grouping for LLMs.

```typescript
@McpServer()
@ToolGroup('orders')
class OrderTools {
  @Tool('Get order by ID')
  get(@Arg('id', z.string()) id: string) {}
  // -> registered as orders_get
}
```

---

### `@McpTool(meta)` — method decorator (object form)

`@McpTool` accepts either a string description or an object with description **and** behavioral hints. Prefer the object form when the tool is destructive, read-only, idempotent, or touches an open world (network, filesystem):

```typescript
// String form — most cases
@McpTool('Get a user')
async getUser(@Params('id') id: string) {}

// Object form — when hints matter
@McpTool({ description: 'Delete a user', destructive: true, idempotent: false })
async deleteUser(@Params('id') id: string) {}

@McpTool({ description: 'Search the web', readOnly: true, openWorld: true })
async search(@Body() body: { query: string }) {}

@McpTool({
  description: 'Delete a user',
  destructive: true,
  confirm: { level: 'danger', message: 'users.confirm.delete' },
})
async deleteUser(@Params('id') id: string) {}
```

| Field (authoring) | MCP wire field |
|---|---|
| `readOnly` | `readOnlyHint` |
| `destructive` | `destructive` |
| `idempotent` | `idempotent` |
| `openWorld` | `openWorldHint` |

`confirm` is Najm metadata, not MCP wire annotation. Use `confirm: true` for a default confirmation, or pass `{ level, message }`. `message` may be literal text or an i18n key resolved by the consumer using the active user language.

### `@Annotations(meta)` — method decorator (**deprecated**)

> **Deprecated** — use the object form of `@McpTool({ description, destructive, ... })` instead. Will be removed in the next minor.

```typescript
// old — still works through deprecation window
@McpTool('Delete a user')
@Annotations({ destructive: true, idempotent: false })
async deleteUser(@Params('id') id: string) {}
```

---

### `@Bridge(description, options?)` — method decorator

Exposes a `@Service()` method directly as a tool (no wrapper `@McpServer` class needed).

```typescript
import { Service } from 'najm-core';

@Service()
class ProductService {
  @Bridge('Search product catalog', { catchErrors: 'Search failed' })
  async search(@Arg('query', z.string()) query: string) {
    return this.repo.search(query);
  }
}
```

---

### `@Resource(meta)` — method decorator

Exposes content the LLM can read as a resource.

```typescript
@Resource({
  uri: string;          // supports templates: 'products://catalog/{category}'
  name: string;
  description?: string;
  mimeType?: string;    // default: 'application/json'
})
```

```typescript
@Resource({
  uri: 'docs://guide/{section}',
  name: 'API Guide',
  mimeType: 'text/markdown',
})
async getGuide(
  @Arg('section', z.string()) section: string,
) {
  return { content: await this.docs.getSection(section) };
}
```

---

### `@Prompt(meta)` — method decorator

Exposes a reusable prompt template.

```typescript
@Prompt({
  name: string;
  description?: string;
})
```

```typescript
@Prompt({
  name: 'review_code',
  description: 'Generate a code review prompt',
})
async reviewCode(
  @Arg('code', z.string())     code: string,
  @Arg('language', z.string()) lang: string,
) {
  return {
    messages: [{
      role: 'user' as const,
      content: {
        type: 'text',
        text: `Review this ${lang} code:\n\n${code}`,
      },
    }],
  };
}
```

---

### `@Arg(name, schema)` — parameter decorator

Defines a tool/resource/prompt argument with a Zod schema.

```typescript
@Arg(name: string, schema: z.ZodTypeAny)
```

```typescript
async myTool(
  @Arg('id',     z.string().uuid())                     id: string,
  @Arg('limit',  z.number().int().min(1).max(100))      limit: number,
  @Arg('filter', z.enum(['active', 'inactive']))        filter: string,
  @Arg('tags',   z.array(z.string()).optional())        tags?: string[],
) {}
```

Also available shorthand decorators:

```typescript
import { StringArg, NumberArg, BoolArg, EnumArg, IdArg, IntArg } from 'najm-mcp';

async search(
  @StringArg('query', 'Search query') query: string,
  @NumberArg('limit', 'Max results', { min: 1, max: 100, default: 10 }) limit: number,
  @BoolArg('inStock', 'Only in-stock', { optional: true }) inStock?: boolean,
  @EnumArg('sort', 'Sort order', ['asc', 'desc']) sort: 'asc' | 'desc',
  @IdArg('bookId', 'Book identifier') bookId: string,
  @IntArg('chapter', 'Chapter number', { min: 0 }) chapter: number,
) {}
```

---

### `@Validate(schema)` — DTO-style tool validation (recommended)

You can validate MCP tool input using the same `@Validate` decorator from `najm-validation`.
This avoids writing many `@Arg(...)` decorators and gives one DTO-style input object.

```typescript
import { Validate } from 'najm-validation';

const createOrderDto = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).default(1),
});

type CreateOrderDto = z.infer<typeof createOrderDto>;

@McpServer()
class OrderTools {
  @Tool('Create order')
  @Validate(createOrderDto)
  async createOrder(input: CreateOrderDto) {
    return { ok: true, input };
  }
}
```

Notes:
- `@Validate(schema)` and `@Validate({ body: schema })` are supported for MCP tools.
- `@Validate` cannot be combined with `@Arg(...)` on the same method.
- In MCP context, only body-style validation is supported.

---

### Automatic tool return serialization

Tool methods can return plain values directly. `najm-mcp` will normalize them into MCP tool results:

- `string` -> text content
- `object` / `array` -> pretty JSON text
- `null` / `undefined` -> `"OK"`
- `{ content: [...] }` (optionally with `isError`) -> passed through as-is

---

### `McpText`, `McpJson`, `McpResult`, `McpError`, `McpImage`, `McpList` — typed result helpers

```typescript
import { McpText, McpJson, McpResult, McpError, McpImage, McpList } from 'najm-mcp';

return McpText('ok');
return McpJson({ ok: true });
return McpResult({ success: true, message: 'saved' });
return McpError('Validation failed', { field: 'title' });
return McpImage(base64, 'image/png');
return McpList([McpText('summary'), McpJson(data)]);
```

---

### `McpException` — semantic tool errors

```typescript
import { McpException, McpErrorCode } from 'najm-mcp';

throw new McpException('User not found', McpErrorCode.NOT_FOUND);
```

---

### `GET /mcp/tools` — discovery endpoint

Lists registered tools, resources, prompts, and argument names.

```bash
curl http://localhost:3000/mcp/tools
```

> **Discovery is gated by `config.auth` only.** When you configure `auth`, the
> auth middleware covers `GET /mcp` and `GET /mcp/tools`, so tool names,
> descriptions, and argument shapes require a valid token. When you rely on the
> najm-auth Bearer fallback (no `config.auth`), discovery is **unauthenticated**
> — tool metadata is public even though tool *execution* still resolves auth.
> If your tool names/descriptions are sensitive, set `config.auth`.

---

### `serveMcpStdio(server, options?)` — stdio entrypoint

Starts an MCP server over stdio for use with Claude Desktop, Cursor, and other local clients.
Boots the Najm DI container without starting an HTTP server.

```typescript
// src/mcp.ts
import 'reflect-metadata';
import { serveMcpStdio } from 'najm-mcp';
import { server } from './server';

await serveMcpStdio(server, {
  onError: (error) => {
    console.error(error);
  },
});
```

---

## Zero Duplication — REST + MCP from the same service

The key feature of `najm-mcp` is that `@McpServer()` classes share the same DI container
as `@Controller()` classes. The same service instance powers both.

```typescript
// product.service.ts — written once
@Service()
export class ProductService {
  async search(query: string, limit: number) {
    return this.repo.search(query, limit);
  }
}

// product.controller.ts — REST
@Controller('/products')
export class ProductController {
  constructor(private svc: ProductService) {}

  @Get('/search')
  search(@Query('q') q: string) {
    return this.svc.search(q, 10);
  }
}

// product.tools.ts — MCP
@McpServer()
export class ProductTools {
  constructor(private svc: ProductService) {} // same singleton

  @Tool({ name: 'search_products', description: 'Search the product catalog' })
  async search(
    @Arg('query', z.string()) query: string,
    @Arg('limit', z.number().default(10)) limit: number,
  ) {
    return this.svc.search(query, limit); // same method
  }
}
```

---

## Authentication

Protect your MCP endpoints with bearer tokens or API keys:

```typescript
.use(mcp({
  name: 'my-api',
  version: '1.0.0',
  auth: {
    type: 'bearer', // or 'api-key' (reads x-api-key header)
    validate: async (token) => {
      return token === process.env.MCP_SECRET;
      // or verify JWT, check database, etc.
    },
  },
}))
```

> ⚠️ **The built-in `oauth` option mounts a DEV-ONLY stub.** It authenticates
> *nobody* (any visitor who clicks "Allow" gets a code) and exchanges codes for
> a single static token. It is intended for local development against MCP
> clients that require an OAuth flow. It **refuses to mount when
> `NODE_ENV=production`** unless you explicitly set `oauth: { unsafeDevStub:
> true }` (do not). For real deployments use a proper OAuth provider (Auth0,
> Keycloak, …) or the `najm-auth` plugin with JWT.

---

## Full Example

```typescript
import 'reflect-metadata';
import { Server, Service } from 'najm-core';
import { mcp, McpServer, Tool, Resource, Prompt, Arg } from 'najm-mcp';
import { z } from 'zod';

// ─── Service (shared with REST) ───────────────────────────────────────────────
@Service()
class WeatherService {
  async getCurrent(city: string) {
    return { city, temp: 22, condition: 'sunny' };
  }

  async getForecast(city: string, days: number) {
    return Array.from({ length: days }, (_, i) => ({
      day: i + 1, temp: 20 + i, condition: 'clear',
    }));
  }
}

// ─── MCP Tools ────────────────────────────────────────────────────────────────
@McpServer()
class WeatherTools {
  constructor(private svc: WeatherService) {}

  @Tool({ name: 'get_weather', description: 'Get current weather for a city' })
  async getWeather(
    @Arg('city', z.string().describe('City name')) city: string,
  ) {
    return this.svc.getCurrent(city);
  }

  @Tool({ name: 'get_forecast', description: 'Get weather forecast' })
  async getForecast(
    @Arg('city', z.string())                                       city: string,
    @Arg('days', z.number().int().min(1).max(7).default(3))        days: number,
  ) {
    return this.svc.getForecast(city, days);
  }

  @Resource({
    uri: 'weather://cities/{region}',
    name: 'City List',
    mimeType: 'application/json',
  })
  async getCities(
    @Arg('region', z.string()) region: string,
  ) {
    return { content: ['London', 'Paris', 'Tokyo'].filter(c => c.startsWith(region)) };
  }

  @Prompt({ name: 'weather_report', description: 'Generate a weather report prompt' })
  async weatherReport(
    @Arg('city', z.string()) city: string,
  ) {
    return {
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text',
          text: `Write a friendly weather report for ${city} based on the current conditions.`,
        },
      }],
    };
  }
}

// ─── Server ───────────────────────────────────────────────────────────────────
await new Server()
  .use(mcp({
    name: 'weather-api',
    version: '1.0.0',
    transports: ['http', 'sse'],
  }))
  .load(WeatherService, WeatherTools)
  .listen(3000);
```

---

## License

MIT

---

<div align="center">
Built on <a href="https://hono.dev">Hono</a> · Powered by <a href="https://modelcontextprotocol.io">MCP</a> · Part of the <a href="https://github.com/hichamjaberadev/najm">Najm</a> ecosystem
</div>
