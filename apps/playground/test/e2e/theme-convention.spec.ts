// ============================================================================
// Playground — najm-theme 0.2 browser acceptance
// ============================================================================
//
// The state sequence from the release plan, run against a production build.
// It is one continuous story per viewport rather than a set of independent
// checks: "the logo persists after sign-out" only means something if the same
// browser uploaded it, and "reset restores the factory file" only means
// something if a managed file was there to remove.
//
// That is why this file is serial and shares one page. It also means a failure
// stops the story — which is correct, because every step after it would be
// asserting against a state the run never actually reached.
// ============================================================================

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { EVIDENCE_DIR, SLOTS } from './support/constants';
import {
  actionBar,
  brandingSlot,
  expectNoBrokenImages,
  expectNoHorizontalOverflow,
  expectPainted,
  fetchAssetHeaders,
  focusedStop,
  hasVisibleFocusIndicator,
  imageSrc,
  openSettingsTab,
  signIn,
  tabTo,
  watchPageHealth,
  type FocusStop,
  type PageHealth,
} from './support/theme';

// The playground is an ES module package, so there is no `__dirname` to lean on.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, 'fixtures', 'theme');
const FACTORY_URL = /^\/api\/theme\/branding\/factory\/[A-Za-z]+\.[0-9a-f]{8,}\.(png|webp)$/;

/**
 * The upload for each slot, deliberately in the *other* format to the factory
 * file it replaces. That way one pass proves PNG and WebP both round-trip as
 * managed assets and both render from the factory directory.
 */
const UPLOADS: Record<string, string> = {
  sidebarLogoExpanded: 'sidebar-logo-expanded.webp', // factory ships .png
  sidebarLogoCollapsed: 'sidebar-logo-collapsed.png', // factory ships .webp
  authLogo: 'auth-logo.png', // factory ships .webp
  authHeroImage: 'auth-hero.webp', // factory ships .png
};

function evidence(name: string): string {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  return path.join(EVIDENCE_DIR, name);
}

const authLogo = (page: Page) => page.getByRole('img', { name: 'Najm Playground' });
/** The hero is decorative (`alt=""`), so it is reachable only as an element. */
const authHero = (page: Page) => page.locator('main img[alt=""]');
const sidebarLogo = (page: Page) => page.locator('aside img[alt="Najm Playground"]');
const saveButton = (page: Page) => actionBar(page).getByRole('button', { name: 'Save changes' });

/**
 * Each reset names the resource it destroys, so both are addressable directly.
 *
 * They used to share the name "Reset to factory" and had to be told apart by
 * position — two identical destructive controls, distinguished only by the
 * order they happened to render in. `exact` matters here: Playwright's default
 * name matching is a substring, and this is precisely the ambiguity being
 * asserted away.
 */
const RESET = {
  appearance: { button: 'Reset appearance to factory', confirm: 'Reset appearance?' },
  branding: { button: 'Reset branding to factory', confirm: 'Reset branding?' },
} as const;

/** The confirmation for one resource. Filtered by title — colour pickers are dialogs too. */
function confirmDialog(page: Page, which: 'appearance' | 'branding') {
  return page
    .getByRole('alertdialog')
    .or(page.getByRole('dialog'))
    .filter({ hasText: RESET[which].confirm });
}

function resetButton(page: Page, which: 'appearance' | 'branding') {
  return actionBar(page).getByRole('button', { name: RESET[which].button, exact: true });
}

async function resetVia(page: Page, which: 'appearance' | 'branding'): Promise<void> {
  await expect(resetButton(page, which)).toHaveCount(1);
  await resetButton(page, which).click();

  const dialog = confirmDialog(page, which);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Reset to factory', exact: true }).click();
  await expect(dialog).toBeHidden();
}

/**
 * The live value of one design token.
 *
 * Read from the element the runtime provider actually writes to, which is an
 * inline-styled wrapper inside `<body>` — not `documentElement`. Reading the
 * root instead returns the stylesheet's static default, which never changes no
 * matter what the editor does, and would make this assertion permanently green.
 */
