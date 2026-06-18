# NAJM_AUTH.md

This file provides guidance to Claude Code when working with `najm-auth` — the authentication, authorization, and ownership plugin for the Najm framework.

## Overview

**najm-auth** is a complete auth stack built as a Najm plugin. It ships five pieces:

1. **Backend plugin** ([packages/najm-auth/src/AuthPlugin.ts](packages/najm-auth/src/AuthPlugin.ts)) — services, controllers, guards, drizzle schemas (pg/sqlite).
2. **Ownership / Policy system** ([packages/najm-auth/src/ownership/](packages/najm-auth/src/ownership/)) — declarative row-level scoping, fluent `own().for(role, where/join)` DSL, `@Policy` + `@Can*` composition.
3. **Client SDK** ([packages/najm-auth/src/client/](packages/najm-auth/src/client/)) — zero-dep fetch client with automatic refresh, tab sync, token decoder.
4. **React bindings** ([packages/najm-auth/src/client/react/](packages/najm-auth/src/client/react/)) — `AuthProvider`, `useLogin`, `useSession`, `Can`, `Protected`, etc.
5. **Next.js bindings** ([packages/najm-auth/src/client/server/](packages/najm-auth/src/client/server/)) — `defineAuth()` produces middleware + api client + session helpers.

**Core design principle:** access token is authoritative (contains roles/permissions), refresh token rotates transparently, session cookie provides zero-latency SSR reads.

## Plugin Setup

`auth()` uses `.depends()` to auto-register the full stack. Only `database()` is required from the user:

```typescript
// packages/najm-auth/src/AuthPlugin.ts
plugin('auth')
  .depends(
    cache(),                              // token blacklist + user cache
    cookies(),                            // refresh + session cookie storage
    i18n(),                               // localized messages
    guards(),                             // guard execution
    validation(config?.validation),       // @Validate DTO validation
    rateLimit(config?.rateLimit),         // per-endpoint throttling
    email()                               // password-reset mails
  )
  .requires('database')                   // must be registered BEFORE auth()
  .contributes(I18N_CONTRIBUTIONS, AUTH_LOCALES)
  .services(AuthModule, UserModule, RoleModule, PermissionModule, TokenModule, ScopeContext)
  .config(AUTH_CONFIG, mergeConfig(config))
  .set(AUTH_SCHEMA, selectSchema(config))
```

### Configuration

```typescript
auth({
  dialect: 'sqlite' | 'pg',               // picks schema automatically (RETURNING-capable engines only)
  jwt: {
    accessSecret,  accessExpiresIn:  '1h',
    refreshSecret, refreshExpiresIn: '7d',
  },
  refreshCookieName: 'refreshToken',      // cookie that holds the refresh JWT
  defaultRole: 'user' | null,             // auto-assigned on /auth/register
  registrationMode: 'active' | 'pending',
  bcryptRounds: 10,                       // bcrypt cost, valid range 4-31
  lockout: { maxAttempts: 5, duration: '15m' },
  session: {
    name: 'najm.session',                 // signed session cache cookie
    maxAge: 300,                          // seconds (5 min)
    secret,                               // falls back to jwt.accessSecret
  },
  frontendUrl,                            // used for password-reset email links
  blacklistPrefix: 'auth:blacklist:',
})
```

Secrets fall back to `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` env vars; plugin throws on missing.

### Playground setup

[apps/playground/src/server/config/plugins.ts](apps/playground/src/server/config/plugins.ts):

```typescript
export const authConfig = () => auth({
  dialect: 'sqlite',
  defaultRole: 'user',     // auto-assign 'user' role to new registrations
});
```

[apps/playground/src/server/index.ts](apps/playground/src/server/index.ts):

```typescript
export const server = new Server()
  .use(corsConfig())
  .use(databaseConfig())    // MUST come before authConfig()
  .use(i18nConfig())
  .use(validationConfig())
  .use(eventsConfig())
  .use(rateLimitConfig())
  .use(mcpConfig())
  .use(authConfig())        // auto-registers cache, cookies, guards, email, etc.
  .base('/api')
  .load(modulesModule, listenersModule);
```

## Authentication Flow (End-to-End)

### Tokens & Cookies Overview

