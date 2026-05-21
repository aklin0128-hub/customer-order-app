export type InventoryLot = {
  sku: string;
  description?: string;
  qtyUm?: string;
  status?: string;
  receivedDate?: string;
  expireDate?: string;
  onHandQty?: number;
};

export type SkuExpirationResult = {
  sku: string;
  found: boolean;
  lots: InventoryLot[];
  /** ISO dates (YYYY-MM-DD), sorted ascending */
  expireDates: string[];
  earliestExpireDate: string | null;
  latestExpireDate: string | null;
  totalOnHandQty: number;
};

const HEADER_ALIASES: Record<keyof Omit<InventoryLot, "sku"> | "sku", string[]> = {
  sku: ["LOC ITEM", "SKU", "ITEM", "LOC_ITEM"],
  description: ["LOC ITEM DESC", "ITEM DESC", "DESCRIPTION", "DESC"],
  qtyUm: ["LOC QTY UM", "QTY UM", "UM"],
  status: ["LOC INVENTORY STATUS", "INVENTORY STATUS", "STATUS"],
  receivedDate: ["LOC RECEIVED DATE", "RECEIVED DATE"],
  expireDate: ["LOC EXPIRE DATE", "EXPIRE DATE", "EXPIRATION DATE", "EXPIRY DATE"],
  onHandQty: ["LOC ON HAND QTY", "ON HAND QTY", "QTY", "ON HAND"],
};

let cached: {
  sourceKey: string;
  rows: InventoryLot[];
  index: Map<string, InventoryLot[]>;
} | null = null;

