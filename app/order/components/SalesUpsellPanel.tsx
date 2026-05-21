"use client";

import { formatClearancePriceDisplay } from "@/lib/clearanceFormat";
import { copy } from "../orderCopy";
import { promoDealStyle, promoTagStyle } from "../orderStyles";
import type { Lang } from "../types";
import { ProductImage } from "./ProductImage";

export type UpsellLine = {
  sku: string;
  name?: string;
  brand?: string;
  imageUrl?: string;
  priceLabel?: string;
  dealHeadline?: string;
  dealDetail?: string;
  badge?: string;
  remainingLabel?: string;
};

export function SalesUpsellPanel({
  lang,
  title,
  lines,
  disabled,
  onAddOne,
  onAddAll,
  onSkip,
  skipLabel,
}: {
  lang: Lang;
  title: string;
  lines: UpsellLine[];
  disabled?: boolean;
  onAddOne: (sku: string) => void;
  onAddAll: () => void;
  onSkip?: () => void;
  skipLabel?: string;
}) {
  const t = copy[lang];
  if (lines.length === 0) return null;

  return (
    <div
      style={{
        border: "1px solid #5eead4",
        background: "#f0fdfa",
        color: "#115e59",
        borderRadius: 12,
        padding: 10,
        fontSize: 12,
        lineHeight: 1.45,
        marginBottom: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ fontWeight: 900, flex: "1 1 200px" }}>{title}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {onSkip ? (
            <button
              type="button"
              onClick={onSkip}
              disabled={disabled}
              style={{
                border: "1px solid #99f6e4",
                background: "#ffffff",
                color: "#0f766e",
                borderRadius: 999,
                padding: "7px 12px",
                fontSize: 12,
                fontWeight: 800,
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              {skipLabel || t.skipSection}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onAddAll}
            disabled={disabled}
            style={{
              border: "1px solid #0f766e",
              background: "#ccfbf1",
              color: "#0f766e",
              borderRadius: 999,
              padding: "7px 12px",
              fontSize: 12,
              fontWeight: 900,
              cursor: disabled ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            {t.addAllMissingPicks.replace("{count}", String(lines.length))}
          </button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {lines.slice(0, 6).map((line) => (
          <div
            key={line.sku}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: 8,
              borderRadius: 10,
              background: "#ffffff",
              border: "1px solid #99f6e4",
            }}
          >
            <ProductImage sku={line.sku} alt={line.sku} size={44} imageUrl={line.imageUrl} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 900 }}>{line.sku}</div>
              <div style={{ fontSize: 11, color: "#4b5563", marginTop: 2, lineHeight: 1.3 }}>
                {line.brand ? `${line.brand} · ` : ""}
                {line.name || "—"}
              </div>
              {line.dealHeadline ? (
                <div style={{ ...promoDealStyle, marginTop: 6, textAlign: "left" }}>
                  <div>{line.dealHeadline}</div>
                  {line.dealDetail ? (
                    <div style={{ fontSize: 11, fontWeight: 800, marginTop: 4, lineHeight: 1.35 }}>{line.dealDetail}</div>
                  ) : null}
                </div>
              ) : null}
              {line.priceLabel ? (
                <div style={{ fontSize: 11, fontWeight: 800, color: "#0f766e", marginTop: 4 }}>{line.priceLabel}</div>
              ) : null}
              {line.remainingLabel ? (
                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{line.remainingLabel}</div>
              ) : null}
            </div>
            {line.badge ? <span style={{ ...promoTagStyle, fontSize: 9, flexShrink: 0 }}>{line.badge}</span> : null}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAddOne(line.sku)}
              style={{
                border: "1px solid #0f766e",
                background: "#0f766e",
                color: "#fff",
                borderRadius: 10,
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 900,
                cursor: disabled ? "not-allowed" : "pointer",
                flexShrink: 0,
              }}
            >
              {t.addOneCase}
            </button>
          </div>
        ))}
        {lines.length > 6 ? <div style={{ fontSize: 11, color: "#6b7280" }}>+ {lines.length - 6} more</div> : null}
      </div>
    </div>
  );
}

export function formatPromoPriceLabel(lang: Lang, promoPrice?: string) {
  const t = copy[lang];
  if (!promoPrice) return undefined;
  const display = promoPrice.startsWith("$") ? promoPrice : formatClearancePriceDisplay(promoPrice);
  return `${t.promoPrice}: ${display}`;
}

export function formatClearancePriceLabel(lang: Lang, clearancePrice?: string) {
  const t = copy[lang];
  if (!clearancePrice) return undefined;
  const display = clearancePrice.startsWith("$") ? clearancePrice : formatClearancePriceDisplay(clearancePrice);
  return `${t.clearancePrice}: ${display}`;
}
