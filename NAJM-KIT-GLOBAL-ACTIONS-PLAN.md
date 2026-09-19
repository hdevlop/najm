# Najm Kit Global Actions and Notifications Plan

Status: **IMPLEMENTED AND RELEASED - `najm-kit@2.16.3` introduced the shared
notification/global-action contract and `2.16.4` widened async command results
for React Query consumers. Kafil adoption is recorded below. Browser acceptance
was not rerun during the 2026-09-18 closeout by explicit request.**

Last verified: 2026-09-18

Closeout evidence: [`docs/evidence/global-actions/README.md`](docs/evidence/global-actions/README.md)

The execution checklists below remain the original runbook. The final definition
of done and closeout ledger are the authoritative record of what was verified.

Primary package: `packages/najm-kit`

First consumer: `C:\Users\hdevlop\Desktop\kafil`

Second consumer: `C:\Users\hdevlop\Desktop\school`

Future consumers: any Najm application that uses the same header actions and
notification-list workflow

## How the assigned coder must use this plan

This document is an implementation and release runbook. It freezes the public
boundary and the migration order so the assigned coder does not have to invent
architecture decisions while changing three repositories.

Rules:

1. Execute Moves 0-10 in order. Do not migrate a consumer before the package
   publication and registry-verification gate.
2. Re-read the current repository instructions and named files at the start of
   every move. This baseline is evidence from 2026-09-18, not permission to
   overwrite later work.
3. Preserve every unrelated dirty file. Never reset, restore, stage, commit, or
   reformat work that is outside the active move.
4. Keep the public names short and flat. Do not publish namespace/dot APIs such
   as `NNotifications.Root`.
5. React component exports use PascalCase (`NNotifyRoot`). Props, callbacks,
   helpers, and data fields use camelCase. Lowercase camelCase JSX is forbidden
   because React treats it as an intrinsic DOM tag.
6. Keep application APIs, React Query hooks, routing, notification topic
   policy, and persistence outside Najm Kit.
7. Add focused behavior tests before broad package gates. Source-string tests
   alone do not prove the shared interaction contract.
8. Record package source, tarball, registry, consumer, browser, Git, and
   deployment evidence separately. One passing boundary does not imply another.
9. Do not publish, push, deploy, or edit a later consumer unless the user has
   authorized that step.
10. Stop on a failed hard gate. Diagnose it or record an independently
    reproducible unrelated blocker before continuing.

### Execution order and hard gates

| Move | Repository | Required output | Hard stop |
| --- | --- | --- | --- |
| 0 | Najm, Kafil, School | Fresh baseline and dirty-file attribution | Current behavior or worktree ownership is unclear |
| 1 | Najm | Frozen normalized notification and compound-state contracts | API requires app services or framework routing |
| 2 | Najm | Flat `NNotify*` compound components and `NNotifyMenu` preset | Focus, pending, failure, or lazy-content behavior is unproved |
| 3 | Najm | Shared global-action controls | Language or notification persistence leaks into Kit |
| 4 | Najm | Focused unit, accessibility, and public-export tests | Any required state lacks behavioral coverage |
| 5 | Najm | README, playground, and visual acceptance | Mobile, dark, or RTL is unchecked |
| 6 | Najm | Complete source/package gates | Built output differs from the source contract |
| 7 | Najm/npm | One attributable published tarball | Publication is unauthorized or registry proof fails |
| 8 | Kafil | Published-package adoption and acceptance | Local links are used or existing semantics regress |
| 9 | School | Independent published-package adoption | Kafil is not accepted or School work overlaps unsafely |
| 10 | All | Evidence ledger, future-app recipe, rollback record | Any outcome is inferred rather than recorded |

## Outcome

Najm Kit will own one reusable visual and interaction system for page-header
actions and notification previews:

- notification bell and localized unread badge;
- controlled or uncontrolled popover state;
- notification header, mark-all action, list, item, and footer;
- loading, error, empty, and pending presentation;
- language menu presentation;
- theme toggle;
- fullscreen toggle;
- action-group spacing, responsive behavior, focus management, and accessible
  announcements.

Applications will provide normalized notification data and callbacks. Kafil,
School, and future applications will not rebuild the same buttons, badge,
popover, list states, and responsive styles.

The work is complete only when the API is implemented and tested in Najm Kit,
published from one verified tarball, adopted first by Kafil, and then proven by
School as an independent consumer. A local workspace link is not completion.

## Verified baseline

Re-run every item before implementation.

### Najm

- Repository: `C:\Users\hdevlop\Desktop\najm`.
- Baseline branch: `master`.
- Baseline HEAD: `0aa156554d56e37b5dc333cb8abd4c6d03bd54f8`.
- Local `packages/najm-kit/package.json` version: `2.16.2`.
- The Najm worktree was clean at the final baseline check.
- Najm Kit already exports `NButton`, `NIndicator`, Popover primitives,
  `NPageHeaderActions`, feedback states, `toast`, and `useNajmTheme`.
