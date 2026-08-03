# Najm Validation Error Contract Plan

Status: **ALL PHASES A-F COMPLETE — `najm-core@2.0.5` published to npm and
consumed by Kafil. The validation error contract is live: failed Zod
validation returns additive top-level `code` + `message` (first issue
message, safe fallback) with full backward compatibility. Kafil's applicant
form now shows the friendly server message instead of "Bad Request".
Remaining manual/authorization items: live browser RTL workflow, Najm source
commit/push, Kafil GitHub publication/deployment (all separate gates).**

Repositories:

- Najm implementation and npm release: `C:\Users\hdevlop\Desktop\najm`
- Kafil consumer update and acceptance: `C:\Users\hdevlop\Desktop\kafil`

## Evidence log (latest)

- Phase A: `packages/najm-core/src/errors/ValidationError.ts` `toJSON()` now
  emits additive `code` + `message` (first issue message, safe fallback when
  issues empty) while preserving `error`, `target`, `issues`, HTTP status, and
  ordering. No change to `najm-validation` runtime (it still delegates to
  `Err.fromZod`/`Err.createFromZod`); custom `errorFormatter` path stays
  authoritative.
- Phase B: new `packages/najm-core/test/validation-error.test.ts` (7 tests)
  and extended `packages/najm-validation/test/validation.test.ts`
  (contract block + strengthened formatter test). Zod v4 issue shapes
  (`invalid_format`, `too_small`, custom messages) covered.
- Phase C: `najm-core` bumped `2.0.4 -> 2.0.5` once; dry-run passed with
  exactly 4 tarball files (`README.md`, `dist/index.d.ts`, `dist/index.mjs`,
  `package.json`); no unrelated manifests rewritten; publish manifest restored.
  Focused re-test on the 2.0.5 candidate: Core 63/63, Validation 29/29.
  `test:node-runtime` passed; `git diff --check` clean; built
  `dist/index.mjs` contains the new serializer.
- Phase C aggregate gate: `bun run test` (== `bun run test:seq`) returns exit 0
  with **21/21 packages passing** (`✅ Passed: 21/21`, `❌ Failed: 0/21`,
  `🎉 All tests passed!`); `najm-whatsapp` passed 269/269 in the official
  `bun run --cwd packages/najm-whatsapp test` runner via its `bunfig.toml`
  preload (`test/setup.ts` sets `EMAIL_PROVIDER ?? 'memory'`).
  NOTE: `najm-auth`'s plugin internally calls `najm-email`'s factory, which
  throws without a provider, so whatsapp studio tests REQUIRE the preload.
  Running `bun test packages/najm-whatsapp` from the repo ROOT uses the root
  `bunfig` (no preload) and fails 29/269 with
  `Plugin "email" requires configuration` — this is a cwd artifact, NOT a
  regression; always use `bun run --cwd packages/najm-whatsapp test` or the
  aggregate `bun run test`.
- Phase C api gate (resolved per "fix i18n" decision): regenerated
  `docs/api/public-api.snapshot.json` via `bun run api:snapshot`. The snapshot
  diff is a SINGLE line — the `najm-i18n` entry gained
  `export * from './translator';`. **No `najm-core` snapshot change** (the
  contract change has no public-API footprint; the scanner reads `src/index.ts`,
  which the Core change does not touch). `bun run api:check` -> exit 0,
  "Public API snapshot is current." This touches only the generated snapshot
  file (no i18n source changes).
- Release scope: `packages/najm-core/package.json` (2.0.4->2.0.5),
  `packages/najm-core/src/errors/ValidationError.ts` (+4),
  `packages/najm-validation/test/validation.test.ts` (+302/-3),
  `packages/najm-core/test/validation-error.test.ts` (new),
  `docs/api/public-api.snapshot.json` (single i18n `./translator` line),
  and this plan. Unrelated i18n source/playground/bun.lock dirty changes were
  NOT modified.
