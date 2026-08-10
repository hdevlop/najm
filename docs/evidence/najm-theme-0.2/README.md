# najm-theme 0.2.0 — Playground acceptance evidence

Browser acceptance for the theme convention, run against a **production** build
of `apps/playground` on Chromium. This file records what was run, what passed,
what was found, and what remains open.

Nothing here has been committed, tagged, packed, or published. Sections 8 and 9
of `NAJM-THEME-RELEASE-ACCEPTANCE-PLAN.md` (Kafil migration, packaging, push,
publication) are untouched.

## Candidate

| Item | Value |
| --- | --- |
| Packages | **two** candidates — see "Release candidates" below |
| Git HEAD at run time | `65967f5` — neither candidate is committed |
| Next build ID | `HMbwndhea-1-If07wGAZ5` |
| Production build exit code | `0` |
| Browser | Chromium 151.0.7922.34 (Playwright 1.62.1) |
| Runner | `@playwright/test` 1.62.1, pinned exactly |
| Database | disposable `.runtime/playground-theme-acceptance.db`, migrated and seeded per run |
| Date | 2026-08-10 |

The developer's own `apps/playground/playground.db` was never opened, reset, or
seeded. The local `.env` was never read, printed, or copied.

## Release candidates

The browser acceptance found defects on both sides of the package boundary, so
this is **two** candidates, not one. They ship independently and the plan's own
rule about separating unrelated changes applies.

### Candidate A — `najm-kit`

Accessibility and state-management fixes to shared primitives. Nothing here is
about the theme convention; all of it was found by driving the theme settings
page, because that page is where these primitives are used most densely.

| Change | File |
| --- | --- |
| Shared focus token (`focusRingClasses`, `focusRingWithinClasses`) | `src/theme/focus.ts` |
| Tab panels get a focus ring — they are `tabIndex=0` and had none | `src/components/ui/tabs.tsx` |
| Collapsible triggers get a focus ring from the primitive | `src/components/ui/collapsible.tsx` |
| Composite input wrappers show focus for the stripped control inside | `src/components/inputs/BaseInput.tsx` |
| Customizer sections use the shared token instead of their own ring | `src/components/ThemeCustomizer/*.tsx` |
| Dialogs return focus to the control that opened them | `src/components/Dialog/Dialog.tsx` |
| `setCommitted` identity guard | `src/providers/designEditor.tsx` |

Public API change: additive only — two exported class-name constants.

### Candidate B — `najm-theme@0.2.0`

| Change | File |
| --- | --- |
| Infinite-render fix in the settings provider | `src/react/providers/NThemeSettingsProvider.tsx` |
| Pre-hydration factory fallback | `src/react/components/NThemeImage.tsx` |
| Each reset names its own resource | `src/react/components/NThemeSettingsResetButton.tsx`, `NThemeSettingsActions.tsx` |
| `actions.resetAppearance` / `actions.resetBranding` in all four locales | `src/server/locales/*.json` |

Candidate B's action bar depends on nothing new in Candidate A: the labels and
the provider fix stand alone. Candidate A is what makes step 4.14 pass.

## How to reproduce

From the repository root. The suite deliberately does **not** boot a server; it
measures one that is already running, and refuses to run against `next dev`.

```powershell
bun install --frozen-lockfile
$env:DATABASE_URL='../../.runtime/playground-theme-acceptance.db'
$env:COOKIE_SECURE='false'
bun run --cwd apps/playground db:migrate
bun run --cwd apps/playground db:seed
bun run playground:next:build
bun run playground:next:bg
bun run playground:next:status     # expect: listening on port 3000
bun run test:theme:e2e
bun run playground:next:stop
```

The run must start from a **freshly seeded** database. The first step asserts
that both auth marks are factory files, so a database still holding a previous
run's uploads fails immediately — by design, rather than silently measuring the
wrong state.

**Restart the server between runs.** The login route is rate limited to five
attempts per identity per fifteen minutes. One full run spends three, so two
runs inside the window trip the limiter and the suite fails on
"Too many login attempts" rather than on anything about the theme. The recipe
above restarts the server, which clears the in-memory counter; the suite itself
was also reduced from four sign-ins to three, and deliberately does **not**
cache and replay the session — see the comment on `signIn`.

