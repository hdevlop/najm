# najm-auth

Production-ready authentication and authorization library for the Najm framework. Provides JWT-based authentication, role-based access control (RBAC), permission-based access control (PBAC), and row-level ownership scoping.

**Features:**
- ✅ JWT authentication (access + refresh token strategy)
- ✅ Automatic token rotation and blacklist-based revocation
- ✅ Role-based access control (RBAC) with hierarchies
- ✅ Permission-based access control (PBAC) with wildcards
- ✅ Row-level ownership scoping for multi-tenant apps
- ✅ Built-in password reset flow with email support
- ✅ Forced first-login credential setup for provisioned accounts
- ✅ Country identity presets so `06…` and `+2126…` resolve to one account
- ✅ Multi-dialect support (PostgreSQL, SQLite)
- ✅ Type-safe decorators with TypeScript
- ✅ Rate limiting on auth endpoints
- ✅ Internationalization (i18n) for all messages
- ✅ Google OpenID Connect sign-in with PKCE and explicit account linking

---

## Installation

```bash
bun add najm-auth
# Peer dependencies
bun add hono drizzle-orm reflect-metadata
```

---

## Quick Setup

### 1. Initialize Database

```typescript
// src/database/schema.ts
import { authSchema } from 'najm-auth';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Your app tables
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  userId: text('userId').notNull(),
});

// Combined schema (always include authSchema)
export const schema = {
  ...authSchema,  // includes users, tokens, and credentialSetupSessions
  products,
};

// src/database/index.ts
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { schema } from './schema';

const sqlite = new Database('./app.db');
export const db = drizzle(sqlite, { schema });
```

### 2. Configure Auth Plugin

```typescript
// src/main.ts
import 'reflect-metadata';
import { Server } from 'najm-core';
import { database } from 'najm-database';
import { auth } from 'najm-auth';
import { db } from './database';

const server = new Server()
  .use(database({ default: db }))  // Required: database must be registered first
  .use(auth({
    dialect: 'sqlite',  // Auto-selects SQLite schema
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET!,    // Required
      refreshSecret: process.env.JWT_REFRESH_SECRET!,  // Required
      accessExpiresIn: '15m',       // Optional, default: 1h
      refreshExpiresIn: '7d',       // Optional, default: 7d
    },
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',  // For password reset links
  }))
  .load(/* your controllers and services */)
  .listen(3000);
```

### 3. Set Environment Variables

```bash
# .env
JWT_ACCESS_SECRET=<32-character-minimum-secret>
JWT_REFRESH_SECRET=<32-character-minimum-secret>
FRONTEND_URL=https://app.example.com
# Optional Google sign-in
GOOGLE_CLIENT_ID=<google-web-client-id>
GOOGLE_CLIENT_SECRET=<google-web-client-secret>
# Optional for a split frontend/API deployment. Otherwise FRONTEND_URL is used.
GOOGLE_CALLBACK_URL=https://app.example.com/api/auth/oauth/google/callback
```

> ⚠️ **Security:** Generate secrets with `openssl rand -base64 32`

---

## Configuration Reference

### AuthPluginConfig

```typescript
auth({
  // Database
  dialect?: 'pg' | 'sqlite'              // Default: 'pg' (RETURNING-capable engines only)
  schema?: AuthSchema                      // Override dialect schema

  // JWT
  jwt?: {
    accessSecret: string                   // Required, min 32 chars
    accessExpiresIn?: string               // Default: 1h
    refreshSecret: string                  // Required, min 32 chars
    refreshExpiresIn?: string              // Default: 7d
  }

  // Cookies
  refreshCookieName?: string               // Default: 'refreshToken'

  // Database
  database?: string                        // Default: 'default'
  blacklistPrefix?: string                 // Default: 'auth:blacklist:'

  // Registration
  defaultRole?: string | null              // Auto-assign role to new users
  bcryptRounds?: number                    // Default: 10 (valid: 4-31)

  // Frontend
  frontendUrl?: string                     // Password reset link base URL

  // Login identifier normalization (see "Identity presets")
  identity?: {
    preset?: 'ma' | 'tn' | IdentityPreset | null   // Default: 'ma'
    extend?: IdentityNormalizer[]                  // Runs before the preset
  }

  // Credential setup policy overrides (the flow itself is always on)
  credentialSetup?: {
    password?: {
      passwordSchema?: ZodType<string>     // Default: 8-72 bytes, a letter and a digit
      ttlMs?: number                       // Default: 600000 (10 minutes)
      cookieName?: string                  // Default: 'najm.credential-setup'
    }
  }

  // Optional Google OpenID Connect
  oauth?: {
    google?: true | {
      clientId?: string                    // Or GOOGLE_CLIENT_ID
      clientSecret?: string                // Or GOOGLE_CLIENT_SECRET
      callbackUrl?: string                 // Or GOOGLE_CALLBACK_URL; otherwise frontendUrl + /api/auth/oauth/google/callback
      frontendCallbackPath?: string        // Default: /auth/oauth/callback
      errorRedirectPath?: string           // Default: /login
      allowSignup?: boolean                // Default: true
      autoLinkVerifiedEmail?: boolean      // Default: false
      allowedHostedDomains?: string[]      // Validates the Google hd claim
    }
  }

  // Dependencies (forwarded to plugins)
  validation?: ValidationPluginConfig
  rateLimit?: RateLimitPluginConfig
})
```

