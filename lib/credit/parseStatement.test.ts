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

test("parseStatementText pulls FL83-style rows including NSF refund and last credit", () => {
  const text = `
STATEMENT
Account No.: FL83
Document Ship To Customer No. Order No. Date Terms Code Original Amount Remaining Debits Remaining Credits Balance
PSI-0155832 FL83 SO-0658729 9/3/2025 Net 45 Invoice 16,007.81 0.01 0.01
PSI-0159706 FL83 SO-0663373 10/22/2025 Net 45 Invoice 7,988.62 164.09 164.10
SJCM-TR-FY25-04330 1/16/2026 Credit (230.30) 230.30 (66.20)
PSI-0167382 FL83 SO-0671794 1/31/2026 Net 45 Invoice 10,140.79 114.97 48.77
SJCM-GU-FY25-03571 2/3/2026 Credit (246.00) 246.00 (197.23)
SJCM-JA-FY25-01952 3/11/2026 Credit (48.17) 48.17 (245.40)
NSF-FY25-00139 3/24/2026 Refund 35.00 35.00 (210.40)
PSI-0174971 FL83 SO-0680439 5/8/2026 Net 45 Invoice 17,731.44 17,731.44 17,521.04
SJCM-JA-FY25-02720 5/18/2026 Credit (163.50) 163.50 17,357.54
SJCM-JA-FY25-02776 5/19/2026 Credit (100.00) 100.00 17,257.54
PSI-0176120 FL83 SO-0681763 5/23/2026 Net 45 Invoice 10,559.37 10,559.37 27,816.91
PSI-0178181 FL83 SO-0684340 6/19/2026 Net 45 Invoice 14,150.87 14,150.87 41,967.78
SJCM-JA-FY27-00045 7/6/2026 Credit (160.00) 160.00 41,807.78
PSI-0179415 FL83 SO-0685371 7/7/2026 Net 45 Invoice 9,052.00 9,052.00 50,859.78
PSI-0180322 FL83 SO-0686508 7/17/2026 Net 45 Invoice 12,820.11 12,820.11 63,679.89
SJCM-CU-FY27-00079 7/21/2026 Credit (93.00) 93.00 63,586.89
SJCM-CU-FY27-00119 7/22/2026 Credit (120.00) 120.00 63,466.89
PSI-0182420 FL83 SO-0688977 8/14/2026 Net 45 Invoice 25,375.02 25,375.02 88,841.91
SJCM-GU-FY27-00225 8/25/2026 Credit (244.80) 244.80 88,597.11
`;
  // Concatenated PDF-style text (no newlines between docs) must still recover every row.
  const collapsed = text.replace(/\n+/g, " ");
  const parsed = parseStatementText(collapsed);
  assert.equal(parsed.lines.length, 19);

  const nsf = parsed.lines.find((l) => l.document === "NSF-FY25-00139");
  assert.ok(nsf);
  assert.equal(nsf!.code, "Refund");
  assert.equal(nsf!.remainingDebit, 35);
  assert.equal(nsf!.remainingCredit, 0);

  const last = parsed.lines.find((l) => l.document === "SJCM-GU-FY27-00225");
  assert.ok(last);
  assert.equal(last!.code, "Credit");
  assert.equal(last!.remainingCredit, 244.8);
  assert.equal(last!.remainingDebit, 0);

  assert.equal(parsed.lines[0]!.document, "PSI-0155832");
  assert.equal(parsed.lines[parsed.lines.length - 1]!.document, "SJCM-GU-FY27-00225");
});

test("defaultSlipAmount uses signed remaining amounts", () => {
  assert.equal(defaultSlipAmount({ remainingDebit: 100, remainingCredit: 0 }), 100);
  assert.equal(defaultSlipAmount({ remainingDebit: 0, remainingCredit: 25 }), -25);
});
