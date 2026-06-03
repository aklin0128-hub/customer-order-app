/** Shared catalog grid sizing for virtual + CSS grids */
export const CATALOG_GRID_GAP_PX = 8;
export const CATALOG_MIN_CARD_WIDTH_PX = 164;
export const CATALOG_MAX_COLUMNS = 12;
export const CATALOG_MIN_COLUMNS = 2;

/**
 * Fixed virtual row content height (badge + image + text + stepper).
 * Do not use dynamic measure — variable card content caused uneven row gaps when switching tabs.
 */
export const CATALOG_ROW_HEIGHT_PX = 340;

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
