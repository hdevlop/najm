import { stagedWorkerSource } from './internal/stagedWorker';

const WORKER_HEADERS = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'",
  'Content-Type': 'application/javascript; charset=utf-8',
  'Service-Worker-Allowed': '/',
  'X-Content-Type-Options': 'nosniff',
} as const;

const CACHE_TOKEN = /^[a-z0-9][a-z0-9._-]*$/i;
const HEX_COLOR = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;
const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;
const MAX_PUSH_NOTIFICATION_ID_LENGTH = 100;
const MAX_PUSH_TITLE_LENGTH = 120;
const MAX_PUSH_BODY_LENGTH = 300;

export interface NajmOfflineDocumentOptions {
  backgroundColor?: string;
  description?: string;
  direction?: 'ltr' | 'rtl' | 'auto';
  foregroundColor?: string;
  language?: string;
  mutedColor?: string;
  retryLabel?: string;
  themeColor?: string;
  title?: string;
}

export interface NajmServiceWorkerPushOptions {
  /** Default badge shown by the notification platform. */
  badge?: string;
  /** Fallback title used only when a valid payload supplies an empty title. */
  defaultTitle: string;
  /** Default notification icon. */
  icon?: string;
  /** Fixed same-origin destination opened after a notification click. */
  notificationPath: string;
}

export interface NajmNavigationFallbackOptions {
  /** Exact document paths or subtree patterns ending in /*. Queries are ignored. */
  paths: readonly string[];
  /** Wait for network response headers, in milliseconds. Default 10000; range 1-60000. */
  timeoutMs?: number;
  /**
   * Same-origin documents outside `paths`. `'browser'` (default) leaves them to
   * the browser. `'offlineDocument'` answers only an actual connection failure
   * with the inline offline document: their responses, redirects and slow loads
   * are kept, and the cached shell is never used for them.
   */
  otherDocuments?: 'browser' | 'offlineDocument';
}

export interface NajmInstallBudgetOptions {
  /** Failed asset downloads allowed per `cacheVersion` within `windowMs`. Integer 1-20. */
  attempts: number;
  /** Sliding window in milliseconds. Default 86400000 (one day); range 60000-2592000000. */
  windowMs?: number;
}

export interface NajmServiceWorkerOptions {
  /** Isolates this app's caches from other apps on the same origin. */
  cacheId?: string;
  /** Change this value when the explicitly precached shell changes. */
  cacheVersion?: string;
  /** Inline fallback used when `offlineUrl` is omitted or unavailable. */
  offlineDocument?: NajmOfflineDocumentOptions;
  /** Same-origin document shown when a navigation fails. */
  offlineUrl?: string;
  /** Same-origin static assets used by the offline document. */
  precache?: readonly string[];
  /** Opt-in allowlisted shell fallback on network errors, timeout, or 502/503/504. Requires offlineUrl. */
  navigationFallback?: NajmNavigationFallbackOptions;
  /** Wait for explicit all-client consent and retain old public assets. Default immediate. */
  updatePolicy?: 'immediate' | 'staged';
  /**
   * Staged only: bound failed asset downloads per version across tabs, app
   * openings and the browser's own update checks. An attempt is reserved
   * before any asset request and released only by a completed install.
   */
  installBudget?: NajmInstallBudgetOptions;
  /** Optional reusable web-push behavior. */
  push?: NajmServiceWorkerPushOptions;
}

export type NajmServiceWorkerRoute = () => Response;

function assertCacheToken(value: string, name: string): string {
  if (!CACHE_TOKEN.test(value)) {
    throw new TypeError(`[najm-next] ${name} must contain only letters, numbers, dots, underscores, or hyphens.`);
  }
  return value;
}

function assertPath(value: string, name: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) {
    throw new TypeError(`[najm-next] ${name} must be a same-origin absolute path.`);
  }
  return value;
}

