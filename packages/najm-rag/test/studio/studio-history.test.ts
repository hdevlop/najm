import { describe, test, expect } from 'bun:test';
import { createHistoryLifetime, createStudioHistory } from '../../src/studio-ui/routes/history';

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

describe('the studio history is destroyed when the studio unmounts', () => {
  function lifetime() {
    let destroyed = 0;
    const queue: Array<() => void> = [];
    const life = createHistoryLifetime({ destroy: () => { destroyed++; } }, (run) => { queue.push(run); return run; }, (run) => {
      const i = queue.indexOf(run); if (i >= 0) queue.splice(i, 1);
    });
    const tick = () => queue.splice(0).forEach((run) => run());
    return { life, tick, destroyed: () => destroyed };
  }

  test('a real unmount destroys the history after a tick', () => {
    const { life, tick, destroyed } = lifetime();
    life.retain();
    life.release();
    expect(destroyed()).toBe(0);
    tick();
    expect(destroyed()).toBe(1);
  });

  test('a StrictMode unmount and immediate remount keeps the history', () => {
    const { life, tick, destroyed } = lifetime();
    life.retain();
    life.release();
    life.retain();
    tick();
    expect(destroyed()).toBe(0);
  });
});
