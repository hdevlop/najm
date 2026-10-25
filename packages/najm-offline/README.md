# najm-offline

Read-only offline use for Najm applications. While a user is online, the
browser downloads the API responses they may read. During an outage, or when
the app is opened without a connection, those copies answer the same requests.

- **Bound to one account.** Copies belong to the account, installation and
  academic year they were granted for, and expire after the grant's duration
  (8 hours by default).
- **Locked when access changes.** A changed role, permission or ownership, a
  refused session, a logout or an account switch locks them at once.
- **Writes are never queued.** A write offline fails. A write online to data
  the app downloaded makes the copies unusable until a replacement downloads.

It builds on `najm-database/sync` (the replica), `najm-auth/client/offline`
(the access record) and `najm-next/pwa` (the worker).

| Entry | Runs in | What it holds |
| --- | --- | --- |
| `najm-offline` | anywhere | Protocol constants and types, `offlinePath`, `createWriteMatcher`, `offlineEnabled`, `OfflineUnavailableError` |
| `najm-offline/client` | browser | `createOfflineClient`: outage detection, local reads, account selection, renewal, locking |
| `najm-offline/pwa` | browser | Worker registration with a retry budget, readiness, staged updates protected while the user is editing, stored logos |
| `najm-offline/react` | browser | `useOfflinePreparation`, `useSignInOnSessionExpired` |
| `najm-offline/shell/*` | offline shell build | Replacements for `next/navigation`, `next/link`, `next/image`, `najm-auth/client/react` and `najm-kit` |
| `najm-offline/server` | server | Grant, snapshot and page protocol, DTOs, `splitReadPages` |
| `najm-offline/pg` | server | `offlineSnapshots` table and its store |
| `najm-offline/worker` | Next route | `createOfflineShellWorker`, `readShellManifest` |
| `najm-offline/build` | Bun script | `buildOfflineShell` |
| `najm-offline/testing` | Playwright | `createOfflineBrowserErrorAudit` |

## What the app supplies

Najm owns the protocol and its safety rules. Each app declares:

1. **A namespace.** It prefixes every storage key, database, lock and event,
   so two apps on one origin never share data.
2. **Its offline routes.** These are the GETs answered offline, each with the
   permission it needs. Shared routes are not tied to a year.
3. **The writes that change downloaded data**, built with `createWriteMatcher`.
4. **What a download contains.** On the server, `project(add, kind)` records
   what each route returns, read through the app's own services, so ownership
   and year scope apply exactly as they do online.
5. **Its offline screens.** These are the shell entry and the components it
   mounts.

## Client

```ts
// The app's offline module, imported by its HTTP client.
import { createOfflineClient } from 'najm-offline/client';
import { createWriteMatcher, offlinePath } from 'najm-offline';

export const offline = createOfflineClient<AppBootstrap>({
  namespace: 'app',
  auth,                                   // { client, api } from the app's najm-auth setup
  route: path => {
    const exact = offlinePath(path);
    if (exact === '/students') return { path: exact, shared: false, capability: 'read:students' };
    return null;
  },
  writeAffectsReads: createWriteMatcher(['/students', '/settings']),
  queryRoots: ['students'],
  languageHeader: 'X-Language',
  yearHeader: 'X-Academic-Year',
  year: async () => yearSource,           // optional: the selected year
});

// Every GET:     offline.dispatch(path, offline.captureRead(headers), () => online())
// Before writes: await offline.invalidateReads(url); after success: offline.mutationComplete(url)
// Mount once:    offline.connect(queryClient, () => bootstrap)
```

`useSignInOnSessionExpired(loginRoute, offline.lockRefusedSession)` replaces
najm-auth's redirect, so a refused session's lock commits before the page
leaves.

## Server

The app keeps its own controller, so each route still declares its guard. Its
service passes these functions its lookups:

```ts
const actor = await authorizeActor(id, { enabled: offlineEnabled(process.env.APP_OFFLINE), lookup, requestActor,
  permissions: ['read:offline', 'read:students'], can, refuse });
return createSnapshot({ store, actor, input, yearLabel, language, refuse, project: async (add, kind) => {
  if (kind === 'year') add('/students', await students.getAll());
} });
```

Run `createSnapshot` inside one repeatable-read transaction. `refuse(status,
reason)` throws the app's translated HTTP error. With
`createPostgresSnapshotStore(() => db)`, the store follows the current
transaction.

## Turning it off

Setting the app's switch to `off` (for example `APP_OFFLINE=off`) is read on
every request:

- `authorizeActor` refuses every grant and download, so clients lock what they
  hold.
- `createOfflineShellWorker` serves a worker without the shell, which takes
  over at once and drops the shell's caches.

Setting it back on restores offline use at the next renewal.
