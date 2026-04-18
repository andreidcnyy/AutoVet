const _cache = new Map();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

let _cachedToken = null;
let _cachedRaw = null;

function getToken() {
  const raw = localStorage.getItem('user');
  if (!raw) { _cachedToken = null; _cachedRaw = null; return null; }
  if (raw === _cachedRaw) return _cachedToken;
  try {
    _cachedRaw = raw;
    _cachedToken = JSON.parse(raw)?.token ?? null;
  } catch { _cachedToken = null; }
  return _cachedToken;
}

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
  let fullUrl = url;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    fullUrl = `${url}?${qs}`;
  }

  if (cache && method === 'GET') {
    const cached = cacheGet(fullUrl);
    if (cached !== null) return cached;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const effectiveSignal = signal ?? controller.signal;

  try {
    const res = await fetch(fullUrl, {
      method,
      headers: getHeaders(),
      signal: effectiveSignal,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const err = new Error(`API error ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    if (cache && method === 'GET') cacheSet(fullUrl, data, ttl);
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
