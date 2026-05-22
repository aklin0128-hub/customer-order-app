const ORDERABLE_STATUSES = new Set(["NORMAL", "NORMAL_NOBR", "NORMAL_NBR", "TBD"]);

export function isOrderableCatalogStatus(status?: string | null) {
  const s = String(status || "").trim().toUpperCase();
  return ORDERABLE_STATUSES.has(s);
}
