"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminPage } from "../_components/AdminPage";
import { FieldLabel, inputStyle } from "../_components/admin-sales-ui";
import { panel, panelTitle } from "../_components/admin-styles";
import { BtnPrimary, BtnSecondary, Panel, StatGrid, Toast } from "../_components/admin-utils";
import {
  AdminAccountPriceRows,
  AdminPriceEmptyHint,
  AdminPriceSectionTabs,
  AdminSkuBuyersTable,
  type PriceComparePriceData,
  type SkuBuyersData,
} from "../_components/admin-price-ui";
import { useAdminAuth } from "../_components/useAdminAuth";

type PriceSection = "price" | "buyers";

function buildUrl(section: PriceSection, accountNo: string, sku: string, days: string) {
  const params = new URLSearchParams();
  params.set("section", section);
  if (accountNo.trim()) params.set("accountNo", accountNo.trim().toUpperCase());
  if (sku.trim()) params.set("sku", sku.trim().toUpperCase());
  if (days) params.set("days", days);
  const qs = params.toString();
  return qs ? `/admin/price-compare?${qs}` : "/admin/price-compare";
}

export default function AdminPriceComparePage() {
  const router = useRouter();
  const { authed, adminHeaders } = useAdminAuth();

  const [section, setSection] = useState<PriceSection>("price");
  const [accountNo, setAccountNo] = useState("");
  const [sku, setSku] = useState("");
  const [days, setDays] = useState("90");

  const [priceBusy, setPriceBusy] = useState(false);
  const [priceMsg, setPriceMsg] = useState("");
  const [priceData, setPriceData] = useState<PriceComparePriceData | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const [buyerBusy, setBuyerBusy] = useState(false);
  const [buyerMsg, setBuyerMsg] = useState("");
  const [buyerData, setBuyerData] = useState<SkuBuyersData | null>(null);

  const syncUrl = useCallback(
    (next: { section?: PriceSection; accountNo?: string; sku?: string; days?: string }) => {
      const href = buildUrl(
        next.section ?? section,
        next.accountNo ?? accountNo,
        next.sku ?? sku,
        next.days ?? days
      );
      router.replace(href, { scroll: false });
    },
    [accountNo, days, router, section, sku]
  );

  const loadPriceHistory = useCallback(async () => {
    const cleanAccount = accountNo.trim().toUpperCase();
    const cleanSku = sku.trim().toUpperCase();
    if (!cleanAccount || !cleanSku) {
      setPriceMsg("Enter both account number and SKU.");
      setPriceData(null);
      return;
    }

    setPriceBusy(true);
    setPriceMsg("");
    try {
      const params = new URLSearchParams({ mode: "price", accountNo: cleanAccount, sku: cleanSku });
      if (days) params.set("days", days);
      const res = await fetch(`/api/admin/price-compare?${params.toString()}`, {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load price history.");
      setPriceData(json);
      setExpandedKey(null);
      syncUrl({ section: "price", accountNo: cleanAccount, sku: cleanSku });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load price history.";
      setPriceMsg(message);
      setPriceData(null);
    } finally {
      setPriceBusy(false);
    }
  }, [accountNo, adminHeaders, days, sku, syncUrl]);

  const loadBuyers = useCallback(async () => {
    const cleanSku = sku.trim().toUpperCase();
    if (!cleanSku) {
      setBuyerMsg("Enter a SKU.");
      setBuyerData(null);
      return;
    }

    setBuyerBusy(true);
    setBuyerMsg("");
    try {
      const params = new URLSearchParams({ mode: "buyers", sku: cleanSku });
      if (days) params.set("days", days);
      const res = await fetch(`/api/admin/price-compare?${params.toString()}`, {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load buyers.");
      setBuyerData(json);
      syncUrl({ section: "buyers", sku: cleanSku });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load buyers.";
      setBuyerMsg(message);
      setBuyerData(null);
    } finally {
      setBuyerBusy(false);
    }
  }, [adminHeaders, days, sku, syncUrl]);

  const switchSection = useCallback(
    (next: PriceSection) => {
      setSection(next);
      syncUrl({ section: next });
    },
    [syncUrl]
  );

  useEffect(() => {
    if (!authed) return;
    const params = new URLSearchParams(window.location.search);
    const sectionParam = params.get("section");
    if (sectionParam === "buyers" || sectionParam === "price") setSection(sectionParam);

    const accountParam = params.get("accountNo")?.trim().toUpperCase() || "";
    const skuParam = params.get("sku")?.trim().toUpperCase() || "";
    const daysParam = params.get("days");

    if (accountParam) setAccountNo(accountParam);
    if (skuParam) setSku(skuParam);
    if (daysParam !== null) setDays(daysParam);

    const effectiveSection = sectionParam === "buyers" ? "buyers" : "price";
    if (effectiveSection === "buyers" && skuParam) {
      void (async () => {
        setBuyerBusy(true);
        setBuyerMsg("");
        try {
          const q = new URLSearchParams({ mode: "buyers", sku: skuParam });
          if (daysParam) q.set("days", daysParam);
          const res = await fetch(`/api/admin/price-compare?${q.toString()}`, {
            cache: "no-store",
            headers: adminHeaders(),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json?.error || "Failed to load buyers.");
          setBuyerData(json);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Failed to load buyers.";
          setBuyerMsg(message);
          setBuyerData(null);
        } finally {
          setBuyerBusy(false);
        }
      })();
    } else if (accountParam && skuParam) {
      void (async () => {
        setPriceBusy(true);
        setPriceMsg("");
        try {
          const q = new URLSearchParams({ mode: "price", accountNo: accountParam, sku: skuParam });
          if (daysParam) q.set("days", daysParam);
          const res = await fetch(`/api/admin/price-compare?${q.toString()}`, {
            cache: "no-store",
            headers: adminHeaders(),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json?.error || "Failed to load price history.");
          setPriceData(json);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Failed to load price history.";
          setPriceMsg(message);
          setPriceData(null);
        } finally {
          setPriceBusy(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const runSearch = () => {
    if (section === "buyers") void loadBuyers();
    else void loadPriceHistory();
  };

  return (
    <AdminPage
      active="priceCompare"
      title="Price Compare"
      subtitle="Account price history and SKU buyer breakdown in one place."
    >
      {priceMsg ? <Toast tone="error" message={priceMsg} /> : null}
      {buyerMsg ? <Toast tone="error" message={buyerMsg} /> : null}

      <section style={panel}>
        <AdminPriceSectionTabs section={section} onSectionChange={switchSection} />
        <h2 style={{ ...panelTitle, marginTop: 16 }}>
          {section === "price" ? "Account + SKU price history" : "Who buys this SKU?"}
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            marginTop: 12,
          }}
        >
          {section === "price" ? (
            <div>
              <FieldLabel>Account #</FieldLabel>
              <input
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
                placeholder="e.g. 12345"
                style={inputStyle}
              />
            </div>
          ) : null}
          <div>
            <FieldLabel>SKU</FieldLabel>
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g. 000123"
              style={inputStyle}
            />
          </div>
          <div>
            <FieldLabel>Date range</FieldLabel>
            <select value={days} onChange={(e) => setDays(e.target.value)} style={inputStyle}>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 180 days</option>
              <option value="365">Last 365 days</option>
              <option value="">All history</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}>
            <BtnPrimary onClick={runSearch} disabled={section === "price" ? priceBusy : buyerBusy}>
              {section === "price" ? (priceBusy ? "Loading…" : "Load history") : buyerBusy ? "Loading…" : "Load buyers"}
            </BtnPrimary>
            {section === "price" && priceData?.accountRows.length ? (
              <BtnSecondary
                onClick={() => {
                  setAccountNo("");
                  setSku("");
                  setPriceData(null);
                  setPriceMsg("");
                  router.replace("/admin/price-compare?section=price", { scroll: false });
                }}
              >
                Clear
              </BtnSecondary>
            ) : null}
          </div>
        </div>
        {section === "price" ? (
          <AdminPriceEmptyHint>
            From Account 360 or Customers — open with <strong>?accountNo=…&sku=…</strong>. Expand a row for invoice-level
            price changes.
          </AdminPriceEmptyHint>
        ) : (
          <AdminPriceEmptyHint>
            From Top SKUs — click a row to land here with <strong>?section=buyers&sku=…</strong>.
          </AdminPriceEmptyHint>
        )}
      </section>

      {section === "price" && priceData ? (
        <>
          <StatGrid
            items={[
              { label: "Account", value: priceData.filters.accountNo },
              { label: "SKU filter", value: priceData.filters.sku || "All" },
              { label: "SKUs matched", value: priceData.accountRows.length },
              { label: "Priced lines", value: priceData.pricedPointCount },
            ]}
          />
          <Panel title={`Price history (${priceData.accountRows.length})`}>
            <AdminAccountPriceRows
              rows={priceData.accountRows}
              expandedKey={expandedKey}
              onToggle={(key) => setExpandedKey((prev) => (prev === key ? null : key))}
            />
          </Panel>
        </>
      ) : null}

      {section === "buyers" && buyerData ? (
        <>
          {buyerData.skuProduct ? (
            <StatGrid
              items={[
                { label: "SKU", value: buyerData.skuProduct.sku },
                { label: "Product", value: buyerData.skuProduct.name || "—" },
                { label: "Brand", value: buyerData.skuProduct.brand || "—" },
                { label: "Status", value: buyerData.skuProduct.status || "—" },
              ]}
            />
          ) : null}
          <Panel title={`Top buyers (${buyerData.buyerRows.length})`}>
            <AdminSkuBuyersTable rows={buyerData.buyerRows} />
          </Panel>
        </>
      ) : null}
    </AdminPage>
  );
}
