const DEFAULT_TTL = 5 * 60 * 1000;

export function readCache<T = any>(key: string, ttl: number = DEFAULT_TTL): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.ts !== 'number') return null;
    if (Date.now() - parsed.ts > ttl) return null;
    return parsed.data as T;
  } catch {
    return null;
  }
}

export function writeCache(key: string, data: any): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // quota errors - ignore
  }
}

export function clearCache(key: string): void {
  try { localStorage.removeItem(key); } catch {}
}
