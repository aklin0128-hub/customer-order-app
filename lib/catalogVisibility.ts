import { normalizeBrand } from "@/lib/catalogBrands";

const HIDDEN_BRAND_TOKEN = "WEGMANS";

function includesHiddenBrandToken(value: string) {
  const text = String(value || "").toUpperCase();
  if (!text) return false;
  return new RegExp(`(?:^|[^A-Z0-9])${HIDDEN_BRAND_TOKEN}(?:$|[^A-Z0-9])`).test(text);
}

/** Customer catalog, order, /new, and /catalog hide these brands. Admin products stay unchanged. */
export function isHiddenFromCustomerCatalog(item?: { brand?: string; name?: string } | null) {
  if (!item) return false;
  if (includesHiddenBrandToken(normalizeBrand(item.brand))) return true;
  if (includesHiddenBrandToken(String(item.name || ""))) return true;
  return false;
}

export function excludeHiddenFromCustomerCatalog<T extends { brand?: string; name?: string }>(items: T[]): T[] {
  return items.filter((item) => !isHiddenFromCustomerCatalog(item));
}
