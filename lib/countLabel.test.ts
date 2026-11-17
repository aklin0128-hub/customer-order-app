import assert from "node:assert/strict";
import test from "node:test";

import { formatCountLabel, formatLinesAndCases } from "./countLabel";

test("formatCountLabel uses English singulars", () => {
  assert.equal(formatCountLabel(1, "en", "line", "lines"), "1 line");
  assert.equal(formatCountLabel(2, "en", "line", "lines"), "2 lines");
  assert.equal(formatCountLabel(1, "zh", "line", "行"), "1 行");
});

test("formatLinesAndCases keeps a space around the dot", () => {
  assert.equal(
    formatLinesAndCases("en", 1, 4, { lines: "lines", cases: "cases" }),
    "1 line · 4 cases"
  );
});
