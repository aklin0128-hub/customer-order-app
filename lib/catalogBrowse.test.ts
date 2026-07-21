import assert from "node:assert/strict";
import test from "node:test";

import {
  compareSkuAsc,
  filterCatalogBrowseItems,
  mapProductsToCatalogBrowse,
  sortCatalogBrowseItems,
} from "./catalogBrowse";

test("sortCatalogBrowseItems sorts SKU numerically", () => {
  const items = [{ sku: "00010A" }, { sku: "00002D" }, { sku: "0009Z" }];
  assert.deepEqual(sortCatalogBrowseItems(items).map((item) => item.sku), ["00002D", "0009Z", "00010A"]);
  assert.ok(compareSkuAsc("00002D", "00010A") < 0);
});

test("mapProductsToCatalogBrowse strips non-catalog fields", () => {
  const items = mapProductsToCatalogBrowse(
    [
      { sku: "abc123", name: "Rice", status: "NORMAL", bp: 9.99, inventory: 100 },
      { sku: "bad sku", name: "Skip" },
    ],
    { availableOnly: false }
  );
  assert.equal(items.length, 1);
  assert.equal(items[0]?.sku, "ABC123");
  assert.equal(items[0]?.name, "Rice");
  assert.equal("bp" in (items[0] || {}), false);
});

test("mapProductsToCatalogBrowse keeps only orderable statuses by default", () => {
  const items = mapProductsToCatalogBrowse([
    { sku: "A1", status: "NORMAL" },
    { sku: "A2", status: "DISCONTINUED" },
    { sku: "A3", status: "TBD" },
    { sku: "A4", status: "READYTOORDER" },
  ]);
  assert.deepEqual(
    items.map((item) => item.sku),
    ["A1", "A3"]
  );
});

test("filterCatalogBrowseItems matches sku and upc digits", () => {
  const items = [
    { sku: "00002D", name: "Rice", upc: "081652000020" },
    { sku: "00002E", name: "Noodles" },
  ];
  assert.deepEqual(filterCatalogBrowseItems(items, "00002D").map((item) => item.sku), ["00002D"]);
  assert.deepEqual(filterCatalogBrowseItems(items, "81652000020").map((item) => item.sku), ["00002D"]);
});
