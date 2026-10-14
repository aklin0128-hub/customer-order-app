import catalogData from "@/data/catalog_sku_master_extracted.json";
import { cleanSku } from "@/lib/analyticsCommon";
import { scoreCatalogTextSearch } from "@/lib/catalogTextSearch";
import { loadInventoryLots } from "@/lib/inventoryExpiry";
import { loadRedisProducts } from "@/lib/productRedisStore";

export type SkuSuggestRow = { sku: string; name: string };

function suggestLabel(brand: string, name: string, sku: string) {
  const n = name.trim();
  const b = brand.trim();
  if (b && n) return `${b} · ${n}`;
  return n || b || sku;
}

export function adminSkuSuggestFromCatalog(query: string, limit = 15): SkuSuggestRow[] {
  const q = String(query || "").trim();
  if (q.length < 2) return [];

  const hits: { sku: string; name: string; rank: number }[] = [];

  for (const item of catalogData as { sku?: string; name?: string; brand?: string }[]) {
    const sku = cleanSku(item.sku);
    if (!sku) continue;
    const name = String(item.name || "");
    const brand = String(item.brand || "");
    const rank = scoreCatalogTextSearch({ sku, name, brand }, q);
    if (rank < 0) continue;
    hits.push({ sku, name: suggestLabel(brand, name, sku), rank });
  }

  hits.sort((a, b) => b.rank - a.rank || a.sku.localeCompare(b.sku));
  return hits.slice(0, limit).map(({ sku, name }) => ({ sku, name }));
}

export async function adminSkuSuggest(
  query: string,
  limit = 15,
  options?: { includeInventory?: boolean }
): Promise<SkuSuggestRow[]> {
  const q = String(query || "").trim();
  if (q.length < 2) return [];

  const bySku = new Map<string, { row: SkuSuggestRow; rank: number }>();

  for (const item of catalogData as { sku?: string; name?: string; brand?: string }[]) {
    const sku = cleanSku(item.sku);
    if (!sku) continue;
    const name = String(item.name || "");
    const brand = String(item.brand || "");
    const rank = scoreCatalogTextSearch({ sku, name, brand }, q);
    if (rank < 0) continue;
    bySku.set(sku.toUpperCase(), {
      row: { sku, name: suggestLabel(brand, name, sku) },
      rank,
    });
  }

  const exactSku = cleanSku(query);
  if (exactSku.length >= 2) {
    const redisHits = await loadRedisProducts<{ sku?: string; name?: string; brand?: string }>([
      exactSku,
    ]);
    for (const item of redisHits) {
      const sku = cleanSku(item.sku);
      if (!sku) continue;
      const name = String(item.name || "").trim();
      const brand = String(item.brand || "").trim();
      const rank = scoreCatalogTextSearch({ sku, name, brand }, q);
      bySku.set(sku.toUpperCase(), {
        row: { sku, name: suggestLabel(brand, name, sku) },
        rank: rank >= 0 ? Math.max(rank, 900) : 1000,
      });
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
        const rank = scoreCatalogTextSearch({ sku, name }, q);
        if (rank < 0) continue;
        const key = sku.toUpperCase();
        const prev = bySku.get(key);
        if (!prev || rank > prev.rank) {
          bySku.set(key, { row: { sku, name }, rank });
        }
      }
    } catch {
      /* inventory optional */
    }
  }

  const merged = [...bySku.values()];
  merged.sort((a, b) => b.rank - a.rank || a.row.sku.localeCompare(b.row.sku));
  return merged.slice(0, limit).map((item) => item.row);
}
