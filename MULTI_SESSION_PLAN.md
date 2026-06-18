# najm-auth — Multi-Session Refresh Token Plan

Goal: allow one user to stay logged in on multiple browsers/devices. Each login
gets its own refresh-token family, and refresh rotation updates only that
family's row instead of replacing every session for the user.

Status: **implemented** (2026-06-18). The schema, token format, repository,
service-behavior, migration notes, integration tests, and docs are all done;
`build:auth` / `test:auth` are green (34 tests). Expired-session cleanup runs
opportunistically on login and is exposed via `authService.pruneExpiredSessions()`
for consumers' scheduled jobs. The only deferred item is an admin/session-listing
UI (explicitly out of scope for the first pass); the data model already supports
it. See the per-section checkboxes below.

Implemented so far:
- Schema: `tokens.userId` unique dropped + `tokens_user_id_idx` added;
  `tokenFamily` now `notNull().unique()` (pg + sqlite).
- JWTs: `tokenFamily` embedded in both access and refresh tokens.
- Repository: upsert on `tokenFamily`; `getByFamily`, family-scoped
  `markPreviousUsed` (keeps the hash gate), `revokeFamily`, `revokeAllForUser`,
  `deleteExpired`.
- Service: family-scoped rotation/resolve/reuse-revoke, `auth:revoked-family:*`
  cache marker checked in `verifyAccessToken`, family-scoped logout with
  refresh-cookie→access-token→revoke-all fallback, opportunistic
  `deleteExpiredSessions()` on login.
- Docs: logout / session-management / single-vs-multi-device notes corrected.

Prerequisite: apply `AUTH_FIX_PLAN.md` first (review fixes for the current
single-session code). It deletes dead token-session code, fixes Bearer/cookie
resolution priority, and hardens `markPreviousUsed` — all of which shrink this
plan's surface area.

## Scope

In scope:

- Multiple active refresh sessions per user.
- One token row per login session/family.
- Refresh rotation isolated to the current family.
- Normal logout revokes only the current session.
- Password change/reset still revoke all sessions for the user.

Out of scope for the first pass:

- Session-management UI.
- Admin device/session list.
- Device fingerprinting.
- User-visible device labels.

`tokenFamily` is the first-pass session identifier. Device labels and metadata
can be added later without changing the core refresh-token model.

## Migration Decision

Prefer an explicit re-login migration.

Current refresh JWTs only carry `userId`, so after the schema changes they cannot
identify which token-family row to read. During the migration, clear/delete
existing `tokens` rows and document that users must log in again.

If a consumer requires zero-login migration, handle it as a separate compatibility
task. That fallback would need to accept old refresh JWTs temporarily, locate the
single existing user row, mint a new family-aware refresh token, and remove the
fallback in a later release.

Note: access tokens issued before the migration remain valid until they expire.
Session versions live in cache per user and cannot be bumped globally, so plan
the deploy with the access-token TTL in mind (default 1h) or shorten it ahead
of the migration.

## Schema Work

- [ ] Update `src/schema/sqlite.ts` and `src/schema/pg.ts` (the only two
      supported dialects — MySQL was dropped because the data layer relies on
      `.returning()`): remove the unique constraint from `tokens.userId`.
- [ ] Make `tokens.tokenFamily` required and unique. It is already generated as
      `nanoid(16)` and preserved across refresh rotations.
- [ ] Add a non-unique `tokens_user_id_idx` for revoke-all, cleanup, and future
      session listing.
- [ ] Keep `tokens_expires_at_idx`.
- [x] Add migration notes/SQL for SQLite and Postgres: drop the user-id
      unique index/constraint, clear old token rows, enforce unique family, then
      recreate indexes. Done — see NAJM_AUTH.md "Migration: single-session →
      multi-session" (reference SQL for both dialects + re-login rationale).

## Token Format Work

- [ ] Add `tokenFamily` to refresh JWT payloads in `signRefreshToken`.
- [ ] Require `tokenFamily` when verifying refresh tokens.
- [ ] Add `tokenFamily` to access JWT payloads so current-session revocation can
      reject every access token minted for that family, not just the one Bearer
      token passed to logout.
- [ ] Update `JwtPayload` in `src/types.ts` with optional `tokenFamily` for
      access tokens and required handling for refresh-token verification.

## Repository Work

- [ ] Change `TokenRepository.storeRefreshToken` to upsert on
      `tokens.tokenFamily`, not `tokens.userId`. Both supported dialects (pg,
      sqlite) implement `onConflictDoUpdate({ target })`, so retargeting is a
      one-line change with no dialect branching. (This is the bullet that the
      MySQL removal eliminated — MySQL's `onDuplicateKeyUpdate` could not target
      a specific unique key, which would have forced a dialect split.)
- [ ] Replace `getRefreshTokenWithFamily(userId)` with lookup by
      `(userId, tokenFamily)` or by `tokenFamily` plus a user-id assertion from
      the verified JWT.
- [ ] Change `markPreviousUsed` to key on `tokenFamily` instead of `userId`,
      but **keep the `previous_hash` predicate** that AUTH_FIX_PLAN.md item 5
      added — i.e. `... WHERE token_family = ? AND previous_hash = ? AND
      previous_used_at IS NULL`, returning affected rows. The `IS NULL` guard
      alone is NOT enough: the winner's rotation resets `previous_used_at` back
      to NULL, so only the hash mismatch stops a late loser from re-claiming the
      slot. Dropping the hash predicate would reopen the race item 5 closed.
