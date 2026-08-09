# Najm Theme Package Plan

Status: **PROPOSED**

Last updated: 2026-08-09

This plan creates `najm-theme`, an optional end-to-end Najm package for
platform appearance, theme presets, and branding assets. Applications install
and enable it only when they need managed runtime theming. The package owns the
reusable backend, persistence contracts, transport, client state, and
composable settings UI so Kafil, School, and future applications do not copy
controllers, services, repositories, DTOs, hooks, API clients, or editor
contexts from one another.

This file is authoritative for the Najm package implementation and its public
contract. Kafil and School keep authority over their own data migrations,
acceptance evidence, releases, and deployments. Package publication, consumer
adoption, GitHub state, and deployment are separate gates.

## 1. Required outcome

The completed package must let an application opt into any combination of:

- runtime appearance and design configuration;
- named theme presets;
- managed branding assets;
- server-rendered appearance and branding bootstrap;
- a complete settings surface or independently composed settings sections;
- PostgreSQL or SQLite persistence;
- local or database-backed `najm-storage`;
- REST and optional MCP commands.

A normal consumer must not implement feature-owned hooks, query keys, API
clients, controllers, services, repositories, DTOs, validators, upload cleanup,
or revision coordination. Its integration should be limited to:

1. registering the plugin and its dialect schema;
2. supplying factory theme and branding values;
3. supplying authorization guards or capabilities;
4. choosing storage, audit, endpoint, scope, and enabled-feature options;
5. mounting the provider and any desired UI sections;
6. creating its one module-level React server loader facade when using RSC.

Those files are application configuration, not duplicated feature logic.

## 2. Scope and non-goals

### In scope

- A new workspace package at `packages/najm-theme`.
- Pure contracts for appearance, branding, presets, revisions, diagnostics,
  and capabilities.
- Najm controllers, DTOs, validators, services, repositories, and plugin
  registration.
- PostgreSQL and SQLite Drizzle schemas with the same public behavior.
- Managed asset validation, normalization, upload, serving, replacement,
  reset, candidate cleanup, and orphan reconciliation.
- Structured audit events without application-private payloads.
- React Query transport, query keys, mutations, draft state, dirty tracking,
  conflict handling, and immediate runtime-provider updates.
- Container-independent components for Theme, Branding, Presets, Actions, and
  status feedback.
- A ready-made composite settings view for consumers that do not need a custom
  layout.
- Server Component bootstrap integration built on the existing
  `najm-kit/server` and `najm-kit/server/react` contracts.
- Default English, French, Arabic, and Spanish UI catalogs with label
  overrides.
- Kafil migration first, then School migration as the second real consumer.

### Out of scope

- Kafil funding targets, contribution expiry, form-fill settings, currency,
  or any other product-domain settings.
- School academic, notification, security, database, calendar, or fee
  settings.
- User light/dark preference persistence owned by `next-themes` or the host
  preference package. Platform design and personal mode remain separate.
- Authentication, session, role seeding, or generic audit-log products.
- Moving every foundational design primitive out of `najm-kit` in the first
  release.
- A process-global or durable cache for public UI bootstrap data.
- Automatic edits to a consumer's deployed migration history.
- Publishing or deploying without explicit user authorization.

## 3. Verified baseline

### Najm

- `packages/najm-kit` is currently version `2.9.0` in the source checkout.
- `najm-kit` already owns `NajmDesignConfig`, its pure parser, design and theme
  providers, `NThemeCustomizer`, `NThemePresets`, branding state,
  `useNBrandingEditor`, `NajmAppProvider`, and the visual primitives the new
  package needs.
- `najm-kit/server` already provides pure UI bootstrap loading and server-safe
  design parsing.
- `najm-kit/server/react` already provides request-scoped React `cache()`
  memoization through `createReactServerUiBootstrap()`.
- `najm-storage@2.1.1` already supports local and database storage, explicit
  route guards, PostgreSQL/SQLite/MySQL schemas, namespaces, MIME validation,
  optional Sharp previews, immutable cache configuration, and events.
- `najm-core` provides the plugin builder and dependency injection conventions
  required for a feature plugin.
- `apps/theme-studio` already exists and is the preferred visual development
  and integration harness for package UI. Do not create a second theme demo
  application.
- The root publication target list currently ends with `najm-kit`; it has no
  `najm-theme` target, scripts, TypeScript path, or project reference.

### Kafil reference implementation

- Kafil's current worktree resolves `najm-kit@2.9.0` and already consumes
  `createReactServerUiBootstrap()` through one module-level server loader.
- Kafil has independent positive appearance and branding revisions with
  optimistic conflict detection.
- Appearance supports validated save, complete-preset replacement, reset to a
  factory design, safe public fallback, and audit records.
- Theme presets support list, create, apply, delete, built-in markers,
  Unicode-safe stable slugs, a maximum count, and validation against the same
  appearance policy.
- Branding supports expanded and collapsed sidebar logos, authentication logo,
  authentication hero, factory inheritance, managed uploads, MIME and size
  checks, immutable public delivery, candidate deletion, replacement cleanup,
  reset, and revision concurrency.
- Kafil's reusable appearance and branding fields are currently mixed into
  `platform_settings` beside Kafil-only financial and operational fields. The
  package must use dedicated tables instead of copying that table.
- Kafil's frontend already uses Najm Kit primitives but still owns feature
  hooks, transport clients, editor coordination, localization wiring, and
  settings composition that belong in `najm-theme/react`.

