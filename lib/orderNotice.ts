import { parseSeasonalEtaDate } from "@/lib/seasonalEta";
import { redis } from "@/lib/redis";

export const ORDER_NOTICE_REDIS_KEY = "orderNotice:current";
export const ORDER_NOTICE_AUTO_CLOSE_MS = 20_000;
export const ORDER_NOTICE_TITLE_MAX = 120;
export const ORDER_NOTICE_BODY_MAX = 4000;
export const ORDER_NOTICE_TZ = "America/New_York";
export const ORDER_NOTICE_LANGS = ["en", "zh", "ko", "vi"] as const;

export type OrderNoticeLang = (typeof ORDER_NOTICE_LANGS)[number];

export type OrderNoticeCopy = {
  title: string;
  body: string;
};

export type OrderNoticeTranslations = Record<OrderNoticeLang, OrderNoticeCopy>;

export type OrderNoticeRecord = {
  translations: OrderNoticeTranslations;
  enabled: boolean;
  /** Hide from customers starting this YYYY-MM-DD (US Eastern). */
  hideOnDate?: string;
  updatedAt: number;
};

export type PublicOrderNotice = {
  translations: OrderNoticeTranslations;
  updatedAt: number;
};

function clip(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function emptyCopy(): OrderNoticeCopy {
  return { title: "", body: "" };
}

export function emptyTranslations(): OrderNoticeTranslations {
  return {
    en: emptyCopy(),
    zh: emptyCopy(),
    ko: emptyCopy(),
    vi: emptyCopy(),
  };
}

function readCopy(raw: unknown, fallback?: { title?: unknown; body?: unknown }): OrderNoticeCopy {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    title: clip(row.title ?? fallback?.title, ORDER_NOTICE_TITLE_MAX),
    body: clip(row.body ?? fallback?.body, ORDER_NOTICE_BODY_MAX),
  };
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

export function hasNoticeBody(translations: OrderNoticeTranslations): boolean {
  return ORDER_NOTICE_LANGS.some((lang) => Boolean(translations[lang].body.trim()));
}

export function pickNoticeCopy(
  translations: OrderNoticeTranslations,
  lang: string
): OrderNoticeCopy | null {
  const order: OrderNoticeLang[] = [
    ORDER_NOTICE_LANGS.includes(lang as OrderNoticeLang) ? (lang as OrderNoticeLang) : "en",
    "en",
    "zh",
    "ko",
    "vi",
  ];
  const seen = new Set<OrderNoticeLang>();
  for (const item of order) {
    if (seen.has(item)) continue;
    seen.add(item);
    const copy = translations[item];
    if (copy?.body.trim()) return copy;
  }
  return null;
}

export function normalizeOrderNotice(raw: unknown): OrderNoticeRecord {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const nested =
    row.translations && typeof row.translations === "object"
      ? (row.translations as Record<string, unknown>)
      : {};
  const translations: OrderNoticeTranslations = {
    en: readCopy(nested.en, { title: row.title, body: row.body }),
    zh: readCopy(nested.zh),
    ko: readCopy(nested.ko),
    vi: readCopy(nested.vi),
  };
  const updatedAt = Number(row.updatedAt);
  const hideOnDate = parseSeasonalEtaDate(row.hideOnDate);
  return {
    translations,
    enabled: row.enabled !== false && hasNoticeBody(translations),
    hideOnDate,
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now(),
  };
}

export function emptyOrderNotice(): OrderNoticeRecord {
  return { translations: emptyTranslations(), enabled: false, updatedAt: 0 };
}

export function toPublicOrderNotice(
  record: OrderNoticeRecord | null | undefined,
  now = new Date()
): PublicOrderNotice | null {
  if (!record?.enabled) return null;
  if (isOrderNoticeExpired(record.hideOnDate, now)) return null;
  if (!hasNoticeBody(record.translations)) return null;
  return {
    translations: record.translations,
    updatedAt: record.updatedAt,
  };
}

export async function getOrderNoticeRecord(): Promise<OrderNoticeRecord> {
  const raw = await redis.get<unknown>(ORDER_NOTICE_REDIS_KEY);
  if (!raw) return emptyOrderNotice();
  return normalizeOrderNotice(raw);
}

export async function saveOrderNoticeRecord(input: {
  translations?: Partial<Record<OrderNoticeLang, Partial<OrderNoticeCopy>>>;
  title?: string;
  body?: string;
  enabled?: boolean;
  hideOnDate?: string | null;
}): Promise<OrderNoticeRecord> {
  const next = normalizeOrderNotice({
    translations: input.translations,
    title: input.title,
    body: input.body,
    enabled: input.enabled,
    hideOnDate: input.hideOnDate,
    updatedAt: Date.now(),
  });
  if (!hasNoticeBody(next.translations)) {
    next.enabled = false;
  }
  await redis.set(ORDER_NOTICE_REDIS_KEY, next);
  return next;
}

export async function getPublicOrderNotice(now = new Date()): Promise<PublicOrderNotice | null> {
  const record = await getOrderNoticeRecord();
  return toPublicOrderNotice(record, now);
}