## Automated gates

| Gate | Result |
| --- | --- |
| `bun run lint:theme` | pass |
| `bun run --cwd packages/najm-kit lint` | pass |
| `bun run test:theme` | pass — 445 tests (344 + 80 + 21), 0 failures |
| `bun run --cwd packages/najm-theme test:next16` | pass, including the negative Client Component import guard |
| `bun run api:check` | pass — snapshot current; the only change is two additive `najm-kit` exports |
| `bun --cwd apps/playground test` | pass — 18 tests, 0 failures |
| `bun run --cwd packages/najm-kit test` | pass — 1103 passed (1096 + 7 RSC), 14 skipped, 0 failures |
| `bun run playground:next:build` | pass, exit code `0` |

The two suite counts moved by exactly what was added: `najm-kit` from 1088 to
1103 (11 focus-visible, 3 design-editor, 1 dialog), and `najm-theme` from 444 to
445 (the distinct reset names). Both totals are the sum of two runs — the main
suite plus the `react-server` conditions pass — which is worth stating because
reading either number alone makes the arithmetic look wrong.

## Browser acceptance

`bun run test:theme:e2e` — **13 tests, 0 failures**. Desktop 1440x1000 and
mobile 390x844, both Chromium, one run.

| # | State | Result | Screenshot |
| --- | --- | --- | --- |
| 1 | Signed-out login, factory marks, hashed URLs, immutable cache headers | pass | `playground/01-factory-login-desktop.png` |
| 2 | Expanded sidebar mark (PNG) | pass | `playground/02-factory-sidebar-expanded.png` |
| 3 | Collapsed sidebar mark (WebP), distinct file | pass | `playground/03-factory-sidebar-collapsed.png` |
| 4 | Settings composite: Appearance, Branding, Saved themes, action bar | pass | `playground/04-settings.png` |
| 5 | Appearance change saves, previews live, survives reload | pass | — |
| 6 | Four-slot upload, save, persistence across dashboard, sign-out, login | pass | `playground/05-managed-login.png`, `playground/06-managed-sidebar.png` |
| 7 | Controlled managed-asset 404 falls back to that slot's factory file | pass | `playground/07-factory-fallback.png` |
| 8 | Branding reset restores all four factory files, and its one 404 is pinned | pass | `playground/08-reset.png` |
| 9 | Appearance reset restores the design from `theme/theme.json` | pass | — |
| 10 | Keyboard: reach, visible focus, no trap, distinct resets, focus return | **pass** | — |
| 11 | Final state: no broken image, no console error, no failed request | pass | — |
| 12 | Mobile login: logo shown, hero hidden, no horizontal scroll | pass | `playground/09-login-mobile.png` |
| 13 | Mobile settings fits 390px, and is keyboard-navigable there too | pass | — |

**All twelve of the plan's section-4 boxes now pass, 4.14 included.** It was
recorded as partially met in the previous run and is no longer.

### What the keyboard step actually asserts

One walk from the top of the document to the end of the action bar answers three
questions at once, because they are the same walk:

- **Reach** — Tab arrives at the branding reset on its own. Not at Save: Save is
  disabled while nothing is dirty and is correctly not a tab stop. The test
  proves that is the only reason by making the surface dirty and showing Save
  becomes the very next stop, with a ring, then discarding by keyboard.
- **Visible** — every stop inside `.najm-theme-settings` shows an outline or a
  painted ring. A ring is only counted when it has size and a non-transparent
  colour; `rgba(0,0,0,0) 0 0 0 0` is what an element reports mid-transition, and
  accepting it would let a missing indicator pass. Where the indicator belongs to
  a wrapper (composite inputs), an ancestor counts only if it is itself in a
  focused state **and** what it paints is geometrically a ring — `0 0 0 3px`, not
  a drop shadow — so a decorative `shadow-sm` enclosing the control cannot stand
  in for a focus indicator.
