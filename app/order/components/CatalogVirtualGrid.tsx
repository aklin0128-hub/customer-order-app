"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";

import { catalogVirtualScrollStyle } from "../orderStyles";
import type { CatalogItem } from "../types";
import { CatalogQtyCard } from "./CatalogQtyCard";

const MIN_COL_WIDTH = 148;
const GAP = 12;
/** Approximate row height for cards (image + text + stepper); keeps scrolling smooth */
const ROW_HEIGHT = 300;

export function CatalogVirtualGrid({
  items,
  catalogQtyMap,
  inCartLabel,
  promoBadgeLabel,
  onAdjust,
  onUpdateQty,
}: {
  items: CatalogItem[];
  catalogQtyMap: Record<string, string>;
  inCartLabel: string;
  promoBadgeLabel: string;
  onAdjust: (sku: string, delta: number) => void;
  onUpdateQty: (sku: string, value: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.offsetWidth));
    ro.observe(el);
    setWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  const columnCount = useMemo(() => {
    if (width <= 0) return 2;
    return Math.max(1, Math.floor((width + GAP) / (MIN_COL_WIDTH + GAP)));
  }, [width]);

  const rowCount = Math.max(1, Math.ceil(items.length / columnCount));

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 3,
  });

  if (items.length === 0) return null;

  return (
    <div ref={scrollRef} style={catalogVirtualScrollStyle}>
      <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {rowVirtualizer.getVirtualItems().map((vr) => {
          const rowStart = vr.index * columnCount;
          const rowItems = items.slice(rowStart, rowStart + columnCount);
          return (
            <div
              key={vr.key}
              data-index={vr.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vr.start}px)`,
                display: "grid",
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                columnGap: GAP,
                rowGap: GAP,
                paddingBottom: GAP,
              }}
            >
              {rowItems.map((item) => {
                const sku = item.sku?.toUpperCase() || "";
                const qty = catalogQtyMap[sku] || "";
                return (
                  <CatalogQtyCard
                    key={item.sku}
                    item={item}
                    qty={qty}
                    inCartLabel={inCartLabel}
                    promoBadgeLabel={promoBadgeLabel}
                    onAdjust={onAdjust}
                    onUpdateQty={onUpdateQty}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
