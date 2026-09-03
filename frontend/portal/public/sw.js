/* AutoVet offline-first service worker.
 * - GET: API and media are network-first (cache is the offline fallback only);
 *   static assets are stale-while-revalidate.
 * - Mutations (POST/PUT/PATCH/DELETE): when offline, queued in IndexedDB and
 *   replayed in FIFO order when the connection returns. Replays preserve
 *   method, headers (incl. Authorization), and body.
 * - App shell: navigation requests fall back to the last cached document so
 *   the app boots even with no network.
 */

const VERSION = 'autovet-portal-v4';
const SHELL_CACHE = `${VERSION}-shell`;
const API_CACHE = `${VERSION}-api`;
const MEDIA_CACHE = `${VERSION}-media`;

// How long an API read waits for the network before a cached copy is served.
const API_NETWORK_TIMEOUT_MS = 2500;
const DB_NAME = 'autovet-offline';
const DB_VERSION = 1;
const QUEUE_STORE = 'mutation-queue';

/* ---------- IndexedDB helpers ---------- */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queuePut(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).add(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function queueAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const req = tx.objectStore(QUEUE_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function queueCount() {
  const items = await queueAll();
  return items.length;
}

/* ---------- Lifecycle ---------- */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

/* ---------- Fetch strategy ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin and our backend APIs
  const isSameOrigin = url.origin === self.location.origin;
  const isApi = /\/api\//.test(url.pathname);
  const isMedia = url.pathname.startsWith('/media/');

  if (!isSameOrigin && !isApi) return; // let the browser handle CDNs etc.

  if (req.method === 'GET') {
    if (req.mode === 'navigate') {
      event.respondWith(navigationStrategy(req));
    } else if (isMedia) {
      event.respondWith(mediaStrategy(req));
    } else if (isApi) {
      event.respondWith(apiStrategy(req));
    } else {
      event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
    }
    return;
  }

  // Mutations: try network; if it fails AND we're offline, queue it.
  event.respondWith(mutationStrategy(req));
});

async function navigationStrategy(req) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(SHELL_CACHE);
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(req) || await cache.match('/');
    if (cached) return cached;
    return new Response(
      '<h1 style="font-family:system-ui;padding:40px">Offline</h1><p style="font-family:system-ui;padding:0 40px">App shell not yet cached. Reconnect once to install.</p>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// Uploaded images. Cache first: every upload writes a new filename, so a
// cached entry can never go stale for a given URL. Re-fetching each image over
// a backend that answers in 1-3s is what made image-heavy lists crawl and left
// photos blank while they queued behind one another. A miss goes to the network
// and is cached; a failure with nothing cached resolves to an empty error
// response so the <img> fails cleanly instead of receiving JSON.
async function mediaStrategy(req) {
  const cache = await caches.open(MEDIA_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  } catch {
    return new Response('', { status: 504, statusText: 'Image unavailable offline' });
  }
}

// API reads. Network first, so master data (species, breeds, weight ranges,
// size categories) and every other GET reflect the server -- under
// stale-while-revalidate the cached copy won the race and was returned forever,
// because nothing in the app listens for the "data-fresh" broadcast, which
// pinned an empty species dropdown across reloads.
//
// The wait for the network is bounded, though. Blocking on a backend that
// regularly needs 1-3s is what made modals feel like they never opened, so past
// the timeout a cached copy is served immediately; the network result still
// lands in the cache, making the next read instant.
async function apiStrategy(req) {
  const cache = await caches.open(API_CACHE);

  const network = fetch(req)
    .then((res) => {
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);

  const cached = await cache.match(req);

  if (!cached) {
    const res = await network;
    if (res) return res;
    return new Response(JSON.stringify({ offline: true, error: 'No cached data' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const raced = await Promise.race([
    network,
    new Promise((resolve) => setTimeout(resolve, API_NETWORK_TIMEOUT_MS)),
  ]);

  return raced || cached;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req).then((res) => {
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  }).catch(() => null);

  if (cached) {
    networkPromise.then((res) => {
      if (res) broadcast({ type: 'data-fresh', url: req.url });
    });
    return cached;
  }
  const fresh = await networkPromise;
  if (fresh) return fresh;
  return new Response(JSON.stringify({ offline: true, error: 'No cached data' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function mutationStrategy(req) {
  try {
    const res = await fetch(req.clone());
    return res;
  } catch (err) {
    // Likely offline. Snapshot the request and queue it.
    try {
      const body = await req.clone().text();
      const headers = {};
      req.headers.forEach((v, k) => { headers[k] = v; });
      await queuePut({
        url: req.url,
        method: req.method,
        headers,
        body,
        ts: Date.now(),
      });
      const count = await queueCount();
      broadcast({ type: 'queued', count });
      return new Response(
        JSON.stringify({ queued: true, message: 'Saved offline. Will sync when online.' }),
        { status: 202, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (e) {
      return new Response(JSON.stringify({ error: 'offline-and-queue-failed' }), {
        status: 503, headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}

/* ---------- Replay queue when back online ---------- */
async function replayQueue() {
  const items = await queueAll();
  if (!items.length) return;
  broadcast({ type: 'syncing', count: items.length });
  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: ['GET', 'HEAD'].includes(item.method) ? undefined : item.body,
        credentials: 'include',
      });
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        // Treat 4xx as resolved (won't succeed on retry); drop it.
        await queueDelete(item.id);
      } else {
        break; // 5xx — stop and try later
      }
    } catch {
      break; // still offline
    }
  }
  const left = await queueCount();
  broadcast({ type: left ? 'queued' : 'synced', count: left });
}

self.addEventListener('message', (event) => {
  if (event.data === 'replay-queue') replayQueue();
  if (event.data === 'queue-count') {
    queueCount().then((count) => {
      event.source && event.source.postMessage({ type: 'queue-count', count });
    });
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'autovet-replay') event.waitUntil(replayQueue());
});

function broadcast(msg) {
  self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
    clients.forEach((c) => c.postMessage(msg));
  });
}
