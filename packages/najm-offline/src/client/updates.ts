import { connectNajmPwaClient, rememberNajmOfflineLanguage } from 'najm-next/pwa/client';
import { isActiveShellReady } from './readiness';

export type ShellUpdateOptions = {
  namespace: string;
  /** The worker's `cacheId`. */
  cacheId: string;
  /** A page with no business form open; its editors never block an update. Defaults to `/login`. */
  loginPath?: string;
  /** Unsaved work the app keeps outside forms (drafts in storage) blocks an update. */
  hasUnsavedWork?: () => boolean;
};

type PinLocks = Pick<LockManager, 'query' | 'request'>;
// Absent in older browsers and in test runtimes.
const pinLocks = (): PinLocks | undefined => (typeof navigator === 'undefined' ? undefined : navigator.locks);

// Shared Najm table/header filters are view state. Unknown inputs, including
// inline editors outside forms, remain conservatively protected.
export function isUpdateEdit(target: EventTarget | null): target is Element {
  if (!(target instanceof Element) || !target.isConnected) return false;
  if (target.closest('form:not([role="search"])')) return true;
  return !target.closest('input[type="search"], [role="searchbox"], [role="search"], [data-ntable-desktop-filters], [data-ntable-mobile-primary-filter], [data-slot="page-header-full-actions"]');
}

/**
 * Staged updates of the app's shell: every open tab pins the version it runs,
 * and an update activates only when no tab has an open editor, unsaved input or
 * a write in flight.
 */
