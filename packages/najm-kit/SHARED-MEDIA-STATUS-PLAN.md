# Najm Kit Shared Media and Status Plan

Status: **MOVES 0-5 DONE — Move 6 authorized and in progress**

Last updated: 2026-08-10

Moves 0 through 5 are implemented and verified in this repository. The owner
authorized version preparation, publication, and the gated Kafil migration on
2026-08-10. Move 6 is now in progress; Move 7 still starts only after the
registry artifact is independently verified.

## Goal

Move the reusable behavior currently carried by Kafil's local
`ManagedAvatar`, `ProtectedImage`, and `StatusBadge` components into published
Najm Kit contracts, then migrate Kafil to those contracts and delete the three
wrappers.

The final boundary must remain generic:

- Najm Kit owns reusable avatar loading, image fallback, Next Image adaptation,
  status color resolution, status presentation defaults, and provider wiring.
- Kafil owns its protected endpoint policy, backend authorization, status
  vocabulary, translation keys, and catalog values.
- No Kafil route prefix, translation key, role, DTO, or feature name may appear
  in Najm Kit source or built output.

The intended end state in Kafil is direct use of:

```tsx
import { NAvatar, NBadge } from "najm-kit";
import { NNextImage } from "najm-kit/next";
```

with no renamed replacement under `apps/web/src/lib` or
`apps/web/src/shared`.

## Scope

Primary Najm work:

```text
packages/najm-kit/src/components/Avatar/Avatar.tsx
packages/najm-kit/src/components/Avatar/index.ts
packages/najm-kit/src/components/ui/NImage.tsx
packages/najm-kit/src/components/Badge/Badge.tsx
packages/najm-kit/src/components/Badge/index.ts
packages/najm-kit/src/providers/NajmUIProvider.tsx
packages/najm-kit/src/providers/index.ts
packages/najm-kit/src/adapters/next.tsx
packages/najm-kit/src/adapters/app.tsx
packages/najm-kit/src/index.ts
packages/najm-kit/test/navatar.test.tsx
packages/najm-kit/test/badge.test.tsx
packages/najm-kit/test/providers.test.tsx
packages/najm-kit/test/barrel.test.ts
packages/najm-kit/integration/next16-ui-bootstrap/
packages/najm-kit/README.md
```

Small focused files may be added for source fallback resolution, badge
defaults/context, and their tests. Keep the public surfaces aligned with
`package.json`, `tsup.config.ts`, and the built declarations.

Kafil adoption is a separate move after publication. Its primary files are:

```text
apps/web/src/shared/ManagedAvatar.tsx
apps/web/src/shared/ProtectedImage.tsx
apps/web/src/shared/StatusBadge.tsx
apps/web/src/providers/AppProviders.tsx
apps/web/src/features/StatusLabels/index.ts
apps/web/test/image-delivery.test.ts
apps/web/test/status-labels.test.ts
```

plus every current wrapper consumer found by repository-wide search.

## Out of scope

- Moving Kafil image controllers, storage, permissions, or route prefixes into
  Najm Kit.
- Teaching Najm Kit how Kafil authenticates protected asset requests.
- Treating `unoptimized` image rendering as an authorization boundary.
- Moving Kafil's en/fr/ar/es catalogs or domain status vocabulary into Najm
  Kit.
- Replacing `najm-i18n` or adding another translation provider.
- Changing person-image selection in `najm-kit/person-images`.
- Redesigning avatar, image, or badge visuals.
- Editing the unrelated dirty `najm-theme.md` or untracked `output/` content.
- Version preparation, npm publication, Kafil package upgrades, or Kafil code
  changes before their explicit moves and approval gates.

## Current verified baseline

Source inspection on 2026-08-09 confirms:

- `najm-kit` is currently `2.9.0`.
- `NAvatar` already owns initials, title/subtitle/meta layout, shapes, four
  sizes, placeholder-source filtering, and cache-version query parameters.
- `NAvatar.fallbackSrc` is used only when the primary source is absent; it is
  not retried after a primary load failure.
- `NAvatar` does not expose an image loading policy or a composed image event
  contract.
- `NImage` is intentionally a framework-neutral native `<img>`, accepts native
  image attributes, and swaps to one fallback after an error.
- `najm-kit/next` already isolates the optional Next dependency and is the
  correct public surface for a `next/image` adapter. The root barrel must stay
  installable without Next.
