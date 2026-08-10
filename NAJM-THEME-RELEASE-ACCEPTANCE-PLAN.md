# Najm Theme 0.2 Release Acceptance and Kafil Migration Plan

Status: `najm-theme@0.2.0` package implementation and Playground wiring exist in
the local worktree. **Sections 2 to 7 are complete and evidenced** — the DX
closeout was already implemented, and Playwright browser acceptance now passes
on a production build, with the record in `docs/evidence/najm-theme-0.2/README.md`.
Kafil migration (section 8) and packaging, commit, push, and publication
(section 9) remain open.

Browser acceptance found **seven** defects that every unit gate had missed; all
seven are fixed, re-verified, and covered by regression tests that were each run
against the un-fixed code to confirm they go red. **Every box in section 4 now
passes, 4.14 included** — the keyboard walk asserts reach, visible focus, and
the absence of a trap at both viewports, on a production build.

This is **two release candidates**, not one: `najm-kit` (accessibility and state
fixes to shared primitives) and `najm-theme@0.2.0`. Both are described in the
evidence README. One finding remains open, and it is documented noise rather
than a defect.

This plan replaces `NAJM-THEME-CONVENTION-PLAN.md`. The convention is now
implemented; this document tracks the remaining work needed to prove it is the
simple, reusable solution intended for every consumer.

Nothing in this worktree may be pushed or published until every blocking gate
below has evidence and the user explicitly approves the audited candidate.

## 1. Confirmed implementation baseline

The local `najm-theme@0.2.0` worktree currently contains:

- `defineTheme(import.meta.url)` from the isolated `najm-theme/theme` entry;
- one sibling `theme.json` plus exactly one PNG or WebP for each fixed basename:
  `sidebar-logo-expanded`, `sidebar-logo-collapsed`, `auth-logo`, and
  `auth-hero`;
- eager appearance/image validation, real-byte MIME checks, hashing, immutable
  definition data, and package-owned factory asset serving;
- `theme(definition, policy)`, one `manage` guard, standard route/feature
  defaults, and a deprecated 0.1 callback compatibility path until 0.3.0;
- definition-backed RSC bootstrap, `NThemeBrandingProvider`, and `NThemeImage`;
- a mixed PNG/WebP Playground factory directory and real login/sidebar/settings
  placements.

The isolated `najm-theme/theme` entry is accepted. Importing the definition from
the plugin-heavy `najm-theme/server` entry in an RSC facade would unnecessarily
pull controllers, Drizzle, and decorators into the Next server graph.

`features.assetUploads` remains on by default for the opinionated definition
path. This matches the required full dashboard experience. A deliberately
appearance-only consumer may set `features: { assetUploads: false }`; the normal
path requires `storage()` and must fail boot with a clear error when it is
missing.

### Independently rechecked (2026-08-10, after the browser-acceptance fixes)

- `bun run lint:theme` passed.
- `bun run test:theme` passed: 444 tests (344 + 79 + 21), 0 failures. The 381
  figure above was from an earlier worktree; the suite has grown, and one
  regression test was added for the fallback defect below.
- `bun run --cwd packages/najm-theme test:next16` passed, including the
  negative Client Component import guard.
- `bun run api:check` passed.
- `bun --cwd apps/playground test` passed: 18 tests, 0 failures.
- `bun run --cwd packages/najm-kit test` passed: 1088 passed, 14 skipped.
  `najm-kit` is in scope because one of the fixes lands there.
- `bun run playground:next:build` passed with a **captured exit code of zero**,
  build ID `TR7qVnjm30Gm5GFz860ae`. This closes the open item that the previous
  retry had timed out rather than returning success.

The Najm HEAD is still the pre-work commit and the worktree is uncommitted. No
0.2.0 tarball is present under `dist-publish/`. Do not describe the candidate as
committed, packed, pushed, or published yet.

## 2. DX closeout — complete

