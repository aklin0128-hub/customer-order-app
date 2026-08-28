import * as XLSX from "xlsx";

import type { DepositSlipLine, DepositSlipMeta } from "@/lib/credit/depositSlipPdf";

function money(n: number) {
  return Math.round(n * 100) / 100;
}

export function buildDepositSlipWorkbook(opts: {
  meta: DepositSlipMeta;
  lines: DepositSlipLine[];
}): ArrayBuffer {
  const seenChecks = new Set<string>();
  const rows: Array<Array<string | number>> = [
    ["PNC BANK CHECK DEPOSIT (SE)"],
    [
      `Name: ${opts.meta.name || ""}`,
      `Store ID: ${opts.meta.storeId || ""}`,
      `Date: ${opts.meta.date || ""}`,
      `Code: ${opts.meta.code || ""}`,
    ],
    [],
    ["INVOICE #", "Invoice Amount", "Check NO", "Deposit Amount", "Check date"],
  ];

  let invoiceTotal = 0;
  let depositTotal = 0;

  for (const line of opts.lines) {
    invoiceTotal += line.amount;
    const checkKey = `${line.checkNo || ""}|${line.depositAmount ?? ""}|${line.checkDate || ""}`;
    const showCheck = Boolean(line.checkNo) && !seenChecks.has(checkKey);
    if (showCheck) {
      seenChecks.add(checkKey);
      if (typeof line.depositAmount === "number") depositTotal += line.depositAmount;
    }

    rows.push([
      line.document,
      money(line.amount),
      showCheck && line.checkNo ? `# ${line.checkNo}` : "",
      showCheck && typeof line.depositAmount === "number" ? money(line.depositAmount) : "",
      showCheck ? line.checkDate || "" : "",
    ]);
  }

  rows.push([]);
  rows.push(["TOTAL", money(invoiceTotal), "", money(depositTotal), ""]);

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Deposit");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
