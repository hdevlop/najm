# najm-auth/client — Client Auth SDK

Zero-dependency client SDK for `najm-auth`. Handles token lifecycle, RBAC/PBAC, multi-tab sync, and SSR — so your frontend never rewrites auth boilerplate again.

**Highlights:**
- Native `fetch` only (no axios) — works in browser, edge runtimes, Bun, Node 18+
- Auto refresh with 401 interceptor + proactive timer
- Concurrent refresh deduplication (promise lock)
- Multi-tab sync via BroadcastChannel
- Client-side RBAC/PBAC decoded from JWT (no round-trip)
- React bindings with `useSyncExternalStore`
- SSR helpers for Next.js, Remix, and any cookie-forwarding framework
- Target bundle: <8KB gzipped

---

## Installation

The client SDK ships inside `najm-auth` — no extra package needed.

```bash
bun add najm-auth
```

**Imports:**

```ts
import { createAuthClient } from 'najm-auth/client';            // Core (framework-agnostic)
import { AuthProvider, useAuth } from 'najm-auth/client/react';  // React bindings
import { defineAuth, getServerSession } from 'najm-auth/client/server'; // SSR helpers
```

**Peer dependencies:**
- `najm-auth/client` — none (zero deps)
- `najm-auth/client/react` — `react >= 18`
- `najm-auth/client/server` — `next` (optional, only for `defineAuth` / `withAuthMiddleware`)

