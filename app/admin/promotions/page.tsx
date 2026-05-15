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

type PromotionRecord = {
  sku: string;
  note?: string;
  updatedAt?: string;
};

type PromotionProduct = {
  sku: string;
  name?: string;
  brand?: string;
  promoNote?: string;
};

export default function AdminPromotionsPage() {
  const { ready, authed, error, loading, login, logout, adminHeaders } = useAdminAuth();
  const [passwordInput, setPasswordInput] = useState("");

  const [promotions, setPromotions] = useState<PromotionRecord[]>([]);
  const [products, setProducts] = useState<PromotionProduct[]>([]);
  const [sku, setSku] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
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
    }
  };

  useEffect(() => {
    if (authed) loadPromotions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const savePromotion = async () => {
    const finalSku = sku.trim().toUpperCase();
    if (!finalSku) return notify("Enter a SKU.", "error");

    setBusy(true);
    try {
      const res = await fetch("/api/admin/promotions", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ sku: finalSku, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save promotion.");
      setSku("");
      setNote("");
      notify(`Promoted ${finalSku}`);
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
      notify(`Removed ${finalSku}`);
      await loadPromotions();
    } catch (err: any) {
      notify(err?.message || "Failed to remove promotion.", "error");
    } finally {
      setBusy(false);
    }
  };

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
      subtitle="SKUs listed here appear on the customer Promotions tab (top of list = shown first)."
      onLogout={logout}
    >
      <StatGrid
        items={[
          { label: "Active promos", value: promotions.length },
          { label: "Valid SKUs", value: products.length },
          {
            label: "Missing SKU",
            value: promotions.filter((p) => !products.some((x) => x.sku === p.sku)).length,
          },
        ]}
      />

      <Panel title="Add / update promotion">
        <div style={formGrid}>
          <div>
            <label style={labelStyle}>SKU</label>
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              placeholder="00003D"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Short label (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Hot deal / 限时促销"
              style={inputStyle}
            />
          </div>
        </div>
        <BtnRow>
          <BtnPrimary onClick={savePromotion} disabled={busy}>
            {busy ? "Saving..." : "Save promotion"}
          </BtnPrimary>
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
            return (
              <div
                key={p.sku}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "center",
                  background: product ? "#fff" : "#fef2f2",
                }}
              >
                <div>
                  <strong>{p.sku}</strong>
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
                </div>
                <BtnDanger onClick={() => removePromotion(p.sku)} disabled={busy}>
                  Remove
                </BtnDanger>
              </div>
            );
          })}
          {promotions.length === 0 ? (
            <EmptyState title="No promotions yet" detail="Add SKUs to feature them on the customer order page." />
          ) : null}
        </div>
      </Panel>
    </AdminShell>
  );
}
