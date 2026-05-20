export type OrderDraftPayload = {
  accountNo?: string;
  storeName?: string;
  phone?: string;
  note?: string;
  orderEmail?: string;
  cart?: { sku: string; qty: string }[];
  catalogQtyMap?: Record<string, string>;
  updatedAt?: string;
};

export function countDraftItems(draft: OrderDraftPayload | null | undefined) {
  if (!draft) return 0;
  const cartLen = Array.isArray(draft.cart) ? draft.cart.length : 0;
  const mapCount = Object.values(draft.catalogQtyMap || {}).filter((qty) => Number(qty) > 0).length;
  return Math.max(cartLen, mapCount);
}

function draftTimestamp(draft: OrderDraftPayload | null | undefined) {
  const parsed = Date.parse(String(draft?.updatedAt || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Prefer the draft that actually has cart lines; otherwise use the newer save. */
export function mergeOrderDrafts(
  local: OrderDraftPayload | null | undefined,
  cloud: OrderDraftPayload | null | undefined
): OrderDraftPayload | null {
  if (!local && !cloud) return null;
  if (!local) return cloud ? { ...cloud } : null;
  if (!cloud) return { ...local };

  const localItems = countDraftItems(local);
  const cloudItems = countDraftItems(cloud);
  const localTime = draftTimestamp(local);
  const cloudTime = draftTimestamp(cloud);

  if (localItems === 0 && cloudItems > 0) return { ...cloud };
  if (cloudItems === 0 && localItems > 0) return { ...local };

  const winner = cloudTime > localTime ? cloud : localTime > cloudTime ? local : cloudItems >= localItems ? cloud : local;
  const loser = winner === cloud ? local : cloud;

  return {
    ...winner,
    phone: winner.phone || loser.phone || "",
    note: winner.note || loser.note || "",
    orderEmail: winner.orderEmail || loser.orderEmail || "",
  };
}

export function normalizeOrderDraft(
  accountNo: string,
  raw: Partial<OrderDraftPayload>
): OrderDraftPayload {
  return {
    accountNo,
    storeName: String(raw.storeName || "").trim(),
    phone: String(raw.phone || "").trim(),
    note: String(raw.note || "").trim(),
    orderEmail: String(raw.orderEmail || "").trim(),
    cart: Array.isArray(raw.cart)
      ? raw.cart
          .map((item) => ({
            sku: String(item?.sku || "")
              .trim()
              .toUpperCase(),
            qty: String(item?.qty || "").trim(),
          }))
          .filter((item) => item.sku && item.qty)
      : [],
    catalogQtyMap:
      raw.catalogQtyMap && typeof raw.catalogQtyMap === "object" ? raw.catalogQtyMap : {},
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}
