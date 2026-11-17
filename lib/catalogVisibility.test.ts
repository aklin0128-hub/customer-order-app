import assert from "node:assert/strict";
import test from "node:test";

import { excludeHiddenFromCustomerCatalog, isHiddenFromCustomerCatalog } from "./catalogVisibility";

test("hides Wegmans brand and name matches, keeps other items", () => {
  assert.equal(isHiddenFromCustomerCatalog({ brand: "WEGMANS" }), true);
  assert.equal(isHiddenFromCustomerCatalog({ brand: "Wegmans" }), true);
  assert.equal(isHiddenFromCustomerCatalog({ brand: "WEGMANS ORGANIC" }), true);
  assert.equal(isHiddenFromCustomerCatalog({ name: "Wegmans milk 1gal" }), true);
  assert.equal(isHiddenFromCustomerCatalog({ brand: "NONGSHIM", name: "Shin Ramyun" }), false);
  assert.equal(isHiddenFromCustomerCatalog({ brand: "WEG" }), false);

  const kept = excludeHiddenFromCustomerCatalog([
    { sku: "A", brand: "NONGSHIM" },
    { sku: "B", brand: "WEGMANS" },
    { sku: "C", name: "WEGMANS BAGELS" },
  ]);
  assert.deepEqual(
    kept.map((item) => item.sku),
    ["A"]
  );
});
