# Changelog

## 3.2.1 - 2026-09-03

- security(auth): return the same 401 response and perform a password-hash
  comparison for unknown, newly locked, and already locked identities
- feat(auth): add `publicRegistration: false` to omit the unauthenticated
  `POST /auth/register` controller without disabling internal provisioning

## 3.1.3 - 2026-08-12

- fix(client): keep authenticated transport available during ordinary anonymous
  hydration so credential-setup and other pre-authentication flows can run,
  while preserving the explicit post-logout transport latch

## 3.1.2 - 2026-08-12

- security(tokens): rotate refresh families with a conditional update instead
  of an upsert, so a concurrent logout cannot be undone by recreating its
  deleted token-family row
- fix(client): abort and drain an in-flight refresh before the final logout
  request, ignore refresh results from an older auth generation, and block
  late 401 interceptors from starting a new refresh until authentication is
  explicitly established again; abort authenticated requests that were still
  in flight when logout began and suspend new authenticated transport until a
  later login or authoritative authenticated hydration

## 3.1.1 - 2026-08-09

- docs: explain the App Router auth boundary in prose — why `auth.ts` and
  `session.ts` cannot be merged, why a protected layout needs
  `export const dynamic = 'force-dynamic'`, and why a strict guard must not
  be silenced with `.catch(() => null)`
- docs: add a per-app checklist rooted at the real Next.js production
  boundary rather than mocks
- chore(najm-cli): `najm init next` now offers to scaffold `src/lib/auth.ts`,
  `src/lib/session.ts`, and `src/proxy.ts` (with `najm-auth` and
  `server-only` as dependencies) and prints the protected-layout snippet

## 3.1.0 - 2026-08-09

- feat(client/server): add the `najm-auth/client/server/react` subpath exporting
  `createReactServerAuth(auth)`, which wraps session resolution in React's
  `cache()` so a root layout, nested layouts, and a page share one lookup and
  one recovery round trip per request instead of one each
- feat(client/server): resolve a session into a single classified outcome
  (`authenticated`, `unauthenticated`, `failed`) that both the optional
  `getSession()` view and the strict guards interpret, so the two can no longer
  duplicate work or diverge on what counts as unauthenticated
- feat(exports): the new subpath is opt-in and is not re-exported from the root,
  `client`, `client/react`, `client/edge`, or `client/server` entries; the Edge
  and proxy bundles stay free of React, and the `browser` export condition
  resolves to a module that throws so a Client Component or Edge import fails at
  build time
- docs: document the canonical `auth.ts` / `session.ts` / `proxy.ts` App Router
  structure, and that the adapter is for React Server Components only

## 3.0.0 - 2026-08-08

- feat(identity): normalize login identifiers through a configurable country
  preset, defaulting to Morocco, and use the same resolved identity for lookup,
  lockout accounting, and rate-limit bucketing
- fix(identity): scope the resolved identity policy to each Najm server and its
  request context, so multiple auth configurations in one process cannot
  replace each other's country preset
- feat(credential-setup): add durable `credential_setup_requirements` storage
  keyed on `(user_id, purpose)` for PostgreSQL and SQLite
- feat(credential-setup): mount a built-in `password` setup flow with
  `GET/POST /auth/credential-setup/{setup,change,cancel}` — always registered,
  inert until a user owes the purpose, and configurable only for policy
- feat(auth): accept `temporaryCredential` plus `requireCredentialSetup` on
  `provisionUser()`, marking the requirement in the same transaction and
  rejecting a permanent password in the same call
- feat(auth): accept an optional normalized `phone` on `provisionUser()`
- fix(auth): reject email-shaped phone values, preserve phone on invite-based
  provisioning, validate typed temporary credentials, and enforce bcrypt's
  72-byte boundary even when strength checks are intentionally skipped
- feat(auth): return a discriminated `LoginResult` — `authenticated`, or
  `credential_setup` with no usable tokens
- fix(auth): validate the login credential with login-only bounds instead of
  creation-time strength rules, which rejected valid stored passwords at the
  edge before authentication ran
- security(auth): refuse a normal session for a required user on every path —
  `establish()`, Google OAuth, refresh, and signed-session recovery — and revoke
  existing sessions when a requirement is marked
