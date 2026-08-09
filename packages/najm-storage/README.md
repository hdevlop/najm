# najm-storage

Storage plugin for Najm with local and database providers. Includes an optional **Storage Studio** admin UI (React) exposed via built-in REST routes, plus browser-side storage modules (`najm-storage/client` and `najm-storage/client-db`).

## Installation

```bash
bun add najm-storage
```

`zod` is a peer dependency and should be installed in the consuming app.

## Core Exports

- `storage(config)` plugin factory
- `StorageService`, `StorageValidator`
- `STORAGE_SERVICE` — resolution token for the application's one `StorageService`
- File helpers: `resolveStorageMimeType`, `analyzeFile`, `getReadableFileSize`
- Path helpers: `normalizeStoragePath`, `isSafeStoragePath`, `assertSafeStoragePath`
- Upload validation: `validateUploadInput`
- Schemas: `storageNamespaceSchema`, `storagePathSchema`, `storageUploadSchema`
- DTO mapper: `toStorageFileDto`

## StorageService Convenience Methods

- `getInfoOrThrow(namespace, filePath, message?)`
- `deleteOrThrow(namespace, filePath, message?)`
- `saveBase64(namespace, filePath, base64, mimeType?)`

## Resolving storage from another package

Inside an application, inject `StorageService` as usual. From **another
package**, resolve `STORAGE_SERVICE` instead:

```ts
const STORAGE_SERVICE = Symbol.for('najm:storage:service');

if (!container.has(STORAGE_SERVICE)) {
  throw new Error('register storage() before this plugin');
}
const storage = await container.resolve(STORAGE_SERVICE);
```

A class is only a working DI token while every caller holds the same
constructor. A package that ships as `dist` resolves `najm-storage` through its
own `node_modules`, while an application may map the specifier to `src` — two
module instances, two constructors. `container.resolve(StorageService)` given
the wrong one does not throw; it builds a **second** service with none of the
application's configuration, and files go somewhere nothing serves from.

`storage()` aliases `STORAGE_SERVICE` to its own class, and `Symbol.for` returns
the identical symbol in every copy, so the token always reaches the one service
the application booted. Declare the symbol locally, as above, rather than
importing it — that keeps `najm-storage` out of your module graph when the
feature that needs it is off.

## Browser Storage (`najm-storage/client`)

Browser-only module persisting to IndexedDB — no dependencies, safe to import in SSR code (nothing touches IndexedDB until first use). Provides a **file store** (blobs by namespace/path, mirroring the server API) and **data stores** (JSON documents with indexed queries).

```ts
import { createClientStorage } from 'najm-storage/client';

const storage = createClientStorage({
  db: 'my-app',
  stores: [
    { name: 'products', indexes: [{ name: 'price', keyPath: 'price' }] },
    { name: 'drafts' },  // keyPath defaults to 'id'
  ],
});

// Files — same shape as the server-side provider API
await storage.files.save('avatars', 'me.png', file);           // File | Blob | ArrayBuffer | Uint8Array | string
const blob = await storage.files.get('avatars', 'me.png');     // Blob | null
const url = await storage.files.objectUrl('avatars', 'me.png'); // for <img src>
await storage.files.list('avatars');                            // ClientFileInfo[]
await storage.files.delete('avatars', 'me.png');
await storage.files.listNamespaces();

// Data — documents with indexed queries
await storage.data.put('products', { id: 'p1', name: 'Widget', price: 5 });
await storage.data.get('products', 'p1');
await storage.data.query('products', { index: 'price', range: { lte: 10 }, limit: 20 });
await storage.data.count('products');

await storage.close();    // close the IndexedDB connection
await storage.destroy();  // delete the whole database
```

Notes:
- Mime types are inferred from `File.type` or the path; categories reuse the server's `FileCategory` map.
- Browser storage is per-user, per-device and evictable — call `navigator.storage.persist()` for durability and treat the server as the source of truth.

## Postgres in the Browser (`najm-storage/client-db`)

Optional entry wrapping **PGlite** (real Postgres compiled to WASM) with drizzle, so the browser can run the *same pg-dialect schema* as the server. Requires the optional peer dependency:

