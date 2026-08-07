# Providers Plan — `NajmUIProvider`

Collapse the per-project React provider stack into one component shipped by
`najm-kit`, so a new Najm app wires providers by passing props instead of
copying files.

Status: steps 1–3 of §10 implemented in this repo. Steps 4 (browser check),
5 (publish) and 6–7 (Kafil) are open — Kafil lives in another repo, so
everything in §4 below is unverified against source.
Target package `najm-kit` (currently `2.6.3`).

---

## 1. Problem

The same glue has already been written three times, and it has already drifted.

| Location | What it is |
|---|---|
| `apps/playground/src/providers/index.tsx` | **live.** `layout.tsx` renders this: `QueryProvider` → `AuthProviderWrapper` |
| `apps/playground/src/providers/QueryProvider.tsx` | live, rendered by the above, `staleTime: 30_000` |
| `apps/playground/src/providers/AuthProvider.tsx` | live, threads `initialSession` into `najm-auth`'s `AuthProvider` |
| `apps/playground/src/app/providers.tsx` | **orphan.** A second `AppProviders` with its own `QueryClient`; nothing imports it |
| `kafil/apps/web/src/providers/AppProviders.tsx` | `AuthProvider` → `QueryProvider` → 5 more, `staleTime: 60_000` |

Two things to notice:

- The playground nests **Query outside Auth**; Kafil nests **Auth outside Query**.
  Neither is wrong today — `najm-auth` does not import `@tanstack/react-query`
  (verified: no match in `packages/najm-auth/src`) — but the divergence is
  unmanaged, and the day `AuthProvider` grows a query the two apps behave
  differently.
- The playground already carries a duplicate provider stack that nothing
  renders: `src/app/providers.tsx` builds a second `QueryClient` with the same
  options as the live `QueryProvider`, and `layout.tsx` imports `@/providers`
  (the directory) rather than `./providers` (the orphan). It also predates the
  live one — it never got the `initialSession` fix. That is what copy-paste
  provider setup decays into.

Kafil's stack is the mature version of this and shows the real cost:

```
AuthProvider                    najm-auth, session
  QueryProvider                 20 lines of react-query config
    KafilLanguageProvider       najm-i18n + catalog + POST /api/ui-language
      KafilPreferencesProvider  theme + timeZone cookies, router.refresh()
        KafilAppearanceProvider design draft/commit reducer
          KafilBrandingProvider branding draft/commit + NBrandingProvider
            KafilDesignProvider 20-line glue → NajmDesignProvider
              KafilTableDefaultsProvider  45 lines of localized pagination labels
```

The nesting depth is not itself a problem — every layer memoizes its context
value, so it costs no renders. The problem is that **starting a new project
means copying seven files plus three API routes**, and then maintaining seven
divergent copies.

## 2. What is actually portable

Splitting Kafil's stack by whether a second project would want it verbatim:

**Tier A — pure glue over kit primitives, zero domain content (~200 lines).**
`QueryProvider`, `KafilPreferencesProvider`, `KafilDesignProvider`,
`KafilTableDefaultsProvider`, plus `app/api/ui-theme|ui-language|ui-timezone`
(26/26/36 lines). The only project-specific values anywhere in this set are the
endpoint strings and the word `Kafil`. **This is what the plan moves into the kit.**

**Tier B — a product feature that happens to be implemented as providers.**
`KafilAppearanceProvider` (135) + `KafilBrandingProvider` (283) + their reducers,
types, services and hooks ≈ 700 lines of client code, backed by
`packages/server/src/modules/settings/` at **3,355 lines** (appearance, branding,
themePreset controllers/services/repos/storage), a `theme_presets` migration, and
managed-image normalization.

Tier B stays in Kafil. Copying it into a new project yields hooks that 404 unless
that project also ports the server module — so "make it reusable" here means a
future `najm-appearance` package, not a provider export. Out of scope.

**Never portable.** The translation catalog and `APP_NAME`.

