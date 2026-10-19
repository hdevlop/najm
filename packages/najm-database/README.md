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

## Opt-in synchronization, 2.3.1

Use 2.3.1 rather than 2.3.0 for schema composition: the patch expresses the
bigint counter's SQL zero default without a native BigInt that Drizzle Kit
cannot serialize. The schema-generation gate exercises the built public entry.

These first-slice APIs are experimental. They do not mount an HTTP endpoint,
grant access, install triggers, run migrations, download School data or enable
offline UI. The application owns its authenticated transport, DTO validation,
projection allowlist, current command permissions and disclosure checks.

| Import | Responsibility |
| --- | --- |
| `najm-database/sync/contracts` | Portable context/operation/result types, strict canonical JSON v1, SHA-256 sealing and envelope validation |
| `najm-database/sync/client` | Explicit fast-idb replica opening, staged snapshot activation, immutable outbox, cursor/result commits and foreground Web Locks sender |
| `najm-database/sync/server` | Operation deduplication and uncertainty lookup through a transactional store; domain refusal savepoints |
| `najm-database/sync/pg` | Server-only Drizzle schema, ordered PostgreSQL operation store and reviewed capture-migration SQL generation |

The browser entry requires the optional exact peer `fast-idb@0.3.0`. No browser
global is touched on import; opening is explicit. Other entries do not import
fast-idb, and the existing root entry imports none of these sync entries.

### Local replica

```ts
import { openSyncReplica, synchronizeReplica } from 'najm-database/sync/client';
import { sealOperation } from 'najm-database/sync/contracts';

const replica = await openSyncReplica({
  name: accountDatabaseName,
  identity: { installationId, accountId },
  hashFormat: 'my-app-json-v1-sha256',
  canAccess: (durablePolicy, context, writing) => checkCurrentPolicy(durablePolicy, context, writing),
});
const ticket = await replica.beginSnapshot(context); // before the online request
// Fetch a freshly authorized immutable manifest/pages, with host DTO validation.
await replica.stageSnapshotPage(ticket, manifest, pageNumber, records);
const captured = await replica.activateSnapshot(ticket, manifest);
const operation = await sealOperation(versionedIntent);
await replica.enqueue(captured, operation); // strict atomic durable save
await synchronizeReplica({ replica, captured, transport });
```

Each database stores exactly one installation/account and can contain several
year scopes. Opening the same name for another identity fails. The `metadata`
store's `access` row belongs to the existing auth policy helper: its host CAS
adapter must read/compare/write that row in one replica transaction. The
`canAccess` callback is synchronous, reads that durable row inside each commit,
and must check account, installation, epoch, authorization generation,
scope/capability, expiry and clock rollback. Invoke the existing policy helper
before user operations to durably update its clock high-water. An available
replica never creates an authenticated online session.

Pages use SHA-256 of `canonicalJson(records)` and are limited to 500 records /
1 MiB each. Activation verifies complete coverage/counts and atomically replaces
one confirmed scope. It preserves pending work and other scopes. New download
tickets invalidate older callbacks. A cursor/receipt commit during a download
also invalidates its activation, preventing regression behind newer data.

The outbox stores frozen wire intent/hash, local sequence, capture generation,
attempts, first-sent time and outcome separately. A sending operation after a
restart is uncertain. The foreground sender first looks up its original ID,
then resends that same ID/hash only if unknown. It never creates a replacement
ID after a lost response. Acknowledgements update canonical records, mappings
and only their own operation atomically. Higher revisions/tombstones win;
later pending edits remain. Complete change groups and the cursor commit
together; transport fragments must be staged by the host before this API.

Web Locks cover network requests through the final local transaction. No lease,
hidden timer, Background Sync or navigator.onLine heuristic is supplied.
The host schedules retries, respects Retry-After and adds jitter; the stored
baseline retry delay starts at 2s and caps at 60s. Expired operation identities,
epoch/hash/version/access failures quarantine input instead of blind retries.
Only never-sent operations without active dependents can be cancelled.

