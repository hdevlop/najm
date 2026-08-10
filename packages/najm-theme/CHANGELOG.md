# najm-theme

## 0.2.0

The factory theme convention. One directory replaces the callbacks, the asset
paths, the fallback maps, and the route knowledge a consumer used to repeat in
five places across two processes.

A minor rather than a patch on purpose: the 0.1.1 consumer contract is
superseded, and the branding URLs an application serves change.

### Added

- `defineTheme(import.meta.url)`, from the new `najm-theme/theme` entry. It
  resolves a sibling `theme.json` and the four fixed branding basenames —
  `sidebar-logo-expanded`, `sidebar-logo-collapsed`, `auth-logo`, `auth-hero`,
  each exactly one `.png` or `.webp` — validates every one against its header
  bytes and its slot ceiling, and returns an immutable definition. Module
  relative, never `process.cwd()`; proven in Bun, compiled tests, a Next 16
  production build, and the built package.
- Package-owned factory asset serving at
  `<mount>/branding/factory/<slot>.<hash>.<ext>`, with the file's real content
  type, its length, `nosniff`, an ETag, and a one-year immutable cache that the
  content hash makes honest. The bytes are read once at definition time, so the
  route touches no filesystem and has no path to traverse.
- `theme(definition, { manage, … })`. Features, public reads, the dialect
  schema, the standard slots, storage defaults, route suffixes, and a sanitized
  diagnostic sink all default; one `manage` guard list replaces three that were
  identical in every consumer. Per-route `guards` remain as an escape hatch.
- `definition.react({ getServer })` — the RSC bootstrap built from the same
  definition, so the frontend repeats no factory design, no branding map, and no
  route prefix. `createReactThemeBootstrap(definition, config)` is the same
  thing for a module that already has the definition in hand.
- The bootstrap attaches the factory map to every branding it returns, so the
  React tree has the managed → factory chain without the consumer building it.
  `NThemeImage` reads it through `<NThemeBrandingProvider branding={branding}>`.
- `NThemeImage` and `NThemeBrandingProvider` in `najm-theme/react`: a slot
  renderer with the managed-to-factory chain continued into the browser, so a
  managed asset that 404s falls back to the file the build ships rather than to
  a broken-image glyph.
- `najm-theme/theme` export subpath, and the convention's names on
  `najm-theme/contracts`.

### Changed

- **Standard consumer carries no theme plumbing.** A standard application passes
  nothing but `branding` to `<NThemeBrandingProvider>`, nothing but
  `onPersisted` to `<NThemeSettingsProvider>`, and `'/api/theme'` only ever
  appears in tests that assert the public URL. `defineTheme`, `theme(...)`, and
  `appTheme.react({ getServer })` are the only theme imports an application
  writes; a source-boundary test enforces it on every `najm-theme` consumer in
  the worktree.
- **Branding paths now include the server base.** `/theme/branding/assets/x` was
  never a URL an application with `.base("/api")` served; the resolved paths are
  now `/api/theme/branding/assets/x`, read from `najm-core`'s `BASE_PATH`.
- **No implicit factory inheritance.** With a definition, `sidebarLogoCollapsed`
  and `authLogo` no longer fall back to `sidebarLogoExpanded`. All four factory
  files are required, so each slot resolves to its own managed upload or its own
  factory file; uploading one logo no longer silently replaces three marks.
- `createReactThemeBootstrap()` supplies a sanitized warning reporter by
  default, accepts `onDiagnostic: false` for deliberate silence, and validates
  custom route prefixes. Standard consumers omit both `basePath` and
  `onDiagnostic`.
- Same-process consumers pass one lazy `getServer` function; the package builds
  the internal Request. `fetcher` remains the mutually exclusive escape hatch
  for a remote or custom transport.

### Deprecated

- `theme.factory.appearance` and `theme.factory.branding`, and the
  `createReactThemeBootstrap({ factory })` form for an application that has a
  factory directory. Both still work in 0.2.0 and are removed in 0.3.0. There is
  no supported configuration in which a consumer maintains both.
- `<NThemeBrandingProvider factory={…}>` removed in favour of the factory map
  the bootstrap attaches to its branding return.

### Migration

1. Create `theme/` next to your application code: `theme.json` (the design that
   used to be a TypeScript constant), the four images under their fixed names,
   and `index.ts` containing
   `export const appTheme = defineTheme(import.meta.url);`.
2. Replace the plugin config with `theme(appTheme, { dialect, manage: [...] })`.
3. Replace the RSC facade's config with `appTheme.react({ getServer })`.
4. Delete the factory constants, the four public asset paths, any
   `BrandingImage` fallback map, and the `factoryBranding` export from
   `serverTheme.ts`. Render `<NThemeImage slot="…" alt="…" />` under
   `<NThemeBrandingProvider branding={branding}>`. The factory chain is now on
   the branding the bootstrap returned, not a separate prop.
5. Drop `client={{ baseUrl: '/api/theme' }}` from `<NThemeSettingsProvider>`.
   The settings client already defaults to the standard mount; pass one only
   for a custom or remote backend.
6. If anything outside the package linked to `/theme/branding/assets/…`, update
   it to the mounted path — or keep a redirect until stored references age out.

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
