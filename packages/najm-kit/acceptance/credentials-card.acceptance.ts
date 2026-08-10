// ============================================================================
// NCredentialsCard — browser acceptance
// ============================================================================
//
// The unit suite runs in happy-dom, which has no CSS engine: it can prove the
// component *renders* a ring class or a logical-property utility, and nothing
// at all about whether a ring is painted or an RTL layout mirrors. Everything
// here needs a real layout and a real compositor, so it lives in a browser.
//
// Screenshots land in `docs/evidence/credentials-card/`. They are the artifact
// the release ledger points at; the assertions are what actually gate.
// ============================================================================

import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The package is ESM, so `__dirname` does not exist here.
const HERE = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = resolve(HERE, '../../../docs/evidence/credentials-card');

// The three cards the docs page renders, keyed by the title each one shows.
const DEFAULT_CARD = 'Account created';
const ACTIONS_CARD = 'Provisioning bundle';
const LONG_VALUE_CARD = 'Long recovery phrase';

const CARD = '[data-testid="credentials-card"]';
const COPY = '[data-testid="credentials-card-copy"]';
const STATUS = '[data-testid="credentials-card-status"]';

// ----------------------------------------------------------------------------
// Console capture
//
// Attached per test. Anything that lands here fails the test that produced it,
// so an exemption has to be written down rather than silently tolerated.
// ----------------------------------------------------------------------------

type Console = { errors: string[]; pageErrors: string[] };

function watchConsole(page: Page): Console {
  const errors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  return { errors, pageErrors };
}

function expectCleanConsole(seen: Console) {
  expect(seen.pageErrors, 'uncaught page errors').toEqual([]);
  expect(seen.errors, 'console errors').toEqual([]);
}

// ----------------------------------------------------------------------------
// Navigation
// ----------------------------------------------------------------------------

async function openCredentialsPage(page: Page, isMobile: boolean) {
  await page.goto('/');

  if (isMobile) {
    // Below `md` the sidebar is translated off-screen behind a toggle. Both
    // sidebar copies stay mounted, so the nav link resolves to two elements at
    // every viewport — scope to the one that is actually on screen.
    await page.getByRole('button', { name: 'Toggle menu' }).click();
  }

  const link = page.getByText('Credentials Card', { exact: true });
  const visible = link.locator('visible=true');
  await visible.first().click();

  await expect(page.getByRole('heading', { name: 'NCredentialsCard' })).toBeVisible();
  // Three examples, each with one card.
  await expect(page.locator(CARD)).toHaveCount(3);
}

/**
 * A card plus the toolbar that controls the example it lives in.
 *
 * The toolbar belongs to the `Example` wrapper, which is the nearest
 * `rounded-xl` ancestor — the same block that holds the preview pane. Walking
 * up from the card rather than down from a heading keeps this working if the
 * page ever reorders its examples.
 */
function exampleFor(page: Page, title: string) {
  const card = page.locator(CARD).filter({ hasText: title });
  const block = card.locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
  return {
    card,
    block,
    copy: card.locator(COPY),
    status: card.locator(STATUS),
    rtlToggle: block.getByRole('button', { name: 'Toggle RTL' }),
    themeToggle: block.getByRole('button', { name: 'Toggle theme' }),
  };
}

async function shot(page: Page, name: string) {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({ path: resolve(EVIDENCE_DIR, `${name}.png`), fullPage: false });
}

/**
 * Screenshot one element rather than the viewport.
 *
 * Used for the focus evidence: a full-page shot of a button sitting on the
 * bottom edge of the viewport technically contains the ring and shows a reader
 * nothing. Scrolls first so the element is fully composited.
 */
async function shotOf(target: Locator, name: string) {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await target.scrollIntoViewIfNeeded();
  await target.screenshot({ path: resolve(EVIDENCE_DIR, `${name}.png`) });
}

// ----------------------------------------------------------------------------
// Focus indicator
//
// Same geometry discriminator the theme acceptance uses: a focus ring is a
// spread-only shadow (`0 0 0 Npx`), while an ordinary elevation shadow carries
// a blur and an offset. Asserting "box-shadow is not none" would pass on the
// resting drop shadow every button already has.
// ----------------------------------------------------------------------------

/**
 * Perceived lightness on a 0–1 scale, for either colour syntax the kit emits.
 *
 * The theme tokens resolve to `oklch(...)`, whose first component *is*
 * lightness, already normalized. An rgb-only parser reads `oklch(1 0 0)` as
 * "red channel 1" and calls white the darkest colour on the page.
 */
