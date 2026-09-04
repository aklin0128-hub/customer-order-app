import assert from "node:assert/strict";
import test from "node:test";

import { isAdminUnlockSearch } from "./adminUnlock";

test("isAdminUnlockSearch accepts admin=1/true/yes", () => {
  assert.equal(isAdminUnlockSearch("?admin=1"), true);
  assert.equal(isAdminUnlockSearch("admin=true"), true);
  assert.equal(isAdminUnlockSearch("?foo=1&admin=yes"), true);
});

test("isAdminUnlockSearch rejects missing or other values", () => {
  assert.equal(isAdminUnlockSearch(""), false);
  assert.equal(isAdminUnlockSearch("?admin=0"), false);
  assert.equal(isAdminUnlockSearch("?q=rice"), false);
});
