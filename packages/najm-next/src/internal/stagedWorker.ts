/** Public-asset-only update protocol. Generated inside a service worker. */
export function stagedWorkerSource(cacheId: string, cacheVersion: string,
  budget?: { attempts: number; windowMs: number }): string {
  return `
const UPDATE_CACHE_ID = ${JSON.stringify(cacheId)};
const UPDATE_VERSION = ${JSON.stringify(cacheVersion)};
const MANIFEST_KEY = new URL(".najm-pwa-manifest/" + UPDATE_CACHE_ID, self.registration.scope).href;
const EXPECTED_MANIFEST = { version: UPDATE_VERSION, paths: PRECACHE };
const INSTALL_BUDGET = ${JSON.stringify(budget ?? null)};
const BUDGET_DATABASE = "najm-pwa-install-budget:" + UPDATE_CACHE_ID;

// One readwrite transaction per change: atomic across tabs, registrations and
// the browser's own update checks. Not the Cache API: WebKit discards every
// cache write made by an install that then fails.
function budgetTransaction(change) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(BUDGET_DATABASE, 1);
    open.onupgradeneeded = () => open.result.createObjectStore("attempts");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      let refusal;
      try {
        const transaction = database.transaction("attempts", "readwrite");
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onabort = () => { database.close(); reject(refusal || transaction.error || new Error("Install budget unavailable")); };
        change(transaction.objectStore("attempts"), (error) => { refusal = error; transaction.abort(); });
      } catch (error) { database.close(); reject(error); }
    };
  });
}

// Reserve before any asset request, so an install killed mid-download still
// counts. No tab, app opening or reconnect resets it: attempts expire after
// the window, a new version has its own budget, a completed install clears it.
// Unavailable storage refuses the install rather than download without a bound.
async function reserveInstall() {
  if (!INSTALL_BUDGET) return;
  await budgetTransaction((store, refuse) => {
    const read = store.get(UPDATE_VERSION);
    read.onsuccess = () => {
      const now = Date.now();
      // A clock moved far back must not keep a version blocked indefinitely.
      const attempts = (Array.isArray(read.result?.attempts) ? read.result.attempts : [])
        .filter((time) => Number.isFinite(time) && Math.abs(now - time) < INSTALL_BUDGET.windowMs);
      if (attempts.length >= INSTALL_BUDGET.attempts) refuse(new Error("Install attempts for this cacheVersion are exhausted"));
      else store.put({ attempts: [...attempts, now] }, UPDATE_VERSION);
    };
  });
}

async function releaseInstall() {
  if (!INSTALL_BUDGET) return;
  // A completed download proves the origin serves a complete build again.
  try { await budgetTransaction((store) => { store.clear(); }); } catch {}
}

async function readManifest(cache) {
  const response = await cache.match(MANIFEST_KEY);
  if (!response) return null;
  try {
    const value = await response.json();
    return value && typeof value.version === "string" && Array.isArray(value.paths) &&
      value.paths.every((path) => typeof path === "string" && path.startsWith("/") && !path.startsWith("//")) ? value : null;
  } catch { return null; }
}

async function installStaged() {
  const cache = await caches.open(CACHE_NAME);
  const previous = await readManifest(cache);
  if (previous && JSON.stringify(previous) !== JSON.stringify(EXPECTED_MANIFEST)) {
    throw new Error("A changed shell must use a new cacheVersion");
  }
  await reserveInstall();
  // Download into an unpublished cache: a failed/mutable reinstall must never
  // overwrite assets still used by an active document with this version.
  const stagingName = CACHE_NAME + ":install:" + Date.now() + ":" + Math.random();
  const candidate = await caches.open(stagingName);
  try {
  await candidate.addAll(PRECACHE);
  // Existing documents may request lazy chunks after activation. A URL used
  // by two builds must identify identical bytes, except the entry document.
  for (const name of (await caches.keys()).filter((key) => key.startsWith(CACHE_PREFIX) && key !== stagingName)) {
    const old = await caches.open(name);
    const manifest = await readManifest(old);
    if (!manifest) continue;
    for (const path of PRECACHE.filter((path) => (name === CACHE_NAME || path !== OFFLINE_URL) && manifest.paths.includes(path))) {
      const before = await old.match(path);
      const after = await candidate.match(path);
      if (!before || !after) throw new Error("Cannot verify shared asset identity");
      const a = new Uint8Array(await before.arrayBuffer());
      const b = new Uint8Array(await after.arrayBuffer());
      if (a.length !== b.length || !a.every((value, index) => value === b[index])) throw new Error("Changed assets must use immutable URLs");
    }
  }
  for (const path of PRECACHE) await cache.put(path, await candidate.match(path));
  await cache.put(MANIFEST_KEY, new Response(JSON.stringify(EXPECTED_MANIFEST), { headers: { "Content-Type": "application/json" } }));
  } finally { await caches.delete(stagingName); }
  await releaseInstall();
}

async function stagedReady() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const manifest = await readManifest(cache);
    if (!manifest || JSON.stringify(manifest) !== JSON.stringify(EXPECTED_MANIFEST)) return false;
    return (await Promise.all(PRECACHE.map((path) => cache.match(path)))).every(Boolean);
  } catch { return false; }
}

async function retainedAsset(request, path) {
  const names = (await caches.keys()).filter((name) => name.startsWith(CACHE_PREFIX));
  names.sort((a, b) => a === CACHE_NAME ? -1 : b === CACHE_NAME ? 1 : 0);
  for (const name of names) {
    const cache = await caches.open(name);
    const manifest = await readManifest(cache);
    if (!manifest || !manifest.paths.includes(path)) continue;
    const response = await cache.match(request);
    if (response) return response;
  }
  return undefined;
}

function scopedClient(client) {
  try { return new URL(client.url).origin === self.location.origin && client.url.startsWith(self.registration.scope); }
  catch { return false; }
}

async function clientConsent(client) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const finish = (ready) => { clearTimeout(timer); channel.port1.close(); resolve(ready === true); };
    const timer = setTimeout(() => finish(false), 1500);
    channel.port1.onmessage = (event) => finish(event.data?.protocol === 1 && event.data.ready === true);
    try { client.postMessage({ type: "NAJM_PWA_CAN_ACTIVATE", protocol: 1, cacheId: UPDATE_CACHE_ID, targetVersion: UPDATE_VERSION }, [channel.port2]); }
    catch { finish(false); }
  });
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.protocol !== 1 || data.cacheId !== UPDATE_CACHE_ID || !event.ports[0] || !scopedClient(event.source)) return;
  if (data.type !== "NAJM_PWA_STATUS" && data.type !== "NAJM_PWA_ACTIVATE") return;
  const reply = (value) => event.ports[0].postMessage({ protocol: 1, cacheId: UPDATE_CACHE_ID, cacheVersion: UPDATE_VERSION, ...value });
  event.waitUntil((async () => {
    if (data.type === "NAJM_PWA_STATUS") { reply({ ready: await stagedReady() }); return; }
    if (data.cacheVersion !== UPDATE_VERSION || !await stagedReady()) { reply({ activated: false, reason: "assets-unavailable" }); return; }
    const clients = (await self.clients.matchAll({ type: "window", includeUncontrolled: true })).filter(scopedClient);
    if (!(await Promise.all(clients.map(clientConsent))).every(Boolean)) { reply({ activated: false, reason: "client-busy-or-unavailable" }); return; }
    // Recheck after consent: eviction during preparation must not activate a broken build.
    if (!await stagedReady()) { reply({ activated: false, reason: "assets-unavailable" }); return; }
    await self.skipWaiting();
    reply({ activated: true });
  })().catch(() => reply({ activated: false, reason: "update-unavailable" })));
});
`;
}