export function createShellUpdates(options: ShellUpdateOptions) {
  const { cacheId } = options;
  const loginPath = options.loginPath ?? '/login';
  const PIN_PREFIX = `${options.namespace}.shell.pin:`;

  /** The worker's offline page (pages outside the shell) leads with the language the app last displayed. */
  function rememberOfflineLanguage(language: string): Promise<boolean> {
    return rememberNajmOfflineLanguage({ cacheId, language }).catch(() => false);
  }

  // Each tab holds a Web Lock named after its pin for its document's life. The
  // browser keeps it while the tab is suspended and drops it when the tab is
  // closed, crashes or is discarded, so a pin whose lock is gone belongs to no
  // running document. Pins never expire by elapsed time. Without Web Locks, or
  // when the lock state cannot be read, no pin is reclaimed.
  async function pinnedVersions(storage: Storage, locks = pinLocks()) {
    const pins: [string, string][] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      const version = key?.startsWith(PIN_PREFIX) ? storage.getItem(key) : null;
      if (key && version) pins.push([key, version]);
    }
    // Pins are read before locks: a tab writes its pin only after its lock is
    // granted, so every pin read here is already visible to the query.
    let held: Set<string> | null = null;
    try { if (locks) held = new Set(((await locks.query()).held ?? []).map(lock => lock.name ?? '')); }
    catch { held = null; }
    const versions = new Set<string>();
    for (const [key, version] of pins) {
      if (!held || held.has(key)) versions.add(version);
      else storage.removeItem(key);
    }
    return versions;
  }

  async function pruneUnpinnedCaches(storage: Storage, current: string, activating?: string,
    canDelete: () => boolean | Promise<boolean> = () => true, locks = pinLocks()) {
    const protectedVersions = async () => new Set([current, ...(activating ? [activating] : []), ...await pinnedVersions(storage, locks)]);
    const pinned = await protectedVersions();
    const prefix = `najm-pwa:${cacheId}:`;
    const inactive = (await caches.keys()).filter(key => key.startsWith(prefix) && !key.includes(':install:') && !pinned.has(key.slice(prefix.length)));
    // Keep two unpinned generations as well as all versions used by open tabs.
    for (const key of inactive.slice(0, -2)) {
      if (!await canDelete()) return;
      if (!(await protectedVersions()).has(key.slice(prefix.length))) await caches.delete(key);
    }
  }

  // Do not reclaim anything while another generation is installing or waiting.
  // A background-tab build must never prune on behalf of a newer active worker.
  async function pruneActiveShellCaches(storage: Storage, version: string, scope: string,
    container: Pick<ServiceWorkerContainer, 'controller' | 'getRegistration'> = navigator.serviceWorker) {
    const controller = container.controller;
    if (!await isActiveShellReady(container, cacheId, version)) return false;
    const canDelete = async () => {
      const live = await container.getRegistration(scope);
      return container.controller === controller && live?.scope === scope && live.active === controller
        && controller?.state === 'activated' && !live.installing && !live.waiting;
    };
    if (!await canDelete()) return false;
    await pruneUnpinnedCaches(storage, version, undefined, canDelete);
    return true;
  }

  // Every waiting update needs explicit activation or natural activation after
  // old clients close. Silence/slow status replies never bypass that policy.
  async function connectShellUpdates(version: string, busy: () => boolean, onUpdate: (ready: boolean) => void) {
    const registration = await navigator.serviceWorker.ready;
    const dirtyInputs = new Set<Element>();
    let disposed = false;
    let startupPruned = false;
    const pin = `${PIN_PREFIX}${crypto.randomUUID()}`;
    let releasePin = () => {};
    // The pin is written only once its lock is granted (see pinnedVersions).
    const holdPin = async () => {
      const locks = pinLocks();
      if (locks) {
        try {
          await new Promise<void>((granted, failed) => {
            locks.request(pin, () => {
              granted();
              return disposed ? undefined : new Promise<void>(release => { releasePin = release; });
            }).catch(failed);
          });
        } catch { /* An unlocked pin can be reclaimed by another tab; it still protects this one now. */ }
      }
      if (!disposed) localStorage.setItem(pin, version);
    };
    await holdPin();
    const input = (event: Event) => { if (isUpdateEdit(event.target)) dirtyInputs.add(event.target); };
    const reset = (event: Event) => {
      // Resetting one form must not clear another form's unsaved input.
      for (const target of dirtyInputs) if (event.target instanceof HTMLFormElement && target instanceof Node && event.target.contains(target)) dirtyInputs.delete(target);
    };
    const release = (event: PageTransitionEvent) => { if (!event.persisted) localStorage.removeItem(pin); };
    // A page restored from the back/forward cache may have lost its lock, and
    // then its pin, while it was stored. Take both again.
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted || disposed) return;
      void (async () => {
        const held = await pinLocks()?.query().then(state => !!state.held?.some(lock => lock.name === pin)).catch(() => true) ?? true;
        if (held) { if (!disposed) localStorage.setItem(pin, version); return; }
        releasePin();
        await holdPin();
      })().catch(() => { /* Storage unavailable: this tab stays unpinned. */ });
    };
    document.addEventListener('input', input, true);
    document.addEventListener('change', input, true);
    document.addEventListener('reset', reset, true);
    addEventListener('pagehide', release);
    addEventListener('pageshow', restore);
    const updates = connectNajmPwaClient({ registration, cacheId, cacheVersion: version,
      canActivate: () => {
        for (const target of dirtyInputs) if (!isUpdateEdit(target)) dirtyInputs.delete(target);
        // No public cross-form dirty registry exists in Kit. Keep open business
        // forms/dialogs protected even when a custom control changes without a
        // native input event. Saving/closing the editor releases this
        // conservative gate; never guess that a submit event means saved.
        const openEditor = location.pathname !== loginPath && [...document.querySelectorAll('form:not([role="search"]), [role="dialog"], [role="alertdialog"]')]
          .some(element => element.getClientRects().length > 0 && !element.closest('[role="search"]'));
        return !openEditor && dirtyInputs.size === 0 && !options.hasUnsavedWork?.() && !busy();
      },
    });
    const activate = async () => {
      const target = await updates.getUpdate();
      if (!target?.ready) return { activated: false, reason: 'assets-unavailable' };
      const result = await updates.activateUpdate();
      // Protect the target too, including rollback to an older cached build.
      if (result.activated) await pruneUnpinnedCaches(localStorage, version, target.cacheVersion);
      return result;
    };
    const check = async () => {
      try {
        const update = await updates.getUpdate();
        if (disposed) return;
        onUpdate(!!update?.ready);
        if (!startupPruned && !update) startupPruned = await pruneActiveShellCaches(localStorage, version, registration.scope);
      } catch { /* Connection/worker/cache storage not ready. */ }
    };
    const timer = setInterval(() => { void check(); }, 15_000);
    void check();
    return {
      activate,
      dispose() {
        disposed = true; clearInterval(timer); updates.dispose(); localStorage.removeItem(pin); releasePin();
        document.removeEventListener('input', input, true); document.removeEventListener('change', input, true); document.removeEventListener('reset', reset, true);
        removeEventListener('pagehide', release); removeEventListener('pageshow', restore);
      },
    };
  }

  return { rememberOfflineLanguage, pruneUnpinnedCaches, pruneActiveShellCaches, connectShellUpdates, isUpdateEdit };
}
export type ShellUpdates = ReturnType<typeof createShellUpdates>;