### School second consumer

- School currently resolves the older `najm-kit@2.1.43` lock and must perform a
  controlled Najm Kit upgrade before consuming `najm-theme`.
- School has a local `NajmDesignProvider`, a separate `next-themes` provider,
  a basic `light | dark | system` setting, and one `schoolLogo` field.
- School's settings module mixes school identity, academic configuration,
  notifications, security, time zone, language, date/time formats, currency,
  and theme mode. Those domain settings must remain School-owned.
- School does not yet have Kafil's full runtime appearance, preset library,
  revision concurrency, four-slot branding, managed branding lifecycle, or
  shared server bootstrap.
- The second-consumer migration must use the package directly. It must not copy
  Kafil's modules or preserve `schoolLogo` as a second branding source of
  truth.

## 4. Architecture decisions

### 4.1 One optional feature package with isolated exports

Create one publishable package, `najm-theme`, with explicit subpath exports:

```text
najm-theme
najm-theme/contracts
najm-theme/server
najm-theme/server/react
najm-theme/pg
najm-theme/sqlite
najm-theme/react
najm-theme/styles.css
najm-theme/package.json
```

- The root and `contracts` entries are universal and contain no React, Node,
  filesystem, Drizzle runtime, or decorator imports.
- `server` contains the plugin, services, controllers, DTOs, validation,
  storage orchestration, audit events, and repository contracts.
- `pg` and `sqlite` contain dialect-specific Drizzle schema and repository
  bindings.
- `server/react` is an RSC-only preconfigured adapter built on
  `najm-kit/server/react`.
- `react` is a Client Component entry containing providers, transport, hooks,
  and composable components.
- `styles.css` contains only package-owned UI styles not already emitted by
  `najm-kit/theme.css`.
- No client-capable entry may statically import a server entry.
- No server entry may import the `najm-kit` root barrel.

### 4.2 Keep `najm-kit` as the rendering foundation

The first `najm-theme` release builds on the published Najm Kit contracts. It
does not move `NajmDesignConfig`, theme rendering, provider contexts,
`NThemeCustomizer`, `NThemePresets`, `ImageInput`, sheets, dialogs, tabs, or
cards out of `najm-kit`.

This direction avoids a circular dependency:

```text
najm-kit                 rendering primitives and theme runtime
    ^
    |
najm-theme/react         managed feature composition

najm-kit/server          pure design and bootstrap contracts
    ^
    |
najm-theme/server        persistence and transport feature
```

`najm-theme` is published after the compatible `najm-kit` version. Do not make
`najm-kit` depend on `najm-theme`. A later design-contract extraction requires
its own plan and cannot be smuggled into this migration.

### 4.3 Feature composition is independent of presentation containers

The package owns the feature state machine, not the consumer's page layout.
Consumers may mount Theme, Branding, Presets, Actions, and Status inside any
Najm page, sheet, dialog, tabs, accordion, dashboard card, or standalone view.

The package must provide both:

- independent section components under one provider; and
- one ready-made composite `NThemeSettings` surface.

No section may assume that another section is a sibling or that a particular
sheet, page, or tab implementation owns it.

### 4.4 Applications keep configuration, not feature implementations

Applications retain:

- factory theme JSON and default asset values;
- product name and brand copy;
- enabled features and branding slot definitions;
- role-to-capability grants and concrete guards;
- database and storage plugin registration;
- audit sink or event listener;
- scope selection for single-platform or tenant-aware usage;
- placement of the React provider and section components;
- one RSC module singleton when server-render bootstrap is used;
- one-time legacy data migration mapping.

Applications must not retain local copies of package-owned controllers,
services, repositories, DTOs, validators, query keys, API functions, editor
contexts, preset state, asset cleanup, or optimistic-revision logic.

### 4.5 Package-owned tables are separate from product settings

Do not embed reusable theme state into Kafil `platform_settings` or School
`settings`. Use package-prefixed tables that can be composed into any app
schema without inheriting product-domain columns.

### 4.6 Kafil is the reference; School proves reuse

Kafil's accepted behavior defines the initial complete contract. Do not freeze
the public API from Kafil source alone: exercise School's provider tree,
branding needs, SQLite schema, settings placement, and upgrade constraints
before the first stable release. Kafil adopts the published package before
School. No consumer imports unpublished workspace source.

## 5. Proposed package layout

```text
packages/najm-theme/
  package.json
  tsconfig.json
  tsconfig.test.json
  tsup.config.ts
  README.md
  CHANGELOG.md
  src/
    index.ts
    contracts/
      appearance.ts
      branding.ts
      capabilities.ts
      diagnostics.ts
      presets.ts
      revisions.ts
      scope.ts
      index.ts
    server/
      appearance/
        AppearanceController.ts
        AppearanceDto.ts
        AppearanceRepository.ts
        AppearanceService.ts
        AppearanceValidator.ts
      branding/
        BrandingController.ts
        BrandingDto.ts
        BrandingRepository.ts
        BrandingService.ts
        BrandingValidator.ts
        BrandingAssetService.ts
      presets/
        ThemePresetController.ts
        ThemePresetDto.ts
        ThemePresetRepository.ts
        ThemePresetService.ts
        ThemePresetValidator.ts
      audit/
        ThemeAuditEvents.ts
        ThemeAuditSink.ts
      config.ts
      module.ts
      tokens.ts
      index.ts
      react.ts
      reactClientGuard.ts
    schema/
      pg.ts
      sqlite.ts
      shared.ts
    react/
      api/
      components/
      hooks/
      providers/
      queryKeys.ts
      translations/
      types.ts
      index.ts
    styles/
      theme.css
  test/
    contracts/
    server/
    database/
    react/
    rsc/
  integration/
    next16/
```

