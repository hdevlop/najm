# Najm + Next.js Playground

This project is a full reference for running Najm inside Next.js App Router.
It shows real modules (products, cart, orders), auth/RBAC/PBAC, database wiring, and clean service architecture.

If you want to build an API with Najm and expose it through Next.js routes, this README is the step-by-step template.

## What this playground demonstrates

- Next.js App Router API endpoint delegation to Najm (`handle(server)`)
- One shared Najm `Server` instance reused by all API methods
- Plugin wiring: `database`, `auth`, `i18n`, `validation`, `rateLimit`, `events`, `cors`, `mcp`, `chatbot`, `whatsapp`
- Chatbot RAG / tool routing config in [src/server/config/chatbot/](src/server/config/chatbot/) (`routing.json`, `semantics.json`, `routing-test-cases.json`) — scaffolded by `bunx najm-cli rag:init`, refreshed by `bunx najm-cli rag:scan`. See [../../CHATBOT_RAG_README.md](../../CHATBOT_RAG_README.md) for the workflow.
- Feature modules with clear boundaries (`Controller`, `Service`, `Repository`, `Validator`, `Dto`, `Schema`)
- Clean rule: services orchestrate; validators handle domain errors
- SQLite + Drizzle setup with `najm-auth` schema composition

## How Najm works inside Next.js

The integration pattern in this playground is:

1. Build one Najm server in `src/server.ts`
2. Register plugins and load module exports via `.load(...)`
3. Expose Next route handlers in `app/api/[...route]/route.ts` using `handle(server)`

Request flow:

```text
HTTP request -> Next route handler -> handle(server) -> Najm plugins/middleware/guards -> Controller -> Response
```

## Quick start (Next.js mode)

From repository root:

```bash
bun install
bun run --cwd apps/playground db:generate
bun run --cwd apps/playground db:migrate
bun run --cwd apps/playground db:seed
bun run --cwd apps/playground dev:next
```

Then open:

- App UI: `http://localhost:3000`
- API base: `http://localhost:3000/api`

## Environment setup

Create `apps/playground/.env` with values like:

```env
PORT=3000
DATABASE_URL=./playground.db

JWT_ACCESS_SECRET=replace-with-secure-random-string
JWT_REFRESH_SECRET=replace-with-secure-random-string
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:5173
EMAIL_PROVIDER=console

# Optional Google sign-in (enables automatically when both are present)
GOOGLE_CLIENT_ID=<google-web-client-id>
GOOGLE_CLIENT_SECRET=<google-web-client-secret>
# Only needed when the API callback is not FRONTEND_URL/api/auth/oauth/google/callback
GOOGLE_CALLBACK_URL=https://app.example.com/api/auth/oauth/google/callback
```

Notes:

- `DATABASE_URL` is the SQLite file path used by Drizzle.
- `PORT` can be a string; Najm now parses it internally in `server.listen(...)`.
- `EMAIL_PROVIDER=console` is useful for local auth/password-reset flows.
- Google login is enabled when both Google credential variables are set.

## MCP support (HTTP + stdio)

This playground also exposes MCP through the Najm MCP plugin.

- HTTP endpoint: `POST /api/mcp` (plus `GET /api/mcp` probe)
- MCP tools now come directly from backend controllers in `src/server/modules/*Controller.ts`
- Example tool names include `health_check`, `products_get_all`, `cart_get_my_cart`, `orders_get_my_orders`, and `orders_update_status`

HTTP auth behavior:

- Controller-backed MCP tools reuse the same auth pipeline as HTTP routes, so send `Authorization: Bearer <access-token>` from the normal auth flow
- The same `@Can*()`, `@Policy(...)`, `@User()`, `@Params()`, and `@Body()` behavior now works in both HTTP and MCP for those controller methods

Run stdio transport (for local MCP clients like Claude Desktop/Cursor):

```bash
bun run --cwd apps/playground start:mcp:stdio
```

## Core files to copy in your own Next app

### 1) Create the Najm server

`src/server.ts`

