/** NH_ITEMS (clearance) qty is tracked separately from catalog/quick-order qty. */

export type QtyMaps = {
  total: Record<string, string>;
  nh: Record<string, string>;
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

export function getNhQty(maps: QtyMaps, sku: string) {
  return parseQty(maps.nh[cleanSku(sku)]);
}

export function getTotalQty(maps: QtyMaps, sku: string) {
  return parseQty(maps.total[cleanSku(sku)]);
}

export function getNormalQty(maps: QtyMaps, sku: string) {
  return Math.max(0, getTotalQty(maps, sku) - getNhQty(maps, sku));
}

/** SKUs with at least one NH_ITEMS case in the cart. */
export function nhItemsSkuSet(maps: QtyMaps): Set<string> {
  const set = new Set<string>();
  for (const [sku, qty] of Object.entries(maps.nh)) {
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

  const total = getTotalQty(maps, key);
  const nh = getNhQty(maps, key);
  const normal = Math.max(0, total - nh);

  let nextTotal = total;
  let nextNh = nh;

  if (delta > 0) {
    if (source === "clearance") {
      nextTotal = total + delta;
      nextNh = nh + delta;
    } else {
      nextTotal = total + delta;
    }
  } else {
    const remove = Math.abs(delta);
    if (source === "clearance") {
      const fromNh = Math.min(remove, nh);
      nextNh = nh - fromNh;
      nextTotal = total - fromNh;
    } else {
      const fromNormal = Math.min(remove, normal);
      const fromNh = remove - fromNormal;
      nextTotal = total - remove;
      nextNh = nh - fromNh;
    }
  }

  const nextTotalMap = { ...maps.total };
  const nextNhMap = { ...maps.nh };

  if (nextTotal <= 0) {
    delete nextTotalMap[key];
    delete nextNhMap[key];
  } else {
    nextTotalMap[key] = String(nextTotal);
    if (nextNh > 0) nextNhMap[key] = String(nextNh);
    else delete nextNhMap[key];
  }

  return { total: nextTotalMap, nh: nextNhMap };
}

export function applyQtySet(
  maps: QtyMaps,
  sku: string,
  value: string,
  source: "clearance" | "normal"
): QtyMaps {
  const key = cleanSku(sku);
  const newTotal = parseQty(value);
  const currentTotal = getTotalQty(maps, key);
  const currentNh = getNhQty(maps, key);

  if (!newTotal) {
    const nextTotalMap = { ...maps.total };
    const nextNhMap = { ...maps.nh };
    delete nextTotalMap[key];
    delete nextNhMap[key];
    return { total: nextTotalMap, nh: nextNhMap };
  }

  let nextNh = currentNh;
  if (source === "clearance") {
    if (newTotal > currentTotal) nextNh = currentNh + (newTotal - currentTotal);
    else nextNh = Math.max(0, currentNh - (currentTotal - newTotal));
  } else if (newTotal < currentTotal) {
    const remove = currentTotal - newTotal;
    const fromNormal = Math.min(remove, currentTotal - currentNh);
    nextNh = Math.max(0, currentNh - (remove - fromNormal));
  }

  const nextTotalMap = { ...maps.total, [key]: String(newTotal) };
  const nextNhMap = { ...maps.nh };
  if (nextNh > 0) nextNhMap[key] = String(nextNh);
  else delete nextNhMap[key];

  return { total: nextTotalMap, nh: nextNhMap };
}

export function expandOrderSubmitLines(maps: QtyMaps): OrderSubmitLine[] {
  const lines: OrderSubmitLine[] = [];

  for (const [sku, qty] of Object.entries(maps.total)) {
    const key = cleanSku(sku);
    const total = parseQty(qty);
    if (!key || total <= 0) continue;

    const nh = Math.min(getNhQty(maps, key), total);
    const normal = total - nh;

    if (normal > 0) lines.push({ sku: key, qty: String(normal) });
    if (nh > 0) lines.push({ sku: key, qty: String(nh), nhItems: true });
  }

  lines.sort((a, b) => a.sku.localeCompare(b.sku) || Number(a.nhItems) - Number(b.nhItems));
  return lines;
}
