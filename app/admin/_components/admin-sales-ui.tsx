"use client";

import type { CSSProperties, ReactNode } from "react";
import { inputStyle, labelStyle } from "./admin-styles";

export function FormSection({
  title,
  hint,
  tone = "default",
  children,
}: {
  title: string;
  hint?: string;
  tone?: "default" | "accent" | "clearance";
  children: ReactNode;
}) {
  const toneClass =
    tone === "clearance"
      ? " admin-form-section--accent clearance"
      : tone === "accent"
        ? " admin-form-section--accent"
        : "";
  return (
    <section className={`admin-form-section${toneClass}`}>
      <div className="admin-form-section-head">
        <span className="admin-form-section-title">{title}</span>
        {hint ? <span className="admin-form-section-hint">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function SegmentedPicker<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="admin-chip-bar admin-chip-bar--tight" role="tablist" aria-label={ariaLabel || "Options"}>
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={`admin-chip${active ? " admin-chip--active" : ""}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function SkuPreview({
  sku,
  product,
  missingText = "SKU not found in catalog",
}: {
  sku: string;
  product?: { brand?: string; name?: string } | null;
  missingText?: string;
}) {
  const clean = sku.trim().toUpperCase();
  if (!clean) return null;

  if (!product) {
    return <div className="admin-sku-preview admin-sku-preview--missing">{missingText}</div>;
  }

  return (
    <div className="admin-sku-preview">
      <span className="admin-sku-preview-sku">{clean}</span>
      <span className="admin-sku-preview-meta">
        {product.brand ? `${product.brand} · ` : ""}
        {product.name || "—"}
      </span>
    </div>
  );
}

export function StatusBadge({
  label,
  style,
}: {
  label: string;
  style: CSSProperties;
}) {
  return (
    <span className="admin-status-badge" style={style}>
      {label}
    </span>
  );
}

export function SalesListItem({
  selected,
  onClick,
  onRemove,
  removeDisabled,
  children,
}: {
  selected?: boolean;
  onClick: () => void;
  onRemove: () => void;
  removeDisabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`admin-sales-list-item${selected ? " admin-sales-list-item--selected" : ""}`}>
      <button type="button" className="admin-sales-list-item-main" onClick={onClick}>
        {children}
      </button>
      <button
        type="button"
        className="admin-sales-list-item-remove"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        disabled={removeDisabled}
        aria-label="Remove"
      >
        ×
      </button>
    </div>
  );
}

export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label style={labelStyle}>
      {children}
      {required ? <span style={{ color: "#dc2626" }}> *</span> : null}
    </label>
  );
}

export { inputStyle };
