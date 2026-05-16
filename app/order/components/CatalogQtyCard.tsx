"use client";

import type { CatalogItem } from "../types";
import {
  catalogCardStyle,
  catalogNameStyle,
  catalogStepBtnStyle,
  catalogStepInputStyle,
  catalogStepperStyle,
  inCartTagStyle,
  promoDetailsStyle,
  promoPriceStyle,
  promoTagStyle,
} from "../orderStyles";
import { ProductImage } from "./ProductImage";

export function CatalogQtyCard({
  item,
  qty,
  promoNote,
  promoPrice,
  promoDetails,
  inCartLabel,
  promoBadgeLabel,
  onAdjust,
  onUpdateQty,
  highlight,
  disabled,
  showAdminEdit,
  editLabel = "Edit",
}: {
  item: CatalogItem;
  qty: string;
  promoNote?: string;
  promoPrice?: string;
  promoDetails?: string;
  inCartLabel: string;
  promoBadgeLabel: string;
  onAdjust: (sku: string, delta: number) => void;
  onUpdateQty: (sku: string, value: string) => void;
  highlight?: boolean;
  disabled?: boolean;
  showAdminEdit?: boolean;
  editLabel?: string;
}) {
  const hasQty = Number(qty) > 0;

  return (
    <div
      style={{
        ...catalogCardStyle,
        background: hasQty ? "#ecfdf5" : highlight ? "#fffbeb" : "#ffffff",
        border: hasQty ? "2px solid #86efac" : highlight ? "2px solid #fdba74" : "1px solid #e5e7eb",
      }}
    >
      {showAdminEdit ? (
        <a
          href={`/admin/products?sku=${encodeURIComponent(item.sku)}`}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 3,
            border: "1px solid #bfdbfe",
            borderRadius: 999,
            background: "#eff6ff",
            color: "#2563eb",
            padding: "3px 8px",
            fontSize: 10,
            fontWeight: 900,
            textDecoration: "none",
          }}
        >
          {editLabel}
        </a>
      ) : null}

      {promoNote || highlight ? (
        <div style={promoTagStyle}>{promoNote || promoBadgeLabel}</div>
      ) : null}

      <div style={{ textAlign: "center", paddingTop: promoNote || highlight ? 4 : 0 }}>
        <ProductImage sku={item.sku} alt={item.name || item.sku} size={84} imageUrl={item.imageUrl} />
      </div>

      <div style={{ fontSize: 12, fontWeight: 900, color: "#111827", lineHeight: 1.2 }}>{item.sku}</div>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#374151" }}>{item.brand || "-"}</div>
      <div style={catalogNameStyle}>{item.name || "-"}</div>
      {item.size ? <div style={{ fontSize: 10, color: "#6b7280" }}>{item.size}</div> : null}
      {promoPrice ? <div style={promoPriceStyle}>{promoPrice}</div> : null}
      {promoDetails ? <div style={promoDetailsStyle}>{promoDetails}</div> : null}
      {hasQty ? <div style={inCartTagStyle}>{inCartLabel}: {qty}</div> : null}

      <div style={catalogStepperStyle}>
        <button type="button" onClick={() => onAdjust(item.sku, -1)} disabled={disabled} style={catalogStepBtnStyle}>
          −
        </button>
        <input
          value={qty}
          onChange={(e) => onUpdateQty(item.sku, e.target.value)}
          placeholder="0"
          inputMode="numeric"
          disabled={disabled}
          style={{ ...catalogStepInputStyle, opacity: disabled ? 0.5 : 1 }}
        />
        <button type="button" onClick={() => onAdjust(item.sku, 1)} disabled={disabled} style={catalogStepBtnStyle}>
          +
        </button>
      </div>
    </div>
  );
}