---

## Auto-Registered Routes

All routes are prefixed with `/auth` and auto-registered by the plugin.

### Authentication Routes

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/auth/register` | Register new user | None |
| `POST` | `/auth/login` | Login with email/password | None |
| `POST` | `/auth/refresh` | Refresh access token (cookie) | None (uses refresh cookie) |
| `POST` | `/auth/session/recover` | Reissue signed session without token rotation | Refresh cookie + recovery header |
| `POST` | `/auth/logout` | Logout and revoke tokens | ✅ Required |
| `GET` | `/auth/me` | Get current user profile | ✅ Required |
| `POST` | `/auth/forgot-password` | Request password reset | None |
| `POST` | `/auth/reset-password` | Confirm password reset | None |
| `GET` | `/auth/oauth/google/start` | Start Google sign-in | None |
| `GET` | `/auth/oauth/google/callback` | Verify Google callback and create Najm session | None |
| `POST` | `/auth/oauth/google/link` | Link Google to the current user | ✅ Required |
| `GET` | `/auth/credential-setup/setup` | Read the pending setup session | Setup cookie |
| `POST` | `/auth/credential-setup/change` | Replace the temporary credential | Setup cookie |
| `POST` | `/auth/credential-setup/cancel` | Abandon the setup session | Setup cookie |

### Identity presets

Login lookup, lockout accounting, and rate-limit bucketing all normalize the
submitted identifier the same way. The pipeline is: email (lowercased) →
project extensions → the country preset → generic E.164.

The resolved pipeline belongs to the specific `auth()` plugin/server instance.
Multiple isolated Najm servers can therefore use different country presets in
one process without replacing each other's login or rate-limit behavior.

Morocco is the default, so `0612345678`, `212612345678`, and `+212612345678`
all resolve to `+212612345678` with no configuration.

```typescript
auth();                                                  // preset: 'ma'
auth({ identity: { extend: [employeeNumberNormalizer] } });
auth({ identity: { preset: 'tn' } });                    // replaces Morocco
auth({ identity: { preset: null, extend: [custom] } });  // generic only
```

Local numbers are country-ambiguous, so presets **replace** each other rather
than stacking — two presets claiming `06…` would resolve one raw input to two
different accounts.

### First-login credential setup

Provision an account with a temporary credential and Najm refuses it a normal
session until the holder replaces it:

```typescript
import { moroccanCinTemporaryCredential } from 'najm-auth/identity/ma';

await authService.provisionUser({
  email: guardian.email,
  phone: guardian.phone,
  role: 'family',
  temporaryCredential: moroccanCinTemporaryCredential(guardian.cin),
  requireCredentialSetup: 'password',
});
```

`temporaryCredential` also accepts a plain string, compared exactly and
case-sensitively — enough for a student or registration number:

```typescript
await authService.provisionUser({
  email: student.schoolEmail,
  role: 'student',
  temporaryCredential: student.registrationNumber,
  requireCredentialSetup: 'password',
});
```

Supplying both `password` and `temporaryCredential` is rejected, so an account
can never hold a permanent password that something also treats as temporary.
Typed helpers such as `moroccanCinTemporaryCredential()` validate their value,
and every temporary credential remains limited to bcrypt's 72-byte boundary.

Login then answers a discriminated result instead of a token pair:

```typescript
const result = await auth.client.login({ identifier, password, rememberMe });

