import { parseSeasonalEtaDate } from "@/lib/seasonalEta";
import { redis } from "@/lib/redis";

export const ORDER_NOTICE_REDIS_KEY = "orderNotice:current";
export const ORDER_NOTICE_AUTO_CLOSE_MS = 20_000;
export const ORDER_NOTICE_TITLE_MAX = 120;
export const ORDER_NOTICE_BODY_MAX = 4000;
export const ORDER_NOTICE_MAX_ITEMS = 20;
export const ORDER_NOTICE_TZ = "America/New_York";

export type OrderNoticeItem = {
  name: string;
  note: string;
  hideOnDate?: string;
};

export type OrderNoticeRecord = {
  heading: string;
  items: OrderNoticeItem[];
  enabled: boolean;
  updatedAt: number;
};

export type PublicOrderNoticeItem = {
  name: string;
  note: string;
};

export type PublicOrderNotice = {
  heading: string;
  items: PublicOrderNoticeItem[];
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
  const candidates = [
    copyFrom({ title: row.title, body: row.body }),
    copyFrom(nested.en),
    copyFrom(nested.zh),
    copyFrom(nested.ko),
    copyFrom(nested.vi),
  ];
  return candidates.find((item) => item.body || item.title) || candidates[0];
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

export function emptyNoticeItem(): OrderNoticeItem {
  return { name: "", note: "" };
}

export function normalizeNoticeItem(raw: unknown): OrderNoticeItem | null {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const name = clip(row.name ?? row.title, ORDER_NOTICE_TITLE_MAX);
  const note = clip(row.note ?? row.body, ORDER_NOTICE_BODY_MAX);
  const hideOnDate = parseSeasonalEtaDate(row.hideOnDate);
  if (!name && !note) return null;
  return hideOnDate ? { name, note, hideOnDate } : { name, note };
}

export function hasNoticeItemText(item: OrderNoticeItem): boolean {
  return Boolean(item.name.trim() || item.note.trim());
}

export function visibleNoticeItems(items: OrderNoticeItem[], now = new Date()): PublicOrderNoticeItem[] {
  return items
    .filter((item) => hasNoticeItemText(item) && !isOrderNoticeExpired(item.hideOnDate, now))
    .map((item) => ({ name: item.name, note: item.note }));
}

function migrateLegacyItems(row: Record<string, unknown>): unknown[] {
  if (Array.isArray(row.items)) return row.items;
  const copy = firstFilledCopy(row);
  if (!copy.title && !copy.body) return [];
  return [
    {
      name: copy.title,
      note: copy.body,
      hideOnDate: row.hideOnDate,
    },
  ];
}

export function normalizeOrderNotice(raw: unknown): OrderNoticeRecord {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const items = migrateLegacyItems(row)
    .map(normalizeNoticeItem)
    .filter((item): item is OrderNoticeItem => Boolean(item))
    .slice(0, ORDER_NOTICE_MAX_ITEMS);
  const updatedAt = Number(row.updatedAt);
  return {
    heading: clip(row.heading, ORDER_NOTICE_TITLE_MAX),
    items,
    enabled: row.enabled !== false && items.some(hasNoticeItemText),
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now(),
  };
}

export function emptyOrderNotice(): OrderNoticeRecord {
  return { heading: "", items: [], enabled: false, updatedAt: 0 };
}

export function toPublicOrderNotice(
  record: OrderNoticeRecord | null | undefined,
  now = new Date()
): PublicOrderNotice | null {
  if (!record?.enabled) return null;
  const items = visibleNoticeItems(record.items, now);
  if (items.length === 0) return null;
  return {
    heading: String(record.heading || "").trim(),
    items,
    updatedAt: record.updatedAt,
  };
}

export async function getOrderNoticeRecord(): Promise<OrderNoticeRecord> {
  const raw = await redis.get<unknown>(ORDER_NOTICE_REDIS_KEY);
  if (!raw) return emptyOrderNotice();
  return normalizeOrderNotice(raw);
}

export async function saveOrderNoticeRecord(input: {
  heading?: string;
  items?: unknown[];
  enabled?: boolean;
}): Promise<OrderNoticeRecord> {
  const next = normalizeOrderNotice({
    heading: input.heading,
    items: input.items,
    enabled: input.enabled,
    updatedAt: Date.now(),
  });
  if (!next.items.some(hasNoticeItemText)) {
    next.enabled = false;
  }
  await redis.set(ORDER_NOTICE_REDIS_KEY, next);
  return next;
}

export async function getPublicOrderNotice(now = new Date()): Promise<PublicOrderNotice | null> {
  const record = await getOrderNoticeRecord();
  return toPublicOrderNotice(record, now);
}
