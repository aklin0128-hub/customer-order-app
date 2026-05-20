import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { growthPct, parseQty, cleanSku } from "@/lib/analyticsPure";

describe("growthPct", () => {
  it("computes percent change", () => {
    assert.equal(growthPct(150, 100), 50);
    assert.equal(growthPct(50, 100), -50);
  });

  it("returns null when previous is zero", () => {
    assert.equal(growthPct(10, 0), null);
  });
});

describe("cleanSku", () => {
  it("normalizes sku", () => {
    assert.equal(cleanSku("  abc123  "), "ABC123");
  });
});

describe("parseQty", () => {
  it("parses numeric qty", () => {
    assert.equal(parseQty("12"), 12);
    assert.equal(parseQty("3cs"), 3);
    assert.equal(parseQty(""), 0);
  });
});
