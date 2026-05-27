# Q5 — Does `najm.session` Stay In Sync After Refresh?

**Status:** Confirmed clean in the current playground runtime.

Session-cookie verification used the same HMAC secret path as current package behavior:

- `CookieManager.sessionSecret`
- falls back to `jwt.accessSecret`
- in playground this is `JWT_ACCESS_SECRET`

## Session cookie after login

Decoded and HMAC-verified `najm.session` payload:

```json
{
  "verified": true,
  "payload": {
    "user": {
      "id": "a957bc77-8924-430d-8c17-f1a2cbf06ff5",
      "email": "user@test.com",
      "name": null,
      "role": "user"
    },
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
    "iat": 1776619723205
  }
}
```

## Session cookie after refresh

Decoded and HMAC-verified `najm.session` payload:

```json
{
  "verified": true,
  "payload": {
    "user": {
      "id": "a957bc77-8924-430d-8c17-f1a2cbf06ff5",
      "email": "user@test.com",
      "name": null,
      "role": "user"
    },
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
    "iat": 1776619723248
  }
}
```

## Observations

- HMAC verification passed before and after refresh
- `iat` changed from `1776619723205` to `1776619723248`
- refresh response also rotated `refreshToken`
- roles/permissions in the signed session cookie matched the fresh JWT

## Decision lever

Current conclusion:

- the signed session cookie is being re-issued on refresh
- SSR `getSession()` should be able to read fresh roles/permissions from the cookie fast path

## Codex read

The current playground does **not** reproduce a stale-session-cookie bug. That weakens the earlier package-fix theory that refresh leaves `najm.session` outdated on the next reload.
