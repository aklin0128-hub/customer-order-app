import * as XLSX from "xlsx";

export type NdhListDefaults = {
  clearancePrice?: string;
  expiryDate?: string;
  clearanceQty?: string;
  note?: string;
};

export type ParsedNdhListRow = {
  sku: string;
  description?: string;
  note?: string;
  expiryDate?: string;
  clearancePrice?: string;
  clearanceQty?: string;
};

const HEADER_ALIASES: Record<string, keyof ParsedNdhListRow> = {
  sku: "sku",
  item: "sku",
  pid: "sku",
  itemno: "sku",
  itemnumber: "sku",
  description: "description",
  desc: "description",
  itemdescription: "description",
  product: "description",
  name: "description",
  price: "clearancePrice",
  ndhprice: "clearancePrice",
  clearanceprice: "clearancePrice",
  saleprice: "clearancePrice",
  tp: "clearancePrice",
  expiry: "expiryDate",
  expirydate: "expiryDate",
  exp: "expiryDate",
  expdate: "expiryDate",
  expire: "expiryDate",
  expiredate: "expiryDate",
  qty: "clearanceQty",
  quantity: "clearanceQty",
  stock: "clearanceQty",
  cases: "clearanceQty",
  inv: "clearanceQty",
  inventory: "clearanceQty",
  onhand: "clearanceQty",
  clearanceqty: "clearanceQty",
  note: "note",
  label: "note",
  memo: "note",
};

function cleanHeader(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function cleanSku(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function rowText(raw: unknown[]) {
  return raw.map((cell) => String(cell ?? "").trim()).join(" ").toUpperCase();
}

function isJunkReportRow(raw: unknown[]) {
  const text = rowText(raw);
  return (
    text.includes("APPLIED FILTER") ||
    text.includes("INVENTORY STATUS IS NEAR DATE") ||
    text.includes("LOC ON HAND QTY") ||
    /^TOTAL\b/.test(text)
  );
}

/** Warehouse PIDs are short codes like 10482K / 000150 — not report banners. */
export function isValidNdhSku(value: unknown) {
  const sku = cleanSku(value);
  if (!sku || sku.length > 20) return false;
  if (/\s/.test(sku)) return false;
  if (!/^[A-Z0-9][A-Z0-9.\-]*$/.test(sku)) return false;
  if (/^(APPLIED|FILTERS?|TOTAL|COUNT|STATUS|HOLD|NEAR)$/.test(sku)) return false;
  return true;
}

function isIsoExpiry(value?: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
}

function findHeaderRowIndex(matrix: unknown[][]) {
  return matrix.findIndex((row) => {
    if (!Array.isArray(row)) return false;
    return row.some((cell) => HEADER_ALIASES[cleanHeader(cell)] === "sku");
  });
}

function excelSerialToIso(value: number) {
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed?.y || !parsed.m || !parsed.d) return "";
  return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
}

export function normalizeNdhDate(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 20000 && value < 80000) return excelSerialToIso(value);
  }

  const text = String(value).trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const us = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (us) {
    const month = us[1].padStart(2, "0");
    const day = us[2].padStart(2, "0");
    const year = us[3].length === 2 ? `20${us[3]}` : us[3];
    return `${year}-${month}-${day}`;
  }

  return text;
}

function parseInv(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  const num = Number(String(value).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(num) || num < 0) return undefined;
  return String(Math.floor(num));
}

/** TP / price: keep at most two decimal places (Excel float noise → 5.38). */
export function parseNdhPrice(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  const raw = String(value).trim();
  if (!raw || !/[0-9]/.test(raw)) return undefined;
  const hadDollar = raw.includes("$");
  const num =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : Number(raw.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(num) || num <= 0) return undefined;
  const text = (Math.round(num * 100) / 100).toFixed(2);
  return hadDollar ? `$${text}` : text;
}

/** Warehouse `Life` (days left). Null when blank/unreadable. */
export function parseNdhLifeDays(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value).trim();
  if (!text) return null;
  const num = Number(text.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(num)) return null;
  return num;
}

function shouldSkipExpiredLife(value: unknown) {
  const life = parseNdhLifeDays(value);
  return life !== null && life <= 0;
}

function applyDefaults(row: ParsedNdhListRow, defaults?: NdhListDefaults): ParsedNdhListRow {
  return {
    sku: row.sku,
    description: row.description,
    note: row.note || defaults?.note || undefined,
    expiryDate: row.expiryDate || defaults?.expiryDate || undefined,
    clearancePrice: row.clearancePrice || parseNdhPrice(defaults?.clearancePrice) || undefined,
    clearanceQty: row.clearanceQty || defaults?.clearanceQty || undefined,
  };
}

export function ndhListingKey(sku: string, expiryDate?: string) {
  const clean = cleanSku(sku);
  const exp = String(expiryDate || "").trim();
  return exp ? `${clean}::${exp}` : clean;
}

export function parseNdhListingKey(key: string): { sku: string; expiryDate?: string } {
  const text = String(key || "").trim();
  const idx = text.indexOf("::");
  if (idx <= 0) return { sku: cleanSku(text) };
  return {
    sku: cleanSku(text.slice(0, idx)),
    expiryDate: text.slice(idx + 2).trim() || undefined,
  };
}

function qtyNumber(value?: string) {
  const num = Number(String(value || "").replace(/[^0-9]/g, ""));
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : 0;
}

