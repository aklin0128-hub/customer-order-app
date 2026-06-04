"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { AdminPage } from "../_components/AdminPage";
import { FieldLabel, inputStyle } from "../_components/admin-sales-ui";
import { panel, panelTitle, splitForm, splitLayout } from "../_components/admin-styles";
import { BtnPrimary, BtnSecondary, Panel, StatGrid, Toast } from "../_components/admin-utils";
import { useAdminAuth } from "../_components/useAdminAuth";

type TopSkuRow = {
  rank: number;
  sku: string;
  name: string;
  brand: string;
  status: string;
  totalQty: number;
  invoiceQty: number;
  orderQty: number;
  accountCount: number;
  purchaseCount: number;
  topAccounts: { accountNo: string; qty: number }[];
};

type TopSkusData = {
  rows: TopSkuRow[];
  summary: {
    skuCount: number;
    totalQty: number;
    invoiceQty: number;
    orderQty: number;
    importCount: number;
    orderAccountCount: number;
    days: number | null;
    limit: number;
  };
};

type BuyerRow = {
  accountNo: string;
  totalQty: number;
  invoiceCount: number;
  latestPrice: number | null;
  latestDate: string;
};

type SkuBuyersData = {
  buyerRows: BuyerRow[];
  skuProduct: { sku: string; name?: string; brand?: string; status?: string } | null;
};

const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function money(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? moneyFmt.format(value) : "-";
}

const thStyle: CSSProperties = {
  padding: 8,
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  fontSize: 12,
  fontWeight: 800,
  color: "#6b7280",
};

const tdStyle: CSSProperties = { padding: 8 };

