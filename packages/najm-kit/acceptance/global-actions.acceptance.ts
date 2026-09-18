// ============================================================================
// Global actions and notifications — browser acceptance
// ============================================================================
//
// The unit suite runs in happy-dom, which has no layout and no compositor. It
// can prove that a width utility is on the popover; it cannot prove the popover
// fits a 390px phone, that an RTL menu mirrors without clipping, or that the
// bell is still legible on a light surface. All of that lives here.
//
// Screenshots land in `docs/evidence/global-actions/`. They are the artifact
// the release ledger points at; the assertions are what gate.
// ============================================================================

import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = resolve(HERE, '../../../docs/evidence/global-actions');

const TRIGGER = '[data-slot="notify-trigger"]';
const CONTENT = '[data-slot="notify-content"]';
const ITEM = '[data-slot="notify-item"]';

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

async function openGlobalActionsPage(page: Page, isMobile: boolean) {
  await page.goto('/');

  if (isMobile) {
    // Below `md` the sidebar sits off-screen behind a toggle, and both copies
    // stay mounted, so every nav link resolves twice at every viewport.
    await page.getByRole('button', { name: 'Toggle menu' }).click();
  }

  const link = page.getByText('Global Actions', { exact: true }).locator('visible=true');
  await link.first().click();
  await expect(
    page.getByRole('heading', { name: 'Global Actions & Notifications' }),
  ).toBeVisible();
}

/**
 * An example block plus the toolbar that themes and mirrors it.
 *
 * `preview` is what tests should assert text against: the code panel stays
 * mounted behind the preview, so a page-wide text query matches the sample
 * source as well as the rendered component.
 */
function exampleFor(page: Page, title: string) {
  const heading = page.getByRole('heading', { name: title, exact: true });
  const block = heading.locator('xpath=following::div[contains(@class,"rounded-xl")][1]');
  return {
    block,
    preview: block.locator('[data-slot="theme-container"], .najm-theme').first(),
    badges: block.locator('[data-slot="indicator-overlay"] [data-slot="badge"]'),
    trigger: block.locator(TRIGGER),
    rtlToggle: block.getByRole('button', { name: 'Toggle RTL' }),
    themeToggle: block.getByRole('button', { name: 'Toggle theme' }),
  };
}

/**
 * Scrolls the example to the top of the viewport before the menu opens.
 *
 * The preview can be 660px tall with three rows in it. Anchored to a trigger
 * in the middle of a 1000px viewport, Radix shifts it up until its header is
 * off-screen — on the page, and not clickable. Opening from the top leaves the
 * whole menu in view, which is also what the screenshots need.
 */
async function scrollExampleIntoView(target: Locator) {
  await target.evaluate((node) => node.scrollIntoView({ block: 'start' }));
}

async function shot(page: Page, name: string) {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({ path: resolve(EVIDENCE_DIR, `${name}.png`), fullPage: false });
}

async function shotOf(target: Locator, name: string) {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await target.scrollIntoViewIfNeeded();
  await target.screenshot({ path: resolve(EVIDENCE_DIR, `${name}.png`) });
}

