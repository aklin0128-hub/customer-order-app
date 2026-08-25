/**
 * Customers may order SKUs whose status is:
 * - NORMAL or a NORMAL-* variant (e.g. NORMAL_NOBR / NORMAL NBR)
 * - TBD
 * - SEASONAL (in-season items; also used by the curated Seasonal tab)
 *
 * READYTOORDER and DISCONTINUED (etc.) are not orderable.
 * READYTOORDER items should also be hidden from customer catalog browsing.
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

export function isReadyToOrderStatus(status?: string | null) {
  const s = String(status || "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "");
  return s === "READYTOORDER";
}

/** Hide Ready-to-Order SKUs from customer-facing catalog lists. */
export function isCustomerVisibleCatalogStatus(status?: string | null) {
  return !isReadyToOrderStatus(status);
}
