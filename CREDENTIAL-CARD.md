# Najm Kit Credentials Card Plan

Status: **PLANNED — documentation only**

Written: 2026-08-10

Primary package: `packages/najm-kit`

First consumer: `C:\Users\hdevlop\Desktop\kafil`

Possible later consumer: `C:\Users\hdevlop\Desktop\school`

## How the assigned coder must use this plan

This document is an implementation runbook, not a list of suggestions.

1. Work through Moves 0-8 in order. Do not start the Kafil migration before
   the publication gate that precedes it.
2. Re-inspect every named file at the start of its move. The verified baseline
   below is a snapshot; the repositories keep moving.
3. Change only the files named for the active move. If another file looks
   necessary, record why before editing it.
4. Mark a checkbox only after recording the command output or the visual proof.
   Code that looks correct is not evidence.
5. Stop on a failed gate. Diagnose it or record it as an unrelated reproducible
   blocker. Do not assume a later command makes it irrelevant.
6. Never discard, stage, or rewrite another person's dirty files in either
   repository.
7. Do not publish, push, or migrate a consumer unless the move allows it.
   Publication requires explicit user authorization.
8. When a requirement is unclear, choose the smallest additive option that
   preserves the frozen contract below. Do not redesign the API silently.

### Execution order and hard stop gates

| Move | Repository | Required output | Do not continue when |
| --- | --- | --- | --- |
| 0 | Najm | Fresh baseline, dirty work attributed | Contract conflicts with current source |
| 1 | Najm | `NCredentialsCard` component | Copy path can throw unhandled |
| 2 | Najm | Public exports and barrel test | Root and `data-display` barrels disagree |
| 3 | Najm | Focused behavior suite | Any clipboard branch is untested |
| 4 | Najm | Playground section + visual proof | Dark, mobile, or RTL unchecked |
| 5 | Najm | All package gates pass | Built output differs from source contract |
| 6 | Najm/npm | One verified published tarball | User has not authorized publication |
| 7 | Kafil | Wrapper deleted, four locales updated | Package is unpublished or locale parity fails |
| 8 | All | Evidence ledger | Any outcome is inferred rather than recorded |

### Scope discipline

Additive changes to `src/components/data-display`, the root barrel, tests, the
playground, README, and CHANGELOG are in scope. Do not opportunistically
refactor tables, cards, dialogs, forms, theme, or auth. Do not fold this work
into an unrelated `najm-theme` or table change.

## Outcome

Najm Kit gains one component for the recurring "show a freshly generated secret
once, let the operator hand it over, never show it again" surface. Kafil's
`apps/web/src/shared/InitialCredentialsCard/index.tsx` disappears into it, and
the strings it currently hardcodes in English start flowing through Kafil's
four-locale catalog.

The work is complete only after the component is tested, visually proved in the
playground, published from one auditable tarball, and adopted by Kafil.

## Verified baseline

Verified 2026-08-10 by reading the files.

Najm:

- `packages/najm-kit/package.json` is `najm-kit@2.10.0`.
- There is no clipboard helper anywhere in `packages/najm-kit/src`
  (`grep -rn "clipboard.writeText" src` returns nothing). This component
  introduces the first one.
- `src/components/data-display/` holds `NDetailCard`, `NBulkActionsBar`,
  `NFilterBar`, `NRowActions`, `NViewBody`, `NViewToggle`, `NContextMenu`,
  `NFileTypeIcon`, and two context-menu hooks, with a local `index.ts` barrel.
- `src/index.ts:188-191` re-exports that barrel plus `NFileTypeIcon` explicitly.
- No file under `src/components/` carries a `"use client"` directive. Only
  `src/adapters/app.tsx` does, and that entry exists for Server Component routes
  importing feedback states. Consumers of `data-display` supply their own
  client boundary.
- `toast` is exported from the root barrel (`src/index.ts:150`, re-exporting
  `components/ui/sonner`) and requires the consumer to have mounted `Toaster`.
- `NEmptyState` and `NDetailCard` set the prop conventions to follow: optional
  `title`/`description`, `icon` accepting a Lucide component or element,
  `className`, and a `classNames` slot record on the richer component.
- `NFeedbackDefaults` (`src/components/feedback/feedbackDefaults.tsx`) is the
  precedent for provider-supplied labels: literals, catalog keys, prefix,
  packaged English last. This plan deliberately does **not** use it — see
  "Rejected alternatives".
