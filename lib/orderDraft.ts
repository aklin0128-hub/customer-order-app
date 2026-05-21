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

/** Single source of truth: merge legacy `cart[]` with `catalogQtyMap` for display and submit. */
export function buildCatalogQtyMapFromDraft(
  draft: OrderDraftPayload | null | undefined
): Record<string, string> {
  if (!draft) return {};

  const map: Record<string, string> =
    draft.catalogQtyMap && typeof draft.catalogQtyMap === "object"
      ? { ...draft.catalogQtyMap }
      : {};

  for (const item of draft.cart || []) {
    const sku = String(item?.sku || "")
      .trim()
      .toUpperCase();
    const qty = String(item?.qty || "")
      .trim()
      .replace(/[^0-9]/g, "");
    if (sku && Number(qty) > 0) map[sku] = qty;
  }

  for (const [sku, qty] of Object.entries(map)) {
    if (!Number(String(qty || "").trim())) delete map[sku];
  }

  return map;
}

export function cartItemsFromQtyMap(map: Record<string, string>) {
  return Object.entries(map)
    .filter(([, qty]) => Number(qty) > 0)
    .map(([sku, qty]) => ({ sku: sku.toUpperCase(), qty: String(qty) }));
}

export function countDraftItems(draft: OrderDraftPayload | null | undefined) {
  return Object.keys(buildCatalogQtyMapFromDraft(draft)).length;
}

export function draftTimestamp(draft: OrderDraftPayload | null | undefined) {
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

  if (localItems === 0 && cloudItems > 0) {
    return localTime >= cloudTime ? { ...local } : { ...cloud };
  }
  if (cloudItems === 0 && localItems > 0) {
    return cloudTime >= localTime ? { ...cloud } : { ...local };
  }

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
