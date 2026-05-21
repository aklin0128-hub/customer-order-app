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
  sku: ["LOC ITEM", "SKU", "ITEM", "LOC_ITEM", "LOCAL ITEM"],
  description: ["LOC ITEM DESC", "ITEM DESC", "DESCRIPTION", "DESC"],
  qtyUm: ["LOC QTY UM", "QTY UM", "UM"],
  status: ["LOC INVENTORY STATUS", "INVENTORY STATUS", "STATUS"],
  receivedDate: [
    "LOC RECEIVED DATE",
    "LOCA RECEIVED DATE",
    "LOCAL RECEIVED DATE",
    "RECEIVED DATE",
    "DATE RECEIVED",
  ],
  expireDate: [
    "LOC EXPIRE DATE",
    "LOCA EXPIRE DATE",
    "LOCAL EXPIRE DATE",
    "LOC EXPIRATION DATE",
    "EXPIRE DATE",
    "EXPIRATION DATE",
    "EXPIRY DATE",
  ],
  onHandQty: ["LOC ON HAND QTY", "ON HAND QTY", "QTY", "ON HAND"],
};

const HEADER_FUZZY: Partial<
  Record<keyof Omit<InventoryLot, "sku"> | "sku", (norm: string) => boolean>
> = {
  receivedDate: (norm) =>
    (norm.includes("RECEIVED") || norm.includes("RECV")) && norm.includes("DATE"),
  expireDate: (norm) =>
    norm.includes("EXPIR") || (norm.includes("EXPIRE") && norm.includes("DATE")),
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

function normalizeHeaderKey(key: string) {
  return key.trim().toUpperCase().replace(/[^A-Z0-9]+/g, " ");
}

function compactHeaderKey(key: string) {
  return key.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Excel 1900 date system (Windows) — serial day number to YYYY-MM-DD. */
function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 200000) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseUsDate(value: string): string | null {
  const text = safeString(value);
  if (!text) return null;

  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) {
    const [, m, d, y] = slash;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const dash = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dash) return `${dash[1]}-${dash[2]}-${dash[3]}`;

  return null;
}

/** Parse cell values from CSV text or Excel (serial numbers, Date objects). */
export function parseInventoryDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const fromSerial = excelSerialToIso(value);
    if (fromSerial) return fromSerial;
  }

  const text = safeString(value);
  if (!text) return null;

  const asNumber = Number(text);
  if (text === String(asNumber) && asNumber > 30000 && asNumber < 200000) {
    const fromSerial = excelSerialToIso(asNumber);
    if (fromSerial) return fromSerial;
  }

  return parseUsDate(text);
}

function getFieldFromRecord(row: Record<string, unknown>, field: keyof typeof HEADER_ALIASES) {
  const aliases = HEADER_ALIASES[field];
  const fuzzy = HEADER_FUZZY[field];

  const entries = Object.entries(row);
  const byCompact = new Map(entries.map(([k]) => [compactHeaderKey(k), k]));

  for (const alias of aliases) {
    const key = byCompact.get(compactHeaderKey(alias));
    if (key != null && safeString(row[key])) return row[key];
  }

  if (fuzzy) {
    for (const [key, val] of entries) {
      if (fuzzy(compactHeaderKey(key)) && safeString(val)) return val;
    }
  }

  return undefined;
}

function recordsHaveRequiredColumns(records: Record<string, unknown>[]) {
  if (records.length === 0) return false;
  const keys = Object.keys(records[0] || {});
  const compact = keys.map(compactHeaderKey);
  const hasSku = compact.some(
    (k) =>
      k.length >= 3 &&
      (HEADER_ALIASES.sku.some((a) => {
        const ca = compactHeaderKey(a);
        return k === ca || (k.length >= 4 && ca.length >= 4 && k.includes(ca));
      }) ||
        (k.includes("LOC") && k.includes("ITEM")))
  );
  const hasExpire = compact.some(
    (k) =>
      k.length >= 6 &&
      (HEADER_FUZZY.expireDate?.(k) ||
        HEADER_ALIASES.expireDate.some((a) => {
          const ca = compactHeaderKey(a);
          return k === ca || k.includes(ca);
        }))
  );
  return hasSku && hasExpire;
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
  const compact = headers.map(compactHeaderKey);
  const pick = (field: keyof typeof HEADER_ALIASES) => {
    for (let i = 0; i < compact.length; i++) {
      const norm = compact[i]!;
      if (norm.length < 2) continue;
      for (const alias of HEADER_ALIASES[field]) {
        const a = compactHeaderKey(alias);
        if (norm === a) return i;
        if (norm.length >= 4 && a.length >= 4 && (norm.includes(a) || a.includes(norm))) return i;
      }
      if (norm.length >= 6 && HEADER_FUZZY[field]?.(norm)) return i;
    }
    return -1;
  };

  return {
    sku: pick("sku"),
    description: pick("description"),
    qtyUm: pick("qtyUm"),
    status: pick("status"),
    receivedDate: pick("receivedDate"),
    expireDate: pick("expireDate"),
    onHandQty: pick("onHandQty"),
  };
}

/** Parse rows from Excel sheet_to_json or similar. */
export function parseInventoryRecords(records: Record<string, unknown>[]): InventoryLot[] {
  if (!recordsHaveRequiredColumns(records)) {
    throw new Error(
      "File must include Loc Item and Loc Expire Date columns (By Item export)."
    );
  }

  const rows: InventoryLot[] = [];

  for (const record of records) {
    const sku = normalizeInventorySku(safeString(getFieldFromRecord(record, "sku")));
    if (!sku) continue;

    const receivedRaw = getFieldFromRecord(record, "receivedDate");
    const expireRaw = getFieldFromRecord(record, "expireDate");

    rows.push({
      sku,
      description: safeString(getFieldFromRecord(record, "description")) || undefined,
      qtyUm: safeString(getFieldFromRecord(record, "qtyUm")) || undefined,
      status: safeString(getFieldFromRecord(record, "status")) || undefined,
      receivedDate: parseInventoryDate(receivedRaw) || undefined,
      expireDate: parseInventoryDate(expireRaw) || undefined,
      onHandQty: parseQty(safeString(getFieldFromRecord(record, "onHandQty"))) || undefined,
    });
  }

  return rows;
}

/** Serialize parsed lots for Blob storage (stable US dates). */
export function serializeInventoryLotsToCsv(rows: InventoryLot[]): string {
  const header =
    "Loc Item,Loc Item Desc,Loc Qty UM,Loc Inventory Status,Loc Received Date,Loc Expire Date,Loc On Hand Qty";
  const lines = [header];

  for (const row of rows) {
    const fmt = (iso?: string) => {
      if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
      const [y, m, d] = iso.split("-");
      return `${Number(m)}/${Number(d)}/${y}`;
    };
    const cells = [
      row.sku,
      row.description || "",
      row.qtyUm || "",
      row.status || "",
      fmt(row.receivedDate),
      fmt(row.expireDate),
      row.onHandQty != null ? String(row.onHandQty) : "",
    ];
    lines.push(
      cells
        .map((c) => {
          const s = String(c);
          return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    );
  }

  return lines.join("\n");
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
        cols.receivedDate >= 0
          ? parseInventoryDate(cells[cols.receivedDate] || "") || undefined
          : undefined,
      expireDate:
        cols.expireDate >= 0 ? parseInventoryDate(cells[cols.expireDate] || "") || undefined : undefined,
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
