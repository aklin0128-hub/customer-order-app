import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildSkuOrderHistoryIndex,
  formatSkuLastOrderedSummary,
  formatSkuOrderHistoryDate,
  getLatestSkuOrderHistoryEntry,
  sumSkuOrderHistoryCases,
} from "@/lib/skuOrderHistory";

test("buildSkuOrderHistoryIndex groups qty by SKU newest-first", () => {
  const index = buildSkuOrderHistoryIndex([
    {
      orderRef: "A2",
      createdAt: "2026-08-10T12:00:00.000Z",
      items: [
        { sku: "rice", qty: "2", unitPrice: 11.5 },
        { sku: "RICE", qty: "1" },
      ],
    },
    {
      orderRef: "A1",
      createdAt: "2026-07-01T12:00:00.000Z",
      items: [{ sku: "rice", qty: "4" }],
    },
  ]);

  assert.deepEqual(index.get("RICE"), [
    { orderRef: "A2", createdAt: "2026-08-10T12:00:00.000Z", qty: 3, unitPrice: 11.5 },
    { orderRef: "A1", createdAt: "2026-07-01T12:00:00.000Z", qty: 4 },
  ]);
  assert.equal(getLatestSkuOrderHistoryEntry(index.get("RICE"))?.qty, 3);
  assert.equal(sumSkuOrderHistoryCases(index.get("RICE")), 7);
  assert.match(formatSkuLastOrderedSummary(index.get("RICE")?.[0], "en"), /· 3$/);
});

test("formatSkuOrderHistoryDate formats valid ISO", () => {
  const text = formatSkuOrderHistoryDate("2026-08-10T12:00:00.000Z", "en");
  assert.match(text, /2026/);
  assert.match(text, /Aug|8/);
});