- `NBadge` already maps a broad status vocabulary to semantic colors, permits
  per-instance `statusMap` overrides, and humanizes a status when no explicit
  label is supplied.
- `NajmUIProvider` already owns generic table defaults and receives a
  structural translator; `NajmAppProvider` already binds that provider to the
  active `najm-i18n` language.
- Kafil currently renders `ManagedAvatar` 35 times across 31 feature files,
  `ProtectedImage` 14 times across 13 source files, and `StatusBadge` 43 times
  across 38 source files.
- Kafil's status formatter is also used for charts, delivery history, detail
  copy, and plain text. It remains application-owned even after the badge
  wrapper is deleted.
- Kafil's current protected-image source test is source-shape coverage. The
  package migration must replace it with behavior and integration evidence,
  not merely update expected import strings.

These facts are a source baseline, not implementation or release evidence.

## Public API decisions

### 1. `NAvatar` remains framework-neutral

Extend the existing `NAvatar`; do not add `NManagedAvatar` or a Kafil-shaped
alias.

Add a typed image-props escape hatch based on the underlying avatar image
primitive, excluding fields controlled by `NAvatar`:

```ts
export type NAvatarImageProps = Omit<
  React.ComponentProps<typeof AvatarImage>,
  "src" | "alt" | "className"
>;

export interface AvatarProps {
  // existing props remain source-compatible
  imageProps?: NAvatarImageProps;
}
```

Required behavior:

1. Normalize the primary source through the existing placeholder rules.
2. Apply `srcVersion ?? version` to both the primary and fallback sources,
   except `data:` and `blob:` URLs.
3. Try the primary source first, then `fallbackSrc`, then initials.
4. Do not retry a source already known to have failed.
5. Default the native avatar image to `loading="lazy"`; an explicit
   `imageProps.loading` override wins.
6. Compose consumer `onLoad` and `onError` handlers with internal state rather
   than replacing either side.
7. Keep initials present while no image has loaded and after every image has
   failed.
8. Remove initials after the active image loads, including when the image has
   transparent pixels.
9. Reset failure/load state when any source or version changes.
10. Preserve current title, subtitle, meta, shape, class-name, and fallback-text
    behavior.

`NAvatar` must continue to use browser-direct native image loading. Protected
same-origin routes therefore do not pass through the Next optimizer and do not
need knowledge of Kafil prefixes.

### 2. `NImage` keeps the framework-neutral contract

Do not replace `NImage` with `next/image` and do not add Next types to the root
barrel.

Strengthen its existing error-recovery contract without breaking current
callers:

```ts
export interface NImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string;
  fallback?: string;
}
```

Requirements:

- Preserve the consumer's `onError` callback while performing the internal
  fallback transition.
- Reset failed state when `src` or `fallback` changes.
- Never loop when the fallback also fails.
- Preserve native `loading`, `decoding`, `crossOrigin`, `referrerPolicy`, and
  accessibility attributes.
- Keep layout app-owned; do not invent a `fill` prop on the native component.

If shared source-selection mechanics are extracted, both `NImage` and
`NAvatar` must use the same pure helper rather than maintaining two subtly
different fallback algorithms.

### 3. Add `NNextImage` only to `najm-kit/next`

Add a Next-specific display component to `src/adapters/next.tsx` and export its
type from the same entry:

```ts
export interface NNextImageProps
  extends Omit<ImageProps, "src" | "onError"> {
  src: string;
  fallbackSrc?: string;
  onError?: ImageProps["onError"];
}

export function NNextImage(props: NNextImageProps): JSX.Element;
```

Contract:

- Render Next's `Image`, not a native `<img>`.
- Default to lazy loading while preserving an explicit consumer override.
- Switch once from `src` to `fallbackSrc` after failure and reset when inputs
  change.
- Compose the consumer's `onError` handler.
- Preserve every standard Next `ImageProps` layout option, including `fill`,
  `sizes`, width/height, `preload`, and `unoptimized`.
- Never infer authentication, route ownership, or protected prefixes.
- The application explicitly sets `unoptimized` for a protected asset that
  must be loaded directly by the browser.
- The root `najm-kit` entry must not import `next/image` directly or through a
  shared chunk reached by root-only consumers.

Kafil's direct migration form is therefore explicit:

```tsx
<NNextImage
  src={record.image}
  alt={record.name}
  fill
  sizes="64px"
  unoptimized
/>
```

