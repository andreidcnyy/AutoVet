const _cache = new Map();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

// --- START: MODIFIED AUTH HANDLING ---
let _token = null;

export function setAuthToken(token) {
  _token = token;
}

function getToken() {
  return _token;
}
// --- END: MODIFIED AUTH HANDLING ---

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
const BASE_URL = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');

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

  if (cache && method === 'GET') {
    const cached = cacheGet(requestUrl);
    if (cached !== null) return cached;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const effectiveSignal = signal ?? controller.signal;

  try {
    const res = await fetch(requestUrl, {
      method,
      headers: getHeaders(),
      signal: effectiveSignal,
      body: body != null ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
    
    clearTimeout(timeout);
    
    if (!res.ok) {
      console.error(`[API ERROR] ${res.status} from ${requestUrl}`);
      const err = new Error(`API error ${res.status}`);
      err.status = res.status;
      if (res.status === 401) {
        setAuthToken(null);
        window.dispatchEvent(new Event('auth-failure'));
      }
      throw err;
    }
    
    // FIX: Only parse JSON if the response is not empty (Status 204)
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return null;
    }

    const data = await res.json();
    if (cache && method === 'GET') cacheSet(requestUrl, data, ttl);
    return data;
  } catch (err) {
    clearTimeout(timeout);
    // Silent fail for non-critical errors to avoid crashing UI
    if (err.name === 'SyntaxError') return null; 
    console.error(`[API FETCH ERROR]`, err);
    throw err;
  }
}

const api = {
  get: (url, opts) => request('GET', url, opts),
  post: (url, body, opts) => request('POST', url, { body, ...opts }),
  put: (url, body, opts) => request('PUT', url, { body, ...opts }),
  delete: (url, opts) => request('DELETE', url, opts),
  getHeaders,
  invalidateCache,
};

export const triggerSync = () => api.post('/sync/trigger');

export default api;