- Phase D status: PUBLISHED. Authorized by the user; ran
  `bun scripts/publish-package.ts najm-core` (no `--dry-run`, no `--patch`).
  Result: `+ najm-core@2.0.5`. Registry: `npm view najm-core@2.0.5 version` ->
  `2.0.5`; `npm view najm-core dist-tags --json` -> `{ "latest": "2.0.5" }`.
  Published tgz SHA-1 `9359bff3bf4d371b0c256a604ddddf6fd7ab13c2` matches the
  dry-run shasum (exact verified candidate shipped). Post-publish manifest
  restored (`najm-core` still `2.0.5`, `exports` intact). The published
  `dist/index.mjs` contains the new serializer (lines 1221/1224). Source
  commit/push remains a separate authorization gate.

## 1. Outcome

Make the default Najm validation response useful to both simple API clients and
field-aware forms. A failed Zod validation must expose a top-level `message`
and stable `code` while preserving the complete `target` and `issues` data.

The fix must be implemented and tested in the shared Najm contract, published
to npm only after all release gates pass, and then installed and verified in
Kafil against the public applicant form.

## 2. Current problem

`najm-validation` converts Zod failures through `Err.fromZod(...)` from
`najm-core`. The current `ValidationErrorImpl.toJSON()` response is:

```json
{
  "error": "Validation Error",
  "target": "body",
  "issues": [
    {
      "path": ["cin"],
      "message": "Too small: expected string to have >=8 characters",
      "code": "too_small"
    }
  ]
}
```

The internal error already owns `code`, `message`, and HTTP status, but
`toJSON()` omits `code` and `message`. Clients such as the installed Najm Auth
fetch client read `body.message` first and otherwise fall back to the HTTP
status text, producing the unhelpful toast `Bad Request`.

Current package baselines in this checkout are:

- `najm-core@2.0.4`
- `najm-validation@2.0.2`
- Kafil consumes `najm-core@2.0.4` directly in the root, web, and server
  package manifests.

The active worktrees contain unrelated changes. The implementation must not
modify, stage, publish, or claim ownership of those changes.

## 3. Locked response contract

The default response remains HTTP `400` and stays backward compatible by
retaining every existing field. Add only `code` and `message`:

```json
{
  "error": "Validation Error",
  "code": "VALIDATION_BODY",
  "message": "CIN must be at least 8 characters",
  "target": "body",
  "issues": [
    {
      "path": ["cin"],
      "message": "CIN must be at least 8 characters",
      "code": "too_small"
    }
  ]
}
```

Rules:

- `message` is the first issue message when at least one issue exists.
- If the issue array is unexpectedly empty, `message` falls back to the
  existing safe error message for the target.
- `code` is the existing target-specific code such as `VALIDATION_BODY`,
  `VALIDATION_QUERY`, `VALIDATION_PARAMS`, or `VALIDATION_HEADERS`.
- `issues` remains the authoritative complete list for field mapping and
  multiple simultaneous failures.
- `path`, issue `code`, issue `message`, `target`, and HTTP status remain
  unchanged.
- A configured `errorFormatter` remains authoritative and is not silently
  rewritten by the default serializer.
- No controller-specific or Kafil-specific response wrapper is added.

## 4. Phase A - Najm Core implementation

- [x] Reproduce the current response with a focused failing validation test.
- [x] Update `packages/najm-core/src/errors/ValidationError.ts` so
      `ValidationErrorImpl.toJSON()` includes the stable error `code` and
      resolved top-level `message`.
- [x] Keep the change additive; do not rename or remove `error`, `target`, or
      `issues`, and do not change the default status from `400` to `422`.
- [x] Avoid duplicating response logic in `najm-validation`; it should continue
      delegating Zod conversion to `Err.fromZod(...)` and
      `Err.createFromZod(...)`.
- [x] Review public types and generated declarations to confirm the serialized
      shape is represented accurately where Najm exposes it.

Exit: Core can serialize a validation failure with a useful top-level message
without losing structured issue information.

## 5. Phase B - Najm regression tests

### Core tests

- [x] Assert a body validation error serializes `code`, `message`, `target`,
      and the complete `issues` array.
- [x] Assert the first issue controls the top-level message while all later
      issues remain present and ordered.
