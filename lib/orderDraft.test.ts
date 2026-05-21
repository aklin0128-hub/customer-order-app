import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCatalogQtyMapFromDraft, countDraftItems, mergeOrderDrafts } from "@/lib/orderDraft";

test("mergeOrderDrafts prefers newer empty local draft over older cloud cart", () => {
  const local = {
    accountNo: "FL111",
    cart: [],
    catalogQtyMap: {},
    updatedAt: "2026-05-20T12:00:00.000Z",
  };
  const cloud = {
    accountNo: "FL111",
    cart: [{ sku: "01199K", qty: "1" }],
    catalogQtyMap: { "01199K": "1" },
    updatedAt: "2026-05-20T11:00:00.000Z",
  };

  const merged = mergeOrderDrafts(local, cloud);
  assert.equal(countDraftItems(merged), 0);
});

test("mergeOrderDrafts keeps cloud cart when local empty draft is older", () => {
  const local = {
    accountNo: "FL111",
    cart: [],
    catalogQtyMap: {},
    updatedAt: "2026-05-20T10:00:00.000Z",
  };
  const cloud = {
    accountNo: "FL111",
    cart: [{ sku: "01199K", qty: "1" }],
    catalogQtyMap: { "01199K": "1" },
    updatedAt: "2026-05-20T11:00:00.000Z",
  };

  const merged = mergeOrderDrafts(local, cloud);
  assert.equal(countDraftItems(merged), 1);
});

test("buildCatalogQtyMapFromDraft uses cart lines when catalogQtyMap is empty", () => {
  const map = buildCatalogQtyMapFromDraft({
    cart: [{ sku: "0013d", qty: "2" }],
    catalogQtyMap: {},
  });
  assert.deepEqual(map, { "0013D": "2" });
  assert.equal(countDraftItems({ cart: [{ sku: "0013d", qty: "2" }], catalogQtyMap: {} }), 1);
});
