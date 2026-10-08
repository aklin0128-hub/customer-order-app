/** Shared catalog grid sizing for virtual + CSS grids */
export const CATALOG_COL_GAP_PX = 4;
/** Fixed vertical space between catalog rows (included in measured row height). */
export const CATALOG_ROW_GAP_PX = 20;
/** @deprecated use CATALOG_COL_GAP_PX — kept for older imports */
export const CATALOG_GRID_GAP_PX = CATALOG_COL_GAP_PX;
export const CATALOG_MIN_CARD_WIDTH_PX = 152;
export const CATALOG_MAX_COLUMNS = 14;
export const CATALOG_MIN_COLUMNS = 2;

/** Initial virtual-row height estimate; rows are measured from tallest card content. */
export const CATALOG_ROW_HEIGHT_PX = 300;
/** Catalog list box is at least one full card row, then grows to fill the viewport. */
export const CATALOG_SCROLL_MIN_HEIGHT_PX = 400;
/** Extra virtual rows around the viewport. Keep low — 14-column desktops render many cards per row. */
export const CATALOG_VIRTUAL_OVERSCAN = 2;

export function catalogRowEstimatePx(columnCount: number): number {
  // Wide desktop rows used to estimate ~270px while cards (history / inventory /
  // stepper) are ~380px. A short estimate plus height:100% cards overflow into
  // the next row on first catalog paint.
  const content =
    columnCount <= 2
      ? 400
      : columnCount <= 3
        ? 390
        : columnCount <= 4
          ? 380
          : 370;
  return content + CATALOG_ROW_GAP_PX;
}

/** Row height including overflowing card content (cards are overflow:visible).
 *  Prefer offset/scrollHeight so open-catalog measure does not flush layout
 *  with getBoundingClientRect on every child. */
export function measureCatalogVirtualRow(element: {
  scrollHeight: number;
  offsetHeight?: number;
  getBoundingClientRect?: () => { height: number };
  children?: ArrayLike<{ scrollHeight?: number; offsetHeight?: number }>;
}) {
  let maxH = Math.max(element.offsetHeight || 0, element.scrollHeight || 0);
  const children = element.children;
  if (children) {
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      const h = Math.max(child.offsetHeight || 0, child.scrollHeight || 0);
      if (h > maxH) maxH = h;
    }
  }
  if (maxH) return maxH;
  return element.getBoundingClientRect?.().height || 0;
}

export function catalogColGapPx() {
  return CATALOG_COL_GAP_PX;
}

export function catalogRowGapPx() {
  return CATALOG_ROW_GAP_PX;
}

/** @deprecated use catalogColGapPx */
export function catalogGridGapPx(_columnCount?: number) {
  return CATALOG_COL_GAP_PX;
}

export function catalogRowStridePx() {
  return CATALOG_ROW_HEIGHT_PX + CATALOG_ROW_GAP_PX;
}

/** Column count from container width — scales up on wide screens, down on narrow. */
/** Stable virtual-row identity so a search/filter does not reuse stale measured rows. */
export function catalogVirtualRowKey(
  items: Array<{ sku?: string }>,
  rowIndex: number,
  columnCount: number
) {
  const cols = Math.max(1, columnCount);
  const start = rowIndex * cols;
  const skus = items
    .slice(start, start + cols)
    .map((item) => String(item.sku || "").trim().toUpperCase())
    .filter(Boolean);
  return `${rowIndex}:${skus.join("|") || "empty"}`;
}

export function catalogColumnCountForWidth(rawWidth: number): number {
  const width =
    rawWidth > 0
      ? rawWidth
      : typeof window !== "undefined"
        ? Math.max(0, window.innerWidth - 32)
        : 1024;

  if (width <= 0) return CATALOG_MIN_COLUMNS;

  const slot = CATALOG_MIN_CARD_WIDTH_PX + CATALOG_COL_GAP_PX;
  const cols = Math.floor((width + CATALOG_COL_GAP_PX) / slot);
  return Math.max(CATALOG_MIN_COLUMNS, Math.min(CATALOG_MAX_COLUMNS, cols));
}
