import assert from "node:assert/strict";
import test from "node:test";

import { adminSkuSuggestFromCatalog } from "./adminSkuSuggest";
import { scoreCatalogTextSearch } from "./catalogTextSearch";

test("scoreCatalogTextSearch matches brand + partial name tokens", () => {
  const item = {
    sku: "08444K",
    brand: "SAMYANG",
    name: "CARBONARA BULDAK RAMEN (BIG BOWL)",
  };
  assert.ok(scoreCatalogTextSearch(item, "samyang carbo") >= 540);
  assert.ok(scoreCatalogTextSearch(item, "samyang carbonara") >= 540);
  assert.ok(scoreCatalogTextSearch(item, "carbo") >= 0);
  assert.ok(scoreCatalogTextSearch(item, "samyang") >= 480);
});

test("adminSkuSuggestFromCatalog finds samyang carbo", () => {
  const rows = adminSkuSuggestFromCatalog("samyang carbo", 20);
  assert.ok(rows.length > 0);
  assert.ok(rows.some((row) => /samyang/i.test(row.name) && /carbo/i.test(row.name)));
});
