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

export function catalogRowEstimatePx(columnCount: number): number {
  // Prefer a slightly tall first-paint estimate so search result rows (often
  // 1–2 cards) do not overlap the + button before measureElement runs.
  const content =
    columnCount <= 2
      ? 380
      : columnCount <= 3
        ? 350
        : columnCount <= 4
          ? 330
          : columnCount <= 6
            ? 310
            : columnCount <= 8
              ? 290
              : 270;
  return content + CATALOG_ROW_GAP_PX;
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
