'use client';
/**
 * Stands in for `next/navigation` in an offline shell build: the shell is one
 * document that moves between its pages with the History API.
 */
import { useMemo, useSyncExternalStore } from 'react';

/** Dispatched on `window` whenever the shell moves to another page. */
export const SHELL_NAVIGATION_EVENT = 'najm-offline-navigation';
const listen = (listener: () => void) => { addEventListener('popstate', listener); addEventListener(SHELL_NAVIGATION_EVENT, listener); return () => { removeEventListener('popstate', listener); removeEventListener(SHELL_NAVIGATION_EVENT, listener); }; };
/** Moves the shell to a same-origin page. */
export function navigateShell(href: string, replace = false) {
  const target = new URL(href, location.href);
  if (target.origin !== location.origin) throw new Error('External navigation requires a document link');
  history[replace ? 'replaceState' : 'pushState'](null, '', target.href);
  dispatchEvent(new Event(SHELL_NAVIGATION_EVENT));
}
let params: (path: string) => Record<string, string> = () => ({});
/** How the app's dynamic segments read from a path, since the shell has no route tree. */
export function configureShellParams(match: (path: string) => Record<string, string>) { params = match; }
export function usePathname() { return useSyncExternalStore(listen, () => location.pathname, () => '/'); }
export function useSearchParams() { const search = useSyncExternalStore(listen, () => location.search, () => ''); return useMemo(() => new URLSearchParams(search), [search]); }
export function useParams() { const path = usePathname(); return useMemo(() => params(path), [path]); }
const router = { push: (href: string) => navigateShell(href), replace: (href: string) => navigateShell(href, true), back: () => history.back(), forward: () => history.forward(), refresh: () => dispatchEvent(new Event(SHELL_NAVIGATION_EVENT)), prefetch: async () => undefined };
export function useRouter() { return router; }
export function redirect(href: string): never { navigateShell(href, true); throw new Error('Offline route redirected'); }
export function notFound(): never { throw new Error('Offline route not found'); }
