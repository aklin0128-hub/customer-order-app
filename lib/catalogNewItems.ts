/** SKUs imported within this many days count as “new items” (unless isNew is set). */
export const NEW_ITEM_IMPORT_WINDOW_DAYS = 60;

/** Shorter window for the “JUST ADDED” badge on order cards. */
export const JUST_ADDED_DAYS = 14;

export type CatalogNewFields = {
  sku?: string;
  isNew?: boolean;
  importedAt?: string;
  name?: string;
  size?: string;
  name_k?: string;
};

export function parseImportedAtMs(value?: string | null) {
  const ms = Date.parse(String(value || "").trim());
  return Number.isFinite(ms) ? ms : null;
}

function nameLooksLikeNew(item: CatalogNewFields) {
  const text = [item.name, item.size, item.name_k]
    .filter(Boolean)
    .join(" ")
    .toUpperCase()
    .replace(/[_-]+/g, " ");
  return /(^|\s)NEW(\s|$)/.test(text);
}

/**
 * New item rules:
 * 1. Redis/admin `isNew: true` → always new
 * 2. `isNew: false` → never new (manual exclude)
 * 3. `importedAt` within NEW_ITEM_IMPORT_WINDOW_DAYS → new
 * 4. Legacy fallback: name/size contains standalone “NEW”
 */
export function isCatalogNewItem(item?: CatalogNewFields | null, now = Date.now()) {
  if (!item) return false;
  if (item.isNew === true) return true;
  if (item.isNew === false) return false;

  const importedMs = parseImportedAtMs(item.importedAt);
  if (importedMs != null) {
    const windowMs = NEW_ITEM_IMPORT_WINDOW_DAYS * 86400000;
    return now - importedMs <= windowMs;
  }

  return nameLooksLikeNew(item);
}

/** Recently imported (import time only — no name-NEW fallback). */
export function isJustAddedItem(item?: CatalogNewFields | null, now = Date.now()) {
  if (!item || item.isNew === false) return false;

  const importedMs = parseImportedAtMs(item.importedAt);
  if (importedMs == null) return false;

  return now - importedMs <= JUST_ADDED_DAYS * 86400000;
}

/** Newest import first; then SKU. */
export function compareCatalogByNewestImport(
  a: CatalogNewFields & { sku?: string },
  b: CatalogNewFields & { sku?: string }
) {
  const aMs = parseImportedAtMs(a.importedAt) ?? 0;
  const bMs = parseImportedAtMs(b.importedAt) ?? 0;
  if (bMs !== aMs) return bMs - aMs;
  return String(a.sku || "").localeCompare(String(b.sku || ""));
}