| Artifact | Where | Lifetime | Purpose |
|---|---|---|---|
| **Access JWT** | `Authorization: Bearer <token>` header, also returned in login response body | 1h (default) | Carries `userId`, `roles`, `permissions`, `jti`, `sessionVersion`. Authoritative for authz. |
| **Refresh JWT** | `refreshToken` cookie (HttpOnly, Secure, SameSite=Lax) | 7d (default) | Exchanges for a new access+refresh pair. Rotated on every use. |
| **Session cookie** | `najm.session` cookie (HttpOnly, HMAC-signed) | 5m (configurable) | Cache of `{user, roles, permissions}` for zero-DB SSR. Short TTL = freshness. |
| **Blacklist entry** | Cache (`auth:blacklist:<jti>`) | until token natural expiry | Instant revocation of access tokens on logout. |
| **Session version** | Cache (`auth:session-version:<userId>`) | refreshed to the access-token TTL while non-zero | Bumping it invalidates **all** outstanding access tokens for that user. |
| **Refresh row** | `tokens` table | 7d | Stores SHA-256 hash of current refresh token + previous hash (grace window). |

### Login (`POST /auth/login`)

[AuthService.loginUser()](packages/najm-auth/src/auth/AuthService.ts) flow:

1. `@Validate(loginDto)` checks email/password shape.
2. `@RateLimit` — 5 attempts / 15m, bucketed per `ip:email` composite key (prevents shared-IP DoS).
3. Fetch user; if lockout expired, auto-reset `failedLoginAttempts`.
4. If still locked → `423 Locked`.
5. Native `Bun.password.verify` (bcryptjs fallback on Node) compares against the stored hash or a lazily generated configured-cost dummy hash, preventing timing-based email enumeration.
6. On failure: `incrementFailedAttempts`; at `maxAttempts` → `setLockout(now + duration)`.
7. On success:
   - `tokenService.generateTokens(userId)`:
     - Reads `{roleName, permissions}` from DB for this user.
     - Builds access JWT with `{userId, roles:[roleName], permissions, jti, sessionVersion}`.
     - Builds refresh JWT with `{userId, jti, type:'refresh'}`.
     - Stores **hashed** refresh in `tokens` table with a `tokenFamily` (nanoid).
   - `cookieManager.setRefreshToken(refresh)` → HttpOnly cookie, `maxAge = 7d`.
   - `cookieManager.setSessionCookie({user, roles, permissions})` → HMAC-signed, TTL = 5m.
   - Return `{accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt, user}` in JSON.

### Per-request Authorization (`AuthResolver`)

