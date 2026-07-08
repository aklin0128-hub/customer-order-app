import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCatalogQtyMapFromDraft,
  countDraftItems,
  mergeCatalogQtyMaps,
  mergeOrderDrafts,
} from "@/lib/orderDraft";

test("mergeOrderDrafts keeps cloud cart when local empty draft is newer", () => {
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
  assert.equal(countDraftItems(merged), 1);
  assert.equal(buildCatalogQtyMapFromDraft(merged)["01199K"], "1");
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

test("mergeOrderDrafts unions distinct SKUs from local and cloud", () => {
  const local = {
    accountNo: "FL111",
    catalogQtyMap: { "00100": "2", "00200": "1" },
    updatedAt: "2026-05-20T10:00:00.000Z",
  };
  const cloud = {
    accountNo: "FL111",
    catalogQtyMap: { "00300": "3" },
    updatedAt: "2026-05-20T11:00:00.000Z",
  };

  const merged = mergeOrderDrafts(local, cloud);
  assert.equal(countDraftItems(merged), 3);
  assert.deepEqual(buildCatalogQtyMapFromDraft(merged), {
    "00100": "2",
    "00200": "1",
    "00300": "3",
  });
});

test("mergeOrderDrafts uses newer qty when the same SKU exists on both sides", () => {
  const local = {
    accountNo: "FL111",
    catalogQtyMap: { "00100": "5" },
    updatedAt: "2026-05-20T12:00:00.000Z",
  };
  const cloud = {
    accountNo: "FL111",
    catalogQtyMap: { "00100": "2" },
    updatedAt: "2026-05-20T11:00:00.000Z",
  };

  const merged = mergeOrderDrafts(local, cloud);
  assert.equal(buildCatalogQtyMapFromDraft(merged)["00100"], "5");
});

test("mergeCatalogQtyMaps unions lines and prefers newer side on conflicts", () => {
  const merged = mergeCatalogQtyMaps(
    { "00100": "5", "00200": "1" },
    { "00100": "2", "00300": "3" },
    Date.parse("2026-05-20T12:00:00.000Z"),
    Date.parse("2026-05-20T11:00:00.000Z")
  );

  assert.deepEqual(merged, {
    "00100": "5",
    "00200": "1",
    "00300": "3",
  });
});

test("buildCatalogQtyMapFromDraft uses cart lines when catalogQtyMap is empty", () => {
  const map = buildCatalogQtyMapFromDraft({
    cart: [{ sku: "0013d", qty: "2" }],
    catalogQtyMap: {},
  });
  assert.deepEqual(map, { "0013D": "2" });
  assert.equal(countDraftItems({ cart: [{ sku: "0013d", qty: "2" }], catalogQtyMap: {} }), 1);
});