function lightnessOf(color: string): number {
  const nums = (color.match(/-?[\d.]+/g) ?? []).map(Number);
  if (color.startsWith('oklch') || color.startsWith('lch') || color.startsWith('lab')) {
    return color.startsWith('oklch') ? nums[0] : nums[0] / 100;
  }
  const [r = 0, g = 0, b = 0] = nums;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function isTransparent(color: string): boolean {
  const rgba = color.match(/rgba?\(([^)]+)\)/);
  if (!rgba) return false;
  const parts = rgba[1].split(',').map((p) => Number(p.trim()));
  return parts.length === 4 && parts[3] === 0;
}

function paintsRing(boxShadow: string): boolean {
  if (!boxShadow || boxShadow === 'none') return false;
  // Split on commas that separate layers, not the ones inside rgb(...).
  const layers = boxShadow.split(/,(?![^(]*\))/).map((l) => l.trim());
  return layers.some((layer) => {
    if (isTransparent(layer)) return false;
    const lengths = layer.match(/-?[\d.]+px/g);
    if (!lengths || lengths.length < 3) return false;
    const [offsetX, offsetY, blur] = lengths.map(parseFloat);
    const spread = lengths.length >= 4 ? parseFloat(lengths[3]) : 0;
    // Ring: no offset, no blur, positive spread.
    return offsetX === 0 && offsetY === 0 && blur === 0 && spread > 0;
  });
}

async function expectVisibleFocusRing(target: Locator, label: string) {
  // Polled: the button animates its box-shadow, and sampling mid-transition
  // reads a fully transparent layer that looks exactly like "no ring".
  await expect
    .poll(async () => paintsRing(await target.evaluate((el) => getComputedStyle(el).boxShadow)), {
      message: `${label} should paint a focus ring`,
      timeout: 3000,
    })
    .toBe(true);
}

/** Presses Tab up to `limit` times, recording where focus lands each time. */
async function tabSequence(page: Page, limit: number): Promise<string[]> {
  const stops: string[] = [];
  for (let i = 0; i < limit; i += 1) {
    await page.keyboard.press('Tab');
    stops.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return '<body>';
        return (el.getAttribute('data-testid') ?? el.textContent?.trim() ?? el.tagName).slice(0, 40);
      }),
    );
  }
  return stops;
}

// ============================================================================

