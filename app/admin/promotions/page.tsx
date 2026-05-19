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

type PromoPriceTier = {
  minQty: number;
  price: string;
};

type DealMode = "none" | "bogo" | "tiered";

type PromotionRecord = {
  sku: string;
  note?: string;
  startDate?: string;
  endDate?: string;
  promoQty?: number;
  soldQty?: number;
  promoPrice?: string;
  buyQty?: number;
  getQtyFree?: number;
  priceTiers?: PromoPriceTier[];
  promoStatus?: PromotionStatus;
  updatedAt?: string;
};

type TierFormRow = {
  minQty: string;
  price: string;
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

function emptyTierRows(): TierFormRow[] {
  return [
    { minQty: "", price: "" },
    { minQty: "", price: "" },
    { minQty: "", price: "" },
  ];
}

function inferDealMode(record: Pick<PromotionRecord, "buyQty" | "getQtyFree" | "priceTiers">): DealMode {
  if (record.buyQty && record.getQtyFree) return "bogo";
  if (record.priceTiers?.length) return "tiered";
  return "none";
}

function formatTierPricesLine(tiers: PromoPriceTier[]) {
  return [...tiers]
    .sort((a, b) => b.minQty - a.minQty)
    .map((tier) => {
      const money = tier.price.startsWith("$") ? tier.price : `$${tier.price}`;
      return `${money}/${tier.minQty}cs`;
    })
    .join(" · ");
}

function emptyForm() {
  return {
    sku: "",
    note: "",
    startDate: "",
    endDate: "",
    promoQty: "",
    promoPrice: "",
    dealMode: "none" as DealMode,
    buyQty: "",
    getQtyFree: "",
    tiers: emptyTierRows(),
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
    const tiers = emptyTierRows();
    (record.priceTiers || []).forEach((tier, index) => {
      if (index >= 3) return;
      tiers[index] = {
        minQty: String(tier.minQty),
        price: tier.price,
      };
    });

    setForm({
      sku: record.sku,
      note: record.note || "",
      startDate: record.startDate || "",
      endDate: record.endDate || "",
      promoQty: record.promoQty ? String(record.promoQty) : "",
      promoPrice: record.promoPrice || "",
      dealMode: inferDealMode(record),
      buyQty: record.buyQty ? String(record.buyQty) : "",
      getQtyFree: record.getQtyFree ? String(record.getQtyFree) : "",
      tiers,
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
          dealType: form.dealMode,
          promoPrice: form.dealMode === "none" ? form.promoPrice || undefined : undefined,
          buyQty: form.dealMode === "bogo" ? form.buyQty || undefined : undefined,
          getQtyFree: form.dealMode === "bogo" ? form.getQtyFree || undefined : undefined,
          priceTiers:
            form.dealMode === "tiered"
              ? form.tiers
                  .map((tier) => ({
                    minQty: tier.minQty,
                    price: tier.price.trim(),
                  }))
                  .filter((tier) => tier.minQty && tier.price)
              : undefined,
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
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Deal type (pick one)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
              {(
                [
                  ["none", "Single promo price"],
                  ["bogo", "Buy X Get Y free"],
                  ["tiered", "Volume tiers (up to 3)"],
                ] as const
              ).map(([mode, label]) => (
                <label key={mode} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
                  <input
                    type="radio"
                    name="dealMode"
                    checked={form.dealMode === mode}
                    onChange={() => setForm((f) => ({ ...f, dealMode: mode }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {form.dealMode === "none" ? (
            <div>
              <label style={labelStyle}>Promo price</label>
              <input
                value={form.promoPrice}
                onChange={(e) => setForm((f) => ({ ...f, promoPrice: e.target.value }))}
                placeholder="$12.99"
                style={inputStyle}
              />
            </div>
          ) : null}

          {form.dealMode === "bogo" ? (
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Buy X Get Y free</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                value={form.buyQty}
                onChange={(e) => setForm((f) => ({ ...f, buyQty: e.target.value.replace(/[^0-9]/g, "") }))}
                placeholder="Buy qty (e.g. 2)"
                inputMode="numeric"
                style={inputStyle}
              />
              <input
                value={form.getQtyFree}
                onChange={(e) => setForm((f) => ({ ...f, getQtyFree: e.target.value.replace(/[^0-9]/g, "") }))}
                placeholder="Free qty (e.g. 1)"
                inputMode="numeric"
                style={inputStyle}
              />
            </div>
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "#6b7280", lineHeight: 1.4 }}>
                Example: Buy 2 Get 1 free — customer adds 3 cases, pays for 2.
              </p>
            </div>
          ) : null}

          {form.dealMode === "tiered" ? (
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Volume price tiers (min cases + price)</label>
              <div style={{ display: "grid", gap: 8 }}>
                {form.tiers.map((tier, index) => (
                  <div
                    key={index}
                    style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "center" }}
                  >
                    <input
                      value={tier.minQty}
                      onChange={(e) =>
                        setForm((f) => {
                          const tiers = [...f.tiers];
                          tiers[index] = { ...tiers[index], minQty: e.target.value.replace(/[^0-9]/g, "") };
                          return { ...f, tiers };
                        })
                      }
                      placeholder={`Tier ${index + 1} min cs (e.g. 30)`}
                      inputMode="numeric"
                      style={inputStyle}
                    />
                    <input
                      value={tier.price}
                      onChange={(e) =>
                        setForm((f) => {
                          const tiers = [...f.tiers];
                          tiers[index] = { ...tiers[index], price: e.target.value };
                          return { ...f, tiers };
                        })
                      }
                      placeholder="Price (e.g. 11.00)"
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "#6b7280", lineHeight: 1.4 }}>
                Example: $10.00/280cs · $10.50/140cs · $11.00/30cs. Cannot combine with Buy X Get Y.
              </p>
            </div>
          ) : null}
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
                    {p.priceTiers?.length ? (
                      <div style={{ fontWeight: 800, color: "#b45309" }}>
                        Tiers: {formatTierPricesLine(p.priceTiers)}
                      </div>
                    ) : null}
                    {p.buyQty && p.getQtyFree ? (
                      <div style={{ fontWeight: 800, color: "#b45309" }}>
                        Buy {p.buyQty} Get {p.getQtyFree} free
                      </div>
                    ) : null}
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
