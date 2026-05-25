export function parseImportedAtMs(value?: string | null) {
  const ms = Date.parse(String(value || "").trim());
  return Number.isFinite(ms) ? ms : null;
}

export type CatalogNewFields = {
  sku?: string;
  /** Admin only: show in customer “New items” tab/list */
  isNew?: boolean;
  /** Admin only: JUST ADDED badge + pin to top */
  justAdded?: boolean;
  importedAt?: string;
  name?: string;
  size?: string;
  name_k?: string;
};

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
  return compareCatalogForDisplay(a, b);
}