if (result.nextStep === 'credential_setup') {
  router.push('/change-password');   // no tokens were issued
} else {
  router.push('/dashboard');
}
```

The requirement is enforced at every session-establishment path — password
login, `AuthSessionService.establish()`, Google OAuth (which redirects with
`oauthError=oauth_credential_setup_required`), refresh, and signed-session
recovery — so verified-email OAuth linking cannot skip it. Marking a new
requirement also revokes the user's current sessions.

`withAuthCookiePersistence` recognizes logout and setup boundaries on its own.
After a successful logout it drops stale auth-cookie issuances and guarantees
exactly one deletion for each configured auth cookie. It preserves a valid
upstream deletion (including a custom cookie path), or synthesizes a canonical
deletion when one is missing. A setup response gets the same auth-cookie
deletions, clears the remembered preference, and leaves the opaque setup cookie
alone.

### Google Sign-In

Google sign-in uses the server-side OpenID Connect authorization-code flow.
Najm creates state, nonce, and PKCE values, verifies Google's signed ID token,
then issues the same Najm JWT, refresh token, and session cookie as password
login. Google tokens are discarded and are never stored.

```ts
auth({
  dialect: 'pg',
  frontendUrl: 'https://app.example.com',
  oauth: { google: true },
})
```

With `google: true`, credentials come from `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET`; the callback defaults to
`${FRONTEND_URL}/api/auth/oauth/google/callback`. Register that value exactly
as an authorized redirect URI in Google Cloud. Set `GOOGLE_CALLBACK_URL` or
`google: { callbackUrl: '...' }` when the API runs on a different origin.
Production callback URLs must use HTTPS; HTTP is accepted only for localhost.

Mount the browser completion route configured by `frontendCallbackPath`:

```tsx
'use client';

import { OAuthCallback } from 'najm-auth/client/react';

export default function OAuthCallbackPage() {
  return <OAuthCallback fallback={<p>Finishing sign-in...</p>} />;
}
```

Then use the headless button anywhere below `AuthProvider`:

```tsx
import { GoogleLoginButton } from 'najm-auth/client/react';

<GoogleLoginButton returnTo="/dashboard">
  <button type="button">Continue with Google</button>
</GoogleLoginButton>
```

Google accounts are keyed by Google's stable `sub` claim. If an existing Najm
user has the same email but is not linked, sign-in fails with
`oauth_account_link_required` by default. After password login, call
`client.linkOAuthAccount('google')` to prove control of both accounts. Setting
`autoLinkVerifiedEmail: true` opts into verified-email linking.

### Admin Routes (all require `@isAdmin()`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/users?limit=50&offset=0` | List users (limit 1-100) |
| `GET` | `/users/:id` | Get user by ID |
| `POST` | `/users` | Create new user |
| `PUT` | `/users/:id` | Update user |
| `DELETE` | `/users/:id` | Delete user |
| `GET` | `/roles` | List all roles |
| `GET` | `/roles/:id` | Get role by ID |
| `POST` | `/roles` | Create new role |
| `PUT` | `/roles/:id` | Update role |
| `DELETE` | `/roles/:id` | Delete role |
| `GET` | `/permissions` | List all permissions |
| `GET` | `/permissions/:id` | Get permission by ID |
| `POST` | `/permissions` | Create new permission |
| `PUT` | `/permissions/:id` | Update permission |
| `DELETE` | `/permissions/:id` | Delete permission |
| `POST` | `/permissions/assign/:roleId/:permissionId` | Assign permission to role |
| `DELETE` | `/permissions/remove/:roleId/:permissionId` | Remove permission from role |

---

## Guards Reference

### Authentication Guard

```typescript
import { isAuth } from 'najm-auth';

@Controller('/api/posts')
class PostController {
  @Get('/')                    // Public
  getAll() { }

  @Post('/')
  @isAuth()                    // Requires valid JWT
  create(@Body() data: any) { }
}
```

### Role Guards

```typescript
import { defineRoles } from 'najm-auth';

const roles = defineRoles({
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  USER: 'user',
}, {
  superRoles: ['ADMIN'],       // admin also passes moderator/user role guards
});

export const { isAdmin, isModerator, isUser } = roles;

@Controller('/admin')
@isAdmin()                     // All methods require admin role
class AdminController {
  @Get('/users')
  getUsers() { }
}

@Controller('/api/posts')
class PostController {
  @Delete('/:id')
  @isModerator()               // Method-level guard
  deletePost() { }
}
```

### Permission Guards

```typescript
import { Can, canRead, canCreate, canUpdate, canDelete } from 'najm-auth';

@Controller('/api/posts')
class PostController {
  @Get('/')
  @canRead('posts')            // Requires 'read:posts' permission
  getAll() { }

  @Post('/')
  @canCreate('posts')          // Requires 'create:posts' permission
  create(@Body() data: any) { }

  @Put('/:id')
  @canUpdate('posts')          // Requires 'update:posts' permission
  update() { }

  @Delete('/:id')
  @canDelete('posts')          // Requires 'delete:posts' permission
  delete() { }

  @Post('/:id/publish')
  @Can('publish:posts')        // Custom permission
  publish() { }
}
```

**Permission Wildcards:**
- `*:*` — All actions on all resources
- `create:*` — Create action on any resource
- `*:posts` — Any action on posts

### Combined Guards

```typescript
@Controller('/admin/reports')
@isAdmin()                     // Require admin role
class ReportController {
  @Get('/financial')
  @Can('view:financial')       // AND require financial view permission
  getFinancial() { }
}
```

---

## Ownership System

Control row-level access based on ownership (e.g., users see only their own data).

### Declaring Ownership Rules

