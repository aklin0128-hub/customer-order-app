import assert from "node:assert/strict";
import test from "node:test";

import {
  applyProductCategoryPatch,
  expandCategoryTags,
  normalizeProductCategory,
  parseCategoriesFromBody,
  productMatchesCategoryFilters,
  readProductCategories,
  resolveCategoryPatchInput,
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

test("resolveCategoryPatchInput treats empty and AUTO as clear", () => {
  assert.deepEqual(resolveCategoryPatchInput(""), []);
  assert.deepEqual(resolveCategoryPatchInput("AUTO"), []);
  assert.deepEqual(resolveCategoryPatchInput("  frozen "), ["FROZEN"]);
  assert.equal(resolveCategoryPatchInput("NOT-A-CATEGORY"), null);
});

test("applyProductCategoryPatch only updates category fields", () => {
  const product = {
    sku: "00001",
    name: "Rice",
    status: "NORMAL",
    category: "DRY",
    categories: ["DRY"],
    brand: "A",
  };
  const frozen = applyProductCategoryPatch(product, "FROZEN");
  assert.equal(frozen.name, "Rice");
  assert.equal(frozen.status, "NORMAL");
  assert.equal(frozen.brand, "A");
  assert.equal(frozen.category, "FROZEN");
  assert.deepEqual(frozen.categories, ["FROZEN"]);

  const cleared = applyProductCategoryPatch(frozen, "");
  assert.equal(cleared.category, "");
  assert.deepEqual(cleared.categories, []);
  assert.equal(cleared.name, "Rice");
});
