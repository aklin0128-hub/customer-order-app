import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInvoicePriceMap,
  estimateOrderSales,
} from "./weeklySalesReport";
import { weeklySalesReportToXlsxBuffer } from "./weeklySalesReportXlsx";

test("estimateOrderSales sums qty × invoice price", () => {
  const map = buildInvoicePriceMap([
    { account: "FL111", sku: "00100", price: 10 },
    { account: "FL111", sku: "00200", price: 5.5 },
  ]);

  assert.equal(
    estimateOrderSales("FL111", [{ sku: "00100", qty: "2" }, { sku: "00200", qty: "1" }], map),
    25.5
  );
});

test("estimateOrderSales returns null when no priced lines", () => {
  const map = buildInvoicePriceMap([{ account: "FL111", sku: "00100", price: 10 }]);
  assert.equal(estimateOrderSales("FL111", [{ sku: "99999", qty: "1" }], map), null);
});

test("weeklySalesReportToXlsxBuffer creates S70 sheet", () => {
  const buffer = weeklySalesReportToXlsxBuffer({
    meta: {
      reportDate: "6/24/2026",
      regionCode: "SE",
      sid: "S32",
      visitArea: "MIAMI",
      marketOverview: "Stable demand",
      productUpdate: "",
      competitorInsight: "",
      suggestions: "",
      periodLabel: "6/10/2026 → 6/24/2026",
      region: "miami",
      regionLabel: "Miami",
      orderCount: 1,
      totalSales: 1234.5,
      averageGpPercent: 22.5,
    },
    rows: [
      {
        weekday: "Mon",
        cid: "FL111",
        storeName: "DEMO",
        sales: 1234.5,
        gpPercent: 22.5,
        insights: "WHOLESALER",
        notes: "",
        orderRef: "FL111-0624",
        orderDate: "6/24/2026",
      },
    ],
  });

  assert.ok(buffer.length > 100);
});