- Tests live beside their area (`test/data-display/bulk-actions-bar.test.tsx`),
  `bunfig.toml` preloads `test/setup.ts`, and DOM tests use
  `@testing-library/react` on happy-dom.
- `test/barrel.test.ts` asserts named root exports and must be extended.
- The Vite playground root is `packages/najm-kit/playground`, sections live in
  `playground/src/sections/`, `DataDisplayPreview.tsx` is the relevant one, and
  `bun run --cwd packages/najm-kit dev` serves `127.0.0.1:5177`.

Kafil:

- `apps/web/src/shared/InitialCredentialsCard/index.tsx` is 56 lines, `"use client"`,
  and imports `NButton` and `toast` from `najm-kit`.
- Its only consumer is
  `apps/web/src/features/Staff/components/StaffForms.tsx` (the provision-access
  dialog), which renders it in place of the form once `provisionAccess` returns
  an `initialPassword`, and passes `onDone={() => void pop()}`.
- Every string in the component is hardcoded English, while the surrounding
  form uses `useKafilLanguage`. This is a live localization gap in a four-locale
  product, not just a packaging problem.
- `copyCredentials` awaits `navigator.clipboard.writeText` with no guard and no
  `catch`. Outside a secure context `navigator.clipboard` is `undefined`, and a
  rejected write becomes an unhandled rejection inside a dialog.
- Kafil UI strings come from `packages/server/src/locales/{en,fr,ar,es}.json`
  via `@kafil/server/locales`, covered by
  `packages/server/test/locale-parity.test.ts`. The `staff` namespace currently
  contains only `staff.success.*`. No `copy`, `done`, `phone`, or `password`
  key exists under `common`.
- Kafil pins `najm-kit` to exactly `2.10.0` in root `overrides`, root
  `dependencies`, and `apps/web/package.json`. All three move together.

School:

- No provisioning or one-time-password surface exists
  (`grep -rln "provision\|temporaryPassword\|generatedPassword" apps/dashboard/src`
  returns nothing). School is a design constraint, not an adoption gate.
- School still declares old `najm-kit` ranges (`^2.1.43` root, `^2.1.40`
  dashboard). Do not bump School as part of this work.

## Problem statement

The Kafil component is the right shape but is not liftable as written:

1. Every label is a hardcoded English literal. Najm Kit has no translation
   catalog, so the labels must become props — which is also what fixes Kafil.
2. The field list is frozen to phone + password. Another product provisioning
   an account may hand over an email, a username, a login URL, or a recovery
   code.
3. `onDone` is application flow, not presentation. Closing a dialog belongs to
   the call site.
4. The copy action is unguarded. A package-level component must not produce an
   unhandled rejection when the clipboard is unavailable or denied.
5. Feedback depends on a mounted `Toaster`. A shared component should confirm
   the copy visibly on its own and treat a toast as optional.

## Ownership boundary

### Najm Kit owns

- The card frame, field rows, monospace/wrapping treatment of secret values.
- Copy composition, the clipboard call, its failure handling, and the
  copied-state affordance.
- Accessible structure: description list semantics, the live region announcing
  a successful copy, and the copy button's accessible name.
- Logical-property spacing so RTL works without a consumer override.
- Packaged English fallbacks for the two generic action labels only.

### Each application owns

- Every domain label: title, description, field labels, action labels, and any
  translated toast message.
- Which fields exist and in what order.
- What happens after handover (`actions`), including closing a dialog.
- Whether the secret may be displayed at all, and its lifetime.
- Logging and audit. The card must never log or transmit a value.

### Explicit non-goals

- Do not put Kafil or School strings in Najm Kit.
- Do not fetch, generate, or persist a credential inside the component.
- Do not auto-copy on mount, auto-focus the secret, or render it inside an
  editable input.
- Do not import Next, React Query, `najm-auth`, or an API client.
- Do not add a "reveal/hide" toggle in v1. The contract is a one-time reveal
  that is already visible.
- Do not make the component depend on a mounted `Toaster`.

## Frozen public contract

Type names may be refined during Move 1; the behavior below is fixed.