/** Same SKU + same exp → sum Inv. Different exp → separate rows. */
export function mergeNdhListRows(rows: ParsedNdhListRow[]): ParsedNdhListRow[] {
  const map = new Map<string, ParsedNdhListRow>();
  const order: string[] = [];

  for (const row of rows) {
    const sku = cleanSku(row.sku);
    if (!sku) continue;
    const expiryDate = row.expiryDate || "";
    const key = ndhListingKey(sku, expiryDate);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row, sku, expiryDate: expiryDate || undefined });
      order.push(key);
      continue;
    }

    const summed = qtyNumber(existing.clearanceQty) + qtyNumber(row.clearanceQty);
    map.set(key, {
      ...existing,
      description: existing.description || row.description,
      note: existing.note || row.note,
      clearancePrice: existing.clearancePrice || row.clearancePrice,
      clearanceQty: summed > 0 ? String(summed) : existing.clearanceQty || row.clearanceQty,
    });
  }

  return order.map((key) => map.get(key)!);
}

function rowsFromMatrix(matrix: unknown[][], defaults?: NdhListDefaults): ParsedNdhListRow[] {
  if (!matrix.length) return [];

  const headerIndex = findHeaderRowIndex(matrix);
  const headerRow = headerIndex >= 0 ? matrix[headerIndex] : matrix[0];
  const headerCells = (headerRow || []).map(cleanHeader);
  const mapped = headerCells.map((cell) => HEADER_ALIASES[cell]);
  const lifeIndex = headerCells.findIndex((cell) => cell === "life");
  const tpIndex = headerCells.findIndex((cell) => cell === "tp");
  const hasSkuHeader = mapped.includes("sku");

  const out: ParsedNdhListRow[] = [];

  if (hasSkuHeader) {
    let lastSku = "";
    let lastDescription = "";
    let lastPrice = "";

    for (const raw of matrix.slice(headerIndex + 1)) {
      if (!Array.isArray(raw) || raw.every((cell) => String(cell ?? "").trim() === "")) continue;
      if (isJunkReportRow(raw)) continue;
      const row: ParsedNdhListRow = { sku: "" };
      mapped.forEach((field, index) => {
        if (!field) return;
        const value = raw[index];
        if (field === "sku") row.sku = cleanSku(value);
        else if (field === "expiryDate") row.expiryDate = normalizeNdhDate(value) || undefined;
        else if (field === "clearancePrice") {
          if (tpIndex >= 0 && index !== tpIndex) return;
          row.clearancePrice = parseNdhPrice(value);
        }
        else if (field === "clearanceQty") row.clearanceQty = parseInv(value);
        else if (field === "note") row.note = String(value ?? "").trim() || undefined;
        else if (field === "description") row.description = String(value ?? "").trim() || undefined;
      });

      const hasExpiry = isIsoExpiry(row.expiryDate);
      if (!row.sku && lastSku && (hasExpiry || row.clearanceQty)) {
        row.sku = lastSku;
        if (!row.description) row.description = lastDescription || undefined;
        if (!row.clearancePrice) row.clearancePrice = lastPrice || undefined;
      }
      const next = applyDefaults(row, defaults);
      if (!isValidNdhSku(next.sku) || !isIsoExpiry(next.expiryDate)) continue;
      lastSku = next.sku;
      if (next.description) lastDescription = next.description;
      if (next.clearancePrice) lastPrice = next.clearancePrice;
      if (lifeIndex >= 0 && shouldSkipExpiredLife(raw[lifeIndex])) continue;
      out.push(next);
    }
    return mergeNdhListRows(out);
  }

  for (const raw of matrix) {
    if (!Array.isArray(raw)) continue;
    if (isJunkReportRow(raw)) continue;
    const sku = cleanSku(raw[0]);
    if (!isValidNdhSku(sku) || HEADER_ALIASES[cleanHeader(sku)] === "sku") continue;
    const next = applyDefaults(
      {
        sku,
        clearancePrice: parseNdhPrice(raw[1]),
        expiryDate: normalizeNdhDate(raw[2]) || undefined,
        clearanceQty: parseInv(raw[3]),
        note: String(raw[4] ?? "").trim() || undefined,
      },
      defaults
    );
    if (!isIsoExpiry(next.expiryDate)) continue;
    out.push(next);
  }

  return mergeNdhListRows(out);
}

function splitDelimitedLine(line: string) {
  if (line.includes("\t")) return line.split("\t");
  if (line.includes(",")) return line.split(",");
  return line.trim().split(/\s+/);
}

export function parseNdhListText(text: string, defaults?: NdhListDefaults): ParsedNdhListRow[] {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const matrix = lines.map(splitDelimitedLine);
  return rowsFromMatrix(matrix, defaults);
}

export function parseNdhListWorkbook(buffer: Buffer, defaults?: NdhListDefaults): ParsedNdhListRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date)[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });
  return rowsFromMatrix(matrix, defaults);
}

export function parseNdhUpload(input: {
  text?: string;
  file?: { buffer: Buffer; name?: string; type?: string };
  defaults?: NdhListDefaults;
}): ParsedNdhListRow[] {
  const name = String(input.file?.name || "").toLowerCase();
  const type = String(input.file?.type || "").toLowerCase();
  const looksSpreadsheet =
    Boolean(input.file?.buffer?.length) &&
    (name.endsWith(".xlsx") ||
      name.endsWith(".xls") ||
      name.endsWith(".csv") ||
      type.includes("spreadsheet") ||
      type.includes("excel") ||
      type.includes("csv"));

  if (looksSpreadsheet && input.file) {
    return parseNdhListWorkbook(input.file.buffer, input.defaults);
  }

  return parseNdhListText(input.text || "", input.defaults);
}
