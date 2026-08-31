import { parseInventoryNumber } from "@/lib/inventoryCue";
import { isOrderableCatalogStatus } from "@/lib/orderableCatalog";

export type CatalogBrowseItem = {
  sku: string;
  name?: string;
  name_k?: string;
  brand?: string;
  status?: string;
  size?: string;
  upc?: string;
  barcode?: string;
  category?: string;
  palletSize?: string;
  imageUrl?: string;
  inventory?: number;
};

export function compareSkuAsc(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function sortCatalogBrowseItems<T extends { sku: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => compareSkuAsc(a.sku, b.sku));
}

export function toCatalogBrowseItem(raw: Record<string, unknown>): CatalogBrowseItem | null {
  const sku = String(raw.sku || "")
    .trim()
    .toUpperCase();
  if (!sku || sku.includes(" ")) return null;

  const imageUrl = raw.imageUrl ? String(raw.imageUrl) : `/product/${sku}.jpg`;

  return {
    sku,
    name: raw.name ? String(raw.name) : undefined,
    name_k: raw.name_k ? String(raw.name_k) : undefined,
    brand: raw.brand ? String(raw.brand) : undefined,
    status: raw.status ? String(raw.status) : undefined,
    size: raw.size ? String(raw.size) : undefined,
    upc: raw.upc ? String(raw.upc) : undefined,
    barcode: raw.barcode ? String(raw.barcode) : undefined,
    category: raw.category ? String(raw.category) : undefined,
    palletSize: raw.palletSize ? String(raw.palletSize) : undefined,
    imageUrl,
    inventory: parseInventoryNumber(raw.inventory),
  };
}

export function filterAvailableCatalogBrowseItems(items: CatalogBrowseItem[]): CatalogBrowseItem[] {
  return items.filter((item) => isOrderableCatalogStatus(item.status));
}

export function mapProductsToCatalogBrowse(
  products: unknown[],
  options?: { availableOnly?: boolean }
): CatalogBrowseItem[] {
  const items: CatalogBrowseItem[] = [];
  for (const raw of products) {
    if (!raw || typeof raw !== "object") continue;
    const item = toCatalogBrowseItem(raw as Record<string, unknown>);
    if (item) items.push(item);
  }
  const sorted = sortCatalogBrowseItems(items);
  if (options?.availableOnly === false) return sorted;
  return filterAvailableCatalogBrowseItems(sorted);
}

export function filterCatalogBrowseItems(items: CatalogBrowseItem[], query: string): CatalogBrowseItem[] {
  const q = query.trim().toUpperCase();
  if (!q) return items;

  const digits = q.replace(/\D/g, "");

  return items.filter((item) => {
    if (item.sku.includes(q)) return true;
    if (item.name?.toUpperCase().includes(q)) return true;
    if (item.name_k?.toUpperCase().includes(q)) return true;
    if (item.brand?.toUpperCase().includes(q)) return true;
    if (item.category?.toUpperCase().includes(q)) return true;
    if (digits && item.upc?.replace(/\D/g, "").includes(digits)) return true;
    if (digits && item.barcode?.replace(/\D/g, "").includes(digits)) return true;
    return false;
  });
}

export function displayCatalogStatus(status?: string) {
  const s = String(status || "").trim().toUpperCase();
  if (!s || s === "INV" || s === "NORMAL") return "";
  return s;
}
