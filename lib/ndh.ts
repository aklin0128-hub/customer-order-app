import { redis } from "@/lib/redis";
import {
  getClearanceProducts,
  getClearanceRemainingQty,
  getClearanceStatus,
  normalizeClearanceRecord,
  type ClearanceProduct,
  type ClearanceRecord,
  validateClearanceInput,
} from "@/lib/clearance";

export const NDH_KEY = "ndh:list";
export const NDH_ORDER_EMAIL_TAG = "NDH";

export type NdhRecord = ClearanceRecord;
export type NdhProduct = ClearanceProduct;

export async function getNdhRecords(): Promise<NdhRecord[]> {
  const raw = await redis.get<unknown[]>(NDH_KEY);
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const list: NdhRecord[] = [];

  for (const entry of raw) {
    const record = normalizeClearanceRecord(entry);
    if (!record || seen.has(record.sku)) continue;
    seen.add(record.sku);
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
  return getClearanceProducts({
    activeOnly: options?.activeOnly,
    records,
  });
}

export async function incrementNdhSold(items: { sku: string; qty: number }[]) {
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
    soldMap.set(sku, (soldMap.get(sku) || 0) + qty);
  }

  let changed = false;
  const next = records.map((record) => {
    const add = soldMap.get(record.sku);
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

export async function upsertNdhRecord(input: {
  sku?: string;
  note?: string;
  expiryDate?: string;
  clearancePrice?: string;
  startDate?: string;
  saleEndDate?: string;
  clearanceQty?: unknown;
  resetSoldQty?: boolean;
}): Promise<{ error: string } | { record: NdhRecord; records: NdhRecord[] }> {
  const validated = validateClearanceInput({
    sku: input.sku,
    note: input.note,
    expiryDate: input.expiryDate,
    clearancePrice: input.clearancePrice,
    startDate: input.startDate,
    saleEndDate: input.saleEndDate,
    clearanceQty: input.clearanceQty,
  });

  if ("error" in validated && validated.error) {
    return { error: validated.error };
  }

  const sku = validated.record!.sku!;
  const current = await getNdhRecords();
  const existing = current.find((row) => row.sku === sku);

  const nextRecord: NdhRecord = {
    sku,
    note: validated.record!.note,
    expiryDate: validated.record!.expiryDate!,
    clearancePrice: validated.record!.clearancePrice!,
    startDate: validated.record!.startDate,
    saleEndDate: validated.record!.saleEndDate,
    clearanceQty: validated.record!.clearanceQty,
    soldQty: input.resetSoldQty ? 0 : existing?.soldQty || 0,
    updatedAt: new Date().toISOString(),
  };

  const records = [nextRecord, ...current.filter((row) => row.sku !== sku)];
  await saveNdhRecords(records);
  return { record: nextRecord, records };
}

export async function bulkUpsertNdhRecords(
  inputs: Array<Parameters<typeof validateClearanceInput>[0]>,
  options?: { replaceAll?: boolean }
): Promise<{
  saved: number;
  errors: { sku: string; error: string }[];
  records: NdhRecord[];
}> {
  const current = options?.replaceAll ? [] : await getNdhRecords();
  const bySku = new Map(current.map((row) => [row.sku, row]));
  const errors: { sku: string; error: string }[] = [];
  let saved = 0;

  for (const input of inputs) {
    const validated = validateClearanceInput(input);
    if ("error" in validated && validated.error) {
      errors.push({
        sku: String(input.sku || "").trim().toUpperCase() || "(blank)",
        error: validated.error,
      });
      continue;
    }

    const sku = validated.record!.sku!;
    const existing = bySku.get(sku);
    bySku.set(sku, {
      sku,
      note: validated.record!.note,
      expiryDate: validated.record!.expiryDate!,
      clearancePrice: validated.record!.clearancePrice!,
      startDate: validated.record!.startDate,
      saleEndDate: validated.record!.saleEndDate,
      clearanceQty: validated.record!.clearanceQty,
      soldQty: existing?.soldQty || 0,
      updatedAt: new Date().toISOString(),
    });
    saved += 1;
  }

  const records = Array.from(bySku.values());
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