The `unoptimized` flag changes delivery mechanics only. The backend still owns
session validation, permissions, privacy projection, MIME validation, cache
headers, and raw-byte delivery.

### 4. Make status badge defaults injectable

Do not add a second status badge component. `NBadge status="..."` is already
the public component.

Add a provider-level default contract, exported from the root barrel:

```ts
export interface NBadgeDefaults {
  look?: NBadgeLook;
  shape?: BadgeShape;
  size?: BadgeSize;
  showIcon?: boolean;
  statusMap?: Record<string, BadgeColor>;
  iconMap?: Record<string, BadgeIcon>;
  statusLabels?: Record<string, string>;
  statusLabelKeys?: Record<string, string>;
}
```

Add `badgeDefaults?: NBadgeDefaults` to `NajmUIProviderProps`. Because
`NajmNextUIProviderProps` and `NajmAppProviderProps` extend that contract, the
option must flow through both adapters without a second provider API.

Resolution rules for a badge with `status`:

1. An explicit component prop wins over every provider default.
2. Explicit `label` wins over string children.
3. String children win over the provider's status label.
4. A provider `statusLabels` value wins over a translated
   `statusLabelKeys` entry.
5. A mapped key is passed to the provider's existing `t` function.
6. An unmapped status falls back to `humanizeToken(status)`.
7. Per-instance `statusMap` and `iconMap` entries merge over provider maps; they
   do not replace unrelated defaults.
8. Provider status defaults apply only when `status` is present. Ordinary
   content badges retain their current defaults.
9. Status lookup uses one exported normalization rule so spaces, hyphens,
   underscores, case, and surrounding whitespace resolve consistently.
10. A live language change recomputes translated labels without remounting the
    application.

Kafil supplies only its application policy:

```tsx
<NajmAppProvider
  badgeDefaults={{
    look: "soft",
    shape: "pill",
    statusLabelKeys: KAFIL_STATUS_LABEL_KEYS,
  }}
  // existing props
>
```

The map values are Kafil catalog keys. Najm Kit must not ship those values.

## Implementation moves

### Move 0 - freeze source and migration evidence

Repositories: Najm and Kafil. No behavior changes.

Recorded in `SHARED-MEDIA-STATUS-FREEZE.md`.

- [x] Record the exact current public declarations for `NAvatar`, `NImage`,
      `NBadge`, `NajmUIProvider`, `NajmNextUIProvider`, and
      `NajmAppProvider`.
- [x] Inventory every Kafil wrapper consumer and classify each image as native
      avatar, Next layout image, public optimized image, or protected direct
      image.
- [x] Record which Kafil callers pass `fallbackSrc`, versions, custom image
      classes, `fill`, explicit dimensions, or badge overrides.
- [x] Confirm every `ProtectedImage` consumer receives either a managed route
      or a safe public fallback; do not infer `unoptimized` from a filename.
- [x] Record the current browser behavior for transparent avatar, primary
      failure, fallback failure, language change, and unknown status.
- [x] Preserve the unrelated Najm and Kafil dirty worktrees.

Gate:

- [x] The new package contract covers every real caller without an app-specific
      prop or an unrecorded behavior loss.

### Move 1 - implement shared source recovery

Repository: Najm.

Implemented as `src/lib/imageSource.ts` (pure) and `src/hooks/useImageChain.ts`
(the React state that goes with it), covered by `test/image-source.test.ts`.
Three components use them, not two: `NAvatar`, `NImage`, and `NNextImage`.

- [x] Add one pure, framework-neutral source/version/failure helper if it
      materially removes duplication between `NAvatar` and `NImage`.
- [x] Cover primary, fallback, absent source, placeholder source, `data:`,
      `blob:`, existing query strings, versions, duplicate sources, and all
      sources failed.
- [x] Ensure source changes discard stale failure state.
- [x] Keep the helper out of public exports unless consumers have a genuine
      direct use case demonstrated by a second component.

One deliberate behavior change inside the helper: `version={0}` now stamps
`?v=0`. The previous `!version` test treated it as absent, which silently
serves a stale image to a revision counter that starts at zero. No caller
passes a version today (see the freeze record), so nothing observable changes.

Gate:

- [x] Source selection is deterministic, loop-free, and independent of Next,
      storage, authentication, and Kafil.

### Move 2 - upgrade `NAvatar` and `NImage`

Repository: Najm.

