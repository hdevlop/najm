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

Deployment transport headers — HSTS, TLS policy, the rest of the edge posture —
are not here. They belong to the reverse proxy / edge, which is the only
layer that knows the deployment.

The request `Content-Security-Policy`, however, is app-owned: `najm-next`
composes one nonce policy per document request in `proxy.ts` (see
[Request CSP and proxy composition](#request-csp-and-proxy-composition)
below) and forwards the nonce into rendering. The edge must not emit a second
enforcing `Content-Security-Policy` — two enforcing policies intersect (a
resource must satisfy both), so an edge policy would silently block
app/provider resources the request policy allows (validation ID CSP-04). If
the edge needs visibility into violations, it may emit
`Content-Security-Policy-Report-Only`, and only in coordination with the app
policy.

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

Web push is opt-in and configured by the application. The generated worker
accepts only bounded `{ notificationId, title, body }` JSON, stores only the
notification ID in notification data, and opens the configured same-origin
inbox path:

```ts
export const GET = createNajmServiceWorker({
  push: {
    defaultTitle: 'Example App',
    notificationPath: '/inbox',
    icon: '/icons/app-192.png',
    badge: '/icons/app-192.png',
  },
});
```

The package supplies no product copy or destination. Invalid payloads and
cross-origin configuration are ignored or rejected before notification UI is
shown.

## Runtime location configuration

`najm-next/location/server` removes repeated environment parsing and CSP-source
calculation while leaving provider policy with the application. It never reads
`process.env`; the app passes its server environment explicitly.

```ts
// src/config/location.ts
import { defineNajmLocationRuntime } from 'najm-next/location/server';

export const appLocation = defineNajmLocationRuntime({
  environmentPrefix: 'MY_APP_LOCATION',
  allowedProviders: ['leaflet'],
  defaults: {
    provider: 'leaflet',
    center: { latitude: 33.5731, longitude: -7.5898 },
    zoom: 12,
    leaflet: {
      tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: 'OpenStreetMap contributors',
    },
  },
});
```

Resolve the same definition from the dynamic server layout and the CSP/proxy
path:

```ts
const location = appLocation.resolve(process.env, {
  isDevelopment: process.env.NODE_ENV === 'development',
});

location.config;        // serializable input for najm-kit/location/runtime
location.csp.imgSrc;    // exact validated tile origins
location.csp.connectSrc;
location.issues;        // sanitized issue codes only
```

The prefix creates `<PREFIX>_MAP_PROVIDER`, `_DEFAULT_LATITUDE`,
`_DEFAULT_LONGITUDE`, `_DEFAULT_ZOOM`, `_TILE_URL`, and `_TILE_ATTRIBUTION`.
Unknown providers and invalid production URLs resolve to `disabled`. Loopback
HTTP tile URLs are accepted only when `isDevelopment` is explicitly true.

Google is an additive runtime option. The browser key is intentionally public
and must be restricted by referrer and API in Google Cloud; no environment
object is serialized:

```ts
export const schoolLocation = defineNajmLocationRuntime({
  environmentPrefix: 'SCHOOL_LOCATION',
  allowedProviders: ['google'],
  defaults: {
    provider: 'google',
    center: { latitude: 33.5731, longitude: -7.5898 },
    google: {
      language: 'fr',
      region: 'MA',
      apiKeyEnvironmentFallbacks: ['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'],
    },
  },
});
```

The primary variable is `SCHOOL_LOCATION_GOOGLE_API_KEY`; the explicit
fallback above supports a documented transition from an existing public key
name. Optional `_GOOGLE_MAP_ID`, `_GOOGLE_LANGUAGE`, and `_GOOGLE_REGION`
variables are validated before entering the public runtime snapshot. Missing
or malformed values disable the map with sanitized issue codes. The resolution
also contributes the exact Google image, connection, script, and font sources
to the request CSP.

## Shared-safe app definition

`najm-next/app` holds one application's policy as pure, serializable data —
routes, session mode, preference cookies, CSP extras, and the location
environment prefix. It imports nothing (no React, Next, environment, auth, or
theme), so config-only consumers load it without any optional dependency:

```ts
// src/najm.config.ts
import { defineNajmApp } from 'najm-next/app';

export const app = defineNajmApp({
  id: 'my-app',
  auth: {
    apiBaseURL: '/api',
    authPrefix: '/auth',
    publicRoutes: ['/', '/login'],
    protectedRoutes: ['/dashboard'],
    loginRoute: '/login',
    forbiddenRoute: '/forbidden',
    proxySessionMode: 'optimistic',
    rememberCookieName: 'my-app.remember',
  },
  preferences: {
    cookieNames: {
      language: 'my-app-ui-language',
      theme: 'my-app-ui-theme',
      timeZone: 'my-app-ui-timezone',
    },
    defaultTimeZone: 'Africa/Casablanca',
  },
  csp: {
    reportPath: '/api/csp-report',
    extraImgSrc: ['https://tile.openstreetmap.org'],
    frameSrc: ["'none'"],
  },
  location: { environmentPrefix: 'MY_APP_LOCATION' },
});
```

The definition is validated eagerly and frozen. `proxySessionMode` is
structurally compatible with `najm-auth`'s `ProxySessionMode` without
importing it, so this entrypoint never pulls Auth into the proxy graph.

## Server bootstrap

Applications using Najm Auth, Kit, and Theme can use the Next-specific adapter
to avoid repeating request-reader, session, theme, and preference wiring:

```ts
// src/najm.server.ts
import 'server-only';
import { createNajmNextServerApp } from 'najm-next/app/next';

export const najmServer = createNajmNextServerApp({
  app,
  auth,
  theme: appTheme,
  themeOptions: {
    getServer: async () => (await import('@app/server')).server,
    basePath: '/api',
  },
  preferences,
  readSettings: readPublicUiSettings,
  fallbackSettings: { enabled: false },
});

export const { getSession, requireSession, requireRole, loadUiSnapshot } = najmServer;
```

It uses cookie, user, `Accept-Language`, and configured fallback preference
sources by default. `preferenceSources` adds institution values or custom source
orders without replacing Kit validation. Set `acceptLanguage: false` when an
application's policy excludes that source. The app definition and lower-level
`najm-next/app/server` entry remain free of optional Auth, Kit, and Theme
dependencies.

`najm-next/app/server` composes the existing request-scoped Auth, Theme, and UI
owners through structural callbacks. Create it once at module scope. It starts
independent session, cookie/header, appearance, branding, and public-setting
reads concurrently; preference resolution waits only for its inputs. The
returned session accessors remain lightweight and do not trigger UI/settings
loading:

```ts
// src/najm.server.ts
import 'server-only';
import { cookies, headers } from 'next/headers';
import { createNajmServerApp } from 'najm-next/app/server';

export const najmServer = createNajmServerApp({
  app,
  auth: serverAuth,
  theme: serverTheme,
  readSettings: readPublicUiSettings,
  fallbackSettings: { enabled: false },
  readCookies: cookies,
  readHeaders: headers,
  resolvePreferences: ({ cookies, headers, session }) =>
    preferences.resolveOrdered(cookies, {
      user: session?.user as { language?: unknown },
      acceptLanguage: headers.get('accept-language'),
    }),
});
```

Settings fallback is for typed public display projections only. Operational
session failures still propagate according to the Auth owner, and diagnostics
are bounded summaries rather than raw thrown values. React `cache()` scopes
settings and the full snapshot to one server render; the next request retries.

## Client provider composition

`najm-next/app/react` keeps the provider order in one place without importing
optional owners. Bind the concrete provider instances already installed by the
application at module scope. That preserves one physical Auth, Query, UI,
Branding, and Location context and lets minimal apps omit all of them:

```tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { bindNajmNextProvider, NajmNextAppProvider } from 'najm-next/app/react';

const query = bindNajmNextProvider(QueryClientProvider, ({ queryClient }) => ({
  client: queryClient!,
}));

export function Providers({ snapshot, children }) {
  return (
    <NajmNextAppProvider
      snapshot={snapshot}
      createQueryClient={() => new QueryClient(appQueryOptions)}
      providers={{ auth, query, ui, branding, location }}
      extensions={{ beforeUi: keyboard }}
    >
      {children}
    </NajmNextAppProvider>
  );
}
```

Composition is `Auth -> Query -> beforeUi -> UI -> Branding -> insideUi ->
Location -> children`. School places its keyboard provider at `beforeUi`;
Kafil keeps its live settings subscription in its bound UI component, already
inside Query. Query retry functions and QueryClient construction stay in client
code and are never serialized.

## Request CSP and proxy composition

`najm-next/security` generates a fresh nonce per request, composes the single
enforcing policy, and wraps the existing Najm Auth proxy without
reconstructing its response — status, redirects, body, response headers, and
every `Set-Cookie` value survive, because the composition mutates the returned
response in place and only overwrites the CSP header (which also guarantees
no accidental second enforcing policy):

```ts
// src/proxy.ts
import { composeNajmProxy } from 'najm-next/security';
import { app, appLocation } from './najm.config';
import { auth } from './auth';

export default composeNajmProxy({
  auth,
  app,
  resolveLocationCsp: (env) => appLocation.resolve(env).csp,
});

// The matcher stays a static literal in the app: Next analyzes it at build
// time and dynamic values are ignored.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:css|js|map|json|txt|xml|ico|png|jpg|jpeg|gif|webp|svg|woff|woff2|ttf|webmanifest)$).*)',
  ],
};
```

Nonce mode is explicit (`mode: "nonce"`): nonce rendering is dynamic per
request, so pages behind the proxy must render dynamically (`await
connection()` / `force-dynamic`). Never apply this preset to a static export.
Production policies never contain `'unsafe-eval'` or wildcards; development
adds `'unsafe-eval'` to `script-src` only, where React needs it (matching the
installed Next 16 CSP guidance, whose development example likewise retains
`upgrade-insecure-requests`). No `ws:`/`wss:` scheme is composed without
runtime evidence; real HMR WebSocket/browser behavior in development remains
a consumer acceptance item, not something this unit-checked policy proves.
`style-src 'self' 'unsafe-inline'` is retained deliberately until a compatible
tightening is separately proven. Provider origins (Leaflet tiles, Google
hosts, fonts, frames) are app policy plus location contributions — see the
Kafil-style and School-style coverage in `test/cspPolicies.test.ts` and the
production fixture in `integration/csp-proxy`.

## CSP violation reports

`najm-next/security/reports` is the bounded `/api/csp-report` handler. It
preserves the legacy and Reporting API batch envelopes, reads at most 8 KiB
with early stream cancellation, and always answers 204 with an empty body —
for valid, malformed, and oversized input alike. URLs are redacted to
origins/keywords only (no path retention): absolute URLs reduce to their
origin, `data:`/`blob:` payloads collapse to keywords, and relative or
malformed values become `redacted`. A throwing sink is isolated per report and
never fails the response:

```ts
// src/app/api/csp-report/route.ts
import { createCspReportHandler } from 'najm-next/security/reports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = createCspReportHandler();
```

The route sits beside the API catch-all deliberately and boots no backend.

## Strict-CSP client initialization

`najm-next/instrumentation/client` opts Zod 4.4.x into JIT-less evaluation
before it loads, so the `new Function` capability probe never fires under a
strict CSP. It runs from the framework's pre-hydration hook — after the HTML
document loads, before hydration and therefore before any form schema
evaluates — so no inline `<Script>` is needed:

```ts
// src/instrumentation-client.ts
import { initNajmZodStrictCsp } from 'najm-next/instrumentation/client';

initNajmZodStrictCsp();
```

The module has no imports, touches no DOM, and stays inert when imported
server-side.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `NAJM_NEXT_DIST_DIR` | `.next` | Build directory, for parallel builds such as E2E runs. |
| `NAJM_NEXT_DEV_ORIGINS` | *(empty)* | Extra dev-server origins, comma or space separated. |

## Notes

- Requires `next >= 15.3.0 < 17`; tested through Next 16.
- The app directory is `process.cwd()`, so run `next` from the app workspace
  (`bun run --cwd apps/web build`), not with a directory argument from the root.
