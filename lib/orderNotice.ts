import { redis } from "@/lib/redis";

export const ORDER_NOTICE_REDIS_KEY = "orderNotice:current";
export const ORDER_NOTICE_AUTO_CLOSE_MS = 20_000;
export const ORDER_NOTICE_TITLE_MAX = 120;
export const ORDER_NOTICE_BODY_MAX = 4000;

export type OrderNoticeRecord = {
  title: string;
  body: string;
  enabled: boolean;
  updatedAt: number;
};

export type PublicOrderNotice = {
  title: string;
  body: string;
  updatedAt: number;
};

function clip(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export function normalizeOrderNotice(raw: unknown): OrderNoticeRecord {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const updatedAt = Number(row.updatedAt);
  return {
    title: clip(row.title, ORDER_NOTICE_TITLE_MAX),
    body: clip(row.body, ORDER_NOTICE_BODY_MAX),
    enabled: row.enabled !== false && Boolean(clip(row.body, ORDER_NOTICE_BODY_MAX)),
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now(),
  };
}

export function emptyOrderNotice(): OrderNoticeRecord {
  return { title: "", body: "", enabled: false, updatedAt: 0 };
}

export function toPublicOrderNotice(record: OrderNoticeRecord | null | undefined): PublicOrderNotice | null {
  if (!record?.enabled) return null;
  const body = String(record.body || "").trim();
  if (!body) return null;
  return {
    title: String(record.title || "").trim(),
    body,
    updatedAt: record.updatedAt,
  };
}

export async function getOrderNoticeRecord(): Promise<OrderNoticeRecord> {
  const raw = await redis.get<unknown>(ORDER_NOTICE_REDIS_KEY);
  if (!raw) return emptyOrderNotice();
  return normalizeOrderNotice(raw);
}

export async function saveOrderNoticeRecord(input: {
  title?: string;
  body?: string;
  enabled?: boolean;
}): Promise<OrderNoticeRecord> {
  const next = normalizeOrderNotice({
    title: input.title,
    body: input.body,
    enabled: input.enabled,
    updatedAt: Date.now(),
  });
  if (!String(next.body || "").trim()) {
    next.enabled = false;
  }
  await redis.set(ORDER_NOTICE_REDIS_KEY, next);
  return next;
}

export async function getPublicOrderNotice(): Promise<PublicOrderNotice | null> {
  const record = await getOrderNoticeRecord();
  return toPublicOrderNotice(record);
}
