# Google Sign-In Plan for `najm-auth`

Status: implemented locally; live Google credential validation and release remain pending
Target: the next minor `najm-auth` release, with matching `najm-api` exports
Last verified against the repository: 2026-07-17

## 1. Objective

Add a production-ready Google sign-in flow to `najm-auth` and expose it through
the framework-agnostic client and React package.

A consuming application should be able to:

1. Enable Google in `auth()` with its Google OAuth client credentials.
2. Render a headless `GoogleLoginButton` or call `useGoogleLogin()`.
3. Send the browser through Google's authorization-code flow.
4. Return through a backend callback that verifies the Google identity.
5. Create, resolve, or explicitly link the corresponding Najm user.
6. Finish with the existing Najm access-token, refresh-token, session-cookie,
   role, permission, revocation, and multi-tab behavior.

This is authentication only. Google Drive, Calendar, Gmail, offline access, and
storage of Google access or refresh tokens are not part of this work.

## 2. Verified baseline

The current package has no Google implementation even though `oauth` appears in
its package keywords.

- `AuthPluginConfig` has no provider configuration.
- `AuthController` exposes password registration/login, refresh, logout,
  password reset, and `/me`; it has no OAuth routes.
- `users.password` is required in both PostgreSQL and SQLite.
- There is no provider-account table keyed by Google's stable `sub` claim.
- `NajmAuthClient.login()` and `useLogin()` accept only email/password.
- The existing auth session contract keeps the access token in client memory
  and refresh/session data in HTTP-only cookies.
- `najm-auth/client/react` uses headless components that wire behavior into a
  caller-provided child. Google UI must follow the same convention.
- `najm-api` selectively re-exports commonly used `najm-auth` types and helpers,
  so its aggregate surface must be updated deliberately.

## 3. Protocol and security decisions

These decisions are fixed for the first implementation.

### 3.1 Use OpenID Connect authorization-code flow

- Use Google's web-server authorization-code flow.
- Request only `openid email profile`.
- Generate and validate a cryptographically random `state` value.
- Generate and validate an OpenID Connect `nonce`.
- Add PKCE using `S256`, even though this is a confidential web client.
- Exchange the authorization code only on the Najm server.
- Never accept an unverified profile supplied directly by browser code.
- Never put a Najm token, Google token, authorization code, client secret, or
  ID token in a frontend redirect URL.

### 3.2 Verify the Google identity locally

Add `jose` as a direct `najm-auth` runtime dependency and use Google's remote
JWKS to verify the ID token. Validation must cover:

- signature;
- issuer (`https://accounts.google.com`, with the documented legacy issuer
  accepted only if the verifier requires it);
- configured client ID as audience;
- expiry and not-before handling;
- the exact nonce created for this login attempt;
- non-empty `sub`;
- non-empty email and `email_verified === true`;
- `hd` when the application configures an allowed hosted-domain list.

Use Google's `sub` as the provider-account identifier. Email can locate a
possible existing Najm account, but it must not be the durable Google identity
key.

### 3.3 Preserve Najm as the session issuer

Google proves identity; it does not replace the Najm session model. After a
successful Google callback, Najm must issue its normal access/refresh tokens and
signed session cookie through the same code path used by password login.

Factor the common post-authentication work out of `AuthService.loginUser()` into
an injectable `AuthSessionService` (final name may match the neighboring naming
style). Both password login and Google login must use it for:

- active-account enforcement;
- expired-session cleanup;
- token generation;
- refresh cookie creation;
- signed session-cookie creation;
- `lastLogin` update;
- sanitized user output.

This prevents the Google path from creating a second, subtly different session
lifecycle.

### 3.4 Do not store Google tokens

The package needs only the verified ID-token claims to sign the user into Najm.
Discard Google's access token and ID token after verification. Do not request
`access_type=offline`, and do not request or persist a Google refresh token.

### 3.5 Use safe account-linking defaults

Resolution order after ID-token verification:

1. Find `oauth_accounts(provider='google', providerAccountId=sub)`.
2. If found, load that user and start a Najm session.
3. If no link exists but a Najm user has the same normalized email:
   - default: reject with the stable error `oauth_account_link_required`;
   - optional application policy: auto-link only when
     `autoLinkVerifiedEmail: true` and Google verified the email;
   - preferred manual path: the user signs in normally and explicitly links
     Google from an authenticated session.
