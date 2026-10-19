// Synthetic policy only. No real School data, credentials, or auth service.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = `
import { createOfflineAccess } from '/offline.js';
const db = await new Promise((resolve, reject) => {
  const open = indexedDB.open('synthetic-offline-policy', 1);
  open.onupgradeneeded = () => { open.result.createObjectStore('policy'); open.result.createObjectStore('pending'); };
  open.onerror = () => reject(open.error); open.onsuccess = () => resolve(open.result);
});
let clock = 10000;
const store = {
  read() { return new Promise((resolve, reject) => { const r = db.transaction('policy').objectStore('policy').get('current'); r.onsuccess = () => resolve(r.result ?? null); r.onerror = () => reject(r.error); }); },
  compareAndSwap(expected, next) { return new Promise((resolve, reject) => {
    const tx = db.transaction('policy', 'readwrite'); const s = tx.objectStore('policy'); let applied = false;
    const r = s.get('current'); r.onsuccess = () => { if ((r.result?.revision ?? null) === expected) { s.put(next, 'current'); applied = true; } };
    tx.oncomplete = () => resolve(applied); tx.onabort = () => reject(tx.error); tx.onerror = () => {};
  }); },
};
const access = createOfflineAccess({ store, now: () => clock, clockRollbackToleranceMs: 5 });
const input = {
  accountId: 'teacher-a', installationId: 'synthetic-school', installationEpoch: 'epoch-1', authorizationGeneration: 'policy-1',
  issuedAt: 1000000, validUntil: 1010000, consent: true,
  online: { authenticated: true, accountId: 'teacher-a', permissions: ['use:offline','mark:attendance'] },
  scopes: [{ id: 'attendance:class-1', academicYear: '2026-2027', capabilities: ['mark:attendance'] }],
};
const request = { accountId: 'teacher-a', installationId: 'synthetic-school', installationEpoch: 'epoch-1', scopeId: 'attendance:class-1', academicYear: '2026-2027', capability: 'mark:attendance' };
globalThis.fixture = { access, input, request, setClock: value => { clock = value; },
  putPending() { return new Promise((resolve, reject) => { const tx = db.transaction('pending','readwrite'); tx.objectStore('pending').put({ accountId:'teacher-a', operationId:'pending-uncertain' }, 'operation'); tx.oncomplete=resolve; tx.onabort=()=>reject(tx.error); }); },
  putPendingWithFence(token) { return new Promise((resolve, reject) => {
    const tx=db.transaction(['policy','pending'],'readwrite'); let applied=false;
    const r=tx.objectStore('policy').get('current'); r.onsuccess=()=>{
      const p=r.result;
      if(p?.status==='available' && p.fence===token.fence && p.entitlement?.accountId===token.accountId) {
        tx.objectStore('pending').put({accountId:token.accountId,operationId:'late-callback'},'operation'); applied=true;
      }
    };
    tx.oncomplete=()=>resolve(applied); tx.onabort=()=>reject(tx.error);
  }); },
  pending() { return new Promise((resolve,reject)=>{ const r=db.transaction('pending').objectStore('pending').get('operation');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error); }); },
};
if (typeof document !== 'undefined') document.body.dataset.ready = 'true';
`;
const worker = `import '/fixture.js'; self.onmessage = async ({data}) => {
  try { if(data==='lock') { const token=await fixture.access.capture(); postMessage(await fixture.access.lock(token,'logout')); }
  else if(data==='authorize') postMessage(await fixture.access.authorize(fixture.request)); }
  catch(error) { postMessage({error:String(error)}); }
}; postMessage('ready');`;
const entry = await readFile(resolve(root, 'dist/client/offline.js'), 'utf8');
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const body = path === '/offline.js' ? entry : path === '/fixture.js' ? fixture : path === '/worker.js' ? worker
    : '<!doctype html><html><body><h1>Cached policy fixture</h1><script type="module" src="/fixture.js"></script></body></html>';
  res.setHeader('Content-Type', path.endsWith('.js') ? 'application/javascript' : 'text/html'); res.end(body);
});
await new Promise(resolveStarted => server.listen(0, '127.0.0.1', resolveStarted));
const origin = `http://127.0.0.1:${server.address().port}`;
const report = { date: new Date().toISOString(), fixtureOnly: true, artifact: 'najm-auth/dist/client/offline.js', browsers: [] };
let failed = false;
try {
  for (const [engine, type] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await type.launch({ headless: true });
    const context = await browser.newContext();
    const result = { engine, version: browser.version(), status: 'FAIL', checks: {}, errors: [] };
    report.browsers.push(result);
    try {
      const a = await context.newPage(); const b = await context.newPage();
      for (const page of [a, b]) page.on('pageerror', error => result.errors.push(error.message));
      await Promise.all([a.goto(origin), b.goto(origin)]);
      await Promise.all([a.waitForFunction(() => document.body.dataset.ready), b.waitForFunction(() => document.body.dataset.ready)]);
      const tokens = await Promise.all([a.evaluate(() => fixture.access.capture()), b.evaluate(() => fixture.access.capture())]);
      const race = await Promise.all([a.evaluate(token => fixture.access.enroll(token, fixture.input), tokens[0]), b.evaluate(token => fixture.access.enroll(token, fixture.input), tokens[1])]);
      assert.deepEqual(race.map(r => r.applied).sort(), [false, true]);
      result.checks.transactionalTabEnrollment = 'PASS';
      assert.equal((await b.evaluate(() => fixture.access.authorize(fixture.request))).allowed, true);
      await a.evaluate(() => fixture.putPending());
      const stale = await a.evaluate(() => fixture.access.capture());
      const workerAllowed = await b.evaluate(async () => {
        const w = new Worker('/worker.js', { type: 'module' }); globalThis.policyWorker = w;
        await new Promise((resolve, reject) => { w.onmessage = e => e.data === 'ready' ? resolve() : reject(e.data); w.onerror = reject; });
        return new Promise(resolve => { w.onmessage = e => resolve(e.data); w.postMessage('authorize'); });
      });
      assert.equal(workerAllowed.allowed, true);
      await b.evaluate(() => new Promise(resolve => { policyWorker.onmessage = e => resolve(e.data); policyWorker.postMessage('lock'); }));
      assert.equal(await a.evaluate(token => fixture.access.isCurrent(token), stale), false);
      assert.equal((await a.evaluate(token => fixture.access.enroll(token, fixture.input), stale)).applied, false);
      assert.equal(await a.evaluate(token => fixture.putPendingWithFence(token), stale), false);
      assert.deepEqual(await a.evaluate(() => fixture.pending()), { accountId: 'teacher-a', operationId: 'pending-uncertain' });
      result.checks.workerLogoutFencesPageAndRetainsWork = 'PASS';
      await a.reload(); await a.waitForFunction(() => document.body.dataset.ready);
      assert.deepEqual(await a.evaluate(() => fixture.access.authorize(fixture.request)), { allowed: false, reason: 'logout' });
      result.checks.coldReopenLock = 'PASS';
      await a.evaluate(async () => {
        const input = { ...fixture.input, accountId: 'teacher-b', online: { ...fixture.input.online, accountId: 'teacher-b' } };
        await fixture.access.enroll(await fixture.access.capture(), input);
      });
      assert.deepEqual(await a.evaluate(() => fixture.access.authorize(fixture.request)), { allowed: false, reason: 'account-mismatch' });
      result.checks.accountIsolation = 'PASS';
      await a.evaluate(() => fixture.setClock(20000));
      assert.deepEqual(await a.evaluate(() => fixture.access.authorize({ ...fixture.request, accountId: 'teacher-b' })), { allowed: false, reason: 'expired' });
      assert.deepEqual(await a.evaluate(() => fixture.pending()), { accountId: 'teacher-a', operationId: 'pending-uncertain' });
      result.checks.expiryPreservesWork = 'PASS';
      await a.evaluate(async () => {
        await fixture.access.enroll(await fixture.access.capture(), { ...fixture.input, issuedAt: 1010001, validUntil: 1020001 });
        fixture.setClock(20100); await fixture.access.authorize(fixture.request);
        fixture.setClock(20000);
      });
      assert.deepEqual(await a.evaluate(() => fixture.access.authorize(fixture.request)), { allowed: false, reason: 'clock-rollback' });
      result.checks.persistedClockRollback = 'PASS';
      assert.deepEqual(result.errors, []); result.status = 'PASS';
      console.log(`${engine} ${result.version}: cached entitlement, transactional two tabs, real worker logout, cold reopen, account isolation, expiry PASS`);
    } catch (error) { failed = true; result.failure = error.stack; console.error(result.failure); }
    finally { await context.close(); await browser.close(); }
  }
} finally {
  server.closeAllConnections(); await new Promise(resolveClosed => server.close(resolveClosed));
  await mkdir(resolve(root, '.cache'), { recursive: true });
  await writeFile(resolve(root, '.cache/offline-access-browser.json'), JSON.stringify(report, null, 2) + '\n');
}
if (failed) process.exitCode = 1;
