import assert from "node:assert/strict";
import test from "node:test";

import type { InvoiceImportRecord } from "./invoiceImportRecord";
import { compareInvoiceRecency, invoiceRecencyKey, sortImportsByRecency } from "./invoiceRecency";

function record(partial: Partial<InvoiceImportRecord> & Pick<InvoiceImportRecord, "id">): InvoiceImportRecord {
  return {
    uploadedAt: "2026-01-01T12:00:00.000Z",
    accountNo: "FL100",
    invoiceNo: null,
    supplierOrderNo: null,
    invoiceDate: null,
    blobUrl: "",
    mimeType: "application/pdf",
    extractMethod: "pdf",
    lineCount: 0,
    lines: [],
    warnings: [],
    appliedToHistory: false,
    ...partial,
  };
}

test("invoiceRecencyKey falls back to upload date when invoice date is missing", () => {
  const key = invoiceRecencyKey(
    record({
      id: "a",
      invoiceDate: null,
      uploadedAt: "2026-05-01T12:00:00.000Z",
    })
  );
  assert.ok(key);
  assert.equal(key?.effectiveDateMs, Date.parse("2026-05-01T12:00:00.000Z"));
});

test("compareInvoiceRecency prefers newer invoice date", () => {
  const older = invoiceRecencyKey(record({ id: "old", invoiceDate: "1/10/2026" }))!;
  const newer = invoiceRecencyKey(record({ id: "new", invoiceDate: "2/10/2026" }))!;
  assert.ok(compareInvoiceRecency(newer, older) > 0);
});

test("sortImportsByRecency puts newest invoice first", () => {
  const sorted = sortImportsByRecency([
    record({ id: "old", invoiceDate: "1/10/2026" }),
    record({ id: "new", invoiceDate: "3/10/2026" }),
    record({ id: "mid", invoiceDate: "2/10/2026" }),
  ]);
  assert.deepEqual(sorted.map((row) => row.id), ["new", "mid", "old"]);
});
