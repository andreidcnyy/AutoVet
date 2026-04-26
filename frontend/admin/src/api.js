const _cache = new Map();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

// --- START: MODIFIED AUTH HANDLING ---
let _token = null;

// New function to directly set the token from outside
export function setAuthToken(token) {
  _token = token;
}

// The rest of the app will use this to get the token
function getToken() {
  return _token;
}
// --- END: MODIFIED AUTH HANDLING ---

// Resolve the Base URL for API calls
// Ensure it ends with /api for consistency with the routes
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
const BASE_URL = rawBaseUrl.replace(/\/api\/?$/, '');

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
  // If the URL is relative, prepend the BASE_URL
  // But handle /sanctum calls specially if they shouldn't have /api
  const isSanctum = url.includes('sanctum/');
  const prefix = isSanctum ? BASE_URL : `${BASE_URL}/api`;
  
  // Clean up double slashes
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  const finalPath = isSanctum ? cleanUrl.replace(/^\/api/, '') : cleanUrl.replace(/^\/api/, '');
  
  const fullUrl = url.startsWith('http') ? url : `${prefix}${finalPath}`;

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
  const timeout = setTimeout(() => controller.abort(), 15000);
  const effectiveSignal = signal ?? controller.signal;

  try {
    const res = await fetch(requestUrl, {
      method,
      headers: getHeaders(),
      signal: effectiveSignal,
      body: body != null ? JSON.stringify(body) : undefined,
      credentials: 'include', // Important for Sanctum/Cookies
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const err = new Error(`API error ${res.status}`);
      err.status = res.status;
      if (res.status === 401) {
        setAuthToken(null);
        window.dispatchEvent(new Event('auth-failure'));
      }
      throw err;
    }
    const data = await res.json();
    if (cache && method === 'GET') cacheSet(requestUrl, data, ttl);
    return data;
  } catch (err) {
    clearTimeout(timeout);
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

export default api;