- There is no public `NNotify*`, notification-menu, language-menu,
  theme-toggle, fullscreen-toggle, or shared global-actions component.
- `NPageHeaderActions` owns page-header action layout but not the actions
  themselves.
- `najm-kit` does not currently depend on `screenfull`.

### Kafil

- Repository: `C:\Users\hdevlop\Desktop\kafil`.
- Baseline branch: `main`.
- Baseline HEAD: `49981f31f1d56e5ab673913a1c309963fc7bcf88`.
- `apps/web/src/shared/PageHeaderGlobalActions.tsx` composes:
  `NotificationsMenu`, a four-language dropdown, a theme button, and a
  fullscreen button.
- Its language command also synchronizes the external notification locale.
  That secondary persistence rule is Kafil-owned.
- `NotificationPopover.tsx` mounts the preview query only while the popover is
  open, refetches on entry, handles mark-all failure, and returns focus through
  the Radix trigger.
- `NotificationBell.tsx` hides the badge at zero, localizes 1-99, caps at
  `99+`, forwards its trigger ref, and announces unread-count changes.
- `NotificationCard.tsx` converts Kafil topics to safe localized copy and
  internal routes, awaits mark-read before navigation, and keeps the menu open
  when the command fails.
- The full `/notifications` page, push opt-in, query keys, service client,
  domain topic registry, and notification-locale reconciliation are separate
  product behavior and remain in Kafil.
- At baseline, active unrelated work upgrades Najm packages and moves entity
  query hooks to `najm-kit/query`. The manifests, lockfile, and notification
  hook files are dirty. Move 8 must preserve and reconcile that work rather
  than overwrite it.

### School

- Repository: `C:\Users\hdevlop\Desktop\school`.
- Baseline branch: `feat/trusted-proxy-rate-limit-hardening`.
- Baseline HEAD: `e3102fc14ea1f4dc0318dea3892ce1fa430fac56`.
- `apps/dashboard/src/shared/PageHeaderGlobalActions.tsx` independently
  composes the same notification, language, theme, and fullscreen actions.
- `apps/dashboard/src/features/Notifications/NotificationsMenu.tsx` contains
  another bell, badge, popover, mark-all action, list, item buttons, and
  view-all link.
- School notification rows already expose `title`, `body`, `href`, and
  `readAt`, so they map directly to the normalized Kit view model.
- School language changes first persist the authenticated user preference,
  then call the package language setter, refresh the user, and invalidate
  School query families. That transaction remains School-owned.
- At baseline, School manifests and lockfile contain an active Najm package
  upgrade. Move 9 must preserve and reconcile it.

## Problem statement

The current applications share the same user flow but duplicate its visual and
interaction implementation:

1. Both render the same four page-header actions.
2. Both use `screenfull`, the same Lucide icons, the same ghost icon buttons,
   and nearly identical token classes.
3. Both implement a bell with an unread badge and a Radix popover.
4. Both render a short notification list, mark-all action, per-item read/open
   behavior, and view-all destination.
5. Accessibility, error handling, count formatting, pending behavior, and
   responsive details can drift. Kafil currently has stronger behavior than
   School in several of these areas.
6. Copying the whole Kafil component into Kit would be wrong because it imports
   Kafil locale types, API functions, query hooks, topic mapping, and Next
   navigation.
7. Publishing only tiny primitives would leave each application rebuilding the
   same menu. The package needs both a compound API for exceptional layouts and
   one simple preset for the common workflow.

## Ownership boundary

### Najm Kit owns

- Notification menu structure and token-backed styling.
- Popover state, trigger ref wiring, Escape/outside close, and focus return.
- Bell icon, count badge, `99+` cap, formatter hook, and live announcement.
- Menu header, mark-all button, list scrolling, item presentation, read badge,
  timestamps, item actions, and footer presentation.
- Loading, error, retry, and empty presentation using existing Kit feedback
  components.
- Pending and disabled states for mark-read, mark-all, language, and theme
  commands.
- Shared language, theme, fullscreen, and action-group visuals.
- Short flat public exports, types, README documentation, playground examples,
  built declarations, and tests.

### Each application owns

- REST/MCP clients and endpoint paths.
- React Query keys, polling, cache lifetime, query enablement, invalidation,
  retries, and command hooks.
- Authentication and authorization.
- Domain notification records and conversion to `NNotifyItemData`.
- Topic registries, safe payload handling, titles, descriptions, icons,
  statuses, destinations, and privacy rules.
- Router and link integration.
- Whether opening an item marks it read before navigation.
- Translation catalogs and label values.
- Language persistence and secondary effects such as Kafil notification-locale
  synchronization or School user refresh/query invalidation.
- Error logging, diagnostics, toast policy, and safe disclosure.
- Full inbox pages, push subscriptions, settings, worker delivery, and backend
  notification generation.

### Explicit non-goals

- Do not add notification controllers, schemas, services, workers, delivery
  channels, or persistence to Najm Kit.