**This section was already implemented when the work below was verified.** The
`/api/theme` repetition it was written to remove is gone: neither
`apps/playground/src/lib/serverTheme.ts` nor the Next 16 fixture passes a
factory map, a client, or a base URL, and `ThemeSettingsSurface` mounts
`NThemeSettingsProvider` with nothing but `onPersisted`. The remaining
`/api/theme` occurrences are explanatory comments and route assertions, both of
which the acceptance criteria below explicitly permit.

Two tests hold the line: `packages/najm-theme/test/consumer/consumer-boundary.test.ts`
scans the standard consumer files for a factory map, a `baseUrl`, or a literal
mount, and `packages/najm-theme/test/rsc/definition-bootstrap.test.ts:111`
proves one override moves every route and the factory fallback together.

The required shape, for reference:

### Required final consumer shape

The server facade should contain only the application-server binding:

```ts
const serverTheme = appTheme.react({
  getServer: async () => (await import("@app/server")).server,
});

export const loadServerTheme = serverTheme.load;
export const loadServerAppearance = serverTheme.loadAppearance;
export const loadServerBranding = serverTheme.loadBranding;
```

The root provider must not receive a separately constructed factory map:

```tsx
const { appearance, branding } = await loadServerTheme();

<NThemeBrandingProvider branding={branding}>
  {children}
</NThemeBrandingProvider>
```

The standard settings provider must not need a client/base URL:

```tsx
<NThemeSettingsProvider onPersisted={() => router.refresh()}>
  <NThemeSettings />
</NThemeSettingsProvider>
```

Najm may achieve this by enriching the definition-backed branding bootstrap
with its factory fallback map and by defaulting the React settings client to
the standard `/api/theme` mount. A custom/remote mount remains one advanced
override, supplied once, and must move reads, mutations, and factory fallbacks
together.

### DX acceptance

- [x] Remove the explicit factory map prop from the standard provider flow.
- [x] Remove the explicit settings client/base URL from the standard flow.
- [x] Remove `/api/theme` literals from Playground integration modules and the
  standard Next fixture; route assertions may still name the expected public
  URL.
- [x] Update types, README examples, changelog, API snapshots, package tests,
  RSC tests, and Next 16 fixtures to the same final shape.
- [x] Add a source-boundary test proving the standard consumer facade contains
  no `branding(...)`, `factory`, `basePath`, or `baseUrl` configuration.
- [x] Keep a custom-mount test proving one override moves every route and
  fallback together.
- [x] Rerun all focused package and Playground gates from section 1.

## 3. Reproducible Playground acceptance environment

The current Playground README references `apps/playground/.env.example`, but
that file does not exist. Fix the test harness before handing it to another
coder.

- [x] Commit a safe `apps/playground/.env.example` containing placeholders only.
- [x] Do not read, print, copy into evidence, or commit the local `.env`.
- [x] Document test-only JWT/encryption requirements and `COOKIE_SECURE=false`
  for local HTTP production testing.
- [x] Use a disposable SQLite database under the ignored root `.runtime/`
  directory. Do not reset a developer's normal `playground.db`.
- [x] Add visibly distinct, small PNG/WebP upload fixtures for all four slots
  under `apps/playground/test/e2e/fixtures/theme/`. They must look different
  from the factory assets so screenshots prove which source rendered.
- [x] Add `docs/evidence/najm-theme-0.2/README.md` as the acceptance record.

From the Najm root, the tester prepares a clean production candidate:

```powershell
bun install --frozen-lockfile
$env:DATABASE_URL='../../.runtime/playground-theme-acceptance.db'
bun run --cwd apps/playground db:migrate
bun run --cwd apps/playground db:seed
bun run lint:theme
bun run test:theme
bun run --cwd packages/najm-theme test:next16
bun run api:check
bun --cwd apps/playground test
bun run playground:next:build
bun run playground:next:bg
bun run playground:next:status
```

`apps/playground/.env` must already contain valid local-only secrets copied from
the safe template. The tester must see `http://127.0.0.1:3000` listening before
opening a browser. Seeded admin credentials are defined in the committed seed:
`admin@admin.com` / `Admin123!`.

After testing:

```powershell
bun run playground:next:stop
```

