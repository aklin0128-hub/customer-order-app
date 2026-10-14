import { indexOrderHistoryAccount, listOrderHistoryAccounts } from "@/lib/redisIndexes";
import { redis } from "@/lib/redis";

const MGET_CHUNK = 100;

export type OrderHistoryEntry = {
  accountNo: string;
  storeName: string;
  orderRef: string;
  items: { sku: string; qty: string; unitPrice?: number }[];
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
  await indexOrderHistoryAccount(accountNo);
}

/** Batch-load order histories (1 MGET per chunk, not 1 GET per account). */
export async function loadAllOrderHistories(): Promise<
  { accountNo: string; entries: OrderHistoryEntry[] }[]
> {
  const accounts = await listOrderHistoryAccounts();
  if (!accounts.length) return [];

  const results: { accountNo: string; entries: OrderHistoryEntry[] }[] = [];

  for (let i = 0; i < accounts.length; i += MGET_CHUNK) {
    const chunk = accounts.slice(i, i + MGET_CHUNK);
    const keys = chunk.map((accountNo) => `orderHistory:${accountNo}`);
    const rows = (await redis.mget<(OrderHistoryEntry[] | null)[]>(...keys)) || [];

    for (let j = 0; j < chunk.length; j += 1) {
      results.push({
        accountNo: chunk[j],
        entries: rows[j] || [],
      });
    }
  }

  return results;
}
