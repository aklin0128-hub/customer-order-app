import { redis } from "@/lib/redis";
import {
  daysUntilExpiry,
  formatClearancePriceDisplay,
  getClearanceProducts,
  getClearanceRemainingQty,
  getClearanceStatus,
  isClearanceVisibleToCustomers,
  type ClearanceProduct,
  type ClearanceRecord,
} from "@/lib/clearance";
import { ndhListingKey } from "@/lib/ndhListParse";

export { ndhListingKey, parseNdhListingKey } from "@/lib/ndhListParse";

export const NDH_KEY = "ndh:list";
export const NDH_ORDER_EMAIL_TAG = "NDH";

export type NdhRecord = ClearanceRecord & {
  description?: string;
};

export type NdhProduct = ClearanceProduct & {
  description?: string;
};

function parseDateOnly(value?: string) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parsePositiveInt(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(String(value).replace(/[^0-9]/g, ""));
  if (!Number.isFinite(num) || num <= 0) return undefined;
  return Math.floor(num);
}

export function normalizeNdhRecord(entry: unknown): NdhRecord | null {
  if (!entry || typeof entry !== "object") return null;
  const raw = entry as Record<string, unknown>;
  const sku = String(raw.sku || "")
    .trim()
    .toUpperCase();
  if (!sku) return null;

  const expiryDate = String(raw.expiryDate || "").trim();
  if (!expiryDate || !parseDateOnly(expiryDate)) return null;

  const startDate = String(raw.startDate || "").trim() || undefined;
  const saleEndDate = String(raw.saleEndDate || "").trim() || undefined;
  const clearanceQty = parsePositiveInt(raw.clearanceQty);
  const soldQty = parsePositiveInt(raw.soldQty) ?? 0;
  const description = String(raw.description || "").trim() || undefined;
  const note = String(raw.note || "").trim() || undefined;
  const clearancePrice = String(raw.clearancePrice || "").trim();

  return {
    sku,
    description,
    note,
    expiryDate,
    clearancePrice,
    startDate,
    saleEndDate,
    clearanceQty,
    soldQty,
    updatedAt: String(raw.updatedAt || "").trim() || undefined,
  };
}

export async function getNdhRecords(): Promise<NdhRecord[]> {
  const raw = await redis.get<unknown[]>(NDH_KEY);
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const list: NdhRecord[] = [];

  for (const entry of raw) {
    const record = normalizeNdhRecord(entry);
    if (!record) continue;
    const key = ndhListingKey(record.sku, record.expiryDate);
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(record);
  }

  return list;
}

export async function saveNdhRecords(records: NdhRecord[]) {
  await redis.set(NDH_KEY, records);
}

export async function getNdhProducts(options?: {
  activeOnly?: boolean;
  records?: NdhRecord[];
}): Promise<NdhProduct[]> {
  const records = options?.records || (await getNdhRecords());
  const visible = options?.activeOnly
    ? records.filter((record) => isClearanceVisibleToCustomers(record))
    : records;

  const fromCatalog = await getClearanceProducts({
    activeOnly: options?.activeOnly,
    records: visible,
  });

  const byKey = new Map<string, NdhProduct>();
  for (const product of fromCatalog) {
    const key = ndhListingKey(product.sku, product.expiryDate);
    byKey.set(key, product);
  }

  const products: NdhProduct[] = [];
  for (const record of visible) {
    const key = ndhListingKey(record.sku, record.expiryDate);
    const catalog = byKey.get(key);
    const remainingQty = getClearanceRemainingQty(record);
    const description = record.description;
    const base: NdhProduct = catalog
      ? { ...catalog }
      : {
          sku: record.sku,
          name: description,
          clearanceNote: record.note || "Sell as is",
          clearancePrice: record.clearancePrice
            ? formatClearancePriceDisplay(record.clearancePrice)
            : undefined,
          expiryDate: record.expiryDate,
          saleEndDate: record.saleEndDate,
          clearanceQty: record.clearanceQty,
          soldQty: record.soldQty || 0,
          remainingQty,
          startDate: record.startDate,
          clearanceStatus: getClearanceStatus(record),
          daysUntilExpiry: daysUntilExpiry(record.expiryDate),
        };

    products.push({
      ...base,
      name: description || base.name,
      description,
      clearanceNote: record.note || base.clearanceNote || "Sell as is",
      expiryDate: record.expiryDate,
      remainingQty,
      clearanceQty: record.clearanceQty,
      soldQty: record.soldQty || 0,
      daysUntilExpiry: daysUntilExpiry(record.expiryDate),
    });
  }

  products.sort((a, b) => {
    const ad = a.daysUntilExpiry ?? 99999;
    const bd = b.daysUntilExpiry ?? 99999;
    return ad - bd || a.sku.localeCompare(b.sku) || String(a.expiryDate).localeCompare(String(b.expiryDate));
  });

  return products;
}

export async function incrementNdhSold(items: { sku: string; qty: number; expiryDate?: string }[]) {
  if (!items.length) return;

  const records = await getNdhRecords();
  if (!records.length) return;

  const soldMap = new Map<string, number>();
  for (const item of items) {
    const sku = String(item.sku || "")
      .trim()
      .toUpperCase();
    const qty = Number(item.qty) || 0;
    if (!sku || qty <= 0) continue;
    const key = ndhListingKey(sku, item.expiryDate);
    soldMap.set(key, (soldMap.get(key) || 0) + qty);
  }

  let changed = false;
  const next = records.map((record) => {
    const key = ndhListingKey(record.sku, record.expiryDate);
    const add = soldMap.get(key) || (!record.expiryDate ? soldMap.get(record.sku) : 0);
    if (!add || !record.clearanceQty) return record;

    changed = true;
    return {
      ...record,
      soldQty: (record.soldQty || 0) + add,
      updatedAt: record.updatedAt,
    };
  });

  if (changed) await saveNdhRecords(next);
}

