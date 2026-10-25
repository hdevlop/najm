/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Browser error audit for an app's offline suites (Playwright). Every real
 * page error and unhandled rejection fails; WebKit's native fetch console
 * diagnostics for requests a test cut off (by `setOffline`, a navigation or a
 * close) are kept apart, and each must match a failed or interrupted request.
 */
export type OfflineBrowserErrorAuditOptions = {
  /** Path prefixes whose stack-less WebKit "Cannot load" reports are image loads (default: none). */
  imagePaths?: readonly string[];
  /** Same-origin GET paths whose failures excuse a worker resource diagnostic. */
  resource?: (pathname: string) => boolean;
  /** The page binding the init script reports through. */
  binding?: string;
};
export type OfflineBrowserError = { kind: string; message: string; name?: string; stack?: string };

export function createOfflineBrowserErrorAudit(engine: string, origin: string, options: OfflineBrowserErrorAuditOptions = {}) {
  const imagePaths = options.imagePaths ?? [];
  const resource = options.resource ?? (pathname => pathname.startsWith('/images/') || pathname === '/favicon.ico');
  const binding = options.binding ?? 'najmOfflineRecordBrowserError';
  const errors: OfflineBrowserError[] = [];
  const diagnostics: { kind: string; message: string; url?: string; interrupted?: boolean }[] = [];
  const failed = new Set<string>();
  const failedResources: string[] = [];
  const closing = new WeakSet<object>();
  // When each page last began or committed a navigation, which stops the previous document.
  const navigated = new WeakMap<object, number>();
  const stopping = (page: any) => closing.has(page.context()) || Date.now() - (navigated.get(page) ?? -Infinity) < 5000;
  const prefix = 'Fetch API cannot load ';
  const suffix = ' due to access control checks.';
  const host = new URL(origin).host;
  // Contexts a test has taken offline. That, a close or a navigation cancels
  // pending fetches, often without a `requestfailed` event; WebKit still reports each natively.
  const offline = new WeakSet<object>();
  const interrupted = (page: any) => stopping(page) || offline.has(page.context());
  const observe = (page: any) => {
    page.on('request', (request: any) => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigated.set(page, Date.now()); });
    page.on('framenavigated', (frame: any) => { if (frame === page.mainFrame()) navigated.set(page, Date.now()); });
    page.on('pageerror', (error: Error) => {
      const line = error.stack?.split('\n')[0] ?? '';
      if (engine === 'webkit' && error.name === 'Fetch API cannot load https' && line.startsWith(prefix + origin) && line.endsWith(suffix)) {
        const url = line.slice(prefix.length, -suffix.length);
        diagnostics.push({ kind: 'fetch', url, message: line, interrupted: interrupted(page) });
        console.error('Native WebKit fetch diagnostic:', line);
      } else if (engine === 'webkit' && !error.stack && error.name === 'Cannot load https'
        && imagePaths.some(path => error.message.startsWith('/' + host + path)) && error.message.endsWith('.')) {
        const url = 'https:/' + error.message.slice(0, -1);
        diagnostics.push({ kind: 'fetch', url, message: 'Cannot load ' + url });
      } else if (engine === 'webkit' && !error.stack && error.name === 'Cannot load https'
        && error.message === '/' + host + '/sw.js due to access control checks.' && interrupted(page)) {
        // The online app's worker update check (registration.update()), cut off.
        diagnostics.push({ kind: 'worker-update', message: error.name + ': ' + error.message });
      } else if (engine === 'webkit' && !error.stack && error.name === 'FetchEvent.respondWith received an error'
        && error.message === 'TypeError: Load failed') {
        diagnostics.push({ kind: 'worker-resource', message: error.name + ': ' + error.message });
      } else if (engine === 'webkit' && !error.stack && error.name === 'Cache API operation failed'
        && error.message === 'Context is stopped' && stopping(page)) {
        // A Cache API call of a document that a close or navigation stopped.
        diagnostics.push({ kind: 'closing-context', message: error.name + ': ' + error.message });
      } else errors.push({ kind: 'pageerror', name: error.name, message: error.message, stack: error.stack });
    });
  };
  return { get errors(): OfflineBrowserError[] {
    // A matching failed request, or one the test cut off, is required; an arbitrary exception is not excused.
    const unmatched = diagnostics.filter(item => item.kind === 'fetch' && !failed.has(item.url!) && !item.interrupted);
    if (diagnostics.filter(item => item.kind === 'worker-resource').length > failedResources.length)
      unmatched.push({ kind: 'worker-resource', message: 'Unmatched worker resource failures' });
    return [...errors, ...unmatched.map(item => ({ kind: 'unmatched-fetch-diagnostic', message: item.message }))];
  }, diagnostics, async close(context: any) {
    if (!context) return;
    closing.add(context); await context.close();
  }, async attach(context: any) {
    await context.exposeBinding(binding, (_source: unknown, error: OfflineBrowserError) => { errors.push(error); });
    // Source text, not a function: a bundled function carries helpers (`__name`) the page does not define.
    await context.addInitScript(`(() => {
      const report = error => { void window[${JSON.stringify(binding)}](error).catch(() => undefined); };
      addEventListener('unhandledrejection', event => report({ kind: 'unhandledrejection',
        message: String(event.reason?.message ?? event.reason) }));
      // Resource-load events have no Error object. Real uncaught JS exceptions do.
      addEventListener('error', event => { if (event.error) report({ kind: 'error', message: event.message }); });
    })();`);
    context.on('page', observe);
    const setOffline = context.setOffline.bind(context);
    context.setOffline = async (value: boolean) => {
      if (value) offline.add(context); else offline.delete(context);
      return setOffline(value);
    };
    context.on('requestfailed', (request: any) => {
      failed.add(request.url());
      const url = new URL(request.url());
      if (url.origin === new URL(origin).origin && request.method() === 'GET' && resource(url.pathname)) failedResources.push(request.url());
    });
    for (const page of context.pages()) observe(page);
  } };
}
