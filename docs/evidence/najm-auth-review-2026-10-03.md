# Najm Auth review and repairs — 2026-10-03

Reviewed `najm-auth@4.2.4` from base commit
`e69361e683e7d354c2ef7e41c25815fa94ec0a14`. The worktree was clean before this
review. This report records the source repairs and their validation. Release
and consumer adoption evidence is tracked separately below.

## Confirmed findings

| Priority | Finding and trigger | Repair |
| --- | --- | --- |
| P1 | With equal access and refresh secrets, a valid refresh JWT could authorize as a bearer. Conversely, access JWTs passed the public refresh verifier because a missing purpose was accepted. | Access validation rejects other purposes; refresh validation requires `type: refresh`. JWT readers accept only the issued HS256 algorithm and require finite expiry and correctly typed identity claims. Legacy access tokens without a purpose remain supported. |
| P1 | Renaming a role, changing a permission, deleting a permission, or deleting all permissions left issued bearer tokens and backend signed snapshots authorized with their old claims. | Invalidate affected users' access versions and cached principals after the write. Capture permission holders in the same repository transaction as the mutation. Preserve refresh sessions so recovery obtains the current claims; unrelated roles and description edits retain their sessions. |
| P1 | `getSafeRedirectPath('/\t/evil.test')` returned a path the browser interprets as an external URL. OAuth validators and callback navigation also returned protocol-relative paths after normalizing `/orders/..//evil.test`; unsafe callback fallbacks had the same problem. | Use one internal local-path normalizer across the redirect helper, OAuth state, client URL generation, and React callback. Reject controls, backslashes, and protocol-relative paths both before and after URL normalization. Apply blocked-route rules to the normalized path. |
| P2 | With one-second access tokens and five-minute signed snapshots, permission invalidation expired after one second and an older version-zero snapshot could become valid again. | Retain invalidation markers for the greater of the access-token and signed-snapshot lifetimes. |
| P2 | A user with a valid legacy password could log in but could not change it because the current-password field reapplied the new-password complexity policy. | Validate current passwords with the existing login credential bounds; keep replacement-password strength requirements. |
| P2 | A custom credential-setup password schema could accept empty or over-72-byte passwords that the login DTO rejects, with inconsistent bcrypt behavior across runtimes. | Enforce the nonempty, 72-byte UTF-8 limit after custom policy parsing and before hashing or consuming the setup session. |
| P2 | Login matched email case-insensitively, while create/update uniqueness and forgot-password lookup used exact casing. This allowed conflicting login identities and prevented recovery for existing mixed-case addresses. | Check email uniqueness and recovery case-insensitively, normalize new email writes, and deliver reset mail to the stored address. |
| P2 | Updating a phone stored its raw form and skipped phone validation and uniqueness checks, although creation and login used normalized E.164 values. | Normalize and validate phone updates through the configured identity resolver, check ownership before writing, and retain explicit `null` clearing. |
| P1 | A password login paused during bcrypt verification resumed after password replacement or deactivation, then minted a new live family with the latest version and stale authenticated state. | Keep the verified password hash in a server-only WeakMap associated with the verified user. Session establishment reads the version before re-reading the authoritative account, checks the credential and identity state, and passes that captured version through issuance. Check again before setting cookies. No password hash is added to the returned user or cookie. |
| P1 | Token issuance, refresh, or signed-session recovery read old authorization claims before reading the new version from a concurrent permission removal. | Read the version before authoritative claims, sign with that captured version, and reject if the version changes during the operation. Withdraw a late-created login family with a durable revoked tombstone so refresh cannot revive a refused attempt. |
| P1 | Permission deletion captured one role list, then a concurrent grant committed before the cascading delete. The newly granted role kept credentials with the deleted permission. | Capture grants and perform claim-changing updates/deletes in one transaction. Synchronous SQLite callbacks execute all queries before committing. PostgreSQL locks the permission parent row with `FOR UPDATE`; delete-all locks the catalog table while capturing and deleting its grants. |
| P2 | Concurrent email/phone validation reads both passed, and one write failed with an unmapped uniqueness exception. | Keep database uniqueness authoritative and map PostgreSQL/SQLite unique violations, including wrapped driver errors, to HTTP 409 in the user validator. Preserve unrelated database errors. |
| P1 | A user-cache fill read old role/permissions, paused across invalidation, then refilled the deleted cache key with stale state. | Include the captured session version in the principal-cache key and reject reads that cross a version change. Old fills cannot populate the current version's cache. |
| P1 | A caller-owned outer transaction invalidated versions before its permission changes committed. Another connection recovered the previous committed claims with the new version, leaving those claims valid after commit. A shared connection could also recover an uncommitted permission grant that survived rollback. | Register repeated invalidation after both commit and rollback through `TransactionService`. Centralize full refresh-family revocation in the invalidation service so it also repeats after transaction completion. |
| P1 | Bun SQLite's synchronous transaction wrapper committed before an async callback finished, so a later failure could leave partial writes committed. Overlapping async transactions on one SQLite connection collided at `BEGIN`. | Keep `BEGIN` open until the awaited callback completes, roll back on failure, and serialize independent transactions per SQLite client. Nested transaction calls reuse the current transaction. |
| P1 | A password change verified the old password, then paused during comparison or hashing while an administrative replacement committed. The delayed request overwrote the replacement using the old authorization. | Perform a conditional SQL update matching the password hash, email, status, and verification state that authorized the change. Reject a losing write with HTTP 409 and preserve the newer credential. |
| P1 | Unused reset/invitation links survived email, password, status, and verification changes. A reset paused during hashing overwrote a newer credential; an invitation paused while its pending account was deactivated reactivated that account. | Bind links to an HMAC fingerprint of the account's credential state, verify it around atomic consumption, and condition the final SQL write on the same state. Keep the stored password hash out of JWTs and returned users. |
| P1 | A reset mail request read its recipient, paused while the account's email changed, then issued a valid new-state link to the old address. | Pass the expected recipient into reset/invitation issuance, compare it with the authoritative account, and withdraw issuance if credential state changes during cache storage. Forgot-password keeps its generic response when issuance is refused. |
| P1 | A first-login setup cookie remained usable after password replacement, deactivation, or email change. A setup submission paused during hashing could overwrite the newer credential and complete its requirement. | Bind the opaque setup cookie to the same credential fingerprint and validate it on issuance, reads, and consumption. Conditionally persist the replacement password against the validated account state. |

