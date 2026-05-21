"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";

import { catalogVirtualScrollStyle } from "../orderStyles";
import type { CatalogItem } from "../types";
import { CatalogQtyCard } from "./CatalogQtyCard";

const MIN_COL_WIDTH = 136;
const GAP = 12;
const MAX_CATALOG_WIDTH = 980;
/** Approximate row height for cards (image + text + stepper); keeps scrolling smooth */
const ROW_HEIGHT = 300;

function columnCountForWidth(rawWidth: number) {
  const width =
    rawWidth > 0
      ? rawWidth
      : typeof window !== "undefined"
        ? Math.min(MAX_CATALOG_WIDTH, window.innerWidth - 40)
        : MAX_CATALOG_WIDTH;
  const calculated = Math.max(1, Math.floor((width + GAP) / (MIN_COL_WIDTH + GAP)));
  if (width >= 760) return Math.max(3, calculated);
  return calculated;
}

export function CatalogVirtualGrid({
  items,
  catalogQtyMap,
  inCartLabel,
  promoBadgeLabel,
  weeklyPickSkus,
  clearancePickSkus,
  newItemChecker,
  clearanceBadgeLabel,
  newBadgeLabel,
  editLabel,
  showAdminEdit,
  onAdjust,
  onUpdateQty,
}: {
  items: CatalogItem[];
  catalogQtyMap: Record<string, string>;
  inCartLabel: string;
  promoBadgeLabel: string;
  weeklyPickSkus?: Set<string>;
  clearancePickSkus?: Set<string>;
  newItemChecker?: (item: CatalogItem) => boolean;
  clearanceBadgeLabel?: string;
  newBadgeLabel?: string;
  editLabel?: string;
  showAdminEdit?: boolean;
  onAdjust: (sku: string, delta: number) => void;
  onUpdateQty: (sku: string, value: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const measure = () => {
      const next = el.offsetWidth;
      if (next > 0) setWidth(next);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);

    const raf = requestAnimationFrame(measure);
    const timer = window.setTimeout(measure, 100);
    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
    };
  }, [items.length]);

  const columnCount = useMemo(() => columnCountForWidth(width), [width]);

  const rowCount = Math.max(1, Math.ceil(items.length / columnCount));

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 3,
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [columnCount, rowCount]);

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
                const isWeekly = weeklyPickSkus?.has(sku);
                const isClearance = clearancePickSkus?.has(sku);
                const isNew = newItemChecker?.(item);
                const promoNote = isWeekly
                  ? promoBadgeLabel
                  : isClearance
                    ? clearanceBadgeLabel || promoBadgeLabel
                    : isNew
                      ? newBadgeLabel
                      : undefined;
                return (
                  <CatalogQtyCard
                    key={item.sku}
                    item={item}
                    qty={qty}
                    promoNote={promoNote}
                    inCartLabel={inCartLabel}
                    promoBadgeLabel={promoBadgeLabel}
                    highlight={Boolean(isWeekly || isClearance)}
                    editLabel={editLabel}
                    showAdminEdit={showAdminEdit}
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
