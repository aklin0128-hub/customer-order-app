import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCategoriesFromBody,
  productMatchesCategoryFilters,
  readProductCategories,
} from "./productCategories";

test("readProductCategories prefers categories array over legacy category", () => {
  assert.deepEqual(
    readProductCategories({ categories: ["SNACK", "DRINK"], category: "RICE" }),
    ["SNACK", "DRINK"]
  );
});

test("parseCategoriesFromBody accepts categories array", () => {
  assert.deepEqual(parseCategoriesFromBody({ categories: ["NOODLE", "FROZEN"] }), ["NOODLE", "FROZEN"]);
});

test("productMatchesCategoryFilters matches any assigned category", () => {
  const item = { sku: "TEST01", categories: ["SNACK", "DRINK"] };
  assert.equal(productMatchesCategoryFilters(item, ["DRINK"]), true);
  assert.equal(productMatchesCategoryFilters(item, ["RICE"]), false);
});