- **No trap** — no element holds focus across three consecutive Tabs, and inside
  the confirmation, six Tabs all stay within the dialog while Escape still exits.

Then: the two resets are asserted to have distinct accessible names, the
confirmation is opened with Enter and dismissed with Escape, and focus is
asserted to return to the trigger.

### The reset 404 is pinned, not waved through

The plan permits one 404 during branding reset — the request for the managed
file the reset has just deleted. "Permitted" is now a much narrower claim than a
regex allowance:

- The four managed URLs are **captured before** the reset runs.
- Health buffers are asserted clean immediately before it, so everything drained
  afterwards was caused by it.
- Every failed request must be a `404` **for one of those exact captured URLs**.
- Every slot must then not merely re-point to its factory file but **paint** it.
- The next step asserts clean with **no allowance at all**, which is what proves
  the 404 belongs to that step and does not follow the run around.
- Step 6, which breaks the managed route on purpose, drains its own injected
  failures rather than leaving them for step 7 to excuse.

### What the screenshots prove

The upload fixtures are deliberately loud — an orange `UPLOAD:auth-hero` panel
and a green `UPLOAD:auth-logo` badge — so `01` and `05` cannot be confused. A
reviewer can see which source rendered without reading a single assertion.

`07` is the important one: the managed assets were 404'd at the network layer
and both factory images still render, with no broken-image glyph.

### PNG and WebP

Both formats are proven by rendered responses rather than by unit tests, in both
directions. The factory directory ships `auth-hero.png` + `sidebar-logo-expanded.png`
and `auth-logo.webp` + `sidebar-logo-collapsed.webp`; each upload fixture is in
the *opposite* format to the factory file it replaces, so a single pass exercises
PNG and WebP on both the factory and the managed path.

Factory responses were checked for status `200`, the correct `Content-Type`, and
`cache-control: public, max-age=31536000, immutable`.

## Defects found and fixed during this run

Every one of these was invisible to the unit suites, which passed before and
after. They were found only by driving a production build in a real browser.

**1. Infinite render loop blanked the entire settings page (blocking).**
Opening `/dashboard/theme` threw React error #185 ("Maximum update depth
exceeded") and rendered no settings surface at all — no tabs, no sections, no
action bar. `NThemeSettingsProvider` mirrors the design into the kit's runtime
provider from an effect that depended on the editor object while calling that
editor's setters: each write produced a new provider value, which re-ran the
effect, which wrote again. Fixed by holding the editor in a ref so the effect
depends on the design *values* that should trigger it
(`packages/najm-theme/src/react/providers/NThemeSettingsProvider.tsx`).

**2. The same loop on every appearance edit (blocking).**
Changing any design token re-entered the loop through `setDraft`, which clones
its input and therefore always produced new state. Resolved by the same ref fix.
`najm-kit`'s `setCommitted` was additionally given the identity guard its
siblings `beginDraft` and `cancelDraft` already had, so a redundant call is a
no-op while adopting a design with a draft open still clears that draft
(`packages/najm-kit/src/providers/designEditor.tsx`).

That guard is **kept, and now earns its place**: three tests in
`test/design-editor.test.tsx` cover it. One mounts a consumer shaped like
`najm-theme`'s — an effect that re-publishes the committed design, keyed on the
provider value — and removing the guard makes it throw React's "Maximum update
depth exceeded" out of the mount, which was verified. The other two hold the
existing behaviour still: an equal-but-distinct design is a real write and is
adopted, and re-adopting the design already committed **still discards an open
draft**. That last one is the case a lazier guard breaks — skipping on "same
design?" alone would leave the draft on screen, and discarding it is the second
job this command has always had.

**3. Factory fallback never fired for server-rendered images (blocking).**
A managed asset that is already missing when the page is server-rendered stayed
broken permanently. The browser fetches and fails the `<img>` while the HTML is
parsing — before hydration attaches `onError` — and React does not replay that
error, so the fallback only ever covered failures occurring *after* hydration.
`NThemeImage` now also reads the DOM on mount, where an image that is `complete`
with zero intrinsic width is one that failed whenever it failed
(`packages/najm-theme/src/react/components/NThemeImage.tsx`). Covered by a new
unit test, verified to fail without the fix.

