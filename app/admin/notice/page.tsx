"use client";

import { useCallback, useEffect, useState } from "react";

import {
  ORDER_NOTICE_MAX_ITEMS,
  emptyNoticeItem,
  hasNoticeItemText,
  isOrderNoticeExpired,
  type OrderNoticeItem,
  type OrderNoticeRecord,
} from "@/lib/orderNotice";
import { AdminPage } from "../_components/AdminPage";
import { FieldLabel } from "../_components/admin-sales-ui";
import { inputStyle } from "../_components/admin-styles";
import { BtnDanger, BtnPrimary, BtnRow, BtnSecondary, Panel, Toast } from "../_components/admin-utils";
import { useAdminAuth } from "../_components/useAdminAuth";

function withOneRow(items: OrderNoticeItem[]) {
  return items.length > 0 ? items : [emptyNoticeItem()];
}

export default function AdminNoticePage() {
  const { authed, adminHeaders } = useAdminAuth();
  const [heading, setHeading] = useState("");
  const [items, setItems] = useState<OrderNoticeItem[]>([emptyNoticeItem()]);
  const [enabled, setEnabled] = useState(true);
  const [saved, setSaved] = useState<OrderNoticeRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone?: "success" | "error" } | null>(null);

  const notify = (message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/order-notice", { headers: adminHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed to load notice.");
    const record = data.record as OrderNoticeRecord;
    setHeading(record?.heading || "");
    setItems(withOneRow(record?.items || []));
    setEnabled(Boolean(record?.enabled && (record.items || []).some(hasNoticeItemText)));
    setSaved(record || null);
  }, [adminHeaders]);

  useEffect(() => {
    if (!authed) return;
    void load().catch((err: unknown) => {
      notify(err instanceof Error ? err.message : "Failed to load.", "error");
    });
  }, [authed, load]);

  function patchItem(index: number, field: keyof OrderNoticeItem, value: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function addItem() {
    setItems((prev) => (prev.length >= ORDER_NOTICE_MAX_ITEMS ? prev : [...prev, emptyNoticeItem()]));
  }

  function removeItem(index: number) {
    setItems((prev) => withOneRow(prev.filter((_, i) => i !== index)));
  }

  async function save(nextEnabled: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/order-notice", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ heading, items, enabled: nextEnabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed.");
      const record = data.record as OrderNoticeRecord;
      setSaved(record);
      setHeading(record.heading || "");
      setItems(withOneRow(record.items || []));
      setEnabled(record.enabled);
      const visibleCount = (record.items || []).filter(
        (item) => hasNoticeItemText(item) && !isOrderNoticeExpired(item.hideOnDate)
      ).length;
      if (!record.enabled) notify("Notice saved and hidden from customers.");
      else if (visibleCount === 0) notify("Notice saved. Every product row is past its hide date, so customers will not see it.");
      else notify(`Notice is live with ${visibleCount} product${visibleCount === 1 ? "" : "s"}.`);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Save failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  const canSave = items.some(hasNoticeItemText);

  return (
    <AdminPage
      active="notice"
      title="Order notice"
      subtitle="English popup on the order page. Add one row per product. Close with × or after 20 seconds."
      loginTitle="Order notice"
      loginSubtitle="Sign in to publish an order-page announcement."
    >
      <Panel title="Announcement">
        <FieldLabel>Heading (optional)</FieldLabel>
        <input
          value={heading}
          onChange={(e) => setHeading(e.target.value)}
          placeholder="Inventory update"
          style={{ ...inputStyle, marginBottom: 16 }}
          maxLength={120}
        />

        {items.map((item, index) => {
          const expired = isOrderNoticeExpired(item.hideOnDate);
          return (
            <div
              key={index}
              style={{
                marginBottom: 14,
                padding: 14,
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                background: expired ? "#fff7ed" : "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>Product {index + 1}</strong>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={busy}
                  style={{ border: "none", background: "none", color: "#b91c1c", fontWeight: 800, cursor: "pointer" }}
                >
                  Remove
                </button>
              </div>
              <FieldLabel>Product</FieldLabel>
              <input
                value={item.name}
                onChange={(e) => patchItem(index, "name", e.target.value)}
                placeholder="Honeydew"
                style={{ ...inputStyle, marginBottom: 8 }}
                maxLength={120}
              />
              <FieldLabel>Message</FieldLabel>
              <textarea
                value={item.note}
                onChange={(e) => patchItem(index, "note", e.target.value)}
                placeholder="Out of stock. Expected back around 12/1."
                rows={3}
                maxLength={4000}
                style={{ ...inputStyle, minHeight: 72, resize: "vertical", marginBottom: 8 }}
              />
              <FieldLabel>Hide on date (US Eastern)</FieldLabel>
              <input
                type="date"
                value={item.hideOnDate || ""}
                onChange={(e) => patchItem(index, "hideOnDate", e.target.value)}
                style={{ ...inputStyle, maxWidth: 220 }}
              />
              {expired && item.hideOnDate ? (
                <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 800, color: "#b45309" }}>
                  This row is past its hide date and will not show.
                </p>
              ) : (
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6b7280" }}>
                  Leave blank to keep this product in the popup until you remove it.
                </p>
              )}
            </div>
          );
        })}

        <BtnRow>
          <BtnSecondary disabled={busy || items.length >= ORDER_NOTICE_MAX_ITEMS} onClick={addItem}>
            Add product
          </BtnSecondary>
        </BtnRow>

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, fontWeight: 700, margin: "16px 0" }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Show on order page
        </label>
        <BtnRow>
          <BtnPrimary disabled={busy || !canSave} onClick={() => void save(enabled)}>
            {busy ? "Saving…" : "Save notice"}
          </BtnPrimary>
          <BtnSecondary
            disabled={busy}
            onClick={() =>
              void load().catch((err: unknown) => {
                notify(err instanceof Error ? err.message : "Failed to load.", "error");
              })
            }
          >
            Reload
          </BtnSecondary>
          <BtnDanger disabled={busy} onClick={() => void save(false)}>
            Hide from customers
          </BtnDanger>
        </BtnRow>
        {saved?.updatedAt ? (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "#6b7280" }}>
            Last saved {new Date(saved.updatedAt).toLocaleString()}
            {saved.enabled ? " · live" : " · hidden"}
          </p>
        ) : null}
      </Panel>
      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
    </AdminPage>
  );
}
