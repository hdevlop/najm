# Najm Kit Shared Page States Plan

Status: **PLANNED — documentation only**

Last verified: 2026-08-10

Primary package: `packages/najm-kit`

First consumer: `C:\Users\hdevlop\Desktop\kafil`

Second consumer: `C:\Users\hdevlop\Desktop\school`

## How the assigned coder must use this plan

This document is an implementation runbook, not a list of suggestions. It is
written so a medium-skill coder can finish the work without inventing product
or architecture decisions.

Rules for the assigned coder:

1. Work through Moves 0-10 in order. Do not start a consumer migration before
   the package publication gate that precedes it.
2. At the start of each move, inspect the named files again. The verified
   baseline is a snapshot, while the repository can change after this plan is
   written.
3. Change only the files named for the active move. If another file appears
   necessary, record why before editing it and confirm it is part of this
   feature rather than unrelated cleanup.
4. Run the focused test for the active move before the larger gate. A full
   suite is not a substitute for a missing behavior test.
5. Mark a checkbox complete only after recording the command or visual proof.
   Code that looks correct is not evidence.
6. Stop on a failed gate. Diagnose and fix the failure, or record it as an
   unrelated reproducible blocker. Do not continue on the assumption that a
   later command will make it irrelevant.
7. Never discard, stage, rewrite, or include another person's dirty files.
   In particular, current unrelated `najm-theme` work is outside this plan.
8. Do not commit, version, publish, push, migrate another repository, or deploy
   unless the relevant move allows it. Publication and pushes require explicit
   user authorization.
9. When a requirement is unclear, choose the smallest additive solution that
   preserves the frozen contract. Do not redesign the API silently.
10. End every move with a short handoff using the evidence template near the
    end of this document.

### Execution order and hard stop gates

| Move | Repository | Required output | Do not continue when |
| --- | --- | --- | --- |
| 0 | Najm | Fresh baseline and attributed worktree | Contract conflicts with current source or dirty files are unattributed |
| 1 | Najm | Shared `inline`/`panel`/`page` frame | Legacy inline behavior or `fullScreen` changes |
| 2 | Najm | Provider-backed feedback defaults | No-provider fallback or language reactivity fails |
| 3 | Najm | Forbidden and not-found components | Routing or authorization leaks into Kit |
| 4 | Najm | Focused behavior/accessibility suite | Any required branch lacks a test |
| 5 | Najm | Docs, playground, and visual proof | Mobile, dark, or RTL remains unchecked |
| 6 | Najm | All source/package gates pass | Built declarations/exports differ from source |
| 7 | Najm/npm | One verified published tarball | User has not authorized publication or registry proof fails |
| 8 | Kafil | Wrapper removed and Kafil accepted | Package is local/unpublished or nested surfaces regress |
| 9 | School | Independent direct adoption | Kafil is not accepted or School dirty work is not isolated |
| 10 | All | Evidence ledger and rollback record | Any outcome is inferred rather than recorded |

### Scope discipline

The coder may make additive changes to Najm Kit feedback components, their
provider plumbing, public exports, tests, playground, README, and changelog.
The coder must not opportunistically refactor tables, cards, layout, theme,
auth, query handling, or consumer feature logic. If an existing table/card test
must change because it renders a feedback component, keep that change limited
to the new public behavior and explain it in the handoff.

## Outcome

Applications should render loading, empty, error, forbidden, and not-found
states directly from Najm Kit without recreating a shared `PageState.tsx` or
`PageLoadingState.tsx` component in every repository.

Najm Kit will own reusable state presentation, responsive state surfaces,
accessibility, default icons, and provider-driven translated defaults.
Applications will continue to own their translation catalog, route targets,
navigation components, authorization decisions, and the policy that decides
which error detail is safe to show.

The work is complete only after the new Kit contract is tested, documented,
published from one auditable tarball, adopted by Kafil, and independently
proved by School. Local source links or workspace overrides do not satisfy the
publication or second-consumer gates.

## Verified baseline

- At the original baseline, Najm was on `master` and
  `packages/najm-kit/package.json` was `najm-kit@2.10.0`. This is historical
  evidence, not a current-state guarantee. At this plan-enhancement pass the
  worktree also contains unrelated `najm-theme` changes; Move 0 must attribute
  and preserve them before any implementation starts.
- The current public feedback components are:
  - `packages/najm-kit/src/components/feedback/NLoadingState.tsx`;
  - `packages/najm-kit/src/components/feedback/NErrorState.tsx`;
  - `packages/najm-kit/src/components/feedback/NEmptyState.tsx`.
- All three are exported from `packages/najm-kit/src/index.ts`. There is no
  separate feedback barrel.
- `NLoadingState` owns the spinner, optional label, and `fullScreen` overlay.
  Its packaged fallback is English (`Loading...`).
- `NErrorState` owns the error icon and optional retry button. Its title and
  retry fallbacks are English (`Something went wrong`, `Try again`).
- `NEmptyState` already accepts either a Lucide component or a React element.
  Its packaged title fallback is English (`No data`).
- `NPageLayout` defaults to a real `<main>` and applies the configured page
  gutter and section gap. It is a page shell, not a safe universal wrapper for
  table bodies, cards, dialogs, or sheets.
- `NajmUIProvider` already receives a structural translator and derives table
  pagination labels from it. `NajmAppProvider` already reads the translator
  from `najm-i18n`, so applications should not need another translation bridge.
- Najm Kit currently has playground pages for loading, error, and empty states,
  but no focused feedback-state behavior suite and no first-class forbidden or
  not-found component.
