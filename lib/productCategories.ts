import { mapLegacyCategoryToMain } from "@/lib/catalogMainCategories";
import { CATEGORY_OPTIONS, inferCategory, type CategoryItem } from "@/lib/inferCategory";

const VALID_CATEGORIES = new Set(
  CATEGORY_OPTIONS.filter((value) => value !== "ALL") as readonly string[]
);

export function normalizeProductCategory(value: string) {
  const clean = String(value || "").trim().toUpperCase();
  if (VALID_CATEGORIES.has(clean)) return clean;
  return mapLegacyCategoryToMain(clean);
}

function dedupeCategories(categories: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of categories) {
    const norm = normalizeProductCategory(raw);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out;
}

/** @deprecated Implied sub-tags removed; returns []. */
export function getImpliedCategories(_category: string): string[] {
  return [];
}

/** Normalize to main categories (legacy values map to DRY / FROZEN / FRESH / HOUSEWARE). */
export function expandCategoryTags(categories: string[]): string[] {
  return dedupeCategories(categories);
}

export type ProductCategoryFields = {
  category?: string;
  categories?: string[];
};

/** Read admin/Redis categories with legacy single `category` fallback. */
export function readProductCategories(product?: ProductCategoryFields | null): string[] {
  if (Array.isArray(product?.categories) && product.categories.length > 0) {
    return dedupeCategories(product.categories.map(String));
  }

  const single = normalizeProductCategory(String(product?.category || ""));
  return single ? [single] : [];
}

export function parseCategoriesFromBody(body: {
  categories?: unknown;
  category?: unknown;
}): string[] {
  if (Array.isArray(body?.categories)) {
    return expandCategoryTags(readProductCategories({ categories: body.categories.map(String) }));
  }
  const legacy = normalizeProductCategory(String(body?.category || ""));
  return legacy ? expandCategoryTags([legacy]) : [];
}

/**
 * Parse a category-only PATCH. Empty / AUTO → clear override (`[]`).
 * Returns null when a non-empty value is not a known category.
 */
export function resolveCategoryPatchInput(value: unknown): string[] | null {
  const raw = String(value ?? "").trim();
  if (!raw || raw.toUpperCase() === "AUTO") return [];
  const categories = parseCategoriesFromBody({ category: raw });
  return categories.length > 0 ? categories : null;
}

/** Merge a category-only change onto an existing product without touching other fields. */
export function applyProductCategoryPatch<T extends ProductCategoryFields>(
  product: T,
  categoryInput: unknown
): T {
  const categories = resolveCategoryPatchInput(categoryInput);
  if (categories === null) return product;
  if (categories.length === 0) {
    return { ...product, category: "", categories: [] };
  }
  return { ...product, category: categories[0], categories };
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
  return filters.some((filter) => tags.has(normalizeProductCategory(filter)));
}
