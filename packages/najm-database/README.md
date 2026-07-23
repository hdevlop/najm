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

## Production Notes

- `drizzle-orm` is a peer dependency — install your preferred driver (`better-sqlite3`, `postgres`, `mysql2`)
- Use `@DB('name')` to target a specific database when multiple are registered
- `@Transaction` decorator requires database plugin to be registered first
- Schema should use `authSchema` from `najm-auth` via spread, never duplicate auth tables