- Kafil's `apps/web/src/shared/PageState.tsx` composes the three Kit states with
  Kafil translations, `NPageLayout`, icons, error coercion, and a Next
  `/dashboard` link. Its generic states are consumed across list, dashboard,
  dialog, sheet, route-error, forbidden, and not-found contexts.
- The Kafil wrapper duplicates `NEmptyState`'s Lucide-component conversion. It
  also places `NPageLayout` around states that are not always pages, which can
  add nested page gutters and nested `<main>` landmarks.
- Kafil's wrapper localizes its error title/message but does not pass
  `retryLabel`, so the Kit retry button can remain English in non-English UI.
- School currently has its own
  `apps/dashboard/src/shared/PageLoadingState.tsx` around `NLoadingState`, while
  other School features use the Kit state components directly. School's root
  and dashboard manifests also declare different old `najm-kit` ranges and its
  worktree contains unrelated active changes; adoption must preserve them.

Re-run this baseline before implementation. Do not treat these observations as
permission to alter Kafil or School before the package is published.

## Problem statement

Using the existing Kit components directly everywhere does not yet remove the
reason application wrappers exist:

1. The visual components have only inline spacing. Applications repeat their
   own minimum height, page centering, icon treatment, and spinner sizing.
2. Packaged defaults are English. Applications with reactive language changes
   must pass the same translated loading, empty, error, and retry labels at
   every call site.
3. There is no first-class forbidden or not-found state, so applications repeat
   icons and presentation.
4. `NPageLayout` is too semantic and too padded to be hidden inside every state
   wrapper. Its default `<main>` is especially unsafe inside another page,
   table, dialog, or sheet.
5. Error objects are not presentation values. A generic UI package cannot know
   whether an exception message is public, operational, localized, or
   sensitive.
6. Next routes need a reliable Client Component boundary when they consume
   provider-backed state defaults without turning the root Kit entry into a
   package-wide client module.

## Ownership boundary

### Najm Kit owns

- Loading, empty, error, forbidden, and not-found presentation.
- Inline, panel, page, and existing full-screen loading behavior.
- Token-backed spacing, icon treatment, typography, and responsive layout.
- Semantic roles, busy/live announcements, heading semantics, and focus-safe
  retry behavior.
- Default forbidden and not-found icons.
- Packaged English fallbacks for unconfigured consumers.
- Provider-level literal labels and translation-key mappings.
- Deterministic override resolution and reactive language changes.
- Root exports, `najm-kit/app` client-boundary exports, declarations, docs,
  playground examples, and tests.

### Each application owns

- The translation catalog and the exact keys mapped into Kit defaults.
- Product-specific empty-state titles, descriptions, and actions.
- Whether an error detail is safe to expose. Najm Kit must not accept an
  `unknown` error and automatically render `error.message`.
- Authorization and the decision to render or redirect for forbidden access.
- Route targets such as `/dashboard`, the router, and framework link elements.
- Logging, diagnostics, retry side effects, query invalidation, and recovery.
- Page metadata and status/redirect semantics.

### Explicit non-goals

- Do not put Kafil or School translation strings in Najm Kit.
- Do not import `next/link`, `next/navigation`, React Query, Najm Auth, or an
  application API client into the root Kit feedback components.
- Do not turn hidden UI into an authorization boundary.
- Do not make `NPageLayout` stop defaulting to `<main>`; existing consumers may
  rely on that public contract.
- Do not change existing inline-state DOM or styling unnecessarily.
- Do not remove `NLoadingState.fullScreen`; retain it as a compatible overlay
  mode.
- Do not combine this work with unrelated table, chart, theme, auth, or storage
  changes.

## Frozen public contract to implement

The implementation may refine type names during Move 1, but it must preserve
the behavior and ownership rules below. Any material API change must update
this plan before code is written against a different contract.

### 1. Shared surface contract

Add and export:

```ts
export type NFeedbackSurface = "inline" | "panel" | "page";
```

Add `surface?: NFeedbackSurface` to `NLoadingStateProps`,
`NErrorStateProps`, and `NEmptyStateProps`.

- `inline` is the default and preserves current behavior.
- `panel` provides a centered, minimum-height state suitable for a table body,
  card body, dialog, sheet, or dashboard section. It renders no page landmark
  and applies no page gutter.
- `page` provides page-level centering and configured page spacing, but must
  render through `NPageLayout as="div"` or an equivalent non-landmark root. It
  must never introduce another `<main>`.
- `NLoadingState fullScreen` retains its fixed viewport overlay and takes
  precedence over ordinary surface sizing.
- Explicit `className`, spinner props, icon, action, and label props continue to
  work on every surface.

The page surface should standardize the large icon/spinner treatment that
Kafil and School currently implement independently. Use only Najm semantic
tokens and static Tailwind classes discoverable by the consumer build.

### 2. Provider feedback defaults

Add public types equivalent to:

```ts
export interface NFeedbackLabels {
  loadingLabel: string;
  emptyTitle: string;
  errorTitle: string;
  /** Optional because the legacy generic error state has no body fallback. */
  errorMessage?: string;
  retryLabel: string;
  forbiddenTitle: string;
  forbiddenDescription: string;
  notFoundTitle: string;
  notFoundDescription: string;
}

export interface NFeedbackDefaults {
  labels?: Partial<NFeedbackLabels>;
  labelKeys?: Partial<Record<keyof NFeedbackLabels, string>>;
}
```

