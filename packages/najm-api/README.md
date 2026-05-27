# Najm Framework 🚀

A modern, modular TypeScript framework for building scalable APIs with decorators, dependency injection, and plugin architecture.

**Najm** is built on [Hono.js](https://hono.dev/) and uses [diject](https://www.npmjs.com/package/diject) for dependency injection. It provides a powerful decorator-driven development experience with first-class support for transactions, events, guards, i18n, and more.

## ✨ Key Features

- 🎯 **Decorator-Driven** - Clean, declarative API with TypeScript decorators
- 🔌 **Modular Plugin System** - Install only what you need
- 💉 **Powerful DI Container** - Advanced dependency injection with scopes (via [diject](https://www.npmjs.com/package/diject))
- 🛡️ **Guards & Security** - Function and class-based route protection
- 💾 **Transaction Management** - Automatic transactions with retry logic
- 📡 **Event System** - Built-in event emitter with decorator support
- 🌐 **i18n Support** - Multi-language with automatic detection
- 🍪 **Cookie Management** - Secure cookie handling
- 🔄 **CORS Configuration** - Flexible CORS setup
- 📝 **Built-in Logging** - Structured logging with request ID tracking
- 🌱 **Database Seeding** - Idempotent seeding with conflict resolution

## 📦 Installation

### Core Framework

```bash
# Core framework (required)
bun add najm diject hono reflect-metadata

# npm / yarn
npm install najm diject hono reflect-metadata
```

### Plugins

**Auto-registered plugins (included, no need to install separately):**
- `najm-middleware` - Middleware management
- `najm-params` - Parameter resolution
- `najm-router` - HTTP routing

**Optional plugins (install as needed):**

```bash
# Authorization
bun add najm-guard

# Database & Transactions
bun add najm-database

# Event System
bun add najm-event

# CORS
bun add najm-cors

# Cookie Management
bun add najm-cookies

# Internationalization
bun add najm-i18n

# Install all optional plugins
bun add najm-guard najm-database najm-event najm-cors najm-cookies najm-i18n
```

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
import "reflect-metadata";
```

## 🚀 Quick Start

### Basic Server

```typescript
import "reflect-metadata";
import { Server } from "najm";
import { Service, Controller } from "diject";
import { Get, Post } from "najm-router";
import { Body, Params } from "najm-params";

@Service()
class UserService {
  getUsers() {
    return [{ id: 1, name: "John" }, { id: 2, name: "Jane" }];
  }
}

@Controller("/users")
class UserController {
  constructor(private userService: UserService) {}

  @Get("/")
  getUsers() {
    return this.userService.getUsers();
  }

  @Get("/:id")
  getUser(@Params("id") id: string) {
    return { id, name: "User " + id };
  }

  @Post("/")
  createUser(@Body() data: any) {
    return { created: true, ...data };
  }
}

// One-line server creation and startup
await new Server()
  .load(UserController, UserService)
  .log("🚀 Server starting on port 3000")
  .listen(3000);
```

### Full-Featured Server

```typescript
import "reflect-metadata";
import { Server } from "najm";
import { Service, Controller, Repository } from "diject";
import { guards } from "najm-guard";
import { database } from "najm-database";
import { events } from "najm-event";
import { cors } from "najm-cors";
import { cookies } from "najm-cookies";
import { i18n } from "najm-i18n";

// One-line server creation with plugins and auto-scanning
await new Server()
  .use(cors({ origin: "*" }))
  .use(database({ default: myDb }))
  .use(i18n({ translations: { en, fr } }))
  .use(guards())
  .use(events())
  .base("/api")
  .scan("./src/features")                      // Auto-discover controllers
  .log("✅ Plugins configured")
  .log("🚀 Starting server...")
  .listen(3000);

// Alternative: Manual loading instead of .scan()
// .load(UserController, UserService, UserRepository, AuthGuard)
```

### Next.js Integration

Najm works as an API backend inside Next.js App Router using a catch-all route.

**1. Configure `next.config.ts`:**

`reflect-metadata` and native database drivers must be externalized from the Next.js bundle:

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['reflect-metadata', 'better-sqlite3'],
};

export default nextConfig;
```

**2. Create a shared server instance:**

Use `.load()` with barrel imports instead of `.scan()` — bundlers can't resolve dynamic filesystem imports.

```typescript
// src/server.ts
import 'reflect-metadata';
import { Server } from 'najm';
import { database } from 'najm-database';
import * as features from './features';

export const server = new Server()
  .use(database({ default: db }))
  .base('/api')
  .load(features);
```

**3. Create the catch-all API route:**

```typescript
// app/api/[...route]/route.ts
import { handle } from 'najm';
import { server } from '@/server';

export const GET = handle(server);
export const POST = handle(server);
export const PUT = handle(server);
export const PATCH = handle(server);
export const DELETE = handle(server);
```

`handle()` wraps `server.fetch` for Next.js route handlers. The server auto-initializes on the first request.

| | Standalone (Bun) | Next.js |
|---|---|---|
| Entry point | `server.listen(3000)` | `handle(server)` in catch-all route |
| Class discovery | `.scan('./src/features')` | `.load(featuresModule)` with barrel imports |
| Config | None | `serverExternalPackages` in `next.config.ts` |

## 📖 Core Concepts

### Server API

```typescript
// Constructor
const server = new Server(opts?)  // Optional config: { app, port, isolated, ... }

// Chainable methods
server.use(plugin)                 // Register plugin
server.load(...classes)            // Register app classes
server.scan(path)                  // Scan directories for classes (e.g., './src/features')
server.base(path)                  // Set base path prefix
server.middleware(...handlers)     // Add middleware handlers
server.set(key, value)             // Set server options
server.log(...messages)            // Log messages (chainable)
await server.listen(port, cb?)     // Start server (returns this)
await server.init()                // Initialize without listening (for seeding, testing)

// Serverless
const handler = server.fetch       // Auto-initializes, returns fetch handler

// State management
server.isRunning                   // boolean - Server running state
await server.stop()                // Stop the server gracefully
```

**Default plugins (auto-registered):**
- `middleware()` - Middleware management
- `params()` - Parameter resolution
- `router()` - HTTP routing

**Optional plugins (must be explicitly registered):**
- `guards()`, `database()`, `events()`, `cors()`, `cookies()`, `i18n()`, `auth()`, etc.

### Dependency Injection

Najm uses [diject](https://www.npmjs.com/package/diject) - a standalone, framework-agnostic dependency injection container with decorators, scopes (SINGLETON, REQUEST, TRANSIENT), and AsyncLocalStorage support.

```typescript
import { Service, Controller, Injectable } from "diject";

// Singleton service (default)
@Service()
class ConfigService {
  getConfig() { return { apiUrl: "..." }; }
}

// Controller
@Controller("/api")
class ApiController {
  constructor(private config: ConfigService) {}
}

// Generic injectable
@Injectable()
class MyComponent {}
```

### HTTP Routing

```typescript
import { Controller } from "diject";
import { Get, Post, Put, Patch, Delete } from "najm-router";

@Controller("/api/users")
class UserController {
  @Get("/")              // GET /api/users
  getAll() { return []; }

  @Get("/:id")           // GET /api/users/:id
  getById() { return {}; }

  @Post("/")             // POST /api/users
  create() { return {}; }

  @Put("/:id")           // PUT /api/users/:id
  update() { return {}; }

  @Patch("/:id")         // PATCH /api/users/:id
  patch() { return {}; }

  @Delete("/:id")        // DELETE /api/users/:id
  remove() { return {}; }
}
```

### Parameter Decorators

```typescript
import { Body, Params, Query, Headers, Ctx, Cookie } from "najm-params";

@Controller("/api")
class DataController {
  @Get("/users/:id")
  getUser(
    @Params("id") id: string,              // URL parameter
    @Query("page") page: string,           // Query parameter
    @Headers("authorization") auth: string, // Header
    @Cookie("session") session: string,    // Cookie
    @Body() body: any,                     // Request body
    @Ctx() ctx: any                        // Hono context
  ) {
    return { id, page, auth, session };
  }
}
```

Available parameter decorators:
- **Body**: `@Body()`, `@JsonBody()`, `@TextBody()`, `@FormData()`
- **URL/Route**: `@Params()`, `@Query()`, `@Queries()`, `@Path()`, `@Url()`, `@Method()`
- **Headers**: `@Headers()`, `@ContentType()`, `@Origin()`, `@Referer()`, `@Language()`
- **Context**: `@Ctx()`, `@Req()`, `@Cookie()`, `@File()`, `@IP()`
- **Guard Data**: `@User()`, `@Owner()`, `@Info()`, `@Data()`, `@Filter()`

### Guards & Authorization

```typescript
import { Service, Container, DI } from "diject";
import { Guards } from "najm-guard";
import { Headers } from "najm-params";
import { USER } from "najm-guard";

// Function guard
const authGuard = async (headers, cookie, context) => {
  const token = headers("authorization");
  if (!token) throw new Error("Unauthorized");
  return { userId: "123" };  // Available via @GuardParams
};

// Class guard
@Service()
class RoleGuard {
  @DI() container!: Container;

  async canActivate(@Headers("authorization") token: string) {
    const user = await this.verifyToken(token);
    this.container.set(USER, user);  // Set ALS token
    return true;
  }
}

@Controller("/admin")
@Guards(authGuard, RoleGuard)  // Controller-level
class AdminController {
  @Get("/users")
  @Guards(adminOnlyGuard)      // Method-level
  getUsers(@User() user: any) {
    return { users: [], currentUser: user };
  }
}
```

### Database & Transactions

```typescript
import { Repository, Service } from "diject";
import { DB, Transaction } from "najm-database";

@Repository("postgres")
class UserRepository {
  @DB("postgres") db: any;  // Auto-injected with transaction awareness

  async findById(id: string) {
    return this.db.query("SELECT * FROM users WHERE id = ?", [id]);
  }

  async create(data: any) {
    return this.db.query("INSERT INTO users ...", [data]);
  }
}

@Service()
class OrderService {
  constructor(
    private orderRepo: OrderRepository,
    private inventoryRepo: InventoryRepository
  ) {}

  @Transaction({ retries: 2 })  // Auto retry on deadlock
  async createOrder(data: any) {
    // All DB operations use same transaction
    const order = await this.orderRepo.create(data);
    await this.inventoryRepo.decrementStock(data.items);
    return order;
  }
}
```

### Event System

```typescript
import { Service } from "diject";
import { Events, On } from "najm-event";

@Service()
class UserService {
  @Events() events: { emit, on, off };

  async createUser(data: any) {
    const user = await this.repo.create(data);
    this.events.emit("user.created", { userId: user.id });
    return user;
  }
}

@Service()
class EmailService {
  @On("user.created")  // Auto-registered as event listener
  async sendWelcome({ userId }: { userId: string }) {
    console.log(`Sending welcome email to user ${userId}`);
  }
}
```

### Validation & DTOs

Najm uses Zod-based DTOs (Data Transfer Objects) for request validation via the `najm-validation` plugin. DTOs define the expected shape and constraints of incoming data, while Validators handle async business rules.

```typescript
import { z } from "zod";

// Define a DTO with Zod
export const createProductDto = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  price: z.number().positive("Price must be positive"),
  category: z.string().optional(),
});

export const updateProductDto = createProductDto.partial();

export const productIdParam = z.object({
  id: z.string().length(5, "Product ID must be 5 characters"),
});

// Infer TypeScript types from schemas
export type CreateProductDto = z.infer<typeof createProductDto>;
export type UpdateProductDto = z.infer<typeof updateProductDto>;
```

Use `@Validate()` in controllers to auto-validate requests:

```typescript
import { Controller, Post, Patch } from "najm-router";
import { Validate } from "najm-validation";
import { Body, Params } from "najm-params";
import { createProductDto, updateProductDto, productIdParam } from "./product.dto";

@Controller("/products")
class ProductController {
  @Post("/")
  @Validate(createProductDto)                                    // Validates body
  create(@Body() data: CreateProductDto) {
    return this.service.create(data);
  }

  @Patch("/:id")
  @Validate({ params: productIdParam, body: updateProductDto })  // Validates params + body
  update(@Params("id") id: string, @Body() data: UpdateProductDto) {
    return this.service.update(id, data);
  }
}
```

**Validation flow:**
1. `@Validate(dto)` - Schema validation (format, length, type) → 400 if invalid
2. `Validator.check()` - Business validation (unique, exists) → 404/409/403 if invalid
3. `Service.execute()` - Business logic

### Internationalization

```typescript
import { Controller, Service } from "diject";
import { I18n } from "najm-i18n";
import { Get, Query } from "najm-router";

@Controller("/api")
class ApiController {
  @I18n() t: any;  // Translation function

  @Get("/greeting")
  getGreeting(@Query("name") name: string) {
    return {
      message: this.t("welcome", { name }),
      lang: this.t.getCurrentLanguage()
    };
  }
}

@Service()
class NotificationService {
  @I18n("errors") t: any;  // With prefix

  sendError() {
    return this.t("notFound");  // Translates "errors.notFound"
  }
}
```

### Logging

Najm includes a built-in logging system with support for different log levels, formats, and request ID tracking.

```typescript
import { Service } from "diject";
import { Log } from "najm";

@Service()
class UserService {
  @Log() logger!: LoggerService;  // Property injection

  async createUser(data: any) {
    this.logger.info("Creating user", { email: data.email });

    try {
      const user = await this.repo.create(data);
      this.logger.debug("User created successfully", { userId: user.id });
      return user;
    } catch (error) {
      this.logger.error("Failed to create user", error, { email: data.email });
      throw error;
    }
  }
}

// Server-level logging (chainable)
const server = new Server()
  .log("🚀 Starting server...")
  .use(database({ default: db }))
  .log("✅ Database configured")
  .load(UserController, UserService);

await server.listen(3000);
```

**Log Levels:** `DEBUG`, `INFO`, `WARN`, `ERROR`, `SILENT`

**Configuration:**
```typescript
const server = new Server({
  logger: {
    level: 'INFO',
    format: 'pretty',  // or 'json' for production
    includeTimestamp: true,
    includeRequestId: true,
    colors: true,
  }
});
```

### Database Seeding

Najm provides a powerful seeding system via `SeedService` from `najm-database`.

```typescript
import { Server } from "najm";
import { SeedService } from "najm-database";
import { authSeed } from "najm-auth";  // Pre-built auth seeding helper
import { database } from "najm-database";

const server = await new Server({ isolated: true })
  .use(database({ default: db }))
  .scan('./src/features')
  .log("🌱 Seeding database...")
  .init();  // Initialize without listening

const seeder = server.container.get(SeedService);

const report = await seeder.run(
  {
    // Auth plugin provides authSeed helper
    ...authSeed({
      adminEmail: 'admin@example.com',
      adminPass: 'Admin123!',
      roles: [
        { name: 'admin', description: 'Administrator' },
        { name: 'user', description: 'Regular user' },
      ],
      permissions: [
        { action: 'create', resource: 'posts', name: 'create:posts' },
        { action: 'read', resource: 'posts', name: 'read:posts' },
      ],
    }),

    // Custom table seeding
    products: {
      by: ['id'],  // Unique key for conflict resolution
      rows: [
        { id: '1', name: 'Product 1', price: 99.99 },
        { id: '2', name: 'Product 2', price: 149.99 },
      ],
    },
  },
  {
    verbose: true,
    onConflict: 'skip',  // or 'update'
    transaction: false,
  }
);

server
  .log(`✅ Seed complete`)
  .log(`📊 Total operations: ${report.items.length}`)
  .log('📝 Test user: admin@example.com / Admin123!');

await server.stop();
```

**Benefits:**
- Idempotent seeding (safe to run multiple times)
- Conflict resolution strategies (`skip`, `update`)
- Dependency-aware (seed users before products that reference them)
- Built-in auth seeding with `authSeed()`

## 🏗️ Project Structure

### Packages

```
packages/
├── najm/                 # Public-facing framework package (this package)
├── najm-core/            # Framework core & orchestration
├── najm-guard/           # Authorization plugin (optional)
├── najm-database/        # Database & transactions plugin (optional)
├── najm-event/           # Event system plugin (optional)
├── najm-cors/            # CORS handling plugin (optional)
├── najm-cookies/         # Cookie management plugin (optional)
├── najm-i18n/            # Internationalization plugin (optional)
├── najm-auth/            # Authentication plugin (optional)
├── najm-validation/      # Validation plugin (optional)
├── najm-rate/            # Rate limiting plugin (optional)
├── najm-email/           # Email service plugin (optional)
└── najm-cache/           # Cache management plugin (optional)
```

**Note:** Dependency injection is provided by [diject](https://www.npmjs.com/package/diject), an external standalone package.

### Application Structure (Recommended)

**Feature-based structure** (recommended for scalability):

```
src/
├── config/                # Plugin configurations
│   ├── database.ts        # Database plugin config
│   ├── auth.ts            # Auth plugin config
│   └── plugins.ts         # Export all configs
├── features/              # Feature modules (auto-discovered by .scan())
│   ├── user/
│   │   ├── user.controller.ts
│   │   ├── user.dto.ts        # Zod validation schemas + inferred types
│   │   ├── user.validator.ts  # Business validation (uniqueness, existence)
│   │   ├── user.service.ts
│   │   ├── user.repository.ts
│   │   └── index.ts
│   └── product/
│       ├── product.controller.ts
│       ├── product.dto.ts
│       ├── product.service.ts
│       └── index.ts
├── database/              # Centralized database schema & setup
│   ├── schema.ts          # All table definitions (+ authSchema if using najm-auth)
│   └── seed.ts            # Seeding script
├── listeners/             # Event listeners
│   └── user.listener.ts
├── locales/               # i18n translations
│   ├── en.ts
│   └── fr.ts
└── main.ts                # Server entry point
```

**Example `main.ts`:**

```typescript
import 'reflect-metadata';
import { Server } from 'najm';
import {
  databaseConfig,
  authConfig,
  corsConfig,
  i18nConfig
} from './config/plugins';
import { ProductListener } from './listeners';

const PORT = Number.parseInt(process.env.PORT || '3000', 10);

await new Server()
  .use(corsConfig())
  .use(databaseConfig())
  .use(i18nConfig())
  .use(authConfig())
  .base('/api')
  .scan('./src/features')              // Auto-discover all controllers
  .load(ProductListener)                // Manual registration when needed
  .log('✅ Server configured')
  .log(`🚀 Starting on port ${PORT}`)
  .listen(PORT);
```

## 🔌 Creating Custom Plugins

Najm provides a fluent API for creating plugins using the `plugin()` builder:

```typescript
import { plugin, Meta, Service, Inject } from "najm";

// Define plugin token
export const MY_PLUGIN_CONFIG = Symbol("MY_PLUGIN_CONFIG");

// Create service
@Service()
@Meta({ layer: "plugin", order: 20 })
class MyPluginService {
  @Inject(MY_PLUGIN_CONFIG) config: any;

  async scan() {
    // Read decorators, push to INJECTIONS
  }

  async configure() {
    // Setup connections, register injectors
  }

  async activate() {
    // Wire to app
  }

  async onReady() {
    // Post-boot actions
  }
}

// Create plugin factory using fluent API
export const myPlugin = (config?: any) =>
  plugin("my-plugin")
    .version("1.0.0")
    .services(MyPluginService)
    .config(MY_PLUGIN_CONFIG, config ?? {})
    .build();

// Advanced plugin with dependencies and contributions
export const advancedPlugin = (config?: any) =>
  plugin("advanced-plugin")
    .version("2.0.0")
    .depends(otherPlugin())        // Auto-registered dependencies
    .requires("database")           // Required dependencies (user must register)
    .contributes(TOKEN, value)      // Contribute to other plugins
    .services(PluginService)
    .config(PLUGIN_CONFIG, config)
    .set(EXTRA_TOKEN, extraValue)  // Additional tokens
    .build();

// Usage
const server = new Server()
  .use(myPlugin({ option: "value" }))
  .load(AppController);
```

## 📚 Complete Example

```typescript
import "reflect-metadata";
import { Server } from "najm";
import { Service, Controller, Repository, DI, Container } from "diject";
import { guards } from "najm-guard";
import { database } from "najm-database";
import { events } from "najm-event";
import { Get, Post, Body, Params, Headers } from "najm-router";
import { Guards } from "najm-guard";
import { DB, Transaction } from "najm-database";
import { Events, On } from "najm-event";
import { USER } from "najm-guard";

// Repository
@Repository("postgres")
class UserRepository {
  @DB("postgres") db: any;

  async findById(id: string) {
    return this.db.query("SELECT * FROM users WHERE id = ?", [id]);
  }

  async create(data: any) {
    return this.db.query("INSERT INTO users VALUES (?)", [data]);
  }
}

// Service
@Service()
class UserService {
  constructor(private repo: UserRepository) {}

  @Events() events: any;

  @Transaction({ retries: 2 })
  async createUser(data: any) {
    const user = await this.repo.create(data);
    this.events.emit("user.created", { userId: user.id });
    return user;
  }
}

// Guard
@Service()
class AuthGuard {
  @DI() container!: Container;

  async canActivate(@Headers("authorization") token: string) {
    const user = await this.verifyToken(token);
    this.container.set(USER, user);
    return true;
  }
}

// Event listener
@Service()
class EmailService {
  @On("user.created")
  async sendWelcome({ userId }: any) {
    console.log(`Welcome email sent to user ${userId}`);
  }
}

// Controller
@Controller("/api/users")
@Guards(AuthGuard)
class UserController {
  constructor(private userService: UserService) {}

  @Get("/:id")
  async getUser(@Params("id") id: string) {
    return this.userService.findById(id);
  }

  @Post("/")
  async createUser(@Body() data: any) {
    return this.userService.createUser(data);
  }
}

// Server - one-line creation with all components
await new Server()
  .use(database({ default: postgresDb }))
  .use(guards())
  .use(events())
  .load(UserController, UserService, UserRepository, AuthGuard, EmailService)
  .log("✅ All services loaded")
  .log("🚀 Server starting...")
  .listen(3000);
```

## 🧪 Testing

```typescript
import { describe, test, expect, afterEach } from "bun:test";
import { Server } from "najm";
import { Controller } from "diject";
import { Get } from "najm-router";

let server: Server;
afterEach(async () => { await server?.stop(); });

test("should handle GET request", async () => {
  @Controller("/test")
  class TestController {
    @Get("/") get() { return { ok: true }; }
  }

  server = await new Server({ isolated: true })
    .load(TestController)
    .listen(3100);

  const res = await fetch("http://localhost:3100/test");
  expect(await res.json()).toEqual({ ok: true });
});
```

## 📖 Documentation

### Getting Started
- 📘 **[Full Documentation](https://najm.dev)** - Complete guides, tutorials, and API reference
- 🚀 **[Quick Start](https://najm.dev/docs/quick-start)** - Build your first API in 5 minutes
- 📦 **[Installation Guide](https://najm.dev/docs/installation)** - Setup and configuration

### Architecture
- [Server Guide](https://github.com/hichamjaberadev/najm/blob/master/packages/najm-core/docs/Server.md) - Complete server API reference
- [Architecture Guide](https://github.com/hichamjaberadev/najm/blob/master/packages/najm-core/docs/ARCHITECTURE.md) - Internal architecture reference
- [Boot System](https://github.com/hichamjaberadev/najm/blob/master/packages/najm-core/docs/BOOT_SERVICE.md) - Boot system deep dive

### Core Concepts
- [Dependency Injection](https://najm.dev/docs/core/di) - Learn about diject DI container
- [Plugin Architecture](https://najm.dev/docs/core/plugin-architecture) - Building custom plugins
- [HTTP Pipeline](https://najm.dev/docs/core/http-pipeline) - Request/response flow

### Plugins
- [Router](https://najm.dev/docs/plugins/router) - HTTP routing
- [Guards](https://najm.dev/docs/plugins/guards) - Authorization
- [Params](https://najm.dev/docs/plugins/params) - Parameter resolution (40+ decorators)
- [Database](https://najm.dev/docs/plugins/database) - Database & transactions
- [Events](https://najm.dev/docs/plugins/events) - Event system
- [i18n](https://najm.dev/docs/plugins/i18n) - Internationalization
- [Auth](https://najm.dev/docs/security/auth) - Authentication (JWT, RBAC, PBAC)
- [Validation](https://najm.dev/docs/routing/validation) - Request validation
- [Rate Limiting](https://najm.dev/docs/security/rate-limit) - Rate limiting

## 🤝 Contributing

Contributions are welcome! Please submit a Pull Request.

## 📝 License

MIT License

## 🙏 Acknowledgments

Najm is built on top of excellent open-source projects:

- **[Hono](https://hono.dev/)** - The ultrafast web framework for the Edges
- **[diject](https://www.npmjs.com/package/diject)** - Standalone dependency injection container (originally developed for Najm, now maintained as an independent package)
- **[mitt](https://github.com/developit/mitt)** - Tiny functional event emitter