Pass requires the build command and background server to exit/start cleanly,
no server error in `.logs/playground-next.err.log`, and no tracked or unexpected
untracked runtime file after shutdown.

## 4. Browser acceptance contract

Minimax may use Playwright or Chrome DevTools. Either route is acceptable only
if it performs the same state transitions, inspects network/console behavior,
and writes the same evidence. Merely opening each page is not acceptance.

### Required viewports

| Name | Viewport | Required coverage |
| --- | --- | --- |
| Desktop | 1440 x 1000 | auth hero/logo, expanded/collapsed sidebar, settings |
| Mobile | 390 x 844 | auth logo, hidden hero behavior, settings overflow |

Use Chromium for the blocking run. A Firefox/WebKit pass is useful but does not
replace Chromium because the requested release evidence targets Chrome.

### Required visual state sequence

1. Open `/login` while signed out.
2. Confirm `authLogo` renders before the form and `authHeroImage` renders in the
   desktop hero panel. On mobile, the hero is hidden and the form/logo remain
   usable without horizontal scrolling.
3. Confirm the factory requests use hashed
   `/api/theme/branding/factory/...png|webp` URLs, return `200`, advertise the
   correct `Content-Type`, and use immutable caching.
4. Sign in as the seeded admin and open `/dashboard`.
5. Capture the expanded sidebar logo, activate the accessible
   `Collapse sidebar` button, and capture the distinct collapsed logo. Expand it
   again before entering settings.
6. Open `/dashboard/theme`. Confirm Appearance, Branding, Presets, and actions
   render from the package composite with no clipped controls or nested
   horizontal page scroll.
7. Change at least one clearly visible appearance property, save it, and verify
   the UI updates. Reload and verify it persists.
8. Upload visibly different valid files to all four branding slots, save, and
   verify the corresponding `POST`/`PUT` calls succeed.
9. Reload `/dashboard`, collapse/expand the sidebar, then sign out and revisit
   `/login`. Verify all four managed assets persist in their real positions.
10. Simulate a `404` for one managed branding asset. Confirm `NThemeImage`
    switches to that slot's factory URL without a broken-image glyph.
11. Reset branding through the dashboard confirmation flow. Reload the sidebar
    and login page and verify all four factory files return.
12. Reset appearance through its confirmation flow, reload, and verify the
    design returns to `theme/theme.json`.
13. Repeat the relevant auth/settings checks at the mobile viewport.
14. Keyboard-only: enter settings, traverse interactive controls with Tab and
    Shift+Tab, operate Save and both reset confirmations, and confirm focus is
    always visible and dialogs return focus sensibly.

**Status: all fourteen steps pass**, at both viewports, on a production build.
`bun run test:theme:e2e` — 13 tests, 0 failures. The record, including what each
assertion actually checks and the seven defects that had to be fixed to get
here, is `docs/evidence/najm-theme-0.2/README.md`.

Step 14 is the one that took work. Reaching it honestly required fixing four
najm-kit primitives and one najm-theme label, and replacing two assertions from
the previous round that could not fail — a `textContent` substring match against
`document.body`, and a focus-ring check that accepted a fully transparent
box-shadow. Both had been reported as passing.

Except for the deliberately intercepted missing managed image, pass requires:

- no browser console error or hydration warning;
- no failed theme API or image request;
- no `401` for public appearance, branding, or factory images;
- no `404` caused by a missing `/api` server base;
- no stale image after save, reload, sign-out, or reset;
- no use of implicit logo inheritance;
- PNG and WebP both proven by actual rendered responses, not only unit tests.

## 5. Playwright instructions for Minimax

**Playwright is now configured and the automated browser pass has been run.**
`@playwright/test` is pinned at `1.62.1`, the config is
`apps/playground/playwright.config.ts`, the spec is
`apps/playground/test/e2e/theme-convention.spec.ts`, and the entry points are
`bun run test:theme:e2e` (root) or `bun run --cwd apps/playground test:e2e:theme`.