test.describe('NCredentialsCard', () => {
  test('renders all three cards with correct field semantics', async ({ page, isMobile }) => {
    const seen = watchConsole(page);
    await openCredentialsPage(page, !!isMobile);

    const { card } = exampleFor(page, DEFAULT_CARD);
    await expect(card).toBeVisible();

    // Description-list semantics, in field order.
    await expect(card.locator('dt')).toHaveText(['Phone', 'Initial password']);
    await expect(card.locator('dd')).toHaveText(['+1 555 0100', 'p@ssw0rd!']);

    // The header icon is decorative in a real accessibility tree, not just in
    // the rendered attribute: it must expose no accessible name.
    const headerIcon = card.locator('[data-testid="credentials-card-header-icon"] svg');
    await expect(headerIcon).toHaveAttribute('aria-hidden', 'true');

    const actions = exampleFor(page, ACTIONS_CARD);
    await expect(actions.card.locator('dt')).toHaveCount(4);
    await expect(actions.card.getByRole('button', { name: 'Done' })).toBeVisible();

    await shot(page, `cards-dark-${isMobile ? 'mobile' : 'desktop'}`);
    expectCleanConsole(seen);
  });

  test('light theme renders the card on a light surface', async ({ page, isMobile }) => {
    const seen = watchConsole(page);
    await openCredentialsPage(page, !!isMobile);

    const { card, themeToggle } = exampleFor(page, DEFAULT_CARD);
    const readBg = () =>
      card.evaluate((el) => getComputedStyle(el).backgroundColor);

    const dark = await readBg();
    await themeToggle.click();

    // Assert the surface actually changed rather than that a class flipped.
    await expect.poll(readBg, { message: 'card background should change with the theme' })
      .not.toBe(dark);

    const light = await readBg();
    expect(lightnessOf(light), `light surface (${light}) should be brighter than dark (${dark})`)
      .toBeGreaterThan(lightnessOf(dark));

    await shotOf(card, `card-light-${isMobile ? 'mobile' : 'desktop'}`);
    expectCleanConsole(seen);
  });

  test('RTL mirrors the layout without clipping', async ({ page, isMobile }) => {
    const seen = watchConsole(page);
    await openCredentialsPage(page, !!isMobile);

    const { card, rtlToggle } = exampleFor(page, DEFAULT_CARD);

    const ltrIconX = await card
      .locator('[data-testid="credentials-card-header-icon"]')
      .evaluate((el) => el.getBoundingClientRect().left);
    const ltrCardLeft = await card.evaluate((el) => el.getBoundingClientRect().left);

    await rtlToggle.click();
    await expect(card.locator('xpath=ancestor::div[@dir][1]')).toHaveAttribute('dir', 'rtl');

    // The header icon must move to the trailing edge. Comparing its offset
    // *within* the card, rather than its absolute x, keeps this honest when the
    // card itself shifts.
    await expect
      .poll(async () => {
        const cardLeft = await card.evaluate((el) => el.getBoundingClientRect().left);
        const iconLeft = await card
          .locator('[data-testid="credentials-card-header-icon"]')
          .evaluate((el) => el.getBoundingClientRect().left);
        return iconLeft - cardLeft;
      }, { message: 'header icon should move to the trailing edge under RTL' })
      .toBeGreaterThan(ltrIconX - ltrCardLeft);

    // Nothing may spill horizontally once mirrored.
    const overflow = await card.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow, 'card must not overflow horizontally under RTL').toBeLessThanOrEqual(1);

    // The credential values must keep their own direction. The label follows
    // the UI and goes RTL; the value must not, or the weak characters in a
    // phone number or a password paint in the wrong visual order.
    const directions = await card.evaluate((el) => ({
      labels: Array.from(el.querySelectorAll('dt')).map((n) => getComputedStyle(n).direction),
      values: Array.from(el.querySelectorAll('dd')).map((n) => getComputedStyle(n).direction),
    }));
    expect(directions.labels, 'labels follow the RTL surface').toEqual(['rtl', 'rtl']);
    expect(directions.values, 'values isolate to their own direction').toEqual(['ltr', 'ltr']);

    // And prove it at the pixel level: read the glyphs back in painted order.
    // This is the assertion that fails on the real defect — an inherited `rtl`
    // paints `+1 555 0100` as `0100 555 1+` while every attribute still looks
    // correct.
    const painted = await card.evaluate((el) => {
      const dd = el.querySelectorAll('dd')[0] as HTMLElement;
      const text = dd.textContent ?? '';
      const node = dd.firstChild!;
      const at: Array<[string, number]> = [];
      for (let i = 0; i < text.length; i += 1) {
        const r = document.createRange();
        r.setStart(node, i);
        r.setEnd(node, i + 1);
        at.push([text[i], r.getBoundingClientRect().left]);
      }
      return at.sort((a, b) => a[1] - b[1]).map(([c]) => c).join('');
    });
    expect(painted, 'the phone number must paint in logical order under RTL')
      .toBe('+1 555 0100');

    await shotOf(card, `card-rtl-${isMobile ? 'mobile' : 'desktop'}`);
    expectCleanConsole(seen);
  });

  test('a long credential value wraps instead of overflowing', async ({ page, isMobile }) => {
    const seen = watchConsole(page);
    await openCredentialsPage(page, !!isMobile);

    const { card } = exampleFor(page, LONG_VALUE_CARD);
    const value = card.locator('dd').first();
    await expect(value).toContainText('trail-mango-velvet');

    // The value is a single unbroken token; without `break-all` it would push
    // the card wider than its column.
    const overflow = await card.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow, 'long value must not force horizontal overflow').toBeLessThanOrEqual(1);

    // The value must not spill out of its own box either, at any width.
    const valueOverflow = await value.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(valueOverflow, 'value must not overflow its column').toBeLessThanOrEqual(1);

    // Proving it *wraps* only means something where it cannot fit on one line.
    // At 1440px this passphrase does fit, and demanding two line boxes there
    // would be asserting a layout the component never promised.
    const { height, lineHeight, fitsOnOneLine } = await value.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return {
        height: el.getBoundingClientRect().height,
        lineHeight: parseFloat(getComputedStyle(el).lineHeight),
        fitsOnOneLine: range.getClientRects().length <= 1,
      };
    });

    if (!fitsOnOneLine) {
      expect(height, 'a value too wide for its column must wrap onto multiple lines')
        .toBeGreaterThan(lineHeight * 1.5);
    }

    await shotOf(card, `card-long-value-${isMobile ? 'mobile' : 'desktop'}`);
    expectCleanConsole(seen);
  });

  test('copy succeeds, shows Copied, and writes the real clipboard', async ({
    page,
    isMobile,
    context,
  }) => {
    const seen = watchConsole(page);
    await openCredentialsPage(page, !!isMobile);

    const { card, copy, status } = exampleFor(page, DEFAULT_CARD);
    await expect(copy).toHaveText(/Copy details/i);

    await copy.click();

    await expect(copy).toHaveText(/Copied/i);
    // The polite live region carries the same text, so a screen reader hears it.
    await expect(status).toHaveText('Copied');

    // Read the clipboard back. This is the assertion that would survive the
    // component swapping its label without ever calling writeText.
    await context.grantPermissions(['clipboard-read']);
    const written = await page.evaluate(() => navigator.clipboard.readText());

    // Line endings are normalized on the round trip: the component writes `\n`
    // (the unit suite asserts the exact string handed to `writeText`), and the
    // Windows clipboard hands back `\r\n`. That is the platform, not the
    // component, so compare on normalized newlines rather than encoding one
    // host's convention into the expectation.
    expect(written.replace(/\r\n/g, '\n'))
      .toBe('Phone: +1 555 0100\nInitial password: p@ssw0rd!');

    await shotOf(card, `copy-success-${isMobile ? 'mobile' : 'desktop'}`);

    // Reverts to idle without a reload.
    await expect(copy).toHaveText(/Copy details/i, { timeout: 5000 });
    await expect(status).toHaveText('');

    expectCleanConsole(seen);
  });

  test('a denied clipboard shows Copy failed and raises nothing', async ({ page, isMobile }) => {
    const seen = watchConsole(page);

    // Deny before any script runs, so the component sees the rejection the
    // browser would produce with clipboard permission withheld.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: () =>
            Promise.reject(
              new DOMException('Write permission denied.', 'NotAllowedError'),
            ),
        },
      });
    });

    await openCredentialsPage(page, !!isMobile);

    const { card, copy, status } = exampleFor(page, DEFAULT_CARD);
    await copy.click();

    await expect(copy).toHaveText(/Copy failed/i);
    await expect(status).toHaveText('Copy failed');

    await shotOf(card, `copy-denied-${isMobile ? 'mobile' : 'desktop'}`);

    await expect(copy).toHaveText(/Copy details/i, { timeout: 5000 });

    // The whole point: a denied clipboard is handled, not thrown. An unhandled
    // rejection here would surface as a page error.
    expectCleanConsole(seen);
  });

  test('Tab reaches Copy before Done, and both show a focus ring', async ({ page, isMobile }) => {
    const seen = watchConsole(page);
    await openCredentialsPage(page, !!isMobile);

    const { card, copy, themeToggle } = exampleFor(page, ACTIONS_CARD);
    await card.scrollIntoViewIfNeeded();

    const done = card.getByRole('button', { name: 'Done' });

    // Start from the example toolbar, which precedes the preview in DOM order,
    // then walk forward with real Tab presses. Focusing Copy directly would
    // prove the order nothing about how a keyboard user actually gets there.
    await themeToggle.focus();
    const stops = await tabSequence(page, 6);

    const copyIndex = stops.indexOf('credentials-card-copy');
    expect(copyIndex, `Tab never reached Copy; stops were ${JSON.stringify(stops)}`)
      .toBeGreaterThanOrEqual(0);
    expect(stops[copyIndex + 1], 'Done must be the next stop after Copy').toBe('Done');

    // Baseline: with focus parked elsewhere, Copy must paint *no* ring. Without
    // this the ring assertions below would pass just as happily against a
    // predicate that always returns true, or against a resting drop shadow.
    await themeToggle.focus();
    expect(
      paintsRing(await copy.evaluate((el) => getComputedStyle(el).boxShadow)),
      'unfocused Copy button must not paint a ring',
    ).toBe(false);

    // Now walk to Copy and confirm the indicator is painted, arriving by
    // keyboard so `:focus-visible` genuinely applies.
    await themeToggle.focus();
    for (let i = 0; i <= copyIndex; i += 1) await page.keyboard.press('Tab');
    await expect(copy).toBeFocused();
    await expectVisibleFocusRing(copy, 'Copy button');
    await shotOf(card, `focus-copy-${isMobile ? 'mobile' : 'desktop'}`);

    await page.keyboard.press('Tab');
    await expect(done).toBeFocused();
    await expectVisibleFocusRing(done, 'Done button');
    await shotOf(card, `focus-done-${isMobile ? 'mobile' : 'desktop'}`);

    expectCleanConsole(seen);
  });

  test('the card fits a 390px viewport without horizontal overflow', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'covered by the mobile project');

    const seen = watchConsole(page);
    await openCredentialsPage(page, true);

    for (const title of [DEFAULT_CARD, ACTIONS_CARD, LONG_VALUE_CARD]) {
      const { card } = exampleFor(page, title);
      await card.scrollIntoViewIfNeeded();
      const overflow = await card.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow, `${title} must not overflow at 390px`).toBeLessThanOrEqual(1);
    }

    // The document itself must not scroll sideways either.
    const docOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(docOverflow, 'page must not scroll horizontally at 390px').toBeLessThanOrEqual(1);

    await shot(page, 'card-mobile-390');
    expectCleanConsole(seen);
  });
});