## 3. Design

### 3.1 One provider, framework-agnostic core + Next adapter

`najm-kit` gains `NajmUIProvider`, covering Tier A minus react-query:

- **preferences** — `theme` + `timeZone` state with async setters
- **design** — feeds `NajmDesignProvider` with `design` + the live `theme`
- **table defaults** — derives `NTableDefaults.paginationLabels` from a `t`

Persistence and router refresh are injected as callbacks, so `najm-kit/index`
imports nothing from `next`. A thin `NajmNextUIProvider` in the existing
`najm-kit/next` subpath supplies the Next wiring (`useRouter().refresh()` plus
`fetch` to cookie endpoints).

One thing this costs, which is easy to miss: `src/adapters/next.tsx` today
imports **only React**. It fakes `Link` with an `<a>` and navigation with
`window.history`, and `next` appears in neither `dependencies` nor
`peerDependencies`. `useRouter` would be the package's first real `next` import
at runtime. `next` and `next/navigation` are already `external` in
`tsup.config.ts`, but that only stops tsup bundling them — so this needs
`next` added to `peerDependencies` with `peerDependenciesMeta.next.optional`,
keeping it installable by non-Next consumers who never touch the `/next` entry.

### 3.2 Dependency stance: the kit stays free of Najm packages

`najm-kit` today depends on **no** `najm-*` package. Keep it that way.

- **i18n:** do *not* import `najm-i18n/react`. `NajmUIProvider` takes a `t`
  function. Any i18n library works, and the app keeps its own language provider —
  which it should, because the app owns the catalog and the persistence endpoint
  anyway (35 lines that are genuinely app-level).
- **auth:** `AuthProvider` stays in the app. Folding it in would make `najm-kit`
  depend on `najm-auth` and turn a UI package into a framework.
- **react-query:** stays in the app. `@tanstack/react-query` is not a kit
  dependency and must not become one.

Net: three root-level providers remain in every app (`Auth`, `Query`, language),
and they are three lines, not seven files.

### 3.3 API

```ts
// najm-kit
export interface NajmUIProviderProps {
  children: React.ReactNode;

  design: NajmDesignConfig;
  className?: string;              // forwarded to NajmDesignProvider

  initialTheme?: NajmMode;         // uncontrolled; provider owns it thereafter
  initialTimeZone?: string;        // defaults to "UTC"
  onThemeChange?: (theme: NajmMode) => void | Promise<void>;
  onTimeZoneChange?: (timeZone: string) => void | Promise<void>;
  normalizeTimeZone?: (value: string) => string;

  t?: (key: string, params?: Record<string, string | number>) => string;
  paginationKeyPrefix?: string;    // default "common.pagination"
  tableDefaults?: NTableDefaults;  // per-key override of the derived labels
}

export function NajmUIProvider(props: NajmUIProviderProps): JSX.Element;
export function NajmPreferencesProvider(props: NajmPreferencesProviderProps): JSX.Element;
export function useNajmTheme(): { theme: NajmMode; setTheme: (t: NajmMode) => Promise<void> };
export function useNajmTimeZone(): { timeZone: string; setTimeZone: (tz: string) => Promise<void> };
```

`NajmPreferencesProvider` is exported from day one, not held in reserve. §4.3
needs it the moment anything above the design layer reads theme, and shipping it
later would mean a kit republish plus an app migration rather than a reorder.
`NajmUIProvider` renders it internally; passing both is supported and the inner
one defers to an outer context.

Behaviour notes:

- The theme props are **uncontrolled**: `initialTheme` seeds state the provider
  owns thereafter, and later changes to the prop are ignored. Hence the `initial`
  prefix — a bare `theme` would read as controlled and get wired up as such.
- `setTheme` toggles `document.documentElement.classList` `dark`, `setTimeZone`
  writes `dataset.timeZone` — both before awaiting the callback's side effects,
  matching Kafil today.
