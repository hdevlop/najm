# Najm Kit Resilient Image Preview Plan

Status: **PUBLISHED — `najm-kit@2.1.49` live on npm**

Last updated: 2026-08-04

Repository: `C:\Users\hdevlop\Desktop\najm`

Package: `packages/najm-kit`

Current published baseline: `najm-kit@2.1.49`

Primary consumer: Kafil Brand assets settings

Implementation status (2026-08-04):

- Phases 1–6 are complete (helpers, source precedence, race-safe state,
  static CSS, form/avatar integration, tests, README, playground,
  changelog).
- Phase 7 (release) is complete: `scripts/publish-package.ts` supports
  `--pack-only`, `--publish-tarball <path>`, `--tarball-dir <dir>`, and
  `--verify-published <version>`; 25 tests cover the new CLI flags.
  `najm-kit@2.1.49` is published from the exact tarball packed at the
  release commit; the post-publish registry integrity matches the local
  SHA-256.
- Phase 8 (Kafil handoff) is unblocked — see Phase 8 below.

Verification baseline (2026-08-04): 718 UI tests pass, 34 image-input
tests pass, 26 image-preview helper tests pass, 25 publish-package
tests pass, `bun run --cwd packages/najm-kit lint` passes, `bun run
build:ui` produces a `dist/theme.css` containing the
`nimage-input-control` and `nimage-input-compact-overlay` rules.

## Review verdict (2026-08-04)

Review checks before declaring this plan "ready for release":

- **High — defaultImage failure path is untested.** The plan's acceptance list
  only covered primary/fallback failures. With `value={null}` the candidate
  pipeline is empty, `defaultImage` renders directly, and its `onError`
  cannot mark it failed. The plan must (a) require the implementation to
  feed `defaultImage` through the candidate pipeline when `value` is null,
  and (b) add the matching tests.
- **High — pointer/touch gate is not real CSS.** The runtime constructed
  arbitrary classes (`[@media (hover: hover) and (pointer: fine)]:opacity-0`)
  are not present as literals the Tailwind v4 scanner can pick up, and the
  built `dist/theme.css` does not contain the rule. The current `image-input.test.tsx`
  test only inspects the runtime class string. The plan must move to a
  static CSS class compiled into `dist/theme.css` and a compiled-CSS or
  computed-style test, following the existing `ntable-card-action` pattern.
- **High — "byte-for-byte" release gate is not what `publish-package.ts`
  does.** The script rebuilds and runs `npm publish --workspace` on every
  invocation; there is no persistent tarball or hash linking dry-run to
  publication. The plan must either build and hash a tarball first and
  publish only that tarball, or rename the gate to "source-commit
  attributable" and document the actual evidence (commit SHA + post-publish
  registry integrity).
- **Medium — untracked plan and uncommitted work conflict with the status.**
  `PLAN.md` is untracked, the implementation already exists in the worktree,
  and unrelated deletions are present. The plan must move to **IN PROGRESS**,
  record what is verified, and resolve the release scope before any version
  bump.

### Second-round review (2026-08-04)

- **High — default-image precedence is contradictory.** The plan, code, and
  tests disagreed on whether `fallbackImage` participates in the empty-
  value state. The README also claimed default images had no failure
  tracking. The plan now mandates an asymmetric contract: string `value`
  uses `value → fallbackImage → defaultImage`; null/empty `value` uses
  only `defaultImage`. README, plan, and tests must agree.
- **High — release attribution must be exact-tarball, not commit-only.**
  Recording a "binding commit" before the version bump is wrong because the
  bump itself changes `package.json`. The new flow is: bump → commit the
  bump as the release commit → pack and hash the tarball from the release
  commit → dry-run the exact tarball → publish the same tarball. The
  script now records the packing commit in a sidecar `.commit` file and
  refuses to publish if the sidecar does not match `HEAD`.
- **High — state reset must not be effect-driven.** The implementation
  called `setFailedSources` from a `useEffect`, which conflicted with the
  plan's "without a synchronous-effect state loop" wording. The fix is
  the React-recommended derived-state pattern (tracked-key state plus
  during-render `setState`), and the plan now explicitly disallows
  `useEffect`-driven `setFailedSources`.
- **High — new tarball options need tests.** The script had no tests for
  `--pack-only`, `--publish-tarball`, `--tarball-dir`, or
  `--verify-published`. `scripts/publish-package.test.ts` now covers the
  CLI parsing, sidecar round-trip, and SHA-256 helpers.
- **High — script portability.** The original `--pack-only` helper
  invoked `rm -f` which is not available on Windows. Replaced with
  `unlinkSync`, and `npm pack` now uses `--json` to capture the tarball
  name from stdout instead of stderr.
- **Medium — worktree conflicts remain unresolved.** `PLAN.md` is still
  untracked, `VALIDATION-ERROR-CONTRACT-PLAN.md` and
  `docs/api/public-api.snapshot.json` are still deleted, and the
  release commit has not been staged. Resolve the worktree before
  initiating the release flow.

