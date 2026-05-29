import catalogData from "@/data/catalog_sku_master_extracted.json";
import { cleanSku } from "@/lib/analyticsCommon";
import { loadInventoryLots } from "@/lib/inventoryExpiry";
import { loadRedisProducts } from "@/lib/productRedisStore";

export type SkuSuggestRow = { sku: string; name: string };

function rankSkuMatch(sku: string, name: string, q: string): number {
  const su = sku.toUpperCase();
  const nu = name.toUpperCase();
  if (su.startsWith(q)) return 0;
  if (su.includes(q)) return 1;
  if (nu.includes(q)) return 2;
  return 3;
}

export function adminSkuSuggestFromCatalog(query: string, limit = 15): SkuSuggestRow[] {
  const q = String(query || "").trim().toUpperCase();
  if (q.length < 2) return [];

  const hits: { sku: string; name: string; rank: number }[] = [];

  for (const item of catalogData as { sku?: string; name?: string }[]) {
    const sku = cleanSku(item.sku);
    if (!sku) continue;
    const name = String(item.name || "");
    const su = sku.toUpperCase();
    const nu = name.toUpperCase();
    if (!su.includes(q) && !nu.includes(q)) continue;
    hits.push({ sku, name, rank: rankSkuMatch(sku, name, q) });
  }

  hits.sort((a, b) => a.rank - b.rank || a.sku.localeCompare(b.sku));
  return hits.slice(0, limit).map(({ sku, name }) => ({ sku, name }));
}

export async function adminSkuSuggest(
  query: string,
  limit = 15,
  options?: { includeInventory?: boolean }
): Promise<SkuSuggestRow[]> {
  const q = String(query || "").trim().toUpperCase();
  if (q.length < 2) return [];

  const bySku = new Map<string, SkuSuggestRow>();

  for (const row of adminSkuSuggestFromCatalog(query, limit)) {
    bySku.set(row.sku.toUpperCase(), row);
  }

  const exactSku = cleanSku(query);
  if (exactSku.length >= 2) {
    const redisHits = await loadRedisProducts<{ sku?: string; name?: string; brand?: string }>([
      exactSku,
    ]);
    for (const item of redisHits) {
      const sku = cleanSku(item.sku);
      if (!sku) continue;
      const name = String(item.name || item.brand || "").trim();
      bySku.set(sku.toUpperCase(), { sku, name: name || sku });
    }
  }

  if (options?.includeInventory) {
    try {
      const lots = await loadInventoryLots();
      const descBySku = new Map<string, string>();
      for (const lot of lots) {
        if (!lot.sku) continue;
        if (!descBySku.has(lot.sku) && lot.description) {
          descBySku.set(lot.sku, lot.description);
        }
      }
      for (const [sku, name] of descBySku) {
        const su = sku.toUpperCase();
        const nu = name.toUpperCase();
        if (!su.includes(q) && !nu.includes(q)) continue;
        const key = su;
        if (!bySku.has(key)) {
          bySku.set(key, { sku, name });
        }
      }
    } catch {
      /* inventory optional */
    }
  }

  const merged = [...bySku.values()];
  merged.sort((a, b) => rankSkuMatch(a.sku, a.name, q) - rankSkuMatch(b.sku, b.name, q) || a.sku.localeCompare(b.sku));
  return merged.slice(0, limit);
}
