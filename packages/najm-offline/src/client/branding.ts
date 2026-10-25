type Branding = { slots?: Readonly<Record<string, string | null>> };
/**
 * Logos the app's API serves, which the worker never caches: the shell keeps
 * its own copies in `cacheName`. `immutable` matches paths whose bytes never
 * change (named by a hash or a fresh id), so a stored copy is already current.
 */
export type ShellBrandingOptions = { cacheName: string; slots: readonly string[]; immutable?: RegExp };

function logoUrls(options: ShellBrandingOptions, branding: Branding | undefined, origin: string): string[] {
  return [...new Set(options.slots.flatMap(slot => {
    const path = branding?.slots?.[slot];
    if (!path) return [];
    const url = new URL(path, origin);
    return url.origin === origin ? [url.href] : [];
  }))];
}

/** Online: store the app's current logos for the offline shell. */
export async function cacheShellBranding(options: ShellBrandingOptions, branding: Branding | undefined, origin = location.origin,
  storage: Pick<CacheStorage, 'open'> = caches, request: typeof fetch = fetch) {
  const urls = logoUrls(options, branding, origin);
  const cache = await storage.open(options.cacheName);
  let complete = true;
  let downloaded = false;
  for (const url of urls) {
    // Each signed-in page runs this: a stored immutable logo is already current.
    if (options.immutable?.test(new URL(url).pathname) && await cache.match(url)) continue;
    try {
      const response = await request(url, { cache: 'no-cache' });
      if (response.ok && (response.headers.get('content-type') ?? '').startsWith('image/')) { await cache.put(url, response); downloaded = true; }
      else complete = false;
    } catch { complete = false; }
  }
  // Drop a replaced logo only once every current one is stored.
  if (complete && downloaded) for (const key of await cache.keys()) if (!urls.includes(key.url)) await cache.delete(key);
}

/** Offline: point the logo slots at the stored copies. */
export async function withCachedBranding<T extends Branding>(options: ShellBrandingOptions, branding: T, origin = location.origin,
  storage: Pick<CacheStorage, 'open'> = caches): Promise<T> {
  const cache = await storage.open(options.cacheName);
  const slots: Record<string, string | null> = { ...branding.slots };
  for (const slot of options.slots) {
    const path = slots[slot];
    const cached = path ? await cache.match(new URL(path, origin).href) : undefined;
    if (cached) slots[slot] = URL.createObjectURL(await cached.blob());
  }
  return { ...branding, slots } as T;
}
