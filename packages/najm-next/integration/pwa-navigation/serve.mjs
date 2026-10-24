import { createNajmServiceWorker } from '../../dist/pwa.js';

const dist = new URL('../../dist/', import.meta.url);
const worker = createNajmServiceWorker({
  cacheId: 'navigation-fixture', cacheVersion: 'v1', offlineUrl: '/shell.html', precache: ['/asset.js'],
  // Deliberately include API/framework paths to prove the hard exclusions.
  navigationFallback: { paths: ['/allowed/*', '/api/*', '/_next/*'], timeoutMs: 500, otherDocuments: 'offlineDocument' },
  offlineDocument: { languages: [
    { language: 'en', title: 'Fixture is offline', description: 'Reconnect, then retry the fixture.', retryLabel: 'Retry fixture' },
    { language: 'fr', title: 'La démo est hors ligne', description: 'Reconnectez-vous, puis réessayez.', retryLabel: 'Réessayer' },
    { language: 'ar', direction: 'rtl', title: 'العرض غير متصل', description: 'أعد الاتصال، ثم حاول مجددًا.', retryLabel: 'إعادة المحاولة' },
  ] },
});
const html = heading => new Response(`<!doctype html><h1>${heading}</h1>`, { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' } });
const server = Bun.serve({
  hostname: '127.0.0.1', port: Number(process.env.PWA_NAVIGATION_PORT ?? 0), idleTimeout: 0,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/sw.js') return worker();
    if (url.pathname === '/shell.html') return html('Synthetic shell');
    if (url.pathname === '/asset.js') return new Response('// public fixture asset');
    // The built browser client, so a page can record its language as an app would.
    if (/^\/dist\/[\w.-]+\.js$/.test(url.pathname)) {
      return new Response(Bun.file(new URL(url.pathname.slice('/dist/'.length), dist)), { headers: { 'Content-Type': 'text/javascript' } });
    }
    if (url.pathname === '/start') return new Response(`<!doctype html><h1>Navigation fixture</h1><output id="ready">Preparing</output><script>
      navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(async () => {
        if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, {once:true}));
        document.getElementById('ready').textContent = 'Ready';
      });</script>`, { headers: { 'Content-Type': 'text/html' } });
    if (url.pathname === '/allowed/hang') return new Promise(() => {});
    if (url.pathname === '/welcome' || url.pathname === '/') return html('Public document');
    if (url.pathname === '/unlisted/late') {
      await Bun.sleep(1_500);
      return html('Late unlisted document');
    }
    if (url.pathname === '/allowed/late') {
      await Bun.sleep(1_500);
      return html('Late network document');
    }
    if (url.pathname === '/allowed/redirect') return Response.redirect(new URL('/login?code=' + (url.searchParams.get('code') ?? '200'), url));
    if (url.pathname === '/allowed/download') return new Response('synthetic,csv', { headers: { 'Content-Disposition': 'attachment; filename=fixture.csv' } });
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) return Response.json({ fixture: true }, { status: 503 });
    if (url.pathname === '/allowed/status' || url.pathname === '/login') {
      const status = Number(url.searchParams.get('code') ?? 200);
      return new Response(`<!doctype html><h1>Network status ${status}</h1>`, { status, headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' } });
    }
    return new Response('Unlisted fixture route', { status: 404 });
  },
});
console.log(`Navigation fixture: ${server.url}`);
