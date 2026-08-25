import assert from "node:assert/strict";
import { test } from "node:test";

import {
  normalizeSeasonalItemRecord,
  parseSeasonalItemSkuList,
  sortSeasonalItemRecords,
} from "@/lib/seasonalItems";

test("normalizeSeasonalItemRecord uppercases sku", () => {
  const record = normalizeSeasonalItemRecord({ sku: " ab12 ", note: " napa " });
  assert.deepEqual(record, {
    sku: "AB12",
    note: "napa",
    sortOrder: undefined,
    updatedAt: undefined,
  });
});

test("parseSeasonalItemSkuList dedupes tokens", () => {
  assert.deepEqual(parseSeasonalItemSkuList("a1, a1\nb2;c3"), ["A1", "B2", "C3"]);
});

test("sortSeasonalItemRecords respects sortOrder then insert order", () => {
  const sorted = sortSeasonalItemRecords([
    { sku: "C", sortOrder: 2 },
    { sku: "A" },
    { sku: "B", sortOrder: 1 },
  ]);
  assert.deepEqual(
    sorted.map((r) => r.sku),
    ["B", "C", "A"]
  );
});
