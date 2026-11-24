import type { InventoryLot, SkuExpirationResult } from "@/lib/inventoryExpiry";
import { getSkuExpirationFromRows, skuLookupKeys } from "@/lib/inventoryExpiry";
import type { StatusEtaLookupResult, StatusEtaProduct } from "@/lib/inventoryStatusEta";
import { lookupStatusEtaProduct } from "@/lib/inventoryStatusEta";
import { scoreCatalogTextSearch } from "@/lib/catalogTextSearch";

export const EXP_OFFLINE_PACK_VERSION = 1;

export type ExpOfflineCatalogRow = {
  sku: string;
  name: string;
  brand: string;
  inventory: number | null;
};

export type ExpOfflineMeta = {
  uploadedAt: string;
  rowCount: number;
  skuCount: number;
  fileName?: string;
};

export type ExpOfflinePack = {
  version: number;
  generatedAt: string;
  expMeta: ExpOfflineMeta | null;
  etaMeta: ExpOfflineMeta | null;
  catalog: ExpOfflineCatalogRow[];
  lots: InventoryLot[];
  etaProducts: StatusEtaProduct[];
};

export type ExpOfflineLookupResult = {
  exp: SkuExpirationResult;
  eta: StatusEtaLookupResult;
  onhandInventory: number | null;
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

function suggestLabel(brand: string, name: string, sku: string) {
  const n = name.trim();
  const b = brand.trim();
  if (b && n) return `${b} · ${n}`;
  return n || b || sku;
}

export function resolveOnhandFromOfflinePack(pack: ExpOfflinePack, skuQuery: string): number | null {
  const keys = new Set(skuLookupKeys(skuQuery).map((k) => k.toUpperCase()));
  for (const row of pack.catalog) {
    const rowKeys = skuLookupKeys(row.sku);
    if (rowKeys.some((k) => keys.has(k)) || keys.has(row.sku.toUpperCase())) {
      return row.inventory;
    }
  }
  return null;
}

export function lookupExpOffline(
  pack: ExpOfflinePack,
  skuQuery: string,
  options: { status?: string; onlyFutureExpiry?: boolean } = {}
): ExpOfflineLookupResult {
  const exp = getSkuExpirationFromRows(skuQuery, pack.lots, {
    status: options.status,
    onlyFutureExpiry: options.onlyFutureExpiry,
  });
  const eta = lookupStatusEtaProduct(pack.etaProducts, skuQuery);
  return {
    exp,
    eta,
    onhandInventory: resolveOnhandFromOfflinePack(pack, skuQuery),
  };
}

export function suggestExpOffline(
  pack: ExpOfflinePack,
  query: string,
  limit = 15
): { sku: string; name: string }[] {
  const q = String(query || "").trim();
  if (q.length < 2) return [];

  const bySku = new Map<string, { sku: string; name: string; rank: number }>();

  for (const item of pack.catalog) {
    const rank = scoreCatalogTextSearch(
      { sku: item.sku, name: item.name, brand: item.brand },
      q
    );
    if (rank < 0) continue;
    bySku.set(item.sku.toUpperCase(), {
      sku: item.sku,
      name: suggestLabel(item.brand, item.name, item.sku),
      rank,
    });
  }

  const descBySku = new Map<string, string>();
  for (const lot of pack.lots) {
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
      bySku.set(key, { sku, name, rank });
    }
  }

  return [...bySku.values()]
    .sort((a, b) => b.rank - a.rank || a.sku.localeCompare(b.sku))
    .slice(0, limit)
    .map(({ sku, name }) => ({ sku, name }));
}

export function compactCatalogForOfflinePack(
  products: { sku?: string; name?: string; brand?: string; inventory?: unknown }[]
): ExpOfflineCatalogRow[] {
  const rows: ExpOfflineCatalogRow[] = [];
  for (const item of products) {
    const sku = String(item.sku || "")
      .trim()
      .toUpperCase();
    if (!sku || sku.includes(" ")) continue;
    rows.push({
      sku,
      name: String(item.name || "").trim(),
      brand: String(item.brand || "").trim(),
      inventory: parseInventoryValue(item.inventory),
    });
  }
  return rows;
}
