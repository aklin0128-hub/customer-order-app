import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

import {
  clampFabPosition,
  defaultFabPosition,
  fabSizeForWidth,
  getViewportBox,
  parseSafeInset,
  safariChromeClearance,
} from "./floatingCartFabPosition";

test("iPad FAB is 68px", () => {
  assert.equal(fabSizeForWidth(768), 68);
  assert.equal(fabSizeForWidth(1024), 68);
  assert.equal(fabSizeForWidth(390), 64);
});

test("parseSafeInset reads px values", () => {
  assert.equal(parseSafeInset("20px"), 20);
  assert.equal(parseSafeInset("0px"), 0);
  assert.equal(parseSafeInset(""), 0);
  assert.equal(parseSafeInset("env(safe-area-inset-bottom)"), 0);
});

test("getViewportBox prefers visualViewport so iPad Safari chrome is excluded", () => {
  const box = getViewportBox({
    innerWidth: 1024,
    innerHeight: 768,
    visualViewport: { width: 1024, height: 700, offsetLeft: 0, offsetTop: 0 },
  });
  assert.equal(box.height, 700);
  assert.equal(box.width, 1024);
});

test("clamp keeps FAB inside a shrunk iPad visual viewport", () => {
  const size = 68;
  const viewport = { left: 0, top: 0, width: 1024, height: 700 };
  const clamped = clampFabPosition(
    { x: 980, y: 740 },
    { size, viewport, extraBottom: 28, extraRight: 8 }
  );
  assert.ok(clamped.x + size <= 1024 - 8);
  assert.ok(clamped.y + size <= 700 - 28);
  assert.ok(clamped.y >= 8);
});

test("stored position under Safari toolbar is lifted", () => {
  const size = 68;
  const viewport = { left: 0, top: 0, width: 810, height: 1080 };
  const clearance = safariChromeClearance(viewport, 1080);
  const clamped = clampFabPosition(
    { x: 730, y: 1040 },
    { size, viewport, extraBottom: clearance.extraBottom, extraRight: clearance.extraRight }
  );
  assert.ok(clamped.y + size + clearance.extraBottom <= 1080);
  assert.ok(clamped.y < 1040);
});

test("default iPad position sits in the visible bottom-right with chrome clearance", () => {
  const viewport = { left: 0, top: 0, width: 1024, height: 700 };
  const size = fabSizeForWidth(viewport.width);
  const extras = safariChromeClearance(viewport, 768);
  const pos = defaultFabPosition(size, viewport, extras);
  assert.ok(pos.x + size < viewport.width);
  assert.ok(pos.y + size + extras.extraBottom <= viewport.height);
  assert.ok(pos.x > viewport.width / 2);
  assert.ok(pos.y > viewport.height / 2);
});

test("visualViewport offset keeps FAB on screen after iOS toolbar collapse", () => {
  const size = 68;
  const viewport = { left: 0, top: 48, width: 1024, height: 720 };
  const clamped = clampFabPosition(
    { x: 24, y: 8 },
    { size, viewport, extraBottom: 28 }
  );
  assert.equal(clamped.y, 48 + 8);
});

test("FAB stacks above the iPad sticky header and allows taps", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const css = readFileSync(join(here, "order.css"), "utf8");
  const fabSrc = readFileSync(join(here, "components/OrderFloatingCartFab.tsx"), "utf8");
  const layoutSrc = readFileSync(join(here, "../layout.tsx"), "utf8");
  const fabBlock = css.slice(css.indexOf(".order-floating-cart-fab {"), css.indexOf(".order-floating-cart-fab-ring"));
  assert.match(fabBlock, /z-index:\s*8500;/);
  assert.match(fabBlock, /isolation:\s*isolate;/);
  assert.match(fabBlock, /touch-action:\s*manipulation;/);
  assert.match(fabSrc, /visualViewport/);
  assert.match(fabSrc, /createPortal/);
  assert.match(fabSrc, /onClick=\{onNativeClick\}/);
  assert.match(layoutSrc, /viewportFit:\s*"cover"/);
  assert.match(css, /\.order-sticky-bar\s*\{[^}]*z-index:\s*80/);
  const stickyZ = Number(css.match(/\.order-sticky-bar\s*\{[^}]*z-index:\s*(\d+)/)?.[1] || 0);
  const fabZ = Number(fabBlock.match(/z-index:\s*(\d+)/)?.[1] || 0);
  assert.ok(fabZ > stickyZ);
});