- Labels are built with `useMemo` keyed on `t` and the prefix, then merged
  per-key with `tableDefaults`. This matches `useResolvedPaginationLabels`,
  which already merges most-specific-first, so a table overriding one label
  keeps the other nine and an unsupplied label still falls back to packaged
  English.
- With no `t`, the kit's English fallbacks apply and the provider is still useful.

```ts
// najm-kit/next
export interface NajmNextUIProviderProps
  extends Omit<NajmUIProviderProps, "onThemeChange" | "onTimeZoneChange"> {
  endpoints?: { theme?: string; timeZone?: string };  // default /api/ui-theme, /api/ui-timezone
  refreshOnChange?: boolean;                          // default true
}
```

### 3.4 Files

```
packages/najm-kit/src/providers/
  NajmUIProvider.tsx        core composition
  preferences.tsx           context + useNajmTheme/useNajmTimeZone
  paginationLabels.ts       t + prefix → NTablePaginationLabels
  index.ts
packages/najm-kit/src/adapters/next.tsx   += NajmNextUIProvider
packages/najm-kit/src/index.ts            += re-exports
packages/najm-kit/package.json            += next as an optional peer
packages/najm-kit/tsup.config.ts          splitting: false → true
packages/najm-kit/test/providers.test.tsx  new
```

No `exports` change (both entrypoints already exist).

**The `tsup` change is not optional, and it is the trap in this whole design.**
`index` and `adapters/next` both pull in `src/providers`. Under the package's
`splitting: false`, each entry bundles its *own* copy of that module — including
its own `React.createContext` object. `NajmNextUIProvider` then publishes to one
context while `useNajmTheme` imported from `najm-kit` reads another, and every
consumer hook throws "must be rendered under a NajmUIProvider" from inside a
correctly-nested tree.

This is invisible to `tsc`, to the unit tests (which import `src`, where there
is one module), and to `next build`. It only appears when the built `dist` is
rendered — which is exactly what §5 makes the playground do, and the reason
step 4 of §10 is a real gate rather than a formality. `splitting: true` gives
both entries one shared chunk and one context.

Two smaller consequences worth writing down: `dist/chunk-*.mjs` is now part of
the published output (already covered by `files: ["dist"]`), and importing
`NTableDefaultsProvider` from `components/table/TableDefaults` rather than the
`components/table` barrel keeps the whole NTable graph out of the `/next`
bundle — 55.9 KB down to 19.2 KB.

## 4. Migration — Kafil

### 4.1 Deletions

- `apps/web/src/providers/KafilDesignProvider.tsx` — absorbed entirely.
- `apps/web/src/providers/KafilTableDefaultsProvider.tsx` — replaced by the
  `t` + `paginationKeyPrefix` props. Kafil's keys are already
  `common.pagination.*`, so the default prefix matches and no locale JSON moves.
- `apps/web/src/providers/KafilPreferencesProvider.tsx` — replaced by
  `useNajmTheme` / `useNajmTimeZone`.

Keep `KafilLanguageProvider`, `KafilAppearanceProvider`, `KafilBrandingProvider`,
`QueryProvider`, and the three `app/api/ui-*` routes.

### 4.2 Call-site sweep

`useThemePreference` and `useKafilTimeZone` are consumed outside the provider
file. Before deleting anything, enumerate and rewrite:

```bash
cd apps/web && grep -rn "useThemePreference\|useKafilTimeZone\|KafilTableDefaultsProvider\|KafilDesignProvider" src/
```

Rename is mechanical (`useThemePreference` → `useNajmTheme`,
`useKafilTimeZone` → `useNajmTimeZone`), but the import path changes, so this
must be a single commit.

### 4.3 The ordering change — the one risky step

`NajmUIProvider` takes `design` as a **prop**, but Kafil's `design` comes from
`KafilAppearanceProvider`'s **context** (the live theme editor). So the UI
provider must sit *below* appearance, with a small bridge:

