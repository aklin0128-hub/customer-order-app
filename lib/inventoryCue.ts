import { isComingSoonNewItem, type NewItemStampFields } from "@/lib/comingSoonBadge";
import { isDiscontinuedStatus } from "@/lib/orderableCatalog";
import { isProductOutOfStockStamp } from "@/lib/productAvailability";
import { isSeasonalEtaPending } from "@/lib/seasonalEta";

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

export type InventoryCueItem = NewItemStampFields & {
  inventory?: unknown;
  status?: string;
  outOfStock?: boolean;
  seasonalEtaDate?: string | null;
};

/**
 * Hide inventory pills when a stronger status already explains the card:
 * discontinued, out-of-stock stamp, coming soon, or Seasonal ETA not yet reached.
 */
export function inventoryCueKindForItem(item: InventoryCueItem, now = new Date()): InventoryCueKind {
  if (isDiscontinuedStatus(item.status)) return null;
  if (isProductOutOfStockStamp(item)) return null;
  if (isComingSoonNewItem(item)) return null;
  if (isSeasonalEtaPending(item.seasonalEtaDate, now)) return null;
  return inventoryCueKind(item.inventory);
}

export function inventoryCueLabel(kind: InventoryCueKind, lang: InventoryCueLang = "en"): string {
  if (!kind) return "";
  if (kind === "maybe_oos") {
    if (lang === "zh") return "有限或缺货";
    if (lang === "ko") return "한정 또는 품절";
    if (lang === "vi") return "Hạn chế hoặc hết hàng";
    return "Limited or Gone";
  }
  if (lang === "zh") return "供应有限";
  if (lang === "ko") return "수량 한정";
  if (lang === "vi") return "Số lượng hạn chế";
  return "Limited availability";
}
