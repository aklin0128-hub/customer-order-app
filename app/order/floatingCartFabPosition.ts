export type FabPosition = { x: number; y: number };

export type ViewportBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type SafeInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export function fabSizeForWidth(width: number): number {
  return width >= 768 ? 68 : 64;
}

export function getViewportBox(win: {
  innerWidth: number;
  innerHeight: number;
  visualViewport?: { width: number; height: number; offsetLeft: number; offsetTop: number } | null;
}): ViewportBox {
  const vv = win.visualViewport;
  if (vv && vv.width > 0 && vv.height > 0) {
    return {
      left: vv.offsetLeft || 0,
      top: vv.offsetTop || 0,
      width: vv.width,
      height: vv.height,
    };
  }
  return { left: 0, top: 0, width: win.innerWidth, height: win.innerHeight };
}

export function parseSafeInset(value: string | null | undefined): number {
  const n = Number.parseFloat(String(value ?? "").replace(/px$/i, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function clampFabPosition(
  pos: FabPosition,
  opts: {
    size: number;
    viewport: ViewportBox;
    safeInsets?: Partial<SafeInsets>;
    minMargin?: number;
    extraBottom?: number;
    extraRight?: number;
  }
): FabPosition {
  const minMargin = opts.minMargin ?? 8;
  const insets = {
    top: opts.safeInsets?.top ?? 0,
    right: opts.safeInsets?.right ?? 0,
    bottom: opts.safeInsets?.bottom ?? 0,
    left: opts.safeInsets?.left ?? 0,
  };
  const extraBottom = opts.extraBottom ?? 0;
  const extraRight = opts.extraRight ?? 0;
  const left = opts.viewport.left + Math.max(minMargin, insets.left);
  const top = opts.viewport.top + Math.max(minMargin, insets.top);
  const right =
    opts.viewport.left + opts.viewport.width - opts.size - Math.max(minMargin, insets.right) - extraRight;
  const bottom =
    opts.viewport.top +
    opts.viewport.height -
    opts.size -
    Math.max(minMargin, insets.bottom) -
    extraBottom;
  return {
    x: Math.min(Math.max(left, pos.x), Math.max(left, right)),
    y: Math.min(Math.max(top, pos.y), Math.max(top, bottom)),
  };
}

/** Extra clearance for iPad/iOS Safari chrome that overlays the layout viewport. */
export function safariChromeClearance(viewport: ViewportBox, layoutInnerHeight: number): {
  extraBottom: number;
  extraRight: number;
} {
  const toolbarGap = Math.max(0, layoutInnerHeight - (viewport.top + viewport.height));
  const tablet = viewport.width >= 768;
  return {
    extraBottom: Math.max(toolbarGap, tablet ? 28 : 12),
    extraRight: tablet ? 8 : 0,
  };
}

export function defaultFabPosition(
  size: number,
  viewport: ViewportBox,
  extras: { extraBottom: number; extraRight: number; safeInsets?: Partial<SafeInsets> }
): FabPosition {
  const tablet = viewport.width >= 768;
  const marginX = tablet ? 24 : 14;
  const marginY = tablet ? 24 : 16;
  return clampFabPosition(
    {
      x: viewport.left + viewport.width - size - marginX,
      y: viewport.top + viewport.height - size - marginY,
    },
    {
      size,
      viewport,
      safeInsets: extras.safeInsets,
      extraBottom: extras.extraBottom,
      extraRight: extras.extraRight,
    }
  );
}