function color(value: string | undefined, fallback: string, name: string): string {
  const resolved = value ?? fallback;
  if (!HEX_COLOR.test(resolved)) {
    throw new TypeError(`[najm-next] ${name} must be a three- or six-digit hex color.`);
  }
  return resolved;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function createOfflineDocument(options: NajmOfflineDocumentOptions = {}): string {
  const language = options.language ?? 'en';
  if (!LANGUAGE_TAG.test(language)) {
    throw new TypeError('[najm-next] offlineDocument.language must be a valid language tag.');
  }

  const direction = options.direction ?? 'auto';
  const backgroundColor = color(options.backgroundColor, '#f8fafc', 'offlineDocument.backgroundColor');
  const foregroundColor = color(options.foregroundColor, '#0f172a', 'offlineDocument.foregroundColor');
  const mutedColor = color(options.mutedColor, '#475569', 'offlineDocument.mutedColor');
  const themeColor = color(options.themeColor, backgroundColor, 'offlineDocument.themeColor');
  const title = escapeHtml(options.title ?? 'You are offline');
  const description = escapeHtml(
    options.description ?? 'Reconnect to the internet, then try loading this page again.',
  );
  const retryLabel = escapeHtml(options.retryLabel ?? 'Try again');

  return `<!doctype html>
<html lang="${language}" dir="${direction}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="${themeColor}">
    <title>${title}</title>
    <style>
      :root{color-scheme:light dark;font-family:system-ui,sans-serif}
      body{min-height:100vh;margin:0;display:grid;place-items:center;background:${backgroundColor};color:${foregroundColor}}
      main{width:min(30rem,calc(100% - 3rem));text-align:center}
      h1{margin:0 0 .5rem}p{line-height:1.6;color:${mutedColor}}
      a{display:inline-block;margin-top:1rem;border-radius:.75rem;padding:.8rem 1.2rem;background:${foregroundColor};color:${backgroundColor};font-weight:700;text-decoration:none}
    </style>
  </head>
  <body><main><h1>${title}</h1><p>${description}</p><a href="">${retryLabel}</a></main></body>
</html>`;
}

function createPushWorkerSource(options: NajmServiceWorkerPushOptions | undefined): string {
  if (!options) return '';

  const notificationPath = assertPath(options.notificationPath, 'push.notificationPath');
  const icon = options.icon ? assertPath(options.icon, 'push.icon') : null;
  const badge = options.badge ? assertPath(options.badge, 'push.badge') : null;
  const defaultTitle = options.defaultTitle.trim();
  if (!defaultTitle || defaultTitle.length > MAX_PUSH_TITLE_LENGTH) {
    throw new TypeError(
      `[najm-next] push.defaultTitle must contain 1-${MAX_PUSH_TITLE_LENGTH} characters.`,
    );
  }

  return `
const PUSH_NOTIFICATION_PATH = ${JSON.stringify(notificationPath)};
const PUSH_DEFAULT_TITLE = ${JSON.stringify(defaultTitle)};
const PUSH_ICON = ${JSON.stringify(icon)};
const PUSH_BADGE = ${JSON.stringify(badge)};
const PUSH_KEYS = new Set(["notificationId", "title", "body"]);

self.addEventListener("push", (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    return;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
  if (!Object.keys(payload).every((key) => PUSH_KEYS.has(key))) return;
  if (
    typeof payload.notificationId !== "string" ||
    payload.notificationId.length < 1 ||
    payload.notificationId.length > ${MAX_PUSH_NOTIFICATION_ID_LENGTH} ||
    typeof payload.title !== "string" ||
    payload.title.length > ${MAX_PUSH_TITLE_LENGTH} ||
    typeof payload.body !== "string" ||
    payload.body.length > ${MAX_PUSH_BODY_LENGTH}
  ) return;

  const title = payload.title || PUSH_DEFAULT_TITLE;
  const notificationOptions = {
    body: payload.body,
    data: { notificationId: payload.notificationId },
    ...(PUSH_ICON ? { icon: PUSH_ICON } : {}),
    ...(PUSH_BADGE ? { badge: PUSH_BADGE } : {}),
  };
  event.waitUntil(self.registration.showNotification(title, notificationOptions));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const notificationId = event.notification.data?.notificationId;
  if (
    typeof notificationId !== "string" ||
    notificationId.length < 1 ||
    notificationId.length > ${MAX_PUSH_NOTIFICATION_ID_LENGTH}
  ) return;

  const url = new URL(PUSH_NOTIFICATION_PATH, self.location.origin);
  url.searchParams.set("focus", notificationId);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        try {
          if (new URL(client.url).origin !== self.location.origin) continue;
          await client.navigate(url.href);
          return client.focus();
        } catch {
          continue;
        }
      }
      return self.clients.openWindow(url.href);
    }),
  );
});
`;
}

function createWorkerSource(options: NajmServiceWorkerOptions): string {
  const cacheId = assertCacheToken(options.cacheId ?? 'app', 'cacheId');
  const cacheVersion = assertCacheToken(options.cacheVersion ?? 'v1', 'cacheVersion');
  const offlineUrl = options.offlineUrl ? assertPath(options.offlineUrl, 'offlineUrl') : null;
  const precache = [...new Set([
    ...(offlineUrl ? [offlineUrl] : []),
    ...(options.precache ?? []).map((path, index) => assertPath(path, `precache[${index}]`)),
  ])];
  const inlineDocument = createOfflineDocument(options.offlineDocument);
  const pushWorkerSource = createPushWorkerSource(options.push);
  const navigation = options.navigationFallback;
  const staged = options.updatePolicy === 'staged';
  if (options.updatePolicy !== undefined && !['immediate', 'staged'].includes(options.updatePolicy)) throw new TypeError('[najm-next] Invalid updatePolicy.');
  if (staged && (!offlineUrl || !options.cacheVersion)) throw new TypeError('[najm-next] Staged updates require offlineUrl and an explicit cacheVersion.');
  if (navigation !== undefined) {
    if (!offlineUrl) throw new TypeError('[najm-next] navigationFallback requires offlineUrl.');
    if (!navigation || !Array.isArray(navigation.paths) || !navigation.paths.length) {
      throw new TypeError('[najm-next] navigationFallback.paths must be a non-empty array.');
    }
    for (const path of navigation.paths) {
      if (typeof path !== 'string' || !path.startsWith('/') || path.includes('//') || /[?#\\]/.test(path)
        || path.slice(0, path.endsWith('/*') ? -2 : undefined).includes('*')
        || new URL(path, 'https://najm.invalid').pathname !== path) {
        throw new TypeError('[najm-next] navigationFallback.paths must contain canonical absolute paths or trailing /* patterns.');
      }
    }
    const timeoutMs = navigation.timeoutMs ?? 10_000;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
      throw new TypeError('[najm-next] navigationFallback.timeoutMs must be an integer from 1 to 60000.');
    }
    if (navigation.otherDocuments !== undefined && !['browser', 'offlineDocument'].includes(navigation.otherDocuments)) {
      throw new TypeError("[najm-next] navigationFallback.otherDocuments must be 'browser' or 'offlineDocument'.");
    }
  }
  const otherDocuments = navigation?.otherDocuments === 'offlineDocument';
  const budget = options.installBudget;
  if (budget !== undefined) {
    if (!staged) throw new TypeError("[najm-next] installBudget requires updatePolicy: 'staged'.");
    if (!budget || !Number.isInteger(budget.attempts) || budget.attempts < 1 || budget.attempts > 20) {
      throw new TypeError('[najm-next] installBudget.attempts must be an integer from 1 to 20.');
    }
    const windowMs = budget.windowMs ?? 86_400_000;
    if (!Number.isInteger(windowMs) || windowMs < 60_000 || windowMs > 2_592_000_000) {
      throw new TypeError('[najm-next] installBudget.windowMs must be an integer from 60000 to 2592000000.');
    }
  }

  return `const CACHE_PREFIX = ${JSON.stringify(`najm-pwa:${cacheId}:`)};
const CACHE_NAME = CACHE_PREFIX + ${JSON.stringify(cacheVersion)};
const OFFLINE_URL = ${JSON.stringify(offlineUrl)};
const PRECACHE = ${JSON.stringify(precache)};
const INLINE_OFFLINE_DOCUMENT = ${JSON.stringify(inlineDocument)};
${staged ? stagedWorkerSource(cacheId, cacheVersion, budget && { attempts: budget.attempts, windowMs: budget.windowMs ?? 86_400_000 }) : ''}
${navigation ? `const NAVIGATION_PATHS = ${JSON.stringify([...new Set(navigation.paths)])};
const NAVIGATION_TIMEOUT_MS = ${JSON.stringify(navigation.timeoutMs ?? 10_000)};

async function cachedShell() {
  try {
    ${staged ? 'if (!await stagedReady()) return undefined;' : ''}
    return await (await caches.open(CACHE_NAME)).match(OFFLINE_URL);
  } catch {
    return undefined;
  }
}

async function navigateWithFallback(request) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (request.signal.aborted) cancel();
  else request.signal.addEventListener("abort", cancel, { once: true });
  let timer;
  const network = fetch(request, { signal: controller.signal });
  try {
    const response = await Promise.race([
      network,
      new Promise((resolve) => { timer = setTimeout(() => resolve(null), NAVIGATION_TIMEOUT_MS); }),
    ]);
    if (response === null) {
      const fallback = await cachedShell();
      if (!fallback) return await network;
      controller.abort();
      return fallback;
    }
    // Redirects and downloads retain the browser's normal handling.
    if (response.redirected || response.type === "opaqueredirect" || response.headers.has("Content-Disposition") ||
        (response.headers.get("Content-Type") || "").toLowerCase().includes("text/x-component")) return response;
    if ([502, 503, 504].includes(response.status)) {
      const fallback = await cachedShell();
      if (fallback) {
        if (response.body) response.body.cancel().catch(() => {});
        return fallback;
      }
    }
    return response;
  } catch (error) {
    if (request.signal.aborted) throw error;
    return await cachedShell() || inlineOfflineResponse();
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", cancel);
  }
}
${otherDocuments ? `
// Unlisted documents keep every server response and have no deadline: only a
// connection failure becomes the public offline document, never the shell.
async function navigateWithOfflineDocument(request) {
  try {
    return await fetch(request);
  } catch (error) {
    if (request.signal.aborted) throw error;
    return inlineOfflineResponse();
  }
}
` : ''}` : ''}

function inlineOfflineResponse() {
  return new Response(INLINE_OFFLINE_DOCUMENT, {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    ${staged ? 'installStaged()' : `
    (PRECACHE.length
      ? caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
      : Promise.resolve()
    ).then(() => self.skipWaiting()),
    `}
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    ${staged ? 'self.clients.claim()' : `
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
    `}
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;
${navigation || staged ? `
  // Framework payloads and API routes must never become shell HTML, even
  // when a broad document subtree was configured by the caller.
  if (requestUrl.pathname === "/api" || requestUrl.pathname.startsWith("/api/") ||
      requestUrl.pathname === "/_next" || requestUrl.pathname.startsWith("/_next/") ||
      requestUrl.searchParams.has("_rsc") || request.headers.has("RSC") ||
      request.headers.has("Next-Router-State-Tree") || request.headers.has("Next-Router-Prefetch") ||
      (request.headers.get("Accept") || "").toLowerCase().includes("text/x-component")) return;
` : ''}

  const requestPath = requestUrl.pathname + requestUrl.search;
${staged ? `
  if (request.mode !== "navigate") {
    event.respondWith(retainedAsset(request, requestPath).then((cached) => cached || fetch(request)));
    return;
  }
` : ''}
  if (PRECACHE.includes(requestPath) && request.mode !== "navigate") {
    event.respondWith(
      caches.open(CACHE_NAME)
        .then((cache) => cache.match(request))
        .then((cached) => cached || fetch(request)),
    );
    return;
  }

  // Online documents are never cached. A failed navigation receives only
  // the explicit public shell or inline retry document.
  if (request.mode !== "navigate") return;
${navigation ? `
  if (!NAVIGATION_PATHS.some((path) => path.endsWith("/*")
    ? requestUrl.pathname.startsWith(path.slice(0, -1))
    : requestUrl.pathname === path)) {${otherDocuments ? `
    event.respondWith(navigateWithOfflineDocument(request));` : ''}
    return;
  }
  event.respondWith(navigateWithFallback(request));
` : `

  event.respondWith(
    fetch(request).catch(async () => {
      if (OFFLINE_URL) {
        const cache = await caches.open(CACHE_NAME);
        const fallback = await cache.match(OFFLINE_URL);
        if (fallback) return fallback;
      }

      return inlineOfflineResponse();
    }),
  );
`}
});
${pushWorkerSource}
`;
}

export function createNajmServiceWorker(
  options: NajmServiceWorkerOptions = {},
): NajmServiceWorkerRoute {
  const source = createWorkerSource(options);
  return function GET(): Response {
    return new Response(source, { headers: WORKER_HEADERS });
  };
}

/** Zero-config route handler for `app/sw.js/route.ts`. */
export const GET = createNajmServiceWorker();