Note that `apps/playground`'s own `test` script is now scoped to `./src`, so the
plan's `bun --cwd apps/playground test` gate still runs only the unit tests
rather than trying to execute Playwright specs under `bun test`.

What was required, all of it now in the worktree:

- [x] Add a reviewed, pinned `@playwright/test` dev dependency with Bun.
- [x] Add `apps/playground/playwright.config.ts` targeting the already-running
  production server at `http://127.0.0.1:3000`; do not silently boot `next dev`.
- [x] Add a `test:e2e:theme` script and one feature-owned spec under
  `apps/playground/test/e2e/theme-convention.spec.ts`.
- [x] Use role/label locators, not generated classes or DOM position.
- [x] Use `setInputFiles` with the committed acceptance fixtures.
- [x] Use `page.route('**/api/theme/branding/assets/**', ...)` for the one
  controlled managed-asset `404`, then remove the route before reset checks.
- [x] Assert response status, `content-type`, cache headers, hashed factory URL,
  visible image `src`, persistence after `page.reload()`, and reset behavior.
- [x] Fail on `pageerror`, unexpected console errors, failed theme requests,
  hydration errors, and horizontal overflow.
- [x] Run desktop and mobile projects and retain trace only on failure.
- [x] Write stable screenshots directly to
  `docs/evidence/najm-theme-0.2/playground/` with names that express state:
  `01-factory-login-desktop.png`, `02-factory-sidebar-expanded.png`,
  `03-factory-sidebar-collapsed.png`, `04-settings.png`,
  `05-managed-login.png`, `06-managed-sidebar.png`,
  `07-factory-fallback.png`, `08-reset.png`, and
  `09-login-mobile.png`.

The evidence README records the exact command, Najm commit candidate, package
version, Next build ID, browser version, viewport, test result, and every
screenshot path.

## 6. Chrome DevTools instructions for Minimax

If Chrome DevTools or a Chrome DevTools MCP is selected instead:

1. Open a fresh incognito profile at `http://127.0.0.1:3000/login`.
2. In Network, enable Preserve log and Disable cache for mutation checks; filter
   first by `branding`, then by `appearance`.
3. Inspect factory image response status and headers before login.
4. Perform the full state sequence in section 4, taking screenshots at the same
   named checkpoints as the Playwright workflow.
5. For the missing-managed-asset test, use Network request blocking only for the
   exact managed asset URL. Do not block the factory route. Reload and confirm
   the image element changes to the factory URL.
6. Use the device toolbar for 390 x 844 and verify `document.documentElement`
   has no horizontal overflow.
7. Clear the Console before each major state, then record any error/warning in
   the evidence README. A screenshot without a console/network audit is not a
   pass.
8. Use the Accessibility pane and keyboard navigation to confirm names, focus,
   dialog behavior, and decorative `alt=""` on the auth hero.
9. Export no HAR containing cookies or authorization headers. The repository
   ignores HAR files, and they are not release evidence.

Manual evidence must record each step as pass/fail. If the tester cannot
reproduce one transition, it remains unchecked rather than being inferred from
unit tests.

## 7. Playground acceptance checklist

- [x] DX closeout from section 2 is complete.
- [x] Safe environment template and disposable DB workflow are complete.
- [x] Production build returns exit code zero and production server is healthy.
- [x] Factory login desktop and mobile states pass.
- [x] Expanded and collapsed factory sidebar states pass.
- [x] Appearance save and reload persistence pass.
- [x] Four-slot branding upload, save, reload, and cross-page persistence pass.
- [x] Controlled managed-asset failure falls back to the factory asset.
- [x] Branding reset restores all four factory assets.
- [x] Appearance reset restores `theme.json`.
- [x] Keyboard and focus acceptance — **complete**, at both viewports. One Tab
  walk from the top of the document reaches the end of the action bar; every
  stop inside the settings surface shows an outline or a painted ring; no
  control holds focus across three consecutive Tabs; the confirmation traps Tab
  but not Escape; the two resets carry distinct accessible names; and focus
  returns to the trigger that opened the dialog. Four najm-kit defects were
  fixed to get here — tab panels, collapsible triggers, composite input
  wrappers, and dialog focus restoration — plus the duplicate reset name in
  najm-theme. Findings 4, 5 and 6 in the evidence README.
