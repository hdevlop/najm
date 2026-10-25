import { expect, test } from 'bun:test';
import { createOfflineBrowserErrorAudit } from '../src/testing';

test('the page script is self-contained source and reports through its binding', async () => {
  const scripts: unknown[] = [];
  let reported: ((source: unknown, error: object) => void) | undefined;
  const context = { pages: () => [], on() {}, setOffline: async () => {},
    exposeBinding: async (_name: string, callback: typeof reported) => { reported = callback; },
    addInitScript: async (script: unknown) => { scripts.push(script); } };
  const audit = createOfflineBrowserErrorAudit('chromium', 'https://app.test', { binding: 'appRecordError' });
  await audit.attach(context);
  expect(typeof scripts[0]).toBe('string');
  // A bundler's helpers (`__name`, `__defProp`) do not exist in the page.
  expect(String(scripts[0])).not.toMatch(/__\w+\(/);
  const listeners: Record<string, (event: object) => void> = {};
  const page = { appRecordError: async (error: object) => { reported!(null, error); },
    addEventListener: (name: string, listener: (event: object) => void) => { listeners[name] = listener; } };
  new Function('window', 'addEventListener', String(scripts[0]))(page, page.addEventListener);
  listeners.error({ error: new Error('boom'), message: 'boom' });
  listeners.error({ message: 'a resource failed to load' });
  listeners.unhandledrejection({ reason: new TypeError('rejected') });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(audit.errors).toEqual([{ kind: 'error', message: 'boom' }, { kind: 'unhandledrejection', message: 'rejected' }]);
});
