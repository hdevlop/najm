# Database synchronization first-slice primitives

Date: 2026-10-19. Candidate `najm-database@2.3.1`. This is reusable-core
evidence, not School synchronization rollout or authenticated UI acceptance.

The package adds separate portable contracts, browser replica, server operation
kernel and PostgreSQL schema/capture entries. Legacy root imports retain their
existing runtime dependencies. `beforeTransaction` is opt-in and runs inside
the outermost transaction before domain work, once per attempt; nested calls
reuse the transaction. Retry and rollback tests prove ordering and refusal.

Full package suite: **142 passed, 370 assertions**. New portable/browser source
strict typecheck, declaration build and public API snapshot pass. Existing
transaction integration remains in that suite. Pure canonical JSON rejects
coercion/undefined/non-finite/cyclic payloads, unknown envelope fields, invalid
IDs/scopes/dependencies and changed hashes. Local tests use the published exact
`fast-idb@0.3.0` with fake IndexedDB and actual fault injection for second writes
and commit failure. They cover snapshots, late activation, scoped pending work,
newer revisions, uncertainty, cancellation, expiry, quarantine and explicit
authorized recovery without changing a previously sent command.

Build, then run the owning integration script with a loopback PostgreSQL admin
URL (`OFFLINE_PROOF_ADMIN_URL`, or School's env only to reuse loopback admin
credentials). It rewrites the URL to `/postgres` before connecting, creates an
unpredictable `najm_sync_proof_<uuid>` database, verifies its marker and drops
only that exact marked database. The normal School database is never contacted.

Ten built-entry PostgreSQL checks pass:

- Concurrent copies and lost-response retry perform one canonical mutation.
- Reusing an ID with another hash is refused; duplicates recheck current access.
- A second history INSERT error rolls back domain, revision, journal and result.
- A reviewable conflict rolls back its partial savepoint before persisting refusal.
- Ordinary SQL/upsert/delete publishes actual AFTER ROW effects, explicit fields
  and increasing revisions, without attempted-insert events or private columns.
- Moving a year emits an old-scope deletion and new-scope value in one group.
- Changed IDs and TRUNCATE are refused. Unresolved year columns fail closed.
- Unknown/rejected dependencies never mutate; mappings from another device
  identity cannot serve as predecessors.

Chromium 156.0.8078.4, Firefox 157.0 and Playwright WebKit 27.2 pass four native
checks each against the built client and real PostgreSQL operation store:

- A committed reply is deliberately replaced by 503; page close/reopen and
  status lookup recover it without a second push.
- API unavailability retains the same durable command; concurrent tab senders
  use native Web Locks and converge to one outcome.
- A real dedicated worker opens the same fast-idb replica and sends queued work.
- A stale revision becomes a durable reviewable conflict with original input.

The browser import build rejects server/Node dependencies. A real Drizzle Kit
generation through the built entry creates seven additive tables; the PostgreSQL
proof applies that generated migration rather than duplicating package DDL.
The initial 2.3.0 publication used a native BigInt default that prevented School
migration generation. Version 2.3.1 replaces it with a SQL zero expression and
adds snapshot-default and actual migration-generation regression checks. No
School migration had been applied when that issue was found.

Raw results are in
`packages/najm-database/integration/sync/.output/results.json`; they are copied
to the School ledger separately at publication/adoption.

Important boundaries: fixture actors and DTOs are explicit synthetic policy,
not School authentication. The origin's API is made unavailable while static
assets remain online; this is not an installed-PWA cold launch test. Physical
phones, quota/process termination, joined-domain capture and complete writer
coverage remain outside this package proof. The capture generator handles
direct-year/simple-ID tables; parent-derived-year/cascade projections and
initial revision backfill still need reviewed School adapters. Schema composition
does not run a migration or enable capture. Production migration, permissions,
enrollment and deployment remain separate steps.

## fast-idb 0.3.1 (2026-10-24)

The browser entry's exact optional peer moved to `fast-idb@0.3.1` (atomic
migrations with a bounded upgrade phase, serialized `putIfNewer`, commit
notification after a late callback failure). The full package suite passes on
it: 142 tests, with the surface test pinning the new peer. The PostgreSQL
integration script was not rerun for this peer change.
