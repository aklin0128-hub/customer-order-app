"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { ListItemButton } from "./admin-utils";
import { isJustAddedItem } from "@/lib/catalogNewItems";

const ROW_GAP = 8;
const ROW_ESTIMATE = 92;

export type AdminProductListItem = {
  sku: string;
  name?: string;
  brand?: string;
  status?: string;
  imageUrl?: string;
  source?: string;
  isNew?: boolean;
  justAdded?: boolean;
};

function productImageSrc(sku: string, imageUrl?: string) {
  if (imageUrl) return imageUrl;
  if (sku) return `/product/${sku}.jpg`;
  return "";
}

function isNewProduct(p: AdminProductListItem) {
  return Boolean(p.isNew);
}

function StatusBadge({ status }: { status?: string }) {
  const label = String(status || "NORMAL").trim() || "NORMAL";
  const tone =
    label === "DISCONTINUED"
      ? { background: "#fef2f2", color: "#b91c1c" }
      : label === "NEW" || label === "LIMITED"
        ? { background: "#fffbeb", color: "#b45309" }
        : { background: "#f3f4f6", color: "#4b5563" };
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 900,
        padding: "3px 8px",
        borderRadius: 999,
        ...tone,
      }}
    >
      {label}
    </span>
  );
}

function NewBadge() {
  return (
    <span style={{ fontSize: 10, fontWeight: 900, padding: "3px 8px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8" }}>
      NEW
    </span>
  );
}

function JustAddedBadge() {
  return (
    <span style={{ fontSize: 10, fontWeight: 900, padding: "3px 8px", borderRadius: 999, background: "#fef2f2", color: "#dc2626" }}>
      JUST ADDED
    </span>
  );
}

export function AdminProductsVirtualList({
  items,
  selectedSku,
  selectedSkus,
  onToggleSelect,
  onSelectProduct,
}: {
  items: AdminProductListItem[];
  selectedSku: string;
  selectedSkus: string[];
  onToggleSelect: (sku: string) => void;
  onSelectProduct: (product: AdminProductListItem) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE + ROW_GAP,
    overscan: 8,
  });

  return (
    <div ref={parentRef} className="admin-products-virtual-list">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((vr) => {
          const p = items[vr.index];
          if (!p) return null;
          const skuUpper = p.sku?.toUpperCase() || "";
          return (
            <div
              key={p.sku}
              data-index={vr.index}
              ref={virtualizer.measureElement}
              className="admin-products-virtual-row"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vr.start}px)`,
              }}
            >
              <div className="admin-products-virtual-row-inner">
                <input
                  type="checkbox"
                  checked={selectedSkus.includes(skuUpper)}
                  onChange={() => onToggleSelect(p.sku)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select ${p.sku}`}
                />
                <ListItemButton
                  selected={selectedSku.toUpperCase() === skuUpper}
                  onClick={() => onSelectProduct(p)}
                >
                  <div className="admin-products-virtual-row-content">
                    {productImageSrc(p.sku, p.imageUrl) ? (
                      <img
                        src={productImageSrc(p.sku, p.imageUrl)}
                        alt=""
                        loading="lazy"
                        className="admin-products-virtual-row-img"
                      />
                    ) : (
                      <div className="admin-products-virtual-row-img admin-products-virtual-row-img--placeholder">
                        IMG
                      </div>
                    )}
                    <div className="admin-products-virtual-row-meta">
                      <strong style={{ fontSize: 13 }}>{p.sku}</strong>
                      <div title={p.name || ""} className="admin-products-virtual-row-name">
                        {p.name || "—"}
                      </div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>
                        {p.brand || "—"} · {p.source || "Catalog"}
                      </div>
                    </div>
                    <div className="admin-products-virtual-row-badges">
                      {isJustAddedItem(p) ? (
                        <JustAddedBadge />
                      ) : isNewProduct(p) ? (
                        <NewBadge />
                      ) : null}
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                </ListItemButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
