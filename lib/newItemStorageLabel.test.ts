import assert from "node:assert/strict";
import test from "node:test";

import {
  mainCategoryToNewItemStorageLabel,
  resolveNewItemStorageLabel,
} from "./newItemStorageLabel";

test("resolveNewItemStorageLabel uses admin category over stale stored label", () => {
  assert.equal(
    resolveNewItemStorageLabel({
      category: "FROZEN",
      newItemStorageLabel: "DRY",
    }),
    "FROZEN"
  );
});

test("mainCategoryToNewItemStorageLabel maps HOUSEWARE to DRY", () => {
  assert.equal(mainCategoryToNewItemStorageLabel("HOUSEWARE"), "DRY");
  assert.equal(resolveNewItemStorageLabel({ categories: ["HOUSEWARE"] }), "DRY");
});

test("resolveNewItemStorageLabel falls back to stored label when category is unset", () => {
  assert.equal(resolveNewItemStorageLabel({ newItemStorageLabel: "FRESH" }), "FRESH");
});
