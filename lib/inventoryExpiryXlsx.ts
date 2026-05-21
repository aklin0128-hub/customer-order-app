import * as XLSX from "xlsx";

import { parseInventoryCsvText, type InventoryLot } from "@/lib/inventoryExpiry";

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

  const first = workbook.SheetNames[0];
  return first ? workbook.Sheets[first] : null;
}

export function parseInventoryXlsxBuffer(buffer: Buffer): { csvText: string; rows: InventoryLot[] } {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = pickByItemSheet(workbook);

  if (!sheet) {
    throw new Error("No worksheet found in the Excel file.");
  }

  const csvText = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
  const rows = parseInventoryCsvText(csvText);

  if (rows.length === 0) {
    throw new Error(
      "No inventory rows found. Use the By Item sheet with Loc Item and Loc Expire Date columns."
    );
  }

  return { csvText, rows };
}
