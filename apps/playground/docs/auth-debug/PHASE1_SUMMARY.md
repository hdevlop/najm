# Phase 1 Summary

**Scope:** `apps/playground` only  
**Date:** 2026-04-19  
**Goal:** verify Q3/Q4/Q5 before touching the dashboard repo

## Preflight blocker

The checked-in `apps/playground/playground.db` did not match the current `najm-auth` sqlite schema.

Observed failure before testing:

- `POST /api/auth/login` returned `500`
- error: `no such column: "previous_hash"`

Local runtime-only fix applied:

- added these columns to `playground.db`:
  `previous_hash`
  `previous_valid_until`
  `previous_used_at`

No package source files were edited for this.

## Results

| Question | Status | Result |
|---|---|---|
| Q3 — logout-with-expired-token failure | Confirmed, but narrower than originally stated | cookie-only logout works; expired bearer + valid cookies fails with `401`; no-cookie logout also fails with `401` |
| Q4 — `/auth/refresh` missing `roles`/`permissions` | Confirmed clean | refresh JWT still contains both fields |
| Q5 — signed `najm.session` stale after refresh | Confirmed clean | session cookie is re-signed on refresh and stays aligned with JWT claims |

## Interpretation

### Q3

Confirmed:

- normal cookie-backed logout path is healthy
- the edge case fails only when a client sends an expired `Authorization` header

Implication:

- this is a possible package edge-case fix
- it is **not** yet evidence that the default `NajmAuthClient.logout()` path is broken

### Q4

Confirmed:

- current token issuance includes `roles` and `permissions` at login and refresh

Implication:

- `NajmAuthClient.applyTokens()` still contains a defensive-risk branch
- but that branch is not currently triggered by the playground server

### Q5

Confirmed:

- `najm.session` is updated on refresh
- signed-cookie SSR state is not stale in the current playground behavior

Implication:

- the refresh/session-cookie package path looks healthy

## Phase 1 exit decision

Phase 1 does **not** justify a package fix for:

- missing claims on refresh
- stale signed session cookie after refresh

Phase 1 does show one narrower package concern:

- expired bearer token on logout blocks refresh-cookie fallback

## Strongest next lead

The strongest remaining lead is now consumer-side auth bootstrapping.

Additional in-repo clue:

- `apps/playground/src/app/providers.tsx` mounts `<AuthProvider client={auth.client}>`
- it does **not** pass `initialSession`

That means in-repo consumers are not using SSR hydration by default, which makes a client-refresh-on-reload path more likely.

## Recommended next step

Move to Phase 2 and inspect the consumer app auth boot path:

1. does it hydrate from server `getSession()` on reload?
2. does it always call client `refresh()` before rendering protected UI?
3. do role-gated components fail closed during that refresh window?
