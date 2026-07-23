# Najm Production Findings Follow-up

Date: 23 July 2026

This report records the upstream Diject/Najm changes made in response to the Kafil VPS findings and the local release evidence collected afterward.

## Outcome

- Published `diject@0.1.8` with constructor-identity injection lookup.
- Updated Najm Core to require `diject@^0.1.8`.
- Made invalid or duplicate `@Transaction` configuration fail closed with constructor, method, and database diagnostics.
- Changed the stock `RoleGuard` to consume the dedicated role request context.
- Added canonical `USER`, `ROLE`, and `PERMISSIONS` assertions for session, bearer, and refresh-cookie authentication.
- Added a production Playground regression using two controllers with the same runtime class name and method name but opposite guards.

## Verification

| Gate | Result |
| --- | --- |
| Diject focused collision regression | 17 passed, 0 failed |
| Diject complete suite | 354 passed, 0 failed |
| Diject package build | Passed (ESM and declarations) |
| Najm Core focused regression | 11 passed, 0 failed |
| Najm Database transaction hardening | 3 passed, 0 failed |
| Najm Auth security regression | 14 passed, 0 failed |
| Najm official full sequential gate, `bun run test` | Passed; all 24 workspaces built and every workspace test command passed |
| Playground test suite within the full gate | 6 passed, 0 failed |
| Playground Next.js 15.5.9 production build | Passed, including type validation and 10 static pages |

The production server smoke used a disposable, migrated SQLite database and minification remained enabled.

| Production route | Expected | Actual |
| --- | --- | --- |
| `GET /api/injection-regression/allowed` | Only the allow guard executes | `200`, `{"route":"allowed","isolated":true}` |
| `GET /api/injection-regression/denied` | Only the deny guard executes | `401`, `{"code":"HTTP_401","message":"Unauthorized","status":401}` |

The production log confirmed server initialization and contained neither `@Transaction on non-method` nor a transaction identity/duplicate configuration error. The smoke server was stopped after the probes.

## Findings disposition

- Constructor-name injection collision: fixed in Diject and covered by library, Najm Core, and production Playground regressions.
- Foreign transaction metadata: blocked by exact constructor validation.
- Missing/non-method transaction targets: now startup configuration errors instead of warnings.
- Duplicate transaction metadata/wrappers: now rejected.
- Role context: the stock guard now reads the dedicated role token; all three authentication paths assert canonical contexts.
- Direct Bun execution: the complete Diject and Najm sequential suites passed on Bun 1.3.14, including decorated TypeScript tests.

## Deployment boundary

This verifies the upstream libraries and the local Playground production bundle. It does not deploy Kafil or replace the Kafil-specific post-upgrade checks. After Kafil installs `diject@0.1.8` through the updated Najm dependency, its operator, sponsor, family, and admin-superrole dashboard smokes still need to run in the exact Next.js 16.2.10/Turbopack deployment. The temporary Kafil minification workaround should be removed only after those checks pass and startup logs remain free of transaction warnings.

## Release note

The npm publish succeeded. A source-control push could not be performed from the supplied Desktop copies because neither the Diject nor Najm directory had usable Git repository metadata or a discoverable remote.
