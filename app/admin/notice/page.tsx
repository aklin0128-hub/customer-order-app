"use client";

import { useCallback, useEffect, useState } from "react";

import { AdminPage } from "../_components/AdminPage";
import { FieldLabel } from "../_components/admin-sales-ui";
import { inputStyle } from "../_components/admin-styles";
import { BtnDanger, BtnPrimary, BtnRow, BtnSecondary, Panel, Toast } from "../_components/admin-utils";
import { useAdminAuth } from "../_components/useAdminAuth";
import type { OrderNoticeRecord } from "@/lib/orderNotice";

export default function AdminNoticePage() {
  const { authed, adminHeaders } = useAdminAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
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
    setTitle(record?.title || "");
    setBody(record?.body || "");
    setEnabled(Boolean(record?.enabled && record?.body));
    setSaved(record || null);
  }, [adminHeaders]);

  useEffect(() => {
    if (!authed) return;
    void load().catch((err: unknown) => {
      notify(err instanceof Error ? err.message : "Failed to load.", "error");
    });
  }, [authed, load]);

  async function save(nextEnabled: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/order-notice", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ title, body, enabled: nextEnabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed.");
      const record = data.record as OrderNoticeRecord;
      setSaved(record);
      setTitle(record.title || "");
      setBody(record.body || "");
      setEnabled(record.enabled);
      notify(record.enabled ? "Notice is live on the order page." : "Notice saved and hidden from customers.");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Save failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPage
      active="notice"
      title="Order notice"
      subtitle="Popup customers see when they open the order page. Close with × or after 20 seconds."
      loginTitle="Order notice"
      loginSubtitle="Sign in to publish an order-page announcement."
    >
      <Panel title="Announcement">
        <FieldLabel>Title (optional)</FieldLabel>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Honeydew"
          style={{ ...inputStyle, marginBottom: 12 }}
          maxLength={120}
        />
        <FieldLabel>Message</FieldLabel>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={"Honeydew is out of stock. Expected back around 12/1."}
          rows={8}
          maxLength={4000}
          style={{ ...inputStyle, minHeight: 160, resize: "vertical", marginBottom: 12 }}
        />
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, fontWeight: 700, margin: "0 0 16px" }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Show on order page
        </label>
        <BtnRow>
          <BtnPrimary disabled={busy || !body.trim()} onClick={() => void save(enabled)}>
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