The `najm-theme` react test environment also claimed every `<img>` was
`complete` with zero width — the exact signature of a broken image — which would
have made the new check misfire in tests. happy-dom never fetches, so `complete`
is now `false` there, which is the honest model.

## Accessibility defects found and fixed in this round

The previous run recorded findings 4 and 5 as open, and step 4.14 as partially
met. Both are now fixed, along with two more that the stricter assertions
exposed.

**4. Two buttons shared the accessible name "Reset to factory" (fixed).**
The action bar rendered the appearance reset and the branding reset with
identical labels — two irreversible actions, side by side, told apart only by
the order they happened to render in. Each now names its own resource: "Reset
appearance to factory" and "Reset branding to factory", in all four locales. The
confirmation button inside the dialog keeps the short "Reset to factory", where
the title already says which resource it is.

**5. Focus was invisible on several najm-kit primitives (fixed).**
Corrected from the previous run, which reported this too broadly. Measured
against the built surface with the transition settled:

- `tabs-content` — the real defect. Radix gives the panel `tabIndex=0`, and the
  kit gave it `outline-none` and nothing else. Five silent tab stops on the
  settings page: focus went in and the screen did not change.
- `tabs-trigger` — **was not broken.** It already carried
  `focus-visible:ring-[3px] ring-ring/50`. The earlier report measured it during
  its own `box-shadow` transition and read the transparent first frame as "no
  ring". It now uses the shared token and is covered by a test.
- `collapsible-trigger` — visible only because each consumer remembered to add a
  ring. The primitive itself had none, so any other consumer got nothing. The
  ring moved into the primitive.
- `BaseInput` — found by the new strict assertion. Composite inputs (the sidebar
  width fields, the multi-select trigger) strip the inner control bare so the
  wrapper can own the border, and then only changed that border's *colour* on
  focus. The wrapper now draws the ring, for focus landing on itself and for
  focus landing on a child.

All of it flows from one token, `focusRingClasses`, so the next primitive cannot
suppress the outline without replacing it.

**6. Dialogs did not return focus to the control that opened them (fixed).**
Pressing Escape on the reset confirmation dropped focus to `<body>`, so the next
Tab restarted at the top of the page. The primitive does attempt the restore,
but it runs while the rest of the page is still inside the subtree it made
inert, and `focus()` on an inert element is a no-op.

This one is worth dwelling on, because **the previous run reported it as
passing.** The old assertion read `document.activeElement?.textContent` and
checked it contained "Reset to factory" — and `document.body.textContent` is the
whole page, which contains that string. The assertion could not fail. It was
replaced with an exact match on the accessible name of the focused element, at
which point the defect appeared immediately. `DialogContent` now captures the
opener in `onOpenAutoFocus` — the last moment it still holds focus — and
restores it after the teardown, but only when focus was actually lost.

**7. Reset logs one 404 for the asset it just deleted (accepted, and pinned).**
Branding reset removes the managed files immediately, so an `<img>` still
mounted against one requests a file that no longer exists. The slot recovers to
its factory file on its own and every slot ends painted. This is the one
permitted failure in the run, and the spec now proves it is that request and no
other — see "The reset 404 is pinned" above. If the intent is a silent reset,
the files would need a grace period rather than an immediate delete; that is a
product decision, not a defect in this candidate.

## Regression tests added

Each was verified to fail without its fix, not merely to pass with it.

| Test | Guards | Verified red without the fix |
| --- | --- | --- |
| `najm-kit/test/focus-visible.test.tsx` (11) | the focus token, tab triggers, tab panels, collapsible triggers incl. `asChild`, composite input wrappers | yes — panel assertions fail with `outline-none` restored |
| `najm-kit/test/design-editor.test.tsx` (+3) | the `setCommitted` identity guard, and the draft-clearing it must not lose | yes — throws "Maximum update depth exceeded" |
| `najm-kit/test/dialog.test.tsx` (+1) | focus returns to the opener after Escape | yes |
| `najm-theme/test/react/accessibility.test.tsx` (+1) | the two resets have distinct accessible names | yes — the old shared label fails it |
| `najm-theme/test/react/branding-image.test.tsx` | pre-hydration factory fallback | yes (previous round) |

