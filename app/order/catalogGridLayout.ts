/** Shared catalog grid sizing for virtual + CSS grids */
export const CATALOG_GRID_GAP_PX = 8;
export const CATALOG_MIN_CARD_WIDTH_PX = 168;
export const CATALOG_MAX_COLUMNS = 12;
export const CATALOG_MIN_COLUMNS = 2;

/** Initial virtual-row height estimate; rows are measured from tallest card content. */
export const CATALOG_ROW_HEIGHT_PX = 360;

export function catalogRowEstimatePx(columnCount: number): number {
  if (columnCount <= 2) return 360;
  if (columnCount <= 3) return 320;
  if (columnCount <= 4) return 330;
  if (columnCount <= 6) return 340;
  return CATALOG_ROW_HEIGHT_PX;
}

export function catalogGridGapPx(columnCount: number): number {
  return columnCount <= 2 ? 6 : CATALOG_GRID_GAP_PX;
}

export function catalogRowStridePx() {
  return CATALOG_ROW_HEIGHT_PX + CATALOG_GRID_GAP_PX;
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

  const slot = CATALOG_MIN_CARD_WIDTH_PX + CATALOG_GRID_GAP_PX;
  const cols = Math.floor((width + CATALOG_GRID_GAP_PX) / slot);
  return Math.max(CATALOG_MIN_COLUMNS, Math.min(CATALOG_MAX_COLUMNS, cols));
}
