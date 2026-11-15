import { describe, test, expect } from 'bun:test';
import { createStudioHistory } from '../../src/studio-ui/routes/history';

/** Just enough of `window` for TanStack's browser history. */
function fakeWindow(href: string) {
  const url = new URL(href);
  const win: any = {
    location: {
      get href() { return url.href; },
      get pathname() { return url.pathname; },
      get search() { return url.search; },
      get hash() { return url.hash; },
      get origin() { return url.origin; },
    },
    history: {
      state: null as any,
      length: 1,
      pushState(state: any, _: string, next?: string) { this.state = state; if (next != null) url.href = new URL(next, url.href).href; },
      replaceState(state: any, _: string, next?: string) { this.state = state; if (next != null) url.href = new URL(next, url.href).href; },
      back() {}, forward() {}, go() {},
    },
    addEventListener() {}, removeEventListener() {},
  };
  return win;
}

describe('studio history and a Next.js host', () => {
  test('a same-URL history write (Next re-syncing its state) does not notify the router', () => {
    const win = fakeWindow('http://localhost/rag-studio/semantics?view=table');
    const history = createStudioHistory(win);
    let notified = 0;
    history.subscribe(() => { notified++; });

    win.history.replaceState({ ...win.history.state, __NA: true }, '', '/rag-studio/semantics?view=table');
    expect(notified).toBe(0);
  });

  test('a write that changes the URL still notifies the router', () => {
    const win = fakeWindow('http://localhost/rag-studio/semantics?view=table');
    const history = createStudioHistory(win);
    let notified = 0;
    history.subscribe(() => { notified++; });

    win.history.replaceState(null, '', '/rag-studio/semantics?view=json');
    win.history.pushState(null, '', '/rag-studio/tests');
    expect(notified).toBe(2);
    expect(history.location.pathname).toBe('/rag-studio/tests');
  });

  test('destroy restores the original history methods', () => {
    const win = fakeWindow('http://localhost/rag-studio');
    const original = win.history.replaceState;
    const history = createStudioHistory(win);
    expect(win.history.replaceState).not.toBe(original);
    history.destroy();
    expect(win.history.replaceState).toBe(original);
  });
});