- Do not standardize Kafil and School backend notification payloads.
- Do not import `next/link`, `next/navigation`, application aliases, React
  Query, Najm Auth, or application API clients into these components.
- Do not move Kafil's topic-to-copy registry into the package.
- Do not make a notification button an authorization boundary.
- Do not add a global notification provider or second source of server state.
- Do not replace the full notification inbox pages.
- Do not put product translation strings into Najm Kit.
- Do not publish namespace objects or dot syntax such as
  `NNotifications.Root`.
- Do not force every application to render flags; language option icons are
  optional injected React nodes.
- Do not combine this release with unrelated query, provider, table, theme,
  auth, or backend work.

## Frozen public contract

Implementation may refine internal filenames, but the public names and
ownership below are frozen. A material change requires updating this plan
before consumer code is written against another API.

### 1. Normalized notification data

```ts
import type { ComponentType, ReactNode } from "react";

export interface NNotifyItemData {
  id: string;
  title: string;
  body?: string;
  href?: string;
  read: boolean;
  createdAt?: string | Date;
  icon?: ComponentType<{ className?: string }> | ReactNode;
  tone?: "default" | "success" | "warning" | "destructive";
}

export interface NNotifyLabels {
  open: string;
  unread: (count: number) => string;
  title: string;
  loading: string;
  emptyTitle: string;
  emptyDescription?: string;
  errorTitle: string;
  retry: string;
  markRead: string;
  markingRead?: string;
  markAllRead: string;
  markingAll?: string;
  view: string;
  viewAll: string;
  unreadState?: string;
  justNow?: string;
}
```

Rules:

- The Kit model is presentation-only. It contains no `topic`, raw payload,
  aggregate type, recipient identity, locale policy, or API response shape.
- Apps map their domain records before rendering.
- `href` is data only. Kit never imports or calls a router. The application
  receives the item through `onOpenItem` and decides how to navigate.
- Invalid dates fall back to `labels.justNow` or omit the timestamp.
- `icon` and `tone` are optional; neutral defaults must render consistently.

### 2. Flat compound notification exports

Add these named exports from `najm-kit`:

```ts
NNotifyRoot
NNotifyTrigger
NNotifyContent
NNotifyHeader
NNotifyList
NNotifyItem
NNotifyFooter
NNotifyMenu
```

Also export the corresponding props and public data/label types.

Do not expose a namespace object. The intended compound usage is:

```tsx
<NNotifyRoot open={open} onOpenChange={setOpen}>
  <NNotifyTrigger
    unreadCount={unreadCount}
    label={labels.open}
    unreadLabel={labels.unread}
  />
  <NNotifyContent>
    <ConnectedNotificationPreview />
  </NNotifyContent>
</NNotifyRoot>
```

`ConnectedNotificationPreview` may call application hooks because it is
mounted under `NNotifyContent`; Najm Kit itself must not call those hooks.

#### `NNotifyRoot`

- Supports controlled `open` plus `onOpenChange` and uncontrolled
  `defaultOpen`.
- Owns only menu state and close context.
- Exposes the close operation to compound children through private context.
- Must not fetch data or keep a copy of application notification state.

#### `NNotifyTrigger`

- Is a ref-forwarding accessible ghost icon button suitable for Radix
  `asChild` semantics.
- Accepts `unreadCount`, accessible labels, optional `formatCount`, and normal
  `NButton` overrides except conflicting children/type defaults.
- Hides its indicator at zero or below.
- Shows the localized count for 1-99 and `99+` above 99 by default.
- Announces count changes through a polite screen-reader-only live region.
- Uses semantic colors and the shared 18px bell treatment.

#### `NNotifyContent`

- Owns the standard end-aligned popover, responsive width, maximum viewport
  height, scrolling boundary, side offset, and close/focus behavior.
- Its application child must not render while the popover is closed. This
  preserves Kafil's lazy preview-query behavior.
- Allows documented `align`, `sideOffset`, and `className` overrides without
  exposing Radix internals as the primary API.

#### `NNotifyHeader`

- Renders the title and optional mark-all action.
- Awaits `onMarkAllRead`.
- Disables the action while pending and shows the pending label when supplied.
- Reports rejection through `onError`; it does not close the menu or emit
  hard-coded product copy.

#### `NNotifyList`

- Accepts `items`, `loading`, `error`, `onRetry`, labels, item callbacks, and
  optional per-item pending identity.
- Uses existing Kit loading/error/empty states.
- Renders a bounded scroll area and stable keyed items.
- Supports an optional `renderItem` escape hatch. The default uses
  `NNotifyItem` and must satisfy the common workflow without custom rendering.

#### `NNotifyItem`

- Displays icon, title, optional body, optional timestamp, read state, and
  simple actions.
- The default workflow has a view/open action and, when unread, a mark-read
  button.
- Awaits `onMarkRead` before reporting success or calling the optional
  post-read callback.
- A rejected read command keeps the menu open, keeps navigation from hiding
  the failure, restores the enabled state, and invokes `onError`.
