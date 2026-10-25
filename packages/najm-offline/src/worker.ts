import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createNajmServiceWorker, type NajmServiceWorkerOptions } from 'najm-next/pwa';

/** What `buildOfflineShell` wrote: the shell document, every asset it needs, and their joint version. */
export type ShellManifest = { version: string; document: string; assets: string[] };

/**
 * The offline shell this server build was compiled with. `next start` serves
 * only the public files present when it started, so a shell generated later
 * (another build, a test run) must not change what a running server's worker
 * precaches. Unbuilt runs (development, a test fixture) have no build version
 * and read the latest manifest.
 */
export async function readShellManifest(root: string, builtVersion: string | undefined, directory = 'public/offline-shell'): Promise<ShellManifest> {
  if (builtVersion && !/^[0-9a-f]{20}$/.test(builtVersion)) throw new Error('Invalid offline shell version');
  const file = builtVersion ? `manifest-${builtVersion}.json` : 'manifest.json';
  return JSON.parse(await readFile(resolve(root, directory, file), 'utf8')) as ShellManifest;
}

export type OfflineShellWorkerOptions = Pick<NajmServiceWorkerOptions, 'push' | 'offlineDocument' | 'installBudget'> & {
  cacheId: string;
  /** The shell's document allowlist (`createShellPaths` patterns). */
  paths: readonly string[];
  /** The app's switch, read on every request: turned off, the worker drops the shell. */
  enabled(): boolean;
  manifest(): Promise<ShellManifest>;
  /** How long a navigation waits for the server before the shell answers. */
  timeoutMs?: number;
};

/**
 * The `sw.js` route of an app with an offline shell. Turned off, a worker
 * without the shell takes over at once (immediate update) and drops the
 * shell's caches; downloaded data stays on the device, locked by the server's
 * refusals, until offline use is turned on again.
 */
export function createOfflineShellWorker(options: OfflineShellWorkerOptions) {
  const { cacheId, push, offlineDocument } = options;
  const withoutShell = createNajmServiceWorker({ cacheId, push, offlineDocument });
  return async function GET() {
    if (!options.enabled()) return withoutShell();
    const shell = await options.manifest();
    return createNajmServiceWorker({
      cacheId,
      cacheVersion: shell.version,
      offlineUrl: shell.document,
      precache: [...shell.assets],
      navigationFallback: {
        paths: [...options.paths],
        timeoutMs: options.timeoutMs ?? 10_000,
        // Sign-in, public and unlisted pages show the offline page on a
        // connection failure instead of the browser's error.
        otherDocuments: 'offlineDocument',
      },
      updatePolicy: 'staged',
      // Browser update checks of a broken build stop after the budget's failed
      // downloads per version; the active shell keeps working.
      installBudget: options.installBudget ?? { attempts: 3, windowMs: 86_400_000 },
      push,
      offlineDocument,
    })();
  };
}
