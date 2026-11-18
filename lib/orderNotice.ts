import { parseSeasonalEtaDate } from "@/lib/seasonalEta";
import { redis } from "@/lib/redis";

export const ORDER_NOTICE_REDIS_KEY = "orderNotice:current";
export const ORDER_NOTICE_AUTO_CLOSE_MS = 20_000;
export const ORDER_NOTICE_TITLE_MAX = 120;
export const ORDER_NOTICE_BODY_MAX = 4000;
export const ORDER_NOTICE_TZ = "America/New_York";

export type OrderNoticeRecord = {
  title: string;
  body: string;
  enabled: boolean;
  /** Hide from customers starting this YYYY-MM-DD (US Eastern). */
  hideOnDate?: string;
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

function copyFrom(raw: unknown): { title: string; body: string } {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    title: clip(row.title, ORDER_NOTICE_TITLE_MAX),
    body: clip(row.body, ORDER_NOTICE_BODY_MAX),
  };
}

function firstFilledCopy(row: Record<string, unknown>): { title: string; body: string } {
  const nested =
    row.translations && typeof row.translations === "object"
      ? (row.translations as Record<string, unknown>)
      : {};
  const candidates = [copyFrom({ title: row.title, body: row.body }), copyFrom(nested.en), copyFrom(nested.zh), copyFrom(nested.ko), copyFrom(nested.vi)];
  return candidates.find((item) => item.body) || candidates[0];
}

export function formatEasternDateYmd(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ORDER_NOTICE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isOrderNoticeExpired(hideOnDate?: string | null, now = new Date()): boolean {
  const day = parseSeasonalEtaDate(hideOnDate);
  if (!day) return false;
  return formatEasternDateYmd(now) >= day;
}

export function normalizeOrderNotice(raw: unknown): OrderNoticeRecord {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const copy = firstFilledCopy(row);
  const updatedAt = Number(row.updatedAt);
  const hideOnDate = parseSeasonalEtaDate(row.hideOnDate);
  return {
    title: copy.title,
    body: copy.body,
    enabled: row.enabled !== false && Boolean(copy.body),
    hideOnDate,
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now(),
  };
}

export function emptyOrderNotice(): OrderNoticeRecord {
  return { title: "", body: "", enabled: false, updatedAt: 0 };
}

export function toPublicOrderNotice(
  record: OrderNoticeRecord | null | undefined,
  now = new Date()
): PublicOrderNotice | null {
  if (!record?.enabled) return null;
  if (isOrderNoticeExpired(record.hideOnDate, now)) return null;
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
  hideOnDate?: string | null;
}): Promise<OrderNoticeRecord> {
  const next = normalizeOrderNotice({
    title: input.title,
    body: input.body,
    enabled: input.enabled,
    hideOnDate: input.hideOnDate,
    updatedAt: Date.now(),
  });
  if (!String(next.body || "").trim()) {
    next.enabled = false;
  }
  await redis.set(ORDER_NOTICE_REDIS_KEY, next);
  return next;
}

export async function getPublicOrderNotice(now = new Date()): Promise<PublicOrderNotice | null> {
  const record = await getOrderNoticeRecord();
  return toPublicOrderNotice(record, now);
}
