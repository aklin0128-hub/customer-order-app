import { resolveCustomerOrderEmail } from "@/lib/customerOrderEmail";
import { normalizeMarketRegion, type MarketRegionId } from "@/lib/customerRegion";
import { loadCustomers } from "@/lib/loadCustomers";
import { bustAnalyticsCache } from "@/lib/analyticsCache";
import { indexCustomerAccount, listRedisCustomerAccounts, unindexCustomerAccount } from "@/lib/redisIndexes";
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
  /** When true, order UI shows SKU prices from this account's latest invoice imports. */
  invoicePricing?: boolean;
  updatedAt?: string;
  /** local = from data/customers.csv only; redis = stored or overridden in Redis */
  source: "local" | "redis";
  /** True when account still has a row in data/customers.csv */
  csvBacked?: boolean;
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
      invoicePricing: redisCustomer.invoicePricing === true,
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
    invoicePricing: existing.invoicePricing === true,
    updatedAt: new Date().toISOString(),
    source: "redis",
  });
  await indexCustomerAccount(acct);

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
      csvBacked: true,
    });
  }

  const accounts = await listRedisCustomerAccounts();
  for (const accountNo of accounts) {
    const item = await redis.get<Partial<CustomerRecord>>(`customer:${accountNo}`);
    if (!item) continue;

    const acctNorm = normalizeAccountNo(item?.accountNo || accountNo);
    const local = map.get(acctNorm);

    map.set(acctNorm, {
      accountNo: acctNorm,
      storeName: String(item.storeName || local?.storeName || "").trim(),
      password: String(item.password ?? local?.password ?? "").trim(),
      active: item.active !== false,
      email: String(item.email || "").trim() || undefined,
      phone: String(item.phone || "").trim() || undefined,
      note: String(item.note || "").trim() || undefined,
      region: normalizeMarketRegion(item.region),
      invoicePricing: item.invoicePricing === true,
      updatedAt: String(item.updatedAt || "").trim() || undefined,
      source: "redis",
      csvBacked: Boolean(local),
    });
  }

  return Array.from(map.values()).sort((a, b) => a.accountNo.localeCompare(b.accountNo));
}

/** Block login. CSV-backed accounts stay in the file; Redis-only accounts are removed. */
export async function removeCustomerAccess(accountNo: string) {
  const acct = normalizeAccountNo(accountNo);
  if (!acct) throw new Error("Missing account number.");

  const local = loadCustomers().find((c) => normalizeAccountNo(c.accountNo) === acct);
  const existingRedis = await redis.get<Partial<CustomerRecord>>(`customer:${acct}`);

  if (!local && !existingRedis) {
    throw new Error("Customer not found.");
  }

  if (local) {
    await redis.set(`customer:${acct}`, {
      accountNo: acct,
      storeName: String(existingRedis?.storeName || local.storeName || "").trim(),
      password: String(existingRedis?.password ?? local.password ?? "").trim(),
      active: false,
      email: String(existingRedis?.email || "").trim() || undefined,
      phone: String(existingRedis?.phone || "").trim() || undefined,
      note: String(existingRedis?.note || "").trim() || "Disabled in admin (CSV account)",
      invoicePricing: existingRedis?.invoicePricing === true,
      updatedAt: new Date().toISOString(),
      source: "redis",
    });
    await indexCustomerAccount(acct);
    bustAnalyticsCache();
    return { mode: "disabled" as const, accountNo: acct };
  }

  await redis.del(`customer:${acct}`);
  await unindexCustomerAccount(acct);
  bustAnalyticsCache();
  return { mode: "deleted" as const, accountNo: acct };
}
