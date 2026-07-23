# Changelog

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