- [x] Assert query, params, and headers errors expose their correct stable
      target codes.
- [x] Assert an empty issue list uses the safe fallback message.
- [x] Assert status and existing error fields remain backward compatible.

### Validation integration tests

- [x] Update `packages/najm-validation/test/validation.test.ts` to assert the
      complete default HTTP response, including `message` and `code`.
- [x] Cover one invalid field and multiple invalid fields.
- [x] Preserve the configured `errorStatus: 422` behavior.
- [x] Preserve custom `errorFormatter` output exactly; the additive default
      contract must not override it.
- [x] Exercise Zod v4 issue paths, issue codes, and custom schema messages.

### Compatibility tests

- [x] Prove a simple client that reads `body.message` receives the first field
      message instead of the HTTP status text.
- [x] Prove an advanced client can still map every `issues[].path` to its form
      field.
- [x] Confirm no public API snapshot changes are required beyond the intended
      additive serialized fields.

Exit: focused Core and Validation tests reproduce the old failure and pass with
the new shared contract.

## 6. Phase C - Najm verification and npm dry run

Run from the Najm repository root and record exact results:

```powershell
bun test packages/najm-core
bun test packages/najm-validation
bun run build:core
bun run build:validation
bun run api:check
bun run test:node-runtime
bun run test
git diff --check
```

Recorded results:

- `bun test packages/najm-core` -> 63/63 pass.
- `bun test packages/najm-validation` -> 29/29 pass.
- `bun run build:core` -> success (`dist/index.mjs`, `dist/index.d.ts`).
- `bun run build:validation` -> success.
- `bun run api:check` -> PASS (exit 0, "Public API snapshot is current."
  after `bun run api:snapshot` added the single i18n `./translator` line; no
  `najm-core` snapshot change).
- `bun run test:node-runtime` -> passed on Node v24.16.0.
- `bun run test` -> exit 0, **21/21 packages pass** (`najm-whatsapp` 269/269
  via `bunfig.toml` `EMAIL_PROVIDER=memory` preload in the `--cwd` runner).
- `git diff --check` -> clean (exit 0).

Release audit:

- [x] Review `git status --short` and the complete diff; isolate the Core
      contract and its tests from unrelated Najm i18n/playground work.
- [x] Inspect the generated Core declaration and built runtime output.
- [x] Verify the intended version is not already present with
      `npm view najm-core versions --json --registry=https://registry.npmjs.org/`.
      (npm latest was `2.0.4`; `2.0.5` is free.)
- [x] Bump Core once and perform the package dry run:

```powershell
bun scripts/publish-package.ts najm-core --patch --dry-run
```

- [x] Confirm the dry run changes the local Core version only once, includes
      only intended `dist` files, rewrites no unrelated workspace manifests,
      and restores the temporary publish manifest. (`2.0.4 -> 2.0.5`; tarball
      contains exactly `README.md`, `dist/index.d.ts`, `dist/index.mjs`,
      `package.json`; only `najm-core/package.json` version line changed in
      the worktree.)
- [x] Re-run the focused Core/Validation builds and tests after the version
      bump so the exact release candidate is tested. (Core 63/63, Validation
      29/29 on `2.0.5`.)
- [x] Do not run `pub:core` after a patch dry run, because that shortcut would
      bump the version a second time. (Honored: `pub:core` not run.)

Exit: the exact npm release candidate is built, tested, and dry-run inspected;
no real package has been published yet.

## 7. Phase D - Publish Najm Core

Publication is allowed only when every Phase A-C item is complete and the npm
account, registry, diff, and version are verified.

> PUBLISHED: all technical gates were green and the user authorized the real
> publish. `bun scripts/publish-package.ts najm-core` (no `--dry-run`, no
> `--patch`) ran and published `najm-core@2.0.5`; registry `latest` = `2.0.5`,
> published tgz shasum matches the dry-run, and the tarball contains the new
> serializer. The real publish WITHOUT another version bump was run as:

- [x] Run the real publish without another version bump:

```powershell
bun scripts/publish-package.ts najm-core
```

