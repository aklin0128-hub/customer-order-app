import assert from "node:assert/strict";
import { test } from "node:test";

import {
  defaultSlipAmount,
  parseMoneyToken,
  parseStatementLineText,
  parseStatementText,
} from "@/lib/credit/parseStatement";

test("parseMoneyToken handles parentheses and dollars", () => {
  assert.equal(parseMoneyToken("(210.00)"), -210);
  assert.equal(parseMoneyToken("$7,387.46"), 7387.46);
  assert.equal(parseMoneyToken("54,583.85"), 54583.85);
});

test("parseStatementLineText extracts invoice remaining debit", () => {
  const line =
    "PSI-0178180 FL287 SO-0684097 7/12/2026 Net 30 Invoice 7,387.46 7,387.46 0.00 50,011.82";
  const parsed = parseStatementLineText(line);
  assert.ok(parsed);
  assert.equal(parsed!.document, "PSI-0178180");
  assert.equal(parsed!.code, "Invoice");
  assert.equal(parsed!.remainingDebit, 7387.46);
  assert.equal(parsed!.remainingCredit, 0);
});

test("parseStatementLineText extracts credit remaining credit", () => {
  const line =
    "SJCM-JA-FY25-01918 FL287 7/12/2026 Credit (210.00) 0.00 210.00 49,801.82";
  const parsed = parseStatementLineText(line);
  assert.ok(parsed);
  assert.equal(parsed!.document, "SJCM-JA-FY25-01918");
  assert.equal(parsed!.code, "Credit");
  assert.equal(parsed!.remainingDebit, 0);
  assert.equal(parsed!.remainingCredit, 210);
});

test("parseStatementText pulls header and multiple lines", () => {
  const text = `
STATEMENT
Account No.: FL287
Sales Code: S32
Sales Name: ELLISON LIN
Statement Date: 8/27/2026
Document Ship To Order No. Date Terms Code Original Remaining Debits Remaining Credits Balance
SJCM-JA-FY25-01918 FL287 7/12/2026 Credit (210.00) 0.00 210.00 100.00
PSI-0178180 FL287 SO-0684097 7/12/2026 Net 30 Invoice 7387.46 7387.46 0.00 7487.46
PNC-DEPOSIT-050126 FL287 5/1/2026 Payment (2486.00) 0.00 2486.00 5001.46
`;
  const parsed = parseStatementText(text);
  assert.equal(parsed.accountNo, "FL287");
  assert.equal(parsed.salesCode, "S32");
  assert.equal(parsed.salesName, "ELLISON LIN");
  assert.ok(parsed.lines.length >= 3);
  assert.ok(parsed.lines.some((l) => l.document === "SJCM-JA-FY25-01918"));
  assert.ok(parsed.lines.some((l) => l.document === "PSI-0178180"));
});

test("defaultSlipAmount uses signed remaining amounts", () => {
  assert.equal(defaultSlipAmount({ remainingDebit: 100, remainingCredit: 0 }), 100);
  assert.equal(defaultSlipAmount({ remainingDebit: 0, remainingCredit: 25 }), -25);
});
