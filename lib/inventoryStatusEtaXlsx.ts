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

/** Fill every cell in a merge range with the top-left value (Aval. INV / PID etc.). */
function expandMergedCells(sheet: XLSX.WorkSheet, aoa: unknown[][]) {
  const merges = sheet["!merges"];
  if (!merges?.length) return;

  for (const merge of merges) {
    const start = merge.s;
    const end = merge.e;
    const master =
      aoa[start.r]?.[start.c] ??
      cellFieldValue(sheet[XLSX.utils.encode_cell({ r: start.r, c: start.c })]);
    if (master === "" || master == null) continue;

    for (let r = start.r; r <= end.r; r++) {
      if (!aoa[r]) aoa[r] = [];
      for (let c = start.c; c <= end.c; c++) {
        const current = aoa[r]![c];
        const empty = current === undefined || current === null || current === "";
        if (empty) aoa[r]![c] = master;
      }
    }
  }
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
  expandMergedCells(sheet, aoa);
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