```typescript
import { own, join, where } from 'najm-auth';
import { schema } from '../database/schema';

const { products, users } = schema;
const _users = alias(users, '_u');

export const Product = own(products)
  .for('user',
    join(products.userId, _users.id),
    where(_users.id)
  )
  .writeBy(products.userId);  // Enforce on create/update
```

### Using @Policy and @Owned

```typescript
import { configureOwnership, Policy, CanList, CanRead, CanCreate, CanUpdate, CanDelete } from 'najm-auth';

const config = configureOwnership({
  adminRoles: ['admin'],
  rules: {
    'user': {
      'products': Product.getRules()['user']
    }
  }
});

@Policy(Product)
@Controller('/api/products')
export class ProductController {
  @Get('/')
  @CanList()                   // List only owned products
  getAll(@GuardParams() filter: any) { }

  @Get('/:id')
  @CanRead()                   // Read only if owner
  getOne() { }

  @Post('/')
  @CanCreate()                 // Create (ownership assigned automatically)
  create(@Body() data: any) { }

  @Put('/:id')
  @CanUpdate()                 // Update only if owner
  update(@Body() data: any) { }

  @Delete('/:id')
  @CanDelete()                 // Delete only if owner
  delete() { }
}

@Repository('default')
@Owned(Product)
export class ProductRepository {
  @DB() db!: Database;

  // Auto-scoped to current user
  async findMany(opts?: { where?: any; limit?: number }) {
    return this.findMany(opts);  // Only returns owned products
  }

  async findOne(opts: { where: any }) {
    return this.findOne(opts);   // Returns null if not owned
  }

  async scopedQuery() {
    return this.scopedQuery();   // Raw scoped query builder
  }
}
```

### Advanced Ownership: Multi-Role Scoping

```typescript
const Grade = own(grades)
  // Teachers see students' grades
  .for('teacher',
    join(grades.studentId, _s.id),
    join(_s.id, _t.studentId),
    where(_t.userId)
  )
  // Parents see only their child's grades
  .for('parent',
    join(grades.studentId, _s.id),
    join(_s.id, _p.studentId),
    where(_p.userId)
  );
```

---

## Database Schema

### Tables

```
users
├── id (string, primary key)
├── email (string, unique)
├── password (string, hashed)
├── emailVerified (boolean, default: false)
├── image (string, nullable)
├── status (enum: ACTIVE, INACTIVE)
├── roleId (string, FK → roles.id)
├── lastLogin (timestamp, nullable)
├── createdAt (timestamp)
└── updatedAt (timestamp)

roles
├── id (string, primary key)
├── name (string, unique)
├── description (string, nullable)
├── createdAt (timestamp)
└── updatedAt (timestamp)

permissions
├── id (string, primary key)
├── name (string, unique)
├── description (string, nullable)
├── resource (string)
├── action (string)
├── createdAt (timestamp)
└── updatedAt (timestamp)

tokens
├── id (string, primary key)
├── userId (string, FK → users.id, unique)
├── token (string, hashed)
├── type (enum: REFRESH, RESET)
├── status (enum: ACTIVE, REVOKED)
├── expiresAt (timestamp)
├── createdAt (timestamp)
└── updatedAt (timestamp)

role_permissions
├── id (string, primary key)
├── roleId (string, FK → roles.id)
├── permissionId (string, FK → permissions.id)
├── createdAt (timestamp)
└── updatedAt (timestamp)

oauth_accounts
├── id (string, primary key)
├── userId (string, FK → users.id, cascade delete)
├── provider (string; `google` in this release)
├── providerAccountId (Google `sub`)
├── unique(provider, providerAccountId)
└── unique(userId, provider)

credential_setup_sessions
├── id (string, primary key)
├── userId (string, FK → users.id, cascade delete)
├── purpose (string)
├── tokenHash (string, unique — SHA-256 of the browser cookie)
├── expiresAt (timestamp)
├── consumedAt (timestamp, nullable)
└── revokedAt (timestamp, nullable)

credential_setup_requirements
├── userId (string, FK → users.id, cascade delete)
├── purpose (string; `password` for the built-in flow)
├── temporaryCredentialKind (string, nullable; `exact` or `ma-cin`)
├── required (boolean, default: true)
├── completedAt (timestamp, nullable)
└── primary key (userId, purpose)
```

`credential_setup_requirements` is keyed on `(userId, purpose)` rather than
`userId` alone, so one user can owe more than one future setup purpose.

Existing databases must generate and run a migration after upgrading so the
new `oauth_accounts`, `credential_setup_sessions`, and
`credential_setup_requirements` tables exist. Custom `AuthSchema` objects may
omit `oauthAccounts` while OAuth is disabled, but Google configuration fails
fast unless the custom schema supplies it. Both credential-setup tables are
required of a custom schema, because the setup flow is always mounted.

