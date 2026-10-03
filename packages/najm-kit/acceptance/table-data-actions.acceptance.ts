import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const evidence = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.runtime/ntable-data-actions');
type PrintCapture = { html: string; text: string };
type PrintWindow = Window & { __ntablePrint?: PrintCapture };

async function openExample(page: Page, mobile: boolean) {
  await page.goto('/');
  if (mobile) await page.getByRole('button', { name: 'Toggle menu' }).click();
  await page.getByText('Table', { exact: true }).locator('visible=true').first().click();
  const demo = page.getByTestId('ntable-data-actions-demo');
  await expect(demo).toBeVisible();
  await demo.scrollIntoViewIfNeeded();
  return demo;
}

function exampleBlock(demo: Locator) {
  return demo.locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
}

async function capture(target: Locator, name: string) {
  mkdirSync(evidence, { recursive: true });
  await target.screenshot({ path: resolve(evidence, `${name}.png`) });
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(String(error)));
  (page as Page & { tableErrors: string[] }).tableErrors = errors;
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { tableErrors: string[] }).tableErrors, 'clean browser console').toEqual([]);
});

test('action controls fit the preview in dark, light, and RTL layouts', async ({ page, isMobile }, info) => {
  const demo = await openExample(page, isMobile);
  const block = exampleBlock(demo);
  for (const action of ['Export', 'Import', 'Print', 'Table actions']) {
    const button = demo.getByRole('button', { name: action, exact: true });
    await expect(button).toBeVisible();
    const bounds = await button.boundingBox();
    const parent = await demo.boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(40);
    expect(bounds!.x).toBeGreaterThanOrEqual(parent!.x - 1);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(parent!.x + parent!.width + 1);
  }
  if (isMobile) {
    const search = await demo.locator('[data-ntable-mobile-primary-filter]').boundingBox();
    const bounds = await demo.boundingBox();
    expect(search!.width).toBeGreaterThanOrEqual(bounds!.width - 2);
  }
  await capture(block, `${info.project.name}-dark`);
  await block.getByRole('button', { name: 'Toggle theme' }).click();
  await capture(block, `${info.project.name}-light`);
  await block.getByRole('button', { name: 'Toggle RTL' }).click();
  await expect(demo).toHaveCSS('direction', 'rtl');
  await capture(block, `${info.project.name}-rtl`);
  expect(await demo.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
});

test('visibility flags affect buttons and menus; presentation modes keep the chosen actions', async ({ page, isMobile }, info) => {
  const demo = await openExample(page, isMobile);
  await demo.getByRole('switch', { name: 'Show Export' }).click();
  await demo.getByRole('switch', { name: 'Show Print' }).click();
  await expect(demo.getByRole('button', { name: 'Export', exact: true })).toHaveCount(0);
  await expect(demo.getByRole('button', { name: 'Print', exact: true })).toHaveCount(0);
  await expect(demo.getByRole('button', { name: 'Import', exact: true })).toBeVisible();
  await demo.getByRole('button', { name: 'Table actions' }).click();
  await expect(page.locator('[data-context-menu] [role="menuitem"]')).toHaveText(['Import']);
  await page.keyboard.press('Escape');
  await demo.getByLabel('Action presentation').selectOption('menu');
  await expect(demo.getByRole('button', { name: 'Import', exact: true })).toHaveCount(0);
  await demo.getByRole('button', { name: 'Table actions' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-context-menu] [role="menuitem"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await demo.getByLabel('Action presentation').selectOption('buttons');
  await expect(demo.getByRole('button', { name: 'Table actions' })).toHaveCount(0);
  await capture(exampleBlock(demo), `${info.project.name}-import-only`);
  await demo.getByRole('switch', { name: 'Show Import' }).click();
  await expect(demo.getByRole('button', { name: 'Import', exact: true })).toHaveCount(0);
  await demo.getByRole('switch', { name: 'Show Export' }).click();
  await expect(demo.getByRole('button', { name: 'Export', exact: true })).toBeVisible();
  await expect(demo.getByRole('button', { name: 'Import', exact: true })).toHaveCount(0);
});

test('header right-click opens actions without changing sorting', async ({ page, isMobile }, info) => {
  const demo = await openExample(page, isMobile);
  if (!isMobile) {
    const header = demo.locator('thead th').first();
    await header.click({ button: 'right' });
    await expect(page.locator('[data-context-menu] [role="menuitem"]')).toHaveText(['Export', 'Import', 'Print']);
    await expect(demo.locator('tbody tr').first()).toContainText('Alice Martin');
  } else {
    // A visible trigger provides the same actions on touch screens.
    await demo.getByRole('button', { name: 'Table actions' }).click();
    await expect(page.locator('[data-context-menu] [role="menuitem"]')).toHaveText(['Export', 'Import', 'Print']);
  }
  mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: resolve(evidence, `${info.project.name}-header-menu.png`) });
  await page.getByRole('menuitem', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('CSV and JSON import preview, cancel, validation, and local replacement work', async ({ page, isMobile }, info) => {
  const demo = await openExample(page, isMobile);
  await demo.getByRole('switch', { name: 'Empty table' }).click();
  await expect(demo).toContainText('No data available');
  await demo.getByRole('button', { name: 'Import', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const input = dialog.getByLabel('CSV or JSON file');
  const confirm = dialog.getByRole('button', { name: 'Replace table data' });
  await input.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(dialog.getByRole('alert')).toContainText('array of row objects');
  await expect(confirm).toBeDisabled();
  const csv = 'name,email,status\r\n"Imported, Member",imported@example.com,Active';
  await input.setInputFiles({ name: 'members.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(confirm).toBeEnabled();
  await expect(dialog).toContainText('Imported, Member');
  await expect(demo).toContainText('No data available');
  await capture(dialog, `${info.project.name}-import-preview`);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(demo).toContainText('No data available');
  await demo.getByRole('button', { name: 'Import', exact: true }).click();
  await input.setInputFiles({ name: 'members.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(dialog).not.toBeVisible();
  await expect(demo).toContainText('Imported, Member');
  await expect(demo).not.toContainText('No data available');
  await demo.getByRole('button', { name: 'Import', exact: true }).click();
  await input.setInputFiles({ name: 'members.json', mimeType: 'application/json', buffer: Buffer.from('[{"name":"JSON Member","email":"json@example.com","status":"Pending"}]') });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(dialog).not.toBeVisible();
  await expect(demo).toContainText('JSON Member');
  await expect(demo).not.toContainText('Imported, Member');
  await capture(exampleBlock(demo), `${info.project.name}-imported-rows`);
});

test('export downloads actual filtered data and loading disables first-load actions', async ({ page, isMobile }) => {
  const demo = await openExample(page, isMobile);
  await demo.getByPlaceholder('Search members', { exact: true }).locator('visible=true').fill('Alice');
  const downloadEvent = page.waitForEvent('download');
  await demo.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('table.csv');
  const text = readFileSync((await download.path())!, 'utf8');
  expect(text).toContain('"name","email","status"');
  expect(text).toContain('Alice Martin');
  expect(text).not.toContain('Bob Chen');
  await demo.getByRole('switch', { name: 'Empty table' }).click();
  await demo.getByRole('switch', { name: 'Loading table' }).click();
  for (const action of ['Export', 'Import', 'Print', 'Table actions']) await expect(demo.getByRole('button', { name: action, exact: true })).toBeDisabled();
});

test('print builds a separate printable table and invokes printing', async ({ page, isMobile }, info) => {
  // Capture the call instead of opening an operating-system print dialog.
  await page.addInitScript(() => {
    window.print = () => {
      (window.parent as PrintWindow).__ntablePrint = { html: document.documentElement.outerHTML, text: document.body.textContent ?? '' };
      setTimeout(() => window.dispatchEvent(new Event('afterprint')), 0);
    };
  });
  const demo = await openExample(page, isMobile);
  await demo.getByRole('button', { name: 'Print', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as PrintWindow).__ntablePrint?.text)).toContain('Alice Martin');
  const printed = await page.evaluate(() => (window as PrintWindow).__ntablePrint!);
  expect(printed.text).toContain('Bob Chen');
  expect(printed.text).not.toContain('Show Export');
  const preview = await page.context().newPage();
  await preview.setContent(printed.html);
  await expect(preview.locator('tbody tr')).toHaveCount(3);
  await capture(preview.locator('table'), `${info.project.name}-print-layout`);
  await preview.close();
  await expect(page.locator('iframe[title="Print table"]')).toHaveCount(0);
});