**Two entry points, one SDK:**
- **Using Next.js?** Go straight to [Next.js: Unified Setup](#nextjs-unified-setup) — one config file, `defineAuth()`, and done.
- **Using Remix / Vite / vanilla React / other?** Use [`createAuthClient`](#createauthclientconfig) directly and the framework-agnostic SSR helpers.

---

## Next.js: Unified Setup

For Next.js apps, `defineAuth()` collapses the client, middleware, server helpers, and protect HOC into **one config file**. Import `auth` from wherever you need it — the browser client is lazily instantiated so edge/server bundles never pay construction cost unless you actually touch `auth.client`.

### 1. One config file

```ts
// src/lib/auth.ts
import { defineAuth } from 'najm-auth/client/server';

export const auth = defineAuth({
  // Shared
  apiBaseURL: '/api',
  authPrefix: '/auth',
  cookieName: 'refreshToken',

  // Browser client
  refreshThreshold: 0.8,
  tabSync: true,

  // Next.js middleware + protect
  loginRoute: '/login',
  afterLoginRoute: '/dashboard',
  publicRoutes: ['/', '/login', '/register', '/forgot-password', '/reset-password'],
  protectedRoutes: ['/dashboard/:path*', '/account/:path*', '/admin/:path*'],
  roleRoutes: {
    '/admin/:path*': ['admin'],
  },
});
```

### 2. Wire Next.js middleware

```ts
// src/middleware.ts
import { auth } from '@/lib/auth';

export const middleware = auth.middleware;
export const config = auth.config; // or override: { matcher: [...] }
```

### 3. Wrap your client tree (React)

```tsx
// src/app/providers.tsx
'use client';
import { AuthProvider } from 'najm-auth/client/react';
import { auth } from '@/lib/auth';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <AuthProvider client={auth.client}>{children}</AuthProvider>;
}
```

### 4. Use in server components

```tsx
// app/dashboard/page.tsx
import { auth } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await auth.requireSession(); // redirects to loginRoute if missing
  return <Dashboard user={session.user} />;
}

// Or with the HOC form:
import { auth } from '@/lib/auth';

export default auth.protect(async function DashboardPage({ session }) {
  return <Dashboard user={session.user} />;
});

// Role/permission gated:
export default auth.protect(
  async function AdminPage({ session }) { return <AdminPanel />; },
  { role: 'admin' },
);
```

### 5. Use in client components

```tsx
'use client';
import { useSession, useLogin } from 'najm-auth/client/react';
// Hooks work exactly as documented below — they pick up auth.client via AuthProvider.
```

### The `AuthKit` surface

| Field | Type | Where to use | Notes |
|-------|------|--------------|-------|
| `auth.client` | `NajmAuthClient` | **Client only** — pass to `<AuthProvider>` | Lazy getter; first read constructs the instance |
| `auth.api` | `FetchClient` | Client **and** server | Cookie-forwarding, Bearer-injecting fetch wrapper |
| `auth.getSession()` | `() => Promise<ServerSession \| null>` | Server | Reads signed session cookie, falls back to non-rotating session recovery |
| `auth.requireSession()` | `() => Promise<ServerSession>` | Server | Redirects to `loginRoute` on missing/expired session |
| `auth.middleware` | Next middleware fn | `middleware.ts` | Public/protected/role routing |
| `auth.config` | `{ matcher: string[] }` | `middleware.ts` | Default matcher, overridable |
| `auth.protect(Page, opts?)` | HOC | Server components | `opts.role` / `opts.permission` gating |

**Rule of thumb:**
- Client components → `auth.client` (via `<AuthProvider>`) or hooks
- Server code → `auth.getSession` / `auth.requireSession` / `auth.protect` / `auth.api`
- Never read `auth.client.getUser()` from a server component — it's a throwaway instance with empty state. Use `auth.getSession()` instead.

### `DefineAuthConfig` reference

```ts
defineAuth({
  // ---- Shared ----
  apiBaseURL?: string              // default: '/api'
  authPrefix?: string              // default: '/auth'
  cookieName?: string              // refresh cookie name; default: 'refreshToken'

  // ---- Browser client ----
  refreshThreshold?: number        // default: 0.8
  tabSync?: boolean                // default: true
  channelName?: string             // default: 'najm-auth'
  timeout?: number                 // default: 30000
  retry?: RetryConfig

  // ---- Server / middleware ----
  loginRoute?: string              // default: '/login'
  afterLoginRoute?: string         // default: '/dashboard'
  publicRoutes?: string[]          // glob patterns
  protectedRoutes?: string[]       // glob patterns
  roleRoutes?: Record<string, string[]>
  sessionCookieName?: string       // default: 'najm.session'
  sessionSecret?: string           // for HMAC-signed session cookie; falls back to env
  sessionMaxAge?: number           // must match auth session.maxAge; default: 300
  recoveryURL?: string | false     // default: /api/auth/session/recover
  internalRecoveryURL?: string     // optional loopback endpoint; or NAJM_AUTH_INTERNAL_URL
  verifyAlways?: boolean           // authoritative recovery on every protected request
  onRecoveryFailure?: (failure: SessionRecoveryFailure) => void
  matcher?: string[]               // Next middleware matcher
})
```

---

## Quick Start (non-Next.js frameworks)

For Remix, Vite, vanilla React, or anywhere you're not using Next's middleware/server-component model, use `createAuthClient` directly.

### 1. Create the client

```ts
// lib/auth.ts
import { createAuthClient } from 'najm-auth/client';

export const auth = createAuthClient({
  baseURL: '/api',
});

export const api = auth.api;
```

### 2. Wrap your app (React)

```tsx
// app/providers.tsx
import { AuthProvider } from 'najm-auth/client/react';
import { auth } from '@/lib/auth';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider client={auth}>
      {children}
    </AuthProvider>
  );
}
```

### 3. Use hooks

```tsx
import { useSession, useLogin, usePermissions, Can } from 'najm-auth/client/react';

function DashboardLayout({ children }) {
  const { isLoading, isAuthenticated } = useSession({
    required: true,
    redirectTo: '/login',
  });
  if (isLoading) return <Spinner />;
  return children;
}

function LoginPage() {
  const { login, isLoading, error } = useLogin({
    onSuccess: (user) => router.push('/dashboard'),
    onError: (err) => toast.error(err.message),
  });
  return <form onSubmit={() => login({ email, password })} />;
}

function Sidebar() {
  const { can } = usePermissions();
  return (
    <nav>
      <Link to="/dashboard">Home</Link>
      {can('read:analytics') && <Link to="/analytics">Analytics</Link>}
      <Can permission="manage:users">
        <Link to="/admin/users">User Management</Link>
      </Can>
    </nav>
  );
}
```

That's it. Login, logout, refresh, RBAC, multi-tab sync, SSR — all handled.

---

## Core Client API

### `createAuthClient(config)`

Factory function that returns a `NajmAuthClient` instance.

```ts
const auth = createAuthClient({
  baseURL: '/api',              // API base URL (required)
  authPrefix: '/auth',          // Auth endpoint prefix (default: '/auth')
  refreshThreshold: 0.8,        // Proactive refresh at 80% of token lifetime (default: 0.8)
  tabSync: true,                // Multi-tab sync via BroadcastChannel (default: true)
  channelName: 'najm-auth',    // BroadcastChannel name (default: 'najm-auth')
  timeout: 30000,               // Request timeout in ms (default: 30000)
  retry: {                      // Network retry config
    maxRetries: 2,
    backoff: 'exponential',     // 'exponential' | 'linear'
    baseDelay: 500,             // Base delay in ms
  },
});
```

### Auth Operations

```ts
// Login — sets tokens, fetches user, starts refresh timer
const user = await auth.login({ email, password });

// Register — creates account, does NOT auto-login
const user = await auth.register({ name, email, password });

// Logout — clears state, revokes server-side, broadcasts to other tabs
await auth.logout();

// Refresh — deduplicates concurrent calls via promise lock
await auth.refresh();

// Fetch user profile — re-fetches /auth/me
const user = await auth.fetchUser();

// Password reset flow
await auth.forgotPassword({ email });
await auth.resetPassword({ token, newPassword });
```

### State Access

```ts
const user = auth.getUser();           // AuthUser | null
const token = auth.getAccessToken();   // string | null
const isAuth = auth.isAuthenticated(); // boolean
const state = auth.getState();         // Full AuthState snapshot
```

### Permissions (decoded from JWT, instant)

```ts
auth.can('read:posts');              // true/false
auth.can('create:*');                // Wildcard: any resource
auth.can('*:posts');                 // Wildcard: any action
auth.hasRole('admin');               // Check role
auth.hasAnyRole(['admin', 'mod']);   // Check any role
auth.hasPermission('publish:posts'); // Alias for can()
```

**Wildcard rules:**
- `*:*` matches everything
- `create:*` matches create on any resource
- `*:posts` matches any action on posts

### Fetch Client (`auth.api`)

Pre-configured fetch wrapper that auto-injects Bearer tokens and handles 401 refresh.

```ts
const api = auth.api;

const users = await api.get('/users');
const user = await api.post('/users', { body: { name: 'John' } });
const updated = await api.put('/users/123', { body: { name: 'Jane' } });
const patched = await api.patch('/users/123', { body: { status: 'active' } });
await api.delete('/users/123');
```

**Request options:**

```ts
await api.get('/data', {
  headers: { 'X-Custom': 'value' },  // Additional headers
  signal: controller.signal,          // AbortController signal
  timeout: 5000,                      // Per-request timeout override
  skipAuth: true,                     // Skip Bearer token + 401 interceptor
});
```

**Automatic behaviors:**
- Injects `Authorization: Bearer <token>` on every request
- On 401: attempts refresh, retries the original request once
- On 5xx / network error: retries with exponential backoff (if configured)
- JSON serialization/deserialization
- `credentials: 'include'` for cookie-based refresh

### Events

```ts
auth.on('login', (user) => analytics.identify(user.id));
auth.on('logout', () => analytics.reset());
auth.on('tokenRefresh', () => console.log('Token refreshed'));
auth.on('sessionExpired', () => router.push('/login'));
auth.on('userUpdated', (user) => console.log('User updated', user));
auth.on('stateChange', (state) => console.log('Any state change'));

auth.off('login', handler);  // Unsubscribe
```

**Events:**
| Event | Payload | When |
|-------|---------|------|
| `login` | `AuthUser` | After successful login |
| `logout` | `null` | After logout (local or from another tab) |
| `tokenRefresh` | `null` | After successful token refresh |
| `sessionExpired` | `null` | When refresh fails (token expired) |
| `userUpdated` | `AuthUser` | After `fetchUser()` completes |
| `stateChange` | `AuthState` | Fires on any of the above events |

### Subscribe

Low-level subscription for framework bindings (React uses this internally):

```ts
const unsub = auth.subscribe((state) => {
  console.log(state.isAuthenticated, state.user);
});

unsub(); // Unsubscribe
```

### Cleanup

```ts
auth.destroy(); // Clears timers, closes BroadcastChannel, removes listeners
```

---

## React Bindings

All hooks require `<AuthProvider>` in the component tree.

### `<AuthProvider>`

Thin context wrapper — passes the client instance to hooks.

```tsx
import { AuthProvider } from 'najm-auth/client/react';
import { auth } from '@/lib/auth';

<AuthProvider client={auth}>
  <App />
</AuthProvider>
```

### `useAuth()`

Full auth state. Re-renders on any state change.

```tsx
function Header() {
  const { user, isAuthenticated, accessToken, roles, permissions } = useAuth();
  return isAuthenticated ? <span>{user.name}</span> : <LoginButton />;
}
```

### `useUser()`

Shortcut for just the user object. Returns `null` if not authenticated.

```tsx
function Avatar() {
  const user = useUser();
  return user ? <img src={user.image} alt={user.name} /> : null;
}
```

### `useSession(options?)`

Initializes the session on mount by attempting a refresh. Use in layout components.

```tsx
function DashboardLayout({ children }) {
  const { isLoading, isAuthenticated, user } = useSession({
    required: true,              // Redirect if no session
    redirectTo: '/login',        // Where to redirect
    onUnauthenticated: () => {}, // Override redirect with custom logic
    onError: (err) => {},        // Called if refresh fails
  });

  if (isLoading) return <Spinner />;
  return children;
}
```

**Behavior:**
1. On mount: calls `auth.refresh()` then `auth.fetchUser()`
2. If `required: true` and no session: redirects or calls `onUnauthenticated`
3. Only runs once per mount (guarded by ref)

### `useLogin(options?)`

```tsx
function LoginPage() {
  const { login, isLoading, error } = useLogin({
    onSuccess: (user) => {
      toast.success('Welcome back!');
      router.push('/dashboard');
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); login({ email, password }); }}>
      {error && <Alert>{error.message}</Alert>}
      <button disabled={isLoading}>Login</button>
    </form>
  );
}
```

### `useLogout(options?)`

```tsx
function LogoutButton() {
  const { logout, isLoading } = useLogout({
    onSuccess: () => { router.push('/login'); toast.success('Logged out'); },
    onError: (error) => toast.error(error.message),
  });
  return <button onClick={logout} disabled={isLoading}>Logout</button>;
}
```

### Google sign-in

The framework client exposes provider-generic methods plus Google and GitHub
convenience methods:

```ts
auth.client.getOAuthLoginUrl('google', { returnTo: '/dashboard' });
auth.client.loginWithGoogle({ returnTo: '/dashboard' });
auth.client.loginWithGitHub({ returnTo: '/dashboard' });
await auth.client.linkOAuthAccount('google', { returnTo: '/account' });
await auth.client.linkOAuthAccount('github', { returnTo: '/account' });
```

For React, use the headless button with your own visual component:

```tsx
import { GoogleLoginButton } from 'najm-auth/client/react';

<GoogleLoginButton returnTo="/dashboard">
  <button type="button">Continue with Google</button>
</GoogleLoginButton>
```

The backend callback redirects to the configured frontend callback path. Mount
`OAuthCallback` there so the client rotates the HTTP-only refresh cookie into a
new in-memory access token and fetches the user:

```tsx
'use client';

import { OAuthCallback } from 'najm-auth/client/react';

export default function OAuthCallbackPage() {
  return (
    <OAuthCallback
      fallback={<p>Finishing sign-in...</p>}
      errorFallback={({ error }) => <p>{error.message}</p>}
    />
  );
}
```

`useGoogleLogin()` and `useGitHubLogin()` expose provider-specific login/link
actions, `isRedirecting`, and `error`. `useOAuthCallback()` exposes lower-level
completion control.

Only same-origin `returnTo` paths are accepted. No Najm or Google token is
placed in the callback query string.

### `useRegister(options?)`

```tsx
function RegisterPage() {
  const { register, isLoading, error } = useRegister({
    onSuccess: () => router.push('/login'),
    onError: (error) => toast.error(error.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); register({ name, email, password }); }}>
      {error && <Alert>{error.message}</Alert>}
      <button disabled={isLoading}>Register</button>
    </form>
  );
}
```

> **Note:** `register()` does not auto-login. Call `login()` separately after registration if your flow requires it.

### `usePermissions()`

Client-side RBAC/PBAC hooks. Permissions are decoded from the JWT — no API call needed.

```tsx
function AdminPanel() {
  const { can, hasRole, hasAnyRole, permissions, roles } = usePermissions();

  return (
    <div>
      {can('read:analytics') && <AnalyticsWidget />}
      {can('manage:users') && <UserManagement />}
      {hasRole('admin') && <SystemSettings />}
      {hasAnyRole(['admin', 'moderator']) && <ModerationQueue />}
    </div>
  );
}
```

### `<Can>`

Declarative permission gate component.

```tsx
import { Can } from 'najm-auth/client/react';

function ProductPage() {
  return (
    <div>
      <ProductList />

      <Can permission="create:products" fallback={<UpgradePrompt />}>
        <CreateProductButton />
      </Can>

      <Can role="admin">
        <DeleteAllButton />
      </Can>
    </div>
  );
}
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `permission` | `string?` | Required permission (e.g., `'read:posts'`) |
| `role` | `string?` | Required role |
| `children` | `ReactNode` | Rendered when check passes |
| `fallback` | `ReactNode?` | Rendered when check fails (default: `null`) |

> If both `permission` and `role` are provided, only `permission` is checked.

### `<Protected>`

Route-level authentication and authorization gate.

```tsx
import { Protected } from 'najm-auth/client/react';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={
        <Protected redirectTo="/login" loadingFallback={<Spinner />}>
          <DashboardPage />
        </Protected>
      } />
      <Route path="/admin" element={
        <Protected role="admin" redirectTo="/unauthorized">
          <AdminPage />
        </Protected>
      } />
      <Route path="/reports" element={
        <Protected permission="view:reports" fallback={<AccessDenied />}>
          <ReportsPage />
        </Protected>
      } />
    </Routes>
  );
}
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `children` | `ReactNode` | Protected content |
| `redirectTo` | `string?` | Redirect URL for unauthenticated users |
| `onUnauthenticated` | `() => void` | Custom handler (overrides `redirectTo`) |
| `role` | `string?` | Require a specific role |
| `permission` | `string?` | Require a specific permission |
| `loadingFallback` | `ReactNode?` | Shown while session initializes |
| `fallback` | `ReactNode?` | Shown when access is denied |

