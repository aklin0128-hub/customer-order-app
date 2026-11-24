import assert from "node:assert/strict";
import test from "node:test";

import {
  emptySalesCreditLines,
  isSalesCreditAmountInput,
  parseSalesCreditAmount,
  salesCreditRequestPdfFileName,
  salesCreditTotal,
} from "./salesCreditRequest";

test("amount input keeps a trailing decimal while typing", () => {
  assert.equal(isSalesCreditAmountInput(""), true);
  assert.equal(isSalesCreditAmountInput("12"), true);
  assert.equal(isSalesCreditAmountInput("12."), true);
  assert.equal(isSalesCreditAmountInput("12.5"), true);
  assert.equal(isSalesCreditAmountInput("12.50"), true);
  assert.equal(isSalesCreditAmountInput("12.501"), false);
  assert.equal(isSalesCreditAmountInput("12.5.0"), false);
  assert.equal(isSalesCreditAmountInput("abc"), false);
});

test("parseSalesCreditAmount accepts cents and ignores an in-progress decimal", () => {
  assert.equal(parseSalesCreditAmount(""), null);
  assert.equal(parseSalesCreditAmount("12."), 12);
  assert.equal(parseSalesCreditAmount("12.5"), 12.5);
  assert.equal(parseSalesCreditAmount("12.50"), 12.5);
});

test("PDF file name is sales-credit-request_ plus customer account", () => {
  assert.equal(salesCreditRequestPdfFileName("fl168"), "sales-credit-request_FL168.pdf");
  assert.equal(salesCreditRequestPdfFileName(" FL-123 "), "sales-credit-request_FL123.pdf");
  assert.equal(salesCreditRequestPdfFileName(""), "sales-credit-request.pdf");
});

test("empty sales credit lines include memo and amountInput", () => {
  const lines = emptySalesCreditLines();
  assert.equal(lines[0]?.amountInput, "");
  assert.equal(lines[0]?.memo, "");
  assert.equal(salesCreditTotal(lines), 0);
});
