const BRAND_ALIASES: Record<string, string> = {
  LOTTESAMKANG: "LOTTE",
};

export function normalizeBrand(brand?: string) {
  const value = String(brand || "").trim().toUpperCase();
  if (!value) return "";
  return BRAND_ALIASES[value] || value;
}

export function brandMatchesFilter(itemBrand: string | undefined, filter: string) {
  if (filter === "ALL") return true;
  return normalizeBrand(itemBrand) === filter;
}

export type BrandFilterSplit = {
  /** Quick chips: top brands by SKU count among orderable items */
  topBrands: string[];
  /** Rest of brands — alphabetical in dropdown */
  moreBrands: string[];
};

const DEFAULT_TOP = 8;

/**
 * Builds brand filters from catalog data only (no hardcoded brand list).
 * `maxQuick` = number of shortcut chips before "more brands" dropdown.
 */
export function splitBrandFilters(
  items: { brand?: string }[],
  isIncluded: (item: { brand?: string }) => boolean = () => true,
  maxQuick = DEFAULT_TOP
): BrandFilterSplit {
  const counts = new Map<string, number>();

  for (const item of items) {
    if (!isIncluded(item)) continue;
    const brand = normalizeBrand(item.brand);
    if (!brand || brand === "UNBRANDED") continue;
    counts.set(brand, (counts.get(brand) || 0) + 1);
  }

  const sortedByCount = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  const allSorted = sortedByCount.map(([b]) => b);
  const topBrands = allSorted.slice(0, maxQuick);
  const topSet = new Set(topBrands);
  const moreBrands = allSorted.filter((b) => !topSet.has(b)).sort((a, b) => a.localeCompare(b));

  return { topBrands, moreBrands };
}

export function isKnownBrandFilter(split: BrandFilterSplit, filter: string) {
  if (filter === "ALL") return true;
  return split.topBrands.includes(filter) || split.moreBrands.includes(filter);
}
