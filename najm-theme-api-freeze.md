# najm-theme API Freeze

Status: **FROZEN** for `najm-theme@0.1.x` adoption.

Date: 2026-08-09

Companion to `najm-theme.md` §6-§11. That file states the plan; this file records
the decisions that close Move 0 and the source evidence behind each one.

Inputs:

- `output/pdf/Kafil x najm-theme - Contract Review.pdf` — Kafil's 25-point half
  of the freeze, at Kafil `e1298c5` plus a dirty worktree.
- School source review at School `4abb86d` plus a dirty worktree (this file).
- Kafil live development database read-only audit (this file).
- `najm-theme@0.1.1` source at Najm `85634d2`.

Every "package behavior" claim below was read from package source at that
commit, not inferred from the plan.

---

## 0. Corrections to `najm-theme.md`

Two statements in the plan were wrong and are corrected here. Both change work.

### 0.1 School is PostgreSQL, not SQLite

`najm-theme.md` §3, §9 (Move 9), §15, and §17 describe School as the SQLite
consumer. School is PostgreSQL throughout:

```text
school/drizzle.config.ts:6                      dialect: 'postgresql'
school/packages/server/src/config/index.ts:56   auth    dialect: 'pg'
school/packages/server/src/config/index.ts:95   rag     dialect: 'pg'
school/packages/server/src/config/index.ts:110  chatbot dialect: 'pg'
school/packages/server/package.json:58          postgres 3.4.8
school/.../settings/settingSchema.ts:1          drizzle-orm/pg-core
```

There is no SQLite driver, no `sqlite` dialect declaration, and no SQLite
schema anywhere in School.

Consequences, all of which must be carried into the plan:

- Move 9 must compose `najm-theme/pg`, not `najm-theme/sqlite`.
- **SQLite ships with no real consumer.** Both planned adopters are PostgreSQL.
  `najm-theme.md` §17 requires School to pass "SQLite … gates", which is now
  unsatisfiable as written.
- SQLite parity therefore rests on the package's own dialect tests alone. That
  is a weaker guarantee than the plan assumed and must be stated honestly in
  the release notes rather than implied to be consumer-proven.

Decision: **keep the SQLite dialect, downgrade its claim.** Do not invent a
third consumer to satisfy the matrix, and do not delete working tested code.
`1.0.0` may not claim consumer-proven SQLite support.

### 0.2 School's `schoolLogo` is not a runtime branding source

`najm-theme.md` §3 and Move 9 treat `schoolLogo` as a live branding source
requiring careful migration to avoid "two sources of truth". It has five
references in the entire repository and none of them render anything:

```text
packages/server/src/modules/settings/settingSchema.ts     column definition
packages/server/src/modules/settings/SettingsDto.ts       DTO field
packages/server/src/modules/settings/SettingsRepository.ts persistence
packages/server/src/modules/settings/SettingsService.ts    projection
apps/dashboard/src/lib/validations.ts                      form validation
```

No sidebar, auth layout, or component reads it. It is a stored string with an
admin form field and no consumer.

Consequence: the Move 9 item "remove it as an independent runtime branding
source after verification" describes work that does not exist. The real task is
smaller and different — decide whether the stored value is worth importing at
all (§3.4 below).

---

## 1. Frozen contract decisions

### 1.1 Partial appearance merge behavior

**Package behavior** (`src/contracts/appearance.ts:310-328`): `mergeAppearance`
replaces one root group at a time.

- A group the patch does not mention is preserved. A Typography-only save does
  not need to ship the whole theme back.
- A group the patch does mention is replaced **whole**. Keys absent from the
  submitted group are removed.
- An explicit `undefined` deletes an optional group; `theme` may not be removed.
- `narrowAppearancePatch` rejects unknown keys outright rather than ignoring
  them, so a client sending `version: 2` fails instead of appearing to save.

**Kafil behavior** (`appearanceValidator.ts:311-350`): a curated editable
surface inside `theme`/`components`, preserving unrelated component fields.

**Decision: keep group-level replacement.**

Deep merge cannot express removal — the editor sends a group without a token
and a deep merge puts it back. Group replacement is the only rule under which
"what I see is what is stored" holds.

Requirements this creates:

- `PUT /appearance` is documented as **group replacement, not deep merge**.
- Every Kafil caller submits complete groups. Kafil's current UI already
  submits a full design, so no UI change is forced — but the API semantics
  change and must be tested, not assumed.
- Add a regression test asserting that a `components` patch omitting a key
  removes that key, so the behavior is pinned as intentional.
- Do **not** reintroduce Kafil's sub-field preservation behind an app-only
  adapter. That would be a permanent compatibility layer for a semantic the
  package deliberately rejects.

Note on the contract review's wording: point 24 says a partial payload "can …
remove siblings". The siblings are keys *within* the replaced group. Sibling
*groups* are preserved. The review's classification is right; its phrasing
reads more alarming than the code is.

### 1.2 Duplicate preset name behavior

**Package behavior** (`src/contracts/presets.ts:98-120`): `uniqueThemePresetSlug`
appends `-2`, `-3`, … until free, and falls back to `"preset"` for a name that
slugs to nothing. The pre-check is advisory; the `(scope_id, slug)` unique index
is the guarantee and the service retries on collision.

**Kafil behavior** (`themePresetService.ts:46-82`): duplicate normalized slug
returns HTTP 409.

**Live evidence** (Kafil development database, read-only):

```text
theme_presets: 5 rows
duplicate slugs:            0
duplicate normalized names: 0
```

School has no preset feature at all — no table, no service, no UI.

**Decision: keep suffixing. Do not add a `reject | suffix` option.**

The contract review deferred this pending School. School is now reviewed and
has no presets, and Kafil has zero live rows that ever exercised its 409 path.
Neither consumer depends on rejection in data or in a workflow. Adding a policy
option now would be a configuration surface invented for a hypothetical
consumer, and `najm-theme.md` §6 requires the option set to stay minimal.

Requirements this creates:

- The preset UI must display the **effective** name and slug after creation,
  so an administrator who typed a duplicate sees `Emerald-2`, not a silent
  second `Emerald`.
- Contract tests must cover exact-name collision and normalized-slug collision
  as separate cases (they are separate: `"My Theme"` and `"my  theme"` collide
  on slug but not on name).
- Kafil's 409 handling is deleted with the rest of its preset service. Nothing
  translates it.

Revisit only when a consumer produces a real rejection requirement.

### 1.3 Branding payload and nullable slots

**Package behavior** (`src/contracts/branding.ts:75-115`):

```ts
interface PublicBranding { slots: Record<string, string | null>; revision: number }
interface AdminBranding  { slots: AdminBrandingSlot[]; revision: number;
                           updatedAt: string | null; updatedByActorId: string | null }
```

`AdminBrandingSlot` carries `resolvedPath`, `isCustom`, `inheritedFrom`, and
`uploadedAt`. Filesystem paths, storage credentials, candidate uploads, and
orphan lists have nowhere to appear in either type.

**Kafil behavior**: four required non-null `*Path` properties plus revision.

**Decision: keep the nullable dynamic map. Do not flatten to four fields.**

Kafil configures non-null factory values for its four standard slots, so its
chrome never observes `null` in practice — but consumers read `slots[key]` and
handle `null`, because custom and intentionally-empty slots are the whole point
of the slot registry.

### 1.4 Missing committed assets — **new, not in the contract review**

The review did not compare what happens when a *committed* branding file is
absent from storage. The two systems differ, and Kafil's live database is
already in that state.

**Live evidence** (Kafil development database + `storage/branding`, read-only):

```text
platform_settings (id=platform, appearance_revision=19, branding_revision=13)
  sidebar_logo_expanded_path   NULL                                    factory
  sidebar_logo_collapsed_path  …/c22ca22b-….webp   REFERENCED, ABSENT ON DISK
  auth_logo_path               NULL                                    factory
  auth_hero_image_path         …/4f6e12af-….webp   REFERENCED, ABSENT ON DISK

storage/branding: 8 files, 0 referenced by the database (all orphans)
```

Both referenced assets are missing; every stored file is unreferenced.
`/storage/` is gitignored local development data, so out-of-band cleanup is the
likely cause — this is **not** evidence of a cleanup-ordering bug, and Kafil's
write path explicitly tolerates it (`brandingService.ts:120-140`: a dead
reference in an unrelated slot must not fail a save of the slot being fixed).

