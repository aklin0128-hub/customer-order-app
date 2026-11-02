import * as XLSX from "xlsx";

export type NdhListDefaults = {
  clearancePrice?: string;
  expiryDate?: string;
  clearanceQty?: string;
  note?: string;
};

export type ParsedNdhListRow = {
  sku: string;
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
  price: "clearancePrice",
  ndhprice: "clearancePrice",
  clearanceprice: "clearancePrice",
  saleprice: "clearancePrice",
  expiry: "expiryDate",
  expirydate: "expiryDate",
  exp: "expiryDate",
  expire: "expiryDate",
  expiredate: "expiryDate",
  qty: "clearanceQty",
  quantity: "clearanceQty",
  stock: "clearanceQty",
  cases: "clearanceQty",
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
    return excelSerialToIso(value);
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

function applyDefaults(row: ParsedNdhListRow, defaults?: NdhListDefaults): ParsedNdhListRow {
  return {
    sku: row.sku,
    note: row.note || defaults?.note || undefined,
    expiryDate: row.expiryDate || defaults?.expiryDate || undefined,
    clearancePrice: row.clearancePrice || defaults?.clearancePrice || undefined,
    clearanceQty: row.clearanceQty || defaults?.clearanceQty || undefined,
  };
}

function rowsFromMatrix(matrix: unknown[][], defaults?: NdhListDefaults): ParsedNdhListRow[] {
  if (!matrix.length) return [];

  const headerCells = matrix[0].map(cleanHeader);
  const mapped = headerCells.map((cell) => HEADER_ALIASES[cell]);
  const hasSkuHeader = mapped.includes("sku");

  const out: ParsedNdhListRow[] = [];

  if (hasSkuHeader) {
    for (const raw of matrix.slice(1)) {
      if (!Array.isArray(raw) || raw.every((cell) => String(cell ?? "").trim() === "")) continue;
      const row: ParsedNdhListRow = { sku: "" };
      mapped.forEach((field, index) => {
        if (!field) return;
        const value = raw[index];
        if (field === "sku") row.sku = cleanSku(value);
        else if (field === "expiryDate") row.expiryDate = normalizeNdhDate(value) || undefined;
        else if (field === "clearancePrice") row.clearancePrice = String(value ?? "").trim() || undefined;
        else if (field === "clearanceQty") row.clearanceQty = String(value ?? "").trim() || undefined;
        else if (field === "note") row.note = String(value ?? "").trim() || undefined;
      });
      if (!row.sku) continue;
      out.push(applyDefaults(row, defaults));
    }
    return out;
  }

  for (const raw of matrix) {
    if (!Array.isArray(raw)) continue;
    const sku = cleanSku(raw[0]);
    if (!sku || HEADER_ALIASES[cleanHeader(sku)] === "sku") continue;
    const expiry = normalizeNdhDate(raw[2]);
    out.push(
      applyDefaults(
        {
          sku,
          clearancePrice: String(raw[1] ?? "").trim() || undefined,
          expiryDate: expiry || undefined,
          clearanceQty: String(raw[3] ?? "").trim() || undefined,
          note: String(raw[4] ?? "").trim() || undefined,
        },
        defaults
      )
    );
  }

  return out;
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