Add `feedbackDefaults?: NFeedbackDefaults` to `NajmUIProviderProps`. It must be
inherited by `NajmNextUIProviderProps` and `NajmAppProviderProps` without a
second adapter prop or translation source.

Resolution order, most specific first:

1. An explicit component prop.
2. A literal in `feedbackDefaults.labels`.
3. A translated `feedbackDefaults.labelKeys` value resolved through the
   provider's existing structural `t` function.
4. The current packaged English fallback, when that field has one. Generic
   error body copy has no packaged fallback so existing no-provider rendering
   remains unchanged.

Requirements:

- A language change recomputes translated state labels without remounting the
  application.
- A missing provider is supported and retains current English behavior.
- Najm Kit must not inspect a translator result to guess whether a key exists.
- Literal defaults intentionally beat key-derived values, matching the current
  badge-default policy.
- Memoization must depend only on `t` and the defaults object; document that
  consumer defaults should have stable identity.
- Keep the translator structural. The root UI provider must not add a direct
  dependency on `najm-i18n`.

Implement the context as a focused internal feedback-defaults provider/hook,
parallel to table and badge defaults. Do not make feedback components depend on
the table implementation.

### 3. First-class route states

Add and export:

```ts
export interface NForbiddenStateProps extends NEmptyStateProps {}
export function NForbiddenState(props: NForbiddenStateProps): JSX.Element;

export interface NNotFoundStateProps extends NEmptyStateProps {}
export function NNotFoundState(props: NNotFoundStateProps): JSX.Element;
```

Requirements:

- Both default to `surface="page"`.
- `NForbiddenState` supplies a token-backed default `ShieldOff` icon.
- `NNotFoundState` supplies a token-backed default `Compass` or equivalent
  not-found icon selected during visual acceptance.
- Provider defaults supply their title and description when explicit props are
  absent.
- Consumers may override the icon, title, description, action, surface, and
  class name.
- Neither component knows the dashboard URL, renders a framework-specific
  link, checks roles, redirects, or writes metadata.
- They are presentation components, not HTTP 403/404 mechanisms.

### 4. Client-boundary exports

Keep the root `najm-kit` barrel free of a package-wide `"use client"`
directive. Also re-export the provider-aware feedback state components from
`najm-kit/app`, whose built entry is already restored as a Client Component
boundary.

This gives consumers two valid paths:

- Client feature code may import the state components from `najm-kit`.
- A Next Server Component route may import a state component from
  `najm-kit/app` and pass serializable props/React slots without creating a
  local wrapper solely to establish `"use client"`.

Add a built-output test proving `dist/adapters/app.mjs` retains
`"use client"`, exports the state components, and shares provider context with
the root entry. Do not create a new package subpath unless the existing app
adapter proves technically incapable of this contract.

### 5. Accessibility contract

- Loading uses `role="status"`, `aria-live="polite"`, and an accurate busy
  state without repeatedly announcing decorative spinner SVG content.
- Error uses an appropriate alert/live-region contract and exposes the retry
  action as a normal keyboard-operable Kit button.
- Empty, forbidden, and not-found states have a real heading when a title is
  present. Page states use page-appropriate heading semantics without changing
  the legacy inline heading unexpectedly.
- Decorative default icons are hidden from assistive technology; a consumer
  supplying a meaningful icon retains control of its accessible name.
- Page and panel states introduce no nested `<main>` and no unnamed landmark.
- State changes and retry actions preserve sensible focus behavior. Do not
  automatically steal focus on every query transition.
- Verify LTR and RTL layout; no directional margin or icon rule may assume LTR.

## Expected Najm Kit change map

Use this map to avoid broad repository exploration. Names marked **new** are
the preferred file names; if current source makes one name impossible, record
the replacement in the handoff and preserve the same responsibility boundary.

| File | Required responsibility |
| --- | --- |
| `packages/najm-kit/src/components/feedback/NFeedbackStateFrame.tsx` **new** | Internal surface/layout resolver shared by all five states; not a public component unless a real consumer need is proved |
| `packages/najm-kit/src/components/feedback/feedbackDefaults.tsx` **new** | English constants, public default types, one context/provider, and one resolving hook; no table imports |
| `packages/najm-kit/src/components/feedback/NLoadingState.tsx` | Add `surface`, provider label resolution, and loading semantics while retaining spinner/full-screen props |
| `packages/najm-kit/src/components/feedback/NErrorState.tsx` | Add `surface`, provider title/message/retry resolution, shared icon handling, and alert/retry semantics |
| `packages/najm-kit/src/components/feedback/NEmptyState.tsx` | Add `surface`, provider title resolution, shared icon/frame handling, and heading semantics |
| `packages/najm-kit/src/components/feedback/NForbiddenState.tsx` **new** | Thin preset over the shared empty/feedback machinery; default `ShieldOff`, provider copy, and page surface |
| `packages/najm-kit/src/components/feedback/NNotFoundState.tsx` **new** | Thin preset over the shared empty/feedback machinery; accepted default icon, provider copy, and page surface |
| `packages/najm-kit/src/providers/NajmUIProvider.tsx` | Accept `feedbackDefaults` and mount the feedback-defaults provider using the existing structural translator |
| `packages/najm-kit/src/providers/index.ts` | Export provider-facing public types only if the package's current barrel pattern requires it |
| `packages/najm-kit/src/index.ts` | Export all five components and all public feedback props/types |
| `packages/najm-kit/src/adapters/app.tsx` | Directly re-export provider-aware feedback components/types from their source modules; do not import the root barrel |
| `packages/najm-kit/test/feedback/states.test.tsx` **new** | Main DOM behavior, precedence, surface, accessibility, and reactive-provider suite |
| `packages/najm-kit/test/barrel.test.ts` | Runtime root-export assertions for the two new components |
| `packages/najm-kit/test/dist-shape.test.ts` | Built root/app exports, one shared feedback context, and retained app client directive |
| `packages/najm-kit/playground/src/docs/pages/*StatePage.tsx` | Surface/default/action examples and visual acceptance cases |
| `packages/najm-kit/playground/src/docs/navigation.ts` | Add forbidden/not-found navigation entries |
| `packages/najm-kit/playground/src/App.tsx` | Register forbidden/not-found pages |
| `packages/najm-kit/README.md` | Public API, ownership, provider, surface, and import examples |
| `packages/najm-kit/CHANGELOG.md` | Additive contract and compatibility note |

