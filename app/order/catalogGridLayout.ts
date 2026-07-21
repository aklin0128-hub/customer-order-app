/** Shared catalog grid sizing for virtual + CSS grids */
export const CATALOG_COL_GAP_PX = 4;
/** Fixed vertical space between catalog rows (included in measured row height). */
export const CATALOG_ROW_GAP_PX = 15;
/** @deprecated use CATALOG_COL_GAP_PX — kept for older imports */
export const CATALOG_GRID_GAP_PX = CATALOG_COL_GAP_PX;
export const CATALOG_MIN_CARD_WIDTH_PX = 152;
export const CATALOG_MAX_COLUMNS = 14;
export const CATALOG_MIN_COLUMNS = 2;

/** Initial virtual-row height estimate; rows are measured from tallest card content. */
export const CATALOG_ROW_HEIGHT_PX = 300;

export function catalogRowEstimatePx(columnCount: number): number {
  const content =
    columnCount <= 2
      ? 320
      : columnCount <= 3
        ? 290
        : columnCount <= 4
          ? 280
          : columnCount <= 6
            ? 270
            : columnCount <= 8
              ? 260
              : 250;
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
