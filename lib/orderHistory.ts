import { redis } from "@/lib/redis";

export type OrderHistoryEntry = {
  accountNo: string;
  storeName: string;
  orderRef: string;
  items: { sku: string; qty: string }[];
  note?: string;
  phone?: string;
  createdAt: string;
  /** @optional set for non-customer submits (e.g. invoice import). */
  source?: string;
  invoiceBlobUrl?: string;
};

/** Prepend an order snapshot; keeps last 20 per account (matches /api/send-order behaviour). */
export async function prependOrderHistory(entry: OrderHistoryEntry) {
  const accountNo = String(entry.accountNo || "").trim().toUpperCase();
  if (!accountNo) return;

  const order = {
    accountNo,
    storeName: String(entry.storeName || "").trim(),
    orderRef: String(entry.orderRef || "").trim(),
    items: Array.isArray(entry.items) ? entry.items : [],
    note: entry.note || "",
    phone: entry.phone || "",
    createdAt: entry.createdAt || new Date().toISOString(),
    ...(entry.source ? { source: entry.source } : {}),
    ...(entry.invoiceBlobUrl ? { invoiceBlobUrl: entry.invoiceBlobUrl } : {}),
  };

  const current = (await redis.get<OrderHistoryEntry[]>(`orderHistory:${accountNo}`)) || [];
  const next = [order, ...current].slice(0, 20);

  await redis.set(`orderHistory:${accountNo}`, next);
}
