export type ComingSoonBadgeLang = "en" | "zh" | "ko" | "vi";

const LABELS: Record<ComingSoonBadgeLang, string> = {
  en: "Coming Soon",
  zh: "即将上市",
  ko: "출시 예정",
  vi: "Sắp có",
};

export type NewItemStampFields = {
  isNew?: boolean;
  newItemOutOfStock?: boolean;
  newItemComingSoon?: boolean;
  /** General catalog out-of-stock — also shows on /new/ when the item is marked new. */
  outOfStock?: boolean;
};

export function getComingSoonBadgeLabel(lang: ComingSoonBadgeLang) {
  return LABELS[lang];
}

/** Coming Soon stamp — separate from out-of-stock. */
export function isComingSoonNewItem(item?: NewItemStampFields | null) {
  if (!item?.isNew) return false;
  if (typeof item.newItemComingSoon === "boolean") return item.newItemComingSoon;
  // Legacy: before the split, newItemOutOfStock drove the Coming Soon stamp only.
  return Boolean(item.newItemOutOfStock);
}

/** Out of stock stamp for new-item cards (/new/ and New items tab). */
export function isNewItemOutOfStockStamp(item?: NewItemStampFields | null) {
  if (!item?.isNew) return false;
  if (Boolean(item.outOfStock)) return true;
  if (typeof item.newItemComingSoon === "boolean") return Boolean(item.newItemOutOfStock);
  // Legacy records only had the coming-soon meaning for this flag.
  return false;
}

export function isNewItemOrderingBlocked(item?: NewItemStampFields | null) {
  return isComingSoonNewItem(item) || isNewItemOutOfStockStamp(item);
}

/** Admin form: map stored product flags to separate checkboxes. */
export function readNewItemOutOfStockForAdmin(item?: NewItemStampFields | null) {
  if (!item?.isNew) return false;
  if (typeof item.newItemComingSoon === "boolean") return Boolean(item.newItemOutOfStock);
  return false;
}

export function readNewItemComingSoonForAdmin(item?: NewItemStampFields | null) {
  if (!item?.isNew) return false;
  if (typeof item.newItemComingSoon === "boolean") return item.newItemComingSoon;
  return Boolean(item.newItemOutOfStock);
}