### ID Strategy

Uses `nanoid` with short lengths for efficient storage:
- Users: 8 characters
- Roles: 5 characters
- Permissions: 5 characters
- Tokens: 10 characters

To use UUIDs instead, customize the schema:

```typescript
import { customAlphabet } from 'nanoid';
import { uuid } from 'uuid';

// Use UUID for larger ID space
const customUsers = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  // ...
});
```

---

## Seeding

### Low-Level Seeding (authSeed)

```typescript
import { authSeed } from 'najm-auth';
import { SeedService } from 'najm-database';

@Service()
class SetupService {
  constructor(private seeder: SeedService) {}

  async seed() {
    const entries = authSeed({
      adminEmail: 'admin@app.com',
      adminPass: 'AdminPass123!',
      roles: [
        { name: 'editor', description: 'Can edit content' },
        { name: 'viewer', description: 'Can view only' },
      ],
      permissions: [
        { name: 'read:posts', resource: 'posts', action: 'read' },
        { name: 'create:posts', resource: 'posts', action: 'create' },
      ],
      additionalUsers: [
        { email: 'user@app.com', password: 'User123!', roleName: 'viewer' },
      ]
    });

    await this.seeder.run(entries);
  }
}
```

### High-Level Seeding (seedAuthData)

```typescript
import { seedAuthData } from 'najm-auth';

await seedAuthData({
  db,
  adminEmail: process.env.ADMIN_EMAIL!,
  adminPassword: process.env.ADMIN_PASSWORD!,
  roles: [
    { name: 'moderator', description: 'Content moderator' },
  ],
  users: [
    { email: 'mod@app.com', password: 'Mod123!' , roleName: 'moderator' },
  ],
  verbose: true
});

// Note: Return type has empty users[] and roles[] arrays
// Query the database directly to retrieve inserted records
```

---

## Rate Limiting

Auth routes have built-in rate limiting to prevent brute force attacks.
The auth plugin registers `najm-rate` as a dependency, so these decorator-level
limits are active when `auth()` is registered.

| Route | Limit | Window | Key Strategy |
|-------|-------|--------|--------------|
| `POST /auth/register` | 5 | 15 minutes | IP |
| `POST /auth/login` | 8 | 10 minutes | IP + hashed normalized identity |
| `POST /auth/refresh` | 15 | 15 minutes | Cookie fingerprint |
| `POST /auth/session/recover` | 120 | 1 minute | Cookie fingerprint |
| `POST /auth/logout` | 10 | 15 minutes | User ID |
| `GET /auth/me` | 30 | 1 minute | User ID |
| `POST /auth/forgot-password` | 3 | 15 minutes | IP |
| `POST /auth/reset-password` | 5 | 15 minutes | IP |

### Customizing Rate Limits

The login route has strict environment overrides. Values are read when the
server imports `najm-auth`, so restart the process after changing them. Invalid
values fail startup rather than silently weakening the limiter.

```bash
NAJM_AUTH_LOGIN_RATE_LIMIT_ENABLED=true
NAJM_AUTH_LOGIN_RATE_LIMIT=8
NAJM_AUTH_LOGIN_RATE_WINDOW=10m
```

`NAJM_AUTH_LOGIN_RATE_LIMIT_ENABLED=false` disables only the login-route
limiter. Keep it enabled on public production deployments; a shorter window is
the safer setting for a disposable production-built demo.

The generic plugin configuration remains available for global limits and skip
rules:

```typescript
auth({
  rateLimit: {
    keyGenerator: 'ip',        // or 'user', 'api-key', 'user+ip'
    defaultWindow: '10m',
    skip: (ctx) => ctx.path === '/health'  // Skip for certain routes
  }
})
```

---

## Next.js App Router Structure

Every App Router application keeps the same four files. Copying more than this
between apps means logic that belongs in the package has leaked into them.

```text
src/lib/auth.ts     defineAuth() configuration — browser, server, and proxy safe
src/lib/session.ts  one createReactServerAuth() instance for Server Components
src/proxy.ts        exports auth.proxy plus Next's required static matcher
src/app/api/[...route]/route.ts  binds the server through auth.routeHandlers()
```

```typescript
// src/lib/auth.ts
import { defineAuth } from 'najm-auth/client/server';

export const auth = defineAuth({
  apiBaseURL: '/api',
  loginRoute: '/login',
  forbiddenRoute: '/forbidden',
  publicRoutes: ['/', '/login'],
  protectedRoutes: ['/dashboard/:path*', '/admin/:path*'],
  roleRoutes: { '/admin/:path*': ['admin'] },
  proxySessionMode: 'optimistic',
});
```

```typescript
// src/lib/session.ts
import 'server-only';

import { createReactServerAuth } from 'najm-auth/client/server/react';

import { auth } from './auth';

export const serverAuth = createReactServerAuth(auth);
```