```bash
bun add @electric-sql/pglite
```

```ts
import { createClientDb } from 'najm-storage/client-db';
import { schema } from './database/schema';  // same pg schema as the server

const { db, client, close } = createClientDb({
  name: 'my-app',
  schema,
  persistence: 'idb',   // 'idb' (default) | 'opfs' (Web Worker only) | 'memory'
});

await db.select().from(schema.products);
```

The ~3.7 MB WASM binary is only bundled by apps that import this entry. For multi-tab apps, see [PGlite's multi-tab worker](https://pglite.dev/docs/multi-tab-worker).

## Storage Studio (Admin UI)

When the `storage` plugin is registered with `studio: true`, a `StorageStudioController` is mounted at `/storage-studio`. This provides REST endpoints consumed by the `najm-storage/studio` React frontend.

## Security Defaults

Storage REST routes require an explicit access decision. Configure `guards`
with route guards such as `isAuth()`, or pass `guards: []` only when the file
routes are intentionally public.

```ts
import { isAuth } from 'najm-auth';
import { storage } from 'najm-storage';

server.use(storage({
  provider: 'local',
  basePath: './uploads',
  guards: [isAuth()],
}));
```

`storage()` without `guards` throws during plugin setup. Public routes must be
written as `storage({ guards: [] })` so accidental unauthenticated upload,
list, serve, preview, or Studio APIs do not ship silently.

Other default protections:

- paths are normalized and reject traversal, null bytes, malformed encodings,
  absolute paths, and empty paths
- uploads default to 10 MB max size
- dangerous executable/script extensions are blocked unless security checks are
  explicitly bypassed in lower-level helper calls
- MCP tools are disabled by default and require both `mcp: true` and the MCP
  plugin

### Studio Routes

| Route | Method | Query / Body | Description |
|-------|--------|--------------|-------------|
| `/storage-studio/buckets` | `GET` | — | List all namespaces |
| `/storage-studio/buckets/:namespace/files` | `GET` | `?prefix=`, `?delimiter=/` | List files in a namespace |
| `/storage-studio/buckets/:namespace/files/presign` | `POST` | `{ path, method, ttlSeconds }` | Generate presigned URL |
| `/storage-studio/:namespace/files/*` | `DELETE` | `?hard=true` | Soft delete file (fallback to hard) |
| `/storage-studio/trash` | `GET` | — | List soft-deleted files across namespaces |
| `/storage-studio/trash/restore` | `POST` | `{ namespace, path }` | Restore a file from trash |
| `/storage-studio/usage` | `GET` | — | Aggregated usage stats |
| `/storage-studio/activity` | `GET` | — | Recent audit log entries |

### Provider Capabilities

Not all providers support every Studio feature:

| Feature | Local | DB |
|---------|-------|-----|
| Upload / download / list | ✓ | ✓ |
| Soft delete / trash | ✓ | ✓ |
| Presign | ✓ (HMAC) | Falls back to direct URL |
| Serve path | ✓ | ✓ |

### Configuration

```ts
server.use(storage({
  provider: 'local',      // 'local' | 'db'
  guards: [isAuth()],     // required; use [] only for intentional public routes
  basePath: './uploads',  // Local provider root directory
  dbTable: 'files',       // DB provider table name
  maxUploadSize: 10_000_000,
  allowedMimeTypes: ['image/*', 'application/pdf'],
}));
```

To use the React UI, import the studio from the parent package:

```bash
bun add najm-storage
```

```ts
import { StorageStudio, StorageStudioProvider } from 'najm-storage/studio';
import 'najm-storage/studio/styles.css';
```

## Example

```ts
import {
  resolveStorageMimeType,
  normalizeStoragePath,
  validateUploadInput,
} from 'najm-storage';

const path = normalizeStoragePath('icons%2Flogo.png');
const mimeType = resolveStorageMimeType(undefined, path);
const result = validateUploadInput({ filePath: path, mimeType, size: 2048 });

if (!result.valid) {
  throw new Error(result.error);
}
```
