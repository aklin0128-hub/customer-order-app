import assert from "node:assert/strict";
import test from "node:test";

import { isCatalogOutOfStock, readCatalogInventory } from "./catalogStock";

test("readCatalogInventory parses numbers and strings", () => {
  assert.equal(readCatalogInventory(12), 12);
  assert.equal(readCatalogInventory("0"), 0);
  assert.equal(readCatalogInventory("-3"), -3);
  assert.equal(readCatalogInventory(""), null);
  assert.equal(readCatalogInventory(undefined), null);
});

test("isCatalogOutOfStock when inventory is zero or negative", () => {
  assert.equal(isCatalogOutOfStock({ inventory: 0 }), true);
  assert.equal(isCatalogOutOfStock({ inventory: -11 }), true);
  assert.equal(isCatalogOutOfStock({ inventory: 1 }), false);
  assert.equal(isCatalogOutOfStock({ inventory: undefined }), false);
});

test("isCatalogOutOfStock when status is INV", () => {
  assert.equal(isCatalogOutOfStock({ status: "INV", inventory: 50 }), true);
});
