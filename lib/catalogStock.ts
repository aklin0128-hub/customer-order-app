/** Catalog master / status-xlsx `inventory` (cases on hand). */
export function readCatalogInventory(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Show OUT OF STOCK stamp on new-item cards when warehouse qty is zero or below. */
export function isCatalogOutOfStock(item?: {
  inventory?: unknown;
  status?: string | null;
} | null): boolean {
  if (!item) return false;

  const status = String(item.status || "").trim().toUpperCase();
  if (status === "INV") return true;

  const inventory = readCatalogInventory(item.inventory);
  return inventory !== null && inventory <= 0;
}