- [x] Implement the public contracts above without removing or renaming an
      existing prop.
- [x] Add focused DOM tests that fire load/error events rather than asserting
      only source strings.
- [x] Prove initials are visible while loading, disappear after a transparent
      image loads, return for a failed source, and remain after fallback
      failure.
- [x] Prove the fallback image is tried after primary failure and receives the
      same version policy.
- [x] Prove consumer image events run exactly once alongside internal state.
- [x] Prove explicit eager loading overrides the lazy default.
- [x] Add an `NImage` suite for callback composition, source changes, fallback
      success/failure, and native attribute forwarding.
- [x] Preserve current class slots and theme behavior.

`NAvatar` now renders a native `<img>` instead of Radix's `AvatarImage`, and
owns the fallback's mounting itself. Radix preloads through
`new window.Image()` and mounts the element only once the bytes arrive, which
discards the element's own load and error events and makes `loading="lazy"`
inert — requirements 5 and 6 are unreachable through it. `NAvatarImageProps` is
therefore typed off `React.ImgHTMLAttributes<HTMLImageElement>` rather than off
the Radix primitive, whose `onLoadingStatusChange` would leak onto the DOM node.
The DOM slots, class strings, and `classNames` keys are unchanged.

While both are mounted the image is `absolute inset-0` over the initials, and
the avatar box carries `bg-muted`, so a transparent image shows the muted
surface rather than the page behind it — matching what `ManagedAvatar` already
shipped. No directional utility is involved, so RTL composition is unchanged.

Gate:

- [x] A standalone Najm Kit consumer can reproduce all current
      `ManagedAvatar` behavior with `NAvatar` and no application wrapper.

### Move 3 - implement the Next Image adapter

Repository: Najm.

- [x] Add `NNextImage` and `NNextImageProps` to `najm-kit/next` only.
- [x] Add focused tests for source changes, fallback transition, callback
      composition, lazy/eager loading, `fill`, `sizes`, dimensions, and
      `unoptimized` forwarding.
- [x] Extend the Next.js 16 production fixture to render optimized public and
      explicitly unoptimized direct images.
- [x] Assert the root barrel and root built chunk do not reach `next/image`.
- [x] Assert a project without Next can still install/import the root package.
- [x] Update `README.md` with native `NImage`, avatar, optimized Next image, and
      protected direct-image examples.

`priority` is the one prop the lazy default steps around: Next treats it as
contradicting an explicit `loading`, so defaulting over it would make the two
unusable together. Two facts the fixture recorded: `next/image` re-assigns
`img.src` from the element whenever an `onError` handler is present, which
absolutizes a relative source in the DOM; and `sizes` is emitted only alongside
a `srcSet`, so an `unoptimized` image carries `fill` but not `sizes`.

Gate:

- [x] `najm-kit/next` provides the whole reusable `ProtectedImage` behavior
      while route classification remains explicit and application-owned.

### Move 4 - implement provider-backed status defaults

Repository: Najm.

- [x] Add the badge defaults context close to `components/Badge`; do not create
      a global mutable registry.
- [x] Wire one context instance through `NajmUIProvider` and both adapters,
      preserving the package's shared-chunk/context requirement.
- [x] Implement the exact precedence and merge rules above.
- [x] Add tests for direct use without a provider, provider visual defaults,
      translated known statuses, humanized unknown statuses, local overrides,
      map merging, non-status badges, and live language changes.
- [x] Export only the types/helpers needed by consumers.
- [x] Document that status text is presentation and does not change backend
      state or lifecycle validation.

Public surface added: the `NBadgeDefaults` type and `normalizeStatusToken`.
`NBadgeDefaultsProvider` and `useNBadgeDefaults` stay internal — `NajmUIProvider`
mounts the context, so a consumer has nothing to do with them yet.
`test/dist-shape.test.ts` now asserts `NBadgeDefaultsContext` is created exactly
once and reachable from all three entries, which is the same hazard
`NajmPreferencesContext` guards: the provider is mounted from `najm-kit/next`
and read by `NBadge` from the root entry.

A provider-supplied `shape` also suppresses the design recipe's radius, as an
explicit prop already did — otherwise a theme radius would quietly un-pill an
application's status badges.

Gate:

- [x] Kafil can render every current status badge as
      `<NBadge status={status} />` while keeping its catalogs and status map in
      Kafil.

### Move 5 - package verification and release candidate

