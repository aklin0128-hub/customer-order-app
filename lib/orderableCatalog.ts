/**
 * Customers may order SKUs whose status is:
 * - NORMAL or a NORMAL-* variant (e.g. NORMAL_NOBR / NORMAL NBR)
 * - TBD
 * - SEASONAL (in-season items; also used by the curated Seasonal tab)
 *
 * READYTOORDER and DISCONTINUED (etc.) are not orderable.
 * READYTOORDER and SEASONAL items are hidden from Catalog (order Seasonal from the Seasonal tab).
 */
export function isOrderableCatalogStatus(status?: string | null) {
  const s = String(status || "")
    .trim()
    .toUpperCase();
  if (!s) return false;

  if (s === "TBD" || s === "SEASONAL") return true;

  // Tokenize on non-alphanumerics so "NORMAL_NOBR" / "NORMAL NOBR" both count as NORMAL.
  const tokens = s.split(/[^A-Z0-9]+/).filter(Boolean);
  return tokens.includes("NORMAL");
}

export function isDiscontinuedStatus(status?: string | null) {
  const s = String(status || "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "");
  return s === "DISCONTINUED";
}

export function isReadyToOrderStatus(status?: string | null) {
  const s = String(status || "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "");
  return s === "READYTOORDER";
}

export function isSeasonalStatus(status?: string | null) {
  const s = String(status || "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "");
  return s === "SEASONAL";
}

/** Hide Ready-to-Order and Seasonal SKUs from the Catalog tab (Seasonal tab still lists them). */
export function isCustomerVisibleCatalogStatus(status?: string | null) {
  return !isReadyToOrderStatus(status) && !isSeasonalStatus(status);
}