4. If neither a link nor a user exists:
   - create a user when `allowSignup` is true;
   - otherwise reject with `oauth_signup_disabled`.

The default must not silently attach a Google identity to an existing password
account based on email alone. The explicit linking flow proves control of both
the current Najm account and the Google account.

Returning Google users are resolved by `sub`. Do not automatically overwrite a
Najm user's email, name, role, status, or image when Google profile claims later
change.

### 3.6 Keep redirect handling closed

- `callbackUrl` is an absolute backend URL and must exactly match the Google
  Cloud authorized redirect URI.
- Per-request `returnTo` values must be relative application paths.
- Reject protocol-relative paths, foreign origins, credentials, and non-HTTP(S)
  schemes.
- Resolve successful and error destinations against the configured
  `frontendUrl` only.
- Redirect errors with stable codes such as `oauth_access_denied`,
  `oauth_state_invalid`, `oauth_provider_error`,
  `oauth_account_link_required`, `oauth_signup_disabled`, and
  `oauth_account_inactive`.
- Never forward Google's raw error description or token response to the
  frontend URL.

## 4. Target public API

Names below are the planned contract. If implementation reveals a naming
collision, update this plan before changing the public API.

### 4.1 Server configuration

```ts
auth({
  dialect: 'pg',
  frontendUrl: 'https://app.example.com',
  oauth: { google: true },
})
```

Planned input types:

```ts
export interface GoogleOAuthConfig {
  clientId?: string;
  clientSecret?: string;
  callbackUrl?: string;
  frontendCallbackPath?: string;
  errorRedirectPath?: string;
  allowSignup?: boolean;
  autoLinkVerifiedEmail?: boolean;
  allowedHostedDomains?: string[];
}

export interface OAuthConfig {
  google?: true | GoogleOAuthConfig;
}
```

`clientId` and `clientSecret` may fall back to `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET`. `callbackUrl` may fall back to `GOOGLE_CALLBACK_URL`,
then `frontendUrl + /api/auth/oauth/google/callback`. Enabling Google without
complete credentials or a valid callback URL must fail during plugin
configuration, not on the first login.

Resolved defaults:

- `frontendCallbackPath`: `/auth/oauth/callback`
- `errorRedirectPath`: `/login`
- `allowSignup`: `true`
- `autoLinkVerifiedEmail`: `false`
- `allowedHostedDomains`: unrestricted when empty

### 4.2 Server routes

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/auth/oauth/google/start` | Public | Validate `returnTo`, create state/nonce/PKCE data, set the short-lived state cookie, and redirect to Google. |
| `GET` | `/auth/oauth/google/callback` | Public | Validate the callback, resolve the Google identity, establish the Najm session, then redirect to the frontend callback page. |
| `POST` | `/auth/oauth/google/link` | Required | Create an explicit Google-link attempt for the currently authenticated user and return the Google authorization URL. |

Apply rate limits independently:

- start: by IP;
- callback: by IP plus a hashed state/cookie fingerprint;
- link: by authenticated user.

The callback must accept Google's documented error response as well as the
successful `code` and `state` response.

### 4.3 Framework-agnostic client

Add the following to `NajmAuthClient`:

```ts
type OAuthProvider = 'google';

interface OAuthLoginOptions {
  returnTo?: string;
}

getOAuthLoginUrl(provider: OAuthProvider, options?: OAuthLoginOptions): string;
loginWithOAuth(provider: OAuthProvider, options?: OAuthLoginOptions): void;
loginWithGoogle(options?: OAuthLoginOptions): void;
linkOAuthAccount(provider: OAuthProvider, options?: OAuthLoginOptions): Promise<void>;
completeOAuthLogin(): Promise<AuthUser>;
```

Behavior:

- `getOAuthLoginUrl()` safely combines `baseURL`, `authPrefix`, provider, and
  `returnTo`; it supports relative and absolute configured API base URLs.
- `loginWithOAuth()` performs a full-page navigation to the start route.
- `loginWithGoogle()` is the discoverable Google convenience wrapper.
- `linkOAuthAccount()` calls the protected link route with the existing bearer
  token, receives the authorization URL, then navigates to Google.
- `completeOAuthLogin()` calls the existing refresh flow, fetches `/auth/me`,
  broadcasts the restored state to other tabs, and emits the existing `login`
  event.

The core client must remain browser-framework agnostic and must not import
React, Next.js, `jose`, or server-only provider code.

### 4.4 React exports

Add:

```ts
useGoogleLogin(options?)
useOAuthCallback(options?)
GoogleLoginButton
OAuthCallback
```

`useGoogleLogin()` exposes at least:

```ts
{
  loginWithGoogle(options?: OAuthLoginOptions): void;
  linkGoogle(options?: OAuthLoginOptions): Promise<void>;
  isRedirecting: boolean;
  error: AuthError | Error | null;
}
```

`GoogleLoginButton` follows the existing headless component convention:

```tsx
<GoogleLoginButton returnTo="/dashboard">
  <button type="button">Continue with Google</button>