Repository: Najm.

- [x] Add or update barrel, declaration, adapter-boundary, and public API
      snapshot tests.
- [x] Add focused playground examples for primary/fallback avatar, transparent
      avatar, failed image, protected-style direct Next image, translated
      status, unknown status, and local override.
- [x] Verify keyboard/accessibility names, missing alt policy, RTL composition,
      light/dark themes, and no broken native-image icon in final failure UI.
- [x] Run the focused suites, package type checks, full package suite, package
      build, Next.js 16 fixture, and playground production build.
- [x] Inspect built JavaScript, declarations, shared chunks, and package exports.
- [x] Confirm no Kafil identifier, route prefix, or translation key exists in
      source or built output.
- [ ] Record the exact candidate commit and keep npm publication unperformed.

Evidence:

| Gate | Result |
|---|---|
| `bun run --cwd packages/najm-kit lint` | pass (source + tests) |
| `bun run test:ui` | 1034 pass, 9 skip, 0 fail; RSC suite 7 pass |
| `bun run build:ui` | pass |
| `bun run --cwd packages/najm-kit test:next16` | PASS, including the new media assertions |
| `bun run --cwd packages/najm-kit build:preview` | pass |
| `bun run api:check` | snapshot current (two additive lines) |

Built-output inspection: `NAvatarImageProps` and `NBadgeDefaults` are in
`dist/index.d.ts`; `NNextImage`/`NNextImageProps` are in
`dist/adapters/next.d.ts` and in neither the root declarations nor the root
runtime graph. `next/image` reaches exactly one chunk, referenced only by
`dist/adapters/next.mjs` and `dist/adapters/app.mjs`.

The Kafil-token sweep over `dist` returns one match: a doc comment in
`src/person-images/builtIn.ts` explaining why the public role is named `adult`
rather than `sponsor`. It predates this plan, it is rationale prose rather than
a route, key, role, or policy, and `person-images` is explicitly out of scope
here — flagged rather than changed.

The avatar's accessibility and layout properties were verified by source and by
server-rendered markup rather than in an interactive browser: `alt` falls back
to the label and stays empty when there is nothing to name, the failed-chain UI
unmounts the image so no broken glyph remains, the image uses `inset-0` with no
directional utility, and every color is a theme token. The Next production
fixture is the real-server evidence; a hands-on RTL and light/dark pass in a
browser was attempted on 2026-08-10, but no controllable browser was connected
to the session. It remains explicitly unperformed rather than inferred from
source evidence.

Gate:

- [ ] Source, DOM, browser, Next production, built-output, and package-boundary
      evidence pass at one clean candidate commit.

### Move 6 - prepare and publish Najm Kit

Repository: Najm. Requires explicit owner approval.

- [ ] Choose the semver after reviewing the final public and behavioral delta;
      the expected additive target is `2.10.0`, not an assumed patch.
- [ ] Prepare the version through the repository's version-only workflow and
      review the resulting manifest/changelog diff.
- [ ] Commit the audited candidate before packing.
- [ ] Run the exact single-package dry-run/tarball path and inspect the packed
      exports, declarations, chunks, CSS, README, and dependency metadata.
- [ ] Publish only after separate explicit authorization.
- [ ] Verify npm version, dist-tag, tarball integrity, exports, and source
      commit.

Gate:

- [ ] The verified registry artifact, not a workspace link or local tarball,
      is available for Kafil adoption.

### Move 7 - migrate Kafil and delete the wrappers

Repository: Kafil. Starts only after Move 6.

- [ ] Pin the published Najm Kit version in root overrides and manifests and
      resolve exactly one version in `bun.lock`.
- [ ] Configure badge defaults once in `AppProviders.tsx`, passing Kafil's
      translated status-key map and current soft/pill defaults.
- [ ] Replace every `ManagedAvatar` use with `NAvatar`, preserving source,
      fallback, version, title/subtitle/meta, size, shape, and class slots.
- [ ] Replace every `ProtectedImage` use with `NNextImage`; mark protected
      managed-asset calls `unoptimized` explicitly and preserve layout props.
- [ ] Replace every `StatusBadge` use with `NBadge status={...}`, preserving
      local size/class/icon/color overrides.
- [ ] Keep the Kafil status formatter for non-badge text and chart labels.
- [ ] Delete:

  ```text
  apps/web/src/shared/ManagedAvatar.tsx
  apps/web/src/shared/ProtectedImage.tsx
  apps/web/src/shared/StatusBadge.tsx
  ```