---

## SSR Helpers

> **Next.js users:** prefer [`defineAuth()`](#nextjs-unified-setup) — it wraps all of these helpers with a single config. The primitives below are what `defineAuth` is built on; reach for them directly only when you need custom behavior or you're on a non-Next.js framework.

### `defineAuth(config)`

Next.js-specific unified surface. See [Next.js: Unified Setup](#nextjs-unified-setup) for the full walk-through. Returns an `AuthKit` with:

- `client` / `api` — lazily-constructed browser `NajmAuthClient` + `FetchClient`
- `getSession()` / `requireSession()` — signed-cookie-first session resolution
- `middleware` / `config` — Next middleware export
- `protect(Page, { role?, permission? })` — server-component HOC

### `getSession(options)` *(Next.js-aware)*

Lower-level session resolver used by `defineAuth().getSession`. It reads the
HMAC-signed session cookie for an instant result, then falls back to
`POST /auth/session/recover`. Recovery validates the refresh family and returns
only a freshly signed session cookie; it does not rotate or return access or
refresh tokens. The cookie is HMAC-verified before its claims are used. Throws
`NoSessionError`, `AuthConfigError`, or `AuthTransportError` in strict mode.
In a Server Component, recovered claims are available to the current render,
but that render cannot persist response cookies; protected-route middleware
persists the recovered cookie before the component runs.

```ts
import { getSession, NoSessionError } from 'najm-auth/client/server';

try {
  const session = await getSession({ mode: 'strict', authPrefix: '/auth' });
  return session.user;
} catch (err) {
  if (err instanceof NoSessionError) redirect('/login');
  throw err;
}
```

Use this when you need session resolution outside the `defineAuth` wrapper (e.g., a custom route handler that doesn't share the same config).

### `getServerSession(options)`

Fetch the current user session server-side by forwarding cookies. Works with Next.js Server Components, Remix loaders, or any server-side context.

```ts
// Next.js App Router (server component)
import { cookies } from 'next/headers';
import { getServerSession } from 'najm-auth/client/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = await getServerSession({
    verifyURL: 'http://localhost:3000/api/auth/me',
    cookie: cookieStore.toString(),
  });

  if (!session) redirect('/login');
  return <Dashboard user={session.user} />;
}
```

**Options:**
| Option | Type | Description |
|--------|------|-------------|
| `verifyURL` | `string` | URL of the `/auth/me` endpoint |
| `cookie` | `string` | Cookie header string from the incoming request |
| `headers` | `Record<string, string>?` | Additional headers to forward |

**Returns:** `{ user: AuthUser }` or `null`.

### `createServerClient(config)`

Create a `FetchClient` that forwards cookies from the incoming request. Use for authenticated server-side data fetching.

```ts
// Remix loader
import { createServerClient } from 'najm-auth/client/server';

export async function loader({ request }: LoaderArgs) {
  const api = createServerClient({
    baseURL: 'http://localhost:3000/api',
    cookie: request.headers.get('cookie') ?? '',
  });

  const products = await api.get('/products');
  return json({ products });
}
```

```ts
// Next.js Server Component
import { cookies } from 'next/headers';
import { createServerClient } from 'najm-auth/client/server';

export default async function ProductsPage() {
  const cookieStore = await cookies();
  const api = createServerClient({
    baseURL: 'http://localhost:3000/api',
    cookie: cookieStore.toString(),
  });

  const products = await api.get('/products');
  return <ProductList products={products} />;
}
```

**Config:**
| Option | Type | Description |
|--------|------|-------------|
| `baseURL` | `string` | API base URL |
| `cookie` | `string` | Cookie header string to forward |
| `headers` | `Record<string, string>?` | Additional headers |

### `withAuthMiddleware(config)`

> **Prefer `defineAuth().middleware`** for new code — it shares config with the rest of your auth setup. `withAuthMiddleware` remains for standalone use when you don't want a unified config.

Next.js Edge Middleware helper for protecting routes.

```ts
// middleware.ts
import { withAuthMiddleware } from 'najm-auth/client/edge';

export default withAuthMiddleware({
  protectedRoutes: ['/dashboard/:path*', '/admin/:path*'],
  publicRoutes: ['/', '/about', '/login', '/register'],
  loginRoute: '/login',
  roleRoutes: {
    '/admin/:path*': ['admin'],
  },
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

**Config:**
| Option | Type | Description |
|--------|------|-------------|
| `protectedRoutes` | `string[]?` | Routes that require authentication (glob patterns) |
| `publicRoutes` | `string[]?` | Always-public routes |
| `loginRoute` | `string?` | Redirect target for unauthenticated users (default: `'/login'`) |
| `roleRoutes` | `Record<string, string[]>?` | Routes restricted to specific roles |
| `cookieName` | `string?` | Refresh token cookie name (default: `'refreshToken'`) |
| `apiBaseURL` | `string?` | API base used for recovery (default: `'/api'`) |
| `authPrefix` | `string?` | Auth route prefix (default: `'/auth'`) |
| `sessionCookieName` | `string?` | Signed session cookie name (default: `'najm.session'`) |
| `sessionSecret` | `string?` | HMAC secret; falls back to `NAJM_SESSION_SECRET`, then `JWT_ACCESS_SECRET` |
| `sessionMaxAge` | `number?` | Accepted signed-session age; must match server `session.maxAge` (default: `300`) |
| `recoveryURL` | `string \| false?` | Relative or exact same-origin recovery endpoint; `false` disables automatic recovery |
| `internalRecoveryURL` | `string?` | Explicit HTTP(S) loopback endpoint for self-hosted reverse-proxy deployments; falls back to `NAJM_AUTH_INTERNAL_URL`; only `localhost`, `127.0.0.1`, and `[::1]` are accepted |
| `verifyAlways` | `boolean?` | Force authoritative refresh-session validation and session reissue on every protected request |
| `onRecoveryFailure` | `(failure) => void?` | Secret-free diagnostic hook for fetch, HTTP, Set-Cookie, parsing, HMAC, and payload failures |
| `verifyURL` | `string?` | Deprecated; session verification no longer uses a network endpoint |

**Behavior:**
1. Skip public routes
2. Read and HMAC-verify `najm.session` with Edge-compatible Web Crypto
3. When the signed session is missing/invalid/expired, send only the HttpOnly
   refresh cookie to `POST /auth/session/recover`
4. Accept recovery only when the response carries a locally HMAC-verified
   signed session; forward it into the current RSC request and browser response
5. For role-restricted routes, check only verified session role claims
6. If recovery is invalid/revoked, clear auth cookies and redirect to login;
   transient recovery failures preserve the refresh cookie for retry

A refresh cookie by itself never authorizes navigation. The recovery endpoint
validates the JWT, family row, current user status, role, permissions, and
session version before signing claims. It never rotates or consumes the refresh
token, so concurrent navigation, Link/RSC prefetch, and multiple tabs cannot
race refresh rotation. `POST /auth/refresh` remains the only rotation path.

`verifyAlways: false` (default) trusts a valid signed snapshot until
`sessionMaxAge`; this is the documented maximum role/status staleness window.
`verifyAlways: true` performs authoritative recovery on every protected request,
trading a database read for immediate status/role/session checks.

The default middleware recovery requires the refresh cookie to be visible on
protected page requests, so keep the auth plugin's default
`refreshCookiePath: '/'`. A narrower path cannot be read by page middleware.
Recovery endpoints are secret-bearing configuration because they receive the
refresh cookie. Absolute values are accepted only when their exact origin matches the
incoming request (scheme, hostname, and port). URL credentials, downgrades,
cross-origin hosts, and lookalikes are rejected before `fetch()`. Recovery
forwards only the configured refresh cookie, never the complete incoming
`Cookie` header.

For a self-hosted app behind Caddy, nginx, or another reverse proxy, use
`internalRecoveryURL` when the container cannot reliably reach its own public
origin:

```ts
defineAuth({
  internalRecoveryURL: 'http://127.0.0.1:3000/api/auth/session/recover',
  onRecoveryFailure(failure) {
    logger.error({ failure }, 'Najm session recovery failed');
  },
});
```

The internal URL is accepted only when it uses HTTP(S) and an exact loopback
hostname. Recovery still validates the returned session HMAC locally. The
`NAJM_AUTH_INTERNAL_URL` environment variable provides the same opt-in without
changing application code. The
diagnostic object never includes URLs, cookie values, request headers, session
payloads, signatures, or secrets; the hook is silent unless configured.

---

## Error Handling

The SDK throws `AuthError` for HTTP errors:

```ts
import { AuthError } from 'najm-auth/client';

try {
  await auth.login({ email, password });
} catch (err) {
  if (err instanceof AuthError) {
    console.log(err.status);   // 401
    console.log(err.message);  // 'Invalid email or password'
    console.log(err.body);     // Full response body
  }
}
```

The React hooks catch errors internally and expose them via `error` state:

```tsx
const { login, error } = useLogin();
// error is an Error instance, not AuthError (unwrapped for simplicity)
```

---

## How It Works

### Token Lifecycle

```
Login → Store access token in memory → Decode JWT for roles/permissions
      → Schedule proactive refresh at 80% of token lifetime
      → Broadcast state to other tabs

401 Response → Attempt refresh (single promise, concurrent callers share it)
             → If refresh succeeds: retry original request
             → If refresh fails: emit 'sessionExpired', clear state

Proactive Timer → Fires before token expires → Calls refresh()
                → Reschedules on success → Clears on failure
```

### Token Storage

- **Access token:** stored in memory (not localStorage — XSS safe)
- **Refresh token:** httpOnly cookie (managed by the server, not accessible to JS)
- The client never touches the refresh token directly. It calls `POST /auth/refresh` and the server reads the cookie.

### Multi-Tab Sync

Uses `BroadcastChannel` API (same-origin only):

```
Tab A: user logs out → auth.logout() → broadcastLogout()
Tab B: receives message → resetState() → UI updates → redirect

Tab A: token refreshed → broadcastSync(state)
Tab B: receives message → updates state + reschedules refresh timer
```

### Concurrent Refresh Deduplication

If multiple requests hit 401 simultaneously, only one refresh request is made:

```
Request A → 401 → refresh() → creates promise → sends POST /refresh
Request B → 401 → refresh() → reuses same promise (no duplicate request)
Request C → 401 → refresh() → reuses same promise
All three → resume with new token
```

### JWT Payload Convention

For client-side RBAC to work, the server must include roles and permissions in the JWT:

```json
{
  "userId": "abc123",
  "jti": "unique-token-id",
  "roles": ["admin"],
  "permissions": ["read:posts", "create:posts", "manage:users"],
  "exp": 1700000000,
  "iat": 1699999000
}
```

This is the default behavior of `najm-auth`'s `TokenService`.

---

## Types

```ts
interface AuthClientConfig {
  baseURL: string;
  authPrefix?: string;         // default: '/auth'
  refreshThreshold?: number;   // default: 0.8
  tabSync?: boolean;           // default: true
  channelName?: string;        // default: 'najm-auth'
  retry?: RetryConfig;
  timeout?: number;            // default: 30000
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  roles: string[];
  permissions: string[];
}

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role?: string | null;
  permissions?: string[];
  [key: string]: unknown;      // extensible
}

interface RetryConfig {
  maxRetries?: number;
  backoff?: 'exponential' | 'linear';
  baseDelay?: number;          // default: 500ms
}

type AuthEvent = 'login' | 'logout' | 'tokenRefresh'
               | 'sessionExpired' | 'stateChange' | 'userUpdated';

// Next.js unified surface (najm-auth/client/server)
interface DefineAuthConfig {
  // Shared
  apiBaseURL?: string;
  authPrefix?: string;
  cookieName?: string;

  // Browser client
  refreshThreshold?: number;
  tabSync?: boolean;
  channelName?: string;
  timeout?: number;
  retry?: RetryConfig;

  // Server / middleware
  loginRoute?: string;
  afterLoginRoute?: string;
  publicRoutes?: string[];
  protectedRoutes?: string[];
  roleRoutes?: Record<string, string[]>;
  sessionCookieName?: string;
  sessionSecret?: string;
  matcher?: string[];
}

interface AuthKit {
  readonly client: NajmAuthClient;       // lazy
  readonly api: FetchClient;             // = client.api
  getSession: (opts?: { mode?: 'strict' | 'lenient' }) => Promise<ServerSession | null>;
  requireSession: () => Promise<ServerSession>;
  middleware: (request: Request) => Promise<Response>;
  config: { matcher: string[] };
  protect: <P extends Record<string, unknown>>(
    Page: (args: { session: ServerSession } & P) => unknown | Promise<unknown>,
    options?: { role?: string; permission?: string },
  ) => (props: P) => Promise<unknown>;
}
```

---

## Full Export Map

```ts
// najm-auth/client
export { NajmAuthClient, createAuthClient } from 'najm-auth/client';
export { FetchClient } from 'najm-auth/client';
export { decodeToken, isTokenExpired, getTokenTTL } from 'najm-auth/client';
export { matchPermission, hasRole, hasAnyRole } from 'najm-auth/client';
export { TabSync } from 'najm-auth/client';
export { AuthError } from 'najm-auth/client';

// najm-auth/client/react
export { AuthProvider } from 'najm-auth/client/react';
export { useAuth, useUser, useSession } from 'najm-auth/client/react';
export { useLogin, useLogout, useRegister } from 'najm-auth/client/react';
export { useGoogleLogin, useGitHubLogin, useOAuthCallback } from 'najm-auth/client/react';
export { usePermissions } from 'najm-auth/client/react';
export { Can, Protected } from 'najm-auth/client/react';
export { GoogleLoginButton, GitHubLoginButton, OAuthCallback } from 'najm-auth/client/react';

// najm-auth/client/server
export { defineAuth, type DefineAuthConfig, type AuthKit } from 'najm-auth/client/server';
export { getSession, NoSessionError, AuthConfigError, AuthTransportError } from 'najm-auth/client/server';
export { getServerSession } from 'najm-auth/client/server';
export { createServerClient } from 'najm-auth/client/server';
export { withAuth, type WithAuthOptions, type WithAuthProps } from 'najm-auth/client/server';
export { withAuthMiddleware } from 'najm-auth/client/server';
```