</GoogleLoginButton>
```

It clones exactly one clickable child, wires the Google redirect, preserves an
existing disabled state, and does not impose visual branding. Applications
remain responsible for following Google's current button-branding rules.

`OAuthCallback` is mounted by the consuming frontend at
`frontendCallbackPath`. It calls `completeOAuthLogin()`, restores the client
access token from the backend refresh cookie, and replaces the current URL with
the validated `returnTo` path. It must expose loading and error render props or
fallbacks instead of requiring Next.js.

Example callback page:

```tsx
'use client';

import { OAuthCallback } from 'najm-auth/client/react';

export default function AuthCallbackPage() {
  return (
    <OAuthCallback
      fallback={<p>Finishing sign-in...</p>}
      errorFallback={({ error }) => <p>{error.message}</p>}
    />
  );
}
```

## 5. Schema and migration

### 5.1 Add a provider-account table

Add `oauthAccountsTable` in both `src/schema/pg.ts` and
`src/schema/sqlite.ts` with the same logical columns:

| Column | Contract |
| --- | --- |
| `id` | Najm-generated primary key. |
| `userId` | Required FK to `users.id`, cascade on delete. |
| `provider` | Required provider name; initially `google`. |
| `providerAccountId` | Required stable provider identity; Google's `sub`. |
| `createdAt` | Creation timestamp. |
| `updatedAt` | Update timestamp. |

Constraints and indexes:

- unique `(provider, providerAccountId)`;
- unique `(userId, provider)` for one linked account per provider in v1;
- index `userId`;
- index `provider` only if query evidence shows it is needed beyond the unique
  composite index.

Export the table and the inferred `OAuthAccount` / `NewOAuthAccount` types from
the root and both dialect subpaths. Add `oauthAccounts` to each built-in
`authSchema` object.

### 5.2 Preserve the password column in this release

Do not make `users.password` nullable in the first Google release. A newly
created Google-only user receives a cryptographically random, never exposed
password that is immediately hashed through the existing password service.
This preserves current schema and password-login assumptions while making the
password computationally unusable.

If that user later completes the existing password-reset flow, the account
becomes a supported hybrid password-plus-Google account.

Never log or return the generated plaintext value.

### 5.3 Custom-schema compatibility

Make `AuthSchema.oauthAccounts` optional at the TypeScript boundary so existing
custom schemas do not break merely by upgrading. When Google is enabled, plugin
configuration must fail clearly if the selected custom schema does not provide
`oauthAccounts`.

Document the required PostgreSQL and SQLite migration. Built-in schema users
receive the table through `...authSchema`; existing databases still need to run
their normal Drizzle generate/migrate workflow.

## 6. Internal implementation map

Add a bounded OAuth module instead of growing `AuthController` and
`AuthService` into provider-specific monoliths.

Planned files:

```text
packages/najm-auth/src/oauth/
  OAuthController.ts
  OAuthService.ts
  OAuthStateService.ts
  OAuthAccountRepository.ts
  OAuthAccountService.ts
  OAuthDto.ts
  types.ts
  index.ts
  google/
    GoogleOAuthProvider.ts
    GoogleTokenVerifier.ts
