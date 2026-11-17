import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("/new Sign in to order button stays compact", () => {
  const css = readFileSync(new URL("../app/new/new.css", import.meta.url), "utf8");
  const block = css.match(/\.new-sign-in-btn\s*\{[\s\S]*?\}/)?.[0] || "";
  assert.match(block, /font-size:\s*12px/);
  assert.match(block, /padding:\s*6px 12px/);
  assert.doesNotMatch(block, /font-size:\s*15px/);
});
