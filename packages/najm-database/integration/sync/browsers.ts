import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import type { SyncOperation } from '../../src/sync/contracts';

/** Run against the built browser entry and a marked disposable PostgreSQL server. */
export async function browserProof(options: {
  push: (operation: SyncOperation) => Promise<unknown>;
  lookup: (operation: SyncOperation) => Promise<unknown>;
  bootstrap: () => Promise<unknown>;
  stats: () => Promise<unknown>;
}) {
  const result: unknown[] = [];
  const built = await Bun.build({ entrypoints: [fileURLToPath(new URL('./browser.ts', import.meta.url))],
    target: 'browser', format: 'esm', minify: true,
    plugins: [{ name: 'client-import-isolation', setup(builder) {
      builder.onResolve({ filter: /^(node:|najm-core$|najm-auth$|postgres$|drizzle-orm|server-only$)/ }, args => { throw Error('Browser entry reaches ' + args.path); });
    } }],
  });
  if (!built.success) throw new AggregateError(built.logs, 'Sync browser artifact failed');
  const source = await built.outputs[0].text();
  let unavailable = false; let loseNext = false; let pushes = 0;
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/browser.js') return new Response(source, { headers: { 'Content-Type': 'application/javascript' } });
    if (path === '/') return new Response('<!doctype html><h1>Preparing</h1><script type="module" src="/browser.js"></script>', { headers: { 'Content-Type': 'text/html' } });
    if (path === '/control') { const body = await request.json(); unavailable = !!body.unavailable; loseNext = !!body.loseNext; return Response.json({ unavailable, loseNext }); }
    if (path === '/stats') return Response.json({ pushes, data: await options.stats() });
    if (unavailable) return Response.json({ code: 'SERVER_UNAVAILABLE' }, { status: 503 });
    try {
      if (path === '/api/bootstrap') return Response.json(await options.bootstrap());
      if (path === '/api/lookup') return Response.json(await options.lookup(await request.json()));
      if (path === '/api/push') {
        pushes++; const receipt = await options.push(await request.json());
        if (loseNext) { loseNext = false; return Response.json({ code: 'SERVER_UNAVAILABLE' }, { status: 503 }); }
        return Response.json(receipt);
      }
      return new Response('not found', { status: 404 });
    } catch (error) { return Response.json({ code: error instanceof Error && 'code' in error ? error.code : 'SERVER_UNAVAILABLE' }, { status: 409 }); }
  } });
  try {
    for (const [engine, browserType] of Object.entries({ chromium, firefox, webkit })) {
      const browser = await browserType.launch(); const profile = await browser.newContext(); const errors: string[] = [];
      const record = { engine, version: browser.version(), checks: {} as Record<string, string>, errors };
      result.push(record);
      try {
        const name = 'sync-' + crypto.randomUUID(); const url = new URL('/?database=' + name, server.url).href;
        let page = await profile.newPage(); page.on('pageerror', error => errors.push(error.message));
        await page.goto(url); await page.getByRole('heading', { name: 'Native durable sync proof ready' }).waitFor();
        await page.evaluate(() => (window as any).proof.prepare());
        const op = await page.evaluate(() => (window as any).proof.queue('absent'));
        const before = await (await page.request.get(new URL('/stats', server.url).href)).json();
        await page.request.post(new URL('/control', server.url).href, { data: { loseNext: true } });
        const lost = await page.evaluate(() => (window as any).proof.synchronize().then(() => false, () => true)); assert.equal(lost, true);
        let state = await page.evaluate(() => (window as any).proof.state()); assert.equal(state.pending[0].state, 'uncertain'); assert.equal(state.pending[0].operation.payloadHash, op.payloadHash);
        await page.close(); page = await profile.newPage(); page.on('pageerror', error => errors.push(error.message));
        await page.goto(url); await page.getByRole('heading', { name: 'Native durable sync proof ready' }).waitFor();
        await page.evaluate(async () => { await (window as any).proof.retryNow(); await (window as any).proof.synchronize(); });
        state = await page.evaluate(() => (window as any).proof.state()); assert.equal(state.pending[0].state, 'acknowledged');
        const after = await (await page.request.get(new URL('/stats', server.url).href)).json(); assert.equal(after.pushes, before.pushes + 1);
        record.checks.durableLostReplyRecoveredByStatusWithoutSecondPush = 'PASS';

        await page.request.post(new URL('/control', server.url).href, { data: { unavailable: true } });
        const unsent = await page.evaluate(() => (window as any).proof.queue('late'));
        await page.evaluate(() => (window as any).proof.synchronize().catch(() => {}));
        state = await page.evaluate(() => (window as any).proof.state()); assert.equal(state.pending[1].operation.payloadHash, unsent.payloadHash); assert.equal(state.pending[1].state, 'uncertain');
        await page.request.post(new URL('/control', server.url).href, { data: {} });
        await page.evaluate(() => (window as any).proof.retryNow());
        const second = await profile.newPage(); await second.goto(url); await second.getByRole('heading', { name: 'Native durable sync proof ready' }).waitFor();
        await Promise.all([page.evaluate(() => (window as any).proof.synchronize()), second.evaluate(() => (window as any).proof.synchronize())]);
        state = await page.evaluate(() => (window as any).proof.state()); assert.equal(state.pending[1].state, 'acknowledged'); await second.close();
        record.checks.networkFailureAndTwoTabSenderExclusion = 'PASS';

        await page.evaluate(() => (window as any).proof.queue('present'));
        const worker = await page.evaluate(name => new Promise(resolve => {
          const worker = new Worker('/browser.js', { type: 'module' }); worker.onmessage = event => { worker.terminate(); resolve(event.data); }; worker.postMessage({ name });
        }), name); assert.equal((worker as any).ok, true);
        state = await page.evaluate(() => (window as any).proof.state()); assert.equal(state.pending[2].state, 'acknowledged');
        record.checks.actualDedicatedWorkerUsesBuiltReplica = 'PASS';

        const stale = await page.evaluate(() => (window as any).proof.queue('late', '0'));
        await page.evaluate(() => (window as any).proof.synchronize());
        state = await page.evaluate(() => (window as any).proof.state()); assert.equal(state.pending[3].state, 'conflict'); assert.equal(state.pending[3].operation.payloadHash, stale.payloadHash);
        record.checks.staleRevisionRetainsOriginalConflict = 'PASS';
        assert.deepEqual(errors, []); console.log(`${engine}: durable replica, lost reply, two tabs, worker and conflict PASS`);
      } finally { await profile.close(); await browser.close(); }
    }
  } finally { await server.stop(true); }
  return result;
}
