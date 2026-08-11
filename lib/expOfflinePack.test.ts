import test from "node:test";
import assert from "node:assert/strict";

import {
  compactCatalogForOfflinePack,
  lookupExpOffline,
  suggestExpOffline,
  type ExpOfflinePack,
} from "./expOfflinePack";

const pack: ExpOfflinePack = {
  version: 1,
  generatedAt: "2026-07-21T00:00:00.000Z",
  expMeta: { uploadedAt: "2026-07-21T00:00:00.000Z", rowCount: 1, skuCount: 1 },
  etaMeta: null,
  catalog: compactCatalogForOfflinePack([
    { sku: "10480K", name: "Carbonara", brand: "Samyang", inventory: 42 },
  ]),
  lots: [
    {
      sku: "10480K",
      description: "Samyang Carbonara",
      status: "Available",
      expireDate: "2027-01-15",
      onHandQty: 10,
    },
  ],
  etaProducts: [
    {
      pid: "10480K",
      description: "Samyang Carbonara",
      status: "NORMAL",
      availableInv: null,
      inbound: [{ portEta: "2026-08-01", inboundQty: 100 }],
    },
  ],
};

test("suggestExpOffline matches brand + name tokens", () => {
  const hits = suggestExpOffline(pack, "samyang carbo", 5);
  assert.equal(hits[0]?.sku, "10480K");
});

test("lookupExpOffline returns exp lots, eta, and onhand", () => {
  const result = lookupExpOffline(pack, "10480K");
  assert.equal(result.exp.found, true);
  assert.equal(result.eta.found, true);
  assert.equal(result.onhandInventory, 42);
  assert.equal(result.exp.lots.length, 1);
});
