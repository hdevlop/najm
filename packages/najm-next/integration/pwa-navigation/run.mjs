import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

const root = dirname(fileURLToPath(import.meta.url));
let child;
let origin;
async function start() {
  child = spawn('bun', ['--no-env-file', resolve(root, 'serve.mjs')], { env: { ...process.env, PWA_NAVIGATION_PORT: origin ? new URL(origin).port : '0' }, stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
  origin = await new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timeout')), 10_000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
    child.stdout.on('data', data => { const match = data.toString().match(/Navigation fixture: (http:\/\/127\.0\.0\.1:\d+)/); if (match) { clearTimeout(timer); resolveReady(match[1]); } });
  });
}
async function stop() {
  if (!child) return;
  const stopped = child;
  child = undefined;
  if (stopped.exitCode !== null) return;
  await new Promise(resolveExit => { stopped.once('exit', resolveExit); stopped.kill(); });
}
const report = { date: new Date().toISOString(), fixtureOnly: true, timeoutMs: 500, connectivity: 'origin stopped; no offline emulation', browsers: [] };
const browserTypes = { chromium, firefox, webkit };
const selected = process.argv.slice(2);
if (selected.some(engine => !browserTypes[engine])) throw new Error('Expected chromium, firefox or webkit');
let failed = false;
await start();
try {
  for (const [engine, type] of Object.entries(browserTypes).filter(([engine]) => !selected.length || selected.includes(engine))) {
    const browser = await type.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    const result = { engine, version: browser.version(), checks: {}, errors: [] };
    report.browsers.push(result);
    try {
      const page = await context.newPage();
      page.on('pageerror', error => result.errors.push(error.message));
      await page.goto(origin + '/start');
      await page.locator('#ready').filter({ hasText: 'Ready' }).waitFor();
      for (const status of [502, 503, 504]) {
        const response = await page.goto(`${origin}/allowed/status?code=${status}`);
        assert.equal(response.status(), 200);
        assert(response.fromServiceWorker());
        await page.getByRole('heading', { name: 'Synthetic shell', exact: true }).waitFor();
      }
      result.checks.gatewayFallback = 'PASS';
      for (const status of [200, 401, 403, 404, 500]) {
        const response = await page.goto(`${origin}/allowed/status?code=${status}`);
        assert.equal(response.status(), status);
        await page.getByRole('heading', { name: `Network status ${status}` }).waitFor();
      }
      result.checks.preserveDomainStatus = 'PASS';
      for (const status of [200, 503]) {
        const response = await page.goto(`${origin}/allowed/redirect?code=${status}`);
        assert.equal(response.status(), status);
        assert(page.url().includes('/login?code='));
        await page.getByRole('heading', { name: `Network status ${status}` }).waitFor();
      }
      result.checks.preserveAuthRedirect = 'PASS';
      for (const path of ['/api/data', '/_next/data', '/allowed/status?code=503&_rsc=payload']) {
        assert.equal((await page.goto(origin + path)).status(), 503);
        assert(!(await page.content()).includes('Synthetic shell'));
      }
      for (const headers of [{ RSC: '1' }, { 'Next-Router-State-Tree': 'tree' }, { 'Next-Router-Prefetch': '1' }]) {
        await page.setExtraHTTPHeaders(headers);
        assert.equal((await page.goto(origin + '/allowed/status?code=503')).status(), 503, JSON.stringify(headers));
      }
      await page.setExtraHTTPHeaders({});
      // Exercise the app's real RSC transport. Browsers own a document
      // navigation's Accept value; Next sends its Flight headers through fetch.
      const flight = await page.evaluate(async () => {
        const response = await fetch('/allowed/status?code=503', { headers: { Accept: 'text/x-component' } });
        return { status: response.status, body: await response.text() };
      });
      assert.equal(flight.status, 503);
      assert(!flight.body.includes('Synthetic shell'));
      result.checks.apiAndRscExclusions = 'PASS';
      const download = page.waitForEvent('download');
      await page.goto(origin + '/allowed/download').catch(error => { if (!/download|aborted|cancelled|canceled/i.test(error.message)) throw error; });
      assert.equal((await download).suggestedFilename(), 'fixture.csv');
      result.checks.downloadPreserved = 'PASS';
      const started = performance.now();
      await page.goto(origin + '/allowed/hang', { waitUntil: 'domcontentloaded', timeout: 5_000 });
      await page.getByRole('heading', { name: 'Synthetic shell', exact: true }).waitFor();
      result.timeoutObservedMs = Math.round(performance.now() - started);
      assert(result.timeoutObservedMs >= 400 && result.timeoutObservedMs < 5_000);
      result.checks.boundedNavigation = 'PASS';
      await page.goto(origin + '/allowed/late');
      await page.getByRole('heading', { name: 'Synthetic shell', exact: true }).waitFor();
      // The server's delayed response would arrive during this interval.
      await new Promise(resolveWait => setTimeout(resolveWait, 1_600));
      await page.getByRole('heading', { name: 'Synthetic shell', exact: true }).waitFor();
      result.checks.lateResponseCannotReplaceShell = 'PASS';
      const cachePaths = await page.evaluate(async () => (await (await caches.open('najm-pwa:navigation-fixture:v1')).keys()).map(request => new URL(request.url).pathname));
      assert.deepEqual(cachePaths.sort(), ['/asset.js', '/shell.html']);
      result.checks.publicCacheOnly = 'PASS';
      await stop();
      await page.goto(origin + '/allowed/cold?view=local');
      await page.getByRole('heading', { name: 'Synthetic shell', exact: true }).waitFor();
      const unlisted = await context.newPage();
      try { await assert.rejects(unlisted.goto(origin + '/login', { timeout: 5_000 })); }
      finally { await unlisted.close(); }
      result.checks.rejectionAndUnlistedRoute = 'PASS';
      await start();
      await page.goto(origin + '/allowed/status?code=503');
      await page.evaluate(async () => (await caches.open('najm-pwa:navigation-fixture:v1')).delete('/shell.html'));
      assert.equal((await page.goto(origin + '/allowed/status?code=503')).status(), 503);
      await page.goto(origin + '/allowed/late');
      await page.getByRole('heading', { name: 'Late network document' }).waitFor();
      result.checks.missingShellPreservesNetwork = 'PASS';
      assert.deepEqual(result.errors, []);
      console.log(`${engine} ${result.version}: gateway, deadline, late response, exclusions and redirects PASS`);
    } catch (error) {
      failed = true;
      result.failure = error.stack;
      console.error(`${engine}: ${error.stack}`);
    } finally {
      await context.close();
      await browser.close();
      if (!child) await start();
    }
  }
} finally {
  await stop();
  await mkdir(resolve(root, '.output'), { recursive: true });
  await writeFile(resolve(root, '.output/results.json'), JSON.stringify(report, null, 2) + '\n');
}
if (failed) process.exitCode = 1;
