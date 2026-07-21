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
  if (typeof cell.v === "number" && Number.isFinite(cell.v)) return cell.v;
  if (cell.v != null && String(cell.v).trim() !== "") return cell.v;
  if (cell.w != null && String(cell.w).trim()) return cell.w;
  return "";
}

/** Fill every cell in a merge range with the top-left value (Aval. INV / PID etc.). */
function expandMergedCells(sheet: XLSX.WorkSheet, aoa: unknown[][]) {
  const merges = sheet["!merges"];
  if (!merges?.length) return;

  for (const merge of merges) {
    const start = merge.s;
    const end = merge.e;
    const masterCell = sheet[XLSX.utils.encode_cell({ r: start.r, c: start.c })];
    const masterFromSheet = cellFieldValue(masterCell);
    const masterFromAoa = aoa[start.r]?.[start.c];
    const master =
      masterFromSheet !== "" && masterFromSheet != null
        ? masterFromSheet
        : masterFromAoa !== "" && masterFromAoa != null
          ? masterFromAoa
          : "";
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

function scoreProducts(products: StatusEtaProduct[]) {
  const withInv = products.filter((p) => p.availableInv != null).length;
  const withEta = products.filter((p) => p.inbound.some((i) => i.portEta)).length;
  return withInv * 10_000 + withEta * 10 + products.length;
}

function tryParseSheet(sheet: XLSX.WorkSheet): StatusEtaProduct[] {
  const aoa = sheetToAoa(sheet);
  if (!aoa.length) return [];
  findStatusEtaHeaderRowIndex(aoa);
  return parseStatusEtaAoa(aoa);
}

export function parseStatusEtaXlsxBuffer(buffer: ArrayBuffer | Buffer): StatusEtaProduct[] {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    cellNF: false,
    cellText: true,
  });

  let best: StatusEtaProduct[] = [];
  let bestScore = -1;
  let lastError: Error | null = null;

  const preferredNames = workbook.SheetNames.filter((name) =>
    /status|eta|inbound|aval|inventory|inv/i.test(name)
  );
  const ordered = [
    ...preferredNames,
    ...workbook.SheetNames.filter((name) => !preferredNames.includes(name)),
  ];

  for (const name of ordered) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    try {
      const products = tryParseSheet(sheet);
      const score = scoreProducts(products);
      if (score > bestScore) {
        best = products;
        bestScore = score;
      }
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (best.length > 0) return best;
  if (lastError) throw lastError;
  throw new Error("No sheet found in workbook.");
}

/** Debug helpers for upload diagnostics (headers / column fill). */
export function inspectStatusEtaXlsxBuffer(buffer: ArrayBuffer | Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, cellText: true });
  const sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    if (!sheet) return { name, headers: [] as string[], merges: 0, columnNonEmpty: [] as number[] };
    const aoa = sheetToAoa(sheet);
    const headerRowIndex = findStatusEtaHeaderRowIndex(aoa);
    const headers = (aoa[headerRowIndex] || []).map((c) => String(c ?? "").trim());
    const columnNonEmpty = headers.map((_, colIdx) => {
      let n = 0;
      for (let r = headerRowIndex + 1; r < aoa.length; r++) {
        const v = aoa[r]?.[colIdx];
        if (v !== undefined && v !== null && String(v).trim() !== "") n += 1;
      }
      return n;
    });
    return {
      name,
      headers,
      merges: sheet["!merges"]?.length || 0,
      columnNonEmpty,
    };
  });
  return { sheetNames: workbook.SheetNames, sheets };
}
