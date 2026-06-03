import assert from "node:assert/strict";
import test from "node:test";

import {
  expandCategoryTags,
  normalizeProductCategory,
  parseCategoriesFromBody,
  productMatchesCategoryFilters,
  readProductCategories,
} from "./productCategories";

test("readProductCategories prefers categories array over legacy category", () => {
  assert.deepEqual(
    readProductCategories({ categories: ["FRESH", "DRY"], category: "RICE" }),
    ["FRESH", "DRY"]
  );
});

test("parseCategoriesFromBody normalizes legacy categories to mains", () => {
  assert.deepEqual(parseCategoriesFromBody({ categories: ["NOODLE", "FROZEN"] }), ["DRY", "FROZEN"]);
});

test("expandCategoryTags maps RICE to DRY", () => {
  assert.deepEqual(expandCategoryTags(["RICE"]), ["DRY"]);
});

test("normalizeProductCategory maps NON-FOOD to HOUSEWARE", () => {
  assert.equal(normalizeProductCategory("NON-FOOD"), "HOUSEWARE");
});

test("productMatchesCategoryFilters uses main categories", () => {
  const item = { sku: "00001", categories: ["RICE"] };
  assert.equal(productMatchesCategoryFilters(item, ["DRY"]), true);
  assert.equal(productMatchesCategoryFilters(item, ["FRESH"]), false);
});

test("productMatchesCategoryFilters matches any assigned category", () => {
  const item = { sku: "TEST01", categories: ["SNACK", "DRINK"] };
  assert.equal(productMatchesCategoryFilters(item, ["DRY"]), true);
  assert.equal(productMatchesCategoryFilters(item, ["FRESH"]), false);
});
