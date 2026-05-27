# najm-storage

Storage plugin for Najm with local and database providers. Includes an optional **Storage Studio** admin UI (React) exposed via built-in REST routes.

## Installation

```bash
bun add najm-storage
```

`zod` is a peer dependency and should be installed in the consuming app.

## Core Exports

- `storage(config)` plugin factory
- `StorageService`, `StorageValidator`
- File helpers: `resolveStorageMimeType`, `analyzeFile`, `getReadableFileSize`
- Path helpers: `normalizeStoragePath`, `isSafeStoragePath`, `assertSafeStoragePath`
- Upload validation: `validateUploadInput`
- Schemas: `storageNamespaceSchema`, `storagePathSchema`, `storageUploadSchema`
- DTO mapper: `toStorageFileDto`

## StorageService Convenience Methods

- `getInfoOrThrow(namespace, filePath, message?)`
- `deleteOrThrow(namespace, filePath, message?)`
- `saveBase64(namespace, filePath, base64, mimeType?)`

## Storage Studio (Admin UI)

When the `storage` plugin is registered, a `StorageStudioController` is automatically mounted at `/storage-studio`. This provides REST endpoints consumed by the `najm-storage-studio` React frontend.

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
  basePath: './uploads',  // Local provider root directory
  dbTable: 'files',       // DB provider table name
  maxUploadSize: 10_000_000,
  allowedMimeTypes: ['image/*', 'application/pdf'],
}));
```

To use the React UI, install the companion package:

```bash
bun add najm-storage-studio
```

See `najm-storage-studio` README for frontend integration instructions.

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