export function validateNdhInput(input: {
  sku?: string;
  description?: string;
  note?: string;
  expiryDate?: string;
  clearancePrice?: string;
  startDate?: string;
  saleEndDate?: string;
  clearanceQty?: unknown;
}) {
  const sku = String(input.sku || "")
    .trim()
    .toUpperCase();
  if (!sku) return { error: "Missing SKU." };

  const expiryDate = String(input.expiryDate || "").trim();
  const clearancePrice = String(input.clearancePrice || "").trim();
  const startDate = String(input.startDate || "").trim();
  const saleEndDate = String(input.saleEndDate || "").trim();
  const description = String(input.description || "").trim();

  if (!expiryDate || !parseDateOnly(expiryDate)) {
    return { error: "Exp date is required (YYYY-MM-DD or M/D/YYYY)." };
  }

  if (startDate && !parseDateOnly(startDate)) {
    return { error: "Invalid listing start date. Use YYYY-MM-DD." };
  }

  if (saleEndDate && !parseDateOnly(saleEndDate)) {
    return { error: "Invalid sale end date. Use YYYY-MM-DD." };
  }

  if (startDate && saleEndDate && parseDateOnly(startDate)! > parseDateOnly(saleEndDate)!) {
    return { error: "Sale end date must be on or after listing start date." };
  }

  if (saleEndDate && parseDateOnly(saleEndDate)! > parseDateOnly(expiryDate)!) {
    return { error: "Sale end date cannot be after product expiry date." };
  }

  return {
    record: {
      sku,
      description: description || undefined,
      note: String(input.note || "").trim() || undefined,
      expiryDate,
      clearancePrice,
      startDate: startDate || undefined,
      saleEndDate: saleEndDate || undefined,
      clearanceQty: parsePositiveInt(input.clearanceQty),
    } as Partial<NdhRecord>,
  };
}

export async function upsertNdhRecord(input: {
  sku?: string;
  description?: string;
  note?: string;
  expiryDate?: string;
  clearancePrice?: string;
  startDate?: string;
  saleEndDate?: string;
  clearanceQty?: unknown;
  resetSoldQty?: boolean;
}): Promise<{ error: string } | { record: NdhRecord; records: NdhRecord[] }> {
  const validated = validateNdhInput(input);

  if ("error" in validated && validated.error) {
    return { error: validated.error };
  }

  const sku = validated.record!.sku!;
  const expiryDate = validated.record!.expiryDate!;
  const key = ndhListingKey(sku, expiryDate);
  const current = await getNdhRecords();
  const existing = current.find((row) => ndhListingKey(row.sku, row.expiryDate) === key);

  const nextRecord: NdhRecord = {
    sku,
    description: validated.record!.description,
    note: validated.record!.note,
    expiryDate,
    clearancePrice: validated.record!.clearancePrice || "",
    startDate: validated.record!.startDate,
    saleEndDate: validated.record!.saleEndDate,
    clearanceQty: validated.record!.clearanceQty,
    soldQty: input.resetSoldQty ? 0 : existing?.soldQty || 0,
    updatedAt: new Date().toISOString(),
  };

  const records = [nextRecord, ...current.filter((row) => ndhListingKey(row.sku, row.expiryDate) !== key)];
  await saveNdhRecords(records);
  return { record: nextRecord, records };
}

export async function bulkUpsertNdhRecords(
  inputs: Array<Parameters<typeof validateNdhInput>[0]>,
  options?: { replaceAll?: boolean }
): Promise<{
  saved: number;
  errors: { sku: string; error: string }[];
  records: NdhRecord[];
}> {
  const current = options?.replaceAll ? [] : await getNdhRecords();
  const byKey = new Map(current.map((row) => [ndhListingKey(row.sku, row.expiryDate), row]));
  const errors: { sku: string; error: string }[] = [];
  let saved = 0;

  for (const input of inputs) {
    const validated = validateNdhInput(input);
    if ("error" in validated && validated.error) {
      errors.push({
        sku: String(input.sku || "").trim().toUpperCase() || "(blank)",
        error: validated.error,
      });
      continue;
    }

    const sku = validated.record!.sku!;
    const expiryDate = validated.record!.expiryDate!;
    const key = ndhListingKey(sku, expiryDate);
    const existing = byKey.get(key);
    byKey.set(key, {
      sku,
      description: validated.record!.description || existing?.description,
      note: validated.record!.note,
      expiryDate,
      clearancePrice: validated.record!.clearancePrice || existing?.clearancePrice || "",
      startDate: validated.record!.startDate,
      saleEndDate: validated.record!.saleEndDate,
      clearanceQty: validated.record!.clearanceQty,
      soldQty: existing?.soldQty || 0,
      updatedAt: new Date().toISOString(),
    });
    saved += 1;
  }

  const records = Array.from(byKey.values());
  await saveNdhRecords(records);
  return { saved, errors, records };
}

export function enrichNdhRecords(records: NdhRecord[]) {
  return records.map((record) => ({
    ...record,
    remainingQty: getClearanceRemainingQty(record),
    clearanceStatus: getClearanceStatus(record),
  }));
}
