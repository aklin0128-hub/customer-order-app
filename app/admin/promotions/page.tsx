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

type PromotionStatus = "active" | "scheduled" | "expired" | "sold_out";

type PromotionRecord = {
  sku: string;
  note?: string;
  startDate?: string;
  endDate?: string;
  promoQty?: number;
  soldQty?: number;
  promoPrice?: string;
  promoStatus?: PromotionStatus;
  updatedAt?: string;
};

type PromotionProduct = {
  sku: string;
  name?: string;
  brand?: string;
  promoNote?: string;
  promoPrice?: string;
  remainingQty?: number | null;
};

const statusStyle: Record<PromotionStatus, React.CSSProperties> = {
  active: { background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0" },
  scheduled: { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" },
  expired: { background: "#f3f4f6", color: "#4b5563", border: "1px solid #d1d5db" },
  sold_out: { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" },
};

const statusLabel: Record<PromotionStatus, string> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired",
  sold_out: "Sold out",
};

function emptyForm() {
  return {
    sku: "",
    note: "",
    startDate: "",
    endDate: "",
    promoQty: "",
    promoPrice: "",
    resetSoldQty: false,
  };
}

export default function AdminPromotionsPage() {
  const { ready, authed, error, loading, login, logout, adminHeaders } = useAdminAuth();
  const [passwordInput, setPasswordInput] = useState("");

  const [promotions, setPromotions] = useState<PromotionRecord[]>([]);
  const [products, setProducts] = useState<PromotionProduct[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const [promotionsLoaded, setPromotionsLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"success" | "error">("success");

  const notify = (text: string, tone: "success" | "error" = "success") => {
    setMsg(text);
    setMsgTone(tone);
  };

  const loadPromotions = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/promotions", {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load promotions.");
      setPromotions(Array.isArray(data.promotions) ? data.promotions : []);
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (err: any) {
      notify(err?.message || "Failed to load promotions.", "error");
    } finally {
      setBusy(false);
      setPromotionsLoaded(true);
    }
  };

  useEffect(() => {
    if (authed) loadPromotions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const editPromotion = (record: PromotionRecord) => {
    setForm({
      sku: record.sku,
      note: record.note || "",
      startDate: record.startDate || "",
      endDate: record.endDate || "",
      promoQty: record.promoQty ? String(record.promoQty) : "",
      promoPrice: record.promoPrice || "",
      resetSoldQty: false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const savePromotion = async () => {
    const finalSku = form.sku.trim().toUpperCase();
    if (!finalSku) return notify("Enter a SKU.", "error");

    setBusy(true);
    try {
      const res = await fetch("/api/admin/promotions", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          sku: finalSku,
          note: form.note,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          promoQty: form.promoQty || undefined,
          promoPrice: form.promoPrice || undefined,
          resetSoldQty: form.resetSoldQty,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save promotion.");
      setForm(emptyForm());
      notify(`Saved promotion ${finalSku}`);
      await loadPromotions();
    } catch (err: any) {
      notify(err?.message || "Failed to save promotion.", "error");
    } finally {
      setBusy(false);
    }
  };

  const removePromotion = async (targetSku: string) => {
    const finalSku = targetSku.trim().toUpperCase();
    if (!confirm(`Remove ${finalSku} from promotions?`)) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/promotions?sku=${encodeURIComponent(finalSku)}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to remove promotion.");
      if (form.sku === finalSku) setForm(emptyForm());
      notify(`Removed ${finalSku}`);
      await loadPromotions();
    } catch (err: any) {
      notify(err?.message || "Failed to remove promotion.", "error");
    } finally {
      setBusy(false);
    }
  };

  const activeCount = promotions.filter((p) => p.promoStatus === "active").length;

  if (!ready) return null;

  if (!authed) {
    return (
      <AdminLogin
        title="Promotions"
        subtitle="Sign in to manage featured sales SKUs on the order page."
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
      active="promotions"
      title="Promotions"
      subtitle="Set date range, promo quantity (sold until gone), and optional price. Customers only see active promos."
      onLogout={logout}
    >
      <StatGrid
        items={[
          { label: "Total promos", value: promotions.length },
          { label: "Live now", value: activeCount },
          { label: "Valid SKUs", value: products.length },
          {
            label: "Missing SKU",
            value: promotions.filter((p) => !products.some((x) => x.sku === p.sku)).length,
          },
        ]}
      />

      {!promotionsLoaded && busy ? (
        <Panel title="Loading promotions">
          <p style={{ margin: 0, fontSize: 13, color: "#0f766e", fontWeight: 800 }}>Loading promotion list...</p>
        </Panel>
      ) : null}

      <Panel title="Add / update promotion">
        <div style={formGrid}>
          <div>
            <label style={labelStyle}>SKU</label>
            <input
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))}
              placeholder="00003D"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Short label (optional)</label>
            <input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Hot deal / 限时促销"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Start date (optional)</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>End date (optional)</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Promo qty (optional)</label>
            <input
              value={form.promoQty}
              onChange={(e) => setForm((f) => ({ ...f, promoQty: e.target.value.replace(/[^0-9]/g, "") }))}
              placeholder="Leave empty = unlimited"
              inputMode="numeric"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Promo price (optional)</label>
            <input
              value={form.promoPrice}
              onChange={(e) => setForm((f) => ({ ...f, promoPrice: e.target.value }))}
              placeholder="$12.99 / 促销价"
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
          <BtnPrimary onClick={savePromotion} disabled={busy}>
            {busy ? "Saving..." : "Save promotion"}
          </BtnPrimary>
          <BtnSecondary onClick={() => setForm(emptyForm())} disabled={busy}>
            Clear form
          </BtnSecondary>
          <BtnSecondary onClick={loadPromotions} disabled={busy}>
            Refresh
          </BtnSecondary>
        </BtnRow>
        <Toast message={msg} tone={msgTone} />
      </Panel>

      <Panel title={`Promotion list (${promotions.length})`}>
        <div style={splitList}>
          {promotions.map((p) => {
            const product = products.find((x) => x.sku === p.sku);
            const status = p.promoStatus || "active";
            const remaining =
              p.promoQty && p.promoQty > 0
                ? Math.max(0, p.promoQty - (p.soldQty || 0))
                : null;

            return (
              <div
                key={p.sku}
                role="button"
                tabIndex={0}
                onClick={() => editPromotion(p)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") editPromotion(p);
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
                    {(p.startDate || p.endDate) && (
                      <div>
                        Dates: {p.startDate || "—"} → {p.endDate || "—"}
                      </div>
                    )}
                    {p.promoPrice ? <div>Price: {p.promoPrice}</div> : null}
                    {p.promoQty ? (
                      <div>
                        Sold: {p.soldQty || 0} / {p.promoQty}
                        {remaining !== null ? ` · Remaining: ${remaining}` : ""}
                      </div>
                    ) : (
                      <div>No qty cap (date-only or open-ended)</div>
                    )}
                  </div>
                </div>
                <span onClick={(e) => e.stopPropagation()}>
                  <BtnDanger onClick={() => removePromotion(p.sku)} disabled={busy}>
                    Remove
                  </BtnDanger>
                </span>
              </div>
            );
          })}
          {promotionsLoaded && promotions.length === 0 ? (
            <EmptyState title="No promotions yet" detail="Add SKUs to feature them on the customer order page." />
          ) : null}
        </div>
      </Panel>
    </AdminShell>
  );
}
