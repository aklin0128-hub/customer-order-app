export type SkuOrderHistorySourceOrder = {
  orderRef?: string;
  createdAt?: string;
  items?: { sku?: string; qty?: string | number }[];
};

export type SkuOrderHistoryEntry = {
  orderRef: string;
  createdAt: string;
  qty: number;
};

function cleanSku(sku: string) {
  return String(sku || "")
    .trim()
    .toUpperCase();
}

/** Index past orders by SKU → newest-first qty rows. */
export function buildSkuOrderHistoryIndex(
  orders: SkuOrderHistorySourceOrder[] | null | undefined
): Map<string, SkuOrderHistoryEntry[]> {
  const map = new Map<string, SkuOrderHistoryEntry[]>();
  if (!Array.isArray(orders)) return map;

  for (const order of orders) {
    const createdAt = String(order?.createdAt || "").trim();
    const orderRef = String(order?.orderRef || "").trim();
    const qtyBySku = new Map<string, number>();

    for (const item of order?.items || []) {
      const sku = cleanSku(String(item?.sku || ""));
      const qty = Math.floor(Number(item?.qty) || 0);
      if (!sku || qty <= 0) continue;
      qtyBySku.set(sku, (qtyBySku.get(sku) || 0) + qty);
    }

    for (const [sku, qty] of qtyBySku) {
      const list = map.get(sku) || [];
      list.push({ orderRef, createdAt, qty });
      map.set(sku, list);
    }
  }

  return map;
}

export function formatSkuOrderHistoryDate(iso: string, lang = "en") {
  const parsed = Date.parse(String(iso || ""));
  if (!Number.isFinite(parsed)) return iso || "—";
  const locale =
    lang === "zh" ? "zh-CN" : lang === "ko" ? "ko-KR" : lang === "vi" ? "vi-VN" : undefined;
  return new Date(parsed).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
