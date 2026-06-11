"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  catalogColumnCountForWidth,
  CATALOG_GRID_GAP_PX,
} from "@/app/order/catalogGridLayout";
import type { Lang } from "@/app/order/types";
import type { CatalogBrowseItem } from "@/lib/catalogBrowse";

import { CatalogInfoCard } from "./CatalogInfoCard";

const GAP = CATALOG_GRID_GAP_PX;
const ROW_HEIGHT = 272;

function readScrollContainerWidth(el: HTMLElement | null) {
  if (!el) return 0;
  const w = el.clientWidth || el.offsetWidth;
  return w > 0 ? w : 0;
}

export function CatalogBrowseGrid({
  items,
  lang,
  sizeLabel,
  palletLabel,
  upcLabel,
  categoryLabel,
}: {
  items: CatalogBrowseItem[];
  lang: Lang;
  sizeLabel: string;
  palletLabel: string;
  upcLabel: string;
  categoryLabel: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(() =>
    typeof window !== "undefined" ? Math.max(0, window.innerWidth - 32) : 0
  );

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const measure = () => {
      const next = readScrollContainerWidth(el);
      if (next > 0) setWidth(next);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [items.length]);

  const columnCount = useMemo(() => {
    if (width > 0) return catalogColumnCountForWidth(width);
    if (typeof window !== "undefined") return catalogColumnCountForWidth(window.innerWidth - 32);
    return 4;
  }, [width]);

  const rowCount = Math.max(1, Math.ceil(items.length / columnCount));
  const rowStride = ROW_HEIGHT + GAP;

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowStride,
    overscan: 3,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [columnCount, items.length]);

  if (items.length === 0) return null;

  return (
    <div ref={scrollRef} className="catalog-grid-scroll order-catalog-virtual-scroll">
      <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {rowVirtualizer.getVirtualItems().map((vr) => {
          const rowStart = vr.index * columnCount;
          const rowItems = items.slice(rowStart, rowStart + columnCount);
          return (
            <div
              key={vr.key}
              data-index={vr.index}
              className="order-catalog-virtual-row"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: ROW_HEIGHT,
                paddingBottom: GAP,
                boxSizing: "content-box",
                transform: `translateY(${vr.start}px)`,
                display: "grid",
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                alignItems: "stretch",
                columnGap: GAP,
              }}
            >
              {rowItems.map((item) => (
                <CatalogInfoCard
                  key={item.sku}
                  item={item}
                  lang={lang}
                  sizeLabel={sizeLabel}
                  palletLabel={palletLabel}
                  upcLabel={upcLabel}
                  categoryLabel={categoryLabel}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