```typescript
// src/proxy.ts
import { auth } from './lib/auth';

export default auth.proxy;
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

Next.js 16 requires the exported Proxy `config` to be a statically analyzable
object literal. Turbopack rejects `export const config = auth.config`, so the
matcher is the one integration value that cannot be composed at runtime.

```typescript
// src/app/api/[...route]/route.ts
import { handle } from 'najm-core';
import server from '@app/server';

import { auth } from '../../../lib/auth';

const handlers = auth.routeHandlers(handle(server));
export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = handlers;
```

`auth.routeHandlers()` applies the remember-me lifecycle to login, refresh,
credential setup, and logout for every supported Next.js verb. It automatically
uses the refresh and signed-session cookie names from `defineAuth()`; an app only
passes an option when it intentionally customizes behavior, such as
`{ rememberCookieName: 'school.remember' }`.

### Why `session.ts` exists

A Next.js page is not one function. The root layout, each nested layout, and the
page render separately, and each one that asks for the session pays for its own
cookie verification and possibly its own recovery round trip. React's `cache()`
collapses those into one — but only for callers that go through the *same*
memoized function, which means the application has to own one module that
creates it. `session.ts` is that module and nothing else; strictness, redirect
targets, role fallback, and error classification all stay in the package.

```tsx
// Root layout, nested layout, and page: one resolution between them.
const session = await serverAuth.getSession();      // null when anonymous
const session = await serverAuth.requireSession();  // redirects to loginRoute
const session = await serverAuth.requireRole(['admin', 'operator']);
```

- `requireSession()` redirects to `loginRoute` when the visitor is missing,
  invalid, or revoked. An unreachable recovery endpoint or an unset session
  secret is an operational fault, not an anonymous visitor: those stay visible
  errors instead of becoming a login redirect that hides the outage.
- `requireRole()` redirects to `forbiddenRoute`, never to login — the visitor is
  already authenticated, so signing in again cannot change the answer.
- `session.roles` is authoritative when present, with `user.role` as the
  single-role fallback.

### Scope and limits

- **React Server Components only.** Route handlers, server actions, proxy/Edge
  code, and scripts keep using `auth.getSession()`, `auth.requireSession()`, and
  `auth.requireRole()`. Outside a render there is no request cache for `cache()`
  to write to, so the adapter would resolve the session again on every call.
- **Call the factory once, at module scope.** Calling it inside a layout, page,
  or component builds a fresh memoized resolver per call and shares nothing.
- **The snapshot is stable for one render.** Code that mutates authentication
  must redirect or refresh into a new render to observe the result.
- **Requests never share.** The cache is React's per-request cache — no module
  map, no global, no Redis, no `unstable_cache`, no `"use cache"`.
- **Requires React 18.3 or newer** (the first version exporting `cache()`); the
  factory throws a named error on older versions. The subpath is opt-in, so
  non-React consumers of `najm-auth` are unaffected. Importing it from a Client
  Component or the Edge runtime fails at build time.

### `auth.ts` and `session.ts` cannot be merged

Two files looks like one too many until you try it. Both directions fail, for
the same reason in mirror image:

| Module | Must be reachable from | Must never be reachable from |
|---|---|---|
| the `defineAuth()` module | browser, Edge, server | — |
| the `createReactServerAuth()` module | server only | browser, Edge |

`auth.client` and `auth.api` are what Client Components call, and
`auth.proxy` is what the Edge proxy calls, so the `defineAuth()` module is
always in the browser and Edge graphs. The adapter must never be. Putting both
in one file puts the adapter everywhere `auth` already is, and the `browser`
export condition — which exists precisely to catch this — resolves to a module
that throws:

```text
The export createReactServerAuth was not found in module
  …/najm-auth/dist/client/server/reactClientGuard.js [app-client]

Import traces:
  Middleware:               ./src/lib/auth.ts → ./src/proxy.ts
  Client Component Browser: ./src/lib/auth.ts → … → ./src/app/dashboard/page.tsx
  Client Component SSR:     ./src/lib/auth.ts → … → ./src/app/dashboard/page.tsx
  Server Component:         ./src/lib/auth.ts → ./src/lib/session.ts → layout.tsx
