import assert from "node:assert/strict";
import { test } from "node:test";

import {
  defaultSlipAmount,
  parseMoneyToken,
  parseStatementLineText,
  parseStatementText,
  resolveRemainingAmounts,
} from "@/lib/credit/parseStatement";

test("parseMoneyToken handles parentheses and dollars", () => {
  assert.equal(parseMoneyToken("(210.00)"), -210);
  assert.equal(parseMoneyToken("$7,387.46"), 7387.46);
  assert.equal(parseMoneyToken("54,583.85"), 54583.85);
});

test("resolveRemainingAmounts does not treat balance as remaining credit", () => {
  // Invoice: Original, Remaining Debit, Balance (Remaining Credit blank in PDF)
  const invoice = resolveRemainingAmounts("Invoice", [11002.96, 11002.96, 10688.96]);
  assert.equal(invoice.remainingDebit, 11002.96);
  assert.equal(invoice.remainingCredit, 0);

  // Credit: Original, Remaining Credit, Balance
  const credit = resolveRemainingAmounts("Credit", [-160, 160, -160]);
  assert.equal(credit.remainingDebit, 0);
  assert.equal(credit.remainingCredit, 160);
});

test("parseStatementLineText extracts invoice remaining debit only", () => {
  const line =
    "PSI-0179794 FL432 SO-0686078 7/10/2026 Net 30 Invoice 11,002.96 11,002.96 10,688.96";
  const parsed = parseStatementLineText(line);
  assert.ok(parsed);
  assert.equal(parsed!.document, "PSI-0179794");
  assert.equal(parsed!.code, "Invoice");
  assert.equal(parsed!.remainingDebit, 11002.96);
  assert.equal(parsed!.remainingCredit, 0);
});

test("parseStatementLineText extracts credit remaining credit only", () => {
  const line = "SJCM-GU-FY25-04856 6/22/2026 Credit (160.00) 160.00 (160.00)";
  const parsed = parseStatementLineText(line);
  assert.ok(parsed);
  assert.equal(parsed!.document, "SJCM-GU-FY25-04856");
  assert.equal(parsed!.code, "Credit");
  assert.equal(parsed!.remainingDebit, 0);
  assert.equal(parsed!.remainingCredit, 160);
});

test("parseStatementText pulls FL432-style statement rows", () => {
  const text = `
STATEMENT
Account No.: FL432
Sales Code: S32
Sales Name: ELLISON LIN
Statement Date: 8/27/2026
Document Ship To Order No. Date Terms Code Original Amount Remaining Debits Remaining Credits Balance
SJCM-GU-FY25-04856 6/22/2026 Credit (160.00) 160.00 (160.00)
SJCM-JA-FY27-00065 7/6/2026 Credit (154.00) 154.00 (314.00)
PSI-0179794 FL432 SO-0686078 7/10/2026 Net 30 Invoice 11,002.96 11,002.96 10,688.96
SJCM-CU-FY27-00077 7/21/2026 Credit (113.00) 113.00 10,575.96
PSI-0181009 FL432 SO-0687337 7/27/2026 Net 30 Invoice 8,283.34 8,283.34 18,859.30
SJCM-CU-FY27-00257 8/5/2026 Credit (81.00) 81.00 18,778.30
PSI-0181933 FL432 SO-0688538 8/8/2026 Net 30 Invoice 14,199.59 14,199.59 32,977.89
SJCM-JA-FY27-00564 8/21/2026 Credit (146.00) 146.00 32,831.89
`;
  const parsed = parseStatementText(text);
  assert.equal(parsed.accountNo, "FL432");
  assert.equal(parsed.lines.length, 8);

  const inv = parsed.lines.find((l) => l.document === "PSI-0179794");
  assert.ok(inv);
  assert.equal(inv!.remainingDebit, 11002.96);
  assert.equal(inv!.remainingCredit, 0);

  const credit = parsed.lines.find((l) => l.document === "SJCM-GU-FY25-04856");
  assert.ok(credit);
  assert.equal(credit!.remainingCredit, 160);
  assert.equal(credit!.remainingDebit, 0);

  const inv2 = parsed.lines.find((l) => l.document === "PSI-0181009");
  assert.ok(inv2);
  assert.equal(inv2!.remainingDebit, 8283.34);
  assert.equal(inv2!.remainingCredit, 0);
});

test("defaultSlipAmount uses signed remaining amounts", () => {
  assert.equal(defaultSlipAmount({ remainingDebit: 100, remainingCredit: 0 }), 100);
  assert.equal(defaultSlipAmount({ remainingDebit: 0, remainingCredit: 25 }), -25);
});