async function radiusPx(page: Page): Promise<number> {
  const raw = await page.evaluate(() => {
    const carrier = [...document.querySelectorAll<HTMLElement>('[style*="--radius"]')][0]
      ?? document.documentElement;
    return getComputedStyle(carrier).getPropertyValue('--radius').trim();
  });
  // Normalised to pixels because the two ends of this assertion use different
  // units: the factory design ships `0.5rem`, and the customizer writes the
  // pixel value the operator picked. Comparing the raw strings would be
  // comparing spellings rather than radii.
  const value = Number.parseFloat(raw);
  return /rem$/.test(raw) ? value * 16 : value;
}

/**
 * Tabs from the top of the document until it reaches `endAt`, or runs out.
 *
 * One walk answers all three keyboard questions at once — reach, visibility,
 * and traps — because they are the same walk. Splitting them into three tests
 * would tab through the customizer three times for no extra evidence.
 *
 * `endAt` is the last *enabled* control on the action bar rather than the last
 * rendered one. A disabled button is deliberately not a tab stop, so ending on
 * one would make this walk fail for a behaviour the action bar is supposed to
 * have. Which is how this helper was first written, and it failed exactly that
 * way: with nothing dirty, Save is disabled and Tab walks straight past it.
 */
async function tabThroughSettings(page: Page, endAt: string, limit = 320) {
  await page.locator('body').press('Tab');

  const stops: FocusStop[] = [];
  const invisible: string[] = [];
  const repeated: string[] = [];
  let reachedEnd = false;
  let sameAsLast = 1;

  let stop = await focusedStop(page);
  for (let index = 0; index < limit && stop; index += 1) {
    stops.push(stop);

    if (stop.inSettings && !hasVisibleFocusIndicator(stop)) {
      invisible.push(`${stop.id} — outline: ${stop.outline}; box-shadow: ${stop.boxShadow}`);
    }

    const previous = stops[stops.length - 2];
    if (previous && previous.id === stop.id) {
      sameAsLast += 1;
      if (sameAsLast >= 3 && !repeated.includes(stop.id)) repeated.push(stop.id);
    } else {
      sameAsLast = 1;
    }

    if (stop.name === endAt) {
      reachedEnd = true;
      break;
    }
    stop = await tabTo(page);
  }

  return { stops, invisible, repeated, reachedEnd };
}

/** Both resets are present, and no two controls on the bar share a name. */
async function expectDistinctResetNames(page: Page): Promise<void> {
  const labels = await actionBar(page)
    .getByRole('button')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => node.getAttribute('aria-label') ?? (node.textContent ?? '').trim())
        .filter((label) => /reset/i.test(label)),
    );

  expect(labels.sort()).toEqual([RESET.appearance.button, RESET.branding.button].sort());
  expect(new Set(labels).size, 'the two resets are distinguishable by name').toBe(labels.length);
}

// ---------------------------------------------------------------------------

test.describe.configure({ mode: 'serial' });

let page: Page;
let health: PageHealth;

test.beforeAll(async ({ browser }, testInfo) => {
  // `browser.newPage()` would ignore the project's device and viewport, which
  // is the entire difference between the desktop and mobile runs.
  const context = await browser.newContext({ ...(testInfo.project.use as Record<string, unknown>) });
  page = await context.newPage();
  health = watchPageHealth(page);
});

test.afterAll(async () => {
  await page?.context().close();
});