```

Renaming the files changes nothing; there simply have to be two. This is a
property of the runtime boundary, not of the package.

### Protected trees must opt out of prerendering

`requireSession()` reads a per-request cookie. A route Next.js tries to
prerender has no request, so the read fails and the guard reports a
configuration error — correct behavior, wrong context. Mark the protected
segment dynamic:

```tsx
// src/app/(dashboard)/layout.tsx
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }) {
  await serverAuth.requireSession();
  return <Shell>{children}</Shell>;
}
```

`getSession()` needs no such opt-out — it returns `null` rather than throwing,
so a prerendered public page renders anonymous. Do not "fix" a prerender failure
by wrapping a strict guard in `.catch(() => null)`; that turns a real outage
into a silently anonymous page.

### What the app owns, what the package owns

| App, via `defineAuth()` | Package |
|---|---|
| `loginRoute`, `forbiddenRoute`, route matchers, `roleRoutes` | when to redirect where |
| cookie names, `apiBaseURL`, `authPrefix`, recovery URL | request memoization |
| `refreshThreshold`, `tabSync`, `proxySessionMode` | strict vs optional semantics |
| — | `session.roles` / `user.role` fallback |
| — | error classification |

If a new app has to copy anything beyond the four files above, that logic
belongs in the package instead.

`proxySessionMode: 'optimistic'` is the default and locally verifies the signed
snapshot, matching Next.js guidance that Proxy is an optimistic routing boundary.
Use `'authoritative'` only when every protected navigation must also validate
refresh-session state. The older `verifyAlways` option and `auth.middleware`
property remain as deprecated compatibility aliases.

### What a new app must prove

At its real Next.js production boundary, not with mocks:

- two concurrent renders never observe each other's session;
- root layout, nested layout, and page resolve once per render — measurable by
  counting recovery round trips;
- anonymous navigation to a protected route redirects to `loginRoute`;
- an authenticated role mismatch reaches `forbiddenRoute` without a login loop;
- an unset session secret or an unreachable recovery endpoint stays a visible
  failure rather than a login redirect;
- the Edge/proxy bundle builds without pulling in React.

---

## TypeScript Types

```typescript
import type {
  AuthUser,           // { id, email, name?, role?, permissions? }
  TokenPair,          // { accessToken, refreshToken, expiresAt? }
  JwtPayload,         // { userId, jti, exp?, iat? }
  AuthConfig,         // Full resolved config
  AuthPluginConfig,   // User-facing config
} from 'najm-auth';
```

---

## Error Handling

All errors are i18n-based. Error messages are automatically localized.

### Common Error Codes

| HTTP | Scenario |
|------|----------|
| 400 | Invalid input (bad email format, weak password) |
| 401 | Missing or invalid authentication (bad token, no header) |
| 403 | Forbidden (lacks required role/permission) |
| 409 | Conflict (email already registered) |
| 429 | Rate limited (too many requests) |
| 500 | Server error (email send failure, DB error) |

### Examples

```typescript
// Invalid credentials
throw new HttpError(401, 'Invalid email or password');

// User already exists
throw new HttpError(409, 'Email already registered');

// Insufficient permissions
throw new HttpError(403, 'Insufficient permissions for this action');
```

---

## Security Considerations

### Security Defaults

- JWT access and refresh secrets are required and must pass minimum strength
  checks.
- Refresh tokens rotate by session family and suspected family compromise does
  not revoke unrelated user sessions.
- Password reset and password change revoke existing user sessions.
- Login uses a dummy password hash for missing users to reduce timing leaks.
- Forgot-password responses avoid email enumeration.
- Auth routes register `najm-rate` and ship route-level brute-force limits.
- Session cookies are signed and short-lived; server auth resolution checks
  their session version.
- Expired signed sessions recover through authoritative, non-rotating refresh
  validation; middleware verifies the reissued HMAC before using its claims.
- Server-side recovery sends only the configured refresh cookie and accepts
  relative or exact same-origin endpoints. URL credentials and any
  scheme/hostname/port change are rejected before the network request.
- Self-hosted apps may explicitly use a loopback-only `internalRecoveryURL`
  when their public reverse-proxy origin is not reachable from the app process.
- `onRecoveryFailure` exposes structured, secret-free recovery diagnostics
  without logging anything by default.
- `proxySessionMode: 'authoritative'` forces that check on every protected
  request; the default `'optimistic'` mode bounds cached role/status staleness
  to `session.maxAge`. The deprecated `verifyAlways` flag maps to the same
  behavior for existing applications.

### Next.js 16 Reverse-Proxy Recovery

When a self-hosted Next.js proxy cannot safely call its own public
reverse-proxy origin while handling that same request, configure the exact
loopback recovery endpoint:

```env
NAJM_AUTH_INTERNAL_URL=http://127.0.0.1:3000/api/auth/session/recover
```

`defineAuth()` reads this environment variable automatically. An explicit
`internalRecoveryURL` option takes precedence. The internal URL must use HTTP
or HTTPS, contain no URL credentials, and resolve to `localhost`, `127.0.0.1`,
or `::1`; Najm never guesses a loopback endpoint. Relative and exact
same-origin `recoveryURL` values remain supported.

The recovery request forwards only the configured refresh cookie, requires
`X-Najm-Session-Recovery: 1`, never rotates the refresh token, HMAC-verifies
the returned session cookie, and fails closed. `onRecoveryFailure` receives
only a structured reason and bounded, sanitized fetch-error metadata; callback
errors cannot change the authentication result.

### Password Reset Tokens

⚠️ **Current behavior:** Reset tokens use JWT expiry (default 1h) for single-use validation. To add database-backed single-use tokens:

```typescript
// In AuthService.resetPassword():
async resetPassword(token: string, newPassword: string) {
  const userId = this.tokenService.verifyResetToken(token);
  // ... update password ...
  // Blacklist the reset token to prevent reuse
  await this.tokenService.blacklistCurrentToken(token);
}
```

### Purpose-Bound Credential Setup

Use `CredentialSetupService` when valid credentials should open only a
short-lived setup flow, not a complete application session. The default auth
schema includes the durable `credential_setup_sessions` table for PostgreSQL
and SQLite; generate and apply a consumer migration after upgrading.

```typescript
import { AuthService, CredentialSetupService } from 'najm-auth';

