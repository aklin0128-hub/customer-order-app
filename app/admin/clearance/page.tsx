"use client";

import { useEffect, useState } from "react";
import { AdminLogin } from "../_components/AdminLogin";
import { AdminShell } from "../_components/AdminShell";
import { formGrid, inputStyle, labelStyle, splitList } from "../_components/admin-styles";
import {
  BtnDanger,
  BtnPrimary,
  BtnRow,
  BtnSecondary,
  EmptyState,
  Panel,
  StatGrid,
  Toast,
} from "../_components/admin-utils";
import { useAdminAuth } from "../_components/useAdminAuth";

type ClearanceStatus = "active" | "scheduled" | "expired" | "sold_out";

type ClearanceRecord = {
  sku: string;
  note?: string;
  expiryDate: string;
  clearancePrice: string;
  startDate?: string;
  saleEndDate?: string;
  clearanceQty?: number;
  soldQty?: number;
  clearanceStatus?: ClearanceStatus;
  updatedAt?: string;
};

type ClearanceProduct = {
  sku: string;
  name?: string;
  brand?: string;
};

const statusStyle: Record<ClearanceStatus, React.CSSProperties> = {
  active: { background: "#fff7ed", color: "#c2410c", border: "1px solid #fdba74" },
  scheduled: { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" },
  expired: { background: "#f3f4f6", color: "#4b5563", border: "1px solid #d1d5db" },
  sold_out: { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" },
};

const statusLabel: Record<ClearanceStatus, string> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired / past date",
  sold_out: "Sold out",
};

function emptyForm() {
  return {
    sku: "",
    note: "Sell as is",
    expiryDate: "",
    clearancePrice: "",
    startDate: "",
    saleEndDate: "",
    clearanceQty: "",
    resetSoldQty: false,
  };
}

export default function AdminClearancePage() {
  const { ready, authed, error, loading, login, logout, adminHeaders } = useAdminAuth();
  const [passwordInput, setPasswordInput] = useState("");

  const [clearances, setClearances] = useState<ClearanceRecord[]>([]);
  const [products, setProducts] = useState<ClearanceProduct[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"success" | "error">("success");

  const notify = (text: string, tone: "success" | "error" = "success") => {
    setMsg(text);
    setMsgTone(tone);
  };

  const loadClearances = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/clearance", {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load clearance items.");
      setClearances(Array.isArray(data.clearances) ? data.clearances : []);
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (err: any) {
      notify(err?.message || "Failed to load clearance items.", "error");
    } finally {
      setBusy(false);
      setLoaded(true);
    }
  };

  useEffect(() => {
    if (authed) loadClearances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const editClearance = (record: ClearanceRecord) => {
    setForm({
      sku: record.sku,
      note: record.note || "Sell as is",
      expiryDate: record.expiryDate || "",
      clearancePrice: record.clearancePrice || "",
      startDate: record.startDate || "",
      saleEndDate: record.saleEndDate || "",
      clearanceQty: record.clearanceQty ? String(record.clearanceQty) : "",
      resetSoldQty: false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveClearance = async () => {
    const finalSku = form.sku.trim().toUpperCase();
    if (!finalSku) return notify("Enter a SKU.", "error");

    setBusy(true);
    try {
      const res = await fetch("/api/admin/clearance", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          sku: finalSku,
          note: form.note,
          expiryDate: form.expiryDate,
          clearancePrice: form.clearancePrice,
          startDate: form.startDate || undefined,
          saleEndDate: form.saleEndDate || undefined,
          clearanceQty: form.clearanceQty || undefined,
          resetSoldQty: form.resetSoldQty,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save clearance item.");
      setForm(emptyForm());
      notify(`Saved clearance ${finalSku}`);
      await loadClearances();
    } catch (err: any) {
      notify(err?.message || "Failed to save clearance item.", "error");
    } finally {
      setBusy(false);
    }
  };

  const removeClearance = async (targetSku: string) => {
    const finalSku = targetSku.trim().toUpperCase();
    if (!confirm(`Remove ${finalSku} from clearance list?`)) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/clearance?sku=${encodeURIComponent(finalSku)}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to remove clearance item.");
      if (form.sku === finalSku) setForm(emptyForm());
      notify(`Removed ${finalSku}`);
      await loadClearances();
    } catch (err: any) {
      notify(err?.message || "Failed to remove clearance item.", "error");
    } finally {
      setBusy(false);
    }
  };

  const activeCount = clearances.filter((p) => p.clearanceStatus === "active").length;

  if (!ready) return null;

  if (!authed) {
    return (
      <AdminLogin
        title="Clearance (Sell as is)"
        subtitle="Sign in to manage near-expiry items on the customer order page."
        password={passwordInput}
        onPasswordChange={setPasswordInput}
        error={error}
        loading={loading}
        onSubmit={() => login(passwordInput)}
      />
    );
  }

  return (
    <AdminShell
      active="clearance"
      title="Clearance — Sell as is"
      subtitle="Product expiry date, clearance price, and optional stock cap. Customers only see active listings."
      onLogout={logout}
    >
      <StatGrid
        items={[
          { label: "Total listings", value: clearances.length },
          { label: "Live now", value: activeCount },
          { label: "Valid SKUs", value: products.length },
          {
            label: "Missing SKU",
            value: clearances.filter((p) => !products.some((x) => x.sku === p.sku)).length,
          },
        ]}
      />

      {!loaded && busy ? (
        <Panel title="Loading clearance">
          <p style={{ margin: 0, fontSize: 13, color: "#c2410c", fontWeight: 800 }}>Loading clearance list...</p>
        </Panel>
      ) : null}

      <Panel title="Add / update clearance item">
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#9a3412", lineHeight: 1.45 }}>
          Product expiry is the date on the package. Listing start / stop selling dates are optional.
        </p>
        
        <div style={formGrid}>
          <div>
            <label style={labelStyle}>SKU *</label>
            <input
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))}
              placeholder="00003D"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Label / note</label>
            <input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Sell as is / 临期特价"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Product expiry date *</label>
            <input
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Clearance price *</label>
            <input
              value={form.clearancePrice}
              onChange={(e) => setForm((f) => ({ ...f, clearancePrice: e.target.value }))}
              placeholder="$8.99 / case"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Listing start (optional)</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Stop selling after (optional)</label>
            <input
              type="date"
              value={form.saleEndDate}
              onChange={(e) => setForm((f) => ({ ...f, saleEndDate: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Stock qty (optional)</label>
            <input
              value={form.clearanceQty}
              onChange={(e) => setForm((f) => ({ ...f, clearanceQty: e.target.value.replace(/[^0-9]/g, "") }))}
              placeholder="Leave empty = unlimited"
              inputMode="numeric"
              style={inputStyle}
            />
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={form.resetSoldQty}
            onChange={(e) => setForm((f) => ({ ...f, resetSoldQty: e.target.checked }))}
          />
          Reset sold count to 0 when saving
        </label>

        <BtnRow>
          <BtnPrimary onClick={saveClearance} disabled={busy}>
            {busy ? "Saving..." : "Save clearance item"}
          </BtnPrimary>
          <BtnSecondary onClick={() => setForm(emptyForm())} disabled={busy}>
            Clear form
          </BtnSecondary>
          <BtnSecondary onClick={loadClearances} disabled={busy}>
            Refresh
          </BtnSecondary>
        </BtnRow>
        <Toast message={msg} tone={msgTone} />
      </Panel>

      <Panel title={`Clearance list (${clearances.length})`}>
        <div style={splitList}>
          {clearances.map((p) => {
            const product = products.find((x) => x.sku === p.sku);
            const status = p.clearanceStatus || "active";
            const remaining =
              p.clearanceQty && p.clearanceQty > 0
                ? Math.max(0, p.clearanceQty - (p.soldQty || 0))
                : null;

            return (
              <div
                key={p.sku}
                role="button"
                tabIndex={0}
                onClick={() => editClearance(p)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") editClearance(p);
                }}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "flex-start",
                  background: product ? "#fff" : "#fef2f2",
                  cursor: "pointer",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong>{p.sku}</strong>
                    <span
                      style={{
                        ...statusStyle[status],
                        fontSize: 10,
                        fontWeight: 900,
                        padding: "2px 8px",
                        borderRadius: 999,
                      }}
                    >
                      {statusLabel[status]}
                    </span>
                  </div>
                  {p.note ? (
                    <div style={{ fontSize: 12, color: "#c2410c", fontWeight: 800, marginTop: 4 }}>{p.note}</div>
                  ) : null}
                  {product ? (
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                      {product.brand ? `${product.brand} · ` : ""}
                      {product.name || "—"}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 4 }}>SKU not found in catalog</div>
                  )}
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6, lineHeight: 1.45 }}>
                    <div>Expires: {p.expiryDate}</div>
                    {p.clearancePrice ? <div>Price: {p.clearancePrice}</div> : null}
                    {(p.startDate || p.saleEndDate) && (
                      <div>
                        Listing: {p.startDate || "—"} → stop {p.saleEndDate || "—"}
                      </div>
                    )}
                    {p.clearanceQty ? (
                      <div>
                        Sold: {p.soldQty || 0} / {p.clearanceQty}
                        {remaining !== null ? ` · Remaining: ${remaining}` : ""}
                      </div>
                    ) : (
                      <div>No stock cap</div>
                    )}
                  </div>
                </div>
                <span onClick={(e) => e.stopPropagation()}>
                  <BtnDanger onClick={() => removeClearance(p.sku)} disabled={busy}>
                    Remove
                  </BtnDanger>
                </span>
              </div>
            );
          })}
          {loaded && clearances.length === 0 ? (
            <EmptyState title="No clearance items yet" detail="Add SKUs to show them on the customer Clearance tab." />
          ) : null}
        </div>
      </Panel>
    </AdminShell>
  );
}