// ===========================================================================
// Desktop — the full sequence
// ===========================================================================

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile === true, 'desktop project only');

  test('1. signed-out login serves both factory marks over immutable hashed URLs', async () => {
    await page.goto('/login');

    await expectPainted(authLogo(page), 'auth logo');
    await expectPainted(authHero(page), 'auth hero');

    const logoSrc = await imageSrc(authLogo(page));
    const heroSrc = await imageSrc(authHero(page));
    expect(logoSrc, 'auth logo is a hashed factory URL').toMatch(FACTORY_URL);
    expect(heroSrc, 'auth hero is a hashed factory URL').toMatch(FACTORY_URL);

    // The factory directory is deliberately mixed, and this is where that stops
    // being a claim in a plan and becomes a served response.
    expect(logoSrc, 'auth logo ships as WebP').toMatch(/\.webp$/);
    expect(heroSrc, 'auth hero ships as PNG').toMatch(/\.png$/);

    for (const [src, mime] of [
      [logoSrc, 'image/webp'],
      [heroSrc, 'image/png'],
    ] as const) {
      const headers = await fetchAssetHeaders(page, src);
      expect(headers.status, `${src} status`).toBe(200);
      expect(headers.contentType, `${src} content-type`).toContain(mime);
      expect(headers.cacheControl, `${src} is immutably cached`).toContain('immutable');
      expect(headers.cacheControl, `${src} caches for a year`).toContain('max-age=31536000');
    }

    await expectNoHorizontalOverflow(page, 'login (desktop)');
    await page.screenshot({ path: evidence('01-factory-login-desktop.png'), fullPage: true });
    health.assertClean('factory login');
  });

  test('2. both sidebar marks render their own factory file', async () => {
    await signIn(page);

    await expectPainted(sidebarLogo(page), 'expanded sidebar logo');
    const expanded = await imageSrc(sidebarLogo(page));
    expect(expanded).toMatch(FACTORY_URL);
    expect(expanded, 'expanded mark ships as PNG').toMatch(/\.png$/);
    await page.screenshot({ path: evidence('02-factory-sidebar-expanded.png') });

    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expectPainted(sidebarLogo(page), 'collapsed sidebar logo');
    const collapsed = await imageSrc(sidebarLogo(page));
    expect(collapsed, 'the collapsed mark is a different file').not.toBe(expanded);
    expect(collapsed, 'collapsed mark ships as WebP').toMatch(/\.webp$/);
    await page.screenshot({ path: evidence('03-factory-sidebar-collapsed.png') });

    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();
    health.assertClean('factory sidebar');
  });

  test('3. the settings composite renders every section from the package', async () => {
    await page.goto('/dashboard/theme');

    for (const name of ['Appearance', 'Branding', 'Saved themes']) {
      await expect(page.getByRole('tab', { name, exact: true })).toBeVisible();
    }
    await expect(actionBar(page)).toBeVisible();
    await expect(saveButton(page)).toBeVisible();

    await expectNoHorizontalOverflow(page, 'theme settings');
    await page.screenshot({ path: evidence('04-settings.png'), fullPage: true });
    health.assertClean('settings render');
  });

  test('4. an appearance change saves and survives a reload', async () => {
    await openSettingsTab(page, 'Appearance');
    const before = await radiusPx(page);
    expect(before, 'factory radius is 0.5rem').toBe(8);

    await page.getByRole('combobox', { name: 'Radius' }).click();
    await page.getByRole('option', { name: '24px', exact: true }).click();

    // The live preview is the point of the runtime provider: the draft reaches
    // the rendered tree before anything is persisted.
    await expect.poll(() => radiusPx(page), { message: 'radius previews live' }).toBe(24);

    await expect(saveButton(page)).toBeEnabled();
    await saveButton(page).click();
    await expect(saveButton(page), 'save clears the draft').toBeDisabled();

    await page.reload();
    expect(await radiusPx(page), 'radius persisted').toBe(24);
    health.assertClean('appearance save');
  });

  test('5. all four branding slots upload, save, and persist across pages', async () => {
    await openSettingsTab(page, 'Branding');

    for (const slot of SLOTS) {
      const input = brandingSlot(page, slot.key).locator('input[type=file]');
      await input.setInputFiles(path.join(FIXTURES, UPLOADS[slot.key]));
    }

    await expect(saveButton(page), 'four candidates make the form dirty').toBeEnabled();
    await saveButton(page).click();
    await expect(saveButton(page), 'branding save commits').toBeDisabled();

    await page.reload();
    await openSettingsTab(page, 'Branding');
    for (const slot of SLOTS) {
      const image = brandingSlot(page, slot.key).locator('img').first();
      await expectPainted(image, `${slot.key} preview`);
      expect(await imageSrc(image), `${slot.key} is now managed`).not.toMatch(FACTORY_URL);
    }

    // The real positions, which is what the plan actually asks about.
    await page.goto('/dashboard');
    await expectPainted(sidebarLogo(page), 'managed expanded mark');
    expect(await imageSrc(sidebarLogo(page))).not.toMatch(FACTORY_URL);
    await page.screenshot({ path: evidence('06-managed-sidebar.png') });

    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expectPainted(sidebarLogo(page), 'managed collapsed mark');
    expect(await imageSrc(sidebarLogo(page))).not.toMatch(FACTORY_URL);
    await page.getByRole('button', { name: 'Expand sidebar' }).click();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL('**/login');
    await expectPainted(authLogo(page), 'managed auth logo');
    await expectPainted(authHero(page), 'managed auth hero');
    expect(await imageSrc(authLogo(page)), 'managed logo survives sign-out').not.toMatch(FACTORY_URL);
    expect(await imageSrc(authHero(page)), 'managed hero survives sign-out').not.toMatch(FACTORY_URL);
    await page.screenshot({ path: evidence('05-managed-login.png'), fullPage: true });

    health.assertClean('branding upload');
  });

  test('6. a missing managed asset falls back to that slot factory file', async () => {
    // Only the managed route is broken. Blocking the factory route too would
    // prove nothing except that an image with no candidates renders nothing.
    await page.route('**/api/theme/branding/assets/**', (route) => route.fulfill({ status: 404 }));

    await page.goto('/login');
    await expectPainted(authLogo(page), 'fallback auth logo');
    const fallback = await imageSrc(authLogo(page));
    expect(fallback, 'the slot fell back to its own factory file').toMatch(FACTORY_URL);
    expect(fallback, 'and to the right one').toContain('authLogo.');

    await page.screenshot({ path: evidence('07-factory-fallback.png'), fullPage: true });
    await page.unroute('**/api/theme/branding/assets/**');

    // This step breaks the managed route on purpose, so it owns the failures it
    // caused and clears them here. Leaving them in the buffer would force the
    // next step to allow the same pattern, and the release plan's claim about
    // the reset 404 is that it happens *only* during the reset.
    const injected = health.drain();
    expect(injected.pageErrors, 'a blocked asset must not throw').toEqual([]);
    for (const entry of [...injected.consoleErrors, ...injected.failedThemeRequests]) {
      expect(entry, 'only the deliberately blocked managed route failed').toContain(
        '/api/theme/branding/assets/',
      );
    }
  });

  test('7. branding reset restores all four factory files', async () => {
    await signIn(page);
    await page.goto('/dashboard/theme');
    await openSettingsTab(page, 'Branding');

    // The URLs about to be deleted, recorded before they are. The reset's one
    // expected 404 is only acceptable if it is a request for *these* — a 404
    // for anything else on the same route is a defect wearing the same shape.
    const managed = new Set<string>();
    for (const slot of SLOTS) {
      const src = await imageSrc(brandingSlot(page, slot.key).locator('img').first());
      expect(src, `${slot.key} is managed before the reset`).not.toMatch(FACTORY_URL);
      managed.add(src);
    }

    // A clean baseline, so everything drained after the reset was caused by it.
    health.assertClean('before branding reset');

    await resetVia(page, 'branding');

    for (const slot of SLOTS) {
      const image = brandingSlot(page, slot.key).locator('img').first();
      await expect
        .poll(async () => (await image.getAttribute('src')) ?? '', {
          message: `${slot.key} returned to its factory file`,
        })
        .toMatch(FACTORY_URL);
      // The fallback has to *render*, not merely re-point: a slot showing the
      // browser's broken-image glyph would satisfy the src assertion above.
      await expectPainted(image, `${slot.key} factory fallback after reset`);
    }

    await page.goto('/dashboard');
    await expectPainted(sidebarLogo(page), 'restored sidebar mark');
    expect(await imageSrc(sidebarLogo(page))).toMatch(FACTORY_URL);
    await expectNoBrokenImages(page, 'after branding reset');
    await page.screenshot({ path: evidence('08-reset.png') });

    // Reset deletes the managed files immediately, so an `<img>` still mounted
    // against one of them requests a file that no longer exists. The slot
    // recovers on its own — that is the fallback doing its job — and the
    // assertions above have already proved every slot ended on a factory file
    // that painted. What remains is to show the request was *that* one and
    // nothing else: each failure must be a 404 for a URL captured above.
    const observed = health.drain();
    expect(observed.pageErrors, 'the reset must not throw').toEqual([]);

    const isDeletedManagedAsset = (entry: string) =>
      [...managed].some((url) => entry.includes(url));

    for (const entry of observed.failedThemeRequests) {
      expect(entry, `unexpected failed theme request: ${entry}`).toMatch(/^404 /);
      expect(isDeletedManagedAsset(entry), `404 is for a deleted managed asset: ${entry}`).toBe(
        true,
      );
    }
    for (const entry of observed.consoleErrors) {
      expect(
        isDeletedManagedAsset(entry),
        `unexpected console error during reset: ${entry}`,
      ).toBe(true);
    }

    // Step 8 calls `assertClean` with no allowance at all, which is what proves
    // this 404 belongs to the reset and does not follow the run around.
  });

  test('8. appearance reset restores the design from theme.json', async () => {
    await page.goto('/dashboard/theme');
    await resetVia(page, 'appearance');

    await expect
      .poll(() => radiusPx(page), { message: 'radius returned to the factory design' })
      .toBe(8);

    await page.reload();
    expect(await radiusPx(page), 'and stayed there').toBe(8);
    health.assertClean('appearance reset');
  });

  test('9. the settings surface is reachable, visible, and operable by keyboard', async () => {
    await page.goto('/dashboard/theme');
    await openSettingsTab(page, 'Appearance');

    const walk = await tabThroughSettings(page, RESET.branding.button);

    // 1. Reach. Tab has to arrive at the far end of the surface on its own.
    // The action bar is the last thing in the settings tree, so reaching the
    // branding reset means every control between here and there was traversable.
    expect(
      walk.reachedEnd,
      `Tab never reached the branding reset in ${walk.stops.length} stops`,
    ).toBe(true);

    // 2. No trap. A control that keeps handing focus back to itself is how a
    // keyboard user gets stuck on a page with no pointer to rescue them.
    expect(walk.repeated, 'a control held focus across three consecutive Tabs').toEqual([]);

    // 3. Visible. Every stop inside the settings surface must show an outline
    // or a painted ring. This is the assertion the previous run could not make:
    // najm-kit's tab panels were focusable with `outline-none` and nothing in
    // its place, and its collapsible triggers depended on each consumer
    // remembering a ring. Both now carry the kit's shared focus token.
    expect(walk.invisible, 'focused with no visible indicator').toEqual([]);

    // 4. Every relevant trigger was actually among the stops, so the three
    // assertions above are not passing over an empty walk.
    const slots = new Set(walk.stops.map((stop) => stop.slot));
    expect(slots, 'tab triggers are reachable').toContain('tabs-trigger');
    expect(slots, 'the tab panel is reachable').toContain('tabs-content');
    expect(slots, 'collapsible section triggers are reachable').toContain('collapsible-trigger');

    const names = walk.stops.map((stop) => stop.name);
    expect(names, 'the branding reset is reachable').toContain(RESET.branding.button);

    // 5. The two resets are told apart by name, not by position.
    await expectDistinctResetNames(page);

    // 6. Save and the appearance reset are absent from that walk, and the only
    // reason is that both are disabled: the run is sitting on the factory
    // design with nothing unsaved. The action bar keeps them rendered so it
    // does not reflow as an administrator edits, and a disabled control is
    // correctly not a tab stop. Proved rather than assumed — make the surface
    // dirty and Save becomes reachable, with a ring, in one Tab from here.
    await expect(saveButton(page), 'Save is disabled while nothing is dirty').toBeDisabled();
    await expect(resetButton(page, 'appearance')).toBeDisabled();

    await page.getByRole('combobox', { name: 'Radius' }).click();
    await page.getByRole('option', { name: '24px', exact: true }).click();
    await expect(saveButton(page)).toBeEnabled();

    await resetButton(page, 'branding').focus();
    const save = await tabTo(page);
    expect(save?.name, 'an enabled Save is the next tab stop').toBe('Save changes');
    expect(save && hasVisibleFocusIndicator(save), 'Save shows a focus ring').toBe(true);

    // Discarded by keyboard, which both exercises the third bar control and
    // hands the next step the factory state it expects.
    const discard = actionBar(page).getByRole('button', { name: 'Discard changes' });
    await expect(discard).toBeEnabled();
    await discard.focus();
    await page.keyboard.press('Enter');
    await expect(saveButton(page), 'the draft was discarded').toBeDisabled();
    expect(await radiusPx(page), 'and the factory radius came back').toBe(8);

    // 7. Operable: open the confirmation with Enter and dismiss it with Escape,
    // touching nothing but the keyboard. The branding reset, because the
    // appearance one is legitimately disabled here — step 8 restored the
    // factory design, and a reset with nothing to restore stays rendered but
    // inert. Pressing Enter on a disabled control proves nothing.
    const resetBranding = resetButton(page, 'branding');
    await expect(resetBranding).toBeEnabled();
    await resetBranding.focus();
    await page.keyboard.press('Enter');

    const dialog = confirmDialog(page, 'branding');
    await expect(dialog).toBeVisible();

    // 8. The dialog is modal, so Tab must cycle inside it rather than escape
    // behind it — and Escape must still get out. A modal that keeps focus but
    // refuses to close is the one trap worth checking twice.
    for (let index = 0; index < 6; index += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(
        () => document.activeElement?.closest('[role=alertdialog], [role=dialog]') !== null,
      );
      expect(inside, `dialog tab stop ${index} stayed inside the dialog`).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // 9. Focus comes back to what opened the dialog. Losing it to <body> is how
    // a keyboard user ends up back at the top of the page after cancelling.
    // Polled, not read once: the dialog restores focus after it unmounts, so a
    // single read the instant it disappears catches the frame where focus is
    // briefly on <body>.
    await expect
      .poll(async () => (await focusedStop(page))?.name ?? '<body>', {
        message: 'focus returns to the trigger that opened the dialog',
      })
      .toBe(RESET.branding.button);

    health.assertClean('keyboard acceptance');
  });

  test('10. the run ends with nothing broken and nothing logged', async () => {
    // The state a reviewer would find if they opened the application now:
    // factory design, factory images, every one of them painted.
    //
    // No sign-in here — step 7's session is still on this context, and the
    // login route is rate limited to five attempts per identity per fifteen
    // minutes. A gate that spends an attempt it does not need is a gate that
    // cannot be re-run.
    await page.goto('/login');
    await expectNoBrokenImages(page, 'login (final)');

    await page.goto('/dashboard');
    await expectNoBrokenImages(page, 'dashboard (final)');

    await page.goto('/dashboard/theme');
    await openSettingsTab(page, 'Branding');
    for (const slot of SLOTS) {
      await expectPainted(
        brandingSlot(page, slot.key).locator('img').first(),
        `${slot.key} final state`,
      );
    }
    await expectNoBrokenImages(page, 'theme settings (final)');

    health.assertClean('final state');
  });
});