- `onOpenItem` receives the normalized item. Kit does not automatically infer
  routing from `href`.
- Buttons remain keyboard-operable and do not nest interactive elements.

#### `NNotifyFooter`

- Renders the view-all action.
- Supports `onViewAll` and an `asChild` application link.
- Closes the menu only after the supplied action is accepted. The app decides
  navigation semantics.

### 3. Simple notification preset

`NNotifyMenu` composes the compound exports for the common list-with-read-button
workflow. Its core contract is equivalent to:

```ts
export interface NNotifyMenuProps {
  items: readonly NNotifyItemData[];
  unreadCount: number;
  labels: NNotifyLabels;
  loading?: boolean;
  error?: string | boolean;
  markAllPending?: boolean;
  markReadPendingId?: string | null;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onRetry?: () => void | Promise<void>;
  onMarkRead?: (id: string) => void | Promise<void>;
  onMarkAllRead?: () => void | Promise<void>;
  onOpenItem?: (item: NNotifyItemData) => void | Promise<void>;
  onViewAll?: () => void | Promise<void>;
  onError?: (error: unknown, action: "markRead" | "markAll" | "open" | "viewAll") => void;
}
```

The implementation may add ordinary styling/slot props, but it must not make
an application API client or router mandatory.

The preset is for apps whose preview data is already available. Apps that need
lazy hook mounting use the compound form with a connected child inside
`NNotifyContent`.

### 4. Flat global-action exports

Add:

```ts
NGlobalActions
NLanguageMenu
NThemeToggle
NFullscreenToggle
```

#### `NGlobalActions`

- Is a small flex container for header/navbar action controls.
- Accepts `children` and `className`.
- Uses the same shrink, alignment, and responsive gaps as the existing
  page-header action surface.
- Does not fetch, translate, authorize, or persist anything.
- Works inside `NPageHeaderActions`, an `actions` prop, or a navbar slot.

Example:

```tsx
<NGlobalActions>
  <NNotifyMenu {...notifications} />
  <NLanguageMenu {...language} />
  <NThemeToggle label={labels.theme} onError={showError} />
  <NFullscreenToggle label={labels.fullscreen} />
</NGlobalActions>
```

#### `NLanguageMenu`

```ts
export interface NLanguageOption<T extends string = string> {
  value: T;
  label: string;
  icon?: ReactNode;
  iconLabel?: string;
}

export interface NLanguageMenuProps<T extends string = string> {
  value: T;
  options: readonly NLanguageOption<T>[];
  label: string;
  pendingLabel?: string;
  pending?: boolean;
  onChange: (value: T) => void | Promise<void>;
  onError?: (error: unknown) => void;
}
```

- The component owns dropdown presentation, selection styling, pending state,
  and awaiting an asynchronous change.
- It must not call `useTranslation`, a language endpoint, or user API itself.
- Applications pass translated labels and their complete persistence command.
- Flags are optional injected nodes. Najm Kit does not depend on `flag-icons`.

#### `NThemeToggle`

- Reads `theme` and `setTheme` from the existing `useNajmTheme` contract.
- Renders Moon/Sun, awaits persistence, prevents duplicate commands, and
  accepts accessible/pending labels plus `onError`.
- Does not hard-code an English toast. The application may handle failure in
  `onError`; the control must always leave pending state in `finally`.

#### `NFullscreenToggle`

- Owns fullscreen capability detection and toggle behavior.
- Preserve the current default of hiding the control below `sm`.
- Add `screenfull@^6.0.2` as a direct Najm Kit dependency unless Move 0 proves
  the browser-standard API now satisfies the same supported-browser contract.
  Any change to this decision must be recorded before implementation.
- Disabled or unsupported environments must not throw during SSR, hydration,
  or click handling.
- Accept label, hidden-below, and error callback overrides.

### 5. Styling and compatibility rules

- Reuse `NButton`, `NIndicator`, Popover, existing feedback states, `cn`, and
  semantic tokens from Najm Kit.
- No arbitrary brand colors, app route strings, or product-specific copy.
- Keep the action icon size at 18px unless the public size prop overrides it.
- Preserve `text-foreground` icon visibility in light and dark themes.
- Popover width must remain safe at 320px:
  `min(24rem, calc(100vw - 2rem))` or an equivalent static class.
- Long titles/bodies and Arabic RTL must not overflow or reverse action meaning.
- Components that use state, browser APIs, context, or event handlers must keep
  a valid Client Component boundary in built output.
- Existing exports and primitives remain backward compatible.

## Planned source layout

Use feature-owned package folders instead of adding everything to layout:

```text
packages/najm-kit/src/components/Notify/
  types.ts
  NNotifyContext.tsx
  NNotifyRoot.tsx
  NNotifyTrigger.tsx
  NNotifyContent.tsx
  NNotifyHeader.tsx
  NNotifyList.tsx
  NNotifyItem.tsx
  NNotifyFooter.tsx
  NNotifyMenu.tsx
  index.ts

packages/najm-kit/src/components/GlobalActions/
  NGlobalActions.tsx
  NLanguageMenu.tsx
  NThemeToggle.tsx
  NFullscreenToggle.tsx
  index.ts
```

