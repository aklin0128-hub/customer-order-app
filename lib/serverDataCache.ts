/** Short-lived in-memory cache on the server (per Vercel instance). */

const DEFAULT_TTL_MS = 120_000;

type Entry = { expires: number; data: unknown };

const stores = new Map<string, Map<string, Entry>>();

export const SERVER_CACHE = {
  catalog: "catalog",
  promotions: "promotions",
  clearance: "clearance",
  showcase: "showcase",
} as const;

export async function cachedServerData<T>(
  namespace: string,
  key: string,
  fn: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  let store = stores.get(namespace);
  if (!store) {
    store = new Map();
    stores.set(namespace, store);
  }

  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) {
    return hit.data as T;
  }

  const data = await fn();
  store.set(key, { expires: Date.now() + ttlMs, data });
  return data;
}

export function bustServerDataCache(namespace: string, key?: string) {
  const store = stores.get(namespace);
  if (!store) return;

  if (!key) {
    store.clear();
    return;
  }

  store.delete(key);
}
