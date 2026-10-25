'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuthEvent } from 'najm-auth/client/react';
import type { SessionExpiredEvent } from 'najm-auth/client';
import { connectPreparationLogout } from '../client/bootstrap';
import { cacheShellBranding, type ShellBrandingOptions } from '../client/branding';
import { prepareShell, registerShell } from '../client/registration';
import type { ShellUpdates } from '../client/updates';

/**
 * najm-auth's `useRedirectOnSessionExpired`, except that a refused session's
 * offline lock commits before the page leaves (at most `waitMs`).
 */
export function useSignInOnSessionExpired(loginRoute: string, lockRefusedSession: (event: SessionExpiredEvent) => Promise<void>, waitMs = 3000) {
  useAuthEvent('sessionExpired', event => {
    const locked = lockRefusedSession(event);
    void Promise.race([locked, new Promise(resolve => setTimeout(resolve, waitMs))]).then(() => {
      const login = new URL(loginRoute, window.location.origin);
      login.searchParams.set('from', `${window.location.pathname}${window.location.search}`);
      window.location.assign(login.toString());
    });
  });
}

type Branding = { slots?: Readonly<Record<string, string | null>> };
export type OfflinePreparationOptions = {
  namespace: string;
  /** Off in development: the worker and shell exist only in a production build. */
  enabled: boolean;
  /** The shell version this build was compiled with. */
  version: string | undefined;
  signedIn: boolean;
  language: string;
  branding?: Branding;
  brandingCache: ShellBrandingOptions;
  authClient: Parameters<typeof connectPreparationLogout>[0];
  bootstrapKey: string;
  isShellPath(path: string): boolean;
  /** The page's reads are known to be offline (the client's `isKnownOffline`). */
  isKnownOffline(): boolean;
  /** A write is in flight: an update waits for it. */
  busy(): boolean;
  updates: ShellUpdates;
  manifestUrl?: string;
};

/**
 * The online page's part of offline use: it installs the worker and the shell
 * (silently, with a finite retry budget), keeps the shell's logos and offline
 * language current, sends shell links to the shell while offline, and reports
 * a staged update the user can apply.
 */
export function useOfflinePreparation(options: OfflinePreparationOptions) {
  const [updateReady, setUpdateReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [activate, setActivate] = useState<(() => Promise<void>) | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const { enabled, signedIn, branding, language } = options;
  useEffect(() => {
    try { return connectPreparationLogout(latest.current.authClient, localStorage, latest.current.bootstrapKey); } catch { return; }
  }, []);
  useEffect(() => {
    if (!enabled || !signedIn || typeof caches === 'undefined') return;
    // Silent and optional: without a stored logo the shell shows the app name.
    void cacheShellBranding(latest.current.brandingCache, branding).catch(() => undefined);
  }, [enabled, signedIn, branding]);
  useEffect(() => {
    // Signed in or not: the offline page also answers sign-in and public pages.
    if (enabled) void latest.current.updates.rememberOfflineLanguage(language);
  }, [enabled, language]);
  useEffect(() => {
    const current = latest.current;
    if (!enabled || !('serviceWorker' in navigator)) return;
    let cancelled = false;
    const abort = new AbortController();
    let dispose: (() => void) | undefined;
    const runningVersion = current.version;
    if (!runningVersion) return;
    // Every online tab participates in consent/pinning once a worker is active,
    // even if installation failed or this opening exhausted its retry budget.
    void current.updates.connectShellUpdates(runningVersion, () => latest.current.busy(), value => { if (!cancelled) setUpdateReady(value); }).then(updates => {
      if (cancelled) { updates.dispose(); return; }
      dispose = updates.dispose;
      setActivate(() => async () => {
        setUpdating(true); setBlocked(false);
        try { const result = await updates.activate(); setBlocked(!result.activated); if (result.activated) setUpdateReady(false); }
        catch { setBlocked(true); }
        finally { setUpdating(false); }
      });
    }).catch(() => { /* No active worker/storage yet; preparation stays silent. */ });
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest('a');
      if ((navigator.onLine && !latest.current.isKnownOffline()) || !anchor || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || anchor.target || anchor.download) return;
      const url = new URL(anchor.href);
      if (url.origin === location.origin && latest.current.isShellPath(url.pathname)) {
        event.preventDefault(); event.stopImmediatePropagation(); location.assign(url.href);
      }
    };
    document.addEventListener('click', navigate, true);
    void prepareShell(current.namespace, runningVersion, async () => {
      await registerShell(navigator.serviceWorker, 30000, abort.signal);
      if (cancelled) return;
      const response = await fetch(current.manifestUrl ?? '/offline-shell/manifest.json', { cache: 'no-store', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10000)]) });
      if (!response.ok) throw new Error('Offline application manifest is unavailable.');
      await response.json();
    }, abort.signal);
    return () => { cancelled = true; abort.abort(); dispose?.(); document.removeEventListener('click', navigate, true); };
  }, [enabled]);
  return { updateReady, blocked, updating, activate };
}