function safeString(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

/** Normalize SKU for lookup (catalog `00002D` vs inventory `000020`). */
export function normalizeInventorySku(sku: string) {
  return String(sku || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Keys used to match catalog SKUs to inventory loc items. */
export function skuLookupKeys(sku: string) {
  const norm = normalizeInventorySku(sku);
  const keys = new Set<string>();
  if (!norm) return [];

  keys.add(norm);

  const base5 = norm.match(/^(\d{5})/)?.[1];
  if (base5) {
    keys.add(base5);
    keys.add(`${base5}D`);
    keys.add(`${base5}0`);
  }
  if (/^\d{6}$/.test(norm)) {
    keys.add(norm.slice(0, 5));
  }

  return [...keys];
}

function parseUsDate(value: string): string | null {
  const text = safeString(value);
  if (!text) return null;

  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, m, d, y] = slash;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  return null;
}

function parseQty(value: string) {
  const num = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }

  cells.push(current.trim());
  return cells;
}

function resolveHeaderIndex(headers: string[]) {
  const normalized = headers.map((h) => h.trim().toUpperCase());
  const pick = (aliases: string[]) => {
    for (const alias of aliases) {
      const idx = normalized.indexOf(alias);
      if (idx >= 0) return idx;
    }
    return -1;
  };

  return {
    sku: pick(HEADER_ALIASES.sku),
    description: pick(HEADER_ALIASES.description),
    qtyUm: pick(HEADER_ALIASES.qtyUm),
    status: pick(HEADER_ALIASES.status),
    receivedDate: pick(HEADER_ALIASES.receivedDate),
    expireDate: pick(HEADER_ALIASES.expireDate),
    onHandQty: pick(HEADER_ALIASES.onHandQty),
  };
}

function lotDedupeKey(lot: InventoryLot) {
  return [
    lot.sku,
    lot.description || "",
    lot.status || "",
    lot.receivedDate || "",
    lot.expireDate || "",
    lot.onHandQty ?? "",
  ].join("|");
}

export function buildInventoryIndex(rows: InventoryLot[]) {
  const index = new Map<string, InventoryLot[]>();

  for (const row of rows) {
    for (const key of skuLookupKeys(row.sku)) {
      const list = index.get(key) || [];
      list.push(row);
      index.set(key, list);
    }
  }

  return index;
}

/** Parse inventory CSV text (By Item export). */
export function parseInventoryCsvText(raw: string): InventoryLot[] {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const cols = resolveHeaderIndex(headers);
  if (cols.sku < 0 || cols.expireDate < 0) {
    throw new Error(
      "CSV must include Loc Item and Loc Expire Date columns (By Item export)."
    );
  }

  const rows: InventoryLot[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const sku = normalizeInventorySku(cells[cols.sku] || "");
    if (!sku) continue;

    rows.push({
      sku,
      description: cols.description >= 0 ? safeString(cells[cols.description]) : undefined,
      qtyUm: cols.qtyUm >= 0 ? safeString(cells[cols.qtyUm]) : undefined,
      status: cols.status >= 0 ? safeString(cells[cols.status]) : undefined,
      receivedDate:
        cols.receivedDate >= 0 ? parseUsDate(cells[cols.receivedDate] || "") || undefined : undefined,
      expireDate:
        cols.expireDate >= 0 ? parseUsDate(cells[cols.expireDate] || "") || undefined : undefined,
      onHandQty: cols.onHandQty >= 0 ? parseQty(cells[cols.onHandQty] || "") : undefined,
    });
  }

  return rows;
}

export function bustInventoryCache() {
  cached = null;
}

function setCache(sourceKey: string, rows: InventoryLot[]) {
  cached = {
    sourceKey,
    rows,
    index: buildInventoryIndex(rows),
  };
}

/** Used by tests via inventoryExpiry.local.ts only. */
export function replaceInventoryCache(sourceKey: string, rows: InventoryLot[]) {
  setCache(sourceKey, rows);
}

/** Load uploaded CSV from Vercel Blob (via Redis meta). */
export async function loadInventoryLots(): Promise<InventoryLot[]> {
  const { getInventoryCsvMeta, loadUploadedInventoryCsvText } = await import(
    "@/lib/inventoryExpiryStore"
  );
  const meta = await getInventoryCsvMeta();
  const text = await loadUploadedInventoryCsvText();
  const sourceKey = meta
    ? `blob:${meta.blobPathname}:${meta.uploadedAt}`
    : "empty";

  if (cached?.sourceKey === sourceKey) return cached.rows;
  if (!text?.trim()) {
    cached = { sourceKey: "empty", rows: [], index: new Map() };
    return [];
  }

  const rows = parseInventoryCsvText(text);
  setCache(sourceKey, rows);
  return rows;
}

async function getIndex(filePath?: string) {
  if (filePath) {
    const { loadInventoryLotsFromFile } = await import(
      /* webpackIgnore: true */ "@/lib/inventoryExpiry.local"
    );
    await loadInventoryLotsFromFile(filePath);
  } else {
    await loadInventoryLots();
  }
  return cached?.index || new Map<string, InventoryLot[]>();
}

export type GetSkuExpirationOptions = {
  /** For unit tests — read a specific file instead of uploaded blob */
  filePath?: string;
  status?: string;
  onlyFutureExpiry?: boolean;
};

function querySkuExpiration(
  sku: string,
  index: Map<string, InventoryLot[]>,
  options: GetSkuExpirationOptions = {}
): SkuExpirationResult {
  const querySku = normalizeInventorySku(sku);
  const empty: SkuExpirationResult = {
    sku: querySku,
    found: false,
    lots: [],
    expireDates: [],
    earliestExpireDate: null,
    latestExpireDate: null,
    totalOnHandQty: 0,
  };

  if (!querySku) return empty;

  const seen = new Set<string>();
  const lots: InventoryLot[] = [];

  for (const key of skuLookupKeys(querySku)) {
    for (const lot of index.get(key) || []) {
      const id = lotDedupeKey(lot);
      if (seen.has(id)) continue;
      seen.add(id);

      if (options.status && safeString(lot.status).toLowerCase() !== options.status.toLowerCase()) {
        continue;
      }

      if (options.onlyFutureExpiry && lot.expireDate) {
        const today = new Date().toISOString().slice(0, 10);
        if (lot.expireDate < today) continue;
      }

      lots.push(lot);
    }
  }

  if (lots.length === 0) return empty;

  const expireDates = [
    ...new Set(lots.map((l) => l.expireDate).filter((d): d is string => Boolean(d))),
  ].sort();

  const totalOnHandQty = lots.reduce((sum, l) => sum + (l.onHandQty || 0), 0);

  return {
    sku: querySku,
    found: true,
    lots,
    expireDates,
    earliestExpireDate: expireDates[0] || null,
    latestExpireDate: expireDates[expireDates.length - 1] || null,
    totalOnHandQty,
  };
}

export async function getSkuExpiration(
  sku: string,
  options: GetSkuExpirationOptions = {}
): Promise<SkuExpirationResult> {
  const index = await getIndex(options.filePath);
  return querySkuExpiration(sku, index, options);
}

export async function getSkuExpirationDates(sku: string, options?: GetSkuExpirationOptions) {
  const result = await getSkuExpiration(sku, options);
  return result.expireDates;
}
