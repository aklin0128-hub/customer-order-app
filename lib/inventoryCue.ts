export type InventoryCueKind = "maybe_oos" | "low" | null;

export type InventoryCueLang = "en" | "zh" | "ko" | "vi";

const LOW_INVENTORY_BELOW = 50;

/** Parse on-hand qty from catalog JSON / Excel. 0 is valid; null/blank is missing. */
export function parseInventoryNumber(inventory: unknown): number | undefined {
  if (inventory === undefined || inventory === null || inventory === "") return undefined;
  const n =
    typeof inventory === "number" ? inventory : Number(String(inventory).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : undefined;
}

/** 0 or negative → maybe out of stock; below 50 → low; otherwise no label. */
export function inventoryCueKind(inventory: unknown): InventoryCueKind {
  const n = parseInventoryNumber(inventory);
  if (n === undefined) return null;
  if (n <= 0) return "maybe_oos";
  if (n < LOW_INVENTORY_BELOW) return "low";
  return null;
}

export function inventoryCueLabel(kind: InventoryCueKind, lang: InventoryCueLang = "en"): string {
  if (!kind) return "";
  if (kind === "maybe_oos") {
    if (lang === "zh") return "可能没货";
    if (lang === "ko") return "재고 없을 수 있음";
    if (lang === "vi") return "Có thể hết hàng";
    return "May be out of stock";
  }
  if (lang === "zh") return "库存偏低";
  if (lang === "ko") return "재고 부족";
  if (lang === "vi") return "Tồn kho thấp";
  return "Low inventory";
}
