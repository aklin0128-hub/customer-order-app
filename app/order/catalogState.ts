import catalogData from "@/data/catalog_sku_master_extracted.json";

import type { CatalogItem } from "./types";

export let catalog: CatalogItem[] = catalogData as CatalogItem[];

export function replaceCatalog(products: CatalogItem[]) {
  catalog = products;
}

export function patchCatalogItem(sku: string, patch: Partial<CatalogItem>) {
  const clean = String(sku || "").trim().toUpperCase();
  if (!clean) return;
  catalog = catalog.map((item) =>
    String(item.sku || "").toUpperCase() === clean ? { ...item, ...patch } : item
  );
}

export function patchSkuFields<T extends { sku?: string }>(
  list: T[],
  sku: string,
  patch: Partial<CatalogItem>
): T[] {
  const clean = String(sku || "").trim().toUpperCase();
  if (!clean) return list;
  let changed = false;
  const next = list.map((item) => {
    if (String(item.sku || "").toUpperCase() !== clean) return item;
    changed = true;
    return { ...item, ...patch };
  });
  return changed ? next : list;
}
