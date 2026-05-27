# Q4 — Does `/auth/refresh` Ever Omit `roles` / `permissions`?

**Status:** Confirmed clean in the current playground runtime.

## Login access token payload

Decoded payload from `POST /api/auth/login` for `user@test.com`:

```json
{
  "userId": "a957bc77-8924-430d-8c17-f1a2cbf06ff5",
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
  "jti": "Nzcp9L1vmTRVtLRr",
  "sessionVersion": 0,
  "iat": 1776619723,
  "exp": 1776623323
}
```

## Refresh access token payload

Decoded payload from `POST /api/auth/refresh` for the same session:

```json
{
  "userId": "a957bc77-8924-430d-8c17-f1a2cbf06ff5",
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
  "jti": "9dWBSMduYQECU_zM",
  "sessionVersion": 0,
  "iat": 1776619723,
  "exp": 1776623323
}
```

## What changed

- `jti` changed
- refresh token rotated

## What did not change

- `roles` stayed present
- `permissions` stayed present
- `sessionVersion` stayed present

## Decision lever

Current conclusion:

- the current server/runtime does **not** reproduce the theory that `/auth/refresh` drops RBAC claims

Code alignment:

- `packages/najm-auth/src/tokens/TokenService.ts`
- `generateTokens()` populates `roles` and `permissions`
- `generateAccessToken()` signs them into the JWT

## Codex read

Fix 1 in the larger fix plan may still be worthwhile as defensive hardening, but in the current playground it is **not** a proven causal fix for the reload bug.