Membership/epoch rebootstrap quarantines original affected-scope commands.
`resume` is an explicit authorized recovery action; it preserves firstSentAt
and requires status reconciliation for previously sent work. It refuses epoch,
identity/hash or expired-operation recovery, which needs manual reconciliation.
`read().pending` includes retained review states: never overlay quarantined,
cancelled, rejected or conflicted intents onto ordinary visible records.

There is no automatic database deletion, schema recovery/reset, attachment
support, safe old-snapshot storage reclamation or automatic conflict merge.
Physical suspension/termination/quota/mobile acceptance remains host work.

### Server transaction and capture

Compose `syncSchema` into the host's server-only schema and generate/review an
additive migration. Installation IDs/epochs must be initialized explicitly;
neither importing nor booting the package creates one.

```ts
import { acquireSyncOrder, createPostgresOperationStore } from 'najm-database/sync/pg';
import { applyOperation, CommandRefusal } from 'najm-database/sync/server';

database({ default: db }, {
  beforeTransaction: (tx, name) => {
    if (name === 'default') return acquireSyncOrder(tx, installationId).then(() => {});
  },
});
const store = createPostgresOperationStore(work => transactions.run(tx => work(tx)));
const receipt = await applyOperation({
  store, operation, hashFormat,
  authorize: resolveCurrentActorScopeAndCommandAccess,
  apply: async (intent, transaction, context) => {
    // Check current ownership, command permission, domain invariants and revision.
    // Invoke the existing domain service in this same active transaction.
    // Throw CommandRefusal for a reviewable conflict/rejection. Its savepoint
    // rolls back any partial domain work before the refusal becomes durable.
    return canonicalAcknowledgement;
  },
});
```

`beforeTransaction` runs once per outer attempt, inside the active injection
context and before domain work. Nested transactions reuse that context. Retried
attempts reacquire ordering. Entry failure rolls back before invoking the domain.
Default consumers have no entry hook and retain existing behavior.

The store takes the installation counter lock before operation/domain row locks,
rechecks current authorization after waiting, and commits domain changes plus
the durable outcome together. Its `run` adapter MUST bind domain repositories
to that same transaction; wrapping an independent pool is invalid. Duplicates
and status lookup still require current disclosure rights. The host must shape
stored results under current disclosure before sending them to a client.

`createCaptureSql` generates BEFORE STATEMENT ordering plus AFTER ROW effects
for explicitly registered tables and explicit column projections. It rejects
unresolved year IDs, changed record IDs and TRUNCATE. Upserts publish no phantom
attempted insert. Year changes emit old-scope deletion and new-scope canonical
row in one group. Journal scope uses canonical `year-id:<id>`; the host validates
and translates it to its public year-label contract. Shared catalog semantics
stay shared. Joined projections, FK cascades/parent-derived years, initial
revision backfill, membership invalidation and disabled-trigger coverage audits
still require host adapters/migrations. Never enable capture before reviewing
every existing writer and lock order. Maintenance must rotate the epoch and
preserve/reconcile pending work under an explicit reviewed procedure.

## Verification

`bun run test` covers legacy transactions and the portable/local primitives.
Build, run `bun run test:sync:schema`, then `bun run test:sync:integration` with a loopback PostgreSQL admin
URL in `OFFLINE_PROOF_ADMIN_URL`. The script rewrites it to `/postgres`, creates
an unpredictable `najm_sync_proof_<uuid>` database, verifies its marker, and
drops only that database. It never contacts the supplied URL's original
database. The fixture exercises built package entries with real PostgreSQL and
Chromium, Firefox and WebKit, including lost replies, concurrent copies, a real
worker, two tabs, rollback and reviewable conflicts. This is a generic protocol
fixture, not School authentication/domain/UI acceptance or an installed PWA.

The built entries share one `SyncError` constructor, so errors thrown by the
client, server or PostgreSQL entry can be checked against the contracts export.
Keep the full published `dist` graph, including its shared `.mjs` chunks.
The integration command checks this built-entry identity and treats generator
stack traces as failures even when the CLI returns exit status zero.