The focus tests assert the rendered class list, not a computed style, because
happy-dom does not run Tailwind. That is their honest limit: they prove the
primitive *asks* for the ring. Proof that it *paints* comes from the Playwright
run, which reads `box-shadow` off a real Chromium — and that is where every one
of these defects was found in the first place.

## Open findings — not fixed, needing a decision

**8. Non-theme console noise.**
`/favicon.ico` 404 (the playground ships no icon) and two `/api/cart` 401s from
the storefront demo. Both are named exemptions in
`apps/playground/test/e2e/support/constants.ts`, not a blanket filter — anything
else fails the run.

## Environment notes

**The server error log accumulates across runs.** `.logs/playground-next.err.log`
is append-only and still holds entries from months of earlier dev-mode sessions
(`useLayoutEffect is not defined`, Fast Refresh reloads, "Could not find a
production build"). Read literally, the plan's "no server error in the log" gate
can never pass. Truncate it before a run, or read only the tail written after
the server started. For this run, the only lines produced were the harmless
multiple-lockfile warning and the `exit code 1` from `playground:next:stop`
terminating the process.

**Runtime uploads used to dirty the tree.** Saved branding assets are written to
`apps/playground/storage/theme-branding-platform/`, which sits inside a tracked
directory and was not ignored, so every acceptance run left orphaned files in
`git status`. That path is now in `.gitignore` and the leftovers were removed.
After the final run and shutdown, `git status` reports no runtime file.

**A stray `bun.lock` in the home directory** (`C:\Users\hdevlop\bun.lock`) makes
Next infer the wrong workspace root, which it warns about on every build. It
also brought a `C:\Users\hdevlop\node_modules` into existence, and a script run
directly with `bun` from `apps/playground` resolves `playwright-core` from
*there* instead of the repository — where it hangs on browser launch until it
times out. Run browser code through `playwright test`, which resolves correctly.
Both are outside the repository and were left in place; deleting them is the
user's call.

`npx` could not run anywhere in this repository: root `package.json` pinned
`@hono/node-server` and `zod` in `overrides` to versions that conflicted with
their own direct dependency ranges, and npm hard-fails with `EOVERRIDE`. Bun
does not enforce that rule, so every install and build worked while `npx` — and
therefore every stdio MCP server launched from this directory — was broken. Both
entries now use npm's `$name` form. Unrelated to the theme, but it blocked the
tooling this acceptance run needed.

## Not covered

- Firefox and WebKit. Chromium only, as the plan requires for the blocking run.
- RTL, which the plan scopes to Kafil.
- Kafil migration and its browser gates (plan section 8).
- Packaging, tarball smoke test, commit, push, publication (plan section 9).
- **Contrast ratios of the focus ring.** The run proves an indicator is painted
  and that it comes from the theme's `--ring` token. It does not measure the
  3:1 contrast WCAG 2.4.11 asks for, and an application that writes a low
  contrast `--ring` would still pass this suite.
- Screen-reader announcement. The resets are asserted to have distinct
  accessible *names*; nothing here drives NVDA or VoiceOver.

## One thing worth carrying forward

Two assertions in the previous round passed without testing anything:
`document.activeElement?.textContent` matched against a substring, where
`document.body.textContent` is the whole page and contains every string on it;
and a focus-ring check that accepted `rgba(0,0,0,0) 0 0 0 0`, which is what an
element reports while its transition is still running. Both read as green. One
of them was covering a real, blocking accessibility defect.

The pattern in both: an assertion loose enough that the broken state satisfies
it. Every focus assertion in this round is therefore exact rather than
substring, and every regression test was run against the un-fixed code to
confirm it goes red. A test that has never failed has not been tested.