Keep controller, service, repository, DTO, and validator responsibilities
separate even though they are published from one package.

## 6. Public configuration contract

The exact names are frozen only after Move 0, but the contract must express
the following without application-specific imports:

```ts
interface NajmThemeFeatures {
  appearance: boolean;
  branding: boolean;
  presets: boolean;
  assetUploads: boolean;
  mcp: boolean;
}

interface NajmThemeConfig {
  features: NajmThemeFeatures;
  database: string;
  dialect: "pg" | "sqlite";
  basePath: string;
  scope: ThemeScopeResolver;
  factory: {
    appearance: () => NajmDesignConfig;
    branding: () => FactoryBranding;
  };
  brandingSlots: BrandingSlotDefinition[];
  guards: ThemeRouteGuards;
  storage: ThemeStorageConfig;
  audit?: ThemeAuditSink;
  diagnostics?: ThemeDiagnosticSink;
  limits?: ThemeLimits;
}
```

Configuration rules:

- `features` is required and explicit; the package must not silently expose
  mutation routes.
- `presets` requires `appearance`.
- `assetUploads` requires `branding` and `najm-storage`.
- Public appearance or branding reads require an explicit `publicRead: true`
  decision. Otherwise the caller supplies read guards.
- Every mutation capability requires explicit guards. Missing mutation guards
  fail plugin registration.
- Factory functions are required only for enabled resources and must throw
  visibly when app configuration is broken.
- The package defaults to scope `platform`, but scope resolution must support a
  future tenant or organisation identifier without schema replacement.
- `basePath` defaults to `/theme`; canonical endpoints are stable beneath it.
- Applications may override limits only within package-enforced safe maxima.

## 7. Domain contracts

### Appearance

```ts
interface PublicAppearance {
  designConfig: NajmDesignConfig;
  revision: number;
}
```

- Revisions are positive safe integers and increment by exactly one per
  committed mutation.
- Public reads always return a complete validated design plus revision.
- Stored `null` means factory design, not an invalid empty design.
- A saved edit may merge only the package-approved editable surface.
- Applying a preset replaces the complete design captured by that preset.
- Reset stores the factory state intentionally and increments the revision.
- Invalid stored configuration falls back safely and emits a sanitized
  diagnostic; it never leaks the invalid payload.

### Theme presets

```ts
interface PublicThemePreset {
  id: string;
  scopeId: string;
  slug: string;
  name: string;
  designConfig: NajmDesignConfig;
  isBuiltIn: boolean;
  createdAt: string;
}
```

- Names are trimmed, bounded, and nonblank.
- Slugs are Unicode-safe, deterministic, and unique within a scope.
- Every stored preset is validated through the same appearance policy.
- Preset limits are enforced transactionally.
- Applying a preset takes `expectedRevision` and uses the appearance lock.
- Built-in deletion policy is configurable and documented; it must not differ
  silently between UI and backend.

### Branding

Use a slot registry rather than hard-coded application components:

```ts
interface BrandingSlotDefinition {
  key: string;
  kind: "logo" | "hero" | "icon" | "image";
  labelKey: string;
  maxBytes: number;
  acceptedMimeTypes: string[];
  previewAspect?: "square" | "wide" | "panel" | "natural";
  fallback: FactoryPath | { inheritFrom: string };
}
```

The built-in standard slot definitions cover:

- `sidebarLogoExpanded`;
- `sidebarLogoCollapsed`;
- `authLogo`;
- `authHeroImage`.

Consumers may enable a subset and may register additional safe slots without
forking package code. Branding persistence uses a validated JSON slot map so a
new slot does not require package or consumer DDL.

Public branding returns only resolved public paths and revision. Administrative
branding returns custom selections, resolved fallbacks, slot metadata, and
revision. It must not expose filesystem paths, storage credentials, orphan
lists, or private upload metadata.

## 8. Database design

Export equivalent feature schemas from `najm-theme/pg` and
`najm-theme/sqlite`: `appearanceSchema`, `brandingSchema`,
`themePresetSchema`, and the convenience composition `themeSchema`. A consumer
that enables only Appearance must not be forced to compose the Branding or
Presets tables.

### `najm_theme_appearance`

- `scope_id` primary key;
- `design_config` nullable JSON;
- `revision` positive integer, default `1`;
- `updated_by_actor_id` nullable text without a hard auth-table foreign key;
- `created_at` and `updated_at`.

### `najm_theme_branding`

- `scope_id` primary key;
- `slot_config` validated JSON map containing custom managed references only;
- `revision` positive integer, default `1`;
- `updated_by_actor_id` nullable text;
- `created_at` and `updated_at`.

### `najm_theme_presets`

- UUID `id` primary key;
- `scope_id` text;
- `slug` bounded text;
- `name` bounded text;
- `design_config` JSON;
- `is_built_in` boolean;
- `created_by_actor_id` nullable text;
- timestamps;
- unique `(scope_id, slug)` constraint;
- supporting scope and ordering indexes.

Database invariants:

- Lock the scope row before appearance or branding mutations.
- Validate `actualRevision === expectedRevision` inside the transaction.
- Perform state write and audit/event persistence or enqueue in the same
  transaction when the configured audit sink supports it.
- Do not reference `najm-auth` tables directly; actor identifiers remain
  attributable when auth is installed without making auth mandatory.
- Repository selection is dialect-specific but services and controllers are
  shared.
- No runtime `CREATE TABLE` behavior. Consumers compose the exported schema and
  use their normal migration workflow.

## 9. Storage and asset lifecycle

- Use `najm-storage`; do not copy Kafil's filesystem service into the package.
- Use a dedicated namespace or bucket, scoped so one tenant cannot reference
  another tenant's asset.
- Candidate uploads require mutation authorization and are not enumerable
  through public routes.
- Validate declared MIME, detected MIME, extension, decoded image, dimensions,
  byte limits, and slot compatibility.
- Normalize raster uploads through one package processor. Sharp stays optional
  at installation but is required when normalization is enabled.
- Use immutable content-addressed or UUID file names so committed public URLs
  may receive immutable cache headers.
- Only committed and currently referenced assets are served by the public
  branding route.
- Saving performs the database commit first; replaced-file cleanup is
  post-commit best effort or durably queued. Never unlink inside the database
  transaction.
- Cancelling a draft deletes its known uncommitted candidates best effort.
- Add a safe reconciliation command that deletes only unreferenced assets older
  than a configured grace period.
- Factory assets remain application-owned build assets and are never deleted by
  the package.
- Logs and diagnostics must not include raw file bytes, response bodies,
  cookies, authorization headers, storage credentials, or unsafe thrown
  objects.

## 10. Backend plugin and routes

Proposed registration:

```ts
import { theme } from "najm-theme/server";
import { themeSchema } from "najm-theme/pg";

const server = new Server()
  .use(database({ schema: { ...appSchema, ...themeSchema } }))
  .use(storage(appStorage))
  .use(theme({
    features: {
      appearance: true,
      branding: true,
      presets: true,
      assetUploads: true,
      mcp: true,
    },
    publicRead: true,
    guards: {
      manageAppearance: [canManageTheme()],
      manageBranding: [canManageBranding()],
      managePresets: [canManageTheme()],
    },
    factory,
    brandingSlots,
    storage: { namespace: "theme-branding" },
  }));
```

Canonical routes below `basePath = "/theme"`:

```text
GET    /theme/appearance
PUT    /theme/appearance
POST   /theme/appearance/reset

GET    /theme/presets
POST   /theme/presets
POST   /theme/presets/:id/apply
DELETE /theme/presets/:id

GET    /theme/branding
GET    /theme/branding/config
PUT    /theme/branding
POST   /theme/branding/reset
POST   /theme/branding/assets/:slot/:fileName
GET    /theme/branding/assets/:fileName
DELETE /theme/branding/assets/:fileName
POST   /theme/branding/assets/reconcile
```

Route rules:

- Controllers remain thin and validate every body, parameter, and content type.
- Public routes return privacy-safe projections only.
- Administrative reads and every mutation use package-configured guards.
- The package exposes capabilities, not Kafil `admin` or School
  `administrator` role names.
- MCP tools are registered only when enabled and use the same services as REST.
- Upload endpoints stay REST/binary; never encode image bytes in MCP JSON.
- Mutation commands use explicit actions, not generic status or revision
  setters.
- Canonical response and error keys ship in the package locale catalogs.

## 11. React architecture

### Provider

Provide `NThemeSettingsProvider` from `najm-theme/react`. It owns:

- query client integration;
- canonical query keys;
- public and administrative resource queries;
- appearance, branding, and preset mutations;
- revision snapshots and conflict recovery;
- appearance and branding drafts;
- dirty-state calculation;
- candidate upload tracking and cancellation cleanup;
- save, reset, preset apply, preset create, and preset delete commands;
- immediate updates to Najm Kit's design and branding runtime providers;
- cache invalidation and optional router refresh after persistence;
- enabled features and server-projected capabilities.

Default consumers must not need to call package hooks. Advanced hooks may be
exported, but the component API is complete without them.

Do not export a second component named `NajmThemeProvider`; Najm Kit already
uses that name for the rendering runtime. `NThemeSettingsProvider` is the
managed persistence/editor boundary and nests alongside the existing runtime
provider without replacing it.

### Independent components

Provide at minimum:

```text
NThemeAppearanceSettings
NThemeBrandingSettings
NThemePresetSettings
NThemeSettingsActions
NThemeSettingsSaveButton
NThemeSettingsResetButton
NThemeSettingsStatus
NThemeSettings
```

Component rules:

- No component creates its own provider or query client silently.
- All sections share one provider draft and revision state.
- Theme, Branding, and Presets work alone when their dependencies are enabled.
- `NThemeSettingsActions` coordinates only enabled dirty resources.
- Appearance and branding save independently unless the consumer explicitly
  requests a coordinated action surface; one failure must not pretend the
  other resource rolled back.
- Preset selection previews in memory and persists only through an explicit
  save/apply action defined by the contract.
- Components accept `className`, label overrides, disabled state, and
  capability-aware presentation options.
- Hiding a control is never the authorization boundary.

### Composition examples

Custom tabbed sheet:

```tsx
<NThemeSettingsProvider client={themeClient} features={features}>
  <NSheet open={open} onOpenChange={setOpen}>
    <NTabs items={tabs}>
      <NThemeAppearanceSettings />
      <NThemeBrandingSettings />
      <NThemePresetSettings />
    </NTabs>
    <NThemeSettingsActions />
  </NSheet>
</NThemeSettingsProvider>
```

Standalone page:

```tsx
<NPageLayout>
  <NThemeSettingsProvider client={themeClient} features={features}>
    <NThemeSettings />
  </NThemeSettingsProvider>
</NPageLayout>
```

Single feature in a dialog:

```tsx
<NThemeSettingsProvider client={themeClient} features={{ branding: true }}>
  <NDialog>
    <NThemeBrandingSettings />
    <NThemeSettingsActions />
  </NDialog>
</NThemeSettingsProvider>
```

### Accessibility and localization

- Ship en/fr/ar/es keys with parity tests.
- Support consumer label overrides without requiring a fork.
- Announce save, reset, upload, conflict, error, and retry states.
- Restore focus when dialogs or sheets close.
- Confirm destructive reset and preset deletion.
- Keep keyboard access for every customizer and asset action.
- Verify RTL layout, logical spacing, tab order, previews, and action bars.
- Respect reduced motion and do not use animation to communicate state alone.

## 12. Server-render bootstrap

`najm-theme/server/react` wraps the existing Najm Kit loader; it does
not implement another cache.

Proposed consumer facade:

```ts
import "server-only";

import { createReactThemeBootstrap } from "najm-theme/server/react";

const serverTheme = createReactThemeBootstrap({
  fetcher: async (path) => server.fetch(new Request(`http://internal${path}`)),
  factory,
  basePath: "/api/theme",
  onDiagnostic,
});