Tests should live under focused package test folders, for example:

```text
packages/najm-kit/test/notify/notify-compound.test.tsx
packages/najm-kit/test/notify/notify-menu.test.tsx
packages/najm-kit/test/global-actions/global-actions.test.tsx
packages/najm-kit/test/global-actions/global-actions-accessibility.test.tsx
```

Add playground documentation without creating a second implementation.

## Move 0 - Re-establish baseline and protect active work

- [ ] Read Najm `AGENTS.md`, current `package.json`, Kit scripts, public exports,
  tsup config, README, changelog, Popover, Indicator, Button, feedback, theme,
  provider, page-header, and playground implementations.
- [ ] Record Najm branch, HEAD, status, package version, Bun version, and exact
  resolved React/Radix dependencies.
- [ ] Search again for existing `Notify`, notification, language-menu,
  theme-toggle, fullscreen, or global-actions APIs.
- [ ] Inspect package CSS/build rules before selecting static classes.
- [ ] Record whether `screenfull` is already present transitively and whether
  adding it directly changes the package artifact materially.
- [ ] Read Kafil `AGENTS.md`, frontend skill, notification feature, global
  actions, i18n provider, installed Kit declarations, tests, and active plan.
- [ ] Read School `AGENTS.md`, notification feature, global actions, language
  hook/provider, installed declarations, tests, and active plan.
- [ ] Attribute all dirty files in all three repositories. In particular,
  preserve the current package/query upgrade edits in Kafil and School.
- [ ] Reconcile any package-version drift before selecting a release target.
- [ ] Update this baseline if source has changed materially.

Gate: the current implementations still fit the frozen ownership boundary and
no active work will be overwritten.

## Move 1 - Implement normalized types and compound state

- [ ] Add `Notify/types.ts` with the normalized item, labels, callback, and
  public prop contracts.
- [ ] Add a private notification-menu context containing only open state and a
  stable close function.
- [ ] Implement controlled and uncontrolled `NNotifyRoot` behavior.
- [ ] Ensure controlled mode never maintains a competing open state.
- [ ] Ensure context errors clearly when a compound child is rendered outside
  `NNotifyRoot`.
- [ ] Keep normalized items out of global/provider state.
- [ ] Add unit tests for default-open, controlled open, callback order, close,
  and invalid compound usage.

Gate: compound state works without importing routing, queries, services, or
application types.

## Move 2 - Implement notifications and the simple preset

- [ ] Implement the ref-forwarding `NNotifyTrigger` over `NButton` and
  `NIndicator`.
- [ ] Implement zero-hide, localized 1-99 formatting, `99+`, negative-count
  normalization, and polite count announcements.
- [ ] Implement `NNotifyContent` over the existing Popover primitives.
- [ ] Prove content children are unmounted when closed and focus returns to the
  trigger after Escape, outside interaction, item completion, and view-all.
- [ ] Implement `NNotifyHeader` with awaited mark-all behavior and rejection
  reporting that does not close the menu.
- [ ] Implement `NNotifyList` with existing loading/error/empty components,
  retry behavior, bounded scrolling, stable keys, and `renderItem` escape hatch.
- [ ] Implement `NNotifyItem` with read state, optional icon/body/time, view,
  and mark-read actions.
- [ ] Ensure a rejected mark-read does not call application navigation or close
  the menu.
- [ ] Implement `NNotifyFooter` with callback and `asChild` link support.
- [ ] Compose those parts into `NNotifyMenu` without duplicating markup.
- [ ] Export every component and type from the feature barrel and root barrel.

Gate: the common notification list requires only normalized data, labels, and
callbacks, while the compound API still supports lazy connected content.

## Move 3 - Implement shared global actions

- [ ] Implement `NGlobalActions` as the reusable action-group container.
- [ ] Implement generic `NLanguageMenu` with asynchronous change handling,
  selected state, optional icons, pending state, and `onError`.
- [ ] Implement `NThemeToggle` over `useNajmTheme`, with pending and rejection
  handling.
- [ ] Implement SSR-safe `NFullscreenToggle` and its mobile visibility rule.
- [ ] Add `screenfull` as a direct dependency if the frozen decision remains.
- [ ] Centralize the repeated foreground/icon classes inside the shared
  controls.
- [ ] Export all components and props from the root barrel.
- [ ] Verify these controls can render inside `NPageHeaderActions`, the legacy
  `actions` prop, and an `NNavbar` right slot without layout breakage.

Gate: an application can compose the complete action row without recreating
buttons, menus, icons, pending state, or responsive classes.

## Move 4 - Close behavioral and accessibility coverage

Tests must cover behavior, not source text alone.

