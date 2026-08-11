export type DeviceCartSlice = {
  catalogQtyMap: Record<string, string>;
  updatedAt: string;
};

export type OrderDraftPayload = {
  accountNo?: string;
  storeName?: string;
  phone?: string;
  note?: string;
  orderEmail?: string;
  cart?: { sku: string; qty: string }[];
  catalogQtyMap?: Record<string, string>;
  /** Per-browser cart contributions; display qty = sum across devices. */
  deviceCarts?: Record<string, DeviceCartSlice>;
  /** SKU -> removedAt. Suppresses a SKU until a newer device add. */
  removedSkus?: Record<string, string>;
  /** SKU -> first addedAt (ISO). Used by Active Carts. */
  itemAddedAt?: Record<string, string>;
  updatedAt?: string;
};

const LEGACY_DEVICE_ID = "legacy";

function cleanSku(sku: string) {
  return String(sku || "")
    .trim()
    .toUpperCase();
}

function cleanQty(qty: unknown) {
  return String(qty || "")
    .trim()
    .replace(/[^0-9]/g, "");
}

function positiveQtyMap(raw: Record<string, string> | null | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return map;
  for (const [sku, qty] of Object.entries(raw)) {
    const s = cleanSku(sku);
    const q = cleanQty(qty);
    if (s && Number(q) > 0) map[s] = q;
  }
  return map;
}

