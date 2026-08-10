// ============================================================================
// Playground e2e — acceptance helpers
// ============================================================================

import { expect, type Locator, type Page } from '@playwright/test';

import { ADMIN, ALLOWED_CONSOLE_NOISE } from './constants';

/**
 * Everything the run is not allowed to produce, collected as it happens.
 *
 * Assertions at the end of a step read a list rather than a moment: a hydration
 * warning fires during the first paint and would be long gone by the time a
 * `toBeVisible()` resolves.
 */
export interface PageHealth {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly failedThemeRequests: string[];
  /**
   * Fails if anything unexplained arrived since the run began.
   *
   * `allow` narrows the bar for one step only. It exists so a step with a
   * genuinely expected failure does not have to be exempted globally, which
   * would hide the same failure everywhere else in the run.
   */
  assertClean(context: string, allow?: readonly RegExp[]): void;
  /**
   * Removes and returns everything collected so far.
   *
   * For the one step with a genuinely expected failure: a regex allowance says
   * "something roughly like this may happen", which is a weaker claim than the
   * release plan makes. Draining lets that step assert the exact requests it
   * expected, so an unrelated 404 that happens to share a path prefix still
   * fails the run.
   */
  drain(): {
    pageErrors: string[];
    consoleErrors: string[];
    failedThemeRequests: string[];
  };
}

const THEME_REQUEST = /\/api\/theme\//;