export const loadServerTheme = serverTheme.load;
export const loadServerAppearance = serverTheme.loadAppearance;
export const loadServerBranding = serverTheme.loadBranding;
```

Rules:

- The application creates the adapter once at module scope. That small facade
  is intentional and cannot be replaced by a package-global singleton because
  fetcher, factory values, diagnostics, and request identity are app-owned.
- Root, auth, first-login, and nested layouts share one snapshot per render.
- Separate requests never share snapshots or transient fallbacks.
- Do not use a module `Map`, module promise, `unstable_cache`, Next `use cache`,
  Redis, or durable cache for this contract.
- Appearance and branding fall back independently.
- Saving updates client providers immediately; a refresh or later navigation
  observes the next server snapshot.
- Server entries must pass a Next.js 16 production fixture and client-import
  guard test.

## 13. Consumer boundary after migration

### Allowed consumer integration

```text
server/theme.ts              plugin configuration and guards
database/schema.ts           spread dialect themeSchema
lib/serverTheme.ts           one RSC module singleton
providers/AppProviders.tsx   mount NThemeSettingsProvider/NajmAppProvider
settings page/sheet          compose exported package components
migration                    one-time legacy data transfer
translations                optional product label overrides
```

### Forbidden consumer duplication

```text
appearanceController/Service/Repository/Dto/Validator
brandingController/Service/Repository/Dto/Validator
themePresetController/Service/Repository/Dto/Validator
appearanceApi / brandingApi / themePresetApi
appearanceKeys / brandingKeys / themePresetKeys
useAppearance / useBranding / useThemePresets
BrandingEditor context
asset candidate/orphan cleanup logic
optimistic revision comparison logic
theme preset slug generation
package-owned locale messages
```

An application-specific adapter is acceptable only when it translates a real
host contract. It must not reproduce a package algorithm or become a permanent
compatibility layer without an explicit removal issue.

## 14. Implementation moves

### Move 0 - freeze the shared contract from two consumers

Repos: Najm, Kafil, School.

- [ ] Record the exact Kafil appearance DTO, editable-field policy, theme
  preset behavior, four branding projections, asset formats, limits, revision
  semantics, audits, and browser consumers.
- [ ] Complete the pending Kafil branding/appearance reference acceptance
  needed to distinguish correct behavior from merely present source code.
- [ ] Record School's provider tree, settings schema, `schoolLogo` consumers,
  theme-mode behavior, SQLite schema composition, authorization, storage, and
  desired settings placement.
- [ ] Decide which standard branding slots School enables and how legacy
  `schoolLogo` maps without leaving two sources of truth.
- [ ] Record the genuine shared intersection and every app-owned difference.
- [ ] Freeze route names, DTO names, slot contract, dialect scope, audit event
  names, and built-in preset deletion policy in an API design note.
- [ ] Verify the `najm-theme` registry name immediately before implementation;
  if unavailable, stop for a naming decision instead of publishing a lookalike.

Gate:

- [ ] Both consumers can be expressed through configuration without package
  imports from either application.
- [ ] No unresolved data, authorization, storage, or provider-tree assumption
  remains in the public API.

### Move 1 - scaffold `packages/najm-theme`

Repo: Najm.

- [ ] Add the workspace with ESM-only package metadata, `dist`-only files,
  README, changelog, TypeScript configs, tsup build, clean, lint, and test
  scripts.
- [ ] Add the explicit export map and client/server boundary guards.
- [ ] Add `najm-theme` paths and project references to root TypeScript config.
- [ ] Add `najm-theme` after `najm-kit` in `PACKAGE_TARGETS` and test order.
- [ ] Add root `build:theme`, `test:theme`, `pub:theme`, and dry-run support
  through the existing publication script.
- [ ] Do not re-export `najm-theme` from `najm-api` in the first release; it is
  optional and includes React-capable subpaths.
- [ ] Add public API snapshot coverage for every exported subpath.

Gate:

- [ ] Empty package builds, packs, and resolves each subpath under Node, Bun,
  TypeScript, browser, and `react-server` conditions without cross-entry leaks.

### Move 2 - implement contracts, validation, and schemas

Repo: Najm.

- [ ] Implement universal appearance, branding, preset, revision, scope,
  capability, diagnostic, and configuration types.
- [ ] Reuse `NajmDesignConfig` and the server-safe Najm Kit parser; do not add a
  second general design model.
- [ ] Port Kafil's CSS-safety and payload-size requirements into a configurable
  package validator without importing Kafil constants or paths.
- [ ] Implement safe editable-field merging and changed-group calculation.
- [ ] Implement positive revision DTOs and Unicode-safe preset slugs.
- [ ] Implement standard branding slots plus validated custom slots.
- [ ] Add PostgreSQL and SQLite schemas with equivalent constraints and
  feature-specific plus combined schema exports.
- [ ] Add pure tests for invalid CSS, unknown keys, oversized payloads,
  revisions, slugs, slot inheritance, factory failure, and JSON round trips.

Gate:

- [ ] Contracts are server/client safe, dialect schemas match, and neither
  Kafil nor School appears in source or built artifacts.

### Move 3 - implement persistence and backend domain services

Repo: Najm.

- [ ] Implement dialect repository bindings and DI tokens.
- [ ] Implement appearance get/save/replace/reset with independent factory
  fallback and expected-revision locking.
- [ ] Implement preset list/create/apply/delete with scope isolation, limit,
  validation, and appearance transaction coordination.
- [ ] Implement branding public/admin projections, save/reset, slot fallback,
  and revision locking.
- [ ] Implement structured diagnostics and safe audit events.
- [ ] Implement the `theme()` plugin with explicit features, guards,
  dependencies, scope, paths, and configuration validation.
- [ ] Implement thin REST controllers and optional MCP tools.
- [ ] Add role/guard denial tests and prove public projections omit admin and
  storage fields.
- [ ] Add real PostgreSQL and SQLite concurrency tests: two writes from one
  revision allow exactly one commit.

Gate:

- [ ] Services pass pure, controller, plugin, dialect, authorization,
  transaction, conflict, projection, and audit tests.

### Move 4 - implement branding asset lifecycle

Repo: Najm.

- [ ] Integrate through `najm-storage` rather than direct filesystem calls.
- [ ] Implement candidate upload, detected MIME validation, decoding,
  normalization, immutable naming, and slot-specific limits.
- [ ] Implement referenced-only public delivery with exact MIME and immutable
  cache headers.
- [ ] Implement post-commit replacement cleanup, draft cancellation cleanup,
  and grace-period orphan reconciliation.
- [ ] Prove path traversal, invalid filename, MIME mismatch, oversized file,
  decompression/dimension abuse, cross-scope reference, and committed-file
  deletion are rejected.
- [ ] Test local and database storage providers where supported.
- [ ] Inspect packed output so optional Sharp behavior and native dependency
  expectations are documented and deployable.

Gate:

- [ ] Upload-to-runtime delivery works without exposing storage internals, and
  cleanup cannot delete a committed or factory asset.

### Move 5 - implement React transport and composable UI

Repo: Najm.

- [ ] Implement one typed client with configurable base URL and auth headers.
- [ ] Implement package-owned query keys, queries, mutations, invalidation,
  conflicts, retries, and error normalization.
- [ ] Implement `NThemeSettingsProvider` and its resource-scoped draft state.
- [ ] Implement independent Appearance, Branding, Presets, Actions, and Status
  components using Najm Kit primitives only.
- [ ] Implement the composite `NThemeSettings` view without making it the only
  supported layout.
- [ ] Connect appearance previews to `useNajmDesignEditor` and branding commits
  to `useNBrandingEditor`.
- [ ] Ensure preset preview is in-memory and does not mutate persistence until
  the explicit command.
- [ ] Add en/fr/ar/es catalogs and parity tests.
- [ ] Build and verify package CSS instead of trusting runtime class strings.
- [ ] Add DOM tests for standalone, tabs, sheet, dialog, partial-feature,
  conflict, upload, cancel, save, reset, error, keyboard, and RTL behavior.

Gate:

- [ ] A test consumer composes every section in different containers without
  local hooks or feature state and receives identical behavior.

### Move 6 - integrate RSC, Theme Studio, and Playground

Repo: Najm.

- [ ] Implement `najm-theme/server/react` by configuring, not duplicating, the
  Najm Kit RSC bootstrap.
- [ ] Add browser-condition client guards and a Next.js 16 production fixture.
- [ ] Extend `apps/theme-studio` with a managed-package mode covering live
  appearance, presets, standard and custom branding slots, partial features,
  and composition examples.
- [ ] Keep Theme Studio project/style persistence distinct from the consumer
  runtime package database; do not silently replace one product with the
  other.
- [ ] Add the plugin and both dialect schemas to the real Playground integration
  harness with explicit storage and guards.
- [ ] Prove root and nested RSC reads share one request snapshot and later
  requests retry transient failures.
- [ ] Prove client bundles contain no controller, Drizzle, Sharp, filesystem,
  or `server-only` code.

Gate:

- [ ] Theme Studio, Playground, RSC tests, Next 16 build, and bundle-isolation
  checks all pass.

### Move 7 - documentation, release audit, and publication

Repo: Najm.

- [ ] Document installation, plugin order, dialect schemas, migrations,
  storage, guards, scopes, factory values, routes, MCP, RSC singleton usage,
  provider mounting, component composition, localization, and failure modes.
- [ ] Document complete, Appearance-only, Branding-only, Presets-disabled,
  page, sheet, dialog, and tabs examples.
- [ ] Add a migration guide from a local theme/branding implementation.
- [ ] Add changelog and API snapshot entries.
- [ ] Run focused and full Najm gates at one clean candidate commit.
- [ ] Inspect built JavaScript, declarations, CSS, export map, package files,
  dependency directions, optional native dependencies, and secret scan.
- [ ] Run `bun scripts/publish-package.ts najm-theme --dry-run` and inspect the
  exact tarball.
- [ ] Prepare the version through the repository's version workflow.
- [ ] Publish only after explicit user authorization.
- [ ] Verify registry version, dist-tag, tarball exports, declarations, and
  source commit before consumer adoption.

Najm candidate gate:

```bash
bun run --cwd packages/najm-theme lint
bun run --cwd packages/najm-theme test
bun run --cwd packages/najm-theme build
bun run lint:ui
bun run test:ui
bun run build:ui
bun run build:theme-studio
bun run api:check
bun run build
bun run test:seq
bun scripts/publish-package.ts najm-theme --dry-run
```

Do not invent a root lint command beyond the package-specific scripts added by
this move.

### Move 8 - migrate Kafil first

Repo: `C:\Users\hdevlop\Desktop\kafil`.

- [ ] Schedule the adoption in Kafil's authoritative root `PLAN.md` before its
  final branding acceptance gate closes.
- [ ] Install the exact published `najm-theme` and compatible `najm-kit`
  versions through Bun overrides, manifests, and lockfile.
- [ ] Add the PostgreSQL package schema to Kafil's composition-only schema.
- [ ] Generate a new Kafil migration; never edit deployed appearance,
  branding, or preset migrations.
- [ ] Migrate Kafil design config, appearance revision, branding custom paths,
  branding revision, theme presets, built-in markers, creator attribution, and
  timestamps into package tables without changing Kafil-only settings.
- [ ] Configure Kafil factory `theme.json`, factory assets, four standard slots,
  admin guards, storage namespace, diagnostics, audit sink, and MCP support.
- [ ] Add temporary compatibility routes only if required for a staged rollout;
  record their removal and keep one authoritative write path.
- [ ] Replace Kafil local controllers, services, repositories, DTOs, validators,
  API clients, query keys, hooks, branding context, and preset orchestration
  with package registration and components.
- [ ] Reduce `uiResources.ts` to genuine Kafil configuration or delete it.
- [ ] Keep one small module-level `serverLoader.ts` facade for request identity.
- [ ] Compose package components inside Kafil's existing global settings sheet
  and `/operator/settings` surface without changing Kafil app-setting tabs.
- [ ] Preserve immediate runtime preview/commit behavior in sidebar, auth,
  first-login, charts, and every branding consumer.
- [ ] After data verification and rollback-window approval, remove obsolete
  Kafil columns/tables only in a later migration, never in the initial cutover.

Kafil gate:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run db:generate
bun run test:db
bun run --cwd apps/web test:e2e
```