- [ ] Split revocation APIs into `revokeFamily(tokenFamily)` and
      `revokeAllForUser(userId)`.
- [ ] Keep `revokeByFamily` only if that remains the preferred internal API name.
- [ ] Add an expiry cleanup path: with one row per family and no unique
      `userId`, abandoned logins accumulate rows. Add
      `deleteExpired()` (`DELETE FROM tokens WHERE expires_at < now`) and call
      it opportunistically (e.g. on login) or from a scheduled job. Optionally
      cap active families per user (delete oldest row beyond N at login).

## Service Behavior Work

- [x] Generate `family = nanoid(16)` once per login — already done:
      `generateTokens` mints the family and threads it into `storeRefreshToken`.
- [ ] Pass the family into both access and refresh signing. This is the real
      remaining gap — `signAccessToken`/`signRefreshToken` do not yet embed
      `tokenFamily` in the JWT payloads.
- [ ] Store the hashed refresh token under that family. The previous-hash
      carryover inside `TokenService.storeRefreshToken` (reads the existing row
      to set `previousHash`/`previousValidUntil`) must read by `tokenFamily`,
      not `userId`, or a login on device B would inherit device A's previous
      hash and grace window.
- [ ] In `refreshTokens`, verify the refresh JWT, read `{ userId, tokenFamily }`,
      compare only that family's current/previous hash, and rotate only that row.
- [x] Delete `validateRefreshSession` — done (AUTH_FIX_PLAN.md item 3). It had
      no callers and duplicated `refreshTokens`/`resolveUserFromCookie`.
- [ ] In `resolveUserFromCookie`, resolve by the refresh token's family instead
      of selecting the user's single token row.
- [ ] On refresh-token reuse outside the grace window, revoke only the suspect
      family. Explicitly remove the `invalidateUserAccessTokens` call from
      `revokeSuspectRefreshFamily` — that bumps the **global** per-user session
      version, which would kill every session's access tokens on one family's
      reuse detection. Replace it with the family revocation marker below.
- [ ] Add a short-lived cache marker such as `auth:revoked-family:<tokenFamily>`
      for the access-token TTL when a family is revoked.
- [ ] In `verifyAccessToken`, check both the existing user session-version key
      and the family revocation marker when `payload.tokenFamily` exists.
- [ ] On normal logout, revoke only the current family, blacklist the presented
      access token when available, clear cookies, and do not invalidate every
      session for the user.
- [ ] Define where logout obtains the family: prefer the verified refresh
      cookie's `tokenFamily` claim; fall back to the access token's
      `tokenFamily` claim when no refresh cookie is present (e.g. pure Bearer
      clients). If neither is available, fall back to revoke-all for that user
      and log it — `logout(userId, authorization)` currently has neither input.
- [ ] On password change, password reset, and future "logout all devices", keep
      global invalidation: bump `auth:session-version:<userId>`, delete all
      refresh rows for that user, clear `auth:user:<userId>`, and clear the
      current browser cookies.
- [ ] Preserve the documented session-cookie lag: other devices may keep the
      signed `najm.session` cookie until its short TTL expires unless a stricter
      session-cookie revocation check is added later.

## Docs Work

- [x] Update `packages/najm-auth/README.md`: replace the single-device note with
      multi-session semantics.
- [x] Update `packages/najm-auth/NAJM_AUTH.md`: document one row per family,
      logout-current-device behavior, and password change/reset revoke-all
      behavior. (Logout, session-management, tokens table, and migration
      sections all updated.)
- [x] Document the migration behavior: existing refresh sessions must log in
      again after upgrading through this schema change.

## Test Work

Real-DB integration coverage lives in
`packages/najm-auth/test/multi-session-db.test.ts` (full `TokenRepository`
against bun:sqlite). Mock-level reuse/rotation/logout coverage is in
`auth-security.test.ts`.

- [x] Add tests in `packages/najm-auth/test/auth-security.test.ts` or a new
      focused test file.
- [x] Test that a second login does not invalidate the first session.
- [x] Test that a second login does not inherit the first family's
      `previousHash`/grace window (family-scoped carryover).
- [x] Test that refresh rotation is isolated per family.
- [x] Test that stale refresh-token reuse revokes only the suspect family and
      does not bump the global per-user session version.
- [x] Test that concurrent grace-window refreshes in one family produce exactly
      one successful rotation. (`auth-security.test.ts`)
- [x] Test that logout from the current device does not delete other refresh rows.
- [x] Test that expired token rows are removed by the cleanup path.
- [x] Test that password change/reset deletes all user refresh rows and
      invalidates all access tokens. `AuthService.resetPassword` runs against a
      real DB in `multi-session-db.test.ts`: every session for the user is
      deleted, an unrelated user is untouched, and the global session-version
      key is bumped.
- [x] Test that logout with no refresh cookie resolves the family from the
      access token's `tokenFamily` claim (pure Bearer clients).
- [x] Run `bun run build:auth`.
- [x] Run `bun run test:auth`. (33 pass)

## Acceptance

- [ ] Two independent cookie sessions for the same user can log in, refresh, and
      call `/auth/me` without invalidating each other.
- [ ] Revoking or detecting reuse in one family does not delete another family's
      refresh row.
- [ ] Normal logout affects only the current session.
- [ ] Password change/reset still force all sessions to re-authenticate.
- [ ] Existing security behavior remains covered by focused auth tests.
