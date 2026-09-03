# najm-next

Versioned Next.js configuration for Najm applications. One line per app, no
options.

```ts
// next.config.ts
export { default } from 'najm-next/config';
```

That is the whole file. Najm owns the defaults; a bump of this package moves
every app forward at once.

## What the preset owns

| Concern | Behaviour |
| --- | --- |
| Monorepo root | Nearest ancestor that declares workspaces (or holds a lockfile), applied to both `turbopack.root` and `outputFileTracingRoot`. |
| Build directory | `NAJM_NEXT_DIST_DIR` when set, otherwise `.next`. Absolute or escaping values are rejected. |
| Service worker | Shared route and registration exports provide a privacy-safe offline fallback. Legacy `public/sw.js` or `public/service-worker.js` files still receive secure headers. |
| Dev origins | Empty unless `NAJM_NEXT_DEV_ORIGINS` lists hosts. |
| Server externals | `reflect-metadata` stays external so decorator metadata has one registry. |
| Images | `minimumCacheTTL` of 31 days. |
| Fingerprinting | `poweredByHeader: false`. |
| Workspace imports | `experimental.externalDir`. |
| Version | Throws below the supported Next floor, warns past the tested major. |

Deployment-specific headers — CSP, HSTS, the rest of the edge policy — are not
here. They belong to the reverse proxy, which is the only layer that knows the
deployment.

### Root discovery

Next walks to the *outermost* lockfile. A stray `bun.lock` in a home directory
therefore becomes the tracing root of every app checked out beneath it. This
package walks up from the app and stops at the first directory that declares
workspaces, checking that before a lockfile at every level.

### Dev origins

`allowedDevOrigins` gates dev-only assets and endpoints. The default is empty:
nothing on the LAN reaches the dev server's HMR or source payloads until a host
is named.

```bash
NAJM_NEXT_DEV_ORIGINS="127.0.0.1, 192.168.1.13"
```

Values are split on commas or whitespace, stripped of scheme and port, and
deduped. `*.example.dev` is allowed; a bare `*` throws.

## Escape hatch

For the rare app that genuinely diverges:

```ts
// next.config.ts
import { defineNajmNextConfig } from 'najm-next/configurable';

export default defineNajmNextConfig({
  serverExternalPackages: ['better-sqlite3', 'sharp'],
});
```

Overrides merge rather than replace. `turbopack`, `images`, and `experimental`
merge key by key; `serverExternalPackages` and `allowedDevOrigins` concatenate
and dedupe; `headers()` runs after the preset's rules so an app rule wins a
conflict. Every other key replaces the preset's value outright.

## PWA service worker

Najm owns the worker behavior and registration lifecycle. Each application only
adds a route and mounts the client registration once:

```ts
// app/sw.js/route.ts
export { GET } from 'najm-next/pwa';
```

```tsx
import { NajmPwaRegistration } from 'najm-next/pwa/react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <NajmPwaRegistration />
      </body>
    </html>
  );
}
```

The default worker never caches application pages or API responses. Failed
document navigations receive a small inline offline response. Registration is
production-only and uses `updateViaCache: 'none'`.

An application may preserve a branded static offline document and its assets:

```ts
// app/sw.js/route.ts
import { createNajmServiceWorker } from 'najm-next/pwa';

export const GET = createNajmServiceWorker({
  cacheId: 'my-app',
  cacheVersion: 'v1',
  offlineUrl: '/offline.html',
  precache: ['/icons/app-192.png'],
});
```

Only those explicit paths are served from the cache. Cache cleanup is limited
to the configured `cacheId`; it never deletes unrelated caches on the origin.
For apps deployed below a base path, pass matching `scriptUrl` and `scope` props
to `NajmPwaRegistration`.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `NAJM_NEXT_DIST_DIR` | `.next` | Build directory, for parallel builds such as E2E runs. |
| `NAJM_NEXT_DEV_ORIGINS` | *(empty)* | Extra dev-server origins, comma or space separated. |

## Notes

- Requires `next >= 15.3.0 < 17`; tested through Next 16.
- The app directory is `process.cwd()`, so run `next` from the app workspace
  (`bun run --cwd apps/web build`), not with a directory argument from the root.
