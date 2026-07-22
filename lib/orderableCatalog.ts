/**
 * Customers may only order SKUs whose status is NORMAL or a NORMAL-* variant
 * (e.g. NORMAL_NOBR / NORMAL NBR). READYTOORDER, TBD, DISCONTINUED, etc. are not orderable.
 */
export function isOrderableCatalogStatus(status?: string | null) {
  const s = String(status || "")
    .trim()
    .toUpperCase();
  if (!s) return false;

  // Tokenize on non-alphanumerics so "NORMAL_NOBR" / "NORMAL NOBR" both count as NORMAL.
  const tokens = s.split(/[^A-Z0-9]+/).filter(Boolean);
  return tokens.includes("NORMAL");
}
