import assert from "node:assert/strict";
import { test } from "node:test";

import { inventoryCueKind, inventoryCueKindForItem, inventoryCueLabel } from "@/lib/inventoryCue";

test("inventoryCueKind: missing or invalid is hidden", () => {
  assert.equal(inventoryCueKind(undefined), null);
  assert.equal(inventoryCueKind(null), null);
  assert.equal(inventoryCueKind(""), null);
  assert.equal(inventoryCueKind("abc"), null);
});

test("inventoryCueKind: 0 or negative is maybe out of stock", () => {
  assert.equal(inventoryCueKind(0), "maybe_oos");
  assert.equal(inventoryCueKind("0"), "maybe_oos");
  assert.equal(inventoryCueKind(-1), "maybe_oos");
  assert.equal(inventoryCueKind(-12.5), "maybe_oos");
});

test("inventoryCueKind: below 50 is low inventory", () => {
  assert.equal(inventoryCueKind(1), "low");
  assert.equal(inventoryCueKind(49), "low");
  assert.equal(inventoryCueKind(49.9), "low");
});

test("inventoryCueKind: 50 and above is normal", () => {
  assert.equal(inventoryCueKind(50), null);
  assert.equal(inventoryCueKind(1661), null);
});

test("inventoryCueLabel matches languages", () => {
  assert.equal(inventoryCueLabel("maybe_oos", "zh"), "可能没货");
  assert.equal(inventoryCueLabel("low", "en"), "Low inventory");
  assert.equal(inventoryCueLabel(null, "en"), "");
});

test("inventoryCueKindForItem hides cues under stronger statuses", () => {
  const now = new Date("2026-09-01T12:00:00");
  assert.equal(inventoryCueKindForItem({ inventory: 0, status: "NORMAL" }, now), "maybe_oos");
  assert.equal(inventoryCueKindForItem({ inventory: 12, status: "NORMAL" }, now), "low");
  assert.equal(inventoryCueKindForItem({ inventory: 0, status: "DISCONTINUED" }, now), null);
  assert.equal(inventoryCueKindForItem({ inventory: 12, status: "DISCONTINUED" }, now), null);
  assert.equal(inventoryCueKindForItem({ inventory: 0, status: "NORMAL", outOfStock: true }, now), null);
  assert.equal(inventoryCueKindForItem({ inventory: 12, status: "NORMAL", outOfStock: true }, now), null);
  assert.equal(
    inventoryCueKindForItem(
      { inventory: 0, status: "NORMAL", isNew: true, newItemComingSoon: true },
      now
    ),
    null
  );
  assert.equal(
    inventoryCueKindForItem({ inventory: 0, status: "SEASONAL", seasonalEtaDate: "2026-09-15" }, now),
    null
  );
  assert.equal(
    inventoryCueKindForItem({ inventory: 0, status: "SEASONAL", seasonalEtaDate: "2026-08-01" }, now),
    "maybe_oos"
  );
});