test.describe('Global actions and notifications', () => {
  test('the bell opens a preview that fits the viewport', async ({ page, isMobile }) => {
    const seen = watchConsole(page);
    await openGlobalActionsPage(page, Boolean(isMobile));

    const { block, trigger } = exampleFor(page, 'The preset, wired to state');
    await scrollExampleIntoView(block);
    await trigger.first().click();

    const content = page.locator(CONTENT);
    await expect(content).toBeVisible();
    await expect(page.locator(ITEM)).toHaveCount(3);

    const box = await content.boundingBox();
    const viewport = page.viewportSize();
    expect(box, 'popover box').not.toBeNull();
    expect(viewport, 'viewport').not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows, 'horizontal page overflow').toBe(false);

    await shot(page, isMobile ? 'preview-open-mobile' : 'preview-open-desktop');
    expectCleanConsole(seen);
  });

  test('marking a row read clears its unread state and lowers the badge', async ({
    page,
    isMobile,
  }) => {
    const seen = watchConsole(page);
    await openGlobalActionsPage(page, Boolean(isMobile));

    const { badges, block, trigger } = exampleFor(page, 'The preset, wired to state');
    await scrollExampleIntoView(block);
    await expect(badges.first()).toHaveText('2');
    await trigger.first().click();

    const firstRow = page.locator(ITEM).first();
    await firstRow.getByRole('button', { name: 'Mark read' }).click();
    await expect(firstRow.getByRole('button', { name: 'Marking…' })).toBeVisible();
    await expect(firstRow.getByRole('button', { name: 'Mark read' })).toHaveCount(0);

    // The menu stays open; only the badge and the row state move.
    await expect(page.locator(CONTENT)).toBeVisible();
    await expect(badges.first()).toHaveText('1');

    await shot(page, isMobile ? 'marked-read-mobile' : 'marked-read-desktop');
    expectCleanConsole(seen);
  });

  test('a failed command keeps the menu open and reports to the application', async ({
    page,
    isMobile,
  }) => {
    const seen = watchConsole(page);
    await openGlobalActionsPage(page, Boolean(isMobile));

    const { block, trigger } = exampleFor(page, 'Command failure');
    await scrollExampleIntoView(block);
    await trigger.first().click();
    await page.locator(CONTENT).getByRole('button', { name: 'Mark all read' }).click();

    await expect(block.getByText(/markAll: Network unavailable/)).toBeVisible();
    await expect(page.locator(CONTENT)).toBeVisible();
    await expect(
      page.locator(CONTENT).getByRole('button', { name: 'Mark all read' }),
    ).toBeEnabled();

    // A rejected read must not navigate, so the open log stays empty.
    await page.locator(ITEM).first().getByRole('button', { name: 'View' }).click();
    await expect(block.getByText(/markRead: Network unavailable/)).toBeVisible();
    await expect(page.locator(CONTENT)).toBeVisible();

    await shot(page, isMobile ? 'command-failure-mobile' : 'command-failure-desktop');
    expectCleanConsole(seen);
  });

  test('Escape closes the menu and gives focus back to the bell', async ({
    page,
    isMobile,
  }) => {
    const seen = watchConsole(page);
    await openGlobalActionsPage(page, Boolean(isMobile));

    const { block, trigger: triggers } = exampleFor(page, 'The preset, wired to state');
    await scrollExampleIntoView(block);
    const trigger = triggers.first();
    await trigger.click();
    await expect(page.locator(CONTENT)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator(CONTENT)).toHaveCount(0);
    await expect(trigger).toBeFocused();

    expectCleanConsole(seen);
  });

  test('the connected child only mounts while the menu is open', async ({
    page,
    isMobile,
  }) => {
    const seen = watchConsole(page);
    await openGlobalActionsPage(page, Boolean(isMobile));

    const { block, trigger } = exampleFor(page, 'Compound form with lazily mounted content');
    await scrollExampleIntoView(block);
    await expect(block.getByText(/mounted 0 time\(s\)/)).toBeVisible();

    await trigger.first().click();
    await expect(block.getByText(/mounted 1 time\(s\)/)).toBeVisible();
    await expect(page.getByText('Loading notifications')).toBeVisible();
    await expect(page.locator(ITEM).first()).toBeVisible();

    await page.keyboard.press('Escape');
    await trigger.first().click();
    await expect(block.getByText(/mounted 2 time\(s\)/)).toBeVisible();

    expectCleanConsole(seen);
  });

  test('the badge caps at 99+ and disappears at zero', async ({ page, isMobile }) => {
    const seen = watchConsole(page);
    await openGlobalActionsPage(page, Boolean(isMobile));

    const { badges, block } = exampleFor(page, 'Unread counts');
    await scrollExampleIntoView(block);
    // Four menus, counts 0, 5, 99 and 132 — the zero one renders no badge.
    await expect(badges).toHaveText(['5', '99', '99+']);

    await shotOf(block, isMobile ? 'unread-counts-mobile' : 'unread-counts-desktop');
    expectCleanConsole(seen);
  });

  test('the action row stays legible on a light surface', async ({ page, isMobile }) => {
    const seen = watchConsole(page);
    await openGlobalActionsPage(page, Boolean(isMobile));

    const { block, themeToggle } = exampleFor(page, 'The whole action row');
    await scrollExampleIntoView(block);
    await expect(block.locator('[data-slot="global-actions"]')).toBeVisible();
    await themeToggle.click();

    const group = block.locator('[data-slot="global-actions"]');
    await expect(group.locator(TRIGGER)).toBeVisible();
    await expect(group.locator('[data-slot="language-menu-trigger"]')).toBeVisible();
    await expect(group.locator('[data-slot="theme-toggle"]')).toBeVisible();
    if (!isMobile) {
      await expect(group.locator('[data-slot="fullscreen-toggle"]')).toBeVisible();
    }

    await shotOf(block, isMobile ? 'action-row-light-mobile' : 'action-row-light-desktop');
    expectCleanConsole(seen);
  });

  test('the language menu switches and reports the applied language', async ({
    page,
    isMobile,
  }) => {
    const seen = watchConsole(page);
    await openGlobalActionsPage(page, Boolean(isMobile));

    const { block } = exampleFor(page, 'The whole action row');
    await scrollExampleIntoView(block);
    await block.locator('[data-slot="language-menu-trigger"]').click();
    await page.getByRole('menuitem', { name: /Français/ }).click();

    await expect(block.getByText('language → fr')).toBeVisible();
    await expect(block.locator('[data-slot="language-menu-trigger"]')).toBeEnabled();

    expectCleanConsole(seen);
  });

  test('the Arabic menu mirrors without clipping and long copy does not widen it', async ({
    page,
    isMobile,
  }) => {
    const seen = watchConsole(page);

    // The popover portals to the theme container, above the example's own
    // `dir` wrapper, so an RTL wrapper div proves nothing about it. Real
    // applications set the direction on `<html>`, and setting it before the
    // first paint avoids re-laying out the page under the test's own clicks.
    // On DOMContentLoaded, not at document-start: the parser builds its own
    // `documentElement`, so an attribute written before it exists is lost.
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.dir = 'rtl';
      });
    });
    await openGlobalActionsPage(page, Boolean(isMobile));

    const { block } = exampleFor(page, 'RTL and long copy');
    await scrollExampleIntoView(block);

    const triggers = block.locator(TRIGGER);
    await triggers.first().click();

    const content = page.locator(CONTENT);
    await expect(content).toBeVisible();
    expect(await content.evaluate((node) => getComputedStyle(node).direction)).toBe('rtl');

    const box = await content.boundingBox();
    const viewport = page.viewportSize();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
    await shot(page, isMobile ? 'rtl-mobile' : 'rtl-desktop');

    await page.keyboard.press('Escape');
    await expect(page.locator(CONTENT)).toHaveCount(0);
    await triggers.nth(1).click();
    const ltrContent = page.locator(CONTENT);
    await expect(ltrContent).toBeVisible();
    const ltrBox = await ltrContent.boundingBox();
    expect(ltrBox!.width).toBeLessThanOrEqual(Math.min(384, viewport!.width - 32) + 1);

    const rowOverflows = await page
      .locator(ITEM)
      .first()
      .evaluate((node) => node.scrollWidth > node.clientWidth + 1);
    expect(rowOverflows, 'row overflows its own width').toBe(false);

    await shot(page, isMobile ? 'long-copy-mobile' : 'long-copy-desktop');
    expectCleanConsole(seen);
  });
});
