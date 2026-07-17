import * as XLSX from "xlsx";

import {
  findStatusEtaHeaderRowIndex,
  parseStatusEtaAoa,
  type StatusEtaProduct,
} from "@/lib/inventoryStatusEta";

function cellFieldValue(cell: XLSX.CellObject | undefined): unknown {
  if (!cell) return "";
  if (cell.v instanceof Date) return cell.v;
  if (cell.t === "n" && typeof cell.v === "number") return cell.v;
  if (cell.w != null && String(cell.w).trim()) return cell.w;
  return cell.v ?? "";
}

function sheetToAoa(sheet: XLSX.WorkSheet): unknown[][] {
  const ref = sheet["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const aoa: unknown[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: unknown[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      row.push(cellFieldValue(cell));
    }
    aoa.push(row);
  }
  return aoa;
}

function pickStatusEtaSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet | null {
  const preferred = workbook.SheetNames.find((name) =>
    /status|eta|inbound|aval|inventory/i.test(name)
  );
  if (preferred && workbook.Sheets[preferred]) return workbook.Sheets[preferred];
  const first = workbook.SheetNames[0];
  return first ? workbook.Sheets[first] : null;
}

export function parseStatusEtaXlsxBuffer(buffer: ArrayBuffer | Buffer): StatusEtaProduct[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = pickStatusEtaSheet(workbook);
  if (!sheet) throw new Error("No sheet found in workbook.");

  const aoa = sheetToAoa(sheet);
  if (!aoa.length) throw new Error("Spreadsheet is empty.");

  // Ensure header detection works even if first rows are titles
  findStatusEtaHeaderRowIndex(aoa);
  return parseStatusEtaAoa(aoa);
}
