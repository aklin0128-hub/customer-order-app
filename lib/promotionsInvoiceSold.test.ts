import assert from "node:assert/strict";
import test from "node:test";

import {
  applyPromotionSoldIncrements,
  isSaleDateWithinPromotionWindow,
  parsePromotionSaleDate,
  type PromotionRecord,
} from "./promotions";

test("parsePromotionSaleDate accepts ISO and US invoice dates", () => {
  assert.equal(parsePromotionSaleDate("2026-08-10")?.toISOString().slice(0, 10), "2026-08-10");
  const us = parsePromotionSaleDate("8/10/2026");
  assert.ok(us);
  assert.equal(us.getFullYear(), 2026);
  assert.equal(us.getMonth(), 7);
  assert.equal(us.getDate(), 10);
});

test("isSaleDateWithinPromotionWindow is inclusive and open-ended", () => {
  assert.equal(
    isSaleDateWithinPromotionWindow(
      { startDate: "2026-08-01", endDate: "2026-08-31" },
      "2026-08-01"
    ),
    true
  );
  assert.equal(
    isSaleDateWithinPromotionWindow(
      { startDate: "2026-08-01", endDate: "2026-08-31" },
      "8/31/2026"
    ),
    true
  );
  assert.equal(
    isSaleDateWithinPromotionWindow(
      { startDate: "2026-08-01", endDate: "2026-08-31" },
      "2026-09-01"
    ),
    false
  );
  assert.equal(
    isSaleDateWithinPromotionWindow({ startDate: "2026-08-01" }, "2026-12-01"),
    true
  );
  assert.equal(isSaleDateWithinPromotionWindow({ endDate: "2026-08-31" }, "2026-01-01"), true);
  assert.equal(isSaleDateWithinPromotionWindow({}, "2026-08-10"), true);
  assert.equal(isSaleDateWithinPromotionWindow({ startDate: "2026-08-01" }, null), false);
});

test("applyPromotionSoldIncrements counts invoice only inside valid window for limited qty", () => {
  const records: PromotionRecord[] = [
    {
      sku: "PROMO1",
      promoQty: 100,
      soldQty: 10,
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    },
    {
      sku: "PROMO2",
      promoQty: 50,
      soldQty: 0,
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    },
    {
      sku: "OPEN",
      // unlimited — never counts
      soldQty: 0,
    },
  ];

  const inside = applyPromotionSoldIncrements(
    records,
    [
      { sku: "PROMO1", qty: 3 },
      { sku: "PROMO2", qty: 2 },
      { sku: "OPEN", qty: 5 },
    ],
    { saleDate: "8/10/2026", onlyWithinValidWindow: true }
  );

  assert.equal(inside.changed, true);
  assert.equal(inside.next.find((r) => r.sku === "PROMO1")?.soldQty, 13);
  assert.equal(inside.next.find((r) => r.sku === "PROMO2")?.soldQty, 0);
  assert.equal(inside.next.find((r) => r.sku === "OPEN")?.soldQty, 0);

  const outside = applyPromotionSoldIncrements(
    records,
    [{ sku: "PROMO1", qty: 3 }],
    { saleDate: "2026-09-01", onlyWithinValidWindow: true }
  );
  assert.equal(outside.changed, false);
  assert.equal(outside.next.find((r) => r.sku === "PROMO1")?.soldQty, 10);
});

test("applyPromotionSoldIncrements without window still counts limited qty (app orders)", () => {
  const records: PromotionRecord[] = [
    { sku: "PROMO1", promoQty: 100, soldQty: 10, endDate: "2026-01-01" },
  ];
  const result = applyPromotionSoldIncrements(records, [{ sku: "PROMO1", qty: 2 }]);
  assert.equal(result.changed, true);
  assert.equal(result.next[0]?.soldQty, 12);
});