// ===========================================================================
// Mobile — the auth and settings subset
// ===========================================================================

test.describe('mobile', () => {
  test.skip(({ isMobile }) => isMobile !== true, 'mobile project only');

  test('11. login keeps the logo, drops the hero, and never scrolls sideways', async () => {
    await page.goto('/login');

    await expectPainted(authLogo(page), 'mobile auth logo');
    expect(await imageSrc(authLogo(page))).toMatch(FACTORY_URL);

    // The hero is a scroll, not a brand, on a 390px screen.
    await expect(authHero(page), 'hero is hidden on mobile').toBeHidden();

    await expectNoHorizontalOverflow(page, 'login (mobile)');
    await page.screenshot({ path: evidence('09-login-mobile.png'), fullPage: true });
    health.assertClean('mobile login');
  });

  test('12. the settings surface fits a 390px viewport', async () => {
    await signIn(page);
    await page.goto('/dashboard/theme');

    await expect(actionBar(page)).toBeVisible();
    await expectNoHorizontalOverflow(page, 'theme settings (mobile)');

    await openSettingsTab(page, 'Branding');
    for (const slot of SLOTS) {
      await expect(brandingSlot(page, slot.key)).toBeVisible();
    }
    await expectNoHorizontalOverflow(page, 'branding section (mobile)');
    await expectNoBrokenImages(page, 'theme settings (mobile)');
    health.assertClean('mobile settings');
  });

  test('13. the settings surface is keyboard-navigable at 390px too', async () => {
    // A small viewport is not a pointer-only viewport: the same page is reached
    // from a tablet with a keyboard, and a narrow layout is exactly where a
    // control gets moved into a container that changes the tab order or clips
    // the ring away. Same walk, same three questions.
    await page.goto('/dashboard/theme');
    await openSettingsTab(page, 'Appearance');

    const walk = await tabThroughSettings(page, RESET.branding.button);

    expect(
      walk.reachedEnd,
      `Tab never reached the branding reset in ${walk.stops.length} stops`,
    ).toBe(true);
    expect(walk.repeated, 'a control held focus across three consecutive Tabs').toEqual([]);
    expect(walk.invisible, 'focused with no visible indicator (mobile)').toEqual([]);

    const slots = new Set(walk.stops.map((stop) => stop.slot));
    expect(slots, 'tab triggers are reachable').toContain('tabs-trigger');
    expect(slots, 'collapsible section triggers are reachable').toContain('collapsible-trigger');

    await expectDistinctResetNames(page);
    health.assertClean('mobile keyboard');
  });
});
