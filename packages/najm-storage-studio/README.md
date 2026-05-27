# najm-storage-studio

React-based admin UI for **najm-storage**. Browse buckets, upload files, manage trash, view usage dashboards, and configure access policies — all from a self-contained embeddable React app.

## Installation

```bash
bun add najm-storage-studio
```

Peer dependencies (should be installed in the consuming app):

```bash
bun add react react-dom lucide-react swr recharts
```

> Tailwind CSS is required in the host app for styling. The studio scopes all styles under the `.ss-studio` prefix via a custom Tailwind config.

## Quick Start

### 1. Add the Tailwind prefix plugin

In your app's `tailwind.config.js` (or `tailwind.config.ts`), import and include the studio's prefix plugin so styles are isolated:

```ts
import studioTailwind from 'najm-storage-studio/tailwind.config';

export default {
  // ... your config
  plugins: [
    // ... your plugins
    studioTailwind,
  ],
};
```

### 2. Mount the app

```tsx
import 'reflect-metadata';
import { StorageStudioApp } from 'najm-storage-studio';

function AdminPage() {
  return (
    <div className="ss-studio">
      <StorageStudioApp />
    </div>
  );
}
```

The `<StorageStudioApp />` component is self-contained. It fetches its own data via SWR from the Najm backend routes (see **Backend Setup** below).

### 3. Backend setup (najm-storage)

Ensure your Najm server registers the storage plugin **with** the Studio controller:

```ts
import { storage } from 'najm-storage';

server.use(storage({
  provider: 'local',   // or 'db'
  basePath: './uploads',
  // studio is auto-registered when the storage plugin is used
}));
```

The Studio controller exposes REST routes under `/storage-studio`:

| Route | Method | Description |
|-------|--------|-------------|
| `/storage-studio/buckets` | `GET` | List namespaces/buckets |
| `/storage-studio/buckets/:namespace/files` | `GET` | List files (supports `?prefix=` and `?delimiter=`) |
| `/storage-studio/buckets/:namespace/files/presign` | `POST` | Generate time-limited share URL |
| `/storage-studio/:namespace/files/*` | `DELETE` | Soft delete (or hard with `?hard=true`) |
| `/storage-studio/trash` | `GET` | List soft-deleted files |
| `/storage-studio/trash/restore` | `POST` | Restore a soft-deleted file |
| `/storage-studio/usage` | `GET` | Aggregated usage stats |
| `/storage-studio/activity` | `GET` | Recent audit activity |

## API Client Context

If you need to customize the fetcher (e.g., add auth headers), wrap the app with `ApiClientProvider`:

```tsx
import { ApiClientProvider } from 'najm-storage-studio';

<ApiClientProvider baseUrl="/api" fetcher={customFetcher}>
  <StorageStudioApp />
</ApiClientProvider>
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `⌘K` / `Ctrl+K` | Open command palette |
| `/` | Focus search input |
| `Esc` | Close modals / command palette |

## Exports

- `StorageStudioApp` — Main application shell
- `ApiClientProvider`, `useApiClient` — SWR/fetch context
- `useBuckets`, `useFiles`, `useTrash`, `useUsage`, `useActivity` — SWR data hooks
- `useKeyboard` — Reusable keyboard shortcut hook
- `ExplorerPanel`, `DashboardPanel`, `TrashPanel`, `ConfigurationPanel`, `AccessPoliciesPanel`, `ApiKeysPanel` — Individual panels

## Development

```bash
# From repo root
bun run build:storage-studio
bun run test:storage-studio
```
