/* AutoVet offline-first service worker.
 * - GET: stale-while-revalidate (cache + network race; offline serves cache).
 * - Mutations (POST/PUT/PATCH/DELETE): when offline, queued in IndexedDB and
 *   replayed in FIFO order when the connection returns. Replays preserve
 *   method, headers (incl. Authorization), and body.
 * - App shell: navigation requests fall back to the last cached document so
 *   the app boots even with no network.
 */

const VERSION = 'autovet-admin-v6';
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

  // Fire-and-forget endpoints: try network, silently fail — never queue.
  const skipQueue = ['/sync/trigger'];
  if (skipQueue.some((p) => url.pathname.includes(p))) {
    event.respondWith(
      fetch(req).catch(() =>
        new Response(JSON.stringify({ queued: false, skipped: true }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
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
// How long a cached API read is treated as fresh enough to serve instantly.
const API_FRESH_MS = 30000;

// Refuses to cache a payload that carries no rows. Caching one is what pinned
// an empty species dropdown across reloads: fetched once before login or
// mid-migration, then replayed as though it were real data.
async function isWorthCaching(res) {
  const len = Number(res.headers.get('content-length') || 0);
  if (len > 65536) return true; // too big to be an empty list; don't spend time parsing
  try {
    const body = await res.clone().text();
    // Whitespace-insensitive so a pretty-printed empty page is caught too.
    const t = body.split(' ').join('').split('\n').join('').split('\r').join('').split('\t').join('');
    if (t === '' || t === '[]' || t === '{}') return false;
    if (t.startsWith('{"data":[]')) return false;
    return true;
  } catch {
    return true;
  }
}

// Stamps the response so its age can be judged on the way back out.
async function stampAndCache(res, req, cache) {
  const headers = new Headers(res.headers);
  headers.set('x-sw-cached-at', String(Date.now()));
  const body = await res.clone().blob();
  await cache.put(req, new Response(body, { status: res.status, statusText: res.statusText, headers }));
}

// API reads.
//
// This was stale-while-revalidate, which made page switches instant but could
// replay a bad response forever, because nothing in the app listens for the
// "data-fresh" broadcast. Swinging to plain network-first fixed that and broke
// the feel of the app instead: with no client-side cache on ~54 of 60 read
// sites, every navigation waited on a backend that answers in 1-3s.
//
// So: serve a recent cached copy immediately and refresh behind it, fall back
// to a bounded network wait once that copy ages out, and never cache an empty
// payload in the first place -- which removes the reason SWR was abandoned
// rather than trading one problem for the other.
async function apiStrategy(req) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(req);

  const revalidate = () =>
    fetch(req)
      .then(async (res) => {
        if (res && res.status === 200 && (await isWorthCaching(res))) {
          await stampAndCache(res, req, cache);
        }
        return res;
      })
      .catch(() => null);

  if (cached) {
    const cachedAt = Number(cached.headers.get('x-sw-cached-at') || 0);
    const age = Date.now() - cachedAt;

    // Recent enough to trust: paint now, refresh in the background.
    if (cachedAt && age < API_FRESH_MS) {
      revalidate();
      return cached;
    }

    // Older: prefer the network, but never let a slow backend hold the UI.
    const raced = await Promise.race([
      revalidate(),
      new Promise((resolve) => setTimeout(resolve, API_NETWORK_TIMEOUT_MS)),
    ]);
    return raced || cached;
  }

  const res = await revalidate();
  if (res) return res;
  return new Response(JSON.stringify({ offline: true, error: 'No cached data' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

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

/** "/api/appointments/12?x=1" -> "/api/appointments". */
function collectionOf(url) {
  const m = String(url || '').match(/\/api\/[a-z0-9-]+/i);
  return m ? m[0] : null;
}

/**
 * Drops the cached API reads a write can plausibly have changed.
 *
 * Reads are served from cache for API_FRESH_MS without touching the network,
 * which is what makes navigation feel instant — but a write followed by an
 * immediate re-read would otherwise replay pre-write data. Marking all
 * notifications read and watching the unread badge come straight back was this:
 * the POST went to the network, the refetch behind it did not.
 *
 * This used to delete the whole cache, on the reasoning that writes are rare.
 * They were not — a background sync POST ran on a timer — so the entire cache
 * was thrown away every few seconds and no cached read ever lived long enough
 * to be used. Only the written collection is dropped now: a write to
 * "/api/appointments/12" clears the cached "/api/appointments…" reads and
 * leaves everything else alone. Sibling collections settle within
 * API_FRESH_MS on their own revalidation.
 */
async function invalidateApiCache(req) {
  try {
    const scope = collectionOf(req && req.url);
    if (!scope) {
      // Unrecognised URL shape: clear everything rather than risk serving data
      // the write has invalidated.
      await caches.delete(API_CACHE);
      return;
    }
    const cache = await caches.open(API_CACHE);
    const keys = await cache.keys();
    await Promise.all(
      keys.filter((k) => collectionOf(k.url) === scope).map((k) => cache.delete(k))
    );
  } catch {
    // A cache that cannot be cleared just revalidates on its own timer.
  }
}

async function mutationStrategy(req) {
  try {
    const res = await fetch(req.clone());
    if (res && res.ok) await invalidateApiCache(req);
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