Normally unchanged:

- `packages/najm-kit/package.json` `exports`: `najm-kit/app` already exists.
- `packages/najm-kit/tsup.config.ts`: the existing app entry and shared chunking
  already provide the required boundary. Change this only if a failing built
  output test proves it necessary.
- `packages/najm-kit/src/components/layout/NPageLayout.tsx`: use
  `as="div"`; do not alter its default `<main>` contract.
- `packages/najm-kit/src/adapters/next.tsx`: its props inherit from
  `NajmUIProviderProps`, so no duplicated feedback prop should be added.
- `packages/najm-kit/src/theme.css`: change only if new non-static class names
  need explicit Tailwind v4 source coverage.

## Implementation blueprint

This section fixes the internal direction. It is pseudocode, so use the
repository's formatting and types, but do not replace it with a different
architecture without updating the plan first.

### A. Defaults context and resolution

Keep one packaged English object and one context. Do not destructure English
fallbacks in component function parameters, because doing so would make it
impossible to tell whether the caller explicitly supplied a value or omitted
it for provider resolution.

```tsx
export const ENGLISH_FEEDBACK_LABELS: NFeedbackLabels = {
  loadingLabel: "Loading...",
  emptyTitle: "No data",
  errorTitle: "Something went wrong",
  retryLabel: "Try again",
  forbiddenTitle: "Access denied",
  forbiddenDescription: "You do not have permission to view this page.",
  notFoundTitle: "Page not found",
  notFoundDescription: "The requested page could not be found.",
};

// Conceptual order for every key:
explicitProp
  ?? feedbackDefaults.labels?.[name]
  ?? translatedFeedbackLabels?.[name]
  ?? ENGLISH_FEEDBACK_LABELS[name];
```

Provider rules:

- Compute translated key values once with `useMemo` from `t` and
  `feedbackDefaults`; do not call every key on every state render.
- Mount exactly one `NFeedbackDefaultsProvider` in `NajmUICore`, beside the
  existing table and badge defaults providers.
- The context must contain the final resolved labels or enough stable data for
  the hook to resolve them deterministically. Do not create different context
  instances for root and app entries.
- If no `feedbackDefaults` or translator exists, the hook must still return the
  packaged English object.
- Do not treat `t(key) === key` as a missing translation heuristic. Complete
  catalogs and missing-key behavior belong to the application/i18n layer.
- `labels` values override `labelKeys` values per field, not as an all-or-none
  object.

### B. Shared surface frame

Build one internal frame/helper used by the five public states. Its minimum
contract is:

```tsx
interface NFeedbackStateFrameProps
  extends React.HTMLAttributes<HTMLDivElement> {
  surface?: NFeedbackSurface;
  children: React.ReactNode;
}
```

Required behavior:

| Surface/mode | Root and spacing behavior |
| --- | --- |
| `inline` | Preserve each existing component's current effective padding and sizing; no landmark |
| `panel` | Center within a bounded nested surface with a documented minimum height; no page gutter and no landmark |
| `page` | Use `NPageLayout as="div"` or equivalent design-token spacing; center responsively and never render `<main>` |
| loading `fullScreen` | Fixed viewport overlay wins over `surface`; do not combine page/panel minimum-height rules |

The frame may accept an internal spacing variant so that legacy loading/error
`py-8` and empty `py-12` remain compatible. Do not force identical legacy DOM
or spacing merely to make the helper smaller.

### C. Component API matrix

| Component | Existing props to preserve | New/default behavior |
| --- | --- | --- |
| `NLoadingState` | `label`, `className`, `fullScreen`, `spinnerVariant`, `spinnerSize` | `surface="inline"`; omitted label resolves through provider; explicit empty string still hides text |
| `NErrorState` | `title`, `message`, `onRetry`, `retryLabel`, `className`, `icon` | `surface="inline"`; omitted title/retry resolve through provider; omitted message resolves only from a configured provider value and otherwise remains absent |
| `NEmptyState` | `title`, `description`, `icon`, `action`, `className` | `surface="inline"`; omitted title resolves through provider; optional description remains absent unless explicitly supplied |
| `NForbiddenState` | Empty-state presentation overrides | Defaults to provider forbidden copy, `ShieldOff`, and `surface="page"` |
| `NNotFoundState` | Empty-state presentation overrides | Defaults to provider not-found copy, accepted icon, and `surface="page"` |

Important compatibility detail: the generic `NErrorState.message` and
`NEmptyState.description` currently remain absent when omitted. A configured
provider `errorMessage` may fill an omitted error message, but the no-provider
path must still render no generic body. There is no generic `emptyDescription`
default. Forbidden/not-found descriptions resolve from their dedicated fields.

