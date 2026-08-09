# najm-theme

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
  `najm-mcp` with `MCP_REGISTRY` and `najm-storage` with `STORAGE_SERVICE`.

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
