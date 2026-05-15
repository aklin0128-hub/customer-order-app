import { loadCustomers } from "@/lib/loadCustomers";
import { redis } from "@/lib/redis";

export type CustomerRecord = {
  accountNo: string;
  storeName: string;
  password: string;
  active: boolean;
  email?: string;
  phone?: string;
  note?: string;
  updatedAt?: string;
  /** local = from data/customers.csv only; redis = stored or overridden in Redis */
  source: "local" | "redis";
};

export function normalizeAccountNo(accountNo: string) {
  return String(accountNo || "").trim().toUpperCase();
}

export async function getAllCustomers(): Promise<CustomerRecord[]> {
  const map = new Map<string, CustomerRecord>();

  for (const row of loadCustomers()) {
    const accountNo = normalizeAccountNo(row.accountNo);
    if (!accountNo) continue;

    map.set(accountNo, {
      accountNo,
      storeName: row.storeName || "",
      password: row.password || "",
      active: row.active,
      source: "local",
    });
  }

  const keys = await redis.keys("customer:*");
  for (const key of keys) {
    const item = await redis.get<Partial<CustomerRecord>>(key);
    if (!item?.accountNo) continue;

    const accountNo = normalizeAccountNo(item.accountNo);
    const local = map.get(accountNo);

    map.set(accountNo, {
      accountNo,
      storeName: String(item.storeName || local?.storeName || "").trim(),
      password: String(item.password ?? local?.password ?? "").trim(),
      active: item.active !== false,
      email: String(item.email || "").trim() || undefined,
      phone: String(item.phone || "").trim() || undefined,
      note: String(item.note || "").trim() || undefined,
      updatedAt: String(item.updatedAt || "").trim() || undefined,
      source: "redis",
    });
  }

  return Array.from(map.values()).sort((a, b) => a.accountNo.localeCompare(b.accountNo));
}