**Kafil behavior**: `resolveStoredPath` falls back to the factory image when
the file is missing, so a dead reference renders the factory asset.

**Package behavior**: `resolveBrandingSlots` is pure over `slot_config` and
never stats the filesystem (`BrandingService.ts:120-127`). A committed-but-
missing file resolves to its stored path and the serve route answers 404.

**Decision: keep pure resolution. Handle absence at backfill and in the UI.**

Statting every slot on every read would put a filesystem call on the public
bootstrap path — the hottest read in the system, hit by every anonymous login
render. That cost buys nothing in a healthy installation.

Requirements this creates:

- **Backfill rule**: a legacy path whose bytes are absent is imported as
  **unset**, not as a slot record. The package slot record stores `fileName`,
  MIME, byte count, and upload time derived from actual bytes; those bytes do
  not exist, so there is nothing honest to write. An unset slot resolves to the
  factory asset, which is exactly what Kafil renders today. Observable
  behavior is preserved.
- Count and report skipped slots in the migration output. Do not skip silently.
- The branding UI must render a recoverable state for a 404 asset — localized
  recovery text, never a broken native image icon. This is already required by
  Kafil `PLAN.md` Phase 2; the package must satisfy it too.
- On the two Kafil slots above, backfill will import **zero** slot records and
  Kafil will render factory branding after cutover, matching current behavior.

### 1.5 Supported asset formats

**Package behavior** (`src/server/branding/imageProbe.ts:20`, `:151-167`):
`ProbedMimeType = "image/png" | "image/jpeg" | "image/webp"`. The byte probe
accepts nothing else; `image/jpg` normalizes to `image/jpeg`.

**Kafil behavior** (`managedImages.ts:130-165`): accepts PNG, JPEG, WebP, and
AVIF; explicitly rejects GIF; normalizes successful input to WebP.

**Audit result — the plan's "audit stored GIF/AVIF assets" item:**

Every file in Kafil `storage/branding`, magic-byte verified:

```text
22222222-2222-4222-8222-222222222222.webp        12 B  52494646…57454250  (RIFF/WEBP, truncated stub)
2e256765-82c3-4791-a70c-3ca359b67afd.png  1 756 492 B  89504e47…          PNG
4c8d842a-21ab-4cd0-a764-f41806dfa3e2.png    286 317 B  89504e47…          PNG
6ccaa1d4-251a-46e3-bb2b-2026bfaebd15.jpg     28 709 B  ffd8ffe0…          JPEG
8922e74f-f51a-43f7-8975-630c9df9ad6e.webp    39 622 B  52494646…56503858  WebP
a82504ea-6619-4109-9079-99d37b07425d.png  1 118 268 B  89504e47…          PNG
afdcfa82-d0b4-4d08-80b7-06161ca18700.webp    17 302 B  52494646…56503820  WebP
b53f375a-b60c-4dbe-83ba-29dabd2027a8.webp    39 622 B  52494646…56503858  WebP
```

- **Zero GIF. Zero AVIF.** Not on disk, not referenced by the database.
- Every extension matches its magic bytes. No mislabelled file.
- Both database-referenced assets are `.webp` (and absent — §1.4).
- `8922e74f…` and `b53f375a…` are byte-identical duplicates under different
  UUIDs. Harmless; both are orphans.
- `22222222-…-222222222222.webp` is a 12-byte RIFF/WEBP header with no image
  data and a deterministic seed UUID — a test fixture, undecodable by design.

**Decision: freeze PNG, JPEG, WebP. Drop AVIF from Kafil's accepted input.**

No re-encode work is required: the legacy AVIF/GIF assets the contract review
warned about do not exist. Kafil's AVIF acceptance was a capability nobody used.

Requirements this creates:

- Kafil's adoption removes AVIF from its documented accepted formats.
- Documentation must not describe GIF as accepted — it never was.
- Re-run this audit against the **production** database before cutover. Code
  and development data cannot prove what production stores. The audit script
  is read-only and reusable.

### 1.6 Built-in preset deletion

