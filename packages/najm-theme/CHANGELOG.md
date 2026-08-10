# najm-theme

## 0.1.2

### Fixed

- **`NThemeSettingsProvider` no longer loops forever inside `NajmAppProvider`.**
  The effect that publishes the current design to `najm-kit`'s runtime editor
  listed that editor in its dependency array. The kit's editor value is a
  `useMemo` over its own state, so `setCommitted` gives it a new identity — the
  effect re-ran because of the write it had just performed, wrote again, and
  never settled. Any application that mounts the kit's design provider, which is
  every real consumer, hit "Maximum update depth exceeded" on the first page
  that mounted this provider. The editor is now read through a ref, the effect
  depends only on the draft and the committed design, and a commit is skipped
  when the editor already holds that exact design.

  Found by Kafil's browser gate during its Move 8 adoption, not by this
  package's suite: every other React test here mounts the provider *without*
  the kit's design editor above it, so `useNajmDesignEditor()` answered `null`
  and the effect returned immediately. `test/react/runtime-handoff.test.tsx`
  now mounts the real arrangement and fails on unbounded re-renders.

- **Cancelling a preset preview restores the stored design again.** The same
  effect returns to the stored design by way of `setCommitted`, and the fix
  above made that call conditional on the stored design having actually
  changed. But a preview writes to the editor's *draft*; `committed` is never
  touched. So on cancel the condition was false, nothing was written, and the
  editor went on rendering `draft ?? committed` — the preview stayed on screen
  after the user dismissed it, and after deleting the very preset being
  previewed. The effect now cancels the draft explicitly, which is inert when
  there is no draft. Both halves of the hand-off are covered by
  `test/react/runtime-handoff.test.tsx`.

## 0.1.1

Documentation only. No change to the code, the export map, or any dependency
range — `dist` is byte-identical to 0.1.0.

### Fixed

- The Compatibility section of the README described raising the `najm-storage`
  and `najm-mcp` peer ranges as work still to be done before publication. It was
  written before those releases existed and shipped inside 0.1.0, where it read
  as a warning about the package a consumer had just installed. It now states
  the requirement plainly: `najm-storage` ≥ 2.2.0 and `najm-mcp` ≥ 2.1.0, the
  releases that alias `STORAGE_SERVICE` and `MCP_REGISTRY` to their services.
  Published as its own version because a README is part of the package surface
  and npm will not replace the contents of 0.1.0.

## 0.1.0

Initial release. Pre-1.0: the public API is not frozen, and 1.0.0 waits until two
real consumers have passed production-build, database, browser, upgrade, and
rollback acceptance.

### Added

**Contracts** (`najm-theme`, `najm-theme/contracts`) — universal, with no React,
Node, filesystem, Drizzle, or decorator import.

- Appearance policy on top of `najm-kit`'s design parser: CSS-safety rules for
  every value that reaches a `<style>` element or a `class` attribute, a payload
  byte ceiling, group-level merging, and changed-group calculation.
- Positive-revision helpers and a typed conflict error carrying both revisions.
- Unicode-safe preset slugs — Arabic, Cyrillic, and CJK names slug to
  themselves rather than to an empty string — with NFKC normalization and
  deterministic collision suffixing.
- A branding slot registry with inheritance, factory fallback, and validation of
  consumer-registered slots.
- Scope identifiers, validated before they can reach a query, a storage
  namespace, or a URL.
- Feature and capability projections, and a sanitizing diagnostic contract.

**Server** (`najm-theme/server`)

- The `theme()` plugin: explicit features, per-route guards, dependency
  declarations, and configuration validated at registration rather than at first
  request.
- Appearance, branding, and preset services with compare-and-swap revision
  locking (`SELECT … FOR UPDATE` on PostgreSQL), transactional preset limits, and
  preset-apply coordinated with the appearance lock in one transaction.
- Managed branding assets over `najm-storage`: per-scope namespaces, magic-byte
  probing, declared-vs-actual MIME agreement, decompression-bomb bounds, optional
  Sharp normalization, immutable UUID file names, referenced-only delivery,
  post-commit replacement cleanup, draft cancellation, and grace-period orphan
  reconciliation.
- Structured audit events carrying action, actor, scope, and revision transition
  — and never a design, a token value, or a file name.
- Thin REST controllers and optional MCP tools over the same services.
- Optional peers resolved from the container by symbol — `najm-storage` through
  `Symbol.for('najm:storage:service')`, `najm-mcp` through
  `Symbol.for('najm:mcp:registry')` — rather than by a dynamically imported
  class. A class is only a DI token while every caller holds the same
  constructor, which stops being true the moment this package is consumed as
  `dist` beside an application that maps the same specifier to `src`: the
  container answers with a *second* service instead of failing. Requires
  `najm-mcp` ≥ 2.1.0 and `najm-storage` ≥ 2.2.0, the releases that alias
  `MCP_REGISTRY` and `STORAGE_SERVICE` to their services.

**Schemas** (`najm-theme/pg`, `najm-theme/sqlite`)

- `najm_theme_appearance`, `najm_theme_branding`, `najm_theme_presets`, exported
  per feature and as a combined `themeSchema`. Column-for-column equivalent
  across dialects, verified structurally by a parity test. No runtime
  `CREATE TABLE`; no foreign key into an auth table.

**React** (`najm-theme/react`, `najm-theme/styles.css`)

- `NThemeSettingsProvider` — queries, canonical query keys, mutations, drafts,
  dirty tracking, candidate upload tracking, conflict recovery, and immediate
  updates to Najm Kit's design and branding runtime providers.
- `NThemeAppearanceSettings`, `NThemeBrandingSettings`, `NThemePresetSettings`,
  `NThemeSettingsActions`, `NThemeSettingsSaveButton`,
  `NThemeSettingsResetButton`, `NThemeSettingsStatus`, and the composite
  `NThemeSettings` — each mountable in a page, tabs, a sheet, a dialog, or alone.
- A typed transport client with configurable base URL and auth headers.
- English, French, Arabic, and Spanish catalogs shared with the API messages,
  with consumer label overrides and a key-set parity test.
- Package styles using logical properties throughout, honouring reduced motion.

**Server rendering** (`najm-theme/server/react`)

- `createReactThemeBootstrap()`, configuring `najm-kit/server/react` rather than
  reimplementing it: one snapshot per React server request, independent
  per-resource fallback, and no cross-request sharing.
- A `browser`-condition guard that fails the build when a Client Component
  imports the adapter, verified by a Next.js 16 production fixture.

### Notes

- `najm-theme` is published after a compatible `najm-kit`; `najm-kit` does not
  and must not depend on it.
- `najm-theme` is not re-exported from `najm-api` in this release — it is
  optional and carries React-capable subpaths.
