import * as XLSX from "xlsx";

import {
  classifyStatementCode,
  parseMoneyToken,
  type ParsedStatement,
  type ParsedStatementLine,
} from "@/lib/credit/parseStatement";

function cell(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim()) return String(row[key]).trim();
    const found = Object.keys(row).find((k) => k.toLowerCase() === key.toLowerCase());
    if (found && row[found] != null && String(row[found]).trim()) return String(row[found]).trim();
  }
  return "";
}

function money(row: Record<string, unknown>, keys: string[]) {
  const raw = cell(row, keys);
  if (!raw) return 0;
  return Math.abs(parseMoneyToken(raw) || Number(raw.replace(/[^0-9.-]/g, "")) || 0);
}

export function parseStatementWorkbook(buffer: Buffer): ParsedStatement {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { lines: [] };
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const lines: ParsedStatementLine[] = [];
  for (const row of rows) {
    const document = cell(row, [
      "Document",
      "Document #",
      "Document No",
      "Invoice #",
      "INVOICE #",
      "Doc",
    ]).toUpperCase();
    if (!document) continue;

    const code = classifyStatementCode(cell(row, ["Code", "Type"]));
    const remainingDebit = money(row, [
      "Remaining Debits",
      "Remaining Debit",
      "Debits",
      "Invoice Amount",
    ]);
    const remainingCredit = money(row, ["Remaining Credits", "Remaining Credit", "Credits"]);

    if (remainingDebit <= 0 && remainingCredit <= 0) continue;

    lines.push({
      document,
      code,
      date: cell(row, ["Date", "Check date", "Check Date"]) || undefined,
      remainingDebit,
      remainingCredit,
    });
  }

  return { lines };
}
