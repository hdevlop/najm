# Cached offline account entitlement

Date: 2026-10-19. Candidate: `najm-auth@6.7.0`. Source and built-entry proof;
publication/adoption evidence belongs to the School ledger after release.

Current result: **PASS** — 675 package tests (19 skipped), 13 React-server
tests (6 skipped), source typecheck, strict checks for the new source/tests,
declaration build, public API snapshot and all three native-browser runs. The
29 focused offline-policy tests are included in that package total.

## Contract

`najm-auth/client/offline` exports `createOfflineAccess` and its policy/storage
types without importing the auth root, JWT, React, Next, Node modules, or browser
globals at module evaluation. The existing online auth client, server session,
provider and permission guards are unchanged. Available cached access is never
an authenticated server session, data-download readiness, or permission to push.

The host supplies `OfflineAccessStore.read` and `compareAndSwap`. Compare the
current revision and put the new record in one IndexedDB transaction shared by
all participating tabs/workers. An ordinary read followed by an independent
write does not satisfy the adapter contract. Keep the policy row and local
entity/outbox stores in the same database when atomic callback fencing is needed.

```ts
import { createOfflineAccess } from 'najm-auth/client/offline';

const cached = createOfflineAccess({ store, maxOfflineDurationMs: 7 * 86400000 });
const beforeRequest = await cached.capture();
// Authenticate online, obtain current grants/authorized scopes, and ask consent.
const result = await cached.enroll(beforeRequest, {
  accountId: 'teacher-a', installationId: 'school-1', installationEpoch: 'epoch-1',
  authorizationGeneration: 'policy-8', issuedAt: serverIssuedAt,
  validUntil: serverValidUntil, consent: true,
  online: { authenticated: true, accountId: 'teacher-a', permissions: currentPermissions },
  scopes: [{ id: 'attendance:class-1', academicYear: '2026-2027', capabilities: ['mark:attendance'] }],
});
// `applied:false` means a stale callback/grant; it must not unlock the screen.
```

Consent must be explicit. Enrollment requires `use:offline` and every declared
scope capability in the online grants. The exact capability names and scope
membership are host policy; enrollment permission alone grants no domain access.
The host must obtain this response through existing authenticated transport,
never a cache, and verify actual server ownership before claiming a scope.
This local record is not signed, secret, or a bearer credential and is never sent
to a server as authentication. The helper cannot authenticate a caller-supplied
`online` object; that boundary remains the existing online auth/session owner.
Only allowlisted policy fields persist, even if a caller's response also contains
access or refresh credentials. No credentials are required or copied by this API.

`authorize` requires the expected account, installation, epoch, exact scope,
academic year and capability. Wrong account/year/scope/capability denies. An
installation/epoch mismatch locks access. `getSnapshot` begins locked until
`refresh`/authorization reads storage, and reports only empty/available/locked
policy state. It cannot produce a ready-data badge.

`capture` before a request returns a fence and local request time. Enrollment
and every lock rotate that fence; high-water clock writes retain it. A logout
before initial enrollment persists a tombstone so the late response cannot
reenroll. Account B requires explicitly locking account A first. Old A callbacks
cannot unlock, authorize B, or lock B. Every same-account/install/epoch policy
renewal needs a strictly newer server `issuedAt`; a cached grant cannot reset
the authorization window or reopen a locked account.

The server-time expiry advances by locally observed elapsed time from the
request. Delayed responses consume their window instead of restarting it.
The greatest observed local clock is durably written before granting access.
Reopening after a rollback beyond the configured tolerance (default 1000 ms)
locks; smaller jitter cannot extend expiry. A shorter configured maximum window
also applies to existing records. A corrupt/unknown row or failed storage/clock
operation fails closed and requires explicit host recovery. This detects ordinary
clock rollback; it is not trusted hardware time and does not defend against a
person controlling the browser profile or intentionally freezing its clock.

`lock(capturedToken, reason)` is required for logout, account switch, known
disablement, authorization revocation and incompatible dataset state. It never
deletes records, attachments, pending operations or the policy tombstone. An
unsuccessful storage write rejects and locks the current UI snapshot; the host
must not report a completed durable logout or enrollment if this promise fails.
No helper can promise a persistent tombstone when the browser refuses every
storage write. Keep cached screens closed and expose the storage failure.
An expired online session does not become authenticated through cached access.
Before syncing, authenticate as the same account and let ordinary server guards
evaluate every command. Known revocation must lock; an unavailable server is not
proof of revocation. Pending operations remain recoverable and locked until
their account signs in or the owner explicitly chooses discard.

The host broadcasts committed policy changes and calls `refresh` in other
contexts. Subscriptions notify the local UI of its refreshed snapshot; there is
no hidden second session owner or global background worker. An authorization
decision/token is a moment-in-time result. Before applying a delayed query result
or changing local data/outbox, recheck the persisted available status, account
and fence **inside the same transaction** as the change. Perform scope/expiry
authorization immediately before that transaction and recheck policy/clock as
needed for queued long-running work. `await isCurrent(token)` followed by an
independent write leaves a race and is insufficient. The native browser fixture
contains the atomic policy-plus-pending-store fence example.

## Executable evidence

Commands from the owning repository:

```text
bun run build:auth
bun test packages/najm-auth/test/offline-access.test.ts
bun run --cwd packages/najm-auth test
bun run --cwd packages/najm-auth test:offline:browser
```

The focused suite covers consent/auth/domain grants, exact year/capability
access, credential-field stripping, installation/epoch mismatch, deadline,
delayed response, durable rollback/high-water, storage failure/corruption,
logout/disablement/revocation, account switch, two-client CAS races, policy
renewal and subscriber refresh. The package-surface test also imports the built
entry in Node with no Web Crypto and audits its import-free output. No browser
or server runtime is required to import it.

The native browser test uses the built public entry, real IndexedDB and two
pages plus a real module worker. It proves exactly one racing enrollment wins,
worker logout invalidates the page and its transaction fence, a late callback
cannot overwrite retained pending work, the lock survives reload, A cannot
authorize B, and expiry/rollback fail closed. Engines: Chromium
156.0.8078.4, Firefox 157.0 and Playwright WebKit 27.2. Raw report:
`packages/najm-auth/.cache/offline-access-browser.json`.

Package-wide `tsc -p packages/najm-auth/tsconfig.json` currently reports existing
test-fixture diagnostics (duplicate keys, email provider fixture types, fetch
mock typings and RSC test return types) outside this change. The new source,
focused tests and package-surface test pass strict standalone typechecking;
the package declaration build checks the source as well. This is not a claim
that the existing package-wide test configuration typechecks cleanly.

The proof does not establish School enrollment transport/permission registration,
real downloaded coverage, full dashboard/year runtime, durable attendance saves,
cross-device sync, encrypted shared-device unlock, signed server policy issuance,
phone browsers or installed iOS storage. Those require their own integration and
device evidence. Playwright WebKit is not Safari.
