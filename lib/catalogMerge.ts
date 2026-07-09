import catalogData from "@/data/catalog_sku_master_extracted.json";
import { loadRedisProducts } from "@/lib/productRedisStore";

export type MergedCatalogProduct = {
  sku: string;
  name?: string;
  brand?: string;
  status?: string;
  size?: string;
  barcode?: string;
  upc?: string;
  palletSize?: string;
  imageUrl?: string;
  isNew?: boolean;
  justAdded?: boolean;
  importedAt?: string;
  newSince?: string;
  newPublishedDate?: string;
  newItemComingDate?: string;
  newItemDescription?: string;
  newItemDescriptionPdfUrl?: string;
  newItemStorageLabel?: "DRY" | "FROZEN" | "FRESH";
  newItemListPrice?: string;
  newItemOutOfStock?: boolean;
  newItemComingSoon?: boolean;
  outOfStock?: boolean;
  name_k?: string;
  [key: string]: unknown;
};

/** Same JSON + Redis merge as GET /api/catalog. */
export async function getMergedCatalogProducts(): Promise<MergedCatalogProduct[]> {
  const map = new Map<string, MergedCatalogProduct>();

  for (const item of catalogData as MergedCatalogProduct[]) {
    const sku = String(item.sku || "")
      .trim()
      .toUpperCase();
    if (!sku || sku.includes(" ")) continue;

    map.set(sku, {
      ...item,
      sku,
    });
  }

  const redisProducts = await loadRedisProducts<MergedCatalogProduct>();

  for (const item of redisProducts) {
    if (!item?.sku) continue;

    const sku = String(item.sku).toUpperCase();

    map.set(sku, {
      ...(map.get(sku) || {}),
      ...item,
      sku,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.sku.localeCompare(b.sku));
}
