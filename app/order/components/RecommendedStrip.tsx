"use client";

import type { CSSProperties } from "react";

import { getCatalogItemBySku, isOrderableItem } from "../catalogUtils";
import { copy } from "../orderCopy";
import type { CatalogItem, Lang } from "../types";
import { ProductImage } from "./ProductImage";

const stripStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  overflowX: "auto",
  paddingBottom: 6,
  WebkitOverflowScrolling: "touch",
};

const cardStyle: CSSProperties = {
  flex: "0 0 176px",
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  borderRadius: 12,
  padding: 10,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

export function RecommendedStrip({
  lang,
  items,
  onAddOne,
  hideTitle = false,
}: {
  lang: Lang;
  items: CatalogItem[];
  onAddOne: (sku: string) => void;
  hideTitle?: boolean;
}) {
  const t = copy[lang];
  if (items.length === 0) return null;

  return (
    <div style={{ marginBottom: hideTitle ? 4 : 12, marginTop: hideTitle ? 6 : 0 }}>
      {hideTitle ? null : (
        <div style={{ fontSize: 13, fontWeight: 900, color: "#1d4ed8", marginBottom: 8 }}>{t.recommendedStripTitle}</div>
      )}
      <div style={stripStyle}>
        {items.map((item) => {
          const catalogItem = getCatalogItemBySku(item.sku) || item;
          const canOrder = isOrderableItem(catalogItem);
          return (
            <div key={item.sku} style={{ ...cardStyle, opacity: canOrder ? 1 : 0.72 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", textAlign: "center" }}>
                <ProductImage sku={item.sku} alt={item.sku} size={72} imageUrl={catalogItem.imageUrl} />
                <div style={{ minWidth: 0, width: "100%" }}>
                  <div style={{ fontSize: 13, fontWeight: 900 }}>{item.sku}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#4b5563",
                      lineHeight: 1.3,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 2,
                    }}
                  >
                    {catalogItem.name || "—"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onAddOne(item.sku)}
                disabled={!canOrder}
                style={{
                  border: "1px solid #2563eb",
                  background: canOrder ? "#2563eb" : "#9ca3af",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "7px 10px",
                  cursor: canOrder ? "pointer" : "not-allowed",
                  fontSize: 11,
                  fontWeight: 900,
                  width: "100%",
                }}
              >
                {t.addOneCase}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