**Package behavior**: `limits.allowBuiltInPresetDeletion`, default **`false`**
(`src/server/config.ts:401`). Enforced in `ThemePresetService.remove:184`, and
projected to the client through `ThemePresetController:62` →
`react/types.ts:38` → `NThemePresetSettings.tsx:102`. Backend and UI read the
same value, so they cannot silently diverge — the divergence `najm-theme.md` §7
warns about is structurally prevented.

**Kafil behavior**: the schema comment says built-ins cannot be deleted;
`themePresetService.remove` deletes them anyway. Kafil contradicts itself.

**Live evidence**: all 5 Kafil presets are `is_built_in = true`, seeded
2026-08-06, `created_by_user_id = NULL`.

**Decision: disallow built-in deletion. Keep the package default `false`.**

Kafil configures nothing and adopts the default. Kafil's backend is corrected
to match the comment it already carries.

Requirements this creates:

- With all 5 live presets built-in, an administrator can delete **none** of
  them until they create their own. That is intended.
- The delete control must be **disabled with a visible reason**, not hidden.
  `najm-theme.md` §11 already forbids hiding as an authorization boundary; the
  same rule applies to a capability limit.
- Kafil's schema comment, backend, UI, and tests are aligned in one adoption
  change, not spread across several.

### 1.7 Actor attribution — sixth decision, carried from the contract review

Not in the five named for this freeze, but it blocks schema generation, so it
is frozen here rather than deferred into Move 8.

**Package behavior**: `updated_by_actor_id` / `created_by_actor_id` are
unconstrained text. The package refuses an auth dependency by design.

**Kafil behavior**: `updated_by_user_id` / `created_by_user_id` reference
`users` with `ON DELETE SET NULL`.

**Live evidence**: `platform_settings.updated_by_user_id = 'Sjp7EggO'`; all 5
presets have a NULL creator.

**Decision: accept durable text actor IDs. Do not add an app-owned foreign key.**

An FK would reintroduce exactly the auth coupling the package avoids, and
`ON DELETE SET NULL` *rewrites history* when a user is deleted — the audit
question "who changed the theme" stops being answerable. Text IDs outlive the
user row. Kafil's audit trail, not the settings table, is the integrity layer.

---

## 2. Frozen names

Frozen for `0.1.x`. Changing any of these after adoption is a breaking change
requiring the §Move 10 deprecation policy.

### 2.1 Routes

Canonical, beneath the consumer's `basePath`:

```text
GET    {base}/appearance
PUT    {base}/appearance
POST   {base}/appearance/reset
GET    {base}/presets
POST   {base}/presets
POST   {base}/presets/:id/apply
DELETE {base}/presets/:id
GET    {base}/branding
GET    {base}/branding/config
PUT    {base}/branding
POST   {base}/branding/reset
POST   {base}/branding/assets/:slot/:fileName
GET    {base}/branding/assets/:fileName
DELETE {base}/branding/assets/:fileName
POST   {base}/branding/assets/reconcile
```

Per-consumer `basePath` — deliberately different, and that is the point of the
option:

| Consumer | `basePath` | Effective prefix | Reason |
|---|---|---|---|
| Kafil | `''` | `/api/appearance`, `/api/branding`, `/api/presets` | preserves existing external appearance and branding routes under Kafil's `/api` server base |
| School | `'/theme'` | `/api/theme/…` | no legacy routes to preserve; namespaced is cleaner |

Kafil route changes at cutover:

- `/api/theme-presets` → `/api/presets` (breaking; update clients, keys, tests).
- `/api/branding/assets/serve/:f` → `/api/branding/assets/:f`. Keep a redirect
  from `/serve` through the rollback window.

### 2.2 Audit event names

```text
theme.appearance.saved
theme.appearance.preset-applied
theme.appearance.reset
theme.preset.created
theme.preset.deleted
theme.branding.saved
theme.branding.reset
theme.branding.asset.uploaded
theme.branding.asset.deleted
theme.branding.assets.reconciled
```

### 2.3 MCP tool names

```text
theme_appearance_get
theme_appearance_reset
theme_presets_list
theme_preset_apply
theme_branding_get
```

Five tools. There is deliberately no appearance-save tool and no binary upload
tool — uploads stay REST/binary and never encode image bytes in MCP JSON.
Kafil's controller-derived tool names are retired; saved prompts and automation
must move. Search prompts and automation for the old names before cutover.

