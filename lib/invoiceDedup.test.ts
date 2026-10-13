import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { duplicateKeyForInvoice, groupDuplicateInvoiceImports } from "./invoiceDedup";

const here = dirname(fileURLToPath(import.meta.url));
const invoicesPageSrc = readFileSync(join(here, "../app/admin/invoices/page.tsx"), "utf8");
const duplicatesRouteSrc = readFileSync(
  join(here, "../app/api/admin/invoice-imports/duplicates/route.ts"),
  "utf8"
);

function row(over: {
  id: string;
  uploadedAt?: string;
  accountNo?: string;
  invoiceNo?: string | null;
  invoiceDate?: string | null;
  lineCount?: number;
}) {
  return {
    uploadedAt: "2026-10-01T00:00:00.000Z",
    accountNo: "FL11",
    invoiceNo: "PSI-1",
    invoiceDate: "10/01/2026",
    lineCount: 4,
    ...over,
  };
}

test("same account and invoice number form one duplicate group", () => {
  const groups = groupDuplicateInvoiceImports([
    row({ id: "a", uploadedAt: "2026-10-02T00:00:00.000Z" }),
    row({ id: "b", uploadedAt: "2026-10-01T00:00:00.000Z", invoiceDate: "10/08/2026" }),
    row({ id: "c", accountNo: "FL11", invoiceNo: "PSI-2" }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].matchBy, "invoiceNo");
  assert.deepEqual(groups[0].imports.map((item) => item.id), ["b", "a"]);
});

test("missing invoice numbers duplicate by account and date", () => {
  const groups = groupDuplicateInvoiceImports([
    row({ id: "a", invoiceNo: "", invoiceDate: "10/10/2026" }),
    row({ id: "b", invoiceNo: null, invoiceDate: "10/10/2026", uploadedAt: "2026-10-03T00:00:00.000Z" }),
    row({ id: "c", invoiceNo: "", invoiceDate: "10/11/2026" }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].matchBy, "invoiceDate");
  assert.equal(groups[0].invoiceDate, "10/10/2026");
  assert.equal(groups[0].imports.length, 2);
});

test("numbered invoices on the same date are not grouped with unnumbered ones", () => {
  const groups = groupDuplicateInvoiceImports([
    row({ id: "a", invoiceNo: "PSI-1", invoiceDate: "10/10/2026" }),
    row({ id: "b", invoiceNo: "", invoiceDate: "10/10/2026" }),
  ]);
  assert.equal(groups.length, 0);
});

test("different accounts with the same invoice number are not duplicates", () => {
  const groups = groupDuplicateInvoiceImports([
    row({ id: "a", accountNo: "FL11", invoiceNo: "PSI-1" }),
    row({ id: "b", accountNo: "FL22", invoiceNo: "PSI-1" }),
  ]);
  assert.equal(groups.length, 0);
});

test("duplicateKeyForInvoice prefers invoice number over date", () => {
  assert.deepEqual(duplicateKeyForInvoice({ accountNo: "fl11", invoiceNo: "PSI-1", invoiceDate: "10/10/2026" }), {
    key: "no:FL11:PSI-1",
    matchBy: "invoiceNo",
  });
  assert.deepEqual(duplicateKeyForInvoice({ accountNo: "FL11", invoiceNo: "  ", invoiceDate: "10/10/2026" }), {
    key: "date:FL11:10/10/2026",
    matchBy: "invoiceDate",
  });
  assert.equal(duplicateKeyForInvoice({ accountNo: "", invoiceNo: "PSI-1" }), null);
});

test("invoices page Check duplicates uses the duplicates API", () => {
  assert.match(invoicesPageSrc, /Check duplicates/);
  assert.match(invoicesPageSrc, /\/api\/admin\/invoice-imports\/duplicates/);
  assert.match(duplicatesRouteSrc, /listDuplicateInvoiceImports/);
});