```ts
import { Server } from 'najm-core';
import {
  databaseConfig,
  authConfig,
  corsConfig,
  i18nConfig,
  eventsConfig,
  validationConfig,
  rateLimitConfig,
} from './config/plugins';

import * as modulesModule from './modules';
import * as listenersModule from './listeners';

export const server = new Server()
  .use(corsConfig())
  .use(databaseConfig())
  .use(i18nConfig())
  .use(validationConfig())
  .use(rateLimitConfig())
  .use(eventsConfig())
  .use(authConfig())
  .base('/api')
  .load(modulesModule, listenersModule);
```

Important:

- Register `database` before `auth` (auth depends on DB).
- Use `.load(moduleObject)` with barrel exports in Next.js/bundled environments.
- Do not rely on dynamic filesystem scanning (`.scan(...)`) in Next.js.

### 2) Bridge Next handlers to Najm

`app/api/[...route]/route.ts`

```ts
import { handle } from 'najm-core';
import { server } from '../../../src/server';

export const GET = handle(server);
export const POST = handle(server);
export const PUT = handle(server);
export const PATCH = handle(server);
export const DELETE = handle(server);
```

### 3) Keep server-only packages external in Next

`next.config.ts`

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['reflect-metadata', 'better-sqlite3'],
};

export default nextConfig;
```

## Database and schema setup

This playground uses SQLite + Drizzle + Najm auth schema composition.

`src/database/schema.ts` composes auth + app tables:

```ts
import { authSchema } from 'najm-auth/sqlite';
import { cartItemsTable } from '../modules/cart/CartSchema';
import { orderItemsTable, ordersTable } from '../modules/order/OrderSchema';
import { productsTable } from '../modules/product/ProductSchema';

export const schema = {
  ...authSchema,
  products: productsTable,
  orders: ordersTable,
  orderItems: orderItemsTable,
  cartItems: cartItemsTable,
};
```

`src/config/database.ts` creates one shared DB connection:

```ts
import { database } from 'najm-database';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { schema } from '../database/schema';

const sqlite = new Database(process.env.DATABASE_URL || './playground.db');
const db = drizzle(sqlite, { schema });

export const databaseConfig = () => database({ default: db });
```

## Module contract (what each file owns)

Every module in this playground follows the same contract. Write new modules with the same boundaries.

```text
module/
  ModuleSchema.ts
  ModuleDto.ts
  ModuleValidator.ts
  ModuleRepository.ts
  ModuleService.ts
  ModuleController.ts
  index.ts
