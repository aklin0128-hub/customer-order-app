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

/** Combine SKU qty maps — union all lines; same SKU uses the newer draft's qty. */
export function mergeCatalogQtyMaps(
  localMap: Record<string, string>,
  cloudMap: Record<string, string>,
  localTime: number,
  cloudTime: number
): Record<string, string> {
  const merged: Record<string, string> = {};
  const skus = new Set([...Object.keys(localMap), ...Object.keys(cloudMap)]);

  for (const sku of skus) {
    const localQty = String(localMap[sku] || "").trim();
    const cloudQty = String(cloudMap[sku] || "").trim();
    const localHas = Number(localQty) > 0;
    const cloudHas = Number(cloudQty) > 0;

    if (localHas && cloudHas) {
      merged[sku] = localTime >= cloudTime ? localQty : cloudQty;
    } else if (localHas) {
      merged[sku] = localQty;
    } else if (cloudHas) {
      merged[sku] = cloudQty;
    }
  }

  return merged;
}

/** Merge local + cloud drafts — keep all SKUs from both sides (cross-device carts combine). */
export function mergeOrderDrafts(
  local: OrderDraftPayload | null | undefined,
  cloud: OrderDraftPayload | null | undefined
): OrderDraftPayload | null {
  if (!local && !cloud) return null;
  if (!local) return cloud ? { ...cloud } : null;
  if (!cloud) return { ...local };

  const localMap = buildCatalogQtyMapFromDraft(local);
  const cloudMap = buildCatalogQtyMapFromDraft(cloud);
  const localTime = draftTimestamp(local);
  const cloudTime = draftTimestamp(cloud);
  const newer = localTime >= cloudTime ? local : cloud;
  const older = newer === local ? cloud : local;
  const mergedMap = mergeCatalogQtyMaps(localMap, cloudMap, localTime, cloudTime);
  const accountNo = String(newer.accountNo || older.accountNo || "").trim().toUpperCase();
  const latestTime = Math.max(localTime, cloudTime);

  return normalizeOrderDraft(accountNo, {
    storeName: newer.storeName || older.storeName,
    phone: newer.phone || older.phone,
    note: newer.note || older.note,
    orderEmail: newer.orderEmail || older.orderEmail,
    catalogQtyMap: mergedMap,
    cart: cartItemsFromQtyMap(mergedMap),
    updatedAt: latestTime > 0 ? new Date(latestTime).toISOString() : new Date().toISOString(),
  });
}

/** Cloud save — union with existing draft unless the user explicitly clears. */
export function resolveCloudDraftSave(
  incoming: OrderDraftPayload,
  existing: OrderDraftPayload | null | undefined,
  allowClear: boolean
): "delete" | OrderDraftPayload {
  if (allowClear && countDraftItems(incoming) === 0) {
    return "delete";
  }

  const merged = mergeOrderDrafts(incoming, existing ?? null);
  if (merged) return merged;

  return incoming;
}

export function cloudDraftHasMoreItems(
  current: OrderDraftPayload | null | undefined,
  server: OrderDraftPayload | null | undefined
) {
  return countDraftItems(server) > countDraftItems(current);
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
