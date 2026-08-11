/** Per-account favorite SKUs (browser localStorage). */

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

export function loadFavoriteSkus(accountNo: string): string[] {
  if (typeof window === "undefined") return [];
  const key = favoriteSkusStorageKey(accountNo);
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const value of parsed) {
      const sku = normalizeFavoriteSku(String(value || ""));
      if (!sku || seen.has(sku)) continue;
      seen.add(sku);
      out.push(sku);
    }
    return out;
  } catch {
    return [];
  }
}

export function saveFavoriteSkus(accountNo: string, skus: Iterable<string>) {
  if (typeof window === "undefined") return;
  const key = favoriteSkusStorageKey(accountNo);
  if (!key) return;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of skus) {
    const sku = normalizeFavoriteSku(String(value || ""));
    if (!sku || seen.has(sku)) continue;
    seen.add(sku);
    out.push(sku);
  }
  try {
    localStorage.setItem(key, JSON.stringify(out));
  } catch {
    /* quota / private mode */
  }
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