```

### `ModuleSchema.ts` (database model only)

Responsibilities:

- Define Drizzle tables and columns.
- Export DB types from schema (`$inferSelect`, `$inferInsert`).
- Keep persistence concerns only (column names, defaults, timestamps).

Must not contain:

- HTTP logic.
- business rule checks.
- auth checks.

### `ModuleDto.ts` (request shape only)

Responsibilities:

- Define Zod schemas for body/params/query validation.
- Export TypeScript DTO types used by controller/service signatures.
- Keep input constraints close to transport layer (required fields, min/max, format).

Must not contain:

- DB queries.
- ownership checks.
- side effects.

### `ModuleValidator.ts` (domain rules + domain errors)

Responsibilities:

- Validate domain state and ownership.
- Throw domain errors (not found, forbidden, invalid state).
- Use i18n keys for domain errors.
- Expose expressive methods like `ensureProductExists`, `ensureUserOwnsProduct`, `ensureStatusCanChange`.

Must not contain:

- route decorators.
- response formatting.
- event emission.

### `ModuleRepository.ts` (data access only)

Responsibilities:

- Read/write from DB.
- Return raw persisted entities needed by service/validator.
- Keep SQL/ORM details centralized.

Must not contain:

- HTTP exceptions.
- business policy decisions.
- permission/ownership logic.

### `ModuleService.ts` (orchestration only)

Responsibilities:

- Orchestrate use case flow.
- Call validator for all domain checks.
- Call repository for persistence.
- Emit events.

Must not contain:

- direct domain error throwing.
- request validation logic (that belongs to DTO + controller `@Validate`).
- SQL details.

Pattern used in this playground:

- Service asks validator to `ensure...` before/after repository operations.
- Validator is the only place that raises domain-level `Err(...)`.

### `ModuleController.ts` (HTTP layer only)

Responsibilities:

- Define routes and decorators (`@Get`, `@Post`, `@Validate`, guards).
- Map request params/body/user context to service input.
- Return service output.

Must not contain:

- business logic.
- DB access.
- duplicated validation logic already in validator.

### `index.ts` (barrel export)

Responsibilities:

- Export module classes and schema/dto for `.load(moduleObject)`.
- Keep module discoverable and easy to plug into `src/modules/index.ts`.

## Module checklist (copy this for new modules)

- `Schema`: tables + inferred types only.
- `Dto`: zod request schemas + dto types.
- `Validator`: all domain checks and domain errors.
- `Repository`: DB methods only.
- `Service`: orchestration only (no direct domain errors).
- `Controller`: route + decorators + request mapping.
- `index.ts`: export everything needed by server load.

If you follow this contract, modules stay predictable, testable, and easy to scale.

## Copy-paste module template

Use this starter when creating a new module. Replace `Feature`/`feature` names and fields.

### `FeatureSchema.ts`

```ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const featuresTable = sqliteTable('features', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id'),
  name: text('name').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type Feature = typeof featuresTable.$inferSelect;
export type NewFeature = typeof featuresTable.$inferInsert;
```

### `FeatureDto.ts`

```ts
import { z } from 'zod';

export interface CreateFeatureDto {
  name: string;
}

export interface UpdateFeatureDto {
  name?: string;
}

export const createFeatureDto = z.object({
  name: z.string().min(2).max(100),
});

export const updateFeatureDto = createFeatureDto.partial();

export const featureIdParam = z.object({
  id: z.string().uuid('Invalid feature ID'),
});
```

### `FeatureRepository.ts`

```ts
import { Repository } from 'diject';
import { eq } from 'drizzle-orm';
import { DB, type TDb } from 'najm-database';
import { featuresTable, type Feature, type NewFeature } from './FeatureSchema';

@Repository()
export class FeatureRepository {
  @DB() private db!: TDb;

  async findAll(): Promise<Feature[]> {
    return this.db.select().from(featuresTable);
  }

  async findById(id: string): Promise<Feature | undefined> {
    const [feature] = await this.db.select().from(featuresTable).where(eq(featuresTable.id, id));
    return feature;
  }

  async create(data: NewFeature): Promise<Feature> {
    const [feature] = await this.db.insert(featuresTable).values(data).returning();
    return feature;
  }

  async update(id: string, data: Partial<NewFeature>): Promise<Feature | undefined> {
    const [feature] = await this.db
      .update(featuresTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(featuresTable.id, id))
      .returning();
    return feature;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(featuresTable).where(eq(featuresTable.id, id));
    return result.changes > 0;
  }
}
```

### `FeatureValidator.ts`

```ts
import { Service } from 'diject';
import { Err } from 'najm-core';
import { I18n, type TFn } from 'najm-i18n';
import type { Feature } from './FeatureSchema';
import { FeatureRepository } from './FeatureRepository';

@Service()
export class FeatureValidator {
  @I18n('features') private t!: TFn;

  constructor(private featureRepository: FeatureRepository) {}

  async ensureFeatureExists(id: string): Promise<Feature> {
    const feature = await this.featureRepository.findById(id);
    if (!feature) {
      Err(404, this.t('notFound'));
    }
    return feature;
  }

  ensureUserOwnsFeature(feature: Feature, userId: string): void {
    if (!feature.userId || feature.userId !== userId) {
      Err(403, this.t('accessDenied'));
    }
  }

  ensureUpdatedFeature(feature: Feature | undefined): Feature {
    if (!feature) {
      Err(404, this.t('notFound'));
    }
    return feature;
  }

  ensureDeleteSucceeded(success: boolean): void {
    if (!success) {
      Err(404, this.t('notFound'));
    }
  }
}
```

### `FeatureService.ts`

```ts
import { Service } from 'diject';
import { type EventEmitter, Events } from 'najm-event';
import type { UpdateFeatureDto } from './FeatureDto';
import { type Feature } from './FeatureSchema';
import { FeatureRepository } from './FeatureRepository';
import { FeatureValidator } from './FeatureValidator';

@Service()
export class FeatureService {
  @Events() private events!: EventEmitter;

  constructor(
    private featureRepository: FeatureRepository,
    private featureValidator: FeatureValidator,
  ) {}

  async getAll(): Promise<Feature[]> {
    return this.featureRepository.findAll();
  }

  async getById(id: string): Promise<Feature> {
    return this.featureValidator.ensureFeatureExists(id);
  }

  async create(userId: string, data: { name: string }): Promise<Feature> {
    const feature = await this.featureRepository.create({ userId, ...data });
    this.events.emit('feature.created', { feature });
    return feature;
  }

  async update(id: string, data: UpdateFeatureDto, userId: string): Promise<Feature> {
    const existing = await this.featureValidator.ensureFeatureExists(id);
    this.featureValidator.ensureUserOwnsFeature(existing, userId);

    const updated = await this.featureRepository.update(id, data);
    const feature = this.featureValidator.ensureUpdatedFeature(updated);

    this.events.emit('feature.updated', { feature });
    return feature;
  }

  async delete(id: string, userId: string): Promise<void> {
    const existing = await this.featureValidator.ensureFeatureExists(id);
    this.featureValidator.ensureUserOwnsFeature(existing, userId);

    const success = await this.featureRepository.delete(id);
    this.featureValidator.ensureDeleteSucceeded(success);

    this.events.emit('feature.deleted', { featureId: id });
  }
}
```

### `FeatureController.ts`

```ts
import { Controller } from 'diject';
import { canCreate, canDelete, canRead, canUpdate } from 'najm-auth';
import { Body, Params, User } from 'najm-params';
import { Delete, Get, Post, Put, ResMsg } from 'najm-router';
import { Validate } from 'najm-validation';
import {
  createFeatureDto,
  featureIdParam,
  updateFeatureDto,
  type CreateFeatureDto,
  type UpdateFeatureDto,
} from './FeatureDto';
import { FeatureService } from './FeatureService';

@Controller('/features')
export class FeatureController {
  constructor(private featureService: FeatureService) {}

  @Get('/')
  @canRead('features')
  @ResMsg('features.retrieved')
  async getAll() {
    return this.featureService.getAll();
  }

  @Get('/:id')
  @canRead('features')
  @Validate({ params: featureIdParam })
  @ResMsg('features.retrieved')
  async getById(@Params('id') id: string) {
    return this.featureService.getById(id);
  }

  @Post('/')
  @canCreate('features')
  @Validate(createFeatureDto)
  @ResMsg({ message: 'features.created', status: 201 })
  async create(@Body() body: CreateFeatureDto, @User('id') userId: string) {
    return this.featureService.create(userId, body);
  }

  @Put('/:id')
  @canUpdate('features')
  @Validate({ params: featureIdParam, body: updateFeatureDto })
  @ResMsg('features.updated')
  async update(@Params('id') id: string, @Body() body: UpdateFeatureDto, @User('id') userId: string) {
    return this.featureService.update(id, body, userId);
  }

  @Delete('/:id')
  @canDelete('features')
  @Validate({ params: featureIdParam })
  @ResMsg('features.deleted')
  async delete(@Params('id') id: string, @User('id') userId: string) {
    await this.featureService.delete(id, userId);
    return { deleted: true };
  }
}
```

### `index.ts`

```ts
export * from './FeatureSchema';
export * from './FeatureDto';
export { FeatureValidator } from './FeatureValidator';
export { FeatureRepository } from './FeatureRepository';
export { FeatureService } from './FeatureService';
export { FeatureController } from './FeatureController';
```

### Module export from `src/modules/index.ts`

```ts
export * from './health';
export * from './product';
export * from './cart';
export * from './order';
export * from './feature';
```

## API surface in this playground

### Health

- `GET /api/health`
- `GET /api/health/lang`

### Products

- `GET /api/products`
- `GET /api/products/:id`
- `GET /api/products/my`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`

### Cart

- `GET /api/cart`
- `POST /api/cart/items`
- `PUT /api/cart/items/:productId`
- `DELETE /api/cart/items/:productId`
- `DELETE /api/cart/clear`

### Orders

- `GET /api/orders/my`
- `GET /api/orders/:id`
- `POST /api/orders`
- `POST /api/orders/checkout`
- `PATCH /api/orders/:id/status`

### Built-in auth plugin controllers

- `/api/auth/*`
- `/api/users/*`
- `/api/roles/*`
- `/api/permissions/*`

Use `apps/playground/api.http` for ready-made request examples.

## Useful scripts

From `apps/playground`:

```bash
bun run dev          # Najm standalone server (Bun)
bun run dev:next     # Next.js app router mode
bun run build:next   # Next build
bun run start:next   # Next production start
bun run start:mcp:stdio  # MCP stdio transport process

bun run db:generate
bun run db:migrate
bun run db:seed
bun run db:reset
bun run db:reset-seed
```

## Minimal template for your own app

If you only want the essential integration, copy these pieces:

1. `src/server.ts` with plugins + `.load(moduleObject)`
2. `app/api/[...route]/route.ts` with `handle(server)` exports
3. `next.config.ts` with `serverExternalPackages`
4. DB config + schema composition pattern from this playground

Then add your modules under `src/modules/*` and export them through `src/modules/index.ts`.

## Troubleshooting

### 404 on all API routes

- Confirm `app/api/[...route]/route.ts` exists.
- Confirm server base path is `.base('/api')` in `src/server.ts`.

### Decorators metadata issues

- Ensure `experimentalDecorators` and `emitDecoratorMetadata` are enabled in `tsconfig.json`.
- Keep `reflect-metadata` available as an external package in `next.config.ts`.

### Auth routes fail at startup

- Ensure database plugin is registered before auth plugin.
- Ensure DB migration is applied (`db:migrate`).

### Permission denied on protected routes

- Use seeded admin/user credentials from `db:seed`, or assign permissions via `/api/permissions/*` and `/api/users/*`.

## WhatsApp + Chatbot integration

The playground includes a `WhatsAppChatbot` service that connects WhatsApp messages to the Najm chatbot agent. Incoming WhatsApp messages are processed by `ChatAgent.runOnce()` with the user's ALS context set via `runAsUser()`.

### Prerequisites

1. **Meta Developer Account** with a WhatsApp Business test number: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
2. **ngrok** (or similar tunnel) to expose your local server to Meta's webhook: `ngrok http 3000`

### Environment variables

```env
WA_PHONE_NUMBER_ID=your-phone-number-id
WA_ACCESS_TOKEN=your-access-token
WA_VERIFY_TOKEN=any-secret-string
WA_WEBHOOK_SECRET=your-webhook-secret
```

### Webhook setup

1. Start the server: `bun run dev:next`
2. Run ngrok: `ngrok http 3000`
3. In Meta dashboard, set webhook URL to `https://<ngrok-id>.ngrok-free.app/api/whatsapp/webhook`
4. Set verify token to match `WA_VERIFY_TOKEN`
5. Subscribe to `messages` events

### Built-in WhatsApp commands

- `/help` — Show available commands
- `/reset` — Clear conversation history
- `/stop` — Disable chatbot replies

## References

- Najm server wiring: `apps/playground/src/server.ts`
- Next route bridge: `apps/playground/app/api/[...route]/route.ts`
- Plugin configs: `apps/playground/src/config/plugins.ts`
- Database config: `apps/playground/src/config/database.ts`
- Schema composition: `apps/playground/src/database/schema.ts`
