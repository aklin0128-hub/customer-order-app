import assert from "node:assert/strict";
import { test } from "node:test";

import {
  normalizeVegePearsRecord,
  parseVegePearsSkuList,
  sortVegePearsRecords,
} from "@/lib/vegePears";

test("normalizeVegePearsRecord uppercases sku", () => {
  const record = normalizeVegePearsRecord({ sku: " ab12 ", note: " napa " });
  assert.deepEqual(record, {
    sku: "AB12",
    note: "napa",
    sortOrder: undefined,
    updatedAt: undefined,
  });
});

test("parseVegePearsSkuList dedupes tokens", () => {
  assert.deepEqual(parseVegePearsSkuList("a1, a1\nb2;c3"), ["A1", "B2", "C3"]);
});

test("sortVegePearsRecords respects sortOrder then insert order", () => {
  const sorted = sortVegePearsRecords([
    { sku: "C", sortOrder: 2 },
    { sku: "A" },
    { sku: "B", sortOrder: 1 },
  ]);
  assert.deepEqual(
    sorted.map((r) => r.sku),
    ["B", "C", "A"]
  );
});