```tsx
function KafilUIBridge({ children }: Readonly<{ children: React.ReactNode }>) {
  const { design } = useKafilAppearance();
  return <NajmNextUIProvider design={design} className="min-h-full" {...prefs}>{children}</NajmNextUIProvider>;
}
```

That moves preferences from **above** appearance to **below** it. Verify the
move is safe by confirming neither `KafilAppearanceProvider` nor
`KafilBrandingProvider` reads theme or timeZone:

```bash
cd apps/web && grep -rn "useThemePreference\|useKafilTimeZone" src/providers/KafilAppearanceProvider.tsx src/providers/KafilBrandingProvider.tsx src/providers/appearanceReducer.ts src/providers/brandingReducer.ts
```

Expected: no matches (neither imports them today) — and this grep is a
precondition, not documentation. Run it in the Kafil repo and get zero matches
before deleting anything. If it ever grows a match, the bridge hoists
preferences back out as a standalone `NajmPreferencesProvider` above appearance,
which §3.3 exports for exactly this reason.

**A project without a runtime theme editor needs no bridge**: it passes a static
`design` config straight to `NajmNextUIProvider`. Kafil pays six lines because it
sells the editor. That asymmetry is the point of the whole plan.

### 4.4 Result

```tsx
<AuthProvider client={auth.client} initialSession={initialSession}>
  <QueryProvider>
    <KafilLanguageProvider initialLanguage={initialLanguage}>
      <KafilAppearanceProvider initialAppearance={initialAppearance}>
        <KafilBrandingProvider initialConfig={...} initialResolved={...} role={role}>
          <KafilUIBridge initialTheme={initialTheme} initialTimeZone={initialTimeZone}>
            {children}
          </KafilUIBridge>
        </KafilBrandingProvider>
      </KafilAppearanceProvider>
    </KafilLanguageProvider>
  </QueryProvider>
</AuthProvider>
```

Seven Kafil-authored providers → four, three files deleted, ~200 lines removed,
`apps/web/src/app/layout.tsx` otherwise unchanged.

## 5. Migration — playground

The playground is the acceptance harness (per `AGENTS.md`, and it is where kit
changes get looked at before publish).

Mind which file is live. `layout.tsx` imports `AppProviders` from `@/providers`,
i.e. `src/providers/index.tsx`. `src/app/providers.tsx` is the orphan.

1. Delete the orphan `src/app/providers.tsx`.
2. Edit the live `src/providers/index.tsx` to `QueryProvider` →
   `AuthProviderWrapper` → `NajmNextUIProvider` with a **static** `design`
   config and no `t`. Keep `initialSession` threaded through — it is what
   `AuthProviderWrapper` exists for, and dropping it re-breaks the SSR session
   render fixed in `2886198`.
3. Add a theme toggle calling `useNajmTheme().setTheme` and one `NTable` to
   confirm defaults flow.
4. Add `app/api/ui-theme/route.ts` and read the cookie in `layout.tsx` for
   `initialTheme`. §7 asks the toggle to survive a reload, and it cannot without
   a persistence endpoint to point `NajmNextUIProvider` at. This is ~25 lines
   and is also the worked example of the request shape §6 says the README must
   document.
5. Give the app two palettes. The playground defined its dark tokens on `:root`
   with no `.dark` block at all and hardcoded `class="dark"` on `<html>`, so it
   was never theme-able: the toggle flipped state and removed the class, and
   nothing changed on screen. Move the dark values under `.dark`, add a light
   set on `:root`.

   Worth stating as a general precondition rather than a playground quirk. The
   provider owns the *class*; the application owns what the class means. An
   adopting app whose CSS has one palette will see a toggle that appears
   completely dead, with no error anywhere to explain why.

Step 2 is the real deliverable: it demonstrates the zero-copy path a new project
takes. If it needs more than about ten lines, the API is wrong — revise before
publishing.