const options = {
  purpose: 'password-setup',
  cookieName: 'my-app.password-setup',
  ttlMs: 10 * 60 * 1000,
};

// Verify the password without minting access/refresh tokens.
const user = await authService.verifyCredentials({ identifier, password });

// Or narrowly accept only an unverified pending account with one exact role.
const pendingSponsor = await authService.verifyPendingCredentials(
  { identifier, password },
  'sponsor',
);

if (await appRequiresPasswordSetup(user.id)) {
  // Revokes normal sessions and writes only an HttpOnly, SameSite=Strict,
  // browser-session cookie. The database stores only its SHA-256 hash.
  return credentialSetup.begin(user.id, options);
}

return authService.establishSession(user);

// Complete an app-owned mutation in the same transaction as one-time
// consumption. If the callback fails, token consumption rolls back.
await credentialSetup.consume(options, async ({ userId }) => {
  await replaceApplicationCredential(userId, newCredential);
});
```

Setup tokens are bound to a server-owned purpose, expire automatically, are
replaced when the same user starts that purpose again, and can be cancelled or
consumed exactly once. `require()` validates the current setup cookie without
consuming it; `cancel()` revokes it and clears the cookie.

### Session Management

- Sessions are multi-device: the token table stores one refresh row per login session (keyed by a unique `tokenFamily`), so a user can stay logged in on several devices at once. Logout and rotation are scoped to the current session; password change/reset revoke every session
- A stale refresh token presented after the 120-second rotation grace window revokes only that session's family as reuse protection
- The signed session cookie is accepted for up to its configured TTL (5 minutes by default) without a database or revocation-cache read
- Use `@RateLimit` on logout for DDoS protection

### Token Blacklist

- Built-in cache-based blacklist for immediate revocation
- Supports Redis via `cache()` plugin configuration
- Default: in-memory store (development/single-process only; entries are lost on restart)
- Use Redis in production when immediate revocation must survive restarts or propagate across instances
- Session-version revocation keys are cache-backed and TTL-bound to active access tokens

### Timing Attack Prevention

- Dummy hash used for missing users in login
- Constant-time password comparison
- Same response for forgot-password (prevents email enumeration)

---

## Testing

```bash
bun run test      # Run all tests
bun run test:auth # Run auth tests only
```

Test files include:
- `schema.test.ts` — Schema exports validation
- `auth.test.ts` — Authentication flow
- `user.test.ts` — User CRUD
- `role.test.ts` — Role management
- `permission.test.ts` — Permission guards
- `guards.test.ts` — Guard composability
- `ownership.test.ts` — Row-level scoping
- `integration.test.ts` — Multi-role scenarios

---

## Production Checklist

- ✅ Use strong JWT secrets (32+ chars, generated with `openssl rand -base64 32`)
- ✅ Set `FRONTEND_URL` environment variable
- ✅ Enable HTTPS in production
- ✅ Store secrets in environment variables (never in code)
- ✅ Use Redis for token blacklist/session-version revocation in production and distributed systems
- ✅ Trust forwarded IP headers only behind a known proxy; otherwise provide a custom rate-limit key generator
- ✅ Login/register rate keys hash normalized email or international-phone identifiers; passwords and request bodies never appear in cache keys
- ✅ Enable rate limiting on all auth routes
- ✅ Log authentication events for audit trails
- ✅ Test ownership scoping rules with multi-user scenarios
- ✅ Run full test suite before deploying

---

## Migration Guide

### From v1.0 to v1.1

- `FRONTEND_URL` now part of `AuthPluginConfig` (falls back to env var)
- New: Rate limiting on `/auth/logout` and `/auth/me`
- New: `configureOwnership()` for advanced scoping
- New: `@Policy` and `@Owned` decorators

---

## Support & Contributing

For issues, feature requests, or contributions, please refer to the main Najm repository: https://github.com/najm/najm-api
