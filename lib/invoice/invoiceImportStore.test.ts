import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { InvoiceImportRecord } from "./invoiceImportRecord";
import {
  compactInvoiceLines,
  estimatedJsonBytes,
  invoiceLinesRedisKey,
  toInvoiceImportSummary,
  unknownSkusFromLines,
} from "./invoiceImportCompact";

const here = dirname(fileURLToPath(import.meta.url));
const uploadSrc = readFileSync(join(here, "../../app/api/admin/upload-invoice/route.ts"), "utf8");
const importsRouteSrc = readFileSync(join(here, "../../app/api/admin/invoice-imports/route.ts"), "utf8");
const analyticsSrc = readFileSync(join(here, "../analyticsCommon.ts"), "utf8");

function sampleRecord(over: Partial<InvoiceImportRecord> = {}): InvoiceImportRecord {
  return {
    id: "inv-1",
    uploadedAt: "2026-10-13T00:00:00.000Z",
    accountNo: "FL11",
    invoiceNo: "PSI-018609",
    supplierOrderNo: "SO-1",
    invoiceDate: "10/10/2026",
    blobUrl: "https://blob.example/invoices/a.pdf",
    mimeType: "application/pdf",
    extractMethod: "pdf",
    lineCount: 2,
    lines: [
      {
        sku: "000150",
        qty: 1,
        unitPrice: 15,
        lineTotal: 210,
        inCatalog: true,
        rawLine:
          "000150 RHEEHCHUN SPROUTED BROWN RICE (USA, 15#, NEW) 15 LB 8 Bag Dry 15.00 210.00",
      },
      {
        sku: "999999",
        qty: 2,
        unitPrice: 4,
        lineTotal: 8,
        inCatalog: false,
        rawLine: "999999 UNKNOWN ITEM 2 Case Dry 4.00 8.00",
      },
    ],
    warnings: [],
    appliedToHistory: true,
    ...over,
  };
}

test("compactInvoiceLines drops rawLine text", () => {
  const compact = compactInvoiceLines(sampleRecord().lines);
  assert.equal(compact.length, 2);
  assert.equal(compact[0].sku, "000150");
  assert.equal(compact[0].qty, 1);
  assert.equal(compact[0].unitPrice, 15);
  assert.equal("rawLine" in compact[0], false);
});

test("toInvoiceImportSummary stores unknown SKUs and no line bodies", () => {
  const summary = toInvoiceImportSummary(sampleRecord());
  assert.deepEqual(summary.lines, []);
  assert.equal(summary.lineCount, 2);
  assert.deepEqual(summary.unknownSkus, ["999999"]);
});

test("unknownSkusFromLines is unique and uppercased", () => {
  assert.deepEqual(
    unknownSkusFromLines([
      { sku: "aa", qty: 1, inCatalog: false },
      { sku: "AA", qty: 1, inCatalog: false },
      { sku: "BB", qty: 1, inCatalog: true },
    ]),
    ["AA"]
  );
});

test("compact list JSON stays far below Upstash 10MB when raw lines would not", () => {
  const bloated: InvoiceImportRecord[] = [];
  for (let i = 0; i < 160; i += 1) {
    bloated.push(
      sampleRecord({
        id: `inv-${i}`,
        lines: Array.from({ length: 180 }, (_, n) => ({
          sku: String(n).padStart(6, "0"),
          qty: 1,
          unitPrice: 10,
          lineTotal: 10,
          inCatalog: true,
          rawLine: `${String(n).padStart(6, "0")} LONG PRODUCT NAME WITH SIZE BAG DRY 10.00 10.00 ${"x".repeat(240)}`,
        })),
      })
    );
  }

  const bloatedBytes = estimatedJsonBytes(bloated);
  const compactBytes = estimatedJsonBytes(bloated.map(toInvoiceImportSummary));
  assert.ok(bloatedBytes > 10 * 1024 * 1024, `expected bloated list >10MB, got ${bloatedBytes}`);
  assert.ok(compactBytes < 500_000, `expected compact list <<10MB, got ${compactBytes}`);
});

test("invoice line sidecar key is per import id", () => {
  assert.equal(invoiceLinesRedisKey("abc"), "invoiceImports:lines:abc");
});

test("invoice upload persists through the split import store", () => {
  assert.match(uploadSrc, /prependInvoiceImport/);
  assert.doesNotMatch(uploadSrc, /redis\.set\(\s*IMPORT_LIST_KEY/);
  assert.match(importsRouteSrc, /saveInvoiceImportList|deleteInvoiceImport/);
  assert.match(analyticsSrc, /loadInvoiceImportsWithLines/);
});
