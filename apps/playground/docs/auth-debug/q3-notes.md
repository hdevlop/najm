# Q3 — Logout With Expired Token

**Status:** Confirmed, but narrower than the original claim.

## Setup

- Runtime target: `apps/playground` via Next app on `http://localhost:3000`
- Seeded DB refreshed before test
- Local preflight fix applied to `playground.db` only:
  `tokens.previous_hash`, `tokens.previous_valid_until`, and `tokens.previous_used_at`
  were missing from the checked-in DB file and had to be added so login/refresh could run

## Captured cases

### Case A — Cookie-only logout

Request shape:

- `POST /api/auth/logout`
- `Cookie: refreshToken=<present>; najm.session=<present>`
- no `Authorization` header

Observed result:

- status `200`
- response cleared both cookies:
  `refreshToken=; Max-Age=0`
  `najm.session=; Max-Age=0`

Conclusion:

- the normal cookie-backed path works
- `@isAuth()` can pass through refresh-cookie resolution

### Case B — Expired Bearer token + valid cookies

Request shape:

- `POST /api/auth/logout`
- `Authorization: Bearer <expired JWT>`
- `Cookie: refreshToken=<present>; najm.session=<present>`

Expired JWT payload used:

```json
{
  "userId": "Zvr5h",
  "roles": ["user"],
  "permissions": [
    "create:cart",
    "delete:cart",
    "read:orders",
    "read:cart",
    "create:orders",
    "update:cart",
    "read:products",
    "update:orders"
  ],
  "jti": "expired-phase1-token",
  "sessionVersion": 0,
  "iat": 1776619603,
  "exp": 1776619663
}
```

Observed result:

- status `401`
- no cookie-clearing `Set-Cookie` headers

Conclusion:

- this edge case reproduces
- when an `Authorization` header is present but invalid/expired, `AuthResolver` takes the bearer path and does not fall back to the refresh cookie

Relevant code:

- `packages/najm-auth/src/auth/AuthResolver.ts`
- `packages/najm-auth/src/auth/AuthController.ts`

### Case C — No cookies, no Authorization

Observed result:

- status `401`
- no cookie-clearing `Set-Cookie` headers

Conclusion:

- current behavior is not idempotent anonymous logout
- the earlier fix-plan expectation of `200` for this case is not true in the current package

## Decision lever

What is confirmed:

- the broad claim "`/auth/logout` fails when the access token is expired" is **too broad**
- the normal cookie-only path works
- the failure reproduces only when a consumer sends an expired bearer token on logout

What this means:

- if the consumer app sends logout without `Authorization`, the package is fine on this path
- if any consumer sends a stale bearer token, the current resolver ordering can still cause logout to fail

## Codex read

This is best labeled:

- **Confirmed edge-case bug**
- not yet a confirmed package-wide regression for the default `NajmAuthClient.logout()` path
