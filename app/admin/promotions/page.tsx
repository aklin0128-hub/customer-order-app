"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { AdminPage } from "../_components/AdminPage";
import { AdminSkuAutocomplete } from "../_components/AdminSkuAutocomplete";
import {
  FieldLabel,
  FormSection,
  SalesListItem,
  SegmentedPicker,
  SkuPreview,
  StatusBadge,
  inputStyle,
} from "../_components/admin-sales-ui";
import { formGrid, splitForm, splitLayout, splitList } from "../_components/admin-styles";
import {
  BtnPrimary,
  BtnRow,
  BtnSecondary,
  EmptyState,
  FilterChips,
  Panel,
  StatGrid,
  Toast,
} from "../_components/admin-utils";
import { AdminPublicShowcaseHint } from "../_components/AdminPublicShowcaseHint";
import { useAdminAuth } from "../_components/useAdminAuth";

type PromotionStatus = "active" | "scheduled" | "expired" | "sold_out" | "ended";
type StatusFilter = "all" | PromotionStatus;

type PromoPriceTier = { minQty: number; price: string };
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
  ended?: boolean;
  pinned?: boolean;
  promoStatus?: PromotionStatus;
};

type TierFormRow = { minQty: string; price: string };

type PromotionProduct = { sku: string; name?: string; brand?: string };

