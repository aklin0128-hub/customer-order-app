export type PendingOrderMode = "promotion" | "newItems" | "catalog" | "search" | "clearance";

export type PendingOrderLine = {
  sku: string;
  qty?: string;
};

export type PendingOrderIntent = {
  skus: PendingOrderLine[];
  mode?: PendingOrderMode;
  createdAt: string;
};

const KEY = "pending_order_intent";
const MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24h

function cleanSku(sku: string) {
  return String(sku || "")
    .trim()
    .toUpperCase();
}

function cleanQty(qty?: string) {
  const q = String(qty || "1")
    .trim()
    .replace(/[^0-9]/g, "");
  return q && Number(q) > 0 ? q : "1";
}

function getStorage(): Storage | null {
  try {
    const store = (globalThis as { localStorage?: Storage }).localStorage;
    if (store && typeof store.getItem === "function") return store;
  } catch {
    /* private mode / unavailable */
  }
  return null;
}

export function readPendingOrderIntent(): PendingOrderIntent | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingOrderIntent;
    const created = Date.parse(String(parsed?.createdAt || ""));
    if (!Number.isFinite(created) || Date.now() - created > MAX_AGE_MS) {
      storage.removeItem(KEY);
      return null;
    }
    const skus = (Array.isArray(parsed.skus) ? parsed.skus : [])
      .map((line) => ({
        sku: cleanSku(line?.sku),
        qty: cleanQty(line?.qty),
      }))
      .filter((line) => line.sku);
    if (skus.length === 0) {
      storage.removeItem(KEY);
      return null;
    }
    return {
      skus,
      mode: parsed.mode,
      createdAt: new Date(created).toISOString(),
    };
  } catch {
    return null;
  }
}

export function savePendingOrderIntent(intent: {
  skus: PendingOrderLine[];
  mode?: PendingOrderMode;
}): PendingOrderIntent | null {
  const storage = getStorage();
  if (!storage) return null;
  const skus = (intent.skus || [])
    .map((line) => ({
      sku: cleanSku(line?.sku),
      qty: cleanQty(line?.qty),
    }))
    .filter((line) => line.sku);
  if (skus.length === 0) return null;
  const payload: PendingOrderIntent = {
    skus,
    mode: intent.mode,
    createdAt: new Date().toISOString(),
  };
  storage.setItem(KEY, JSON.stringify(payload));
  return payload;
}

/** Queue one SKU for add-to-cart after sign-in / order page load. */
export function queuePendingOrderSku(
  sku: string,
  options?: { qty?: string; mode?: PendingOrderMode }
): PendingOrderIntent | null {
  const existing = readPendingOrderIntent();
  const nextSku = cleanSku(sku);
  if (!nextSku) return existing;
  const qty = cleanQty(options?.qty);
  const skus = [...(existing?.skus || [])];
  const idx = skus.findIndex((line) => line.sku === nextSku);
  if (idx >= 0) {
    skus[idx] = {
      sku: nextSku,
      qty: String(Number(skus[idx]?.qty || 0) + Number(qty)),
    };
  } else {
    skus.push({ sku: nextSku, qty });
  }
  return savePendingOrderIntent({
    skus,
    mode: options?.mode || existing?.mode,
  });
}

export function clearPendingOrderIntent() {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(KEY);
}

export function consumePendingOrderIntent(): PendingOrderIntent | null {
  const intent = readPendingOrderIntent();
  if (intent) clearPendingOrderIntent();
  return intent;
}