- [ ] Root controlled/uncontrolled transitions and stable callback order.
- [ ] Trigger ref forwarding and Radix `asChild` compatibility.
- [ ] Zero, 1, 99, 100, negative, localized, and custom-formatted counts.
- [ ] Screen-reader label and live count announcement.
- [ ] Mouse, Enter, Space, Escape, outside click, focus return, and tab order.
- [ ] Closed content does not mount its connected child.
- [ ] Loading, error, retry, empty, populated, and long-list states.
- [ ] Mark-read and mark-all success, pending, repeated-click prevention, and
  rejection.
- [ ] Rejected commands leave the menu usable and open.
- [ ] View, view-all, `asChild`, and close behavior.
- [ ] Item without body, href, icon, timestamp, or mark-read callback.
- [ ] Language selected, pending, success, rejection, optional icon, and RTL.
- [ ] Theme light-to-dark, dark-to-light, pending, and rejection.
- [ ] Fullscreen supported, unsupported, rejected, SSR, and mobile-hidden cases.
- [ ] Global action spacing inside page header and navbar surfaces.
- [ ] No nested interactive elements and no duplicate accessible names.
- [ ] Flat root exports and built declaration shape; absence of namespace-only
  syntax.
- [ ] Existing PageHeader, Popover, Indicator, Button, provider, and feedback
  suites remain green.

Gate: every public branch and failure mode has a focused test.

## Move 5 - Document and visually accept the package contract

- [ ] Add a README section for the simple `NNotifyMenu` preset.
- [ ] Add a separate compound example using only flat named exports.
- [ ] Document why data, APIs, routing, queries, translation catalogs, and
  persistence stay application-owned.
- [ ] Document normalized mapping examples for topic-based and direct-title
  notification records.
- [ ] Document `NGlobalActions`, `NLanguageMenu`, `NThemeToggle`, and
  `NFullscreenToggle`.
- [ ] Add a playground page with interactive loading, error, empty, unread,
  read, pending, command-failure, and 99+ examples.
- [ ] Demonstrate both the preset and compound/lazy-content form.
- [ ] Verify light and dark themes.
- [ ] Verify 320px, 375px, tablet, and desktop widths.
- [ ] Verify English/French LTR and Arabic RTL, including long copy.
- [ ] Verify page header, compact page header, and navbar placement.
- [ ] Record screenshots or equivalent browser evidence.
- [ ] Add a changelog entry identifying the additive flat exports and new
  dependency, if any.

Gate: documented examples compile against the public API and visual evidence
shows no overflow, focus loss, unread ambiguity, or RTL regression.

## Move 6 - Run Najm Kit source and artifact gates

Run from `C:\Users\hdevlop\Desktop\najm` and record exact results. Focused DOM
tests must run through the package-local Bun configuration so its Happy DOM
preload is applied:

```bash
bun --cwd packages/najm-kit test test/notify
bun --cwd packages/najm-kit test test/global-actions
bun run lint:ui
bun run test:ui
bun run build:ui
bun run --cwd packages/najm-kit build:preview
bun run --cwd packages/najm-kit test:next16
bun run --cwd packages/najm-kit typecheck:acceptance
# Browser-only; run only when browser acceptance is authorized:
bun run --cwd packages/najm-kit test:acceptance
bun run api:check
git diff --check
```

- [ ] Inspect `dist/index.d.ts` and `dist/index.mjs` for every public export.
- [ ] Inspect built output for preserved client boundaries.
- [ ] Inspect `dist/theme.css` for all required static classes/tokens.
- [ ] Confirm the package manifest includes any new runtime dependency.
- [ ] Run the full sequential monorepo suite with `bun run test` before the
  release commit, unless a separately reproduced unrelated blocker is recorded.
- [ ] Scan modified files and the packed candidate for secrets, temporary
  output, screenshots in the wrong folder, and accidental generated files.

Gate: focused tests, Kit tests, build, preview, Next 16 fixture, acceptance,
API check, built-output inspection, and applicable monorepo tests pass at one
recorded commit.

## Move 7 - Prepare and publish one auditable Najm Kit release

The implemented additive feature release is `najm-kit@2.16.3`. A follow-up
consumer compatibility patch is `najm-kit@2.16.4`; it lets async commands
resolve their application-specific result while Kit continues to await them.
Re-check the registry immediately before versioning; never reuse or overwrite
an existing version.

- [ ] Commit the reviewed implementation before changing the version.
- [ ] Require a clean Najm worktree.
- [ ] Prepare the minor release:

  ```bash
  bun scripts/publish-package.ts najm-kit --patch
  ```

- [ ] Review and commit the version/changelog result.
- [ ] Re-run the complete Move 6 gate at the exact release commit.
- [ ] Create one attributable tarball:

  ```bash
  bun scripts/publish-package.ts najm-kit --pack-only
  ```

- [ ] Record tarball path, SHA-256, sidecar/source commit, contents, manifest,
  declarations, bundled output, CSS, and dependency list.
- [ ] Dry-run publication of that exact tarball:

  ```bash
  bun scripts/publish-package.ts najm-kit --publish-tarball <tarball> --dry-run
  ```