Registered as **global Hono middleware** at boot ([AuthResolver.activate()](packages/najm-auth/src/auth/AuthResolver.ts#L64)):

```typescript
this.app.use('*', async (c, next) => {
  const token = c.req.header('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const result = token
    ? (await this.resolve(token)) || (await this.resolveFromCookie())
    : await this.resolveFromCookie();

  if (result) {
    // Populate ALS container with USER, ROLE, PERMISSIONS
    container.set(USER, result.user);
    container.set(ROLE, result.role);
    container.set(PERMISSIONS, result.permissions);
  }
  await next();
});
```

- **Priority:** a presented Bearer token is authoritative (full blacklist + session-version verification, refresh-cookie fallback on failure). The signed session cookie is the zero-I/O hot path **only for cookie-only requests** (no Authorization header), followed by the refresh-cookie fallback. A stale session cookie can never shadow or bypass Bearer verification.
- **Cookie-only revocation lag:** the session-cookie hot path performs no revocation checks, so logout from another tab/device or a role change can take up to `session.maxAge` (default 300s) to reach a copied cookie. Logout and password flows clear the responding browser's cookies immediately.
- Populates ALS (`USER`, `ROLE`, `PERMISSIONS` from `najm-guard`). Decorators like `@User('id')`, `@Policy`, `@Can(...)`, `@Owned(...)` all read from this.
- **USER contract:** every resolution path guarantees at least the `AuthUser` fields (`id`, `email`, plus `name`/`role`/`status`/`permissions` when known). DB-backed paths include more; guards and handlers must not rely on fields outside `AuthUser`.
- Falls through on failure — protected routes enforce via `@isAuth()`.

### Access Token Verification ([TokenService.verifyAccessToken](packages/najm-auth/src/tokens/TokenService.ts#L54))

Three gates must all pass:

1. `jwt.verify(token, accessSecret)` — signature + expiry.
2. **Blacklist check** — `auth:blacklist:<jti>` (populated by logout).
3. **Session version check** — `payload.sessionVersion === auth:session-version:<userId>`. Mismatch → `tokenRevoked`. Redis reads both keys in one `MGET`; bumping the version invalidates every outstanding access token for that user.

### Refresh Flow (`POST /auth/refresh`) — Rotation with Grace Window

Critical security pattern in [TokenService.refreshTokens()](packages/najm-auth/src/tokens/TokenService.ts#L324):

```
cookie.refreshToken ──► jwt.verify(refreshSecret) ──► userId
                                                        │
                                                        ▼
                                 SELECT FROM tokens WHERE userId = ?
                                                        │
                                                        ▼
                          ┌─────────────────────────────┴──────────────────────────┐
                          │ hash(cookie) === stored.token ?                         │
                          ├─────────────────────────┬──────────────────────────────┤
                          │ YES: current token       │ NO: check previousHash       │
                          │  → generateTokens()       │   within 120s grace AND      │
                          │  → store new hash         │   not yet used               │
                          │  → move old to previous   │   → generateTokens()         │
                          │  → rotate cookie          │   → mark previousUsedAt      │
                          │                           │  else: REJECT (tokenInvalid) │
                          └─────────────────────────────────────────────────────────┘
```

**Why the 120-second grace window?** Two concurrent requests race the refresh endpoint — without a grace window the loser gets logged out. `previousHash` + `previousValidUntil` + `previousUsedAt` let **exactly one** concurrent retry succeed:

- First request: current hash matches → rotates → old hash stored as `previous`, current becomes new.
- Second request (racing, still holding old token): `presented === previous`, within 120s, `previousUsedAt IS NULL` → rotate + mark `previousUsedAt`.
- Third request with same old token: `previousUsedAt` set → **reject** (replay detection).

`tokenFamily` (nanoid) is preserved across rotations so you can audit / revoke a whole login session.

The cookie is written with the fresh refresh token every rotation, and the signed session cookie is re-baked with fresh roles/permissions extracted from the new JWT.

Rate limit: 15 / 15m, bucketed by `cookieFingerprint` (IP + SHA-256 of the request cookie header) so sessions behind the same NAT do not share one bucket. Hashing the complete cookie header avoids module-global cookie-name state when multiple servers use different refresh-cookie names.

### `GET /auth/me`

[AuthService.getMe()](packages/najm-auth/src/auth/AuthService.ts#L172):

1. If `Authorization: Bearer` present → verify + decode → return user; re-bake session cookie from fresh JWT roles/permissions.
2. Else → validate the refresh cookie, then load the user through the shared 30-second user cache (no rotation here — rotation is reserved for `/auth/refresh` to avoid races).
3. **Does not** refresh the session cookie in the cookie-only path (no authoritative roles/permissions without a DB round-trip; next login/refresh will bake it).

Rate limit: 30 / 1m by cookie fingerprint.

### Logout (`POST /auth/logout`)

[TokenService.logout()](packages/najm-auth/src/tokens/TokenService.ts) — **immediate**, **current-session-only** revocation:

1. Resolve the session family — from the verified refresh cookie's `tokenFamily` claim, falling back to the presented access token's `tokenFamily` claim (pure Bearer clients).
2. Blacklist the current access token by `jti` for its remaining TTL (`auth:blacklist:<jti>`).
3. **Mark the family revoked** → `cache.set('auth:revoked-family:<tokenFamily>', '1', accessTokenTtl)`. Every access token minted for *this* family (not just the presented one) now fails `verifyAccessToken`; other sessions are untouched.
4. Delete that family's refresh row in DB.
5. Clear `refreshToken` + `najm.session` cookies.

If no family can be resolved (legacy token, neither cookie nor Bearer present), logout falls back to a full revoke-all for the user (bump `auth:session-version:<userId>` + delete every refresh row). To terminate **all** sessions deliberately, use a password change/reset.

### Password Change / Reset

Both `changePassword()` and `resetPassword()` end with the same revocation cocktail:

```typescript
await userService.update(userId, { password: newPassword });
await tokenService.invalidateUserAccessTokens(userId);   // bump session version (all sessions)
await tokenService.revokeAllForUser(userId);             // delete every refresh row for the user
cookieManager.clearRefreshToken();
cookieManager.clearSessionCookie();
```

Forgot-password (`POST /auth/forgot-password`):
- Generates a 1h JWT with `{userId, type:'reset', jti}` signed with `refreshSecret`.
- Stores `jti` in cache at `auth:reset:<userId>` (so each new reset invalidates the previous one; single-use).
- Sends email; **returns the same message whether user exists or not** (prevents enumeration).
- Rate limit: 3 / 15m per `ip:email`.

Reset (`POST /auth/reset-password`):
- Verify JWT signature, check `type === 'reset'`, check stored `jti` matches.
- Delete cache entry (single-use).
- Apply revocation cocktail above.

## Cookie Details

[CookieManager.ts](packages/najm-auth/src/auth/CookieManager.ts) wraps `CookieService` (from `najm-cookies`) for three distinct uses:

### 1. Refresh token cookie

```typescript
setRefreshToken(refreshToken: string): void {
  const maxAge = timestring(this.config.jwt.refreshExpiresIn, 's'); // e.g. 7d → 604800
  this.cookieService.set(this.cookieName, refreshToken, { maxAge });
}
```

Config defaults (from `najm-cookies`): HttpOnly, Secure, SameSite=Lax, path=/. Contains the raw JWT — **not** signed separately because it's already a signed JWT; the DB stores a SHA-256 hash of it, so a DB breach doesn't hand attackers working tokens.

### 2. Signed session cache cookie

```typescript
setSessionCookie(data: Omit<SessionCookieData, 'iat'>): void {
  const payload = { ...data, iat: Date.now() };
  this.cookieService.setSigned(
    this.sessionCookieName,           // 'najm.session' by default
    JSON.stringify(payload),
    this.sessionSecret,                // falls back to jwt.accessSecret
    { maxAge: 300, httpOnly: true, sameSite: 'Lax', path: '/' }
  );
}
```

- HMAC-signed so it's tamper-proof but readable without hitting the DB.
- Contains `{user, roles, permissions, iat}`.
- Short TTL (5 min) bounds staleness — role changes propagate on next login/refresh/me.
- Used by Next.js Server Components via `getServerSession()` for SSR header/nav rendering — zero DB round-trip on every page render.
- Used first by `AuthResolver`; a valid cookie populates user, role, and permissions with zero DB/cache I/O.
- Revocation and role changes can take up to the session-cookie TTL to reach a copied cookie. Logout/password flows clear the browser cookie immediately, and the short default TTL bounds external reuse.
- Read path double-checks the TTL (`Date.now() - data.iat > maxAge*1000` → null) as defence against clock-skew cookie reuse.

### 3. Cookie fingerprint (rate-limit key)

```typescript
const cookieFingerprint = (ctx) => `${ip}:${sha256(ctx.req.header('cookie') ?? '')}`;
```

Used as the rate-limit key on `/auth/refresh` and `/auth/me` — different cookies from the same NAT don't share a single bucket.

## Auto-registered Routes

From [AuthController.ts](packages/najm-auth/src/auth/AuthController.ts):

| Method | Path | Guards | Rate Limit (key) | Notes |
|---|---|---|---|---|
| POST | `/auth/register` | — | 5 / 15m (ip+email) | Creates user, assigns `defaultRole` if configured. |
| POST | `/auth/login` | — | 5 / 15m (ip+email) | Sets refresh + session cookies. |
| POST | `/auth/refresh` | — | 15 / 15m (cookie fingerprint) | Rotation with 120s grace. |
| POST | `/auth/logout` | `@isAuth()` | 10 / 15m (user) | Blacklist jti + bump session version. |
| POST | `/auth/change-password` | `@isAuth()` | — | Revokes **all** sessions. |
| GET | `/auth/me` | — | 30 / 1m (cookie fingerprint) | Bearer → cookie fallback. |
| POST | `/auth/forgot-password` | — | 3 / 15m (ip+email) | Same response whether email exists. |
| POST | `/auth/reset-password` | — | 5 / 15m (ip) | Single-use reset token. |

**Admin CRUD routes** (all guarded by `@isAdmin()`):
- `/users`, `/roles`, `/permissions` — full CRUD.
- `POST /permissions/assign/:roleId/:permissionId`.

## Guard System

### Role Guards

```typescript
import { isAuth, isAdmin, isAdministrator } from 'najm-auth';

@isAuth()            // any authenticated user (reads USER from ALS)
@isAdmin()           // role === 'admin'
@isAdministrator()   // admin group
```

`isAuth` is a thin wrapper ([AuthGuard.ts](packages/najm-auth/src/auth/AuthGuard.ts)): `canActivate(@User() user) { return !!user; }`. The actual token verification already happened in the global `AuthResolver` middleware.

### Permission Guards (PBAC)

```typescript
import { Can, canRead, canCreate, canUpdate, canDelete, canManage } from 'najm-auth';

@Can('publish:posts')       // arbitrary permission string
@canRead('posts')           // shorthand → Can('read:posts')
```

Wildcards: `*:*`, `create:*`, `*:posts`.

## Ownership / Policy System (Scoped Access)

The distinctive piece of najm-auth — declarative row-level scoping defined once per resource, applied to guards AND repository queries.

### Define an ownership token

```typescript
import { own, where, join } from 'najm-auth';

// Simple: user sees only their own products
const Product = own(productsTable)
  .for('user', where(productsTable.userId));   // admin bypasses implicitly

// With joins: teacher sees grades via students
const Grade = own(gradesTable)
  .for('teacher', join(grades.studentId, students.id), where(teachers.userId))
  .for('parent',  join(grades.studentId, students.id), where(parents.userId))
  .writeBy(grades.studentId);                   // verify ownership on create/update

// Custom admin roles
const Order = own(ordersTable, { adminRoles: ['admin', 'ops'] })
  .for('user', where(ordersTable.userId));
```

Admin roles (default `['admin']`) bypass scoping. Roles without rules get `WHERE 1=0` (deny-all).

### Apply via `@Policy` + `@Can*`

From [apps/playground/src/server/modules/product/ProductController.ts](apps/playground/src/server/modules/product/ProductController.ts):

```typescript
const Product = own(productsTable)
  .for('user', where(productsTable.userId));

@ToolGroup('products')                    // MCP prefix
@Policy(Product)                          // isAuth() on all routes + per-method Can()
@Controller('/products')
export class ProductController {
  @Get('/')       @CanList()    @McpTool('List all products')                 async getAll()  { … }
  @Get('/:id')    @CanRead()    @Validate({ params: productIdParam })         async getById() { … }
  @Post('/')      @CanCreate()  @Validate(createProductDto)                   async create()  { … }
  @Put('/:id')    @CanUpdate()  @Validate({ params, body })                   async update()  { … }
  @Delete('/:id') @CanDelete()                                                async delete()  { … }
}
```

`@Policy(token)` at class-decoration time:

1. Applies `isAuth()` to every method.
2. Scans methods for `@CanList / @CanRead / …` metadata.
3. For each, composes `Can('action:resourceName')` using the token's table name.

Each `@Can*` decorator has **three** uses:
- `@CanRead()` — policy mode, permission resolved from `@Policy` token.
- `@CanRead('posts')` — standalone → `Can('read:posts')`.
- `@CanRead(OtherToken)` — override token for this specific method.

### Repository-level scoping (`@Owned`)

```typescript
import { Owned } from 'najm-auth';

@Owned(Product)
@Repository()
class ProductRepository {
  @DB() db!: TDb;
  // findMany / findOne / scopedQuery / scope() are injected automatically
}
```

[OwnedDecorator.ts](packages/najm-auth/src/ownership/OwnedDecorator.ts) injects helpers that read the current ALS user via `ScopeContext` (request-cached on `REQUEST_ID` to avoid repeated ALS lookups) and apply the token's rules:

- `repo.findMany({ where?, orderBy?, limit? })` — scoped list.
- `repo.findOne({ where })` — scoped get.
- `repo.scopedQuery()` — raw drizzle builder for custom queries.
- `repo.scope(query)` — apply scope to any query.

When no ALS context is active (e.g. in seeds, cron jobs), queries run **unscoped** — let services gate non-request access explicitly.

## Database Schema

Five tables exported as `authSchema` per dialect: `usersTable`, `rolesTable`, `permissionsTable`, `tokensTable`, `rolePermissionsTable`.

Import dialect-specific (tree-shakeable):

```typescript
import { authSchema } from 'najm-auth/sqlite';   // or /pg
```

Compose with app tables — **never duplicate**:

[apps/playground/src/server/database/schema.ts](apps/playground/src/server/database/schema.ts):

```typescript
import { authSchema } from 'najm-auth/sqlite';
import { productsTable, ordersTable, orderItemsTable, cartItemsTable } from '../modules/...';

export const schema = {
  ...authSchema,
  products:   productsTable,
  orders:     ordersTable,
  orderItems: orderItemsTable,
  cartItems:  cartItemsTable,
};
```

**`tokens` table** holds refresh state — **one row per login session** (keyed by `tokenFamily`):

| Column | Purpose |
|---|---|
| `userId` | FK to users (indexed, **not** unique — a user has many sessions) |
| `token` | SHA-256 of current refresh JWT |
| `tokenFamily` | nanoid — **unique**, the session identifier; preserved across rotations |
| `expiresAt` | current token expiry (indexed; pruned by `deleteExpired`) |
| `previousHash` | SHA-256 of last token (grace window) |
| `previousValidUntil` | timestamp — 120s after rotation |
| `previousUsedAt` | timestamp — set when grace-window token is used (replay detection) |

### Migration: single-session → multi-session

Earlier versions stored **one refresh row per user** (`tokens.userId` unique) and
refresh JWTs carried only `userId`. The multi-session model makes `tokenFamily`
the unique key (one row per login) and embeds `tokenFamily` in every JWT.

Because old refresh JWTs have no `tokenFamily`, they cannot be mapped to a family
row — so the migration **clears existing token rows and users must log in again**.
Access tokens issued before the deploy stay valid until they expire (default 1h);
shorten `accessExpiresIn` ahead of the migration if that window matters.

Generate the canonical migration with `drizzle-kit generate` against the updated
schema. Reference SQL for hand-rolled migrations:

```sql
-- PostgreSQL
BEGIN;
DELETE FROM tokens;                                        -- old sessions can't map to a family
ALTER TABLE tokens DROP CONSTRAINT IF EXISTS tokens_user_id_unique;
ALTER TABLE tokens DROP CONSTRAINT IF EXISTS tokens_user_id_key;   -- whichever name exists (\d tokens)
ALTER TABLE tokens ALTER COLUMN token_family SET NOT NULL;
ALTER TABLE tokens ADD CONSTRAINT tokens_token_family_unique UNIQUE (token_family);
CREATE INDEX IF NOT EXISTS tokens_user_id_idx    ON tokens (user_id);
CREATE INDEX IF NOT EXISTS tokens_expires_at_idx ON tokens (expires_at);
COMMIT;
```

```sql
-- SQLite (a column-level UNIQUE can't be dropped in place → rebuild the table)
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
DELETE FROM tokens;                                        -- table is now empty, no data copy needed
ALTER TABLE tokens RENAME TO tokens_old;
CREATE TABLE tokens (
  id text PRIMARY KEY,
  created_at text,
  updated_at text,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL,
  token_family text NOT NULL UNIQUE,
  previous_hash text,
  previous_valid_until text,
  previous_used_at text,
  type text DEFAULT 'refresh',
  status text DEFAULT 'active',
  expires_at text NOT NULL
);
DROP TABLE tokens_old;
CREATE INDEX tokens_user_id_idx    ON tokens (user_id);
CREATE INDEX tokens_expires_at_idx ON tokens (expires_at);
COMMIT;
PRAGMA foreign_keys=ON;
```

## Seeding (`authSeed` factory)

[apps/playground/src/server/database/seed.ts](apps/playground/src/server/database/seed.ts):

```typescript
const seeder = await server.container.resolve(SeedService);
await seeder.run({
  ...authSeed({
    adminEmail: 'admin@admin.com',
    adminPass:  '12345678',
    permissions: authPermissionRows,           // [{action, resource, name, description}]
    additionalUsers: [
      { email, password, roleName, emailVerified, status, image }
    ],
  }),
  rolePermissions: {
    by: ['roleId', 'permissionId'],
    rows: (seeded) => { /* compute from seeded.roles, seeded.permissions */ },
  },
  products: { by: ['id'], onConflict: 'replace', rows: (seeded) => [...] },
}, { verbose: true, onConflict: 'skip', transaction: false });
```

Run inside `server.runAs(seedActor, …)` so ALS `USER` is populated — necessary for ownership-aware writes in downstream services/hooks.

## Client SDK (`najm-auth/client`)

Zero-dep fetch client. Works in browser, edge runtimes, Bun, Node 18+.

```typescript
import { createAuthClient } from 'najm-auth/client';

const client = createAuthClient({
  apiBaseURL: '/api',
  authPrefix: '/auth',
  refreshThreshold: 0.8,    // pre-emptively refresh when 80% of TTL elapsed
  tabSync: true,            // BroadcastChannel — one tab refresh propagates to all
});
```

**Behaviors:**
- Request methods auto-inject `Authorization: Bearer <accessToken>`.
- On 401 → call `/auth/refresh` → retry original request exactly once. Single-flight: concurrent 401s share one refresh promise.
- `refreshThreshold` triggers proactive refresh **before** expiry to avoid the 401 round-trip on the hot path.
- `TabSync` broadcasts login/logout/refresh across tabs so all open pages stay in sync without re-fetching.

Exports: `createAuthClient`, `NajmAuthClient`, `FetchClient`, `decodeToken`, `isTokenExpired`, `getTokenTTL`, `matchPermission`, `hasRole`, `hasAnyRole`, `TabSync`, `AuthError`.

## Next.js Integration (`najm-auth/client/server`)

**Single `defineAuth()` call** produces middleware + api client + server-session helper.

[apps/playground/src/lib/auth.ts](apps/playground/src/lib/auth.ts):

```typescript
import { defineAuth } from 'najm-auth/client/server';

export const auth = defineAuth({
  apiBaseURL: '/api',
  authPrefix: '/auth',
  refreshThreshold: 0.8,
  tabSync: true,
  loginRoute: '/login',
  afterLoginRoute: '/dashboard',
  publicRoutes:    ['/', '/login', '/register', '/forgot-password', '/reset-password'],
  protectedRoutes: ['/dashboard/:path*', '/account/:path*', '/admin/:path*'],
  roleRoutes:      { '/admin/:path*': ['admin'] },
});
```

Consumed three ways:

**Edge middleware** — [apps/playground/src/middleware.ts](apps/playground/src/middleware.ts):
```typescript
import { auth } from '@/lib/auth';
export const middleware = auth.middleware;
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'] };
```

The middleware reads the signed `najm.session` cookie (no DB, no API call — pure HMAC verify at the edge), extracts roles, and:
- Redirects unauthenticated users on `protectedRoutes` to `loginRoute`.
- Redirects authenticated users on `publicRoutes` like `/login` to `afterLoginRoute`.
- Enforces `roleRoutes` (e.g. `/admin/*` requires `admin` role).

**HTTP client** — [apps/playground/src/services/api/client.ts](apps/playground/src/services/api/client.ts):
```typescript
import { auth } from '@/lib/auth';
const api = auth.api;   // same client, pre-configured with auto-refresh

export const apiClient = {
  get: <T>(path) => api.get<T>(path).then(unwrapData),
  post: <T>(path, opts) => api.post<T>(path, opts).then(unwrapData),
  // ...
};
```

**React provider** — [apps/playground/src/app/providers.tsx](apps/playground/src/app/providers.tsx):
```typescript
<AuthProvider client={auth.client}>
  {children}
</AuthProvider>
```

**API route handler** — [apps/playground/src/app/api/[...route]/route.ts](apps/playground/src/app/api/[...route]/route.ts):
```typescript
import { handle } from 'najm-api';
import { server } from '@/server';

const adapt = handle(server);
export const GET = adapt;
export const POST = adapt;
export const PUT = adapt;
export const PATCH = adapt;
export const DELETE = adapt;
```

## React Bindings (`najm-auth/client/react`)

**Hooks:** `useAuth`, `useSession`, `useUser`, `useLogin`, `useLogout`, `useRegister`, `useForgotPassword`, `useResetPassword`, `useChangePassword`, `usePermissions`, `useAuthEvent(s)`.

**Components:** `AuthProvider`, `AuthGate`, `AuthBoundary`, `AuthLoading`, `SignedIn`, `SignedOut`, `IfAuth`, `Protected`, `Can`, `Role`, `PermissionList`, `LoginButton`, `SignOutButton`, `UserAvatar`, `UserName`, `UserEmail`, `UserRole`, `RedirectToLogin`.

Example ([apps/playground/src/components/auth/loginForm.tsx](apps/playground/src/components/auth/loginForm.tsx)):

```tsx
const { login, isLoading, error } = useLogin({
  onSuccess: () => router.replace('/dashboard'),
});

const onSubmit = (values) => login({ email: values.email, password: values.password });
```

## Full Request Flow — End-to-End

```
Browser
  │
  │ 1. GET /dashboard
  ▼
Next.js edge middleware (auth.middleware)
  │   reads najm.session cookie (HMAC verify, no DB)
  │   → authenticated user with 'user' role → continue
  │
  ▼
Next.js Server Component
  │   getServerSession() reads najm.session cookie (instant SSR)
  │
  ▼
Browser renders; client hydrates; useAuth() reads AuthProvider state

Browser makes an API call:
  │
  │ 2. GET /api/products/my (with auto-injected Bearer)
  ▼
Next.js /api/[...route]/route.ts → handle(server) → Hono
  │
  ▼
AuthResolver middleware (global '*')
  │   verifyAccessToken → signature OK, not blacklisted, sessionVersion matches
  │   set ALS: USER, ROLE='user', PERMISSIONS=[...]
  │
  ▼
RouterService dispatches to ProductController#getMyProducts
  │
  ▼
@isAuth() guard (from @Policy)            → passes
@canRead('products') (from @CanRead)      → user has 'read:products' → passes
  │
  ▼
Controller method: @User('id') resolved from ALS → service → repository
  │
  ▼
ProductRepository (@Owned(Product)) findByUserId (unscoped — explicit userId filter)
  │   OR: findMany() would auto-apply ownership scope via ScopeContext
  ▼
Drizzle query → DB → response → JSON

If access token has 30s left on next request, client pre-emptively:
  │
  │ 3. POST /auth/refresh (cookie refreshToken)
  ▼
AuthController#refreshTokens
  │   verifyRefreshToken → userId
  │   hash(cookie) matches current OR previous (grace) → rotate
  │   new accessToken + new refreshToken + new session cookie
  ▼
Response; client stores new access token; all tabs sync via BroadcastChannel
```

## Common Patterns & Gotchas

- **Always register `database()` before `auth()`** — plugin declares `.requires('database')`; missing dep throws.
- **Use `@Policy(Token) + @Can*()` over hard-coded permission strings** — single source of truth per resource, prevents drift between controller and permission table.
- **Use `@Owned(Token)` on the repository** — gives automatic row-level scoping without leaking role checks into services.
- **Import `authSchema` from dialect subpath** (`najm-auth/sqlite`) — keeps bundle small and types correct.
- **Don't duplicate auth tables** — always spread `...authSchema` into your combined schema.
- **Run seeds under `server.runAs(actor, …)`** — ALS `USER` needs populating for ownership-aware inserts.
- **Refresh endpoint is the only place that rotates** — `AuthResolver.resolveFromCookie()` is read-only to avoid races with concurrent requests.
- **Resolver order is Bearer token → refresh cookie when an Authorization header is present; session cookie → refresh cookie otherwise** — a presented Bearer token always goes through full verification (blacklist + session version) and cannot be shadowed by a stale session cookie. Cookie-only requests get the zero-I/O session-cookie hot path. An invalid/expired/blacklisted Bearer token may still fall back to a valid refresh cookie because the refresh row is the durable session source of truth and logout/password flows revoke that row whenever access tokens are invalidated.
- **Session cookie TTL should stay short** (5 min default) — it caches roles/permissions without checking DB or revocation cache; long TTL increases stale authz and copied-cookie revocation lag.
- **Sessions are multi-device** — `tokens.tokenFamily` is unique (one row per login session) and refresh writes upsert by family. A second login creates a new family without disturbing the first; refresh rotation, logout, and stale-token-reuse revocation are all scoped to a single family. Password change/reset revoke *all* of a user's sessions.
- **Prune abandoned sessions** — with one row per login, sessions a user never returns to would linger until expiry. Login prunes expired rows opportunistically; for users who never come back, call `authService.pruneExpiredSessions()` from a scheduled job (cron/queue) to reclaim them.
- **Bumping session version** (`invalidateUserAccessTokens`) is the nuclear option — kills all active sessions for a user in one cache write. Use on password change / reset / account takeover.
- **Use Redis for production revocation** — memory cache revocation state is process-local and disappears on restart.
- **Grace window on refresh** (120s) is deliberate — shorter breaks concurrent requests, longer widens replay window.
- **Rate-limit keys matter**: login/register hash the normalized email before it becomes part of the key; `cookieFingerprint` for refresh/me gives per-session fairness. Trust forwarded IP headers only behind a known proxy or provide custom rate-limit config.

## Key Files

| File | Purpose |
|---|---|
| [packages/najm-auth/src/AuthPlugin.ts](packages/najm-auth/src/AuthPlugin.ts) | Plugin factory, dependency registration, config merging, schema selection |
| [packages/najm-auth/src/auth/AuthController.ts](packages/najm-auth/src/auth/AuthController.ts) | HTTP endpoints, rate limits, validation |
| [packages/najm-auth/src/auth/AuthService.ts](packages/najm-auth/src/auth/AuthService.ts) | Login / logout / refresh / me / password flows |
| [packages/najm-auth/src/auth/AuthResolver.ts](packages/najm-auth/src/auth/AuthResolver.ts) | Global middleware that populates ALS on every request |
| [packages/najm-auth/src/auth/AuthGuard.ts](packages/najm-auth/src/auth/AuthGuard.ts) | `@isAuth()` |
| [packages/najm-auth/src/auth/CookieManager.ts](packages/najm-auth/src/auth/CookieManager.ts) | Refresh + session cookie read/write/clear |
| [packages/najm-auth/src/tokens/TokenService.ts](packages/najm-auth/src/tokens/TokenService.ts) | JWT gen, verify, blacklist, session-version, refresh rotation |
| [packages/najm-auth/src/ownership/scopedOwnership.ts](packages/najm-auth/src/ownership/scopedOwnership.ts) | `own() / .for() / where() / join() / OwnershipToken` |
| [packages/najm-auth/src/ownership/ScopeGuard.ts](packages/najm-auth/src/ownership/ScopeGuard.ts) | `@Policy`, `@CanList/@CanRead/…` |
| [packages/najm-auth/src/ownership/OwnedDecorator.ts](packages/najm-auth/src/ownership/OwnedDecorator.ts) | `@Owned`, `ScopeContext`, injected `findMany/findOne/scopedQuery` |
| [packages/najm-auth/src/client/NajmAuthClient.ts](packages/najm-auth/src/client/NajmAuthClient.ts) | Fetch client with auto-refresh and retry |
| [packages/najm-auth/src/client/server/defineAuth.ts](packages/najm-auth/src/client/server/defineAuth.ts) | Next.js middleware + api + server session helper |
