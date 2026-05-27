# Changelog

## 1.1.32

- fix(resolver): make cookie-based auth read-only in middleware (no token rotation). Rotation is now reserved for `/auth/refresh`. Prevents a race between concurrent requests where middleware rotation could invalidate the refresh token mid-flight, triggering 401 on `/auth/refresh` and causing "redirect to login after a few reloads".

## 1.1.31

- fix(resolver): fall back to refresh cookie when bearer token fails (fixes logout with expired access token + valid cookies)
- feat(react): AuthProvider now auto-refreshes access token on hydrate without gating render
- feat(react): add AuthBoundary for opt-in loading fallbacks
