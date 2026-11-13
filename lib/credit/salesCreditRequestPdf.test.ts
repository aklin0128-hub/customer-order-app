import assert from "node:assert/strict";
import test from "node:test";

import { emptySalesCreditLines } from "@/lib/credit/salesCreditRequest";
import { buildSalesCreditRequestPdf } from "@/lib/credit/salesCreditRequestPdf";

test("sales credit request PDF starts with %PDF and includes form values", async () => {
  const bytes = await buildSalesCreditRequestPdf({
    form: {
      salesId: "S32",
      customerNo: "FL168",
      customerName: "TAN TIEN",
      dateOfRequest: "11/13/2026",
      customerEmail: "ELIN@RHEEBROS.COM",
      invoiceNo: "INV-100",
      invoiceDate: "11/1/2026",
      lines: emptySalesCreditLines().map((line) =>
        line.reason === "Damage"
          ? { ...line, amount: 12.5, itemDetail: "2 cs broken" }
          : line
      ),
    },
  });
  const head = Buffer.from(bytes.slice(0, 5)).toString("latin1");
  assert.equal(head, "%PDF-");
  assert.ok(bytes.length > 800);
});
