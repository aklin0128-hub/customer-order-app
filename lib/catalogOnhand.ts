import catalogData from "@/data/catalog_sku_master_extracted.json";
import { cleanSku } from "@/lib/analyticsCommon";
import { normalizeInventorySku, skuLookupKeys } from "@/lib/inventoryExpiry";
import { loadRedisProducts } from "@/lib/productRedisStore";

export type OnhandInventoryResult = {
  sku: string;
  onhandInventory: number | null;
  source: "redis" | "catalog" | null;
};

function parseInventoryValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "")
    .trim()
    .replace(/,/g, "");
  if (!text || text === "-" || text === "—") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

const catalogInvBySku = (() => {
  const map = new Map<string, number>();
  for (const item of catalogData as { sku?: string; inventory?: unknown }[]) {
    const sku = cleanSku(item.sku);
    if (!sku) continue;
    const inv = parseInventoryValue(item.inventory);
    if (inv == null) continue;
    for (const key of skuLookupKeys(sku)) {
      map.set(key, inv);
    }
  }
  return map;
})();

/** Resolve on-hand qty from today_update / catalog INV (Redis override wins). */
export async function resolveOnhandInventory(skuQuery: string): Promise<OnhandInventoryResult> {
  const raw = String(skuQuery || "").trim();
  const sku = normalizeInventorySku(raw) || cleanSku(raw);
  if (!sku) {
    return { sku: raw.toUpperCase(), onhandInventory: null, source: null };
  }

  const keys = skuLookupKeys(sku);

  try {
    const redisRows = await loadRedisProducts<{ sku?: string; inventory?: unknown }>(keys);
    for (const row of redisRows) {
      const inv = parseInventoryValue(row.inventory);
      if (inv != null) {
        return {
          sku: cleanSku(row.sku) || sku,
          onhandInventory: inv,
          source: "redis",
        };
      }
    }
  } catch {
    /* Redis optional — fall back to catalog master INV */
  }

  for (const key of keys) {
    const inv = catalogInvBySku.get(key);
    if (inv != null) {
      return { sku, onhandInventory: inv, source: "catalog" };
    }
  }

  return { sku, onhandInventory: null, source: null };
}
