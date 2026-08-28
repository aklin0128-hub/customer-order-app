/** Per-account favorite SKUs — localStorage cache + Redis cloud sync. */

export type FavoriteSkusPayload = {
  accountNo: string;
  skus: string[];
  updatedAt: number;
};

export function normalizeFavoriteSku(sku: string) {
  return String(sku || "")
    .trim()
    .toUpperCase();
}

export function favoriteSkusStorageKey(accountNo: string) {
  const account = String(accountNo || "")
    .trim()
    .toUpperCase();
  return account ? `favorite_skus_${account}` : "";
}

export function favoriteSkusRedisKey(accountNo: string) {
  const account = String(accountNo || "")
    .trim()
    .toUpperCase();
  return account ? `favoriteSkus:${account}` : "";
}

export function normalizeFavoriteSkuList(skus: Iterable<unknown>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of skus) {
    const sku = normalizeFavoriteSku(String(value || ""));
    if (!sku || seen.has(sku)) continue;
    seen.add(sku);
    out.push(sku);
  }
  return out;
}

export function normalizeFavoriteSkusPayload(
  accountNo: string,
  raw: unknown
): FavoriteSkusPayload {
  const account = String(accountNo || "")
    .trim()
    .toUpperCase();
  if (Array.isArray(raw)) {
    return {
      accountNo: account,
      skus: normalizeFavoriteSkuList(raw),
      updatedAt: 0,
    };
  }
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const skusRaw = Array.isArray(obj.skus) ? obj.skus : Array.isArray(obj.items) ? obj.items : [];
  const updatedAt = Number(obj.updatedAt);
  return {
    accountNo: account,
    skus: normalizeFavoriteSkuList(skusRaw),
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : 0,
  };
}

/** Union SKUs; keep the newer updatedAt (or now if either side was legacy). */
export function mergeFavoriteSkusPayloads(
  local: FavoriteSkusPayload | null | undefined,
  cloud: FavoriteSkusPayload | null | undefined
): FavoriteSkusPayload | null {
  const accountNo = String(local?.accountNo || cloud?.accountNo || "")
    .trim()
    .toUpperCase();
  if (!accountNo) return null;
  if (!local && !cloud) {
    return { accountNo, skus: [], updatedAt: 0 };
  }
  if (!local) return normalizeFavoriteSkusPayload(accountNo, cloud);
  if (!cloud) return normalizeFavoriteSkusPayload(accountNo, local);

  const a = normalizeFavoriteSkusPayload(accountNo, local);
  const b = normalizeFavoriteSkusPayload(accountNo, cloud);

  // Both stamped: last-write-wins (unfavorite must propagate).
  if (a.updatedAt > 0 && b.updatedAt > 0 && a.updatedAt !== b.updatedAt) {
    return a.updatedAt > b.updatedAt ? a : b;
  }

  // Legacy / first sync: union so computer favorites appear on tablet.
  const skus = normalizeFavoriteSkuList([...a.skus, ...b.skus]);
  const updatedAt = Math.max(a.updatedAt, b.updatedAt, skus.length ? Date.now() : 0);
  return { accountNo, skus, updatedAt };
}

export function loadFavoriteSkusPayload(accountNo: string): FavoriteSkusPayload | null {
  if (typeof window === "undefined") return null;
  const key = favoriteSkusStorageKey(accountNo);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return normalizeFavoriteSkusPayload(accountNo, []);
    return normalizeFavoriteSkusPayload(accountNo, JSON.parse(raw));
  } catch {
    return normalizeFavoriteSkusPayload(accountNo, []);
  }
}

export function loadFavoriteSkus(accountNo: string): string[] {
  return loadFavoriteSkusPayload(accountNo)?.skus || [];
}

export function saveFavoriteSkusPayload(accountNo: string, payload: FavoriteSkusPayload) {
  if (typeof window === "undefined") return;
  const key = favoriteSkusStorageKey(accountNo);
  if (!key) return;
  const normalized = normalizeFavoriteSkusPayload(accountNo, payload);
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ skus: normalized.skus, updatedAt: normalized.updatedAt })
    );
  } catch {
    /* quota / private mode */
  }
}

export function saveFavoriteSkus(accountNo: string, skus: Iterable<string>, updatedAt = Date.now()) {
  saveFavoriteSkusPayload(accountNo, {
    accountNo,
    skus: normalizeFavoriteSkuList(skus),
    updatedAt,
  });
}

export function toggleFavoriteSku(skus: Iterable<string>, sku: string): string[] {
  const target = normalizeFavoriteSku(sku);
  const next = new Set<string>();
  for (const value of skus) {
    const s = normalizeFavoriteSku(String(value || ""));
    if (s) next.add(s);
  }
  if (!target) return Array.from(next);
  if (next.has(target)) next.delete(target);
  else next.add(target);
  return Array.from(next);
}