export function watchPageHealth(page: Page): PageHealth {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedThemeRequests: string[] = [];

  page.on('console', (message) => {
    if (message.type() !== 'error' && message.type() !== 'warning') return;

    // A failed-resource error reads "Failed to load resource: …" with the URL
    // only in `location()`. Matching on `text()` alone would make every such
    // error indistinguishable from every other, so the URL is folded in — both
    // to decide whether it is known noise and to report something actionable.
    const location = message.location()?.url ?? '';
    const text = location ? `${message.text()} @ ${location}` : message.text();

    // Hydration mismatches surface as warnings, not errors, and are exactly the
    // class of defect a server-rendered branding bootstrap can introduce.
    const isHydration = /hydrat/i.test(text);
    if (message.type() === 'warning' && !isHydration) return;
    if (ALLOWED_CONSOLE_NOISE.some((pattern) => pattern.test(text))) return;

    consoleErrors.push(text);
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('response', (response) => {
    const url = response.url();
    if (!THEME_REQUEST.test(url)) return;
    // 409 is the revision-conflict contract, not a transport failure; nothing
    // in this suite is expected to provoke one, so it still counts as failed.
    if (response.status() >= 400) {
      failedThemeRequests.push(`${response.status()} ${url}`);
    }
  });

  return {
    consoleErrors,
    pageErrors,
    failedThemeRequests,
    drain() {
      const taken = {
        pageErrors: [...pageErrors],
        consoleErrors: [...consoleErrors],
        failedThemeRequests: [...failedThemeRequests],
      };
      pageErrors.length = 0;
      consoleErrors.length = 0;
      failedThemeRequests.length = 0;
      return taken;
    },
    assertClean(context: string, allow: readonly RegExp[] = []) {
      const permitted = (entry: string) => allow.some((pattern) => pattern.test(entry));
      const unexplained = {
        pageErrors: [...pageErrors],
        consoleErrors: consoleErrors.filter((entry) => !permitted(entry)),
        failedThemeRequests: failedThemeRequests.filter((entry) => !permitted(entry)),
      };

      // Each checkpoint asks "what arrived since the last one?", so the buffers
      // are drained here. Without this, one step's permitted failure would be
      // re-reported by every later step — and every later step would have to
      // allow it too, which would quietly widen the exemption across the run.
      pageErrors.length = 0;
      consoleErrors.length = 0;
      failedThemeRequests.length = 0;

      expect(unexplained.pageErrors, `${context}: uncaught page errors`).toEqual([]);
      expect(unexplained.consoleErrors, `${context}: console errors/hydration warnings`).toEqual([]);
      expect(unexplained.failedThemeRequests, `${context}: failed theme requests`).toEqual([]);
    },
  };
}

/**
 * Signs in through the form, every time it is called.
 *
 * Deliberately not cached. The login route is rate limited to five attempts per
 * identity per fifteen minutes, so it is tempting to save the cookies and
 * replay them — and that was tried. Replaying a session the server had revoked
 * at sign-out put the run into a /login ↔ /dashboard bounce that failed as a
 * timeout three steps later, which is a far worse thing for a release gate to
 * do than cost one more request. The run instead keeps its sign-ins down to
 * three, by never signing in where it is already signed in.
 */
export async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email or phone' }).fill(ADMIN.identifier);
  await page.getByRole('textbox', { name: 'Password' }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
}

/** The settings action bar, which is a sibling of the sections rather than inside one. */
export function actionBar(page: Page): Locator {
  return page.locator('[data-najm-theme-actions]');
}

/**
 * One branding slot's controls.
 *
 * `data-slot` is also used by the kit's own primitives, but never with a
 * branding slot key, so the attribute selector stays unambiguous.
 */
export function brandingSlot(page: Page, key: string): Locator {
  return page.locator(`.najm-theme-branding-slot[data-slot="${key}"]`);
}

export async function openSettingsTab(page: Page, name: string): Promise<void> {
  await page.getByRole('tab', { name, exact: true }).click();
}

/** The `<img>` a slot currently renders, wherever it appears in the product. */
export async function imageSrc(image: Locator): Promise<string> {
  await expect(image).toBeVisible();
  return (await image.getAttribute('src')) ?? '';
}

/**
 * Asserts an image actually painted, rather than merely being in the DOM.
 *
 * A 404'd `<img>` still has a `src` and still passes `toBeVisible()`; only its
 * intrinsic size tells the truth. This is what makes the fallback assertions
 * mean "the factory file rendered" instead of "the element exists".
 */
export async function expectPainted(image: Locator, context: string): Promise<void> {
  await expect
    .poll(
      async () =>
        image.evaluate((node) => {
          const img = node as HTMLImageElement;
          return img.complete && img.naturalWidth > 0;
        }),
      { message: `${context}: image never painted`, timeout: 10_000 },
    )
    .toBe(true);
}

/**
 * Every `<img>` on the page finished loading with real pixels.
 *
 * The end state of the whole run: no slot anywhere is showing the browser's
 * broken-image glyph, whatever it went through to get here.
 */
export async function expectNoBrokenImages(page: Page, context: string): Promise<void> {
  const broken = await page.evaluate(() =>
    [...document.querySelectorAll('img')]
      .filter((img) => img.getAttribute('src'))
      .filter((img) => img.complete && img.naturalWidth === 0)
      .map((img) => img.getAttribute('src') ?? ''),
  );
  expect(broken, `${context}: images that failed to load`).toEqual([]);
}

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------

/** One tab stop, as the browser reports it. */
export interface FocusStop {
  tag: string;
  slot: string | null;
  role: string | null;
  /** Accessible-ish name: `aria-label` when present, else trimmed text. */
  name: string;
  /**
   * Identity of the *element*, not of how it reads.
   *
   * An ordinal assigned in the page and remembered in a WeakMap, because the
   * customizer renders a column of colour buttons that all report the same tag,
   * the same slot, and the same text. Keying on those made eight different
   * controls look like one control holding focus, and the trap detector fired
   * on a tab order that was working perfectly.
   */
  id: string;
  outline: string;
  boxShadow: string;
  /**
   * The nearest few ancestors, and whether each is currently in a focused
   * state. A composite input paints the indicator on the wrapper that owns the
   * border while focus sits on a stripped-bare control inside it, so looking
   * only at the focused element reports "no indicator" for a field that is
   * visibly ringed on screen.
   */
  ancestors: { boxShadow: string; focused: boolean }[];
  inSettings: boolean;
  focusVisible: boolean;
}

/** Splits a computed `box-shadow` into layers without cutting inside `rgb(…)`. */
function shadowLayers(value: string): string[] {
  const layers: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      layers.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) layers.push(current.trim());
  return layers;
}

/** A colour that paints nothing: `rgba(…, 0)`, or an `oklch(… / 0)` slash alpha. */
function isTransparent(colour: string): boolean {
  if (/^\s*transparent\s*$/.test(colour)) return true;
  if (/\/\s*0(\.0+)?\s*\)/.test(colour)) return true;
  return /^rgba\([^)]*,\s*0(\.0+)?\)$/.test(colour.trim());
}

/**
 * Whether a focused element shows something a sighted keyboard user can see.
 *
 * Two ways to satisfy it, because the product legitimately uses both: the
 * user-agent outline on native and Radix popover controls, and najm-kit's ring,
 * which is a box-shadow. A ring is only counted when it actually has size and a
 * colour — `rgba(0, 0, 0, 0) 0px 0px 0px 0px` is what an element reports while
 * its transition is still running, and treating that as an indicator is how a
 * missing focus ring passes a test.
 */
/** Any painted box-shadow layer at all: blur, spread, drop shadow, ring. */
function paintsAnyShadow(value: string): boolean {
  return shadowLayers(value).some((layer) => {
    const lengths = layer.match(/-?[\d.]+px/g) ?? [];
    const painted = lengths.slice(2).some((length) => Number.parseFloat(length) > 0);
    const colour = layer.replace(/-?[\d.]+px/g, '').replace(/\binset\b/, '').trim();
    return painted && colour.length > 0 && !isTransparent(colour);
  });
}