```ts
export interface NCredentialField {
  label: string;
  value: string;
  icon?: NIconSource;
  /** Render the value in the mono face. Default true — these are secrets. */
  mono?: boolean;
  /** Allow mid-string wrapping for long values. Default true. */
  breakAll?: boolean;
}

export interface NCredentialsCardClassNames {
  root?: string;
  header?: string;
  list?: string;
  field?: string;
  actions?: string;
}

export interface NCredentialsCardProps {
  fields: NCredentialField[];
  title?: string;
  description?: string;
  /** Header icon. Defaults to a check mark. */
  icon?: NIconSource;
  /** Copy button label. Packaged fallback: "Copy details". */
  copyLabel?: string;
  /** Announced and shown after a successful copy. Packaged fallback: "Copied". */
  copiedLabel?: string;
  /** Shown after a failed copy. Packaged fallback: "Copy failed". */
  copyErrorLabel?: string;
  /** Override the copied text. Default: one `${label}: ${value}` line per field. */
  copyText?: (fields: NCredentialField[]) => string;
  /** Hide the built-in copy button when the consumer supplies its own. */
  hideCopyAction?: boolean;
  onCopy?: () => void;
  onCopyError?: (error: unknown) => void;
  /** Consumer-owned buttons rendered next to copy. */
  actions?: React.ReactNode;
  className?: string;
  classNames?: NCredentialsCardClassNames;
}
```

Behavioral requirements:

1. `fields` renders as a `<dl>`, one `<div>` per field, `<dt>` label and `<dd>`
   value. An empty `fields` array renders the frame with no list, not a crash.
2. The copy button resolves text through `copyText` when supplied, otherwise
   joins `${label}: ${value}` with `\n` in `fields` order.
3. Copy is attempted only when `navigator.clipboard?.writeText` is a function.
   When it is missing, or the promise rejects, the component enters the error
   state and calls `onCopyError`. It never rethrows and never leaves an
   unhandled rejection.
4. On success the button swaps to `copiedLabel` with a check icon, `onCopy`
   fires, and the state reverts after roughly two seconds. On failure it shows
   `copyErrorLabel` and reverts the same way.
5. Copy status is announced through an `aria-live="polite"` region. The visible
   swap is the primary feedback; no toast is emitted by the component.
6. The three action labels have packaged English fallbacks. `title`,
   `description`, and every field label have none — a consumer that omits them
   gets no text, not English.
7. Spacing uses logical properties only, so an `dir="rtl"` tree needs no
   override.
8. The component imports nothing outside `react`, `lucide-react`, and
   package-local `lib`/`components`.

### Rejected alternatives

- **Provider-backed labels via `NFeedbackDefaults`.** Rejected for v1. Field
  labels here are product vocabulary ("Initial password", "Guardian phone"),
  not generic UI states, and a provider default would push one product's
  wording into the package. If a second consumer later wants shared action
  labels, extend the existing feedback-defaults mechanism rather than inventing
  a parallel one.
- **A `useClipboard` hook as the public surface.** Rejected. It ships the same
  risk with none of the presentation, and no second call site needs it yet.
  Keep the copy logic module-private inside the component file.
- **Toast-first feedback.** Rejected. It couples the component to a mounted
  `Toaster` and says nothing when that provider is absent.

## Moves

### Move 0 — Baseline

- [ ] Record the current `najm-kit` version and branch.
- [ ] `git status` in Najm and Kafil; attribute every dirty file and leave
      unrelated work untouched.
- [ ] Re-read the seven baseline observations above against current source.
      Record any drift before writing code.

### Move 1 — Implement the component

- [ ] Create `packages/najm-kit/src/components/data-display/NCredentialsCard.tsx`.
- [ ] Implement the frozen contract. Keep the copy helper module-private.
- [ ] Match `NDetailCard` conventions: `cn` from `../../lib/cn`, `NIcon` for
      icon sources, `classNames` slots, no `"use client"` directive.
- [ ] Use `NButton` for the copy action; keep the busy/disabled path honest
      while the write promise is pending.
- Stop when: any code path can throw past the component, or a value is logged.

### Move 2 — Exports

- [ ] Export component and types from `src/components/data-display/index.ts`.
- [ ] Re-export both from `src/index.ts` alongside the existing data-display
      lines (`src/index.ts:188-189`).
- [ ] Extend `test/barrel.test.ts` with a root-export assertion.
- Stop when: the local barrel and the root barrel disagree.

### Move 3 — Tests

Create `packages/najm-kit/test/data-display/credentials-card.test.tsx`.

- [ ] Renders each field as a `dt`/`dd` pair in order.
- [ ] Default copy text is the newline-joined `label: value` list.
- [ ] `copyText` overrides that text.
- [ ] Successful copy calls `onCopy`, swaps the label, and announces politely.
- [ ] Rejected `writeText` calls `onCopyError`, shows the error label, and
      produces no unhandled rejection.