- [ ] Browser-test desktop, tablet, phone, keyboard, light/dark, all four
  locales, Arabic RTL, save, preview, reload, reset, preset lifecycle, upload,
  replace, clear, restart, conflict, missing asset, and transient failure.
- [ ] Verify the old local feature files are gone and no second source of truth
  remains.

### Move 9 - migrate School as the second consumer

Repo: `C:\Users\hdevlop\Desktop\school`.

- [ ] Read School's current `AGENTS.md`, Najm command guide, active plan, dirty
  worktree, and installed contracts immediately before implementation.
- [ ] Upgrade School from its current old Najm Kit baseline to the exact
  compatible published version in a bounded prerequisite slice.
- [ ] Preserve School's personal `light | dark | system` preference while
  introducing platform design as a separate source.
- [ ] Add the SQLite package schema and generate a new School migration.
- [ ] Map `schoolLogo` once into the selected standard branding slots; remove it
  as an independent runtime branding source after verification.
- [ ] Keep academic, notification, security, language, time zone, date/time,
  currency, backup, and database settings School-owned.
- [ ] Register package capabilities through School administrator guards and
  configure School storage, factory design, assets, diagnostics, and audit.
- [ ] Mount package components inside School's settings layout in the desired
  tabs/sections without copying Kafil's sheet.
- [ ] Seed the School root provider from the package server snapshot and remove
  redundant design/branding wrappers only when the package owns their behavior.
- [ ] Add focused backend, frontend, SQLite, production-build, and browser
  tests matching Kafil's valid, conflict, fallback, refresh, storage, and
  request-isolation cases.

School gate:

```bash
bun run lint
bun run test:server
bun run test:dashboard
bun run build:all
bun run db:generate
bun run db:check
```

- [ ] Record any additional commands required by School's active plan at
  implementation time.
- [ ] Prove School contains no copied Kafil feature module, hook, API client,
  branding context, or revision logic.

