# najm-auth

Production-ready authentication and authorization library for the Najm framework. Provides JWT-based authentication, role-based access control (RBAC), permission-based access control (PBAC), and row-level ownership scoping.

**Features:**
- ✅ JWT authentication (access + refresh token strategy)
- ✅ Automatic token rotation and blacklist-based revocation
- ✅ Role-based access control (RBAC) with hierarchies
- ✅ Permission-based access control (PBAC) with wildcards
- ✅ Row-level ownership scoping for multi-tenant apps
- ✅ Built-in password reset flow with email support
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
  ...authSchema,  // users, roles, permissions, tokens, rolePermissions
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
| `POST` | `/auth/logout` | Logout and revoke tokens | ✅ Required |
| `GET` | `/auth/me` | Get current user profile | ✅ Required |
| `POST` | `/auth/forgot-password` | Request password reset | None |
| `POST` | `/auth/reset-password` | Confirm password reset | None |
| `GET` | `/auth/oauth/google/start` | Start Google sign-in | None |
| `GET` | `/auth/oauth/google/callback` | Verify Google callback and create Najm session | None |
| `POST` | `/auth/oauth/google/link` | Link Google to the current user | ✅ Required |

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
```

Existing databases must generate and run a migration after upgrading so the
new `oauth_accounts` table exists. Custom `AuthSchema` objects may omit
`oauthAccounts` while OAuth is disabled, but Google configuration fails fast
unless the custom schema supplies it.

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
| `POST /auth/login` | 5 | 15 minutes | IP |
| `POST /auth/refresh` | 15 | 15 minutes | Cookie fingerprint |
| `POST /auth/logout` | 10 | 15 minutes | User ID |
| `GET /auth/me` | 30 | 1 minute | User ID |
| `POST /auth/forgot-password` | 3 | 15 minutes | IP |
| `POST /auth/reset-password` | 5 | 15 minutes | IP |

### Customizing Rate Limits

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
- Session cookies are signed, short-lived, and checked against session version
  invalidation.

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