## Current state snapshot (2026-08-04)

Working tree (relative to `master`):

- `VALIDATION-ERROR-CONTRACT-PLAN.md` and `docs/api/public-api.snapshot.json`
  are deleted (status: not decided — restore or drop before release).
- `packages/najm-kit/CHANGELOG.md`, `README.md`, and the
  `playground/src/docs/pages/InputsPage.tsx` / `FormPage.tsx` docs are
  modified but not committed.
- `packages/najm-kit/src/components/inputs/ImageInput.tsx` and the
  matching `imagePreview.ts` helper already implement the contract from
  Phase 1 and most of Phase 2/3, but the chapters below list the remaining
  gaps (defaultImage failure path, static CSS class for the pointer gate).
- `packages/najm-kit/test/image-input.test.tsx` and
  `packages/najm-kit/test/inputs/image-preview.test.ts` are new and
  untracked. The form-side type test moved to
  `packages/najm-kit/test/form/image-input.test-d.tsx` (untracked).
- The current `2.1.48` version is published; the changelog is updated in
  the **Unreleased** section.

Implementation status after the second-round review:

- `packages/najm-kit/src/components/inputs/ImageInput.tsx` now routes
  `defaultImage` through the candidate pipeline when `value` is null/empty
  and resets failure state via the derived-state pattern (no `useEffect`
  calling `setFailedSources`).
- `packages/najm-kit/src/theme.css` defines the static
  `nimage-input-control` and `nimage-input-compact-overlay` classes inside
  an `@media (hover: hover) and (pointer: fine)` block, mirroring the
  `ntable-card-action` pattern. The rule is shipped in `dist/theme.css`
  via `scripts/build-css.mjs`.
- `packages/najm-kit/test/image-input.test.tsx` covers the asymmetric
  precedence contract (string value uses value → fallback → default;
  null value uses only defaultImage), the failing-defaultImage → unavailable
  transition, and the compiled-CSS gate.
- `packages/najm-kit/README.md` was updated to describe the asymmetric
  precedence contract and the failed-default → unavailable transition.
- `scripts/publish-package.ts` now supports `--pack-only`,
  `--publish-tarball <path>`, `--tarball-dir <dir>`, and
  `--verify-published <version>`. Packing writes a sidecar `<tarball>.commit`
  file containing the commit SHA at packing time; publishing refuses to
  publish a tarball whose recorded commit does not match `HEAD`. The
  script uses `unlinkSync` and `npm pack --json` and is portable to
  Windows.
- `scripts/publish-package.test.ts` covers the new CLI parsing, sidecar
  round-trip, and SHA-256 helpers.

Verification baseline (2026-08-04):

- 718 UI tests pass (`bun run test:ui`).
- 25 publish-package tests pass (`bun test scripts/publish-package.test.ts`).
- `bun run --cwd packages/najm-kit lint` passes.
- `bun run build:ui` produces a `dist/theme.css` containing the
  `nimage-input-control` and `nimage-input-compact-overlay` rules and
  the `(hover: hover) and (pointer: fine)` media-query block.
- `bun scripts/publish-package.ts najm-kit --pack-only` produces
  `dist-publish/najm-kit-2.1.48.tgz` with the correct SHA-256 and a
  sidecar `.commit` file containing the current commit SHA.

Pre-release checklist (must complete before any version bump):

- [x] Resolve the working tree: the unrelated deletions of
  `VALIDATION-ERROR-CONTRACT-PLAN.md` and `docs/api/public-api.snapshot.json`
  remain in the working tree but were intentionally excluded from the
  release commit per the release scope decision.
- [x] Stage and commit the implementation, tests, README, playground,
  changelog, `PLAN.md`, and `scripts/publish-package.test.ts` as a single
  release commit (`eb7b5d2`).
- [x] Bump the patch version in `packages/najm-kit/package.json` from
  `2.1.48` to `2.1.49` and commit the bump as the release commit
  (`82064f0`).
- [x] Run the exact-tarball workflow from Phase 7. See release evidence
  below.

Do not mark a phase complete until the verification steps and the
recorded evidence match the chapter's exit gate.

## Release evidence (2026-08-04)