- [ ] Absent `navigator.clipboard` takes the same failure path.
- [ ] `hideCopyAction` removes the button while `actions` still render.
- [ ] Empty `fields` renders without throwing.
- Note: happy-dom does not provide `navigator.clipboard`. Stub it per test and
  restore it afterwards; do not add a global stub to `test/setup.ts`.
- [ ] `bun run --cwd packages/najm-kit test test/data-display/credentials-card.test.tsx`

### Move 4 — Playground and visual proof

- [ ] Add a section to `playground/src/sections/DataDisplayPreview.tsx` showing
      a two-field default, a four-field variant with custom `actions`, and a
      long-value case.
- [ ] `bun run --cwd packages/najm-kit dev` and check `127.0.0.1:5177`.
- [ ] Prove light, dark, mobile width, and `dir="rtl"`. Record what was seen.
- [ ] Show the result to the user before Move 6. Do not publish on the strength
      of passing tests alone.
- Stop when: any of the four visual conditions is unchecked.

### Move 5 — Package gates

- [ ] `bun run --cwd packages/najm-kit lint`
- [ ] `bun run --cwd packages/najm-kit test`
- [ ] `bun run --cwd packages/najm-kit build`
- [ ] Confirm the built `dist/index.mjs` and `dist/index.d.ts` carry the new
      exports.
- [ ] Update `README.md` and `CHANGELOG.md`.

### Move 6 — Publish

- [ ] Get explicit user authorization first.
- [ ] Publish with the patch bump. Never combine a dry run with a bump flag —
      it bumps twice.
- [ ] Verify the published tarball actually contains the export before touching
      Kafil.

### Move 7 — Kafil adoption

- [ ] Bump `najm-kit` in Kafil root `overrides`, root `dependencies`, and
      `apps/web/package.json` together; `bun install`.
- [ ] Add keys to all four of
      `packages/server/src/locales/{en,fr,ar,es}.json`: a `staff.access`
      group (`created`, `oneTimeHint`, `initialPassword`) plus the shared
      action and field labels the call site needs (`common.copyDetails`,
      `common.copied`, `common.done`, `common.phone`). Parity is enforced by
      `packages/server/test/locale-parity.test.ts` — a missing locale fails the
      suite.
- [ ] Rewrite the provision-access branch in
      `apps/web/src/features/Staff/components/StaffForms.tsx`:

```tsx
<NCredentialsCard
  title={t("staff.access.created")}
  description={t("staff.access.oneTimeHint")}
  fields={[
    { label: t("common.phone"), value: credentials.phone, icon: Phone },
    { label: t("staff.access.initialPassword"), value: credentials.password, icon: KeyRound },
  ]}
  copyLabel={t("common.copyDetails")}
  copiedLabel={t("common.copied")}
  actions={<NButton onClick={() => void pop()}>{t("common.done")}</NButton>}
/>
```

- [ ] Delete `apps/web/src/shared/InitialCredentialsCard/`.
- [ ] `grep -rn "InitialCredentialsCard" apps/web/src` returns nothing.
- [ ] Run the Kafil gate:
      `bun run lint && bun run typecheck && bun run test && bun run build && bun run db:generate`.
      `db:generate` must produce no new migration.
- [ ] Open the staff provision-access dialog in the running app and confirm the
      handover in English and Arabic.

### Move 8 — Evidence ledger

- [ ] Record every command and its outcome using the template below.
- [ ] Record the rollback: Kafil reverts by restoring the deleted directory and
      the pinned version triple; Najm's added export is additive and needs no
      revert.
- [ ] Note explicitly that School was not adopted and why.

## Security notes

- The value rendered here is a live credential shown once. It must never be
  logged, sent to an analytics call, placed in a `title` attribute, or written
  to `localStorage`.
- Do not auto-copy on mount. A copy must follow a user gesture, both for
  browser policy and because a silent clipboard write is hostile.
- The card is presentation only. Whether the operator is allowed to see this
  secret is a backend authorization decision that must already have been made.

## Evidence template

```
Move: <n> — <name>
Repository: <najm|kafil>
Files changed: <paths>
Commands run: <command> → <pass|fail, key output>
Visual proof: <what was opened, what was observed: light/dark/mobile/rtl>
Deviations from plan: <none | what and why>
Blockers: <none | reproducible description>
```
