type CacheEntry = { expires: number; data: unknown };

const store = new Map<string, CacheEntry>();

const DEFAULT_TTL_MS = 10 * 60 * 1000;

export function analyticsCacheKey(parts: (string | number | null | undefined)[]) {
  return parts.map((p) => String(p ?? "")).join("|");
}

export async function cachedAnalytics<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) {
    return hit.data as T;
  }
  const data = await fn();
  store.set(key, { expires: Date.now() + ttlMs, data });
  return data;
}

export function bustAnalyticsCache(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function analyticsCacheStats() {
  return { entries: store.size };
}
