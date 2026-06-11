/** Catalog/quick-order and clearance (NH_ITEMS) qty are fully independent per SKU. */

export type QtyMaps = {
  catalog: Record<string, string>;
  clearance: Record<string, string>;
};

export type OrderSubmitLine = {
  sku: string;
  qty: string;
  nhItems?: boolean;
};

function cleanSku(sku: string) {
  return String(sku || "").trim().toUpperCase();
}

function parseQty(value: unknown) {
  const num = Number(String(value || "").replace(/[^0-9]/g, ""));
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : 0;
}

export function getCatalogQty(maps: QtyMaps, sku: string) {
  return parseQty(maps.catalog[cleanSku(sku)]);
}

export function getClearanceQty(maps: QtyMaps, sku: string) {
  return parseQty(maps.clearance[cleanSku(sku)]);
}

/** @deprecated use getClearanceQty */
export function getNhQty(maps: QtyMaps, sku: string) {
  return getClearanceQty(maps, sku);
}

/** SKUs with at least one NH_ITEMS case in the clearance cart. */
export function nhItemsSkuSet(maps: QtyMaps): Set<string> {
  const set = new Set<string>();
  for (const [sku, qty] of Object.entries(maps.clearance)) {
    if (parseQty(qty) > 0) set.add(cleanSku(sku));
  }
  return set;
}

export function applyQtyDelta(
  maps: QtyMaps,
  sku: string,
  delta: number,
  source: "clearance" | "normal"
): QtyMaps {
  const key = cleanSku(sku);
  if (!key || !delta) return maps;

  const field = source === "clearance" ? "clearance" : "catalog";
  const current = parseQty(maps[field][key]);
  const next = Math.max(0, current + delta);
  const nextFieldMap = { ...maps[field] };

  if (next <= 0) delete nextFieldMap[key];
  else nextFieldMap[key] = String(next);

  return { ...maps, [field]: nextFieldMap };
}

export function applyQtySet(
  maps: QtyMaps,
  sku: string,
  value: string,
  source: "clearance" | "normal"
): QtyMaps {
  const key = cleanSku(sku);
  const field = source === "clearance" ? "clearance" : "catalog";
  const next = parseQty(value);
  const nextFieldMap = { ...maps[field] };

  if (next <= 0) delete nextFieldMap[key];
  else nextFieldMap[key] = String(next);

  return { ...maps, [field]: nextFieldMap };
}

export function expandOrderSubmitLines(maps: QtyMaps): OrderSubmitLine[] {
  const lines: OrderSubmitLine[] = [];

  for (const [sku, qty] of Object.entries(maps.catalog)) {
    const key = cleanSku(sku);
    const parsed = parseQty(qty);
    if (key && parsed > 0) lines.push({ sku: key, qty: String(parsed) });
  }

  for (const [sku, qty] of Object.entries(maps.clearance)) {
    const key = cleanSku(sku);
    const parsed = parseQty(qty);
    if (key && parsed > 0) lines.push({ sku: key, qty: String(parsed), nhItems: true });
  }

  lines.sort((a, b) => a.sku.localeCompare(b.sku) || Number(a.nhItems) - Number(b.nhItems));
  return lines;
}

/** One cart row per pool (same SKU may appear twice). */
export function buildCartDisplayItems(maps: QtyMaps): OrderSubmitLine[] {
  return expandOrderSubmitLines(maps);
}

export function countCartLines(maps: QtyMaps) {
  return buildCartDisplayItems(maps).length;
}

export function countTotalCases(maps: QtyMaps) {
  let sum = 0;
  for (const qty of Object.values(maps.catalog)) sum += parseQty(qty);
  for (const qty of Object.values(maps.clearance)) sum += parseQty(qty);
  return sum;
}
