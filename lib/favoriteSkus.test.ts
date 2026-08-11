import assert from "node:assert/strict";
import { test } from "node:test";

import {
  favoriteSkusStorageKey,
  normalizeFavoriteSku,
  toggleFavoriteSku,
} from "@/lib/favoriteSkus";

test("normalizeFavoriteSku uppercases and trims", () => {
  assert.equal(normalizeFavoriteSku("  ab12c  "), "AB12C");
});

test("favoriteSkusStorageKey is per account", () => {
  assert.equal(favoriteSkusStorageKey("fl111"), "favorite_skus_FL111");
  assert.equal(favoriteSkusStorageKey(""), "");
});

test("toggleFavoriteSku adds and removes", () => {
  assert.deepEqual(toggleFavoriteSku([], "rice"), ["RICE"]);
  assert.deepEqual(toggleFavoriteSku(["RICE", "WINE"], "rice"), ["WINE"]);
  assert.deepEqual(toggleFavoriteSku(["WINE"], "noodle"), ["WINE", "NOODLE"]);
});