export function draftTimestamp(draft: { updatedAt?: string } | null | undefined) {
  const parsed = Date.parse(String(draft?.updatedAt || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Single source of truth for legacy drafts: merge `cart[]` with `catalogQtyMap`. */
export function buildCatalogQtyMapFromDraft(
  draft: OrderDraftPayload | null | undefined
): Record<string, string> {
  if (!draft) return {};

  if (draft.deviceCarts && Object.keys(draft.deviceCarts).length > 0) {
    return aggregateDeviceCarts(draft);
  }

  const map: Record<string, string> =
    draft.catalogQtyMap && typeof draft.catalogQtyMap === "object"
      ? { ...draft.catalogQtyMap }
      : {};

  for (const item of draft.cart || []) {
    const sku = cleanSku(item?.sku);
    const qty = cleanQty(item?.qty);
    if (sku && Number(qty) > 0) map[sku] = qty;
  }

  return positiveQtyMap(map);
}

export function cartItemsFromQtyMap(map: Record<string, string>) {
  return Object.entries(map)
    .filter(([, qty]) => Number(qty) > 0)
    .map(([sku, qty]) => ({ sku: sku.toUpperCase(), qty: String(qty) }));
}

export function countDraftItems(draft: OrderDraftPayload | null | undefined) {
  return Object.keys(buildCatalogQtyMapFromDraft(draft)).length;
}

export function normalizeRemovedSkus(
  raw: Record<string, string> | null | undefined
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [sku, at] of Object.entries(raw)) {
    const s = cleanSku(sku);
    const ts = draftTimestamp({ updatedAt: at });
    if (s && ts > 0) out[s] = new Date(ts).toISOString();
  }
  return out;
}

export function normalizeItemAddedAt(
  raw: Record<string, string> | null | undefined
): Record<string, string> {
  return normalizeRemovedSkus(raw);
}

/**
 * Keep first-added timestamps for SKUs still in the cart.
 * New SKUs get `now`; already-present SKUs without a stamp fall back to `fallbackAt`.
 */
export function syncItemAddedAt(options: {
  previousQtyMap: Record<string, string>;
  nextQtyMap: Record<string, string>;
  previousAddedAt?: Record<string, string> | null;
  now: string;
  fallbackAt?: string;
}): Record<string, string> {
  const prevAdded = normalizeItemAddedAt(options.previousAddedAt);
  const fallbackTs = draftTimestamp({ updatedAt: options.fallbackAt });
  const nowIso =
    draftTimestamp({ updatedAt: options.now }) > 0
      ? new Date(draftTimestamp({ updatedAt: options.now })).toISOString()
      : new Date().toISOString();
  const out: Record<string, string> = {};

  for (const sku of Object.keys(options.nextQtyMap)) {
    if (prevAdded[sku]) {
      out[sku] = prevAdded[sku];
      continue;
    }
    if (options.previousQtyMap[sku] && fallbackTs > 0) {
      out[sku] = new Date(fallbackTs).toISOString();
      continue;
    }
    out[sku] = nowIso;
  }
  return out;
}

/** Prefer the earliest known addedAt when merging two drafts. */
export function mergeItemAddedAt(
  a: Record<string, string> | null | undefined,
  b: Record<string, string> | null | undefined
): Record<string, string> {
  const left = normalizeItemAddedAt(a);
  const right = normalizeItemAddedAt(b);
  const out = { ...left };
  for (const [sku, at] of Object.entries(right)) {
    const prev = out[sku];
    if (!prev || draftTimestamp({ updatedAt: at }) < draftTimestamp({ updatedAt: prev })) {
      out[sku] = at;
    }
  }
  return out;
}

/** Best-effort addedAt for Active Carts (explicit stamp, else earliest device slice). */
export function resolveItemAddedAt(
  draft: OrderDraftPayload | null | undefined,
  sku: string
): string {
  if (!draft) return "";
  const target = cleanSku(sku);
  if (!target) return "";
  const stamped = normalizeItemAddedAt(draft.itemAddedAt)[target];
  if (stamped) return stamped;

  let earliest = 0;
  for (const slice of Object.values(normalizeDeviceCarts(draft.deviceCarts))) {
    if (!slice.catalogQtyMap[target]) continue;
    const t = draftTimestamp(slice);
    if (t > 0 && (earliest === 0 || t < earliest)) earliest = t;
  }
  if (earliest > 0) return new Date(earliest).toISOString();
  const draftAt = draftTimestamp(draft);
  return draftAt > 0 ? new Date(draftAt).toISOString() : "";
}

export function normalizeDeviceCarts(
  raw: Record<string, DeviceCartSlice> | null | undefined
): Record<string, DeviceCartSlice> {
  const out: Record<string, DeviceCartSlice> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [deviceId, slice] of Object.entries(raw)) {
    const id = String(deviceId || "").trim();
    if (!id) continue;
    const map = positiveQtyMap(slice?.catalogQtyMap);
    const updatedAt =
      slice?.updatedAt && draftTimestamp(slice) > 0
        ? new Date(draftTimestamp(slice)).toISOString()
        : new Date().toISOString();
    out[id] = { catalogQtyMap: map, updatedAt };
  }
  return out;
}

/** Migrate a legacy flat cart into deviceCarts so old drafts keep working. */
export function ensureDeviceCarts(draft: OrderDraftPayload | null | undefined): OrderDraftPayload | null {
  if (!draft) return null;
  const accountNo = String(draft.accountNo || "").trim().toUpperCase();
  const deviceCarts = normalizeDeviceCarts(draft.deviceCarts);
  const removedSkus = normalizeRemovedSkus(draft.removedSkus);

  if (Object.keys(deviceCarts).length === 0) {
    const legacyMap = positiveQtyMap({
      ...(draft.catalogQtyMap || {}),
      ...Object.fromEntries(
        (draft.cart || []).map((item) => [cleanSku(item.sku), cleanQty(item.qty)])
      ),
    });
    if (Object.keys(legacyMap).length > 0) {
      deviceCarts[LEGACY_DEVICE_ID] = {
        catalogQtyMap: legacyMap,
        updatedAt: draft.updatedAt || new Date().toISOString(),
      };
    }
  }

  const aggregate = aggregateDeviceCarts({ deviceCarts, removedSkus });
  const fallbackAt = draft.updatedAt || new Date().toISOString();
  const itemAddedAt = syncItemAddedAt({
    previousQtyMap: aggregate,
    nextQtyMap: aggregate,
    previousAddedAt: draft.itemAddedAt,
    now: fallbackAt,
    fallbackAt,
  });
  return normalizeOrderDraft(accountNo, {
    ...draft,
    deviceCarts,
    removedSkus,
    itemAddedAt,
    catalogQtyMap: aggregate,
    cart: cartItemsFromQtyMap(aggregate),
  });
}

/**
 * Sum qty across device slices.
 * Tombstoned SKUs stay hidden unless a device updated after the removal.
 */
export function aggregateDeviceCarts(
  draft: Pick<OrderDraftPayload, "deviceCarts" | "removedSkus"> | null | undefined
): Record<string, string> {
  const sums: Record<string, number> = {};
  const removed = normalizeRemovedSkus(draft?.removedSkus);
  const deviceCarts = normalizeDeviceCarts(draft?.deviceCarts);

  for (const slice of Object.values(deviceCarts)) {
    const sliceTime = draftTimestamp(slice);
    for (const [sku, qty] of Object.entries(slice.catalogQtyMap)) {
      const removedAt = removed[sku] ? draftTimestamp({ updatedAt: removed[sku] }) : 0;
      if (removedAt > 0 && sliceTime <= removedAt) continue;
      sums[sku] = (sums[sku] || 0) + Number(qty);
    }
  }

  const out: Record<string, string> = {};
  for (const [sku, qty] of Object.entries(sums)) {
    if (qty > 0) out[sku] = String(qty);
  }
  return out;
}

/** Other devices' combined qty for one SKU (for editing the shared total). */
export function otherDevicesQty(
  draft: OrderDraftPayload | null | undefined,
  deviceId: string,
  sku: string
): number {
  const target = cleanSku(sku);
  const removed = normalizeRemovedSkus(draft?.removedSkus);
  const removedAt = removed[target] ? draftTimestamp({ updatedAt: removed[target] }) : 0;
  let total = 0;
  for (const [id, slice] of Object.entries(normalizeDeviceCarts(draft?.deviceCarts))) {
    if (id === deviceId) continue;
    const sliceTime = draftTimestamp(slice);
    if (removedAt > 0 && sliceTime <= removedAt) continue;
    total += Number(slice.catalogQtyMap[target] || 0);
  }
  return total;
}

/**
 * Convert a desired shared total into this device's contribution.
 * Example: others=1, desiredTotal=2 → this device stores 1 (display 2).
 */
export function deviceQtyForSharedTotal(
  draft: OrderDraftPayload | null | undefined,
  deviceId: string,
  sku: string,
  desiredTotal: number
): number {
  const others = otherDevicesQty(draft, deviceId, sku);
  return Math.max(0, Math.floor(desiredTotal) - others);
}

/**
 * Combine SKU maps for tests / simple LWW helpers.
 * Collaborative carts should use deviceCarts + aggregateDeviceCarts instead.
 */
export function mergeCatalogQtyMaps(
  localMap: Record<string, string>,
  cloudMap: Record<string, string>,
  localTime: number,
  cloudTime: number
): Record<string, string> {
  return localTime >= cloudTime ? { ...localMap } : { ...cloudMap };
}

function mergeRemovedSkus(
  a: Record<string, string> | undefined,
  b: Record<string, string> | undefined
): Record<string, string> {
  const out = normalizeRemovedSkus(a);
  for (const [sku, at] of Object.entries(normalizeRemovedSkus(b))) {
    if (!out[sku] || draftTimestamp({ updatedAt: at }) > draftTimestamp({ updatedAt: out[sku] })) {
      out[sku] = at;
    }
  }
  return out;
}

function mergeDeviceCartMaps(
  a: Record<string, DeviceCartSlice>,
  b: Record<string, DeviceCartSlice>
): Record<string, DeviceCartSlice> {
  const out: Record<string, DeviceCartSlice> = { ...a };
  for (const [id, slice] of Object.entries(b)) {
    const prev = out[id];
    if (!prev || draftTimestamp(slice) >= draftTimestamp(prev)) {
      out[id] = slice;
    }
  }
  return out;
}

/**
 * Merge local + cloud collaborative drafts.
 * Same device id → newer slice wins; different devices → keep both (qtys sum).
 */
export function mergeOrderDrafts(
  local: OrderDraftPayload | null | undefined,
  cloud: OrderDraftPayload | null | undefined
): OrderDraftPayload | null {
  if (!local && !cloud) return null;
  const left = ensureDeviceCarts(local);
  const right = ensureDeviceCarts(cloud);
  if (!left) return right;
  if (!right) return left;

  const newer = draftTimestamp(left) >= draftTimestamp(right) ? left : right;
  const older = newer === left ? right : left;
  const deviceCarts = mergeDeviceCartMaps(
    normalizeDeviceCarts(left.deviceCarts),
    normalizeDeviceCarts(right.deviceCarts)
  );
  const removedSkus = mergeRemovedSkus(left.removedSkus, right.removedSkus);
  const aggregate = aggregateDeviceCarts({ deviceCarts, removedSkus });
  const accountNo = String(newer.accountNo || older.accountNo || "").trim().toUpperCase();
  const latestTime = Math.max(draftTimestamp(left), draftTimestamp(right));
  const updatedAt = latestTime > 0 ? new Date(latestTime).toISOString() : new Date().toISOString();
  const olderTime = Math.min(draftTimestamp(left), draftTimestamp(right));
  const itemAddedAt = syncItemAddedAt({
    previousQtyMap: aggregate,
    nextQtyMap: aggregate,
    previousAddedAt: mergeItemAddedAt(left.itemAddedAt, right.itemAddedAt),
    now: updatedAt,
    fallbackAt: olderTime > 0 ? new Date(olderTime).toISOString() : updatedAt,
  });

  return normalizeOrderDraft(accountNo, {
    storeName: newer.storeName || older.storeName,
    phone: newer.phone || older.phone,
    note: newer.note || older.note,
    orderEmail: newer.orderEmail || older.orderEmail,
    deviceCarts,
    removedSkus,
    itemAddedAt,
    catalogQtyMap: aggregate,
    cart: cartItemsFromQtyMap(aggregate),
    updatedAt,
  });
}

/**
 * Client-side remove: stamp tombstone and scrub the SKU from every device slice
 * so autosave cannot re-aggregate peer leftovers back into the shared cart.
 */
export function markSkuRemovedInDraft(
  draft: OrderDraftPayload | null | undefined,
  sku: string,
  now = new Date().toISOString()
): OrderDraftPayload | null {
  if (!draft) return null;
  const target = cleanSku(sku);
  if (!target) return draft;
  const removedSkus = normalizeRemovedSkus(draft.removedSkus);
  removedSkus[target] = draftTimestamp({ updatedAt: now }) > 0 ? new Date(draftTimestamp({ updatedAt: now })).toISOString() : new Date().toISOString();
  const deviceCarts = normalizeDeviceCarts(draft.deviceCarts);
  for (const slice of Object.values(deviceCarts)) {
    delete slice.catalogQtyMap[target];
  }
  const aggregate = aggregateDeviceCarts({ deviceCarts, removedSkus });
  return normalizeOrderDraft(String(draft.accountNo || "").trim().toUpperCase(), {
    ...draft,
    deviceCarts,
    removedSkus,
    catalogQtyMap: aggregate,
    cart: cartItemsFromQtyMap(aggregate),
    updatedAt: removedSkus[target],
  });
}

/** Client-side re-add: drop the tombstone so the SKU can appear again. */
export function markSkuReaddedInDraft(
  draft: OrderDraftPayload | null | undefined,
  sku: string
): OrderDraftPayload | null {
  if (!draft) return null;
  const target = cleanSku(sku);
  if (!target || !draft.removedSkus?.[target]) return draft;
  const removedSkus = normalizeRemovedSkus(draft.removedSkus);
  delete removedSkus[target];
  return {
    ...draft,
    removedSkus: Object.keys(removedSkus).length > 0 ? removedSkus : undefined,
  };
}

export function resolveCollaborativeCloudSave(options: {
  incoming: OrderDraftPayload;
  existing: OrderDraftPayload | null | undefined;
  allowClear: boolean;
  deviceId?: string;
  deviceQtyMap?: Record<string, string>;
  removedSkus?: Record<string, string>;
  /**
   * Client's intended shared cart (React catalogQtyMap).
   * Prefer this over incoming.catalogQtyMap when present — normalizeOrderDraft
   * recomputes catalogQtyMap from deviceCarts and can hide removals.
   */
  desiredSharedQtyMap?: Record<string, string> | null;
}): "delete" | OrderDraftPayload {
  const { incoming, existing, allowClear } = options;
  const deviceId = String(options.deviceId || "").trim();
  const now = incoming.updatedAt || new Date().toISOString();

  if (!deviceId) {
    return resolveCloudDraftSave(incoming, existing, allowClear);
  }

  const base = ensureDeviceCarts(existing) || normalizeOrderDraft(String(incoming.accountNo || ""), {});
  const deviceCarts = normalizeDeviceCarts(base.deviceCarts);
  let removedSkus = mergeRemovedSkus(base.removedSkus, options.removedSkus);

  const deviceMap = positiveQtyMap(options.deviceQtyMap);
  const hasDesiredShared = options.desiredSharedQtyMap != null;
  const incomingAggregate = hasDesiredShared
    ? positiveQtyMap(options.desiredSharedQtyMap)
    : positiveQtyMap(incoming.catalogQtyMap);
  if (!hasDesiredShared && Object.keys(incomingAggregate).length === 0) {
    for (const item of incoming.cart || []) {
      const sku = cleanSku(item?.sku);
      const qty = cleanQty(item?.qty);
      if (sku && Number(qty) > 0) incomingAggregate[sku] = qty;
    }
  }

  // Empty snapshot before load / beacon race: keep cloud unless explicit clear.
  if (Object.keys(deviceMap).length === 0 && Object.keys(incomingAggregate).length === 0) {
    if (allowClear) return "delete";
    return base;
  }

  // Removals: SKUs missing from the desired shared cart vs previous aggregate.
  const prevAggregate = aggregateDeviceCarts(base);
  for (const sku of Object.keys(prevAggregate)) {
    if (!incomingAggregate[sku]) {
      removedSkus[sku] = now;
      for (const slice of Object.values(deviceCarts)) {
        delete slice.catalogQtyMap[sku];
      }
    }
  }

  // Re-adds: only this device contributing the SKU again clears the tombstone.
  // A stale desiredSharedQtyMap alone must not revive a deleted line.
  for (const sku of Object.keys(deviceMap)) {
    if (incomingAggregate[sku]) delete removedSkus[sku];
  }

  // Drop stale contributions for SKUs the shared cart still considers removed.
  for (const sku of Object.keys(removedSkus)) {
    if (!incomingAggregate[sku]) delete deviceMap[sku];
  }

  deviceCarts[deviceId] = {
    catalogQtyMap: deviceMap,
    updatedAt: now,
  };

  // Drop empty legacy slice noise.
  for (const [id, slice] of Object.entries(deviceCarts)) {
    if (Object.keys(slice.catalogQtyMap).length === 0 && id !== deviceId) {
      delete deviceCarts[id];
    }
  }

  const aggregate = aggregateDeviceCarts({ deviceCarts, removedSkus });
  if (allowClear && Object.keys(aggregate).length === 0) {
    return "delete";
  }

  const itemAddedAt = syncItemAddedAt({
    previousQtyMap: prevAggregate,
    nextQtyMap: aggregate,
    previousAddedAt: mergeItemAddedAt(base.itemAddedAt, incoming.itemAddedAt),
    now,
    fallbackAt: base.updatedAt || now,
  });

  return normalizeOrderDraft(String(incoming.accountNo || base.accountNo || ""), {
    storeName: incoming.storeName || base.storeName,
    phone: incoming.phone || base.phone,
    note: incoming.note ?? base.note,
    orderEmail: incoming.orderEmail || base.orderEmail,
    deviceCarts,
    removedSkus,
    itemAddedAt,
    catalogQtyMap: aggregate,
    cart: cartItemsFromQtyMap(aggregate),
    updatedAt: now,
  });
}

/**
 * Cloud save — last-write-wins for non-collaborative / legacy clients.
 * Prefer resolveCollaborativeCloudSave when deviceId is present.
 */
export function resolveCloudDraftSave(
  incoming: OrderDraftPayload,
  existing: OrderDraftPayload | null | undefined,
  allowClear: boolean
): "delete" | OrderDraftPayload {
  const incomingCount = countDraftItems(incoming);

  if (incomingCount === 0) {
    if (allowClear) return "delete";
    return existing ? { ...existing } : incoming;
  }

  const stampLegacy = (draft: OrderDraftPayload, previous?: OrderDraftPayload | null) => {
    const nextMap = buildCatalogQtyMapFromDraft(draft);
    const prevMap = buildCatalogQtyMapFromDraft(previous);
    const now = draft.updatedAt || new Date().toISOString();
    return normalizeOrderDraft(String(draft.accountNo || ""), {
      ...draft,
      itemAddedAt: syncItemAddedAt({
        previousQtyMap: prevMap,
        nextQtyMap: nextMap,
        previousAddedAt: mergeItemAddedAt(previous?.itemAddedAt, draft.itemAddedAt),
        now,
        fallbackAt: previous?.updatedAt || draft.updatedAt || now,
      }),
    });
  };

  if (!existing || countDraftItems(existing) === 0) {
    return stampLegacy(incoming, existing);
  }

  if (draftTimestamp(incoming) >= draftTimestamp(existing)) {
    return stampLegacy(incoming, existing);
  }

  return { ...existing };
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
  const deviceCarts = normalizeDeviceCarts(raw.deviceCarts);
  const removedSkus = normalizeRemovedSkus(raw.removedSkus);
  const hasDevices = Object.keys(deviceCarts).length > 0;
  const catalogQtyMap = hasDevices
    ? aggregateDeviceCarts({ deviceCarts, removedSkus })
    : positiveQtyMap(
        raw.catalogQtyMap && typeof raw.catalogQtyMap === "object" ? raw.catalogQtyMap : {}
      );
  const stamped = normalizeItemAddedAt(raw.itemAddedAt);
  const itemAddedAt: Record<string, string> = {};
  for (const sku of Object.keys(catalogQtyMap)) {
    if (stamped[sku]) itemAddedAt[sku] = stamped[sku];
  }

  return {
    accountNo,
    storeName: String(raw.storeName || "").trim(),
    phone: String(raw.phone || "").trim(),
    note: String(raw.note || "").trim(),
    orderEmail: String(raw.orderEmail || "").trim(),
    cart: Array.isArray(raw.cart)
      ? raw.cart
          .map((item) => ({
            sku: cleanSku(item?.sku),
            qty: cleanQty(item?.qty),
          }))
          .filter((item) => item.sku && item.qty)
      : cartItemsFromQtyMap(catalogQtyMap),
    catalogQtyMap,
    deviceCarts: hasDevices ? deviceCarts : undefined,
    removedSkus: Object.keys(removedSkus).length > 0 ? removedSkus : undefined,
    itemAddedAt: Object.keys(itemAddedAt).length > 0 ? itemAddedAt : undefined,
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export function getOrCreateOrderDeviceId(): string {
  if (typeof window === "undefined") return LEGACY_DEVICE_ID;
  const key = "order_device_id";
  try {
    const existing = String(localStorage.getItem(key) || "").trim();
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, id);
    return id;
  } catch {
    return `dev_${Date.now()}`;
  }
}
