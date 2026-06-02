export function parseImportedAtMs(value?: string | null) {
  const ms = Date.parse(String(value || "").trim());
  return Number.isFinite(ms) ? ms : null;
}

const DATE_LOCALE_BY_LANG: Record<string, string> = {
  en: "en-US",
  zh: "zh-CN",
  ko: "ko-KR",
  vi: "vi-VN",
};

export function catalogDateLocale(lang?: string) {
  return DATE_LOCALE_BY_LANG[String(lang || "en")] || "en-US";
}

export function formatCatalogAddedDate(value: string | undefined, lang?: string) {
  const ms = parseImportedAtMs(value);
  if (ms == null) return null;
  return new Date(ms).toLocaleDateString(catalogDateLocale(lang), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export type CatalogNewFields = {
  sku?: string;
  /** Admin only: show in customer “New items” tab/list */
  isNew?: boolean;
  /** Admin only: JUST ADDED badge + pin to top */
  justAdded?: boolean;
  /** ISO time when SKU first appeared in catalog (import) */
  importedAt?: string;
  /** ISO time when admin first marked SKU as new */
  newSince?: string;
  name?: string;
  size?: string;
  name_k?: string;
};

/** Best available "added" timestamp for new-item display/sort. */
export function getNewItemAddedAtMs(
  item?: (CatalogNewFields & { updatedAt?: string }) | null
): number | null {
  return (
    parseImportedAtMs(item?.newSince) ??
    parseImportedAtMs(item?.importedAt) ??
    parseImportedAtMs(item?.updatedAt)
  );
}

export function formatCatalogAddedDateForItem(item: CatalogNewFields | undefined, lang?: string) {
  const ms = getNewItemAddedAtMs(item);
  if (ms == null) return null;
  return new Date(ms).toLocaleDateString(catalogDateLocale(lang), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** New items = admin sets isNew on the SKU (no auto-read from name or import). */
export function isCatalogNewItem(item?: CatalogNewFields | null) {
  return Boolean(item?.isNew);
}

/** Manual JUST ADDED pin (Admin → Products). */
export function isJustAddedItem(item?: CatalogNewFields | null) {
  return Boolean(item?.justAdded);
}

/** Pin justAdded first, then SKU. */
export function compareCatalogForDisplay(
  a: CatalogNewFields & { sku?: string },
  b: CatalogNewFields & { sku?: string }
) {
  const aPin = isJustAddedItem(a) ? 1 : 0;
  const bPin = isJustAddedItem(b) ? 1 : 0;
  if (bPin !== aPin) return bPin - aPin;
  return String(a.sku || "").localeCompare(String(b.sku || ""));
}

export function compareCatalogByNewestImport(
  a: CatalogNewFields & { sku?: string },
  b: CatalogNewFields & { sku?: string }
) {
  const aPin = isJustAddedItem(a) ? 1 : 0;
  const bPin = isJustAddedItem(b) ? 1 : 0;
  if (bPin !== aPin) return bPin - aPin;
  const aMs = getNewItemAddedAtMs(a) ?? 0;
  const bMs = getNewItemAddedAtMs(b) ?? 0;
  if (bMs !== aMs) return bMs - aMs;
  return String(a.sku || "").localeCompare(String(b.sku || ""));
}
