import { resolveCustomerOrderEmail } from "@/lib/customerOrderEmail";
import { normalizeMarketRegion, type MarketRegionId } from "@/lib/customerRegion";
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
  /** Miami, Orlando, Melbourne, or Jacksonville — for market reporting. */
  region?: MarketRegionId;
  updatedAt?: string;
  /** local = from data/customers.csv only; redis = stored or overridden in Redis */
  source: "local" | "redis";
};

export function normalizeAccountNo(accountNo: string) {
  return String(accountNo || "").trim().toUpperCase();
}

export async function getCustomerByAccount(accountNo: string): Promise<CustomerRecord | null> {
  const acct = normalizeAccountNo(accountNo);
  if (!acct) return null;

  const local = loadCustomers().find((row) => normalizeAccountNo(row.accountNo) === acct);
  const redisCustomer = await redis.get<Partial<CustomerRecord>>(`customer:${acct}`);

  if (redisCustomer?.accountNo) {
    return {
      accountNo: acct,
      storeName: String(redisCustomer.storeName || local?.storeName || "").trim(),
      password: String(redisCustomer.password ?? local?.password ?? "").trim(),
      active: redisCustomer.active !== false,
      email: String(redisCustomer.email || "").trim() || undefined,
      phone: String(redisCustomer.phone || "").trim() || undefined,
      note: String(redisCustomer.note || "").trim() || undefined,
      region: normalizeMarketRegion(redisCustomer.region),
      updatedAt: String(redisCustomer.updatedAt || "").trim() || undefined,
      source: "redis",
    };
  }

  if (!local) return null;

  return {
    accountNo: acct,
    storeName: local.storeName || "",
    password: local.password || "",
    active: local.active,
    source: "local",
  };
}

export async function upsertCustomerContact(
  accountNo: string,
  patch: { email?: string; phone?: string }
) {
  const acct = normalizeAccountNo(accountNo);
  if (!acct) throw new Error("Missing account number.");

  const existing = await getCustomerByAccount(acct);
  if (!existing) throw new Error("Customer not found.");
  if (!existing.active) throw new Error("Account inactive.");

  const nextEmail =
    patch.email !== undefined ? patch.email.trim() || undefined : existing.email;
  const nextPhone =
    patch.phone !== undefined ? patch.phone.trim() || undefined : existing.phone;

  await redis.set(`customer:${acct}`, {
    accountNo: acct,
    storeName: existing.storeName,
    password: existing.password,
    active: existing.active,
    email: nextEmail,
    phone: nextPhone,
    note: existing.note,
    region: existing.region,
    updatedAt: new Date().toISOString(),
    source: "redis",
  });

  return {
    orderEmail: resolveCustomerOrderEmail(nextEmail),
    email: nextEmail,
    phone: nextPhone,
  };
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
      region: normalizeMarketRegion(item.region),
      updatedAt: String(item.updatedAt || "").trim() || undefined,
      source: "redis",
    });
  }

  return Array.from(map.values()).sort((a, b) => a.accountNo.localeCompare(b.accountNo));
}
