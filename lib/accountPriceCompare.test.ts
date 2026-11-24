import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ACCOUNT_PRICE_COMPARE_MAX,
  accountPriceCompareCsvFileName,
  accountPriceCompareToCsv,
  accountPriceRowDiffers,
  buildAccountPriceCompareReport,
  formatAccountPriceCell,
  parseAccountPriceCompareList,
} from "./accountPriceCompare";

test("parseAccountPriceCompareList keeps up to 7 unique accounts", () => {
  assert.deepEqual(parseAccountPriceCompareList(["fl342", " FL-342 ", "FL381", ""]), ["FL342", "FL381"]);
  const many = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"];
  assert.equal(parseAccountPriceCompareList(many).length, ACCOUNT_PRICE_COMPARE_MAX);
  assert.deepEqual(parseAccountPriceCompareList(many), ["A1", "A2", "A3", "A4", "A5", "A6", "A7"]);
});

test("buildAccountPriceCompareReport uses latest invoice price per account SKU", () => {
  const report = buildAccountPriceCompareReport({
    accounts: ["FL342", "FL381", "FL116"],
    prices: [
      { account: "FL342", sku: "00030D", price: 12, invoiceDate: "2026-01-01" },
      { account: "FL381", sku: "00030D", price: 12, invoiceDate: "2026-01-02" },
      { account: "FL116", sku: "00033D", price: 24, invoiceDate: "2026-01-03" },
      { account: "FL342", sku: "00033D", price: 24, invoiceDate: "2026-01-04" },
      { account: "FL381", sku: "00033D", price: 26, invoiceDate: "2026-01-05" },
    ],
    catalog: new Map([
      ["00030D", { name: "RICE", size: "15 LB" }],
      ["00033D", { name: "RICE", size: "40LB" }],
    ]),
  });

  assert.deepEqual(report.accounts, ["FL342", "FL381", "FL116"]);
  assert.equal(report.skuCount, 2);
  assert.deepEqual(report.rows[0], {
    sku: "00030D",
    itemDesc: "RICE 15 LB",
    cells: [
      { price: 12, invoiceDate: "2026-01-01" },
      { price: 12, invoiceDate: "2026-01-02" },
      { price: null, invoiceDate: "" },
    ],
  });
  assert.equal(formatAccountPriceCell(null), "-");
  assert.equal(formatAccountPriceCell(12), "$12.00");
  assert.equal(accountPriceRowDiffers(report.rows[0]), false);
  assert.equal(accountPriceRowDiffers(report.rows[1]!), true);

  const csv = accountPriceCompareToCsv(report);
  assert.deepEqual(csv.headerRows[0], ["SKU", "item DESC", "FL342", "FL381", "FL116"]);
  assert.deepEqual(csv.rows[0], ["00030D", "RICE 15 LB", "$12.00", "$12.00", "-"]);
  assert.equal(accountPriceCompareCsvFileName(report.accounts), "price-comp_FL342-FL381-FL116.csv");
});

test("/price_comp page and API compare last invoice prices across accounts", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  assert.equal(existsSync(join(root, "app/price_comp/page.tsx")), true);
  const page = readFileSync(join(root, "app/price_comp/page.tsx"), "utf8");
  const client = readFileSync(join(root, "app/price_comp/PriceCompClient.tsx"), "utf8");
  const api = readFileSync(join(root, "app/api/comp/price-compare/route.ts"), "utf8");
  assert.match(page, /Enter password to open \/price_comp/);
  assert.match(page, /Same password as \/comp/);
  assert.match(client, /\/api\/comp\/price-compare\?/);
  assert.match(client, /ACCOUNT_PRICE_COMPARE_MAX/);
  assert.match(client, /Export CSV/);
  assert.match(api, /getInvoiceLatestPrices/);
  assert.match(api, /buildAccountPriceCompareReport/);
});
