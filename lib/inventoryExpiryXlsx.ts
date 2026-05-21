import * as XLSX from "xlsx";

import {
  compactHeaderKey,
  parseInventoryDate,
  parseInventoryRecords,
  serializeInventoryLotsToCsv,
  type InventoryLot,
} from "@/lib/inventoryExpiry";

const BY_ITEM_SHEET_NAMES = ["by item", "byitem", "by_item"];

function pickByItemSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet | null {
  const normalized = new Map(
    workbook.SheetNames.map((name) => [name.trim().toLowerCase().replace(/\s+/g, " "), name])
  );

  for (const alias of BY_ITEM_SHEET_NAMES) {
    const actual = normalized.get(alias);
    if (actual && workbook.Sheets[actual]) return workbook.Sheets[actual];
  }

  const fuzzy = workbook.SheetNames.find((name) => /by\s*item/i.test(name));
  if (fuzzy && workbook.Sheets[fuzzy]) return workbook.Sheets[fuzzy];

  const exp = workbook.SheetNames.find((name) => /inventory|exp/i.test(name));
  if (exp && workbook.Sheets[exp]) return workbook.Sheets[exp];

  const first = workbook.SheetNames[0];
  return first ? workbook.Sheets[first] : null;
}

/** Find row that contains Loc Item (or similar) — exports often have title rows above headers. */
export function findInventoryHeaderRowIndex(aoa: unknown[][]): number {
  const max = Math.min(45, aoa.length);
  for (let i = 0; i < max; i++) {
    const row = aoa[i];
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      const compact = compactHeaderKey(String(cell ?? ""));
      if (
        compact === "LOCITEM" ||
        compact === "SKU" ||
        (compact.includes("LOC") && compact.includes("ITEM") && compact.length <= 12)
      ) {
        return i;
      }
    }
  }
  return 0;
}

function cellFieldValue(cell: XLSX.CellObject | undefined): unknown {
  if (!cell) return "";
  if (cell.v instanceof Date) return cell.v;
  if (cell.w != null && String(cell.w).trim()) return cell.w;
  return cell.v ?? "";
}

function enrichDateFieldsFromSheet(
  sheet: XLSX.WorkSheet,
  records: Record<string, unknown>[],
  headerRowIndex: number,
  headers: string[]
) {
  const receivedIdx = headers.findIndex((h) => {
    const c = compactHeaderKey(h);
    return (c.includes("RECEIVED") || c.includes("RECV")) && c.includes("DATE");
  });
  const expireIdx = headers.findIndex((h) => {
    const c = compactHeaderKey(h);
    return c.includes("EXPIR") || (c.includes("EXPIRE") && c.includes("DATE"));
  });

  for (let i = 0; i < records.length; i++) {
    const excelRow = headerRowIndex + 1 + i;
    const record = records[i]!;

    if (receivedIdx >= 0) {
      const key = headers[receivedIdx]!;
      const raw = record[key];
      if (raw === "" || raw == null) {
        const cell = sheet[XLSX.utils.encode_cell({ r: excelRow, c: receivedIdx })];
        const v = cellFieldValue(cell);
        if (v !== "" && v != null) record[key] = v;
      }
    }

    if (expireIdx >= 0) {
      const key = headers[expireIdx]!;
      const raw = record[key];
      if (raw === "" || raw == null) {
        const cell = sheet[XLSX.utils.encode_cell({ r: excelRow, c: expireIdx })];
        const v = cellFieldValue(cell);
        if (v !== "" && v != null) record[key] = v;
      }
    }
  }
}

export function sheetToInventoryRecords(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const aoa = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];

  const headerRowIndex = findInventoryHeaderRowIndex(aoa);
  const headerRow = aoa[headerRowIndex];
  if (!Array.isArray(headerRow)) return [];

  const headers = headerRow.map((h, i) => {
    const text = String(h ?? "").trim();
    return text || `__COL_${i}`;
  });

  const records: Record<string, unknown>[] = [];

  for (let r = headerRowIndex + 1; r < aoa.length; r++) {
    const row = aoa[r];
    if (!Array.isArray(row)) continue;

    const record: Record<string, unknown> = {};
    let hasValue = false;

    headers.forEach((header, c) => {
      if (header.startsWith("__COL_")) return;
      const val = row[c];
      const empty = val === undefined || val === null || val === "";
      if (!empty) hasValue = true;
      record[header] = empty ? "" : val;
    });

    if (hasValue) records.push(record);
  }

  enrichDateFieldsFromSheet(sheet, records, headerRowIndex, headers);
  return records;
}

export function parseInventoryXlsxBuffer(buffer: Buffer): { csvText: string; rows: InventoryLot[] } {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = pickByItemSheet(workbook);

  if (!sheet) {
    throw new Error("No worksheet found in the Excel file.");
  }

  const records = sheetToInventoryRecords(sheet);
  const rows = parseInventoryRecords(records);

  if (rows.length === 0) {
    throw new Error(
      "No inventory rows found. Use the By Item sheet with Loc Item and Loc Expire Date columns."
    );
  }

  const csvText = serializeInventoryLotsToCsv(rows);
  return { csvText, rows };
}