Use one icon normalization helper for `ReactNode | LucideIcon`. A default icon
is decorative and receives `aria-hidden`; do not clone a consumer-provided
element in a way that deletes its `aria-label`, title, class name, or handlers.

### D. Provider wiring

The intended nesting inside `NajmUICore` is conceptually:

```tsx
<NajmDesignProvider ...>
  <NFeedbackDefaultsProvider defaults={feedbackDefaults} t={t}>
    <NTableDefaultsProvider value={tableDefaultsResolved}>
      <NBadgeDefaultsProvider defaults={badgeDefaults} t={t}>
        {children}
      </NBadgeDefaultsProvider>
    </NTableDefaultsProvider>
  </NFeedbackDefaultsProvider>
</NajmDesignProvider>
```

Thread `feedbackDefaults` through `UICoreProps`, `NajmUICore`, and
`NajmUIProvider`. Let TypeScript inheritance carry it through
`NajmNextUIProviderProps` and `NajmAppProviderProps`. Do not add a second `t`,
`feedbackT`, or i18n provider.

### E. Export wiring

Root exports should follow the existing explicit feedback export style in
`src/index.ts`. The app adapter should re-export the components directly:

```ts
export { NLoadingState } from "../components/feedback/NLoadingState";
export type { NLoadingStateProps } from "../components/feedback/NLoadingState";
// Repeat for error, empty, forbidden, not-found, and shared public types.
```

Do not write `export * from "../index"` in `src/adapters/app.tsx`; that would
pull the entire root barrel across the client boundary and weaken package
separation. Do not add another context/provider implementation in the adapter.

### F. Test-building sequence

Implement and run tests in this order so failures stay local:

1. Add inline compatibility and surface tests against the frame/components.
2. Add no-provider and resolution-precedence tests.
3. Add a provider rerender test where translator output changes from English
   to Arabic/French and visible content updates without remounting the state.
4. Add forbidden/not-found preset and override tests.
5. Add accessibility queries and retry interaction via Testing Library user
   events.
6. Extend root barrel tests.
7. Build the package, then run dist-shape assertions against emitted files and
   the complete reachable chunk graph.
8. Build the playground/Next fixture only after unit and type gates pass.

Run DOM tests through the package command so `packages/najm-kit/bunfig.toml`
preloads Happy DOM. A root `bun test <file>` invocation can fail with
`document is not defined` and is not the configured verification path.

### G. Visual acceptance cases

The playground must expose a small matrix, not only attractive standalone
examples:

- inline loading/error/empty inside a narrow card;
- panel loading/error/empty inside a bordered region representing a dialog or
  table body;
- page loading/forbidden/not-found inside the playground route viewport;
- retryable error with long translated text;
- icon override as a Lucide component and as a React element;
- light and dark themes;
- 320 px, 375 px, 430 px, tablet, and desktop widths;
- English LTR and Arabic RTL;
- keyboard focus reaching and activating Retry without focus theft.

Record at least one screenshot for the narrow RTL case and one for the desktop
dark page case. Playground acceptance alone does not prove package output,
because the playground aliases the source package.

## Known traps and required response

| Trap | Required response |
| --- | --- |
| Defaulting props in the function signature | Remove destructured defaults and resolve after reading provider values |
| Copying layout class strings into five components | Move surface behavior into the internal shared frame/helper |
| Wrapping `page` with default `NPageLayout` | Pass `as="div"` and test that no nested `<main>` exists |
| Importing `next/*` or app routes | Remove it; accept a React action slot from the consumer |
| Rendering `unknown`/`Error.message` automatically | Remove it; accept safe presentation strings only |
| Adding another package export subpath | First prove why existing `najm-kit/app` cannot work and update this plan |
| Root and app imports read different contexts | Keep `splitting: true`, inspect reachable chunks, and assert one context owner |
| Dynamic Tailwind classes disappear in consumers | Prefer static classes; otherwise add explicit `theme.css` source coverage and verify `dist/theme.css` |
| Tests pass from source but declarations are missing | Build and inspect `dist/*.d.ts` plus exact tarball contents |
| Playground looks correct but npm consumer fails | Treat playground as visual proof only; use Next fixture and clean tarball install |
| A full suite fails in unrelated `najm-theme` work | Reproduce and record it separately; never edit/stage that work as part of this feature |
| Registry lookup returns stale/404 immediately | Verify versions, dist-tags, integrity, and clean install after propagation; do not republish the same version |

## Execution plan

### Repeatable work loop for Moves 1-5

For each move, use the same small loop:

1. Run `git status --short` and confirm every pre-existing path is still
   attributed.
2. Add or extend the focused test for the behavior being introduced.
3. Run the focused file and record the expected pre-implementation failure.
4. Implement only enough source to satisfy the active move's contract.
5. Re-run the focused file, then package lint/type checks.
6. Inspect `git diff -- <named paths>` and `git diff --check`.
7. Record files, tests, remaining checkboxes, and blockers before starting the
   next move.

Use this configured focused command from the repository root:

```bash
bun run --cwd packages/najm-kit test test/feedback/states.test.tsx
```

If the test file does not exist yet, create it during Move 1 and grow it during
Moves 2-4. Move 4 is the coverage-completion gate, not a reason to postpone all
testing until after implementation.

### Move 0 — Reconfirm the baseline and freeze the candidate scope

- [ ] Re-read root and `packages/najm-kit/AGENTS.md`.
- [ ] Record `git status --short`, current branch, `HEAD`, and the current
  `najm-kit` version.
- [ ] Reinspect the three feedback components, `NPageLayout`, provider stack,
  root/app exports, focused tests, playground, README, changelog, and publish
  script.
