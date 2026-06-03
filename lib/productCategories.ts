import { CATEGORY_OPTIONS, inferCategory, type CategoryItem } from "@/lib/inferCategory";

const VALID_CATEGORIES = new Set(
  CATEGORY_OPTIONS.filter((value) => value !== "ALL") as readonly string[]
);

export type ProductCategoryFields = {
  category?: string;
  categories?: string[];
};

export function normalizeProductCategory(value: string) {
  const clean = String(value || "").trim().toUpperCase();
  return VALID_CATEGORIES.has(clean) ? clean : "";
}

/** Read admin/Redis categories with legacy single `category` fallback. */
export function readProductCategories(product?: ProductCategoryFields | null): string[] {
  if (Array.isArray(product?.categories) && product.categories.length > 0) {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of product.categories) {
      const norm = normalizeProductCategory(String(raw));
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      out.push(norm);
    }
    return out;
  }

  const single = normalizeProductCategory(String(product?.category || ""));
  return single ? [single] : [];
}

export function parseCategoriesFromBody(body: {
  categories?: unknown;
  category?: unknown;
}): string[] {
  if (Array.isArray(body?.categories)) {
    return readProductCategories({ categories: body.categories.map(String) });
  }
  const legacy = normalizeProductCategory(String(body?.category || ""));
  return legacy ? [legacy] : [];
}

/** Tags used for customer catalog category filters. */
export function getProductCategoryTags(item: CategoryItem): string[] {
  const explicit = readProductCategories(item);
  if (explicit.length > 0) return explicit;
  return [inferCategory(item)];
}

export function productMatchesCategoryFilters(item: CategoryItem, filters: string[]) {
  if (filters.length === 0) return true;
  const tags = new Set(getProductCategoryTags(item));
  return filters.some((filter) => tags.has(filter));
}