JWT purpose separation follows [RFC 8725 section 3.12](https://www.rfc-editor.org/rfc/rfc8725.html#section-3.12).

## Regression evidence

The initial additions reproduced **16 failing tests** against the original
implementation. A later redirect review reproduced five additional OAuth
failures and extended the existing normalized-path regression. All pass after
the repairs. The suite also verifies an actual isolated server boot with the
built auth plugin, and advances the clock to check a copied snapshot after the
shorter access-token lifetime has elapsed.

Primary new coverage:
[review-security-regressions.test.ts](../../packages/najm-auth/test/review-security-regressions.test.ts).
Additional cases extend the existing cookie persistence, OAuth, login
identifier, and first-login setup suites. Database cases use real in-memory
SQLite with foreign keys enabled and the real repositories; cache cases use
the actual memory cache.

The race follow-up first reproduced **six failing regressions** covering the
four reported race groups. The final
[auth-races.test.ts](../../packages/najm-auth/test/auth-races.test.ts) suite has
**17 passing cases** with explicit barriers around credential comparison,
claim reads, refresh storage, cache fills, recovery, and the last-login write.
It also covers catalog rename/delete-all, mutation rollback, concurrent
registration, wrapped PostgreSQL uniqueness errors, and preservation of a
legitimate refresh family after permission revocation. Both suites share the
real SQLite/cache fixture in `test/helpers/securityHarness.ts`.

The transaction follow-up reproduced **four failing commit regressions**, then
**two additional failures** covering rollback privilege retention and overlapping
SQLite transactions. The final
[auth-transaction-races.test.ts](../../packages/najm-auth/test/auth-transaction-races.test.ts)
has **five passing cases**. Commit cases use two real SQLite connections to prove
the reader sees the old committed authorization state while the writer's outer
transaction remains open. The rollback case verifies a snapshot containing an
uncommitted grant is denied after that grant rolls back. The built-plugin server
test also confirms transaction callbacks are wired by actual dependency injection.

[transaction-commit-hooks.test.ts](../../packages/najm-database/test/transaction-commit-hooks.test.ts)
has **eight passing cases** covering outer commit, rollback, retry callback
ordering, callback failure after a committed write, Bun SQLite async rollback,
and overlapping transactions on one connection. Commit callback failures drain
the remaining callbacks and never retry an already committed database mutation.

PostgreSQL's lock conflict rules are documented in
[Explicit Locking](https://www.postgresql.org/docs/17/explicit-locking.html).
Live PostgreSQL/Redis concurrency acceptance remains separate from the
SQLite and memory-cache evidence above.

The credential follow-up reproduced **eight failing password/reset/invitation
regressions** and **four failing setup regressions** before repairing their
respective paths. The final
[credential-mutation-races.test.ts](../../packages/najm-auth/test/credential-mutation-races.test.ts)
has **15 passing cases** against the real SQLite repositories and memory cache.
It pauses comparison, hashing, token storage, mail issuance, and the conditional
SQL write; verifies current reset/invitation links still work after profile edits;
and checks that neither a JWT nor its credential fingerprint exposes a hash.

[credential-setup-races.test.ts](../../packages/najm-auth/test/credential-setup-races.test.ts)
has **five passing cases** covering stale setup cookies, delayed replacement,
and successful one-time completion of an unchanged credential. The built-plugin
server regression also resolves the compiled setup service through actual DI,
issues a setup cookie, and verifies that an email replacement ends that cookie.
No production schema columns or migrations were added for credential binding.

## Final validation

| Check | Result |
| --- | --- |
| `bun run test:auth` | PASS, including dependency builds and auth runtime/declaration build. Main suite: **605 pass, 19 skip, 0 fail** across 51 files. React server condition suite: **13 pass, 6 skip, 0 fail**. |
| `bun test packages/najm-database` | PASS, **123 pass, 0 fail** across eight files. |
| `bun packages/najm-auth/integration/next16-proxy/run.ts` after the build | PASS, real Next.js 16 + Bun production build/server/proxy recovery fixture. |
| `bun run api:check` | PASS, public export snapshot remains current. |
| `git diff --check` | PASS. |

The opt-in PostgreSQL/Redis acceptance suite **PASS: 11 tests, 0 failures**
against an isolated PostgreSQL 18 cluster and Redis 7.4.6 on loopback ports
55432 and 56379. Each run creates/drops its own database and deletes only its
unique Redis prefix. It uses `postgres-js`, matching School's driver, and real
repositories/services, bcrypt, and Redis Lua operations. The suite observes
`pg_stat_activity.wait_event_type = 'Lock'` to prove permission deletion and
delete-all wait for in-flight grants before capturing their affected roles.
It also proves outer commit/rollback invalidation, a competing credential
replacement winning over a delayed reset, stale email proofs, concurrent
one-time consumption, logout/refresh ordering, and durable revocation/cache loss.

An initial run using Bun's SQL pool timed out in the concurrent reset case and
stalled cleanup; that driver is not covered by the successful PostgreSQL run.
The checked-in acceptance harness uses `postgres-js` explicitly.
No browser acceptance, production database repair, or deployment is established
by these checks. Existing email collisions in a consumer database are not
repaired by the source changes.

The auth transaction repair depends on the new `TransactionService.afterCommit`
and `afterRollback` methods. A future release must publish the database package
first and ensure the auth package's dependency includes that database release.
These hooks cover transactions managed through
`TransactionService` / `@Transaction`; caller-owned raw driver transactions must
coordinate their own invalidation after completion.

Recovery links and setup cookies issued before this repair lack the credential
binding and are intentionally refused. Affected users must request a new reset
or invitation link, or sign in again to start a fresh setup session. New links
remain usable through profile edits, but credential/identity/lifecycle changes
require new ones. Direct construction of `CredentialSetupService` now supplies
`UserRepository` as its fifth dependency; the auth plugin injects it normally.
The `ConsumedSetPasswordToken` result now includes the safe `credentialState`
fingerprint used by the conditional password write.

Backend signed snapshots check session versions and positive family liveness.
Optimistic Edge navigation still has its configured signed-snapshot freshness
window; authoritative proxy mode checks refresh state on each protected request.

## Release and consumer adoption

Candidate versions: `najm-database@2.2.0` (additive completion hooks) and
`najm-auth@5.0.0` (credential-setup constructor and consumed recovery-token
contract changes, plus refusal of older unbound proofs). Publish database first;
the auth manifest must resolve its database dependency to `^2.2.0`.
Package publication and consumer validation are pending at this source checkpoint.