- [ ] Recount Kafil and School wrapper/direct consumers so migration evidence
  uses current numbers rather than this snapshot.
- [ ] Confirm the candidate touches only Najm Kit feedback/provider/docs/tests
  plus the later named consumer migrations.
- [ ] If the Najm worktree is dirty, attribute every file before editing and
  keep unrelated work outside the release candidate.

Record the baseline with these read-only commands:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
bun --version
bun -e "console.log(require('./packages/najm-kit/package.json').version)"
rg -n "NLoadingState|NErrorState|NEmptyState|NPageLayout|NajmUIProvider|NajmAppProvider" packages/najm-kit/src packages/najm-kit/test
```

Expected initial scope is the file map above. Do not stage the current
`najm-theme` changes or make their passing/failing status part of Najm Kit's
focused feature evidence.

Gate: the contract above is still compatible with the current source and no
unrelated package move is required.

### Move 1 — Implement feedback surfaces without breaking inline consumers

- [ ] Add the shared `NFeedbackSurface` type and one internal surface resolver
  or frame; avoid three divergent copies of the layout rules.
- [ ] Add `surface` to loading, error, and empty state props.
- [ ] Preserve current inline defaults, existing prop meanings, retry behavior,
  and `fullScreen` behavior.
- [ ] Implement `panel` without `NPageLayout`, page gutters, or landmarks.
- [ ] Implement `page` with configured Najm page spacing and a non-`main` root.
- [ ] Consolidate Lucide-component/element handling so empty, error, forbidden,
  and not-found states do not each reimplement it.
- [ ] Use static, token-backed classes. If any class is computed dynamically,
  add the exact safelist/source coverage required by `src/theme.css`.
- [ ] Verify explicit class overrides remain effective.

Gate: existing inline fixtures render compatibly, while panel/page states need
no application layout wrapper and never render `<main>`.

### Move 2 — Add provider-driven feedback labels

- [ ] Add the feedback labels/defaults types and focused context module.
- [ ] Thread `feedbackDefaults` through `NajmUIProvider`,
  `NajmNextUIProvider`, and `NajmAppProvider`.
- [ ] Resolve literal and key-derived defaults using the existing translator.
- [ ] Make every feedback component use explicit prop -> provider literal ->
  provider key -> English resolution.
- [ ] Keep the no-provider path stable.
- [ ] Ensure reactive language changes update visible state content.
- [ ] Export the public types from the appropriate root/provider barrels and
  declarations.

Gate: one provider configuration localizes every default feedback label without
an application translation bridge or per-call repetition.

### Move 3 — Add forbidden and not-found components

- [ ] Implement `NForbiddenState` and `NNotFoundState` over the shared feedback
  contract rather than copying `NEmptyState` markup.
- [ ] Supply default icons and page surface while preserving overrides.
- [ ] Export components and props from the root barrel.
- [ ] Re-export them, along with the generic state components needed by route
  files, from `najm-kit/app`.
- [ ] Keep all routing, actions, authorization, and product copy injected.

Gate: a consuming route can render a complete localized forbidden or not-found
view from Najm Kit with only its own navigation action supplied.

### Move 4 — Add focused behavioral and accessibility tests

Create a focused feedback test area, for example
`packages/najm-kit/test/feedback/states.test.tsx`, and cover:

- [ ] Inline backward compatibility for all existing defaults and props.
- [ ] Panel sizing with no page gutter and no landmark.
- [ ] Page spacing with a non-`main` root.
- [ ] Full-screen loading precedence.
- [ ] Explicit prop, literal default, translated key, and English fallback
  resolution order.
- [ ] Reactive translator/language changes.
- [ ] Retry rendering, localized retry label, click behavior, keyboard access,
  and no retry button when `onRetry` is absent.
- [ ] Loading busy/live semantics and error alert semantics.
- [ ] Heading and decorative-icon behavior.
- [ ] Lucide component and React element icon overrides.
- [ ] Forbidden/not-found defaults and overrides.
- [ ] No nested `<main>` for any surface.
- [ ] Provider use through both the root and `najm-kit/app` exports.
- [ ] Root barrel, app adapter, declaration, and built-dist shape.

Update existing table tests only where provider defaults affect the table's
internal `NEmptyState`/`NErrorState`. Do not silently change table copy or state
precedence as part of this move.

Gate: focused tests fail against 2.10.0, pass with the candidate contract, and
cover behavior rather than source-string presence alone.

### Move 5 — Document and visually accept the contract

- [ ] Add a README section explaining inline, panel, page, and full-screen
  behavior and the application/package ownership boundary.
- [ ] Document `feedbackDefaults` with both literal and translation-key
  examples.
- [ ] Document root versus `najm-kit/app` imports for Next Client/Server
  boundaries.
- [ ] Add examples for loading, empty, retryable error, forbidden, and
  not-found states with explicit application actions.
- [ ] Update the existing feedback playground pages and add forbidden/not-found
  navigation/examples.
- [ ] Verify light, dark, 320–430 px mobile, tablet, desktop, and RTL layouts.
- [ ] Verify inline usage inside a card/table and panel usage inside a dialog or
  sheet separately from full page usage.
- [ ] Record screenshots or equivalent evidence before accepting icon size,
  page height, spacing, and long translated copy.
- [ ] Add a changelog entry describing the additive API and the unchanged
  application-owned policies.

Gate: the documented API matches source/declarations and the visual evidence
confirms all three surfaces in LTR and RTL.

### Move 6 — Close Najm Kit source and package gates

Run from `C:\Users\hdevlop\Desktop\najm` and record exact output:

```bash
bun run --cwd packages/najm-kit test test/feedback/states.test.tsx
bun run lint:ui
bun run test:ui
bun run build:ui
bun run --cwd packages/najm-kit build:preview
bun run --cwd packages/najm-kit test:next16
bun run api:check
git diff --check
```

- [ ] Inspect `dist/index.d.ts`, `dist/index.mjs`,
  `dist/adapters/app.d.ts`, and `dist/adapters/app.mjs`.
- [ ] Prove the public exports and client directive exist in built output.
- [ ] Prove the built CSS path includes any new static state classes needed by
  consumers.
- [ ] Run the full sequential monorepo suite (`bun run test`) before the release
  commit unless an unrelated package failure is separately reproduced and
  documented.
- [ ] Inspect every modified/untracked file and scan the candidate for secrets
  and generated artifacts.

Gate: all focused, package, production-fixture, API, playground, and applicable
monorepo checks pass at one recorded source commit.

### Move 7 — Prepare and publish one auditable Najm Kit release

This additive public API is planned as `najm-kit@2.11.0`. Re-evaluate the exact
version immediately before release; never overwrite an existing registry
version.

- [ ] Commit the reviewed implementation before version preparation.
- [ ] From a clean worktree run:

  ```bash
  bun scripts/publish-package.ts najm-kit --minor
  ```

- [ ] Review the resulting version, update the changelog if it was not already
  finalized, and commit the release candidate.
- [ ] Re-run the complete Move 6 gate at that exact release commit.
- [ ] Pack one attributable tarball:

  ```bash
  bun scripts/publish-package.ts najm-kit --pack-only
  ```

- [ ] Record release commit, tarball path, filename, SHA-256, and sidecar commit.
- [ ] Inspect the tarball contents and extracted manifest/declarations. Confirm
  no source-only or workspace-only contract is required.
- [ ] Dry-run the exact tarball:

  ```bash
  bun scripts/publish-package.ts najm-kit --publish-tarball <tarball> --dry-run
  ```

- [ ] Publish only after explicit user authorization:

  ```bash
  bun scripts/publish-package.ts najm-kit --publish-tarball <tarball>
  bun scripts/publish-package.ts najm-kit --verify-published 2.11.0
  ```

- [ ] Confirm registry version, dist-tag, integrity, shasum, tarball URL, and
  declarations from a clean temporary install.
- [ ] Push the release commit only when explicitly authorized, then confirm the
  remote SHA separately from npm publication.

Gate: the exact tested tarball is published and a clean install exposes the
promised root and `najm-kit/app` contracts.

### Move 8 — Adopt the published contract in Kafil first

Do not use a local Najm link. Start only after Move 7 registry verification.

- [ ] Re-read Kafil `AGENTS.md`, the mandatory frontend skill, root `PLAN.md`,
  the installed `najm-kit` declarations, and current dirty-worktree ownership.
- [ ] Pin the published version exactly in Kafil's root override, root
  dependency, and `apps/web/package.json`; run `bun install` and prove one
  resolved version in `bun.lock`.
- [ ] Define one stable `KAFIL_FEEDBACK_DEFAULTS` configuration with keys for:
  - `state.loading`;
  - `state.empty`;
  - `state.error`;
  - `state.retry` as the safe fallback description;
  - `action.retry` as the retry-button label;
  - forbidden and not-found title/description keys.
- [ ] Pass that configuration once to `NajmAppProvider`.
- [ ] Replace generic `PageLoadingState`, `PageEmptyState`, and
  `PageErrorState` consumers with direct Kit components.
- [ ] Use `surface="panel"` in table, card, dialog, sheet, and nested dashboard
  contexts. Use `surface="page"` only for actual route/page states.
- [ ] Replace `PageForbiddenState` and `PageNotFoundState` with direct
  `NForbiddenState` and `NNotFoundState` usage. Keep Kafil's Next `Link`,
  `/dashboard` destination, localized action label, metadata, and role logic in
  Kafil.
- [ ] Delete `apps/web/src/shared/PageState.tsx` only after no import remains.
- [ ] Do not move unknown-error disclosure into Najm Kit. Replace the wrapper's
  blanket `Error.message` rendering with an explicit Kafil policy: public API
  messages may be shown; unexpected/configuration/internal errors use the
  localized safe fallback and remain available to diagnostics.
- [ ] Add focused tests for provider labels, language changes, direct state
  rendering, retry labels, route actions, and absence of nested `<main>`.
- [ ] Browser-check representative list, dashboard, dialog/sheet, global error,
  forbidden, and not-found states on mobile/desktop and Arabic RTL.
- [ ] Run Kafil's full implementation gate:

  ```bash
  bun run lint
  bun run typecheck
  bun run test
  bun run build
  bun run db:generate
  ```

- [ ] Confirm `db:generate` creates no migration. Any migration is unrelated
  schema drift and must be investigated before acceptance.

Gate: Kafil has no generic page-state component wrapper, uses the published
Kit package, preserves app-owned copy/routing/security, and passes source plus
browser acceptance.

### Move 9 — Prove the contract in School as the independent consumer

Begin only after Kafil acceptance. School currently has unrelated active work;
do not delete, revert, stage, or absorb it.

- [ ] Re-read School `AGENTS.md`, active upgrade plan, manifests, provider
  composition, translations, wrapper, direct state consumers, and installed
  declarations.
- [ ] Reconcile the root and dashboard `najm-kit` ranges and pin the same
  published version through School's intended override strategy; prove one
  resolved version in `bun.lock`.
- [ ] Mount or extend `NajmAppProvider` according to School's existing upgrade
  plan rather than adding another provider bridge.
- [ ] Add School feedback label keys to all supported locale catalogs and pass
  one stable defaults map to the provider.
- [ ] Replace `apps/dashboard/src/shared/PageLoadingState.tsx`, including
  `renderPageLoadingState`, with direct Kit loading states and the appropriate
  surface.
- [ ] Migrate a representative loading, empty, error, forbidden/not-found (if
  present), table/card, and nested profile-tab state. Do not force unrelated
  feature rewrites merely to increase migration count.
- [ ] Preserve feature-specific labels/actions and School's safe error policy.
- [ ] Verify the standardized page spinner/icon treatment replaces the local
  primary-color/56px workaround acceptably; use public override props only for
  a genuine product distinction.
- [ ] Run focused dashboard tests, `bun run lint`, `bun run build`, and School's
  relevant i18n check. Run broader tests required by School's active plan.
- [ ] Browser-check light/dark, mobile/desktop, and Arabic RTL states.
- [ ] Record unrelated pre-existing dirty files separately from this adoption.

Gate: a second repository removes its state wrapper using only the published
contract, proving the design is not Kafil-specific.

### Move 10 — Close documentation and rollback evidence

- [ ] Record Najm source/release commit, package version, tarball SHA-256,
  registry integrity, Kafil acceptance commit, and School acceptance commit.
- [ ] Update this plan's status and checkboxes only from recorded evidence.
- [ ] Keep Najm publication, Kafil adoption, School adoption, GitHub pushes,
  and deployments as separate pass/fail outcomes.
- [ ] If consumer acceptance reveals a generic gap, fix and publish Najm Kit
  first; do not restore per-project visual wrappers as the permanent solution.
- [ ] If rollback is required, revert consumers to their previous published
  version and wrapper commit. Never simulate rollback with a local workspace
  link or an unpublished package build.

## Mandatory handoff format

At the end of every move, append or report this block. Use `not run` instead of
leaving a field out, and never convert a partial result into `pass`.

```text
Move: <0-10 and title>
Outcome: PASS | PARTIAL | BLOCKED
Repository: <absolute path>
Branch: <name>
HEAD before: <sha>
HEAD after: <sha or unchanged>

