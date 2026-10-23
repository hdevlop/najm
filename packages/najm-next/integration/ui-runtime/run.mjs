import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

const root = dirname(fileURLToPath(import.meta.url));
const build = spawnSync('bun', ['--no-env-file', resolve(root, 'build.mjs')], { stdio: 'inherit', windowsHide: true });
if (build.status !== 0) process.exit(build.status ?? 1);
const files = new Set(['index.html', ...JSON.parse(await readFile(resolve(root, '.output/files.json'), 'utf8'))]);
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!files.has(path)) { response.writeHead(404).end(); return; }
  response.setHeader('Content-Type', path.endsWith('.html') ? 'text/html' : path.endsWith('.css') ? 'text/css' : 'application/javascript');
  response.end(await readFile(resolve(root, '.output', path)));
});
await new Promise(resolveStarted => server.listen(0, '127.0.0.1', resolveStarted));
const origin = `http://127.0.0.1:${server.address().port}`;
const results = [];
let failed = false;
try {
  for (const [name, type] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await type.launch({ headless: true });
    const context = await browser.newContext();
    const result = { name, version: browser.version(), status: 'FAIL', errors: [] };
    results.push(result);
    try {
      const page = await context.newPage();
      page.on('pageerror', error => result.errors.push(error.message));
      const network = [];
      page.on('request', request => network.push(request.url()));
      await page.goto(origin, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'Router-independent UI runtime fixture' }).waitFor();
      assert((await page.locator('body').innerText()).includes('Aya'));
      await page.getByLabel('Unsent draft').fill('Keep offline input');
      const afterMount = network.length;
      await context.setOffline(true);
      await page.getByRole('button', { name: 'Arabic', exact: true }).click();
      await page.getByRole('button', { name: 'Dark', exact: true }).click();
      await page.getByRole('button', { name: 'Paris', exact: true }).click();
      await page.getByRole('button', { name: 'Replace runtime callbacks' }).click();
      assert.equal(await page.getByLabel('Unsent draft').inputValue(), 'Keep offline input');
      assert.deepEqual(JSON.parse(await page.getByTestId('state').innerText()), { language: 'ar', theme: 'dark', timeZone: 'Europe/Paris', sameQuery: true, sameAuth: true });
      const stored = await page.evaluate(() => [localStorage.getItem('fixture-language'), localStorage.getItem('fixture-theme'), localStorage.getItem('fixture-zone')]);
      assert.deepEqual(stored, ['ar', 'dark', 'Europe/Paris']);
      assert.equal(network.length, afterMount, 'Local UI changes must not make a network request');
      await context.setOffline(false);
      assert.equal(await page.getByLabel('Unsent draft').inputValue(), 'Keep offline input');
      assert.deepEqual(result.errors, []);
      result.status = 'PASS';
      console.log(`${name} ${result.version}: mounted without Next router; offline preference callbacks, draft and single auth/query identity PASS`);
    } catch (error) {
      failed = true; result.failure = error.stack; console.error(result.failure, result.errors);
    } finally { await context.close(); await browser.close(); }
  }
} finally {
  server.closeAllConnections();
  await new Promise(resolveClosed => server.close(resolveClosed));
  await writeFile(resolve(root, '.output/results.json'), JSON.stringify({ date: new Date().toISOString(), fixtureOnly: true, results }, null, 2) + '\n');
}
if (failed) process.exitCode = 1;