- [x] Console, network, MIME, cache, and overflow checks pass.
- [~] Screenshots and evidence README are **written and reviewable but not
  committed** — nothing in this worktree is committed yet, which section 9 owns.
  All nine named screenshots are in `docs/evidence/najm-theme-0.2/playground/`,
  regenerated by the final passing run. This stays partial by instruction, not
  by defect: committing is explicitly out of scope until approved.

## 8. Kafil migration after Playground passes

Kafil remains pinned to `najm-theme@0.1.1`. Do not migrate it against a guessed
API or publish merely to make the package installable. Validate it first against
the exact local packed 0.2.0 candidate without committing a local-file pin.

- [ ] Create Kafil's canonical `theme/` source with `theme.json` and four
  required PNG/WebP factory assets.
- [ ] Use the shared definition in backend registration and the final no-path
  RSC bootstrap in `apps/web/src/lib/serverTheme.ts`.
- [ ] Delete `packages/server/src/config/themeFactory.ts`,
  `packages/server/src/appearance.ts`, `packages/server/src/branding.ts`, and
  `packages/server/src/brandingPaths.ts` once all imports are gone.
- [ ] Replace Kafil's local `BrandingImage` fallback map with `NThemeImage` and
  the simplified provider contract.
- [ ] Remove repeated factory callbacks, branding paths, `/api/theme` knowledge,
  and obsolete package exports/tests.
- [ ] Preserve Kafil's permissions, audit sink, storage namespace, upload
  ceilings, backfill/rollback behavior, presets, and dashboard dynamic changes.
- [ ] Keep temporary redirects for Kafil's published legacy theme paths until
  deployment verification closes the rollback window.
- [ ] Run Kafil's full gate:
  `bun run lint && bun run typecheck && bun run test && bun run build && bun run db:generate`.
- [ ] Confirm `db:generate` creates no migration unless a separately reviewed
  schema change is intended.
- [ ] Run Kafil browser acceptance for auth logo/hero, expanded/collapsed
  sidebar, Settings uploads, persistence, controlled asset failure, reset,
  desktop, mobile, keyboard, RTL, console, and network behavior.
- [ ] Store Kafil evidence under `docs/evidence/najm-theme-0.2/`.

## 9. Packaging, commit, push, and publication gate

- [ ] Review the complete Najm worktree and separate unrelated changes.
- [ ] Build `najm-theme` from clean output and inspect exports, declarations,
  README, changelog, API snapshot, CSS, and `dist/theme/*`.
- [ ] Produce and inspect the actual `najm-theme-0.2.0.tgz`; verify there is no
  source-only dependency and run a clean-install smoke from that exact tarball.
- [ ] Rerun all package, Next 16, Playground unit, production build, and browser
  gates against the final candidate.
- [ ] Confirm the evidence README names the same candidate/tarball being
  reviewed.
- [ ] Prepare the versioned Git commit only after the whole scoped worktree is
  understood and clean enough for release.
- [ ] Ask for explicit user approval before push or npm publication.
- [ ] After publication, pin Kafil to the registry `0.2.0`, refresh its Bun
  lockfile, verify `bun install --frozen-lockfile`, and rerun Kafil's full and
  browser gates before its separate commit/push.

## 10. Definition of done

The release is ready only when:

1. A standard consumer passes no factory map, individual asset path,
   `basePath`, or `baseUrl`.
2. The canonical PNG/WebP factory source and all dashboard-managed changes work
   visually in Playground production.
3. Playwright or Chrome DevTools evidence proves upload, persistence, fallback,
   reset, responsive layout, keyboard access, network health, and console
   cleanliness.
4. Kafil uses the same final API, deletes its temporary theme facade/path files,
   and passes full automated and browser gates.
5. The audited tarball, version, documentation, evidence, and Git candidate all
   describe the same code.
6. No push or publication occurs without explicit final approval.
