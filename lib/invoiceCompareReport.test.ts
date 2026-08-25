import assert from "node:assert/strict";
import test from "node:test";

import { invoiceCompareToCsv, invoiceCompareAccountKey, type InvoiceCompareReport } from "./invoiceCompareCsv";

test("invoiceCompareAccountKey normalizes FL0156 / FL156 / 156", () => {
  assert.equal(invoiceCompareAccountKey("FL156"), "FL156");
  assert.equal(invoiceCompareAccountKey("fl0156"), "FL156");
  assert.equal(invoiceCompareAccountKey("156"), "156");
  assert.equal(invoiceCompareAccountKey("  FL00156 "), "FL156");
});

test("invoiceCompareToCsv stacks date over invoice like the table", () => {
  const report: InvoiceCompareReport = {
    accountNo: "FL3387",
    asOfDate: "2026-07-15",
    lookbackDays: 90,
    invoiceCount: 3,
    skuCount: 1,
    invoices: [
      { importId: "a", invoiceNo: "PSI-1001", date: "2026-07-01" },
      { importId: "b", invoiceNo: "PSI-1002", date: "2026-07-08" },
      { importId: "c", invoiceNo: "PSI-1003", date: "2026-07-15" },
    ],
    rows: [
      {
        sku: "ABC",
        brand: "Brand",
        name: "Item",
        cells: [
          { price: 100, qty: 2, changePct: null },
          { price: 120, qty: 1, changePct: 20 },
          { price: 120, qty: 1, changePct: 0 },
        ],
        available: true,
      },
    ],
  };

  const { headerRows, rows } = invoiceCompareToCsv(report);
  assert.deepEqual(headerRows, [
    ["SKU", "Brand", "Name", "2026-07-01", "2026-07-08", "2026-07-15"],
    ["", "", "", "PSI-1001", "PSI-1002", "PSI-1003"],
    ["", "", "", "PRICE", "PRICE", "PRICE"],
  ]);
  assert.deepEqual(rows[0], ["ABC", "Brand", "Item", "100", "120", "120"]);
});
