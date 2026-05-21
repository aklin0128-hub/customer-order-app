"use client";

import type { CSSProperties } from "react";

import { getCatalogItemBySku } from "../catalogUtils";
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
  flex: "0 0 148px",
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  borderRadius: 12,
  padding: 10,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

export function RecommendedStrip({
  lang,
  items,
  onAddOne,
}: {
  lang: Lang;
  items: CatalogItem[];
  onAddOne: (sku: string) => void;
}) {
  const t = copy[lang];
  if (items.length === 0) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: "#1d4ed8", marginBottom: 8 }}>{t.recommendedStripTitle}</div>
      <div style={stripStyle}>
        {items.map((item) => {
          const catalogItem = getCatalogItemBySku(item.sku) || item;
          return (
            <div key={item.sku} style={cardStyle}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <ProductImage sku={item.sku} alt={item.sku} size={44} imageUrl={catalogItem.imageUrl} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 900 }}>{item.sku}</div>
                  <div
                    style={{
                      fontSize: 10,
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
                style={{
                  border: "1px solid #2563eb",
                  background: "#2563eb",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "7px 10px",
                  fontSize: 11,
                  fontWeight: 900,
                  cursor: "pointer",
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
