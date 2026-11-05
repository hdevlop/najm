// ============================================================================
// Early refresh — start a signed-in page's first token refresh from its HTML
// ============================================================================
// A signed-in page is rendered with its user but without an access token, so
// every data request waits for `POST {auth}/refresh`. The client sends that
// only after all of its JavaScript has downloaded and run, which on a phone is
// seconds after the HTML arrived. `bootRefreshScript` sends the same request
// from the document while it is still being read; the client's first refresh
// takes that answer instead of sending its own, so the refresh token still
// turns once per page load.

/** The window property the early refresh waits under for the client. */
export const BOOT_REFRESH_KEY = '__najmAuthBootRefresh';

/** An early answer older than this is not used; the client asks again. */
const BOOT_REFRESH_MAX_AGE_MS = 60_000;

interface BootRefresh {
  url: string;
  startedAt: number;
  response: Promise<Response>;
}

export interface BootRefreshScriptOptions {
  /**
   * The refresh endpoint exactly as the client calls it: the client's
   * `baseURL`, its `authPrefix`, then `/refresh` (for example
   * `/api/auth/refresh`). Any other URL is ignored by the client.
   */
  url: string;
}

/**
 * The inline script that starts a page's first refresh. Render it in the
 * document's head, with the page's CSP nonce, and only on a page whose client
 * will refresh as it starts: signed in, hydrated without an access token.
 * Anywhere else its answer goes unused, and the refresh token turns twice.
 *
 * The script sends the request the client would (POST, cookies included,
 * JSON accepted) and never throws.
 */
export function bootRefreshScript({ url }: BootRefreshScriptOptions): string {
  if (typeof url !== 'string' || url.length === 0) {
    throw new TypeError('bootRefreshScript: url must be a non-empty string');
  }
  // JSON text, with `<` escaped so the value cannot close the script element.
  const target = JSON.stringify(url).replace(/</g, '\\u003c');
  const key = JSON.stringify(BOOT_REFRESH_KEY);
  return `(function(){try{var w=window,k=${key};if(w[k])return;`
    + `var r=fetch(${target},{method:'POST',credentials:'include',headers:{Accept:'application/json'}});`
    + `r.catch(function(){});w[k]={url:${target},startedAt:Date.now(),response:r}}catch(e){}})();`;
}

/**
 * The page's early refresh for `url`, handed out once. Another URL or an
 * answer older than a minute is dropped and yields null, as does a page
 * without one.
 */
export function takeBootRefresh(url: string): Promise<Response> | null {
  if (typeof window === 'undefined') return null;
  const holder = window as unknown as Record<string, BootRefresh | undefined>;
  const boot = holder[BOOT_REFRESH_KEY];
  if (!boot) return null;
  delete holder[BOOT_REFRESH_KEY];
  if (!(boot.response instanceof Promise) || !sameUrl(boot.url, url)) return null;
  if (!(Date.now() - boot.startedAt <= BOOT_REFRESH_MAX_AGE_MS)) return null;
  return boot.response;
}

function sameUrl(a: string, b: string): boolean {
  try {
    const base = window.location?.href;
    return new URL(a, base).href === new URL(b, base).href;
  } catch {
    return a === b;
  }
}
