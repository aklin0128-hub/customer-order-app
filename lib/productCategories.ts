import { CATEGORY_OPTIONS, inferCategory, type CategoryItem } from "@/lib/inferCategory";

const VALID_CATEGORIES = new Set(
  CATEGORY_OPTIONS.filter((value) => value !== "ALL") as readonly string[]
);

/** Primary category → extra tags applied automatically (e.g. RICE also counts as DRY GOODS). */
const CATEGORY_IMPLIED_TAGS: Record<string, string[]> = {
  RICE: ["DRY GOODS"],
};

export function normalizeProductCategory(value: string) {
  const clean = String(value || "").trim().toUpperCase();
  return VALID_CATEGORIES.has(clean) ? clean : "";
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

/** Extra tags implied by a primary category. */
export function getImpliedCategories(category: string): string[] {
  const primary = normalizeProductCategory(category);
  if (!primary) return [];
  return dedupeCategories(CATEGORY_IMPLIED_TAGS[primary] || []);
}

/** Add implied tags (RICE → DRY GOODS, etc.). */
export function expandCategoryTags(categories: string[]): string[] {
  const out: string[] = [];
  for (const cat of dedupeCategories(categories)) {
    out.push(cat);
    for (const implied of getImpliedCategories(cat)) {
      if (!out.includes(implied)) out.push(implied);
    }
  }
  return out;
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

/** Tags used for customer catalog category filters. */
export function getProductCategoryTags(item: CategoryItem): string[] {
  const explicit = readProductCategories(item);
  if (explicit.length > 0) return expandCategoryTags(explicit);
  return expandCategoryTags([inferCategory(item)]);
}

export function productMatchesCategoryFilters(item: CategoryItem, filters: string[]) {
  if (filters.length === 0) return true;
  const tags = new Set(getProductCategoryTags(item));
  return filters.some((filter) => tags.has(filter));
}