export default function AdminTopSkusPage() {
  const router = useRouter();
  const { authed, adminHeaders } = useAdminAuth();

  const [days, setDays] = useState("");
  const [limit, setLimit] = useState("100");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [data, setData] = useState<TopSkusData | null>(null);
  const [selectedSku, setSelectedSku] = useState("");
  const [manualSku, setManualSku] = useState("");
  const [buyerBusy, setBuyerBusy] = useState(false);
  const [buyerMsg, setBuyerMsg] = useState("");
  const [buyerData, setBuyerData] = useState<SkuBuyersData | null>(null);

  const syncUrl = useCallback(
    (sku: string) => {
      const params = new URLSearchParams();
      if (days) params.set("days", days);
      if (sku) params.set("sku", sku);
      const qs = params.toString();
      router.replace(qs ? `/admin/top-skus?${qs}` : "/admin/top-skus", { scroll: false });
    },
    [days, router]
  );

  const loadRanking = useCallback(async () => {
    setBusy(true);
    setMsg("");
    try {
      const params = new URLSearchParams();
      if (days) params.set("days", days);
      if (limit) params.set("limit", limit);

      const res = await fetch(`/api/admin/top-skus?${params.toString()}`, {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load top SKUs.");
      setData(json);
    } catch (err: any) {
      setMsg(err?.message || "Failed to load top SKUs.");
    } finally {
      setBusy(false);
    }
  }, [adminHeaders, days, limit]);

  const loadBuyers = useCallback(
    async (sku: string) => {
      const clean = sku.trim().toUpperCase();
      if (!clean) {
        setBuyerMsg("Enter a SKU.");
        setBuyerData(null);
        return;
      }

      setBuyerBusy(true);
      setBuyerMsg("");
      try {
        const params = new URLSearchParams({ mode: "buyers", sku: clean });
        if (days) params.set("days", days);
        const res = await fetch(`/api/admin/price-compare?${params.toString()}`, {
          cache: "no-store",
          headers: adminHeaders(),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load buyers.");
        setBuyerData(json);
        setSelectedSku(clean);
        setManualSku(clean);
        syncUrl(clean);
      } catch (err: any) {
        setBuyerMsg(err?.message || "Failed to load buyers.");
        setBuyerData(null);
      } finally {
        setBuyerBusy(false);
      }
    },
    [adminHeaders, days, syncUrl]
  );

  const clearSkuDetail = useCallback(() => {
    setSelectedSku("");
    setManualSku("");
    setBuyerData(null);
    setBuyerMsg("");
    syncUrl("");
  }, [syncUrl]);

  const selectSkuFromRow = useCallback(
    (row: TopSkuRow) => {
      void loadBuyers(row.sku);
    },
    [loadBuyers]
  );

  useEffect(() => {
    if (authed) void loadRanking();
  }, [authed, loadRanking]);

  useEffect(() => {
    if (!authed) return;
    const params = new URLSearchParams(window.location.search);
    const daysParam = params.get("days");
    if (daysParam !== null && daysParam !== days) setDays(daysParam);
    const skuFromUrl = params.get("sku")?.trim().toUpperCase() || "";
    if (!skuFromUrl || skuFromUrl === selectedSku) return;
    void loadBuyers(skuFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const downloadCsv = () => {
    if (!data?.rows.length) return;

    const header = [
      "Rank",
      "SKU",
      "Brand",
      "Name",
      "Status",
      "Total Qty",
      "Invoice Qty",
      "Order Qty",
      "Accounts",
      "Top Accounts",
    ];
    const lines = data.rows.map((row) => [
      row.rank,
      row.sku,
      row.brand,
      row.name,
      row.status,
      row.totalQty,
      row.invoiceQty,
      row.orderQty,
      row.accountCount,
      row.topAccounts.map((a) => `${a.accountNo}:${a.qty}`).join("; "),
    ]);

    const csv = [header, ...lines]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `top-skus${days ? `-${days}d` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedRow = data?.rows.find((r) => r.sku === selectedSku);

  if (!authed) return null;

  return (
    <AdminPage
      active="topSkus"
      title="Top SKUs"
      subtitle="Start with the ranking, then click a row to see which accounts buy that SKU."
    >
      {msg ? <Toast tone="error" message={msg} /> : null}

      <section style={panel}>
        <h2 style={panelTitle}>Filters (applies to ranking & buyer detail)</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <div>
            <FieldLabel>Date range</FieldLabel>
            <select
              value={days}
              onChange={(e) => {
                setDays(e.target.value);
                if (selectedSku) void loadBuyers(selectedSku);
              }}
              style={inputStyle}
            >
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 180 days</option>
              <option value="365">Last 365 days</option>
              <option value="">All history</option>
            </select>
          </div>
          <div>
            <FieldLabel>Show top</FieldLabel>
            <select value={limit} onChange={(e) => setLimit(e.target.value)} style={inputStyle}>
              <option value="50">50 SKUs</option>
              <option value="100">100 SKUs</option>
              <option value="200">200 SKUs</option>
              <option value="500">500 SKUs</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}>
            <BtnPrimary onClick={() => void loadRanking()} disabled={busy}>
              {busy ? "Loading…" : "Refresh ranking"}
            </BtnPrimary>
            <BtnSecondary onClick={downloadCsv} disabled={!data?.rows.length}>
              Export CSV
            </BtnSecondary>
          </div>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
          Totals combine invoice imports and submitted orders. Click <strong>Buyers</strong> on any row for full account breakdown.
        </p>
      </section>

      {data ? (
        <StatGrid
          items={[
            { label: "SKUs with sales", value: data.summary.skuCount },
            { label: "Total cases", value: data.summary.totalQty },
            { label: "From invoices", value: data.summary.invoiceQty },
            { label: "From orders", value: data.summary.orderQty },
          ]}
        />
      ) : null}

      <div style={splitLayout} className="admin-catalog-split admin-split">
        <Panel title={`Ranking${data ? ` (${data.rows.length})` : ""}`}>
          {busy && !data ? (
            <p style={{ margin: 0, fontSize: 13, color: "#2563eb", fontWeight: 800 }}>Loading ranking…</p>
          ) : data?.rows.length ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>SKU</th>
                    <th style={thStyle}>Product</th>
                    <th style={thStyle}>Total</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => {
                    const selected = selectedSku === row.sku;
                    return (
                      <tr
                        key={row.sku}
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          background: selected ? "#eff6ff" : undefined,
                          cursor: "pointer",
                        }}
                        onClick={() => selectSkuFromRow(row)}
                      >
                        <td style={{ ...tdStyle, fontWeight: 900, color: "#6b7280" }}>{row.rank}</td>
                        <td style={{ ...tdStyle, fontWeight: 900 }}>{row.sku}</td>
                        <td style={{ ...tdStyle, maxWidth: 220 }}>
                          <div style={{ fontWeight: 700 }}>{row.name || "—"}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>
                            {row.brand || "—"} · {row.accountCount} accounts
                          </div>
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 900 }}>{row.totalQty}</td>
                        <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => selectSkuFromRow(row)}
                            className={`admin-chip${selected ? " admin-chip--active" : ""}`}
                            style={{ margin: 0 }}
                          >
                            Buyers
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : data ? (
            <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>No purchase data for this period.</p>
          ) : null}
        </Panel>

        <div style={splitForm} className="admin-catalog-form-sticky">
          <Panel title={selectedSku ? `Buyers · ${selectedSku}` : "SKU buyer detail"}>
            {!selectedSku ? (
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                Click a row on the left, or look up any SKU below (same date range as above).
              </p>
            ) : null}

            {selectedRow ? (
              <div
                style={{
                  marginBottom: 12,
                  padding: 10,
                  borderRadius: 10,
                  background: "#f8fafc",
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
              >
                <strong>#{selectedRow.rank}</strong> · {selectedRow.totalQty} cases total · inv {selectedRow.invoiceQty}{" "}
                · orders {selectedRow.orderQty}
              </div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 12 }}>
              <div>
                <FieldLabel>SKU</FieldLabel>
                <input
                  value={manualSku}
                  onChange={(e) => setManualSku(e.target.value.toUpperCase())}
                  placeholder="06194C"
                  style={inputStyle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void loadBuyers(manualSku);
                  }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
                <BtnPrimary onClick={() => void loadBuyers(manualSku)} disabled={buyerBusy}>
                  {buyerBusy ? "Loading…" : "Load"}
                </BtnPrimary>
                {selectedSku ? (
                  <BtnSecondary onClick={clearSkuDetail} disabled={buyerBusy}>
                    Clear
                  </BtnSecondary>
                ) : null}
              </div>
            </div>

            {buyerMsg ? <Toast tone="error" message={buyerMsg} /> : null}

            {buyerData?.skuProduct ? (
              <>
                <div style={{ fontSize: 13, color: "#374151", marginBottom: 10, lineHeight: 1.45 }}>
                  <strong>{buyerData.skuProduct.sku}</strong>
                  {buyerData.skuProduct.brand ? ` · ${buyerData.skuProduct.brand}` : ""}
                  <br />
                  {buyerData.skuProduct.name || "—"} · Status:{" "}
                  <strong>{buyerData.skuProduct.status || "Not in catalog"}</strong>
                </div>
                {buyerData.buyerRows.length ? (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Account</th>
                          <th style={thStyle}>Total qty</th>
                          <th style={thStyle}>Invoices</th>
                          <th style={thStyle}>Latest price</th>
                          <th style={thStyle}>Latest date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {buyerData.buyerRows.map((row) => (
                          <tr key={row.accountNo} style={{ borderBottom: "1px solid #f3f4f6" }}>
                            <td style={{ ...tdStyle, fontWeight: 900 }}>{row.accountNo}</td>
                            <td style={tdStyle}>{row.totalQty}</td>
                            <td style={tdStyle}>{row.invoiceCount}</td>
                            <td style={tdStyle}>{money(row.latestPrice)}</td>
                            <td style={tdStyle}>{row.latestDate || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
                    No buyer history for this SKU in the selected period.
                  </p>
                )}
              </>
            ) : buyerBusy ? (
              <p style={{ margin: 0, fontSize: 13, color: "#2563eb", fontWeight: 800 }}>Loading buyers…</p>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Select a SKU to see buyer ranking.</p>
            )}
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}
