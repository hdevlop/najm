import { createBrowserHistory, type RouterHistory } from '@tanstack/react-router';

type HistoryWindow = Window & typeof globalThis;

/**
 * TanStack's browser history, made quiet about history writes that do not
 * change the URL.
 *
 * `createBrowserHistory` patches `window.history.pushState/replaceState` and
 * notifies the router synchronously on every call, so the router reloads and
 * sets React state. A Next.js host re-writes the current URL with its own
 * state from inside a `useInsertionEffect` whenever the URL changes under it
 * (the studio's `?view=` updates do), so that state update landed inside an
 * insertion effect: React logged "useInsertionEffect must not schedule
 * updates." on every such screen. A same-URL write gives the router nothing
 * to load, so it now passes with TanStack's subscribers ignored; writes that
 * change the URL still notify the router as before.
 */
export function createStudioHistory(win: HistoryWindow = window): RouterHistory {
  const history = createBrowserHistory({ window: win });
  const patchedPush = win.history.pushState;
  const patchedReplace = win.history.replaceState;

  const sameUrl = (url: string | URL | null | undefined) =>
    url == null || new URL(String(url), win.location.href).href === win.location.href;

  const guard = (patched: History['pushState']): History['pushState'] =>
    function (this: History, data: any, unused: string, url?: string | URL | null) {
      if (!sameUrl(url)) return patched.call(this, data, unused, url);
      const previous = history._ignoreSubscribers;
      history._ignoreSubscribers = true;
      try {
        return patched.call(this, data, unused, url);
      } finally {
        history._ignoreSubscribers = previous;
      }
    };

  const guardedPush = guard(patchedPush);
  const guardedReplace = guard(patchedReplace);
  win.history.pushState = guardedPush;
  win.history.replaceState = guardedReplace;

  const destroy = history.destroy;
  history.destroy = () => {
    if (win.history.pushState === guardedPush) win.history.pushState = patchedPush;
    if (win.history.replaceState === guardedReplace) win.history.replaceState = patchedReplace;
    destroy();
  };
  return history;
}

/**
 * Destroys a router's history when the studio really unmounts.
 *
 * Every mount creates a router whose history wraps `window.history` and adds a
 * popstate listener; without a destroy, leaving and re-entering the studio in
 * a host app stacked them. The destroy waits a tick: React StrictMode unmounts
 * and remounts at once in development, and that remount must keep a working
 * history, so `retain()` cancels a pending destroy.
 */
export function createHistoryLifetime(
  history: Pick<RouterHistory, 'destroy'>,
  schedule: (run: () => void) => unknown = (run) => setTimeout(run, 0),
  cancel: (handle: any) => void = (handle) => clearTimeout(handle),
) {
  let pending: unknown = null;
  return {
    retain() {
      if (pending !== null) { cancel(pending); pending = null; }
    },
    release() {
      pending = schedule(() => { pending = null; history.destroy(); });
    },
  };
}
