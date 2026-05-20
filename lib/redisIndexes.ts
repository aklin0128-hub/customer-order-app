import { normalizeAccountNo } from "@/lib/customers";
import { redis } from "@/lib/redis";

export const REDIS_INDEX = {
  orderHistory: "index:orderHistory:accounts",
  draft: "index:draft:accounts",
  customer: "index:customer:accounts",
} as const;

async function rebuildFromKeys(
  pattern: string,
  prefix: string,
  indexKey: string
): Promise<string[]> {
  const keys = await redis.keys(pattern);
  const accounts: string[] = [];
  for (const key of keys) {
    const acct = normalizeAccountNo(key.slice(prefix.length));
    if (!acct) continue;
    accounts.push(acct);
    await redis.sadd(indexKey, acct);
  }
  return accounts;
}

async function rebuildDraftIndex(): Promise<string[]> {
  const keys = await redis.keys("draft:*");
  const accounts: string[] = [];
  for (const key of keys) {
    const acct = normalizeAccountNo(key.replace(/^draft:/, ""));
    if (!acct) continue;
    accounts.push(acct);
    await redis.sadd(REDIS_INDEX.draft, acct);
  }
  return accounts;
}

async function rebuildCustomerIndex(): Promise<string[]> {
  const keys = await redis.keys("customer:*");
  const accounts: string[] = [];
  for (const key of keys) {
    const acct = normalizeAccountNo(key.replace(/^customer:/, ""));
    if (!acct) continue;
    accounts.push(acct);
    await redis.sadd(REDIS_INDEX.customer, acct);
  }
  return accounts;
}

export async function indexOrderHistoryAccount(accountNo: string) {
  const acct = normalizeAccountNo(accountNo);
  if (!acct) return;
  await redis.sadd(REDIS_INDEX.orderHistory, acct);
}

export async function indexDraftAccount(accountNo: string) {
  const acct = normalizeAccountNo(accountNo);
  if (!acct) return;
  await redis.sadd(REDIS_INDEX.draft, acct);
}

export async function unindexDraftAccount(accountNo: string) {
  const acct = normalizeAccountNo(accountNo);
  if (!acct) return;
  await redis.srem(REDIS_INDEX.draft, acct);
}

export async function indexCustomerAccount(accountNo: string) {
  const acct = normalizeAccountNo(accountNo);
  if (!acct) return;
  await redis.sadd(REDIS_INDEX.customer, acct);
}

export async function unindexCustomerAccount(accountNo: string) {
  const acct = normalizeAccountNo(accountNo);
  if (!acct) return;
  await redis.srem(REDIS_INDEX.customer, acct);
}

export async function listOrderHistoryAccounts(): Promise<string[]> {
  let members = (await redis.smembers<string[]>(REDIS_INDEX.orderHistory)) || [];
  if (!members.length) {
    members = await rebuildFromKeys("orderHistory:*", "orderHistory:", REDIS_INDEX.orderHistory);
  }
  return [...new Set(members.map((a) => normalizeAccountNo(a)).filter(Boolean))].sort();
}

export async function listDraftAccounts(): Promise<string[]> {
  let members = (await redis.smembers<string[]>(REDIS_INDEX.draft)) || [];
  if (!members.length) {
    members = await rebuildDraftIndex();
  }
  return [...new Set(members.map((a) => normalizeAccountNo(a)).filter(Boolean))].sort();
}

export async function listRedisCustomerAccounts(): Promise<string[]> {
  let members = (await redis.smembers<string[]>(REDIS_INDEX.customer)) || [];
  if (!members.length) {
    members = await rebuildCustomerIndex();
  }
  return [...new Set(members.map((a) => normalizeAccountNo(a)).filter(Boolean))].sort();
}