### Move 10 - stabilize future-consumer DX

Repos: Najm and a future-app template if one exists.

- [ ] Compare the Kafil and School integrations and remove only configuration
  friction that is genuinely shared.
- [ ] Add a CLI scaffold only after both consumers prove the file set and
  configuration contract stable.
- [ ] The scaffold may create registration, schema composition, RSC facade, and
  provider mounting files; it must import package behavior, not copy it.
- [ ] Document an upgrade and deprecation policy for routes, DTOs, slots,
  schemas, and component props.
- [ ] Require compatibility tests against the oldest supported `najm-kit`,
  React, Next.js, Drizzle, PostgreSQL, and SQLite versions.
- [ ] Do not declare `1.0.0` until two real consumers pass production-build,
  database, browser, upgrade, and rollback acceptance.

## 15. Verification matrix

| Surface | Required evidence |
|---|---|
| Contracts | type tests, parser tests, payload limits, public API snapshot |
| Appearance | merge, replace, reset, fallback, changed groups, concurrency |
| Presets | Unicode slug, scope uniqueness, limit, CRUD, apply conflict |
| Branding | slot registry, inheritance, admin/public projections, revisions |
| Assets | MIME detection, decode, normalize, serve, cache, cleanup, traversal |
| Authorization | public-read choice, every mutation denial, scope isolation |
| Audit | action, actor, scope, safe metadata, transaction behavior |
| PostgreSQL | schema, migration composition, locking, rollback, concurrency |
| SQLite | schema parity, transactions, revisions, migration composition |
| React | provider, partial features, drafts, invalidation, conflicts, retries |
| Composition | page, tabs, sheet, dialog, standalone, custom action placement |
| RSC | shared render snapshot, request isolation, retry, client import guard |
| UI quality | mobile, desktop, keyboard, focus, RTL, localization, reduced motion |
| Packaging | JS, declarations, CSS, exports, tarball, no cross-entry contamination |
| Consumers | Kafil full gate first, School full gate second, no copied feature code |

## 16. Migration and rollback safety

- Consumer migrations first copy data into package tables; they do not drop
  legacy columns or tables in the same release.
- During cutover, exactly one write path is authoritative. Compatibility reads
  may fall back temporarily, but dual writes require a separately reviewed
  transactional bridge and must have a removal date.
- Before switching reads, compare legacy and package projections for every
  scope, revision, preset, custom asset, and resolved fallback.
- Preserve original revisions where valid so in-flight clients fail with a
  clean conflict rather than silently overwriting.
- Keep legacy data through one accepted production rollback window.
- Rollback means reverting application reads/writes to legacy code while the
  untouched legacy data remains available; do not require destructive reverse
  migration.
- Package storage paths must remain readable during rollback, and cleanup jobs
  must be disabled until the cutover is accepted.
- Drop legacy data only in a later explicitly approved migration after backups,
  restore rehearsal, production observation, and consumer-specific sign-off.

## 17. Definition of done

`najm-theme` is complete only when all of the following are true:

- [ ] The package is published from a clean, verified Najm commit with all
  declared exports, declarations, CSS, and files present in the registry
  tarball.
- [ ] Backend and React entries are isolated; client bundles contain no server
  implementation or native storage code.
- [ ] Appearance, Presets, Branding, and Asset Uploads can be enabled
  independently within their dependency rules.
- [ ] Consumers can compose sections in pages, tabs, sheets, dialogs, or
  standalone views without local feature hooks.
- [ ] PostgreSQL and SQLite pass schema, transaction, conflict, and migration
  tests.
- [ ] Public projections, guards, scope isolation, audit metadata, and storage
  delivery pass security tests.
- [ ] Kafil consumes the published package, passes its complete local,
  PostgreSQL, production-build, and browser gates, and contains no duplicate
  feature implementation.
- [ ] School consumes the same published package, passes its complete local,
  SQLite, production-build, and browser gates, and contains no copied Kafil
  implementation.
- [ ] Factory values, permissions, storage configuration, scope, placement, and
  one-time migrations are the only material consumer-owned integration.
- [ ] Najm publication, Kafil adoption, School adoption, GitHub states, and
  deployments are reported separately as pass/fail outcomes.

## 18. Execution order

| Move | Repository | Dependency | Completion boundary |
|---|---|---|---|
| 0 - contract freeze | Najm, Kafil, School | current source audit | two-consumer API decision |
| 1 - package scaffold | Najm | Move 0 | exports and build isolation |
| 2 - contracts/schemas | Najm | Move 1 | pure and dialect tests |
| 3 - backend domain | Najm | Move 2 | REST/MCP/concurrency/security |
| 4 - asset lifecycle | Najm | Moves 2-3 | storage and cleanup acceptance |
| 5 - React package | Najm | Moves 2-4 | composable UI and state tests |
| 6 - integrations | Najm | Moves 3-5 | Theme Studio, Playground, Next 16 |
| 7 - publication | Najm | Moves 1-6 | verified registry artifact |
| 8 - Kafil adoption | Kafil | Move 7 | full Kafil gate and browser evidence |
| 9 - School adoption | School | Moves 7-8 | full School gate and browser evidence |
| 10 - future DX | Najm | Moves 8-9 | stable docs/scaffold policy |

Do not copy Kafil implementation into School as an intermediate shortcut. Do
not consume unpublished Najm workspace source from either application. Do not
mark any move complete from source inspection alone.
