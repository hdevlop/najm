# Changelog

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