### 2.4 Slot contract

Four standard slots, unchanged in name and inheritance from Kafil:

```text
sidebarLogoExpanded    (no inheritance — the root mark)
sidebarLogoCollapsed   inherits sidebarLogoExpanded
authLogo               inherits sidebarLogoExpanded
authHeroImage          (no inheritance)
```

Persistence is a validated JSON `slot_config` map, so a new slot needs no DDL
in the package or in any consumer.

### 2.5 Scope

Both consumers use the constant scope `scope_id = 'platform'`. Tenant-aware
resolution stays in the contract but is unexercised by either adopter.

### 2.6 Dialect

| Consumer | Dialect | Schema entry |
|---|---|---|
| Kafil | PostgreSQL | `najm-theme/pg` |
| School | PostgreSQL | `najm-theme/pg` |

`najm-theme/sqlite` has no consumer. See §0.1.

---

## 3. School integration decisions

Recorded from source review at School `4abb86d` plus a dirty worktree.

### 3.1 School's current state

| Surface | Current | After adoption |
|---|---|---|
| Design config | `sms-design-config.json`, a build-time import parsed once at module scope (`app/providers.tsx:10-12`) | package factory value; runtime design from `najm_theme_appearance` |
| Design provider | `NajmDesignProvider` inside `AppProviders` (`providers.tsx:75`) | seeded from the package server snapshot |
| Personal mode | `next-themes` `ThemeProvider` in the root layout, `defaultTheme="light" enableSystem` | **unchanged — stays School-owned** |
| Typography | `applySmsTypographyVars()` writes CSS vars by hand on mount (`providers.tsx:14-39`) | package runtime provider; delete the hand-rolled effect |
| `settings.theme` | `text` column, `'system'` default, one `SystemSection` select | **unchanged — this is personal mode, not platform design** |
| Branding | `schoolLogo` column, no renderer (§0.2) | package slots |
| Presets | none | optional |
| Storage | `najm-storage@2.1.1`, `provider: 'local'`, `basePath: 'storage'`, `guards: [isAuth()]` | upgrade to `>= 2.2.0`; add a `theme-branding` namespace |
| Admin guard | `isAdministrator = createGroupGuard(['PRINCIPAL','ADMIN'])` (`auth.ts:87`) | same guard, bound to package capabilities |
| Public read | `GET /settings/public` is `@isAuth()` — **not anonymous** | see §3.3 |
| Settings UI | `SettingsForm` + six sections (School, Academic, Notification, Security, System, Database) | add a seventh section from package components |
| najm-kit | `2.1.43` (dashboard pins `^2.1.40`) | `>= 2.9.0` — a bounded prerequisite upgrade |

### 3.2 Enabled features

```ts
features: { appearance: true, branding: true, presets: false,
            assetUploads: true, mcp: true }
```

Presets stay off for School's first adoption. School has no preset concept, no
UI for one, and no data to migrate; enabling it would ship an empty feature to
prove a package capability. `najm-theme.md` §6 explicitly supports this — and
School with `presets: false` becomes the partial-feature proof the package
needs, which Kafil (all five enabled) cannot provide.

### 3.3 Public read

Kafil sets `publicRead: true` so login and first-login chrome render for
anonymous users. School's own `/settings/public` is `@isAuth()`, so School has
no anonymous-render precedent.

**Decision: `publicRead: true` for School as well.**

School's login page must render branding before a session exists — the same
constraint Kafil has. This is not a relaxation of School's settings policy:
appearance and branding are exactly the data that has to be public for a login
screen to look right, and the package's public projection carries no admin or
storage fields by construction (§1.3).

### 3.4 `schoolLogo` mapping

Given §0.2 — the column has no renderer — the "two sources of truth" risk the
plan describes does not exist.

**Decision: import `schoolLogo` into `sidebarLogoExpanded` if and only if it
holds a decodable PNG/JPEG/WebP at migration time. Otherwise import nothing.**

Then drop the column in a later migration, on the same deferred schedule as
Kafil's seven legacy columns. Enabled slots for School:

```text
sidebarLogoExpanded    enabled
sidebarLogoCollapsed   enabled  (inherits expanded)
authLogo               enabled  (inherits expanded)
authHeroImage          enabled
```

