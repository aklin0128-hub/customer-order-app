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
  promoRemaining,
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
  promoRemaining?: string;
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
        background: disabled ? "#f3f4f6" : hasQty ? "#ecfdf5" : highlight ? "#f0fdfa" : "#ffffff",
        border: disabled ? "2px solid #d1d5db" : hasQty ? "2px solid #86efac" : highlight ? "2px solid #5eead4" : "1px solid #e5e7eb",
        opacity: disabled ? 0.68 : 1,
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

      {promoNote || highlight || promoRemaining ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {promoNote || highlight ? <div style={promoTagStyle}>{promoNote || promoBadgeLabel}</div> : null}
          {promoRemaining ? (
            <div style={{ ...promoTagStyle, background: disabled ? "#e5e7eb" : "#ffffff", color: disabled ? "#6b7280" : "#0f766e" }}>
              {promoRemaining}
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ textAlign: "center", paddingTop: promoNote || highlight ? 4 : 0 }}>
        <ProductImage sku={item.sku} alt={item.name || item.sku} size={76} imageUrl={item.imageUrl} />
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
