import assert from "node:assert/strict";
import test from "node:test";

import {
  expandCategoryTags,
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

test("expandCategoryTags adds DRY GOODS when RICE is selected", () => {
  assert.deepEqual(expandCategoryTags(["RICE"]), ["RICE", "DRY GOODS"]);
});

test("productMatchesCategoryFilters treats RICE as DRY GOODS for filters", () => {
  const item = { sku: "00001", categories: ["RICE"] };
  assert.equal(productMatchesCategoryFilters(item, ["DRY GOODS"]), true);
  assert.equal(productMatchesCategoryFilters(item, ["RICE"]), true);
});

test("productMatchesCategoryFilters matches any assigned category", () => {
  const item = { sku: "TEST01", categories: ["SNACK", "DRINK"] };
  assert.equal(productMatchesCategoryFilters(item, ["DRINK"]), true);
  assert.equal(productMatchesCategoryFilters(item, ["RICE"]), false);
});