All four. School's login page and sidebar have the same shape as Kafil's, and
inheritance means three of the four cost nothing to enable.

### 3.5 School-owned, untouched

Academic, notification, security, language, time zone, date/time, currency,
backup, database, and maintenance settings stay in School's `settings` table
and `SettingsForm`. `settings.theme` (personal `light | dark | system`) stays
School-owned — platform design is a separate source and the two must not be
merged.

---

## 4. Shared intersection and app-owned differences

### Genuinely shared — the package owns these

Revision protocol and typed conflict; reset semantics (store null, serve
factory, increment); invalid-payload fallback with sanitized diagnostic; the
four standard slots and their inheritance graph; candidate upload → commit →
post-commit cleanup ordering; grace-period orphan reconciliation; module-scope
RSC bootstrap over `najm-kit/server/react`; PNG/JPEG/WebP validation and
normalization; `(scope_id, slug)` preset uniqueness; public projections that
omit admin and storage fields.

### App-owned differences — configuration, not package variants

| Difference | Kafil | School |
|---|---|---|
| `basePath` | `''` | `'/theme'` |
| Presets | enabled | disabled |
| Guards | Kafil admin capability | `isAdministrator` = `PRINCIPAL` \| `ADMIN` |
| Logo size ceiling | 2 MB logos, 5 MB hero — declared explicitly so existing legal assets stay legal | package defaults (512 KB / 2 MB) |
| Legacy data | 7 `platform_settings` columns + `theme_presets` | one unused `schoolLogo` column |
| Factory design | `theme.json` | `sms-design-config.json` |
| MCP | enabled, replacing Kafil tool names | enabled, new |
| najm-kit upgrade | already `2.9.0` | `2.1.43` → `>= 2.9.0`, bounded prerequisite |

Nothing in this table needs a package code path. Every row is a config value.

---

## 5. Move 0 gate

- [x] **Both consumers can be expressed through configuration** without package
  imports from either application. Every difference in §4 is a config value.
- [x] **No unresolved data, authorization, storage, or provider-tree
  assumption remains.** The five named decisions plus actor attribution (§1.7)
  and missing-asset resolution (§1.4) are frozen; School's provider tree,
  guards, storage, and dialect are recorded in §3.

### Carried into Move 8 as prerequisites, not open questions

1. Kafil's worktree is dirty on branch `auth-cookie-plan/move-6-drop-legacy-table`
   and must be committed or isolated. No implementation begins from an
   unreproducible snapshot.
2. Kafil must upgrade `najm-mcp` `2.0.2` → `>= 2.1.0` and add
   `najm-storage >= 2.2.0` before `theme()` registers.
3. Re-run the §1.5 asset audit against **production** before cutover.
4. Search email templates, cached documents, automation, prompts, and bookmarks
   for `/theme-presets`, `/branding/assets/serve`, and the old MCP tool names.

### Kafil reference acceptance — status

`najm-theme.md` Move 0 requires acceptance "needed to distinguish correct
behavior from merely present source code". What this freeze establishes from
live data rather than source:

- [x] Revision protocol is live and exercised: `appearance_revision = 19`,
  `branding_revision = 13`.
- [x] Stored appearance is present and non-null; it parses.
- [x] Preset identity recorded: 5 rows, UUIDs, slugs, names, built-in markers,
  NULL creators, timestamps. Zero duplicate slugs, zero duplicate normalized
  names.
- [x] Branding references recorded: 2 of 4 slots set, both `.webp`, both absent
  from storage; 8 orphaned files. Format audit complete (§1.5).
- [x] Slot fallback confirmed by source and matched by the backfill rule (§1.4).
- [ ] **Browser acceptance is not done** and cannot be established from a
  database read. Kafil `PLAN.md` Phase 2 owns it: upload, preview, save,
  reload, replace, revert, clear-to-fallback, restart, missing-asset recovery
  UI, four locales, Arabic RTL, desktop/tablet/phone.

Move 0 does not depend on that browser evidence — it freezes the *contract*,
and the contract questions are answered. Kafil `PLAN.md` Phase 2 remains open
and gates Kafil's own release, not the package API.