- [ ] Publish only after explicit authorization:

  ```bash
  bun scripts/publish-package.ts najm-kit --publish-tarball <tarball>
  bun scripts/publish-package.ts najm-kit --verify-published 2.16.4
  ```

- [ ] Wait until the registry artifact is fetchable, then verify version,
  dist-tag, integrity, shasum, tarball URL, exports, declarations, dependency
  metadata, and clean temporary installation.
- [ ] Push the release commit only with explicit authorization and verify the
  remote SHA separately.

Gate: the exact tested tarball is published and a clean external install
exposes the documented flat contract.

## Move 8 - Adopt the published package in Kafil first

Do not use a workspace link, `file:` dependency, source copy, or unpublished
tarball as final adoption evidence.

- [ ] Re-read Kafil instructions, frontend skill, active plans, global actions,
  Notifications feature, provider, tests, and installed declarations.
- [ ] Reconcile rather than overwrite the active `2.16.2`/`najm-next@0.8.0`
  upgrade and shared-query-hook edits.
- [ ] Pin the published version exactly in the root dependency, override,
  `apps/web/package.json`, and lockfile; prove one resolved copy.
- [ ] Map `NotificationRecord` plus `buildNotificationViewModel` into
  `NNotifyItemData`. Keep unknown-topic safety and internal route selection in
  Kafil.
- [ ] Replace local bell/popover/card presentation with the compound Kit API.
  Use a connected Kafil preview inside `NNotifyContent` so its list query stays
  lazy and refetches on each open.
- [ ] Keep unread-count polling in `useUnreadCount`.
- [ ] Keep query keys and invalidation in Kafil/shared query helpers.
- [ ] Await mark-read before navigation; on failure, preserve the open menu and
  rely on Kafil's command error presentation.
- [ ] Keep notification settings, push opt-in, full inbox, and locale
  reconciliation unchanged.
- [ ] Replace the language dropdown/theme/fullscreen markup in
  `PageHeaderGlobalActions.tsx` with `NGlobalActions`, `NLanguageMenu`,
  `NThemeToggle`, and `NFullscreenToggle`.
- [ ] Keep the Kafil language command that changes UI language and then
  synchronizes notification settings without blocking the UI on secondary
  sync failure.
- [ ] Delete `NotificationBell.tsx`, `NotificationPopover.tsx`, or
  `NotificationCard.tsx` only after their behavior is represented by Kit and
  no imports remain. A thin Kafil connected adapter is allowed and expected.
- [ ] Update focused tests from source-string ownership assertions to runtime
  mapping/interaction tests where practical.
- [ ] Verify every Kafil role still receives exactly one bell and inbox route.
- [ ] Browser-check mouse, keyboard, mark-read failure, mark-all failure,
  focus return, 99+, mobile width, dark mode, and Arabic RTL.
- [ ] Run Kafil's full implementation gate:

  ```bash
  bun run lint
  bun run typecheck
  bun run test
  bun run build
  bun run db:generate
  ```

- [ ] Confirm `db:generate` creates no migration. Investigate any output as
  unrelated schema drift before accepting the frontend migration.

Gate: Kafil consumes the registry package, preserves domain behavior, removes
duplicated presentation, and passes source plus browser acceptance.

## Move 9 - Prove the contract independently in School

Begin only after Kafil acceptance.

- [ ] Re-read School instructions, active branch/plan, global actions,
  notification hooks/services/types, language hook, provider, tests, and
  installed declarations.
- [ ] Attribute and preserve the existing Najm upgrade work and trusted-proxy
  branch changes.
- [ ] Pin the same published Kit version through School's exact-version and
  override strategy; prove one resolved copy in the lockfile.
- [ ] Map School notification records to `NNotifyItemData`. Do not copy Kafil's
  topic registry into School.
- [ ] Replace School's local bell, badge, popover, list buttons, and footer with
  `NNotifyMenu` or the compound form if query lifecycle requires it.
- [ ] Preserve School's current mark-read-before-navigation rule.
- [ ] Add rejection handling so a failed read or mark-all command does not
  produce an unhandled promise or falsely close the menu.
- [ ] Replace local global-action markup with the shared controls.
- [ ] Keep `useUpdateLang` app-owned: database update, package language change,
  auth refresh, School query invalidation, and success/error toast.
- [ ] Remove local presentation components only after no import remains.
- [ ] Run focused notification/global-action tests and School i18n parity.
- [ ] Run School's required dashboard lint, tests, and production build.
- [ ] Browser-check keyboard/focus, command failure, mobile, dark mode, and
  Arabic RTL independently from Kafil.
- [ ] Record pre-existing warnings and dirty files separately.

Gate: School adopts only the published generic contract, retains its product
policy, and proves the API is not Kafil-specific.

## Move 10 - Close evidence, future-app recipe, and rollback

- [ ] Record Najm implementation commit, release commit, package version,
  tarball path/SHA, registry integrity/shasum, and remote SHA if pushed.