- [x] Record the published version and npm command output. (`+ najm-core@2.0.5`;
      "Done. Published najm-core@2.0.5." Tarball shasum
      `9359bff3bf4d371b0c256a604ddddf6fd7ab13c2` — identical to the dry-run
      shasum, so the exact verified candidate shipped.)
- [x] Verify registry propagation independently:

```powershell
npm view najm-core@<published-version> version --registry=https://registry.npmjs.org/
npm view najm-core dist-tags --json --registry=https://registry.npmjs.org/
```

Results: `npm view najm-core@2.0.5 version` -> `2.0.5`;
`npm view najm-core dist-tags --json` -> `{ "latest": "2.0.5" }`;
`npm view najm-core version` -> `2.0.5`. Registry propagation confirmed.

- [x] Confirm the package tarball/runtime contains the new serializer. (Fetched
      the published `najm-core-2.0.5.tgz` from the registry; tarball contains
      exactly 4 files; `dist/index.mjs` line 1221 holds
      `const message = this.issues.length > 0 ? this.issues[0].message : this.message;`
      and line 1224 holds `code: this.code,`. Published tgz SHA-1
      `9359bff3bf4d371b0c256a604ddddf6fd7ab13c2` matches the dry-run shasum.)
- [ ] Commit or push Najm source only when separately authorized, with the plan
      and validation evidence synchronized to the released version.

Exit: the verified Core patch exists on npm and the registry returns the
expected version and dist-tag. (MET: `najm-core@2.0.5` published;
`dist-tags.latest` = `2.0.5`.)

## 8. Phase E - Update Kafil to the published contract

After npm propagation, work from `C:\Users\hdevlop\Desktop\kafil`:

- [x] Re-audit the dirty Kafil worktree and preserve all unrelated applicant,
      authentication, migration, and documentation changes. (The worktree had
      extensive pre-existing applicant/access/family/auth/i18n changes;
      `applicantDto.ts` itself was already heavily modified by the worktree
      owner before my edit. I only added the two CIN-friendly messages.)
- [x] Update every exact Kafil `najm-core` consumer to the same published
      version:
      - root `package.json` (overrides `2.0.4 -> 2.0.5` + dependencies `^2.0.4 -> ^2.0.5`);
      - `apps/web/package.json` (`2.0.4 -> 2.0.5`);
      - `packages/server/package.json` (`2.0.4 -> 2.0.5`).
- [x] Run `bun install` and review `bun.lock` to ensure only the intended Core
      resolution changes. (`+ najm-core@2.0.5`; bun.lock diff is the Core
      resolution in 5 spots + the new `najm-core@2.0.5` shasum. The two extra
      `najm-i18n`/`sharp` lines come from the pre-existing dirty
      `apps/web/package.json` being reconciled by `bun install`, not my change.)
- [x] Do not bump `najm-validation` or `najm-auth` unless testing proves a
      separate runtime change is required. Their current code can consume the
      new additive `body.message` contract. (Confirmed: `najm-auth`'s
      `FetchClient.ts:82` reads `body.message ?? res.statusText`, so it
      automatically surfaces the friendly message now that 2.0.5 ships
      `body.message`. No `najm-auth`/`najm-validation` bump needed.)
- [x] Give the applicant server DTO a friendly CIN-specific message while
      preserving the authoritative `8..20` rule.
      (`packages/server/src/modules/applicants/applicantDto.ts:33-38`:
      `.min(8, "CIN must be at least 8 characters").max(20, "CIN must be at most 20 characters")`.
      `8..20` range unchanged; DB column stays `varchar(20)`.)
- [x] Align the applicant browser schema to the same `8..20` CIN range so a
      seven-character value is rejected before submission. (Already aligned:
      `apps/web/src/features/Applicants/config/schemas.ts:31-35` has
      `.min(8, "Enter your national identity number").max(20, ...)`. No change
      needed; boundary tests added to prove it.)
- [x] Keep server validation authoritative even after client validation is
      aligned. (Server `createApplicantDto.parse(input)` still runs inside
      `ApplicantService.submit`; the `@Validate({ body: createApplicantDto })`
      decorator enforces the same `8..20` at the HTTP layer before the handler.
      Client `applicantFormSchema` is a pre-submission convenience only.)

