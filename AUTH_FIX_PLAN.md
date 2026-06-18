# najm-auth — Review Fix Plan

Fixes for the findings from the najm-auth review (uncommitted working-tree
changes). These apply to the **current single-session code** and are
independent of MULTI_SESSION_PLAN.md, but several reduce its blast radius
(notably deleting dead code before the schema change).

Priority order: 1 and 2 are behavior/security issues, 3–5 are hygiene.

## 1. Bearer token must outrank the session cookie

Problem: in `packages/najm-auth/src/auth/AuthResolver.ts` (`activate()`), the
signed session-cookie hot path runs **before** Bearer-token resolution. Two
consequences:

- A request carrying a valid `Authorization: Bearer` for user A resolves as
  user B if the browser also holds B's session cookie — wrong principal for
  APIs mixing browser sessions and programmatic tokens.
- The hot path performs zero revocation checks, so blacklisting, logout from
  another tab, and session-version bumps are bypassed for any request with a
  live session cookie — even when a (revoked) Bearer token is presented.

Fix:

- [ ] Reorder resolution: when an `Authorization` header is present, try
      `resolve(token)` first, then `resolveFromCookie()`; use
      `resolveFromSessionCookie()` only when **no** Authorization header is
      present.
- [ ] Keep the zero-I/O hot path for cookie-only requests (SSR reads) — that
      revocation lag, bounded by `session.maxAge` (default 300s), is the
      documented tradeoff.
- [ ] Update the hot-path regression test in
      `packages/najm-auth/test/auth-security.test.ts`
      ("valid session cookie bypasses token and database resolution") to pass
      no Authorization header, and add a test asserting a request with a
      Bearer token resolves via TokenService even when a session cookie exists.
- [ ] Document the cookie-only revocation lag in `NAJM_AUTH.md` if not already
      stated.

## 2. Unify the USER shape across resolution paths

Problem: `resolveFromSessionCookie()` sets `USER` to the cookie payload
(`{ id, email, name, role }`), while the Bearer/refresh-cookie paths set the
full sanitized DB user (`status`, `emailVerified`, `image`, `permissions`,
timestamps, …). Downstream guards/handlers reading those fields see them
intermittently `undefined` depending on which path won.

Fix (pick one, prefer the first):

- [ ] Define a minimal `AuthUser` contract — the fields guards may rely on —
      and project **all three** resolution paths onto it. Enrich
      `SessionCookieData.user` if a needed field (e.g. `status`) is missing.
- [ ] Alternatively, document in `NAJM_AUTH.md` that `USER` is only guaranteed
      to contain `{ id, email, name, role }` plus `ROLE`/`PERMISSIONS` tokens,
      and that anything else requires a service-level lookup.
- [ ] Note: `status` matters — an account deactivated mid-session should not
      pass guards that check `user.status`. If guards check it, the cookie
      payload must carry it.

## 3. Delete dead `validateRefreshSession`

Problem: `TokenService.validateRefreshSession()`
(`packages/najm-auth/src/tokens/TokenService.ts`) has no callers anywhere in
the repo. It duplicates `refreshTokens`/`resolveUserFromCookie` logic, and its
`rotatedTokens.tokenFamily` is typed `string` but can be `null`.

Fix:

- [ ] Delete the method (and the now-unused return type) unless it is public
      API for an external consumer — in that case add a doc comment naming the
      consumer and fix the `tokenFamily` nullability.
- [ ] Remove the corresponding item from MULTI_SESSION_PLAN.md service work
      (already updated to reflect deletion).

## 4. Align refresh-token reuse handling

Problem: on stored-hash mismatch outside the grace window, `refreshTokens()`
revokes the suspect family (`revokeSuspectRefreshFamily`), but
`resolveUserFromCookie()` (the `/auth/me` cookie path) just throws without
revoking.

Fix:

- [ ] Decide intentionally: either revoke in both paths, or keep read paths
      side-effect-free and say why in a comment above
      `resolveUserFromCookie()`. Recommendation: keep read paths
      side-effect-free (a stray stale cookie on a GET shouldn't nuke the
      session) and document it.

## 5. Close the grace-window rotation race

Problem: in `refreshTokens()`, the `canRecover` check and
`markPreviousUsed()` are not atomic — two concurrent requests presenting the
previous refresh token can both pass the check and both rotate.

Fix:

- [ ] Make `TokenRepository.markPreviousUsed` conditional:
      `UPDATE tokens SET previous_used_at = … WHERE user_id = ? AND
      previous_used_at IS NULL` and return the affected row(s).
- [ ] In `refreshTokens()`, treat zero affected rows as a lost race: re-read
      the row and fail with `refreshTokenInvalid` instead of rotating twice.
- [ ] Low severity (bounded by the 120s grace window) — fine to fold into the
      multi-session work where `markPreviousUsed` becomes family-scoped.

## Verification

- [ ] `bun run build:auth`
- [ ] `bun run test:auth` (or `bun test` in `packages/najm-auth`)
- [ ] All existing 21 tests stay green; new tests for items 1 and 5.

## Acceptance

- [ ] A request with a valid Bearer token always resolves that token's user,
      regardless of session-cookie presence; revoked Bearer tokens are
      rejected even when a session cookie exists.
- [ ] Cookie-only requests still use the zero-I/O session-cookie path.
- [ ] `USER` has a single documented shape across all resolution paths.
- [ ] No dead token-session code remains.
- [ ] Concurrent grace-window refreshes produce exactly one successful
      rotation.