```

Responsibilities:

- `OAuthController`: transport only; query/body extraction, route decorators,
  rate limits, and Hono redirects.
- `OAuthService`: start, callback, completion, and explicit-link orchestration.
- `OAuthStateService`: generate state/nonce/PKCE values, encrypt/decrypt the
  short-lived cookie payload, clear it after callback, and validate `returnTo`.
- `OAuthAccountRepository`: provider-account persistence and uniqueness queries.
- `OAuthAccountService`: account resolution, safe linking policy, signup, race
  handling, and user-status checks.
- `GoogleOAuthProvider`: Google authorization URL and code exchange.
- `GoogleTokenVerifier`: JWKS-backed ID-token verification and normalized claims.
- `OAuthDto`: query/body schemas and exported DTO types where useful.

Register the module from `AuthPlugin.ts`, export only the intended public types
and helpers from `src/index.ts`, and keep repositories/provider internals out of
the default public API unless consumers genuinely need them.

### 6.1 OAuth attempt cookie

Store the short-lived attempt data in an authenticated-encrypted HTTP-only
cookie using the existing `EncryptionService` and `CookieService`:

```ts
interface OAuthAttempt {
  provider: 'google';
  intent: 'login' | 'link';
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  userId?: string;
  sessionVersion?: number;
  createdAt: number;
}
```

Cookie requirements:

- one cookie per state so parallel tabs do not overwrite each other;
- HTTP-only;
- `SameSite=Lax` so it is sent on Google's top-level callback;
- secure in production through the cookie plugin's resolved policy;
- path `/`, because a Najm server may itself be mounted below `/api`;
- ten-minute maximum age;
- cleared on success and every handled failure;
- ciphertext authenticated by AES-GCM through `EncryptionService`.

For explicit linking, bind the attempt to the authenticated user and session
version and revalidate that account before writing the link.

### 6.2 Callback transaction and races

Creating a new user and its provider link must be transactional. The unique
provider-account constraint remains the final concurrency guard. If two valid
callbacks race, catch the unique conflict, re-read the provider account, and
continue only with the user that owns the established link.

Never leave a provider account linked to a missing user, and never move an
existing provider account from one user to another.

## 7. Errors, localization, and logging

Add English locale keys under the existing auth namespace for:

- provider disabled or misconfigured;
- invalid/expired OAuth state;
- Google access denied;
- Google code exchange failed;
- Google ID-token verification failed;
- verified email required;
- account link required;
- provider account already linked;
- signup disabled;
- inactive or pending account;
- OAuth login/link success where a response message is used.

Operational logs may contain the provider, stable internal error code, and a
request correlation identifier. They must not contain:

- client secret;
- authorization code;
- code verifier;
- state or nonce plaintext;
- Google/Najm tokens;
- complete ID-token claims.

Map provider/network failures to stable public errors. Preserve the underlying
error only in redacted server logs.

## 8. Implementation phases

### Phase 1 - Contract and schema

- [x] Add `GoogleOAuthConfig`, resolved config, defaults, and fail-fast checks.
- [x] Add `oauthAccountsTable` for PostgreSQL and SQLite.
- [x] Extend built-in `authSchema` objects and dialect/root exports.
- [x] Add `OAuthAccountRepository` and repository tests.
- [x] Document migration and custom-schema requirements.

Exit gate: both dialect schemas build, uniqueness behavior is tested, and
Google cannot be enabled without a usable provider-account schema.

### Phase 2 - Google protocol implementation

- [x] Add direct `jose` dependency.
- [x] Implement state, nonce, and PKCE generation.
- [x] Implement the encrypted attempt cookie and redirect sanitizer.
- [x] Build the Google authorization URL.
- [x] Exchange the code at Google's token endpoint.
- [x] Verify ID-token signature and claims through JWKS.
- [x] Add hosted-domain enforcement.
- [x] Add mocked protocol tests; no test may require live Google credentials.

Exit gate: invalid state, nonce, issuer, audience, signature, expiry, hosted
domain, and unverified email all fail closed.

### Phase 3 - User resolution and Najm sessions

- [x] Extract shared session issuance from password login.
- [x] Resolve returning users by provider plus `sub`.
- [x] Implement new-user signup with an unguessable generated password.
- [x] Implement safe existing-email behavior and the opt-in auto-link policy.
- [x] Implement authenticated explicit linking.
- [x] Enforce active/pending account behavior consistently.
- [x] Add transaction and concurrent-callback handling.
- [x] Confirm Google tokens are discarded after verification.

Exit gate: password login tests remain green and every Google outcome produces
either the standard Najm session or a stable, non-leaking error.

### Phase 4 - Routes and browser completion

- [x] Add start, callback, and link routes.
- [x] Apply route-specific rate limits.
- [x] Set/clear attempt cookies on every state-bearing callback path.
- [x] Redirect success to `frontendCallbackPath` without credentials in the URL.
- [x] Redirect failures to `errorRedirectPath` with stable error codes only.
- [x] Add `NajmAuthClient` URL, redirect, link, and completion methods.
- [x] Restore access-token/client state through the existing refresh flow.
- [x] Reuse the existing `login` event and tab-sync behavior.

Exit gate: a full mocked browser flow can leave the site, return, rebuild client
state, and reach `returnTo` without exposing a token in history or query params.

### Phase 5 - React, playground, and public exports

- [x] Add `useGoogleLogin` and `useOAuthCallback`.
- [x] Add headless `GoogleLoginButton` and `OAuthCallback`.
- [x] Export the new client and React contracts from their current subpaths.
- [x] Update `najm-api` aggregate server exports/types where appropriate.
- [x] Add optional Google configuration to the playground using environment
  variables; the playground must still start when Google is disabled.
- [x] Add the Google button to the playground login form.
- [x] Add the frontend callback route to the playground.
- [ ] Add a disabled/no-credentials playground test path.

Exit gate: a consuming app needs no deep imports and can render its own Google
button using only documented public APIs.

### Phase 6 - Documentation and release

- [x] Update `packages/najm-auth/README.md` quick setup, configuration, routes,
  schema list, error behavior, and security notes.
- [x] Update `packages/najm-auth/NAJM_AUTH.md` architecture and migrations.
- [x] Update `packages/najm-auth/docs/CLIENT_SDK.md` with client/React examples.
- [x] Update `packages/najm-auth/CHANGELOG.md`.
- [x] Document Google Cloud client creation and the exact authorized redirect
  URI for standalone and Next-hosted Najm servers.
- [x] Document explicit linking and the default rejection of implicit email
  linking.
- [x] Update the checked public API snapshot intentionally.
- [ ] Run the package and aggregate release checks before publishing.

Exit gate: docs are sufficient to configure a fresh app without reading source,
and the published tarball exposes all declared types and subpath exports.

## 9. Required tests

### Configuration and URL tests

- [x] Google omitted: existing auth behavior and routes are unaffected.
- [x] Google enabled with missing ID, secret, callback URL, or schema: fail fast.
- [x] Callback URL validation covers malformed URLs and production HTTP.
- [x] Authorization URL contains code response type, fixed identity scopes,
  state, nonce, and PKCE S256 challenge.
- [x] `returnTo` accepts local paths and rejects open-redirect variants.

### Provider verification tests

- [x] Valid locally signed Google-shaped ID token succeeds against mocked JWKS.
- [x] Invalid signature, issuer, audience, expiry, nonce, or `sub` fails.
- [x] Missing/unverified email fails.
- [x] Hosted-domain allowlist validates the `hd` claim rather than email suffix.
- [x] Provider timeout/non-JSON/bad status becomes a stable public error.

### Persistence and linking tests

- [x] New Google identity creates one user and one provider account.
- [x] Returning `sub` resolves the original user even if the Google email changes.
- [x] Existing email is not linked by default.
- [x] Opt-in verified-email auto-link works and unverified email never auto-links.
- [ ] Authenticated explicit link works.
- [x] Linking a `sub` owned by another user fails.
- [ ] Duplicate/concurrent callback cannot create duplicate users or links.
- [x] User deletion cascades to provider accounts.
- [x] No Google token is persisted.

### Session and route tests

- [x] Google login receives the same roles/permissions/session-version behavior
  as password login.
- [ ] Inactive/pending users cannot bypass status checks.
- [x] Callback sets refresh and signed session cookies.
- [ ] Completion refreshes the client access token and fetches the user.
- [x] Success/error redirects contain no credentials or provider payloads.
- [x] Attempt cookie is rejected when missing, expired, changed, or replayed.
- [ ] Attempt cookie is cleared on success, denial, and handled error.
- [ ] Rate limits are scoped correctly and do not share password-login buckets.
- [x] Password login, refresh rotation, logout, reset, SSR hydration, and
  middleware regression tests remain green.

### Client and React tests

- [x] Relative and absolute `baseURL` values produce correct start URLs.
- [x] `authPrefix` overrides are honored.
- [ ] `GoogleLoginButton` requires one child and preserves explicit disabled
  state.
- [x] `useGoogleLogin` surfaces link-request failures.
- [x] `OAuthCallback` completes once under React Strict Mode.
- [ ] Completion success emits login and tab sync once.
- [x] Completion failure renders the documented error fallback.

## 10. Verification commands

Run from the repository root. Do not claim completion until all applicable
commands pass.

```powershell
bun install
bun run build:auth
bun run test:auth
bun run build:najm
bun run test:najm
bun run --cwd apps/playground db:generate
bun run build:playground
bun run test:playground:e2e
bun run api:check
bun scripts/publish-package.ts najm-auth --dry-run
bun scripts/publish-package.ts najm-api --dry-run
```

Local verification on 2026-07-17:

- `bun run build:auth`: pass.
- `bun run test:auth`: pass, 72 tests and 186 assertions, including the `google: true` environment/default-resolution coverage.
- `bun run build:najm`: pass.
- `bun run test:najm`: pass, 3 tests and 10 assertions.
- `bun run --cwd apps/playground db:generate`: pass; Google table migration is
  `drizzle/0004_mixed_captain_britain.sql`.
- `bunx tsc --noEmit -p apps/playground/tsconfig.json`: pass.
- `bun run test:playground:e2e`: pass, 6 tests and 19 assertions.
- `bun run api:check`: pass after intentional snapshot creation.
- `bun run build:playground`: pass. The build is self-contained: Studio CSS is
  emitted without incompatible Tailwind v4 layer wrappers, and the API route
  loads the Najm server only at request time.
- `najm-auth` publish dry-run produced the expected 17-file tarball, then npm
  rejected the already-published `2.0.1` version. No version was bumped or
  published.
- `npm.cmd pack --dry-run --workspace najm-auth` and `najm-api`: pass; both
  package contents are ready for a versioned release.

Also run a production-like manual flow with real Google test credentials:

- [ ] new Google user;
- [ ] returning linked user;
- [ ] user denies consent;
- [ ] existing-email account requires linking by default;
- [ ] authenticated explicit link;
- [ ] inactive/pending user;
- [ ] expired/replayed callback;
- [ ] logout and subsequent Google login;
- [ ] standalone Najm server origin;
- [ ] Next.js-hosted `/api/[...route]` origin.

Record the exact authorized redirect URIs and command results in the release
notes. Never commit the test client secret.

## 11. Definition of done

- [x] `auth({ oauth: { google: ... } })` is typed, validated, and documented.
- [x] PostgreSQL and SQLite expose the provider-account schema.
- [x] Google identities are keyed by verified `sub`, not email.
- [x] State, nonce, PKCE, ID-token validation, safe redirects, and rate limits
  are enforced.
- [x] Existing-email linking is explicit by default.
- [x] Password and Google login share one Najm session-issuance path.
- [x] No Google or Najm credential appears in redirect URLs or logs.
- [x] Core client, React hooks/components, and aggregate exports are usable from
  published package subpaths.
- [x] Playground demonstrates the complete flow without requiring Google config
  for normal startup/tests.
- [ ] Focused auth, aggregate API, playground, public API, and release gates pass.
- [x] README, deep auth guide, client SDK guide, migration notes, and changelog
  agree with the implementation.

## 12. Explicitly deferred

- Other identity providers.
- Google One Tap and popup UX.
- Mobile/native Google Sign-In SDK integration.
- Google API authorization beyond identity scopes.
- Storage/refresh of Google access tokens.
- Multiple Google accounts linked to one Najm user.
- Account unlinking UI and provider-management dashboard.
- Automatic cross-account protection/webhook handling.
- Changes to Kafil; Kafil integration starts only after this package surface is
  implemented, published, and installed there.

## 13. Primary references

- Google OpenID Connect server flow and ID-token validation:
  https://developers.google.com/identity/openid-connect/openid-connect
- Google OpenID Connect claims and discovery metadata:
  https://developers.google.com/identity/openid-connect/reference
- Google OAuth web-server redirect and callback requirements:
  https://developers.google.com/identity/protocols/oauth2/web-server
- Google guidance for resolving new, legacy, and returning accounts:
  https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
