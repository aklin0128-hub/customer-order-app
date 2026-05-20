"use client";

import type { ReactNode } from "react";
import {
  alertError,
  alertSuccess,
  btnDanger,
  btnPrimary,
  btnSecondary,
  emptyState,
  inputStyle,
  listItem,
  listItemSelected,
  panel,
  panelTitle,
  statCard,
  statLabel,
  statValue,
  statsGrid,
} from "./admin-styles";

export function Toast({ message, tone }: { message: string; tone?: "success" | "error" }) {
  if (!message) return null;
  const style = tone === "error" ? alertError : alertSuccess;
  return <div style={style}>{message}</div>;
}

export function StatGrid({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div style={statsGrid}>
      {items.map((item) => (
        <div key={item.label} style={statCard}>
          <div style={statValue}>{item.value}</div>
          <div style={statLabel}>{item.label}</div>
        </div>
      ))}
    </div>
  );
}

export function FilterChips<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="admin-chip-bar" role="tablist" aria-label="Filter">
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

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={panel}>
      <h2 style={panelTitle}>{title}</h2>
      {children}
    </section>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div style={emptyState}>
      <strong>{title}</strong>
      {detail ? <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>{detail}</div> : null}
    </div>
  );
}

export function ListItemButton({
  selected,
  onClick,
  children,
}: {
  selected?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} style={{ ...listItem, ...(selected ? listItemSelected : {}) }}>
      {children}
    </button>
  );
}

export function BtnPrimary(props: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="admin-btn admin-btn--primary"
      style={btnPrimary}
    >
      {props.children}
    </button>
  );
}

export function BtnSecondary(props: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="admin-btn admin-btn--secondary"
      style={btnSecondary}
    >
      {props.children}
    </button>
  );
}

export function BtnDanger(props: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="admin-btn admin-btn--danger"
      style={btnDanger}
    >
      {props.children}
    </button>
  );
}

export function BtnRow({ children }: { children: ReactNode }) {
  return <div className="admin-btn-row">{children}</div>;
}

export function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function downloadOrderCsv(order: {
  accountNo: string;
  orderRef?: string;
  items?: { sku: string; qty: string }[];
}) {
  const items = order.items || [];
  const rows = ["SKU,Qty", ...items.map((i) => `${i.sku},${i.qty}`)];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${order.accountNo}_${order.orderRef || "order"}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { inputStyle };
