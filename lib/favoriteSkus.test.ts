import assert from "node:assert/strict";
import { test } from "node:test";

import {
  favoriteSkusRedisKey,
  favoriteSkusStorageKey,
  mergeFavoriteSkusPayloads,
  normalizeFavoriteSku,
  normalizeFavoriteSkusPayload,
  toggleFavoriteSku,
} from "@/lib/favoriteSkus";

test("normalizeFavoriteSku uppercases and trims", () => {
  assert.equal(normalizeFavoriteSku("  ab12c  "), "AB12C");
});

test("favoriteSkusStorageKey is per account", () => {
  assert.equal(favoriteSkusStorageKey("fl111"), "favorite_skus_FL111");
  assert.equal(favoriteSkusStorageKey(""), "");
});

test("favoriteSkusRedisKey is per account", () => {
  assert.equal(favoriteSkusRedisKey("fl111"), "favoriteSkus:FL111");
  assert.equal(favoriteSkusRedisKey(""), "");
});

test("toggleFavoriteSku adds and removes", () => {
  assert.deepEqual(toggleFavoriteSku([], "rice"), ["RICE"]);
  assert.deepEqual(toggleFavoriteSku(["RICE", "WINE"], "rice"), ["WINE"]);
  assert.deepEqual(toggleFavoriteSku(["WINE"], "noodle"), ["WINE", "NOODLE"]);
});

test("normalizeFavoriteSkusPayload accepts legacy array", () => {
  const payload = normalizeFavoriteSkusPayload("fl111", ["a", "A", " b "]);
  assert.deepEqual(payload, { accountNo: "FL111", skus: ["A", "B"], updatedAt: 0 });
});

test("mergeFavoriteSkusPayloads unions legacy lists then stamps updatedAt", () => {
  const merged = mergeFavoriteSkusPayloads(
    { accountNo: "FL111", skus: ["A"], updatedAt: 0 },
    { accountNo: "FL111", skus: ["B"], updatedAt: 0 }
  );
  assert.ok(merged);
  assert.deepEqual(merged.skus.sort(), ["A", "B"]);
  assert.ok(merged.updatedAt > 0);
});

test("mergeFavoriteSkusPayloads prefers newer stamp", () => {
  const merged = mergeFavoriteSkusPayloads(
    { accountNo: "FL111", skus: ["A"], updatedAt: 100 },
    { accountNo: "FL111", skus: ["B"], updatedAt: 200 }
  );
  assert.deepEqual(merged?.skus, ["B"]);
  assert.equal(merged?.updatedAt, 200);
});