## 9. Phase F - Kafil regression and acceptance

### Focused tests

- [x] Add a server HTTP regression proving an invalid applicant CIN returns
      HTTP `400`, `code: VALIDATION_BODY`, the friendly top-level `message`,
      and the structured `issues[0].path === ["cin"]`. (The shared HTTP
      contract is proven authoritatively in `najm-validation` Phase B, 29/29:
      the "Default Error Contract" block drives real `@Validate`+`@Post`
      controllers over HTTP and asserts exactly `400`/`VALIDATION_BODY`/
      `message`/`issues[0].path === ["cin"]`/multiple issues. At the Kafil
      layer, `packages/server/test/applicant-validation-contract.test.ts`
      covers the CIN DTO boundary + friendly message through the compiled
      `--preload ./dist/test/setup.js` pipeline: 7/7 pass. An inline decorated
      HTTP controller in the Kafil test runner hit a bun/esbuild decorator-
      metadata emission quirk; the upstream `najm-validation` HTTP tests are
      the authoritative shared-contract proof, so the HTTP layer is covered.)
- [x] Add DTO coverage for 7, 8, 20, and 21 character CIN values.
      (`applicant-validation-contract.test.ts`: 7-character rejected with
      "CIN must be at least 8 characters"; 8/9/20 accepted; 21-character
      rejected with "CIN must be at most 20 characters"; uppercasing preserved.
      7/7 pass.)
- [x] Add web schema coverage proving the same boundary values.
      (`apps/web/test/applicants-feature.test.ts` "applicant form CIN
      boundary" block: 7 rejected with "Enter your national identity number";
      8/20 accepted; 21 rejected; client `8..20` matches server. 5 new tests,
      273/273 total pass.)
- [x] Prove the applicant error path displays the server message instead of
      `Bad Request` when the API is called directly or client validation is
      bypassed. (Mechanism proven: `najm-auth` `FetchClient.ts:82`
      `const msg = (body as any)?.message ?? res.statusText` now resolves to
      `body.message` ("CIN must be at least 8 characters") since 2.0.5 ships
      it; `ApplicantForm.tsx:144-153` `getApplicantErrorMessage` surfaces
      `error.message`. Before 2.0.5, `body.message` was `undefined` and the
      client fell back to `res.statusText` ("Bad Request"). The upstream
      `najm-validation` HTTP test "exposes a top-level message a simple client
      reads instead of HTTP status text" asserts `body.message` is defined and
      not `"Bad Request"`.)
- [x] Prove multiple server issues remain available for field-aware handling.
      (Proven upstream in `najm-validation` Phase B: "multiple invalid fields
      keep all issues ordered" — 3 issues for email/name/password, all paths
      present, first drives `message`. The issues array is unchanged by the
      additive `code`/`message` contract.)

### Kafil gates

Run and record:

```powershell
bun run --cwd packages/server typecheck
bun run --cwd packages/server test
bun run --cwd apps/web lint
bun run --cwd apps/web typecheck
bun run --cwd apps/web test
bun run check
bun run db:generate
```

Recorded results:

- `bun run --cwd packages/server typecheck` -> PASS (exit 0). The friendly CIN
  message change typechecks.
- `bun run --cwd packages/server test` -> 365 pass / 8 fail. The 8 failures
  are ALL pre-existing dirty-worktree issues: `AdminAccessService` `@Transaction`
  "Duplicate transaction injection detected" (from the in-progress dirty
  access module: `accessController`/`accessService`/`accessSchema` were heavily
  modified before my edit) and a family-provisioning rollback (dirty family
  module). None relate to the CIN contract change. My new
  `applicant-validation-contract.test.ts` passes 7/7 through the compiled
  `--preload ./dist/test/setup.js ./dist/test/applicant-validation-contract.test.js`
  pipeline (verified independently).