- security(auth): fail closed on an unknown stored temporary-credential kind
  rather than falling back to a different normalizer
- feat(client): `login()` and `useLogin()` accept `identifier`/`rememberMe`,
  return `LoginResult`, and apply tokens only for `authenticated`
- fix(client): recognize credential-setup responses in both top-level and
  standard `{ data }` response shapes
- feat(client/server): `withAuthCookiePersistence` recognizes Najm's own setup
  response without configuration and clears the remembered preference once
  setup completes
- feat(exports): add the `najm-auth/identity/ma` subpath with
  `moroccanCinTemporaryCredential` and `moroccoIdentityPreset`

**Breaking:** `NajmAuthClient.login()` and `useLogin().login()` now resolve to
`LoginResult` instead of `AuthUser`; branch on `nextStep`. A custom `AuthSchema`
must supply `credentialSetupSessions` and `credentialSetupRequirements`.

## 2.0.7

- fix(client): support an explicit loopback-only recovery endpoint for
  self-hosted Next.js deployments that cannot hairpin through their public
  reverse-proxy origin
- feat(client): expose a secret-free recovery diagnostic hook with distinct
  fetch, HTTP, Set-Cookie, parsing, HMAC, and payload failure categories
- test(client): build and run a real Next.js 16 production proxy under Bun,
  then verify login and protected navigation with `verifyAlways: true`

## 2.0.6

- security(client): restrict server-side signed-session recovery to relative or
  exact same-origin endpoints before forwarding the configured refresh cookie
- security(client): reject recovery URL credentials, scheme/host/port changes,
  hostname and username lookalikes, and invalid cookie header input before
  `fetch()`
- test(client): cover same-origin recovery, pre-fetch rejection, isolated
  refresh-cookie forwarding, and secret-free logs
- chore(security): update vulnerable runtime and test dependency paths; the
  release gate now passes `bun audit` without exclusions

## 2.0.5

- fix(client): recover missing, expired, or tampered signed sessions through a
  non-rotating `POST /auth/session/recover` validation path
- fix(client): forward recovered signed sessions into the current Next.js RSC
  request and browser response while preserving the five-minute staleness bound
- fix(auth): reject recovery and refresh for inactive/deleted users without
  weakening refresh-family reuse detection
- fix(client): give `verifyAlways` authoritative, tested behavior instead of
  silently ignoring it
- test(auth): cover exact expiry boundaries, malformed claims, recovery,
  concurrency, prefetch, role checks, and Edge-only Web Crypto

## 2.0.4

- fix(client): verify the HMAC-signed `najm.session` cookie locally in Next.js
  middleware instead of forwarding cookie-only requests to bearer-only
  `/auth/me`
- fix(client): reject missing, malformed, expired, or tampered sessions; use
  verified role claims for route authorization; clear auth cookies on invalid
  protected navigation
- fix(client): share Edge-safe Web Crypto verification and claim/expiration
  validation with server `getSession()` and backend cookie reads
- test(client): cover Kafil login/refresh cookie preservation and protected
  dashboard/operator navigation

## 2.1.0

- feat(oauth): add Google OpenID Connect authorization-code flow with state,
  nonce, PKCE, JWKS ID-token verification, hosted-domain policy, and safe
  frontend redirects
- feat(auth): add provider-account schemas for PostgreSQL and SQLite plus
  explicit/default-safe account linking
- feat(client): expose Google login/link/completion methods, React hooks,
  `GoogleLoginButton`, and `OAuthCallback`
- refactor(auth): share Najm session issuance between password and Google login

## 1.1.32

- fix(resolver): make cookie-based auth read-only in middleware (no token rotation). Rotation is now reserved for `/auth/refresh`. Prevents a race between concurrent requests where middleware rotation could invalidate the refresh token mid-flight, triggering 401 on `/auth/refresh` and causing "redirect to login after a few reloads".

## 1.1.31

- fix(resolver): fall back to refresh cookie when bearer token fails (fixes logout with expired access token + valid cookies)
- feat(react): AuthProvider now auto-refreshes access token on hydrate without gating render
- feat(react): add AuthBoundary for opt-in loading fallbacks