const statusStyle: Record<PromotionStatus, CSSProperties> = {
  active: { background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0" },
  scheduled: { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" },
  expired: { background: "#f3f4f6", color: "#4b5563", border: "1px solid #d1d5db" },
  sold_out: { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" },
  ended: { background: "#f5f3ff", color: "#6d28d9", border: "1px solid #ddd6fe" },
};

const statusLabel: Record<PromotionStatus, string> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired",
  sold_out: "Sold out",
  ended: "Ended",
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

function dealSummary(p: PromotionRecord) {
  if (p.buyQty && p.getQtyFree) return `Buy ${p.buyQty} Get ${p.getQtyFree} free`;
  if (p.priceTiers?.length) return formatTierPricesLine(p.priceTiers);
  if (p.promoPrice) return `Price: ${p.promoPrice}`;
  return "";
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
    promotionEnded: false,
    pinned: false,
  };
}

export default function AdminPromotionsPage() {
  const { authed, adminHeaders } = useAdminAuth();

  const [promotions, setPromotions] = useState<PromotionRecord[]>([]);
  const [products, setProducts] = useState<PromotionProduct[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busy, setBusy] = useState(false);
  const [promotionsLoaded, setPromotionsLoaded] = useState(false);
  const [promoStats, setPromoStats] = useState<
    Record<string, { qtyRecent28: number; qtyPrior28: number; changePct: number | null }>
  >({});
  const [promoRoi, setPromoRoi] = useState<
    { sku: string; brand: string; qtyPromo28: number; qtyBrandPeers28: number; liftVsBrandPct: number | null }[]
  >([]);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"success" | "error">("success");
  const [catalogLookup, setCatalogLookup] = useState<PromotionProduct | null>(null);

  const notify = (text: string, tone: "success" | "error" = "success") => {
    setMsg(text);
    setMsgTone(tone);
  };

  const productMap = useMemo(() => {
    const map = new Map<string, PromotionProduct>();
    for (const p of products) map.set(p.sku.toUpperCase(), p);
    return map;
  }, [products]);

  const selectedProduct =
    productMap.get(form.sku.trim().toUpperCase()) ?? catalogLookup;

  useEffect(() => {
    const clean = form.sku.trim().toUpperCase();
    if (!clean) {
      setCatalogLookup(null);
      return;
    }
    if (productMap.has(clean)) {
      setCatalogLookup(null);
      return;
    }

    setCatalogLookup(null);

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/promotions?lookupSku=${encodeURIComponent(clean)}`,
          { cache: "no-store", headers: adminHeaders() }
        );
        const data = await res.json();
        if (!cancelled) {
          setCatalogLookup(res.ok && data.product ? (data.product as PromotionProduct) : null);
        }
      } catch {
        if (!cancelled) setCatalogLookup(null);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.sku, productMap, adminHeaders]);

  const filteredPromotions = useMemo(() => {
    const q = search.trim().toUpperCase();
    return promotions.filter((p) => {
      const status = p.promoStatus || "active";
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!q) return true;
      const product = productMap.get(p.sku.toUpperCase());
      return (
        p.sku.toUpperCase().includes(q) ||
        p.note?.toUpperCase().includes(q) ||
        product?.name?.toUpperCase().includes(q) ||
        product?.brand?.toUpperCase().includes(q)
      );
    });
  }, [promotions, search, statusFilter, productMap]);

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

  useEffect(() => {
    if (!authed) return;
    void (async () => {
      try {
        const [effRes, roiRes] = await Promise.all([
          fetch("/api/admin/promo-effectiveness?limit=50", { headers: adminHeaders() }),
          fetch("/api/admin/promo-roi", { headers: adminHeaders() }),
        ]);
        const eff = await effRes.json();
        const roi = await roiRes.json();
        if (effRes.ok && Array.isArray(eff.rows)) {
          const map: Record<string, { qtyRecent28: number; qtyPrior28: number; changePct: number | null }> = {};
          for (const row of eff.rows) map[row.sku] = row;
          setPromoStats(map);
        }
        if (roiRes.ok && Array.isArray(roi.rows)) setPromoRoi(roi.rows);
      } catch {
        /* optional analytics */
      }
    })();
  }, [authed, adminHeaders]);

  const editPromotion = (record: PromotionRecord) => {
    const tiers = emptyTierRows();
    (record.priceTiers || []).forEach((tier, index) => {
      if (index >= 3) return;
      tiers[index] = { minQty: String(tier.minQty), price: tier.price };
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
      promotionEnded: Boolean(record.ended),
      pinned: Boolean(record.pinned),
    });
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
                  .map((tier) => ({ minQty: tier.minQty, price: tier.price.trim() }))
                  .filter((tier) => tier.minQty && tier.price)
              : undefined,
          resetSoldQty: form.resetSoldQty,
          ended: form.promotionEnded,
          pinned: form.pinned,
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
  const editingSku = form.sku.trim().toUpperCase();

  return (
    <AdminPage
      active="promotions"
      title="Promotions"
      subtitle="Click a row to edit · Active promos sync to /new/ and customer Weekly picks."
      actions={
        <BtnSecondary onClick={() => setForm(emptyForm())} disabled={busy}>
          + New promo
        </BtnSecondary>
      }
    >
      <StatGrid
        items={[
          { label: "Total promos", value: promotions.length },
          { label: "Live now", value: activeCount },
          { label: "Pinned", value: promotions.filter((p) => p.pinned).length },
          { label: "Valid SKUs", value: products.length },
          {
            label: "Missing SKU",
            value: promotions.filter((p) => !productMap.has(p.sku.toUpperCase())).length,
          },
        ]}
      />

      <AdminPublicShowcaseHint variant="promotions" />

      {!promotionsLoaded && busy ? (
        <Panel title="Loading promotions">
          <p style={{ margin: 0, fontSize: 13, color: "#0f766e", fontWeight: 800 }}>Loading…</p>
        </Panel>
      ) : null}

      <div style={splitLayout} className="admin-catalog-split admin-split">
        <Panel title={`List (${filteredPromotions.length})`}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU, name, brand, note…"
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <FilterChips
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { id: "all", label: "All" },
              { id: "active", label: "Active" },
              { id: "scheduled", label: "Scheduled" },
              { id: "expired", label: "Expired" },
              { id: "ended", label: "Ended" },
              { id: "sold_out", label: "Sold out" },
            ]}
          />
          <div className="admin-split-list">
            {filteredPromotions.map((p) => {
              const product = productMap.get(p.sku.toUpperCase());
              const status = p.promoStatus || "active";
              const remaining =
                p.promoQty && p.promoQty > 0 ? Math.max(0, p.promoQty - (p.soldQty || 0)) : null;
              const deal = dealSummary(p);

              return (
                <SalesListItem
                  key={p.sku}
                  selected={editingSku === p.sku.toUpperCase()}
                  onClick={() => editPromotion(p)}
                  onRemove={() => removePromotion(p.sku)}
                  removeDisabled={busy}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 14 }}>{p.sku}</strong>
                    {p.pinned ? (
                      <StatusBadge
                        label="PINNED"
                        style={{ background: "#fef3c7", color: "#b45309", border: "1px solid #fcd34d" }}
                      />
                    ) : null}
                    <StatusBadge label={statusLabel[status]} style={statusStyle[status]} />
                  </div>
                  {p.note ? (
                    <div style={{ fontSize: 12, color: "#c2410c", fontWeight: 800, marginTop: 2 }}>{p.note}</div>
                  ) : null}
                  {product ? (
                    <div className="admin-sales-list-summary">
                      {product.brand ? `${product.brand} · ` : ""}
                      {product.name || "—"}
                    </div>
                  ) : (
                    <div className="admin-sales-list-summary" style={{ color: "#b91c1c", fontWeight: 700 }}>
                      SKU not in catalog
                    </div>
                  )}
                  {deal ? <div className="admin-sales-list-deal">{deal}</div> : null}
                  <div className="admin-sales-list-summary">
                    {(p.startDate || p.endDate) && (
                      <span>
                        {p.startDate || "—"} → {p.endDate || "—"}
                        {" · "}
                      </span>
                    )}
                    {p.promoQty
                      ? `Sold ${p.soldQty || 0}/${p.promoQty}${remaining !== null ? ` · left ${remaining}` : ""}`
                      : "No qty cap"}
                  </div>
                  {promoStats[p.sku] ? (
                    <div className="admin-sales-list-summary" style={{ fontWeight: 800, color: "#1d4ed8" }}>
                      28d: {promoStats[p.sku].qtyRecent28} cs (was {promoStats[p.sku].qtyPrior28})
                      {promoStats[p.sku].changePct != null
                        ? ` · ${promoStats[p.sku].changePct!.toFixed(0)}%`
                        : ""}
                    </div>
                  ) : null}
                </SalesListItem>
              );
            })}
            {promotionsLoaded && filteredPromotions.length === 0 ? (
              <EmptyState
                title={promotions.length === 0 ? "No promotions yet" : "No matches"}
                detail={
                  promotions.length === 0
                    ? "Use + New promo or pick a SKU on the right."
                    : "Try another search or filter."
                }
              />
            ) : null}
          </div>
        </Panel>

        <div style={splitForm} className="admin-catalog-form-sticky">
          <Panel title={editingSku ? `Edit ${editingSku}` : "Add promotion"}>
            <FormSection title="SKU & label" hint="Required to save">
              <div style={formGrid}>
                <div>
                  <FieldLabel required>SKU</FieldLabel>
                  <AdminSkuAutocomplete
                    value={form.sku}
                    onChange={(v) => setForm((f) => ({ ...f, sku: v }))}
                    placeholder="Type SKU or name…"
                  />
                  <SkuPreview sku={form.sku} product={selectedProduct} />
                </div>
                <div>
                  <FieldLabel>Short label</FieldLabel>
                  <input
                    value={form.note}
                    onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                    placeholder="Hot deal / 限时促销"
                    style={inputStyle}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection title="Schedule & limit" hint="Dates and qty cap are optional">
              <div className="admin-form-grid-2" lang="en">
                <div>
                  <FieldLabel>Start date</FieldLabel>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <FieldLabel>End date</FieldLabel>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <FieldLabel>Promo qty (sold until gone)</FieldLabel>
                <input
                  value={form.promoQty}
                  onChange={(e) => setForm((f) => ({ ...f, promoQty: e.target.value.replace(/[^0-9]/g, "") }))}
                  placeholder="Empty = unlimited"
                  inputMode="numeric"
                  style={inputStyle}
                />
              </div>
            </FormSection>

            <FormSection title="Deal pricing" hint="Pick one — same options as before" tone="accent">
              <SegmentedPicker
                value={form.dealMode}
                onChange={(mode) => setForm((f) => ({ ...f, dealMode: mode }))}
                ariaLabel="Deal type"
                options={[
                  { id: "none", label: "Single price" },
                  { id: "bogo", label: "Buy X Get Y" },
                  { id: "tiered", label: "Volume tiers" },
                ]}
              />

              {form.dealMode === "none" ? (
                <div style={{ marginTop: 10 }}>
                  <FieldLabel>Promo price</FieldLabel>
                  <input
                    value={form.promoPrice}
                    onChange={(e) => setForm((f) => ({ ...f, promoPrice: e.target.value }))}
                    placeholder="$12.99"
                    style={inputStyle}
                  />
                </div>
              ) : null}

              {form.dealMode === "bogo" ? (
                <div className="admin-form-grid-2" style={{ marginTop: 10 }}>
                  <div>
                    <FieldLabel>Buy qty</FieldLabel>
                    <input
                      value={form.buyQty}
                      onChange={(e) => setForm((f) => ({ ...f, buyQty: e.target.value.replace(/[^0-9]/g, "") }))}
                      placeholder="2"
                      inputMode="numeric"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <FieldLabel>Free qty</FieldLabel>
                    <input
                      value={form.getQtyFree}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, getQtyFree: e.target.value.replace(/[^0-9]/g, "") }))
                      }
                      placeholder="1"
                      inputMode="numeric"
                      style={inputStyle}
                    />
                  </div>
                </div>
              ) : null}

              {form.dealMode === "tiered" ? (
                <div className="admin-tier-list" style={{ marginTop: 10 }}>
                  {form.tiers.map((tier, index) => (
                    <div key={index} className="admin-tier-row">
                      <span className="admin-tier-row-label">{index + 1}</span>
                      <div>
                        <FieldLabel>Min cs</FieldLabel>
                        <input
                          value={tier.minQty}
                          onChange={(e) =>
                            setForm((f) => {
                              const tiers = [...f.tiers];
                              tiers[index] = {
                                ...tiers[index],
                                minQty: e.target.value.replace(/[^0-9]/g, ""),
                              };
                              return { ...f, tiers };
                            })
                          }
                          placeholder={index === 0 ? "280" : index === 1 ? "140" : "30"}
                          inputMode="numeric"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <FieldLabel>Price</FieldLabel>
                        <input
                          value={tier.price}
                          onChange={(e) =>
                            setForm((f) => {
                              const tiers = [...f.tiers];
                              tiers[index] = { ...tiers[index], price: e.target.value };
                              return { ...f, tiers };
                            })
                          }
                          placeholder={index === 0 ? "10.00" : index === 1 ? "10.50" : "11.00"}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  ))}
                  <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>
                    e.g. $10.00/280cs · $10.50/140cs · $11.00/30cs
                  </p>
                </div>
              ) : null}
            </FormSection>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 8,
                border: form.pinned ? "1px solid #fcd34d" : "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 12,
                background: form.pinned ? "#fffbeb" : "#fff",
                color: "#92400e",
              }}
            >
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
              />
              Pin to top — show first in customer Weekly picks and /order promotion tab
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              <input
                type="checkbox"
                checked={form.promotionEnded}
                onChange={(e) => setForm((f) => ({ ...f, promotionEnded: e.target.checked }))}
              />
              Promotion ended (hide from store weekly picks)
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              <input
                type="checkbox"
                checked={form.resetSoldQty}
                onChange={(e) => setForm((f) => ({ ...f, resetSoldQty: e.target.checked }))}
              />
              Reset sold count to 0 when saving
            </label>

            <div className="admin-form-actions-sticky">
              <BtnRow>
                <BtnPrimary onClick={savePromotion} disabled={busy}>
                  {busy ? "Saving…" : "Save promotion"}
                </BtnPrimary>
                <BtnSecondary onClick={() => setForm(emptyForm())} disabled={busy}>
                  Clear
                </BtnSecondary>
                <BtnSecondary onClick={loadPromotions} disabled={busy}>
                  Refresh
                </BtnSecondary>
              </BtnRow>
              <Toast message={msg} tone={msgTone} />
            </div>
          </Panel>
        </div>
      </div>

      {promoRoi.length ? (
        <section id="promo-roi" style={{ scrollMarginTop: 72 }}>
        <Panel title="Promo ROI (28d vs same-brand non-promo volume)">
          <div style={{ fontSize: 13, lineHeight: 1.55 }}>
            {promoRoi.slice(0, 8).map((r) => (
              <div key={r.sku} style={{ marginBottom: 6 }}>
                <strong>{r.sku}</strong> ({r.brand}) — promo {r.qtyPromo28} cs · brand peers {r.qtyBrandPeers28} cs
                {r.liftVsBrandPct != null ? ` · lift ${r.liftVsBrandPct.toFixed(0)}%` : ""}
              </div>
            ))}
          </div>
        </Panel>
        </section>
      ) : null}
    </AdminPage>
  );
}