/**
 * Specifically a *ring*: no offset, no blur, some spread.
 *
 * Used for ancestors, where "has a box-shadow" is not enough — a card with
 * `shadow-sm` around the focused control would satisfy that and prove nothing.
 * `0 0 0 3px` is a ring and `0 1px 2px 0` is a drop shadow, and the geometry
 * tells them apart without this having to know a single class name.
 */
function paintsRing(value: string): boolean {
  return shadowLayers(value).some((layer) => {
    const lengths = (layer.match(/-?[\d.]+px/g) ?? []).map(Number.parseFloat);
    if (lengths.length < 4) return false;
    const [offsetX, offsetY, blur, spread] = lengths;
    if (offsetX !== 0 || offsetY !== 0 || blur !== 0 || spread <= 0) return false;
    const colour = layer.replace(/-?[\d.]+px/g, '').replace(/\binset\b/, '').trim();
    return colour.length > 0 && !isTransparent(colour);
  });
}

export function hasVisibleFocusIndicator(stop: FocusStop): boolean {
  const [width] = stop.outline.split(' ');
  const outlineVisible =
    !/\bnone\b/.test(stop.outline) && Number.parseFloat(width ?? '0') > 0;
  if (outlineVisible) return true;
  if (paintsAnyShadow(stop.boxShadow)) return true;

  // A wrapper only counts when it is itself in a focused state *and* what it
  // paints is a ring. Both conditions, so a decorative shadow that merely
  // happens to enclose the focused control cannot stand in for an indicator.
  return stop.ancestors.some(
    (ancestor) => ancestor.focused && paintsRing(ancestor.boxShadow),
  );
}

/** Describes whatever currently holds focus. */
export async function focusedStop(page: Page): Promise<FocusStop | null> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body || element === document.documentElement) {
      return null;
    }
    const style = getComputedStyle(element);
    const name =
      element.getAttribute('aria-label')
      ?? (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const slot = element.getAttribute('data-slot');

    // A per-element ordinal, held in a WeakMap so nothing is added to the DOM
    // and nothing is kept alive that the page would otherwise release.
    const registry = window as unknown as {
      __najmStops?: WeakMap<Element, number>;
      __najmStopCount?: number;
    };
    registry.__najmStops ??= new WeakMap();
    registry.__najmStopCount ??= 0;
    let ordinal = registry.__najmStops.get(element);
    if (ordinal === undefined) {
      ordinal = (registry.__najmStopCount += 1);
      registry.__najmStops.set(element, ordinal);
    }

    return {
      tag: element.tagName,
      slot,
      role: element.getAttribute('role'),
      name,
      id: `#${ordinal} ${element.tagName}|${slot ?? ''}|${name}`,
      outline: `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,
      boxShadow: style.boxShadow,
      ancestors: (() => {
        const chain: { boxShadow: string; focused: boolean }[] = [];
        let node = element.parentElement;
        for (let depth = 0; depth < 3 && node; depth += 1, node = node.parentElement) {
          chain.push({
            boxShadow: getComputedStyle(node).boxShadow,
            focused: node.matches(':focus-visible') || node.matches(':has(:focus-visible)'),
          });
        }
        return chain;
      })(),
      inSettings: element.closest('.najm-theme-settings') !== null,
      focusVisible: element.matches(':focus-visible'),
    };
  });
}

/**
 * Presses Tab and reports where focus landed, once its ring has settled.
 *
 * najm-kit transitions `box-shadow`, so the frame right after Tab reports a
 * fully transparent shadow on an element that is about to show a perfectly good
 * ring. Polling rather than sleeping keeps the run fast while still measuring
 * the painted state instead of the first frame of an animation.
 */
export async function tabTo(page: Page, key: 'Tab' | 'Shift+Tab' = 'Tab'): Promise<FocusStop | null> {
  await page.keyboard.press(key);

  let stop = await focusedStop(page);
  if (!stop) return null;

  const deadline = Date.now() + 1_000;
  while (!hasVisibleFocusIndicator(stop) && Date.now() < deadline) {
    await page.waitForTimeout(50);
    const next = await focusedStop(page);
    if (!next || next.id !== stop.id) return next;
    stop = next;
  }
  return stop;
}

/** Nothing in the product may scroll the page sideways, at any viewport. */
export async function expectNoHorizontalOverflow(page: Page, context: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth };
  });
  expect(
    overflow.scrollWidth,
    `${context}: document scrolls horizontally (${overflow.scrollWidth} > ${overflow.clientWidth})`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

/**
 * Confirms a factory asset is served the way a year-long cache requires.
 *
 * Fetched in the page so the request carries the session and goes through the
 * same origin the browser used, rather than from Node with no cookies.
 */
export async function fetchAssetHeaders(
  page: Page,
  url: string,
): Promise<{ status: number; contentType: string; cacheControl: string }> {
  return page.evaluate(async (target) => {
    const response = await fetch(target, { cache: 'no-store' });
    return {
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      cacheControl: response.headers.get('cache-control') ?? '',
    };
  }, url);
}
