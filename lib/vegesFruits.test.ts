import assert from "node:assert/strict";
import { test } from "node:test";

import { isVegesFruitsItem } from "@/lib/inferCategory";

test("isVegesFruitsItem matches explicit PRODUCE category", () => {
  assert.equal(isVegesFruitsItem({ sku: "80000V", category: "PRODUCE", name: "NAPA" }), true);
  assert.equal(isVegesFruitsItem({ sku: "01135D", categories: ["PRODUCE"] }), true);
});

test("isVegesFruitsItem rejects non-produce", () => {
  assert.equal(isVegesFruitsItem({ sku: "08001", category: "NOODLE", name: "RAMEN" }), false);
  assert.equal(isVegesFruitsItem({ sku: "20001", category: "FROZEN", name: "DUMPLING" }), false);
});