- [ ] Do not add aliases, renamed wrappers, prefix maps, casts, or copied
      generic tests under another Kafil directory.
- [ ] Replace source-shape assertions with focused Kafil integration tests for
      provider configuration, protected direct delivery, app translation keys,
      and representative component wiring.
- [ ] Run all web and root gates, then browser-check sponsor, staff, child,
      family, category, product, order, contribution, and applicant surfaces.
- [ ] Verify transparent, missing, failing, fallback, cache-version, loading,
      Arabic RTL, mobile, desktop, and live language-change behavior.
- [ ] Confirm no database migration is generated.

Gate:

- [ ] Kafil contains no duplicate avatar/image/status wrapper and loses no
      delivery, fallback, translation, privacy, accessibility, or responsive
      behavior.

## Verification commands

Run Najm commands from:

```text
C:\Users\hdevlop\Desktop\najm
```

Focused package suites:

```bash
bun run --cwd packages/najm-kit test test/navatar.test.tsx
bun run --cwd packages/najm-kit test test/nimage.test.tsx
bun run --cwd packages/najm-kit test test/badge.test.tsx
bun run --cwd packages/najm-kit test test/providers.test.tsx
```

Najm Kit gates:

```bash
bun run --cwd packages/najm-kit lint
bun run test:ui
bun run build:ui
bun run --cwd packages/najm-kit test:next16
bun run --cwd packages/najm-kit build:preview
bun run api:check
```

Built-output inspection:

```bash
rg "NAvatarImageProps|NBadgeDefaults" packages/najm-kit/dist/index.d.ts
rg "NNextImage|NNextImageProps" packages/najm-kit/dist/adapters/next.d.ts
rg "next/image" packages/najm-kit/dist/index.mjs
rg -i "kafil|family-images|sponsor-images|status\.pending" packages/najm-kit/dist
```

The last two searches must return no forbidden root-import or Kafil-specific
matches. Shared chunks must also be inspected; checking only `index.mjs` is not
sufficient when `splitting: true` is enabled.

Release dry-run after version preparation and a clean committed candidate:

```bash
bun scripts/publish-package.ts najm-kit --dry-run
```

Run Kafil adoption commands from:

```text
C:\Users\hdevlop\Desktop\kafil
```

```bash
bun run --cwd apps/web lint
bun run --cwd apps/web typecheck
bun run --cwd apps/web test
bun run lint
bun run typecheck
bun run test
bun run build
bun run db:generate
```

Run the relevant Playwright acceptance workflows against an intended local
PostgreSQL fixture after the source gates. Record browser and database evidence
separately from package and build evidence.

## Acceptance criteria

- [x] `NAvatar` owns primary/fallback/initials behavior and transparent images
      never reveal fallback text after load.
- [x] `NAvatar` and `NImage` preserve consumer events and reset correctly when
      inputs change.
- [x] `NNextImage` is available only through `najm-kit/next` and preserves the
      full Next Image layout contract.
- [x] The root package remains usable without Next installed.
- [x] Protected-source classification remains explicit and app-owned.
- [x] `NBadge status` accepts provider defaults and translated label keys with
      deterministic local-override precedence.
- [x] Non-status badges behave exactly as before.
- [x] Najm Kit source, tests, examples, declarations, and built output contain
      no Kafil-specific route, translation, role, or feature policy, with the
      one pre-existing `person-images` doc comment noted in Move 5.
- [ ] Focused, package, browser, Next production, build, and public API gates
      pass at one recorded Najm commit.
- [ ] Publication is performed only after explicit authorization and registry
      verification succeeds.
- [ ] Kafil consumes the published package rather than workspace source.
- [ ] Kafil deletes all three wrappers without adding renamed equivalents.
- [ ] Kafil's protected images, fallbacks, translated statuses, responsive
      layouts, RTL behavior, authorization, and privacy projections remain
      correct.
- [ ] No unrelated Najm or Kafil dirty-worktree change is modified.

## Completion rule

This plan is complete only when the reusable package contract is published and
verified, Kafil consumes that registry artifact, all three Kafil wrappers are
deleted, and both repositories pass their recorded acceptance gates.

Passing Najm Kit unit tests alone does not complete the plan. Passing Kafil
source tests against a workspace checkout does not prove publication or
consumer readiness.
