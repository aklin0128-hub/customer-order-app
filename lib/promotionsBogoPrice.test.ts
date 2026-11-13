import assert from "node:assert/strict";
import { test } from "node:test";

import { sanitizePromotionDealFields, validatePromotionInput } from "@/lib/promotions";

test("validatePromotionInput keeps promoPrice on Buy X Get Y", () => {
  const result = validatePromotionInput({
    sku: "ABC123",
    dealType: "bogo",
    buyQty: 2,
    getQtyFree: 1,
    promoPrice: "$11.50",
  });
  assert.equal(result.error, undefined);
  assert.equal(result.record?.buyQty, 2);
  assert.equal(result.record?.getQtyFree, 1);
  assert.equal(result.record?.promoPrice, "$11.50");
  assert.equal(result.record?.priceTiers, undefined);
});

test("sanitizePromotionDealFields keeps promoPrice with bogo", () => {
  const clean = sanitizePromotionDealFields({
    sku: "ABC123",
    buyQty: 3,
    getQtyFree: 1,
    promoPrice: "10.99",
    priceTiers: [{ minQty: 10, price: "9.99" }],
  });
  assert.equal(clean.promoPrice, "10.99");
  assert.equal(clean.buyQty, 3);
  assert.equal(clean.getQtyFree, 1);
  assert.equal(clean.priceTiers, undefined);
});

test("validatePromotionInput still clears promoPrice for volume tiers", () => {
  const result = validatePromotionInput({
    sku: "ABC123",
    dealType: "tiered",
    promoPrice: "$11.50",
    priceTiers: [{ minQty: 30, price: "10.00" }],
  });
  assert.equal(result.error, undefined);
  assert.equal(result.record?.promoPrice, undefined);
  assert.equal(result.record?.priceTiers?.length, 1);
});