- [ ] Record Kafil package resolution, acceptance commit, source gates, browser
  evidence, remote SHA, and deployment state separately.
- [ ] Record the equivalent School evidence independently.
- [ ] Update this plan's status and checkboxes only from recorded proof.
- [ ] Add a concise future-app recipe:

  1. map app records to `NNotifyItemData`;
  2. provide translated `NNotifyLabels`;
  3. connect app query/mutation/router callbacks;
  4. choose `NNotifyMenu` for eager data or flat compound components for lazy
     mounted data;
  5. compose it with `NLanguageMenu`, `NThemeToggle`, and
     `NFullscreenToggle` inside `NGlobalActions`;
  6. run responsive, keyboard, failure, and RTL acceptance.

- [ ] Document rollback as consumer version reversion to the previous
  published package and consumer commit. Never use a local source link as a
  rollback mechanism.
- [ ] If either consumer reveals a generic defect, fix and publish Kit first;
  do not permanently restore copied presentation.

## Required evidence matrix

| Boundary | Required proof |
| --- | --- |
| Public naming | Flat PascalCase components; no namespace/dot-only API |
| Package ownership | No app API, query, router, auth, or topic imports in Kit |
| Trigger | Ref forwarding, keyboard operation, count formatting, live region |
| Content | Lazy mount, responsive width, Escape/outside close, focus return |
| Commands | Awaited pending/success/failure; rejection never fakes completion |
| List states | Loading, error/retry, empty, read/unread, long list |
| Global actions | Language, theme, fullscreen, page-header/navbar placement |
| Localization | Injected labels and count formatter; LTR and RTL |
| Package artifact | Exact tarball exports, declarations, CSS, dependency metadata |
| Kafil | Topic mapping and locale sync remain app-owned; all roles keep one bell |
| School | Direct-title mapping and language transaction remain app-owned |
| Publication | Registry integrity and clean-install proof |
| Browser | Mobile/desktop, light/dark, keyboard/focus, failures, Arabic RTL |

## Mandatory move handoff

Use this format after every move. Write `NOT RUN` instead of omitting evidence.

```text
Move: <0-10 and title>
Outcome: PASS | PARTIAL | BLOCKED
Repository: <absolute path>
Branch: <name>
HEAD before: <sha>
HEAD after: <sha or unchanged>

Files changed:
- <path>: <reason>

Focused evidence:
- <exact command>: PASS | FAIL | NOT RUN
- <browser/visual case>: PASS | FAIL | NOT RUN

Broader evidence:
- <exact command>: PASS | FAIL | NOT RUN

Dirty files preserved:
- <path and owner/context>

Decisions or deviations:
- <none or updated plan section and reason>

Remaining work:
- <next unchecked item>

Authorization still required:
- <publication, push, consumer edit, deployment, or none>
```

For release and adoption moves, also record:

```text
Package version: <version>
Release commit: <sha>
Tarball: <absolute path>
Tarball SHA-256: <hash>
Registry integrity: <value>
Registry shasum: <value>
Consumer resolved version: <version>
Consumer acceptance commit: <sha or not committed>
```

## Decision escalation rules

Stop and request direction when:

- flat public names must change or namespace/dot syntax becomes required;
- backward compatibility requires removing/changing an existing Kit prop;
- notification data cannot be normalized without exposing private/domain data;
- routing, queries, auth, or persistence appears necessary inside Kit;
- adding `screenfull` is unacceptable and no equivalent supported-browser
  implementation is available;
- a consumer needs a second global server-state owner or provider;
- unrelated dirty work overlaps a required file and cannot be separated;
- an existing migration must be edited;
- publication, push, deployment, or destructive cleanup is the next step
  without explicit authorization.

## Final definition of done

- [x] Najm Kit exports the flat `NNotify*` compound API and `NNotifyMenu` preset.
- [x] Najm Kit exports `NGlobalActions`, `NLanguageMenu`, `NThemeToggle`, and
  `NFullscreenToggle`.
- [x] No public namespace/dot API is required.
- [x] The simple preset handles the normal list-with-read-button workflow.
- [x] The compound form supports lazy connected preview content.
- [x] App APIs, queries, routing, topics, catalogs, and persistence remain
  application-owned.
- [ ] Accessibility, pending, error, focus, responsive, dark, and RTL behavior
  is covered by focused tests and browser evidence. Focused tests and historical
  screenshots exist; browser acceptance was not rerun by explicit request.
- [x] Source, built declarations, bundled output, CSS, Next 16 fixture,
  public API, and applicable non-browser full-suite gates pass.
- [x] One exact tarball is published and registry-verified.
- [x] Kafil adopts first without losing topic safety, polling, locale sync,
  command failure behavior, or its full inbox/push features.
- [x] School independently adopts without losing its user-language transaction
  or navigation behavior.
- [x] Existing unrelated work is preserved in all repositories.
- [x] Package publication, Git pushes, deployments, and browser acceptance are
  reported as separate evidence-backed outcomes.
