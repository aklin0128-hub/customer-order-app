import catalogMaster from "@/data/catalog_sku_master_extracted.json";
import { redis } from "@/lib/redis";

const staticSkus = new Set(
  (catalogMaster as { sku?: string }[])
    .map((x) => String(x?.sku || "").trim().toUpperCase())
    .filter(Boolean)
);

const catalogByBase5 = new Map<string, string[]>();

for (const sku of staticSkus) {
  const base5 = sku.match(/^(\d{5})/)?.[1];
  if (!base5) continue;
  const list = catalogByBase5.get(base5) || [];
  list.push(sku);
  catalogByBase5.set(base5, list);
}

export function normalizeInvoiceSkuInput(sku: string) {
  return String(sku || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Lookup keys for invoice SKUs that may drop leading zeros from PDF text. */
export function invoiceSkuLookupKeys(sku: string) {
  const raw = normalizeInvoiceSkuInput(sku);
  if (!raw) return [] as string[];

  const keys = new Set<string>([raw]);
  const split = raw.match(/^(\d{1,7})([A-Z]{0,3})$/);
  if (!split) return [...keys];

  const digits = split[1]!;
  const suffix = split[2] || "";

  if (suffix) {
    if (digits.length <= 5) keys.add(`${digits.padStart(5, "0")}${suffix}`);
    else if (digits.length === 6) keys.add(`${digits.slice(0, 5)}${suffix}`);
  } else if (/^\d{1,5}$/.test(digits)) {
    keys.add(digits.padStart(5, "0"));
  }

  return [...keys];
}

export function findCatalogSkusForInvoiceSku(sku: string) {
  const matches = new Set<string>();

  for (const key of invoiceSkuLookupKeys(sku)) {
    if (staticSkus.has(key)) matches.add(key);

    const base5 = key.match(/^(\d{5})/)?.[1];
    if (!base5) continue;
    for (const hit of catalogByBase5.get(base5) || []) {
      matches.add(hit);
    }
  }

  return [...matches].sort();
}

export function canonicalizeInvoiceSku(sku: string) {
  const raw = normalizeInvoiceSkuInput(sku);
  if (!raw) return "";

  const matches = findCatalogSkusForInvoiceSku(raw);
  if (matches.length === 1) return matches[0]!;
  if (staticSkus.has(raw)) return raw;
  return raw;
}

export async function skuIsInCatalog(sku: string): Promise<boolean> {
  const resolved = await resolveInvoiceLineSku(sku);
  return resolved.inCatalog;
}

export async function resolveInvoiceLineSku(sku: string): Promise<{ sku: string; inCatalog: boolean }> {
  const raw = normalizeInvoiceSkuInput(sku);
  if (!raw) return { sku: "", inCatalog: false };

  const catalogMatches = findCatalogSkusForInvoiceSku(raw);
  if (catalogMatches.length === 1) {
    return { sku: catalogMatches[0]!, inCatalog: true };
  }
  if (catalogMatches.length > 0 || staticSkus.has(raw)) {
    return { sku: staticSkus.has(raw) ? raw : raw, inCatalog: true };
  }

  for (const key of invoiceSkuLookupKeys(raw)) {
    const hit = await redis.get<unknown>(`product:${key}`);
    if (hit) return { sku: key, inCatalog: true };
  }

  return { sku: raw, inCatalog: false };
}