Files changed:
- <path>: <why>

Focused evidence:
- <exact command>: PASS | FAIL | NOT RUN
- <visual case/screenshot path>: PASS | FAIL | NOT RUN

Broader evidence:
- <exact command>: PASS | FAIL | NOT RUN

Dirty files preserved:
- <path owned by other work>

Decisions or deviations:
- <none, or plan section changed and reason>

Remaining work:
- <next unchecked item>

Authorization still required:
- <publish, push, consumer edit, deployment, or none>
```

For release and consumer moves, also record:

```text
Package version: <version>
Release commit: <sha>
Tarball: <absolute path>
Tarball SHA-256: <hash>
Registry integrity: <value>
Registry shasum: <value>
Consumer resolved version: <version from lock/install evidence>
Consumer acceptance commit: <sha or not committed>
```

### Decision escalation rules

The coder may resolve ordinary implementation details locally. Stop and ask
for direction when any of these occurs:

- the frozen public prop names or resolution order must change;
- backward compatibility requires removing or changing an existing prop;
- a new dependency, package subpath, migration, or runtime service is needed;
- a consumer cannot adopt the contract without restoring a generic wrapper;
- tests imply that routing, authorization, or unsafe error parsing must move
  into Najm Kit;
- publication, pushing, deployment, or destructive cleanup is the next step
  and explicit authorization has not been given;
- unrelated dirty work overlaps a file this feature must edit and ownership
  cannot be separated safely.

## Required evidence matrix

| Boundary | Required proof |
| --- | --- |
| Inline compatibility | Existing defaults, props, and DOM behavior remain usable |
| Panel surface | Centered minimum-height state with no page gutter or landmark |
| Page surface | Responsive page spacing with no nested `<main>` |
| Localization | Provider keys update on language change; explicit overrides win |
| Accessibility | Busy/live/alert semantics, headings, decorative icons, keyboard retry |
| Next boundary | Root stays unmarked; `najm-kit/app` built output is a client boundary |
| Package artifact | Declarations/exports/CSS verified from the exact tarball |
| Kafil | Wrapper deleted, direct states accepted in routes and nested surfaces |
| School | Independent wrapper deletion and direct adoption from registry |
| Security | Auth remains backend-owned; unsafe exception detail is not exposed |

## Final definition of done

- [ ] Najm Kit owns the complete reusable feedback/page-state presentation.
- [ ] Existing inline consumers remain backward compatible.
- [ ] Provider-driven defaults remove repeated translation plumbing.
- [ ] Forbidden and not-found states are public, generic Kit components.
- [ ] No state surface introduces a nested `<main>`.
- [ ] Root and `najm-kit/app` import paths work in their documented boundaries.
- [ ] Focused tests, Kit gates, playground, Next 16 fixture, API check, and the
  applicable full monorepo suite pass at one release commit.
- [ ] One exact tarball is published and independently verified.
- [ ] Kafil deletes `apps/web/src/shared/PageState.tsx` after direct adoption.
- [ ] School deletes its redundant page-loading wrapper after direct adoption.
- [ ] Both consumers retain app-owned translations, actions, routing,
  authorization, and safe error policy.
- [ ] Publication, consumer commits, pushes, and deployments are each reported
  from evidence rather than inferred.
