/** Catalog/quick-order, clearance (NH_ITEMS), and NDH qty are independent per SKU. */

export type QtySource = "clearance" | "ndh" | "normal";

export type QtyMaps = {
  catalog: Record<string, string>;
  clearance: Record<string, string>;
  ndh?: Record<string, string>;
};

export type OrderSubmitLine = {
  sku: string;
  qty: string;
  nhItems?: boolean;
  ndh?: boolean;
};

function cleanSku(sku: string) {
  return String(sku || "").trim().toUpperCase();
}

function parseQty(value: unknown) {
  const num = Number(String(value || "").replace(/[^0-9]/g, ""));
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : 0;
}

function fieldForSource(source: QtySource): "catalog" | "clearance" | "ndh" {
  if (source === "clearance") return "clearance";
  if (source === "ndh") return "ndh";
  return "catalog";
}

function mapFor(maps: QtyMaps, field: "catalog" | "clearance" | "ndh") {
  return maps[field] || {};
}

export function getCatalogQty(maps: QtyMaps, sku: string) {
  return parseQty(maps.catalog[cleanSku(sku)]);
}

export function getClearanceQty(maps: QtyMaps, sku: string) {
  return parseQty(maps.clearance[cleanSku(sku)]);
}

export function getNdhQty(maps: QtyMaps, sku: string) {
  return parseQty(mapFor(maps, "ndh")[cleanSku(sku)]);
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

export function ndhSkuSet(maps: QtyMaps): Set<string> {
  const set = new Set<string>();
  for (const [sku, qty] of Object.entries(mapFor(maps, "ndh"))) {
    if (parseQty(qty) > 0) set.add(cleanSku(sku));
  }
  return set;
}

export function applyQtyDelta(
  maps: QtyMaps,
  sku: string,
  delta: number,
  source: QtySource
): QtyMaps {
  const key = cleanSku(sku);
  if (!key || !delta) return maps;

  const field = fieldForSource(source);
  const current = parseQty(mapFor(maps, field)[key]);
  const next = Math.max(0, current + delta);
  const nextFieldMap = { ...mapFor(maps, field) };

  if (next <= 0) delete nextFieldMap[key];
  else nextFieldMap[key] = String(next);

  return { catalog: maps.catalog, clearance: maps.clearance, ndh: maps.ndh || {}, [field]: nextFieldMap };
}

export function applyQtySet(
  maps: QtyMaps,
  sku: string,
  value: string,
  source: QtySource
): QtyMaps {
  const key = cleanSku(sku);
  const field = fieldForSource(source);
  const next = parseQty(value);
  const nextFieldMap = { ...mapFor(maps, field) };

  if (next <= 0) delete nextFieldMap[key];
  else nextFieldMap[key] = String(next);

  return { catalog: maps.catalog, clearance: maps.clearance, ndh: maps.ndh || {}, [field]: nextFieldMap };
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

  for (const [sku, qty] of Object.entries(mapFor(maps, "ndh"))) {
    const key = cleanSku(sku);
    const parsed = parseQty(qty);
    if (key && parsed > 0) lines.push({ sku: key, qty: String(parsed), ndh: true });
  }

  lines.sort(
    (a, b) =>
      a.sku.localeCompare(b.sku) ||
      Number(Boolean(a.nhItems)) - Number(Boolean(b.nhItems)) ||
      Number(Boolean(a.ndh)) - Number(Boolean(b.ndh))
  );
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
  for (const qty of Object.values(mapFor(maps, "ndh"))) sum += parseQty(qty);
  return sum;
}

export function cartLineKind(item: { nhItems?: boolean; ndh?: boolean }): QtySource {
  if (item.ndh) return "ndh";
  if (item.nhItems) return "clearance";
  return "normal";
}

export function cartLinePoolKey(item: { sku: string; nhItems?: boolean; ndh?: boolean }) {
  return `${cleanSku(item.sku)}::${item.ndh ? "ndh" : item.nhItems ? "nh" : "cat"}`;
}
