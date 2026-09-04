const _cache = new Map();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Reference data the clinic edits rarely but nearly every screen needs.
 *
 * Only 6 of ~60 read sites opted into the cache, so switching pages re-fetched
 * the same species, breeds, services and unit lists every time — a round trip
 * per navigation against a backend that answers in 1-3s, which is a large part
 * of why clicking between pages felt slow. These are cached by default rather
 * than relying on each call site to remember to ask.
 */
const MASTER_DATA = /\/api\/(species|breeds|weight-ranges|pet-size-categories|units-of-measure|inventory-categories|service-categories|services|vets|settings)(\/|\?|$)/;
const MASTER_DATA_TTL = 10 * 60 * 1000;

// Ceiling for a single request. 20s was below the cold-start time of the
// backend, so first-load dashboard reads were being aborted by this timer
// rather than by anything the user did.
const REQUEST_TIMEOUT_MS = 45000;

// --- START: MODIFIED AUTH HANDLING ---
let _token = null;

export function setAuthToken(token) {
  _token = token;
}

function getToken() {
  return _token;
}
// --- END: MODIFIED AUTH HANDLING ---

const BASE_URL = '';

function getHeaders(extra = {}) {
  const token = getToken();
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { _cache.delete(key); return null; }
  return entry.data;
}

function cacheSet(key, data, ttl = DEFAULT_TTL) {
  _cache.set(key, { data, expires: Date.now() + ttl });
}

export function invalidateCache(urlPattern) {
  for (const key of _cache.keys()) {
    if (!urlPattern || key.includes(urlPattern)) _cache.delete(key);
  }
}

async function request(method, url, { body, params, signal, cache = false, ttl } = {}) {
  let path = url;
  if (path.startsWith('/api')) {
    path = path.substring(4);
  }
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  const isSanctum = path.includes('sanctum/');
  const prefix = isSanctum ? '' : '/api';
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${prefix}${path}`;

  console.log(`[API REQUEST] ${method} ${fullUrl}`);

  let requestUrl = fullUrl;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    requestUrl = `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}${qs}`;
  }

  // Reference data is cached whether or not the caller opted in.
  const isMasterData = method === 'GET' && MASTER_DATA.test(requestUrl);
  const shouldCache = method === 'GET' && (cache || isMasterData);
  const effectiveTtl = ttl ?? (isMasterData ? MASTER_DATA_TTL : DEFAULT_TTL);

  if (shouldCache) {
    const cached = cacheGet(requestUrl);
    if (cached !== null) return cached;
  }

  // abort() with no argument makes the browser synthesise
  // "AbortError: signal is aborted without reason", which is the console noise
  // these requests were producing. Aborting with an explicit reason names the
  // cause instead, and the flag lets the catch tell a timeout apart from a
  // caller deliberately cancelling.
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(
      new DOMException(`Request exceeded ${REQUEST_TIMEOUT_MS}ms`, 'TimeoutError')
    );
  }, REQUEST_TIMEOUT_MS);
  const effectiveSignal = signal ?? controller.signal;

  try {
    const res = await fetch(requestUrl, {
      method,
      headers: getHeaders(),
      signal: effectiveSignal,
      body: body != null ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
    
    if (!res.ok) {
      console.error(`[API ERROR] ${res.status} from ${requestUrl}`);
      let errorMsg = `API error ${res.status}`;
      try {
        const errorData = await res.json();
        if (errorData && errorData.message) {
          errorMsg = errorData.message;
        } else if (errorData && errorData.error) {
          errorMsg = errorData.error;
        }
      } catch (e) {
        // Fallback if not JSON
      }
      
      const err = new Error(errorMsg);
      err.status = res.status;
      if (res.status === 401) {
        // A single 401 is not proof the session is over. Several dashboard
        // cards poll every 15-30s, so one blip — a backend restart, a request
        // that raced the token being set, a route the role cannot reach — used
        // to clear the token here and bounce the user to /login mid-work, which
        // read as being logged out at random. The token is left alone;
        // AuthContext verifies the session before ending it.
        window.dispatchEvent(new CustomEvent('auth-failure', { detail: { url: requestUrl } }));
      }
      throw err;
    }
    
    // FIX: Only parse JSON if the response is not empty (Status 204)
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return null;
    }

    const data = await res.json();
    if (shouldCache) cacheSet(requestUrl, data, effectiveTtl);

    // Any write can change what a cached list would return, and nothing else
    // invalidates this map, so a mutation clears it wholesale. The cache is
    // small and writes are far rarer than reads.
    if (method !== 'GET') invalidateCache();

    return data;
  } catch (err) {
    // Silent fail for non-critical errors to avoid crashing UI
    if (err.name === 'SyntaxError') return null;

    const wasAborted = err?.name === 'AbortError' || err?.name === 'TimeoutError';

    if (wasAborted && !timedOut) {
      // Cancelled on purpose: an effect cleaned up, a query key changed, or the
      // component unmounted. This is the normal way React discards a request it
      // no longer needs, so it is rethrown for the caller to ignore but never
      // logged — logging it is what filled the console with AbortError.
      throw err;
    }

    if (timedOut) {
      console.warn(`[API TIMEOUT] ${method} ${requestUrl} exceeded ${REQUEST_TIMEOUT_MS}ms`);
      throw err;
    }

    console.error(`[API FETCH ERROR]`, err);
    throw err;
  } finally {
    // One place, so the timer cannot outlive the request and fire mid-parse.
    clearTimeout(timeout);
  }
}

const api = {
  get: (url, opts) => request('GET', url, opts),
  post: (url, body, opts) => request('POST', url, { body, ...opts }),
  put: (url, body, opts) => request('PUT', url, { body, ...opts }),
  patch: (url, body, opts) => request('PATCH', url, { body, ...opts }),
  delete: (url, opts) => request('DELETE', url, opts),
  getHeaders,
  invalidateCache,
};

export const triggerSync = () => api.post('/sync/trigger');

export default api;
