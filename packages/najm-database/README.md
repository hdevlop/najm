# najm-database

Database connections and transactions plugin for Najm, powered by Drizzle ORM.

## Install

```bash
bun add najm-database
```

Peer dependencies: `najm-core`, `reflect-metadata`, `drizzle-orm`, `zod`.

## Usage

### Register Database

```typescript
import { Server } from 'najm-core';
import { database } from 'najm-database';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';

const sqlite = new Database('./app.db');
const db = drizzle(sqlite, { schema });

await new Server()
  .use(database({ default: db }))
  .load(MyController)
  .listen(3000);
```

### Repository Pattern

```typescript
import { Repository } from 'najm-core';
import { DB } from 'najm-database';

@Repository('default')
class UserRepository {
  @DB() db!: ReturnType<typeof drizzle>;

  async findById(id: string) {
    return this.db.select().from(usersTable).where(eq(usersTable.id, id));
  }

  async create(data: typeof usersTable.$inferInsert) {
    return this.db.insert(usersTable).values(data).returning();
  }
}
```

### Transactions

```typescript
import { Service } from 'najm-core';
import { Transaction } from 'najm-database';

@Service()
class OrderService {
  constructor(
    private orderRepo: OrderRepository,
    private inventoryRepo: InventoryRepository,
  ) {}

  @Transaction({ retries: 2 })
  async createOrder(data: any) {
    const order = await this.orderRepo.create(data);
    await this.inventoryRepo.decrementStock(data.items);
    return order;
  }
}
```

### Seeding

```typescript
import { SeedService } from 'najm-database';

@Service()
class SetupService {
  constructor(private seeder: SeedService) {}

  async seed() {
    const report = await this.seeder.run({
      users: {
        by: ['id'],
        rows: [{ id: '1', name: 'Alice' }],
      },
    }, { verbose: true, onConflict: 'skip' });
  }
}
```

### Closing Connections

`server.stop()` leaves database connections open by default (`close: false`),
so existing apps and shared pools keep their caller-managed lifecycle. Opt in
when this server owns the connection:

```typescript
// Default: the caller manages the connection
database(db)

// Let this server close its connections on stop()
database({ default: db, close: true })

// Driver-specific cleanup, e.g. a postgres-js shutdown timeout
database({ default: db, close: (db) => db.$client.end({ timeout: 5 }) })
```

With `close: true`, the plugin calls the database's `disconnect()`, or its
driver client's `end()` (postgres-js/node-postgres) or `close()` (SQLite).
Clients without a recognized close method remain open; provide a callback for
those drivers. Inline `close` is an option when it is a boolean or callback;
a database object named `close` remains a connection. The existing second
argument also works: `database(db, { close: true })`. Explicit `close: false`
is still supported, but shared pools do not need it.

The database service boots at plugin order -100. When cleanup is enabled, it
closes after app services and plugins with higher orders; their `onDestroy`
hooks can still query.
Aliases sharing one client are closed once, including with a custom callback.
All clients are attempted before `stop()` rejects for any closure failures.
For a custom callback, the database and name come from the first alias in
alphabetical order. Automatic cleanup uses the driver's own shutdown timing;
provide a callback when you need driver-specific timeouts.

The plugin supports Core 2.1.1 and Core 3.0.2 or later within those majors.
App-service `onDestroy` hooks require Core 3; Core 2 retains its existing
plugin-only teardown behavior.

## Production Notes

- `drizzle-orm` is a peer dependency — install your preferred driver (`better-sqlite3`, `postgres`, `mysql2`)
- Use `@DB('name')` to target a specific database when multiple are registered
- `@Transaction` decorator requires database plugin to be registered first
- Schema should use `authSchema` from `najm-auth` via spread, never duplicate auth tables
