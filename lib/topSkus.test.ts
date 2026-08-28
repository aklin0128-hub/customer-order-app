import assert from "node:assert/strict";
import test from "node:test";

import { normalizeTopSkuRegion, topSkuRegionLabel } from "./topSkus";

test("normalizeTopSkuRegion accepts city aliases and multi-city", () => {
  assert.equal(normalizeTopSkuRegion(""), "all");
  assert.equal(normalizeTopSkuRegion("all"), "all");
  assert.equal(normalizeTopSkuRegion("multi"), "multi");
  assert.equal(normalizeTopSkuRegion("multi-city"), "multi");
  assert.equal(normalizeTopSkuRegion("miami"), "miami");
  assert.equal(normalizeTopSkuRegion("MIA"), "miami");
  assert.equal(normalizeTopSkuRegion("orlando"), "orlando");
  assert.equal(normalizeTopSkuRegion("jax"), "jacksonville");
  assert.equal(normalizeTopSkuRegion("jacksonville"), "jacksonville");
  assert.equal(normalizeTopSkuRegion("melbourne"), "melbourne");
});

test("topSkuRegionLabel", () => {
  assert.equal(topSkuRegionLabel("all"), "All / Multi-city");
  assert.equal(topSkuRegionLabel("multi"), "All / Multi-city");
  assert.equal(topSkuRegionLabel("miami"), "Miami");
  assert.equal(topSkuRegionLabel("jacksonville"), "Jacksonville");
});
