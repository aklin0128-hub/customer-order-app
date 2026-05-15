/** Popular brands shown as quick filters on the catalog order page */
export const FEATURED_BRAND_FILTERS = [
  "NONGSHIM",
  "SAMYANG",
  "LOTTE",
  "PALDO",
  "ORION",
  "ASSI",
  "BINGGRAE",
  "HAITAI",
  "SEMPIO",
  "YISSINE",
  "SAPPORO",
  "CHUNGJUNGONE",
  "EMPEROR",
  "NONGHYUP",
] as const;

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

export function getAvailableFeaturedBrands(
  items: { brand?: string }[],
  isIncluded: (item: { brand?: string }) => boolean = () => true
) {
  const counts = new Map<string, number>();

  for (const item of items) {
    if (!isIncluded(item)) continue;
    const brand = normalizeBrand(item.brand);
    if (!brand || brand === "UNBRANDED") continue;
    counts.set(brand, (counts.get(brand) || 0) + 1);
  }

  return FEATURED_BRAND_FILTERS.filter((brand) => (counts.get(brand) || 0) > 0) as string[];
}