Do this after the delete, not before: rewriting the orphan instead of the live
file is the one mistake here that stays invisible. The app keeps rendering, the
browser check in §10 step 4 passes, and none of the new code is mounted.

Keep the playground's Query-outside-Auth order and Kafil's Auth-outside-Query
order as they are; this plan does not resolve that, it only stops the *rest* of
the stack from drifting the same way. Note it as a follow-up.

## 6. Non-goals

- Moving appearance/branding into a package (Tier B — needs a server module).
- Making `najm-kit` own auth or react-query.
- Standardizing Auth/Query nesting order across apps.
- Touching the `ui-theme`/`ui-language`/`ui-timezone` route handlers; the kit
  calls them, it does not ship them. Documenting the expected request shape
  (`POST {theme}` / `POST {timeZone}`, non-2xx = throw) in the README is enough.

## 7. Verification

Najm, per root `AGENTS.md`:

```bash
bun run build:ui
bun run test:ui
bun run lint:ui          # typecheck + typecheck:tests
bun run playground:next
```

Then look at the playground in a browser: theme toggle persists across reload,
RTL still flips, `NTable` pagination renders. Do not publish before that.

Kafil, per its `AGENTS.md` gate:

```bash
bun run lint && bun run typecheck && bun run test && bun run build && bun run db:generate
```

`db:generate` must produce **no** new migration — this is a frontend-only change.
Then re-check the four locales and RTL, and `/operator/settings` theme editing
end to end, since the bridge in §4.3 changes provider order around it.

## 8. Publish

Per `AGENTS.md` §Publishing and prior practice:

```bash
bun scripts/publish-package.ts najm-kit --dry-run    # no bump flag on a dry run
bun run pub:ui                                       # 2.6.3 → 2.6.4
```

`pub:ui` already *is* `publish-package.ts najm-kit --patch`, so do not add
`--patch` again. (It parses idempotently — `parseArgs` assigns rather than
accumulates — so the duplicate is harmless, just misleading.)

The dry-run caution is real but works differently than "double-bump" suggests:
`bumpPackageVersion` is **not** guarded by `dryRun`, so `--dry-run --patch`
writes a genuine version bump to `package.json` and then publishes nothing. The
next real publish bumps again and you land two versions ahead of what you
verified. Keep bump flags off dry runs.

Then repoint Kafil's root `overrides` for `najm-kit` and re-run the Kafil gate.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Provider order change breaks the theme editor | §4.3 grep first; `/operator/settings` is the manual check |
| `t` identity unstable → table re-renders | `useKafilLanguage` already memoizes `t`; labels `useMemo` on it |
| Pagination key prefix mismatch in a future app | Prefix is a prop, defaults to Kafil's existing `common.pagination` |
| Kit grows a `next` import in the core entry | Next wiring lives only in `adapters/next.tsx`; keep the core import-free |
| Hidden consumers of the deleted hooks | §4.2 grep sweep, single commit |
| `next` undeclared for `/next` consumers | §3.1 optional peer; the core entry stays installable without Next |
| Playground work lands in the orphan file | §5 deletes `app/providers.tsx` first, so a misdirected edit fails loudly |
| Duplicate context across the two entries | §3.4: `splitting: true`. Type checks and unit tests cannot catch this — only rendering `dist` does |
| Toggle looks dead in an app with one palette | §5 step 5: the provider owns the class, the app owns what it means. Check for a `.dark` block before blaming the provider |

## 10. Order of work

1. `najm-kit`: preferences context + pagination labels + `NajmUIProvider`, exports.
2. `najm-kit/next`: `NajmNextUIProvider`, plus the optional `next` peer.
3. Playground: delete `app/providers.tsx`, wire `src/providers/index.tsx`,
   add the cookie route, add toggle + table.
4. **Look at it in the browser.** Revise the API if step 3 was awkward.
5. Publish (`bun run pub:ui`).
6. Kafil: bump override, add the bridge, delete three providers, sweep call sites.
7. Kafil gate + locale/RTL/theme-editor check.
