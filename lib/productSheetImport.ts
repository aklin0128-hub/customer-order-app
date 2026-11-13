/** sessionStorage payload when sending Top SKUs → Product Sheet. */
export const PRODUCT_SHEET_IMPORT_KEY = "product-sheet:import";

export type ProductSheetImportItem = {
  sku: string;
  name?: string;
  brand?: string;
};

export type ProductSheetImportPayload = {
  source: "top-skus";
  days: string;
  limit: string;
  items: ProductSheetImportItem[];
  createdAt: string;
};

export function writeProductSheetImport(payload: ProductSheetImportPayload) {
  sessionStorage.setItem(PRODUCT_SHEET_IMPORT_KEY, JSON.stringify(payload));
}

export function readProductSheetImport(): ProductSheetImportPayload | null {
  try {
    const raw = sessionStorage.getItem(PRODUCT_SHEET_IMPORT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PRODUCT_SHEET_IMPORT_KEY);
    const parsed = JSON.parse(raw) as ProductSheetImportPayload;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function mergeSheetItemsWithImport<T extends { sku: string }>(
  existing: T[],
  incoming: ProductSheetImportItem[]
): { items: Array<T | (ProductSheetImportItem & { imageUrl: string })>; added: number; skipped: number } {
  const seen = new Set(existing.map((item) => item.sku.toUpperCase()));
  const addedItems: Array<ProductSheetImportItem & { imageUrl: string }> = [];
  let skipped = 0;

  for (const row of incoming) {
    const sku = String(row.sku || "")
      .trim()
      .toUpperCase();
    if (!sku) continue;
    if (seen.has(sku)) {
      skipped += 1;
      continue;
    }
    seen.add(sku);
    addedItems.push({
      sku,
      name: row.name,
      brand: row.brand,
      imageUrl: `/product/${sku}.jpg`,
    });
  }

  return {
    items: [...existing, ...addedItems],
    added: addedItems.length,
    skipped,
  };
}