- Release version: `najm-kit@2.1.49`.
- Implementation commit: `eb7b5d2` ("feat(kit): resilient image
  preview contract and exact-tarball publish").
- Release commit (version bump): `82064f0d194e2c60c06676dc6fb3efd5bf6f7591`
  ("chore(release): publish najm-kit@2.1.49").
- Pack command:
  `bun scripts/publish-package.ts najm-kit --pack-only --no-build --skip-whoami`.
- Tarball path: `dist-publish/najm-kit-2.1.49.tgz`.
- Tarball SHA-256: `dee1fa84dc280ac5fa567e3178d9dccc3947cff0a3d705cebbd95fe0e21b926a`.
- Tarball SHA-1 (npm `shasum`): `d52ef1be9bd18b08c086ca515598a729069820d2`.
- Tarball sidecar commit: `82064f0d194e2c60c06676dc6fb3efd5bf6f7591`
  (matches `HEAD` at publish time).
- Tarball contents (12 entries): `package.json`, `CHANGELOG.md`,
  `README.md`, `dist/index.mjs`, `dist/index.d.ts`, `dist/json.mjs`,
  `dist/json.d.ts`, `dist/adapters/next.mjs`, `dist/adapters/next.d.ts`,
  `dist/NTableJson-tXqgfZI1.d.ts`, `dist/theme.css`,
  `dist/theme.css.d.ts`. No source files, no secrets, no unrelated
  manifests.
- Dist declarations (post-publish) expose `ImageInputPreviewSource`,
  `ImageInputPreviewError`, `previewAlt`, `fallbackImage`,
  `fallbackAlt`, `unavailableContent`, `imageClassName`,
  `onPreviewError`, `replaceAriaLabel`, and `clearAriaLabel`. Confirmed
  in `dist/index.d.ts:2181`, `:2183`, `:2219`, `:2220`, `:2226`,
  `:2231`, `:2233`.
- Dry-run command:
  `bun scripts/publish-package.ts najm-kit --publish-tarball
  dist-publish/najm-kit-2.1.49.tgz --dry-run --skip-whoami`. Exit code
  0, npm reported
  `+ najm-kit@2.1.49 (dry-run)`.
- Publish command:
  `bun scripts/publish-package.ts najm-kit --publish-tarball
  dist-publish/najm-kit-2.1.49.tgz --skip-whoami`. Exit code 0, npm
  reported `+ najm-kit@2.1.49`.
- Registry integrity (post-publish via `--verify-published 2.1.49`):
  - `dist.integrity: sha512-SAFtxSVZuZBEd40X2EUPIc7PjUGPgq3T7nDBQwRVoAEakvUb78ViHy8p23Re/pJedAMAyy7FXJX/PYjg5D1B7Q==`
  - `dist.shasum:   d52ef1be9bd18b08c086ca515598a729069820d2`
  - `dist.tarball:  https://registry.npmjs.org/najm-kit/-/najm-kit-2.1.49.tgz`
- Cross-verification: `bunx npm pack najm-kit@2.1.49` produced a
  tarball whose `shasum` matched the registry
  (`d52ef1be9bd18b08c086ca515598a729069820d2`) and whose SHA-256
  matched the locally packed tarball
  (`DEE1FA84DC280AC5FA567E3178D9DCCC3947CFF0A3D705CEBBD95FE0E21B926A`).
- Test counts at release: 718 UI tests pass, 34 image-input tests,
  26 image-preview tests, 25 publish-package tests, lint clean.
- Migration notes for consumers:
  - All new props are additive and backward-compatible.
  - Source precedence is asymmetric: string `value` uses
    `value → fallbackImage → defaultImage`; null/empty `value` uses only
    `defaultImage`. `fallbackImage` is the explicit fallback for a
    controlled value, not the empty-state default.
  - A failing `defaultImage` (even with `value={null}`) now fires
    `onPreviewError({ source: "default" })` exactly once and renders the
    `unavailableContent` (or the neutral default) instead of a broken
    `<img>`.
  - Replace and clear controls are real `<button>` elements with the
    static `nimage-input-control` / `nimage-input-compact-overlay`
    visibility rule compiled into `dist/theme.css`. Touch and
    coarse-pointer devices keep the controls visible; only fine-pointer
    desktops fall back to hover/focus reveal.
- Follow-up issues: none opened for Najm Kit. Kafil-specific work
  belongs in the Kafil repository (separate gate).

## Goal

Enhance the shared `ImageInput`/`AvatarInput` contract so applications can show
remote, local, fallback, and unavailable image states without a broken native
image icon, hard-coded English alternative text, hover-only controls, or
application-specific preview wrappers.

The result must remain framework-neutral React. Najm Kit must not import Next.js,
know Kafil branding slots, fetch Kafil endpoints, or own application storage.

## Confirmed code baseline

- `packages/najm-kit/src/components/inputs/ImageInput.tsx` renders native
  `<img>` elements with hard-coded `alt="Preview"` and `alt="Default"`.
- A failed `value` or `defaultImage` URL has no `onError` transition, fallback
  source, unavailable state, or error callback.
- The compact replace overlay and remove action use `opacity-0 group-hover`, so
  touch and keyboard users cannot reliably discover them.
- Several upload targets are clickable `<div>` elements and are not complete
  keyboard buttons.
- `imageVersion` always appends `?v=...`, which breaks URLs that already contain
  a query string and does not preserve URL fragments deliberately.
- `ImageInputProps` in `src/components/inputs/types.ts` has no preview alt,
  fallback, unavailable-content, image-class, or preview-error contract.
- `AvatarInput` delegates to `ImageInput`; the enhancement must flow through it
  without changing its circular sizing defaults.
- Runtime coverage for `ImageInput` is missing. The existing
  `test/form/image-input.test-d.ts` checks only a small part of the form type
  surface.
- The responsive `NTable` action, adaptive skeleton, and card-pagination work
  is already implemented, documented, tested, and released in `2.1.48`. Do not
  rebuild it in this plan; retain its tests as regression coverage.

## Public contract

### Proposed additive types

Implement an additive, backward-compatible contract in
`packages/najm-kit/src/components/inputs/types.ts`:

```ts
export type ImageInputPreviewSource = "value" | "fallback" | "default";

export interface ImageInputPreviewError {
  source: ImageInputPreviewSource;
  src: string;
}

export interface ImageInputProps extends BaseProps {
  value: File | string | null;
  onChange: (file: File | null) => void;

  previewAlt?: string;
  fallbackImage?: string | null;
  fallbackAlt?: string;
  unavailableContent?: React.ReactNode;
  imageClassName?: string;
  onPreviewError?: (error: ImageInputPreviewError) => void;

  replaceAriaLabel?: string;
  clearAriaLabel?: string;
}
```

The coder may refine names before implementation, but the final API must cover
the same capabilities and remain additive. Export every new public type through
`src/components/inputs/index.ts` and `src/index.ts`.

### Required semantics

1. A non-empty string `value` is the primary preview source.
2. A selected `File` produces an immediate local preview and remains the
   controlled value passed to `onChange`.
3. **Source precedence is asymmetric based on whether `value` is set.**
   - When `value` is a non-empty string, candidates are tried in order:
     `value → fallbackImage → defaultImage`. `fallbackImage` is the
     explicit fallback for a controlled value.
   - When `value` is `null` or empty, only `defaultImage` is tracked.
     `fallbackImage` is not used in the empty state — `null` is the
     consumer's empty-state signal, and only the configured default
     participates in the failed-default → unavailable transition.
4. When every candidate fails, unmount/hide the failed image immediately
   and render `unavailableContent`; otherwise render a small neutral
   default state.
5. Source candidates must be deduplicated so the same failing URL is
   never retried in a loop.
6. Changing `value`, `fallbackImage`, `defaultImage`, or `imageVersion`
   resets failure state for the new source set. The reset uses the
   React-recommended derived-state pattern (tracked-key state plus
   during-render `setState`), not a `useEffect` that calls `setFailedSources`.
7. `onPreviewError` fires once for each failed candidate and reports
   whether it was the value, fallback, or default source.
8. Alternative text, clear labels, and replace labels come from consumer
   props. Existing English defaults may remain for backward compatibility,
   but no rendered image may be forced to generic `Preview`/`Default`
   text when the consumer supplies localized labels.
9. `imageClassName` controls `object-contain`, `object-cover`, or other
   image presentation without requiring descendant-selector hacks.

## Phase 1 — Source-resolution and URL helpers

- [x] Add a small pure helper near `ImageInput.tsx` or in a focused
  `imagePreview.ts` file to build and deduplicate preview candidates.
  - Done: `packages/najm-kit/src/components/inputs/imagePreview.ts` exports
    `buildPreviewCandidates`, `appendImageVersion`, `candidatesKey`, and
    the `ImageInputPreviewSource` / `ImageInputPreviewCandidate` types.
- [x] Add a pure `appendImageVersion(src, imageVersion)` helper that:
  - uses `?v=` only when no query exists;
  - uses `&v=` when a query already exists;
  - inserts the version before a `#fragment`;
  - leaves the URL unchanged when the version is `null`/`undefined`;
  - does not damage `data:` or `blob:` URLs.
  - Also leaves `javascript:` and `file:` URLs unchanged and
    `encodeURIComponent`s non-trivial version strings.
- [x] Keep relative application URLs, absolute URLs, data URLs, and blob URLs
  valid. Do not require a browser-global base URL merely to format a relative
  path.
- [x] Unit-test candidate ordering, deduplication, query handling, fragments,
  empty strings, and version changes.
  - Done: `packages/najm-kit/test/inputs/image-preview.test.ts` (26 tests
    covering `appendImageVersion`, `buildPreviewCandidates`, and
    `candidatesKey`).

Phase 1 gate:

- [x] URL/source helpers are deterministic and covered without rendering React.
- [x] No application endpoint or framework dependency enters Najm Kit.

## Phase 2 — Race-safe preview state

- [x] Refactor `ImageInput.tsx` to derive a stable source-set key and track
  failures against that key.
- [x] On image error, hide the failing element immediately, record the failed
  candidate, call `onPreviewError` once, and advance to the next candidate.
- [x] Render an intentional unavailable state after the final candidate fails.
- [x] Add a stable state marker such as
  `data-image-input-state="empty|preview|fallback|unavailable"` for styling,
  testing, and consumer diagnostics.
- [x] **Source precedence is asymmetric.** When `value` is a non-empty string,
  candidates are tried in order: `value → fallbackImage → defaultImage`. When
  `value` is `null` or empty, only `defaultImage` is tracked — `fallbackImage`
  is an explicit fallback for a controlled value, not an empty-state default.
  Plan and implementation must agree on this rule (the precedence list, the
  precedence test, and the README all describe the same contract).
- [x] **Default image must flow through the candidate pipeline even when
  `value` is null or empty.** Today the candidate list is empty in that
  case, `defaultImage` renders directly with no `onError` handler, and a
  failing default image leaves a broken `<img>` visible. The fix is to
  build candidates from `defaultImage` alone when `value` is not a string,
  so the existing error/unavailable transitions and the
  `onPreviewError({ source: "default" })` callback both apply.
- [x] **Failure state must reset through the React-recommended derived-state
  pattern, not via a `useEffect` that calls `setState`.** The current
  implementation must use a tracked-key state and reset `failedSources`
  during render when the candidate key changes (matching the pattern in
  the React docs for "resetting all state when a prop changes"). Effect-
  driven resets are explicitly disallowed because they contradict the
  "without a synchronous-effect state loop" requirement.
- [x] Make FileReader work race-safe: ignore/cancel stale reads when the value
  changes or the component unmounts.
- [x] If object URLs are introduced, revoke only URLs created by the component.
  Never revoke consumer-owned blob URLs.
- [x] Preserve controlled behavior: selecting calls `onChange(file)`, clearing
  calls `onChange(null)`, and external value changes remain authoritative.
- [x] Preserve `showPreview={false}`, `previewPosition`, `previewClassName`,
  `previewStyle`, `contentClassName`, `imageSize`, `accept`, and disabled state.

Phase 2 gate:

- [x] No failed source can leave a broken native image placeholder visible,
  including the `value={null}` + failing `defaultImage` case.
- [x] A stale FileReader completion cannot replace a newer controlled value.
- [x] Fallback transitions never call `onChange` or mutate application data.
- [x] A failing `defaultImage` fires `onPreviewError({ source: "default" })`
  exactly once.
- [x] No `useEffect` in `ImageInput.tsx` calls `setFailedSources` directly;
  failure-state resets happen via the derived-state pattern.
- [x] The `value`/`fallbackImage`/`defaultImage`/`imageVersion` props all
  use the same precedence contract described above, and the README, plan,
  and tests all agree.

## Phase 3 — Accessible controls and touch behavior

- [x] Replace clickable non-semantic upload `<div>` elements with real buttons
  or an equivalent keyboard-operable label/input relationship.
- [x] Ensure Enter and Space open the file picker exactly once.
- [x] Give replace and clear controls localized accessible names through the new
  props and preserve visible focus rings.
- [x] Keep controls visible by default on coarse-pointer/touch devices.
- [x] Allow hover-only visual reduction only under a verified
  `(hover: hover) and (pointer: fine)` media query; keyboard focus must always
  reveal the controls.
- [x] **Use a static CSS class compiled into `dist/theme.css`, not runtime
  arbitrary classes.** The current implementation builds
  `` `[@media (hover: hover) and (pointer: fine)]:opacity-0` `` at runtime
  via `cn(...)`, which the Tailwind v4 scanner cannot trace and which the
  built `dist/theme.css` does not contain. Add a static class such as
  `nimage-input-control` (clear and replace overlay) and a corresponding
  static `nimage-input-compact-overlay` (compact replace overlay) in
  `packages/najm-kit/src/theme.css`, following the existing
  `ntable-card-action` pattern near `theme.css:316`. The rule must:
  - default to `opacity: 1` so touch and coarse-pointer devices keep the
    controls visible;
  - inside `@media (hover: hover) and (pointer: fine)`, set `opacity: 0`
    and reveal on `.group/image:hover`, `.group/image:focus-within`,
    `.nimage-input-control:focus`, and `.nimage-input-control:focus-visible`;
  - ship in the assembled `dist/theme.css` produced by
    `scripts/build-css.mjs`.
- [x] Keep the clear action separate from the replace trigger so nested buttons,
  double file-picker activation, and event propagation bugs are impossible.
- [x] Preserve disabled semantics for picker, replace, and clear actions.
- [x] Use logical positioning (`end-*`) so clear controls work in RTL.
- [x] Keep a usable hit target and avoid covering the entire image with an
  invisible pointer target on touch layouts.

Phase 3 gate:

- [x] Mouse, keyboard, touch, disabled, and RTL behavior are explicitly tested.
- [x] The component has no hover-only required action.
- [x] `dist/theme.css` contains the `nimage-input-control` and
  `nimage-input-compact-overlay` rules (grep-verified), and the
  corresponding test reads from `dist/theme.css` or a freshly-assembled
  copy — not from the runtime class string.

## Phase 4 — Form and avatar integration

- [x] Ensure the new props flow through `FormInput type="image"` via
  `FormImageInputProps` without weakening the discriminated union.
- [x] Ensure `AvatarInputProps` inherits the resilient preview contract and
  `AvatarInput.tsx` forwards it without overwriting consumer values.
- [x] Preserve Avatar defaults for radius, size, fill, camera icon, title, and
  content density.
- [x] Verify form-controlled and standalone inputs behave identically when the
  source fails or falls back.
- [x] Add compile-time tests for every new prop on image and avatar form inputs.
  - Done: `packages/najm-kit/test/form/image-input.test-d.tsx` covers
    `FormInputProps` for both `type: "image"` and `type: "avatar"`,
    including the new resilient preview contract.

Phase 4 gate:

- [x] No breaking type change is introduced for existing ImageInput, AvatarInput,
  FormInput, or AvatarFormInput consumers.

## Phase 5 — Tests

`packages/najm-kit/test/image-input.test.tsx` exists alongside the existing
avatar/form tests. Result: 34 passing tests in `image-input.test.tsx`,
117 passing in `avatar-input.test.tsx`, 26 in `image-preview.test.ts`,
and the form-side type tests in `test/form/image-input.test-d.tsx`.

- [x] Existing string URL renders with consumer-provided alt text.
- [x] Existing URL failure advances to `fallbackImage`.
- [x] Primary and fallback failure render the unavailable state without a
  broken `<img>`.
- [x] **Precedence is asymmetric:** string `value` uses
  `value → fallbackImage → defaultImage`; null or empty `value` uses only
  `defaultImage`. The description in the plan, the README, and the test
  fixtures must all agree on this contract.
- [x] **Empty `value` + failing `defaultImage` renders the unavailable state
  without a broken `<img>` and `data-image-input-state="unavailable"`.**
- [x] **Failing `defaultImage` fires `onPreviewError({ source: "default" })`
  exactly once.**
- [x] **Exact precedence when `value` is null and both `fallbackImage` and
  `defaultImage` exist:** only `defaultImage` is rendered (the asymmetric
  contract — `fallbackImage` is NOT used in the empty state), and a load
  failure advances to the unavailable state. `fallbackImage` must not be
  in the rendered `<img>` src or in the `onPreviewError` log.
- [x] **Exact precedence when `value`, `fallbackImage`, and `defaultImage`
  all exist:** error order is `value → fallback → default` with the source
  reported correctly on each `onPreviewError`.
- [x] Duplicate primary/fallback URLs are attempted once.
- [x] A new prop source resets the previous failure state.
- [x] File selection produces an immediate preview and calls `onChange(file)`.
- [x] Stale FileReader results cannot replace a newer source.
- [x] Clear resets the native input and calls `onChange(null)` once.
- [x] `allowClear={false}` and `disabled` suppress forbidden interactions.
- [x] Replace/clear controls have correct accessible names and keyboard behavior.
- [x] Touch/coarse-pointer classes keep required controls visible; fine-pointer
  hover and focus classes remain discoverable.
- [x] **Static CSS class for the pointer gate is present in the assembled
  `dist/theme.css`.** Either read the file directly or run the same
  `scripts/build-css.mjs` pipeline and assert the
  `nimage-input-control` / `nimage-input-compact-overlay` rules and the
  `@media (hover: hover) and (pointer: fine)` block are present. The test
  must not rely on the runtime class string.
- [x] Relative, queried, fragmented, data, and blob URLs handle `imageVersion`
  correctly.
- [x] `showPreview={false}` still renders only the file input.
- [x] Dropzone, compact, top/bottom/left/right, custom size, contain/cover, and
  RTL presentations retain their contracts.
- [x] AvatarInput and FormInput inherit fallback, alt, unavailable, and error
  callback props.
- [x] All existing NTable tests remain green as release regressions.

## Phase 6 — Documentation and playground

- [x] Document the new props and source precedence in
  `packages/najm-kit/README.md`.
- [x] Update the Image Input examples in
  `playground/src/docs/pages/InputsPage.tsx` with:
  - a valid remote/application-relative preview;
  - a broken primary URL that visibly falls back;
  - a fully unavailable localized state;
  - contain versus cover image presentation;
  - touch-visible, keyboard-operable replace and clear controls.
- [x] Update the form example in `playground/src/docs/pages/FormPage.tsx` so it
  does not describe the controls as hover-only.
- [x] Add an unreleased/next-version entry to
  `packages/najm-kit/CHANGELOG.md` describing the additive contract and behavior.
- [x] Verify examples contain no Kafil names, URLs, translations, or branding
  concepts.

## Phase 7 — Package verification and release

> **Release contract.**
> `scripts/publish-package.ts` rebuilds and runs `npm publish --workspace`
> on every invocation. There is no persistent tarball that ties a publish
> to a prior dry-run; the previous "byte-for-byte" gate was therefore
> unsupported. The gate below is **exact-tarball attributable**: the
> publish is bound to a single tarball that was packed, hashed, and
> dry-run from the same commit, and the post-publish npm registry
> integrity is recorded as independent verification.
>
> The script now supports `--pack-only`, `--publish-tarball <path>`,
> `--tarball-dir <dir>`, and `--verify-published <version>`. Packing
> writes a sidecar `<tarball>.commit` file containing the commit SHA at
> packing time; publishing refuses to publish a tarball whose recorded
> commit does not match `HEAD`.

Run from `C:\Users\hdevlop\Desktop\najm`:

```bash
bun run --cwd packages/najm-kit test test/image-input.test.tsx
bun run test:ui
bun run lint:ui
bun run build:ui
bun run --cwd packages/najm-kit build:preview
```

Pre-release checklist (exact-tarball workflow):

- [x] Resolve the worktree: the unrelated deletions of
  `VALIDATION-ERROR-CONTRACT-PLAN.md` and `docs/api/public-api.snapshot.json`
  remain in the working tree but were intentionally excluded from the
  release commit per the release scope decision. `PLAN.md` is tracked.
- [x] Stage and commit the implementation, tests, README, playground,
  changelog, and `PLAN.md` in a single release commit.
  - Done at `eb7b5d2` ("feat(kit): resilient image preview contract
    and exact-tarball publish").
- [x] Bump the patch version in `packages/najm-kit/package.json` from
  `2.1.48` to `2.1.49`. Commit the bump as a **separate** commit.
  - Done at `82064f0` ("chore(release): publish najm-kit@2.1.49").
- [x] Run all gates again on the release commit. Do not change source
  files between the release commit and the pack step.
  - Re-run on `82064f0`: 718 UI tests pass, 34 image-input tests, 26
    image-preview tests, 25 publish-package tests, lint clean,
    `bun run build:ui` produces `dist/theme.css` containing the
    `nimage-input-control` and `nimage-input-compact-overlay` rules.
- [x] Pack the tarball from the release commit using
  `bun scripts/publish-package.ts najm-kit --pack-only
  --no-build --skip-whoami`.
  - Path: `dist-publish/najm-kit-2.1.49.tgz`.
  - SHA-256: `dee1fa84dc280ac5fa567e3178d9dccc3947cff0a3d705cebbd95fe0e21b926a`.
  - Packing commit: `82064f0d194e2c60c06676dc6fb3efd5bf6f7591` (matches
    the release commit SHA). Sidecar written.
- [x] Confirm `dist/index.d.ts` exports the new types and props.
  - `dist/index.d.ts` contains `ImageInputPreviewSource`,
    `ImageInputPreviewError`, `previewAlt`, `fallbackImage`,
    `fallbackAlt`, `unavailableContent`, `imageClassName`,
    `onPreviewError`, `replaceAriaLabel`, and `clearAriaLabel`.
- [x] Confirm the tarball contains `dist`, README, changelog, CSS, and
  declarations and contains no source-only or secret files.
  - 12 entries: `package.json`, `CHANGELOG.md`, `README.md`,
    `dist/index.mjs`, `dist/index.d.ts`, `dist/json.mjs`,
    `dist/json.d.ts`, `dist/adapters/next.mjs`, `dist/adapters/next.d.ts`,
    `dist/NTableJson-tXqgfZI1.d.ts`, `dist/theme.css`,
    `dist/theme.css.d.ts`.
- [x] Dry-run the exact tarball.
  - `bun scripts/publish-package.ts najm-kit --publish-tarball
    dist-publish/najm-kit-2.1.49.tgz --dry-run --skip-whoami`.
    Exit code 0; npm reported `+ najm-kit@2.1.49` with the same
    `shasum` and `integrity` as the post-publish registry record.
- [x] Publish the exact tarball.
  - `bun scripts/publish-package.ts najm-kit --publish-tarball
    dist-publish/najm-kit-2.1.49.tgz --skip-whoami`. Exit code 0;
    npm reported `+ najm-kit@2.1.49` to
    `https://registry.npmjs.org/` with tag `latest`. No source files
    changed between dry-run and publish.
- [x] After publish, fetch the registry integrity for the new version.
  - `dist.integrity: sha512-SAFtxSVZuZBEd40X2EUPIc7PjUGPgq3T7nDBQwRVoAEakvUb78ViHy8p23Re/pJedAMAyy7FXJX/PYjg5D1B7Q==`
  - `dist.shasum:   d52ef1be9bd18b08c086ca515598a729069820d2`
  - `dist.tarball:  https://registry.npmjs.org/najm-kit/-/najm-kit-2.1.49.tgz`
- [x] Install the published version into a scratch project
  (`bunx npm pack najm-kit@2.1.49`) and confirm the installed
  `dist/index.d.ts`, `dist/theme.css`, and runtime class behavior match
  the release commit. Record the `npm pack` SHA for cross-reference.
  - npm pack `shasum`: `d52ef1be9bd18b08c086ca515598a729069820d2`
    (matches registry).
  - npm pack SHA-256:
    `DEE1FA84DC280AC5FA567E3178D9DCCC3947CFF0A3D705CEBBD95FE0E21B926A`
    (matches locally packed tarball byte-for-byte).
- [x] Record the release version, release commit SHA, packing commit,
  exact tarball path, exact tarball SHA-256, dry-run output, registry
  integrity, `npm pack` SHA, test counts, migration notes, and any
  follow-up issues in this plan.
  - See "Release evidence (2026-08-04)" above.

Phase 7 gate:

- [x] The published package is **exact-tarball attributable**: the
  tarball packed at the release commit was the same tarball that was
  dry-run and published, the sidecar `.commit` matches the release
  commit, the post-publish registry integrity matches the packed
  tarball, and no source changes occurred between the release commit
  and the publish. The published artifact exposes the documented
  contract.

## Phase 8 — Kafil handoff

- [ ] Provide Kafil with the exact published version (`najm-kit@2.1.49`)
  and a minimal migration example using `previewAlt`, `fallbackImage`,
  `unavailableContent`, `imageClassName`, and localized action labels.
  - Status: unblocked. Phase 7 is complete; `najm-kit@2.1.49` is live on
    npm with the documented contract. Migration example belongs in the
    Kafil repository (separate gate, not a Najm Kit responsibility).
- [ ] Confirm Kafil can remove its local `BrandingAssetPreview` and the split
  display-only preview/upload-only `ImageInput` workaround.
  - Status: unblocked. Belongs in the Kafil repository (separate gate).
- [ ] Confirm the enhanced shared input accepts Kafil's application-relative raw
  asset routes plus data-URL local previews without Next-specific code.
  - Status: unblocked. The implementation accepts relative URLs, absolute
    URLs, data URLs, and blob URLs without any Next coupling
    (`packages/najm-kit/src/components/inputs/imagePreview.ts:20`). Kafil
    integration confirmation belongs in the Kafil repository.
- [ ] Keep storage persistence, MIME headers, authorization, cache policy, and
  branding fallback resolution in Kafil; they are not Najm Kit responsibilities.
  - Status: documented; no Najm Kit code was added for these concerns.
- [ ] Record Kafil's focused integration result separately from the Najm release
  gate.
  - Status: unblocked. Belongs in the Kafil repository (separate gate).

## Definition of done

- [x] ImageInput never leaves a broken native image placeholder after an
  error, including the `value={null}` + failing `defaultImage` case.
- [x] Source precedence is asymmetric: string `value` uses
  `value → fallbackImage → defaultImage`; null/empty `value` uses only
  `defaultImage`. The plan, README, and tests all describe this contract.
- [x] Remote value, File, fallback, default, and unavailable states are
  explicit and deterministic; `onPreviewError` reports `source: "default"`
  for failing default images.
- [x] Consumer-supplied localized alt/action/unavailable copy reaches the DOM.
- [x] Replace and clear actions work with mouse, keyboard, touch, and RTL;
  the visibility rule ships as compiled CSS in `dist/theme.css`, not as
  runtime arbitrary classes.
- [x] URL versioning is safe for relative, queried, fragmented, data, and
  blob sources.
- [x] ImageInput, AvatarInput, FormInput, and AvatarFormInput remain
  compatible.
- [x] Focused tests, full Najm Kit tests, lint/typechecks, package build,
  and playground build pass.
  - Verification (2026-08-04): 718 UI tests pass, 25 publish-package
    tests pass, `bun run --cwd packages/najm-kit lint` passes, `bun
    run build:ui` produces a `dist/theme.css` containing
    `nimage-input-control` and `nimage-input-compact-overlay` rules.
- [x] README, playground, changelog, and declarations match the published
  artifact.
- [x] The exact-tarball dry-run passes against the release commit.
  - Verified at release: dry-run output `+ najm-kit@2.1.49 (dry-run)`
    from `dist-publish/najm-kit-2.1.49.tgz` packed at release commit
    `82064f0`.
- [x] The published package is exact-tarball attributable: the tarball
  packed at the release commit was the same tarball that was dry-run and
  published, the sidecar `.commit` matches the release commit, and the
  post-publish registry integrity matches the packed tarball.
  - Verified: sidecar commit `82064f0` matches `HEAD` at publish time;
    `dist-publish/najm-kit-2.1.49.tgz` SHA-256
    `dee1fa84dc280ac5fa567e3178d9dccc3947cff0a3d705cebbd95fe0e21b926a`
    matches the `bunx npm pack najm-kit@2.1.49` SHA-256
    byte-for-byte; registry `dist.shasum` matches `d52ef1be9bd18b08c086ca515598a729069820d2`.
- [ ] Kafil handoff is recorded separately from the Najm release gate.
  - Status: unblocked. Belongs in the Kafil repository (separate gate).

Do not mark a phase complete without exact commands and results. Do not
add Kafil-specific behavior to Najm Kit, and do not publish code that was
not tested from the same release commit.
