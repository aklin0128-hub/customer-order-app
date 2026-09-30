import assert from "node:assert/strict";
import { test } from "node:test";

import {
  normalizeSeasonalItemRecord,
  isSeasonalEtaPending,
  parseSeasonalItemSkuList,
  sortSeasonalItemRecords,
} from "@/lib/seasonalItems";

test("normalizeSeasonalItemRecord uppercases sku", () => {
  const record = normalizeSeasonalItemRecord({ sku: " ab12 ", note: " napa " });
  assert.deepEqual(record, {
    sku: "AB12",
    note: "napa",
    etaDate: undefined,
    sortOrder: undefined,
    updatedAt: undefined,
  });
});

test("normalizeSeasonalItemRecord keeps valid etaDate", () => {
  const record = normalizeSeasonalItemRecord({
    sku: "80000V",
    etaDate: "2026-09-15",
  });
  assert.equal(record?.etaDate, "2026-09-15");
});

test("normalizeSeasonalItemRecord drops invalid etaDate", () => {
  const record = normalizeSeasonalItemRecord({
    sku: "80000V",
    etaDate: "09/15/2026",
  });
  assert.equal(record?.etaDate, undefined);
});

test("isSeasonalEtaPending is true before ETA day", () => {
  assert.equal(isSeasonalEtaPending("2026-09-15", new Date("2026-09-14T15:00:00")), true);
  assert.equal(isSeasonalEtaPending("2026-09-15", new Date("2026-09-15T08:00:00")), false);
  assert.equal(isSeasonalEtaPending("2026-09-15", new Date("2026-09-16T08:00:00")), false);
});

test("isSeasonalEtaPending ignores missing or invalid ETA", () => {
  assert.equal(isSeasonalEtaPending("", new Date("2026-09-14")), false);
  assert.equal(isSeasonalEtaPending(undefined, new Date("2026-09-14")), false);
  assert.equal(isSeasonalEtaPending("09/15/2026", new Date("2026-09-14")), false);
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