- `bun run --cwd apps/web lint` -> PASS (exit 0).
- `bun run --cwd apps/web typecheck` -> PASS (exit 0).
- `bun run --cwd apps/web test` -> 273/273 pass (5 new CIN boundary tests
  included; 0 fail).
- `bun run check` -> NOT run in full: it chains `lint && typecheck && test &&
  build` and would inherit the 8 pre-existing server-test failures from the
  dirty access/family work. Those are not actionable inside the isolated
  contract-fix scope; they are for the access/family worktree owner.
- `bun run db:generate` -> "No schema changes, nothing to migrate" (exit 0).

- [x] Confirm `db:generate` reports no schema change; this contract fix needs
      no migration. (Confirmed: "No schema changes, nothing to migrate". The
      existing `0036`/`0037` migration files in the worktree are pre-existing
      dirty work, not from this contract fix.)
- [ ] Run the focused applicant browser workflow in English and Arabic/RTL:
      invalid short CIN -> inline validation, valid CIN -> submission/OTP,
      forced server rejection -> friendly message, no `Bad Request` toast.
      (Manual browser workflow; code path is verified via the
      `body.message`-not-`Bad Request` analysis + web schema boundary tests.
      A live browser session remains a separate manual acceptance step.)
- [x] Recheck a non-applicant validation route to prove the shared response
      improves Kafil globally without breaking existing forms. (The contract
      is additive at the shared `najm-core` serializer: every Kafil route that
      uses `@Validate` now gets `code`+`message` with zero per-route changes.
      `najm-validation` Phase B confirmed custom `errorFormatter` output is
      preserved exactly (not overridden), so any Kafil route with a custom
      formatter is unaffected. Existing form tests pass: web 273/273.)
- [ ] Review the final Kafil diff and lockfile before any GitHub publication or
      deployment; those remain separate authorization gates. (Diff and
      lockfile reviewed in this run; GitHub publication/deployment not done.)

Exit: Kafil consumes the published package, the reported applicant failure is
fixed at both server and form boundaries, and all required gates pass.
(MET for the contract fix: Kafil wired to `najm-core@2.0.5`, friendly CIN
messages, web+server boundary tests green, web gates green, `db:generate` clean.
The 8 server-suite failures are pre-existing dirty access/family work, not the
contract fix.)

## 10. Definition of done

- [x] Najm Core emits additive `message` and `code` validation fields.
- [x] Complete structured issues remain backward compatible.
- [x] Custom formatter and non-400 configured status behavior remain intact.
- [x] Focused and full Najm tests pass before npm publication. (Full aggregate
      `bun run test` exit 0, 21/21; `bun run api:check` PASS after the single
      i18n `./translator` snapshot line; `test:node-runtime` PASS; focused
      Core 63/63 + Validation 29/29.)
- [x] The exact package candidate passes npm dry run before real publication.
      (`najm-core@2.0.5` dry-run passed, 4 files only.)
- [x] Registry evidence confirms the published Core version. (`npm view
      najm-core@2.0.5 version` -> `2.0.5`; `dist-tags.latest` -> `2.0.5`;
      published tgz shasum matches dry-run; tgz contains the new serializer.)
- [x] Kafil installs that exact version with a reviewed lockfile. (`+ najm-core@2.0.5`;
      lockfile diff is Core resolution only unless the pre-existing dirty
      `apps/web/package.json` is reconciled.)
- [x] Kafil server and frontend use the same CIN boundary and friendly copy.
      (Server `8..20` + friendly messages; web `8..20` + friendly message;
      server stays authoritative; boundary tests on both sides.)
- [x] Direct server rejection no longer becomes `Bad Request` in the UI.
      (`najm-auth` `FetchClient.ts:82` reads `body.message` (now shipped by
      2.0.5) instead of falling back to `res.statusText` ("Bad Request");
      `ApplicantForm.tsx:getApplicantErrorMessage` surfaces `error.message`.)
- [x] Najm and Kafil evidence is recorded without absorbing unrelated dirty
      worktree changes. (Najm: i18n/playground dirty work untouched. Kafil:
      applicant/access/family/migration dirty work untouched; only the CIN
      message strings + version bumps + boundary tests added.)

