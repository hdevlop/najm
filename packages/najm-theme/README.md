# najm-theme

Managed runtime theming for Najm applications: platform appearance, named theme
presets, and branding assets — with the persistence, transport, and settings UI
already written.

An application installs this when it wants administrators to change how the
platform looks *at runtime*. What it supplies is configuration: the design it
ships with, the paths to its built brand assets, who may change them, and where
the sections appear. What it does not supply is a controller, a service, a
repository, a DTO, a validator, a query key, an API client, a hook, an editor
context, an upload cleanup job, or revision-conflict logic. Those live here.

> **Status: 0.1.0, pre-release.** The public API is not frozen. It reaches 1.0.0
> when two real consumers have passed production-build, database, browser,
> upgrade, and rollback acceptance — see [Compatibility](#compatibility).

---

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [What each entry is for](#what-each-entry-is-for)
- [Configuration](#configuration)
- [Database](#database)
- [Routes](#routes)
- [Branding slots](#branding-slots)
- [Assets and storage](#assets-and-storage)
- [Revisions and conflicts](#revisions-and-conflicts)
- [React](#react)
- [Server rendering](#server-rendering)
- [Localization](#localization)
- [MCP](#mcp)
- [Optional peers](#optional-peers)
- [Migrating from a local implementation](#migrating-from-a-local-implementation)
- [Failure modes](#failure-modes)
- [Compatibility](#compatibility)

---

## Install

```bash
bun add najm-theme
```

Peers, all optional except the ones a feature actually needs:

| Package | Needed when |
|---|---|
| `najm-kit` | always — this package builds on its design runtime and primitives |
| `drizzle-orm` | always — the schemas are Drizzle tables |
| `najm-storage` | `features.assetUploads` |
| `najm-mcp` | `features.mcp` |
| `@tanstack/react-query` | using `najm-theme/react` |
| `react`, `react-dom` | using `najm-theme/react` |
| `next` | using `najm-theme/server/react` |
| `sharp` | optional — see [Assets and storage](#assets-and-storage) |

---

## Quick start

Three files. Nothing else in the application changes.

**1. Compose the schema** — `src/server/database/schema.ts`

```ts
import { themeSchema } from "najm-theme/pg"; // or najm-theme/sqlite

export const schema = { ...appSchema, ...themeSchema };
```

Then generate a migration with your normal workflow. This package never issues
`CREATE TABLE` at runtime.

**2. Register the plugin** — `src/server/theme.ts`

```ts
import { theme } from "najm-theme/server";
import { themeSchema } from "najm-theme/pg";
import { canManageTheme } from "./guards";
import { factoryDesign, factoryBranding } from "./factory";

export const themePlugin = () =>
  theme({
    features: {
      appearance: true,
      branding: true,
      presets: true,
      assetUploads: true,
      mcp: false,
    },
    dialect: "pg",
    schema: themeSchema,
    publicRead: true,
    factory: { appearance: () => factoryDesign, branding: factoryBranding },
    guards: {
      manageAppearance: [canManageTheme()],
      manageBranding: [canManageTheme()],
      managePresets: [canManageTheme()],
    },
  });
```

Register it after `database()`, and after `storage()` when `assetUploads` is on:

```ts
new Server()
  .use(database({ schema }))
  .use(storage({ guards: [isAuth()] }))
  .use(themePlugin())
  .base("/api");
```

**3. Mount the UI** — anywhere in the application

```tsx
"use client";

import { NThemeSettings, NThemeSettingsProvider } from "najm-theme/react";
import "najm-theme/styles.css";

export function ThemeSettingsPage() {
  return (
    <NThemeSettingsProvider client={{ baseUrl: "/api/theme" }}>
      <NThemeSettings />
    </NThemeSettingsProvider>
  );
}
```

---

## What each entry is for

```text
najm-theme            universal contracts and pure helpers
najm-theme/contracts  the same surface, named explicitly
najm-theme/server     the plugin, its configuration, the audit and error types
najm-theme/server/react  the React Server Component bootstrap adapter
najm-theme/pg         PostgreSQL Drizzle tables
najm-theme/sqlite     SQLite Drizzle tables
najm-theme/react      providers, transport, and composable components
najm-theme/styles.css package-owned styles, on top of najm-kit/theme.css
```

Two rules hold across the map, and both are enforced by tests:

- **No client-capable entry statically imports a server entry.** The `browser`
  condition of `najm-theme/server/react` resolves to a module that throws, so a
  Client Component importing it fails at build time rather than shipping the
  application's internal fetcher to a browser.
- **No server entry imports the `najm-kit` root barrel.** That barrel reaches
  the whole component library; importing it from a route handler resolves
  `react-hook-form` under the `react-server` condition and fails the build.
  Server code uses `najm-kit/server`.

---

## Configuration

```ts
interface NajmThemePluginConfig {
  features: {
    appearance: boolean;
    branding: boolean;
    presets: boolean;      // requires appearance
    assetUploads: boolean;  // requires branding and najm-storage
    mcp: boolean;
  };
  database?: string;                 // named database, default "default"
  dialect?: "pg" | "sqlite";         // default "pg"
  schema: ThemeSchema;               // the tables you composed
  basePath?: string;                 // default "/theme"
  scope?: ThemeScopeResolver;        // default: everything is "platform"
  publicRead: boolean;               // required, no default
  factory: {
    appearance?: () => NajmDesignConfig;
    branding?: () => FactoryBranding;
  };
  brandingSlots?: BrandingSlotDefinition[];  // default: the four standard slots
  guards: ThemeRouteGuards;
  storage?: ThemeStorageConfig;
  audit?: ThemeAuditSink;
  diagnostics?: ThemeDiagnosticSink;
  limits?: ThemeLimits;
  resolveActorId?: (user: unknown) => string | null;
}
```

Rules the plugin enforces at registration, not at first request:

- **`features` is required and every flag is explicit.** A default either way
  would mean a typo silently adds or removes a feature.
- **Every enabled mutation needs guards.** A missing `manageAppearance`,
  `manageBranding`, or `managePresets` fails registration.
- **`publicRead` has no default.** `true` serves appearance and branding to
  anonymous visitors, which is what a sign-in page needs. `false` requires
  `guards.readAppearance` and `guards.readBranding`. Either is a decision about
  what leaves the building, so the package will not make it for you.
- **Presets are never public.** `publicRead` does not reach them; listing them
  falls back to `guards.managePresets` unless you pass `guards.readPresets`.
- **Factory values are required only for enabled resources**, and are called per
  read. Their failure is *not* caught: a factory theme that cannot be built is a
  broken build, and a second fallback would hide it behind a page that merely
  looks unstyled.
- **Limits may be widened only within package maxima.** A design is parsed on
  every uncached server render, so an unbounded one is a denial-of-service
  vector against the application itself.

### Scope

Every row is keyed by a scope. A single-platform application never thinks about
it — the default resolver answers `"platform"`. An application that later grows
tenants supplies its own resolver and no table, index, or route changes:

```ts
scope: async ({ request }) => resolveTenantFromHost(request.headers.get("host")),
```

Scope identifiers are validated before they reach a query, a storage namespace,
or a URL. That validation is what stops a resolver returning `"../other"` from
becoming a cross-tenant read.

---

## Database

Three tables, exported per feature and as a convenience composition:

```ts
import {
  appearanceSchema,   // najm_theme_appearance
  brandingSchema,     // najm_theme_branding
  themePresetSchema,  // najm_theme_presets
  themeSchema,        // all three
} from "najm-theme/pg";
```

An application that enables only Appearance spreads `appearanceSchema` and gets
one table rather than two it never writes to.

`najm-theme/pg` and `najm-theme/sqlite` are column-for-column equivalent — same
names, nullability, constraints, indexes, and public behaviour. A parity test
compares the two definitions structurally, so drift fails in CI rather than in
whichever consumer picked the other database.

Notable columns:

| Column | Why it is like that |
|---|---|
| `design_config` nullable | `null` means "on the factory design" — a real state, distinct from an empty design and from a missing row. Reset writes it deliberately. |
| `revision` positive int | Increments by exactly one per committed mutation; a check constraint keeps it positive in both dialects. |
| `updated_by_actor_id` text | No foreign key to an auth table. Attribution stays available when `najm-auth` is installed without making auth mandatory, and a deleted user does not cascade a scope's theme away. |
| `slot_config` JSON | Custom managed references only. Inherited and factory values resolve at read time, so shipping a new default logo changes every scope that has not overridden it. |

---

## Routes

Below `basePath` (default `/theme`):

```text
GET    /theme/appearance                       public read
GET    /theme/appearance/config                administrative read
PUT    /theme/appearance                       save
POST   /theme/appearance/reset                 restore the factory design

GET    /theme/presets                          list (never public)
POST   /theme/presets                          create
POST   /theme/presets/:id/apply                apply to appearance
DELETE /theme/presets/:id                      delete

GET    /theme/branding                         public read
GET    /theme/branding/config                  administrative read
PUT    /theme/branding                         save the slot map
POST   /theme/branding/reset                   restore the factory assets
POST   /theme/branding/assets/:slot/:fileName  upload a candidate (binary)
GET    /theme/branding/assets/:fileName        serve a committed asset
DELETE /theme/branding/assets/:fileName        discard a candidate
POST   /theme/branding/assets/reconcile        sweep unreferenced assets
```

- Public reads return **only** the resolved values and a revision. No
  provenance, no slot metadata, no storage internals.
- `GET /theme/branding/assets/:fileName` follows the *public read* decision, not
  the management one: it is how a browser fetches the logo on the sign-in page.
- Mutations are named actions, never generic setters. Reset is `POST .../reset`
  rather than `PUT { designConfig: null }`, because a setter that means "discard
  everything" when handed the right value is one that gets called by accident.
- Upload endpoints are REST/binary only. Image bytes never travel as base64 in
  a JSON tool call.

---

## Branding slots

Branding is a registry, not four columns. The package ships four standard slots:

| Key | Kind | Falls back to |
|---|---|---|
| `sidebarLogoExpanded` | logo | factory value |
| `sidebarLogoCollapsed` | logo | inherits `sidebarLogoExpanded` |
| `authLogo` | logo | inherits `sidebarLogoExpanded` |
| `authHeroImage` | hero | factory value |

Resolution order per slot: **managed asset → factory value → declared fallback**.
`inheritFrom` recurses through the same order, which is what makes "upload one
logo and both marks update" true rather than requiring the same file twice.

Registering another slot is configuration in one application and needs no DDL
anywhere:

```ts
brandingSlots: [
  ...STANDARD_BRANDING_SLOTS,
  {
    key: "emailHeader",
    kind: "image",
    labelKey: "app.branding.emailHeader",
    maxBytes: 256 * 1024,
    acceptedMimeTypes: ["image/png"],
    previewAspect: "wide",
  },
],
```

The UI renders it from the server response, so no component changes either. Give
it a label through the provider's `labels` prop or your own catalog.

**SVG is not accepted by default**, and it is the omission most likely to be
questioned. An SVG is a document: it can carry `<script>`, an `<image href>`
that phones home, and an XML external entity, and served from your own origin as
a top-level document it runs with your origin's privileges. Accepting one safely
means parsing and sanitizing it. An application that has done that work can add
`image/svg+xml` to its own slot definition.

---

## Assets and storage

Uploads go through `najm-storage`, into a namespace scoped per scope
(`theme-branding-<scopeId>`), so one tenant cannot reference another's file at
the storage layer rather than through a check that has to be right every time.

The lifecycle has one rule that shapes all of it: **the database decides what is
real.** A file exists in storage from the moment it is uploaded, but it is only
a branding asset once a committed `slot_config` row references it. So:

- the file write always precedes the commit;
- every file delete always follows one;
- nothing unlinks inside a database transaction.

That ordering makes the failure modes survivable. An upload that is never saved
leaves an unreferenced file, which reconciliation collects. A save that commits
and then fails to delete what it replaced leaves an unreferenced file — same
outcome, and the save stays durable. The reverse order would leave a committed
row pointing at a file that no longer exists: a broken logo on every page that
nobody can fix from the settings screen, because the row looks fine.

**Validation, in order:** byte ceiling → magic-byte probe → declared type must
agree with the bytes → slot accepts that type → dimension and pixel bounds →
optional normalization → byte ceiling again on what will actually be stored.
The dimension check reads the header, so a 40 KB PNG claiming 30000×30000 is
rejected without allocating the 3.6 GB it wanted.

**Normalization** re-encodes through Sharp when it is installed. That is what
turns "the magic bytes say PNG" into "this *is* a PNG": a decode/re-encode round
trip drops trailing payloads, malformed ancillary chunks, and embedded metadata
— including the EXIF GPS coordinates in a logo somebody exported from a phone.
Sharp is an optional dependency; without it the probe, the MIME agreement check,
and the dimension bounds still run. Set `storage.normalize: false` to turn it off
explicitly.

**Committed file names are UUIDs**, never the uploader's. They are served with
`Cache-Control: public, max-age=31536000, immutable` and `X-Content-Type-Options:
nosniff`, using the MIME type re-derived from the stored bytes — a client can
name *which* asset a slot uses, never what type it is. Immutable caching is safe
precisely because the name is content-independent: a replacement is a different
URL, so nothing has to expire for it to appear.

**Reconciliation** deletes only files that are both unreferenced *and* older than
`storage.orphanGraceMs` (default 24 hours, minimum 1 hour). Both conditions are
load-bearing: unreferenced alone would delete the upload an administrator made
ninety seconds ago and is about to save, and old alone would delete the logo on
every page. Factory assets live in your build output, not in this namespace, and
are never reachable by any of it.

---

## Revisions and conflicts

Appearance and branding each carry a revision that increments by exactly one per
committed mutation. A client sends back the revision it was editing, and the
write commits only if that is still current.

Two administrators with the settings sheet open is the normal case, not the
exotic one. Without a revision the second save silently discards the first —
including a preset the first one just applied. With it, the second save answers
`409` with code `THEME_REVISION_CONFLICT`, and the UI offers a reload.

The revisions are **separate**: replacing a logo has nothing to do with editing a
colour token, and one shared counter would make each mutation invalidate the
other's open editor.

Every write is a compare-and-swap — the expected revision is in the `WHERE`
clause — on top of a `SELECT … FOR UPDATE` on PostgreSQL. The compare-and-swap
is what makes the guarantee hold at any isolation level and in both dialects; the
row lock just moves the contention to the read.

Applying a preset takes `expectedRevision` and goes through the same appearance
lock as a save. Giving it a weaker story would make it the way to clobber
somebody.

---

## React

### Provider

`NThemeSettingsProvider` owns the whole feature state machine: queries, canonical
query keys, mutations, drafts, dirty tracking, candidate uploads, revision
conflicts, cache invalidation, and the immediate hand-off to Najm Kit's runtime
providers so an edit is visible before it is saved.

It is deliberately **not** called `NajmThemeProvider` — Najm Kit already owns
that name for the rendering runtime. The two are different objects: the kit's
decides what the page looks like right now, this one decides what gets
persisted. This nests inside it and replaces nothing.

```tsx
<NThemeSettingsProvider
  client={{ baseUrl: "/api/theme" }}
  language="fr"
  labels={{ "theme.settings.title": "Apparence" }}
  initialData={serverSnapshot}
  onPersisted={() => router.refresh()}
>
  {children}
</NThemeSettingsProvider>
```

Requires a `QueryClientProvider` above it. Default consumers never call a hook
from this package; `useNThemeSettings` is exported for a surface you build
yourself.

### Components

```text
NThemeAppearanceSettings   NThemeSettingsActions      NThemeSettingsStatus
NThemeBrandingSettings     NThemeSettingsSaveButton   NThemeSettings
NThemePresetSettings       NThemeSettingsResetButton
```

- No component creates its own provider or query client.
- All sections share one provider's draft and revision state.
- Each works alone when its dependencies are enabled, and renders nothing when
  they are not — including outside a provider entirely.
- Appearance and branding save as **independent requests**. A branding failure is
  never reported as though the appearance save had rolled back, when it
  committed and is live.
- Preset selection previews in memory; nothing persists until an explicit apply.
- Every component takes `className`, label overrides, and a `disabled` prop.
- **Hiding a control is never the authorization boundary.** Capabilities drive
  presentation; the guard on the route decides.

### Composition

A custom tabbed sheet:

```tsx
<NThemeSettingsProvider client={themeClient}>
  <NSheet open={open} onOpenChange={setOpen} icon={Palette} title="Theme">
    <NTabs items={tabs} />
    <NThemeSettingsActions />
  </NSheet>
</NThemeSettingsProvider>
```

A standalone page:

```tsx
<NPageLayout>
  <NThemeSettingsProvider client={themeClient}>
    <NThemeSettings />
  </NThemeSettingsProvider>
</NPageLayout>
```

One feature in a dialog:

```tsx
<NThemeSettingsProvider client={themeClient} features={{ branding: true }}>
  <NDialog open={open} onOpenChange={setOpen} title="Branding">
    <NThemeBrandingSettings />
    <NThemeSettingsActions resources={["branding"]} />
  </NDialog>
</NThemeSettingsProvider>
```

`features` on the provider **narrows** what a page shows. It can never widen past
what the backend registered — the routes behind it would not exist.

### Styles

```css
@import "najm-kit/theme.css";
@import "najm-theme/styles.css";
```

A Tailwind v4 source file, compiled by your build. It carries a `@source`
directive so the utilities this package's components use survive that build.
Layout uses logical properties throughout, so the surface mirrors under
`dir="rtl"` without a second stylesheet.

---

## Server rendering

`najm-theme/server/react` configures `najm-kit/server/react`; it does not
implement a second cache. One small module in your application owns the fetcher,
the factory values, and the diagnostic sink:

```ts
// src/lib/serverTheme.ts
import "server-only";

import { createReactThemeBootstrap } from "najm-theme/server/react";

const serverTheme = createReactThemeBootstrap({
  fetcher: (path) => server.fetch(new Request(`http://internal${path}`)),
  basePath: "/api/theme",
  factory: { appearance: () => factoryDesign, branding: factoryBranding },
  onDiagnostic: reportThemeDiagnostic,
});

export const loadServerTheme = serverTheme.load;
export const loadServerAppearance = serverTheme.loadAppearance;
export const loadServerBranding = serverTheme.loadBranding;
```

**Call the factory once, at module scope**, in a module the whole app imports.
Calling it inside a layout, a page, or a component builds a fresh memoization
entry per call and shares nothing — which looks like it works and quietly costs
one round trip per component.

That module is the one file this package cannot delete for you, and it is
deliberate: the fetcher, the factory values, and the diagnostic sink are all
application-owned. What it *does* delete is everything that used to sit around it
— the fetch, the envelope unwrap, the validation, the fallback, and the
per-resource independence.

Rules:

- Root, auth, first-login, and nested layouts share **one snapshot per render**.
- Separate requests never share a snapshot or a transient failure; a transient
  outage is retried on the next request.
- Appearance and branding fall back **independently**: a branding outage never
  discards a perfectly good theme.
- Do **not** wrap this in a module `Map`, a module promise, `unstable_cache`,
  `"use cache"`, Redis, or any durable cache. Every one of them leaks one
  visitor's render into another's.
- Saving updates the client providers immediately; a refresh or a later
  navigation observes the next server snapshot.
- React Server Components only. Route handlers, server actions, and scripts have
  no request cache for `cache()` to write into, so they should call the
  endpoints directly.

---

## Localization

English, French, Arabic, and Spanish ship in the package and serve both the API
response messages and the UI labels. A parity test compares every catalog against
English key by key — a missing translation does not fail at runtime, it just
prints English inside an Arabic sheet, which is far easier to ship than to
notice.

Labels resolve in this order:

1. a `labels` override on the provider,
2. the application's own translator (`t`), if it has an entry,
3. the package catalog for the active language,
4. English,
5. the key itself.

The override wins over the translator on purpose: an override is a deliberate,
component-level decision ("call it Branding here"), while a translator is a
catalog it may not even know about.

Contribute the catalogs to `najm-i18n` if you would rather route everything
through your own translator:

```ts
import { THEME_LOCALES } from "najm-theme/server";
```

---

## MCP

With `features.mcp`, the same services are exposed as tools: `theme_appearance_get`,
`theme_appearance_reset`, `theme_presets_list`, `theme_preset_apply`, and
`theme_branding_get`. Register `mcp()` before `theme()`.

Uploads are deliberately absent — a branding image as base64 inside a JSON tool
call is megabytes of encoded bytes through a protocol built for text, in a
transcript that is frequently logged.

Tools operate on the default scope. A tenant-aware installation should leave
`mcp` off until it has decided how an agent names a tenant; silently defaulting
to `platform` in a multi-tenant deployment would be the wrong answer, not a
missing one.

---

## Optional peers

`najm-storage` (for `assetUploads`) and `najm-mcp` (for `mcp`) are the only two
packages this one reaches at runtime without importing. They are resolved from
the container by symbol:

| Peer | Token | Aliased by |
|---|---|---|
| `najm-storage` | `Symbol.for('najm:storage:service')` | `storage()` → `StorageService` |
| `najm-mcp` | `Symbol.for('najm:mcp:registry')` | `mcp()` → `McpRegistryService` |

This is a correctness requirement, not a packaging preference. A class works as
a DI token only while every participant holds the same constructor. This package
ships as `dist`, so `import 'najm-storage'` here resolves through `node_modules`;
an application in a monorepo commonly maps the same specifier to `src`. Those are
two module instances with two constructors of the same name — and resolving the
wrong one **does not fail**. The container builds a second service, and the
symptom arrives much later: uploads written through a storage service the
application never configured, MCP tools registered into a registry nothing
serves. Both were live defects here, found by running the Playground rather than
the unit tests.

`Symbol.for` is keyed by string in a process-wide registry, so every copy
produces the identical symbol, and each plugin aliases its symbol to its own
class. The strings are declared in `src/server/peers.ts` rather than imported —
importing them would load a peer's module graph to read a value whose entire
purpose is to be independent of which copy is loaded — and pinned against the
peers' real exports by `test/server/peers.test.ts`.

If a peer is missing, the error names the feature that required it and the
registration to add. If a peer is present but fails while constructing, its own
error propagates unchanged; this package does not translate it into "plugin not
registered" and send you to inspect a plugin list that is already correct.

---

## Migrating from a local implementation

If your application already has its own appearance/branding/preset modules, the
cutover is a data move, not a rewrite.

1. **Compose the package schema** beside your existing tables and generate a new
   migration. Do not edit deployed migrations.
2. **Copy the data in**: design config, appearance revision, branding custom
   paths, branding revision, presets, built-in markers, creator attribution, and
   timestamps. Preserve the original revisions where valid, so in-flight clients
   fail with a clean conflict rather than silently overwriting.
3. **Do not drop the legacy columns in the same release.** Rollback means
   reverting reads and writes to the legacy code while untouched legacy data
   remains available — not a destructive reverse migration.
4. **Compare projections before switching reads**, for every scope, revision,
   preset, custom asset, and resolved fallback.
5. **Keep exactly one authoritative write path during cutover.** Compatibility
   reads may fall back temporarily; dual writes need a separately reviewed
   transactional bridge and a removal date.
6. **Disable cleanup jobs until the cutover is accepted**, and keep the package's
   storage paths readable throughout the rollback window.
7. **Then delete the local modules.** These specifically should not survive:
   `appearance*`/`branding*`/`themePreset*` controllers, services, repositories,
   DTOs, validators; API clients; query keys; `useAppearance`/`useBranding`/
   `useThemePresets`; the branding editor context; asset candidate and orphan
   cleanup; optimistic revision comparison; preset slug generation; and any copy
   of the package's locale messages.

An application-specific adapter is acceptable only when it translates a real host
contract. It must not reproduce a package algorithm or become a permanent
compatibility layer without an explicit removal issue.

---

## Failure modes

| What happens | What the package does |
|---|---|
| Stored design fails validation | Serves the factory design, keeps the **stored** revision, emits `appearance.invalid-stored-config`. The revision is deliberate: a client editing against it still gets a clean conflict rather than overwriting a row nobody could read. |
| Stored slot map has an unregistered slot | Drops that entry, keeps the page up, emits `branding.invalid-slot-config`. A slot removed in a deploy must not fail every page. |
| A preset's design no longer validates | Omitted from the list with `preset.invalid-design`; applying it is refused. Returning it would hand the client a design that would be rejected at apply. |
| Post-commit asset cleanup fails | The save stays committed; `asset.cleanup-failed` is emitted. Reporting it as a failed request would invite a retry of a mutation that already landed. |
| Audit sink throws (non-transactional) | The mutation stays committed; `audit.sink-failed` is emitted. |
| Factory design or branding throws | **Propagates.** A factory value that cannot be built is a broken build, and the only useful behaviour is a loud one. |

Every diagnostic carries a package-authored summary and a normalized error
string — never a stored value, an uploaded byte, a response body, a cookie, an
authorization header, or a storage credential. The payloads that go wrong here
are exactly the interesting ones, and a log aggregator is not where they belong.

---

## Compatibility

- `najm-kit` ≥ 2.9.0 — this package builds on its published contracts and does
  not move `NajmDesignConfig`, the theme runtime, or any primitive out of it.
  `najm-kit` must never depend on `najm-theme`.
- Node 20+, Bun 1.2+, React 18+, Next.js 14+, Drizzle 0.45+.
- PostgreSQL and SQLite are both first-class and tested for parity.
- **`assetUploads` requires `najm-storage` ≥ 2.2.0, and `mcp` requires
  `najm-mcp` ≥ 2.1.0** — the releases that alias `STORAGE_SERVICE` and
  `MCP_REGISTRY` to their services. The `peerDependencies` ranges enforce this.
  Against an older peer the feature fails at boot with a message naming the
  missing registration — loudly, not silently, but it does not work.

**Versioning.** Pre-1.0 releases may change the public API with a changelog
entry. 1.0.0 is not declared until two real consumers pass production-build,
database, browser, upgrade, and rollback acceptance.

## License

MIT
