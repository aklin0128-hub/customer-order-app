"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MARKET_REGIONS } from "@/lib/customerRegion";
import { parseUsDateToIso, WEEKDAY_OPTIONS, weekdayFromDateInput } from "@/lib/weeklySalesReportUi";
import { AdminPage } from "../_components/AdminPage";
import { inputStyle, labelStyle, panel, panelTitle } from "../_components/admin-styles";
import { BtnPrimary, BtnRow, BtnSecondary, StatGrid, Toast } from "../_components/admin-utils";
import { useAdminAuth } from "../_components/useAdminAuth";

type ReportRow = {
  weekday: string;
  cid: string;
  sales: number | null;
  insights: string;
  notes: string;
  orderRef: string;
  gpPercent?: number | null;
  orderDate?: string;
};

type ReportPreview = {
  meta: {
    reportDate: string;
    regionCode: string;
    sid: string;
    visitArea: string;
    periodLabel: string;
    regionLabel: string;
    orderCount: number;
    totalSales: number | null;
    averageGpPercent?: number | null;
  };
  rows: ReportRow[];
};

type EditableRow = {
  id: string;
  weekday: string;
  orderDate: string;
  cid: string;
  salesInput: string;
  gpInput: string;
  insights: string;
  notes: string;
};

type CustomerOption = {
  accountNo: string;
  storeName: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function biweeklyDefaults() {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 13);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}


function newRowId() {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyEditableRow(): EditableRow {
  const orderDate = todayIso();
  return {
    id: newRowId(),
    weekday: weekdayFromDateInput(orderDate),
    orderDate,
    cid: "",
    salesInput: "",
    gpInput: "",
    insights: "",
    notes: "",
  };
}

function rowToEditable(row: ReportRow): EditableRow {
  const orderDate = row.orderDate ? parseUsDateToIso(row.orderDate) : "";
  return {
    id: newRowId(),
    weekday: row.weekday || weekdayFromDateInput(orderDate),
    orderDate,
    cid: row.cid || "",
    salesInput: row.sales != null ? String(row.sales) : "",
    gpInput: row.gpPercent != null ? String(row.gpPercent) : "",
    insights: row.insights || "",
    notes: row.notes || "",
  };
}

function computeRowStats(rows: EditableRow[]) {
  let totalSales: number | null = null;
  let pricedRows = 0;
  const gpValues: number[] = [];

  for (const row of rows) {
    const sales = row.salesInput.trim() === "" ? null : Number(row.salesInput);
    if (sales != null && Number.isFinite(sales)) {
      totalSales = (totalSales ?? 0) + sales;
      pricedRows += 1;
    }
    const gp = row.gpInput.trim() === "" ? null : Number(row.gpInput);
    if (gp != null && Number.isFinite(gp)) gpValues.push(gp);
  }

  return {
    orderCount: rows.filter((row) => row.cid.trim()).length,
    totalSales: pricedRows > 0 ? Math.round((totalSales ?? 0) * 100) / 100 : null,
    averageGpPercent:
      gpValues.length > 0
        ? Math.round((gpValues.reduce((sum, value) => sum + value, 0) / gpValues.length) * 100) / 100
        : null,
  };
}

export default function AdminWeeklySalesReportPage() {
  const { authed, adminHeaders } = useAdminAuth();
  const defaults = useMemo(() => biweeklyDefaults(), []);

  const [region, setRegion] = useState("miami");
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [reportDate, setReportDate] = useState(todayIso());
  const [regionCode, setRegionCode] = useState("SE");
  const [sid, setSid] = useState("832");
  const [visitArea, setVisitArea] = useState("MIAMI");
  const [marketOverview, setMarketOverview] = useState("");
  const [productUpdate, setProductUpdate] = useState("");
  const [competitorInsight, setCompetitorInsight] = useState("");
  const [suggestions, setSuggestions] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"success" | "error">("success");
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [editableRows, setEditableRows] = useState<EditableRow[]>([]);
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);

  const queryBase = useMemo(() => {
    const params = new URLSearchParams({
      region,
      start: startDate,
      end: endDate,
      regionCode,
      sid,
      visitArea,
      reportDate,
    });
    return params;
  }, [region, startDate, endDate, regionCode, sid, visitArea, reportDate]);

  const loadPreview = useCallback(async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/weekly-sales-report?${queryBase.toString()}`, {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to preview report.");
      setPreview(data);
      const rows = Array.isArray(data.rows) ? (data.rows as ReportRow[]) : [];
      setEditableRows(rows.length > 0 ? rows.map(rowToEditable) : [emptyEditableRow()]);
      setMsg(`Preview: ${data.meta.orderCount} orders · ${data.meta.periodLabel}`);
      setMsgTone("success");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Failed to preview report.");
      setMsgTone("error");
      setPreview(null);
      setEditableRows([emptyEditableRow()]);
    } finally {
      setBusy(false);
    }
  }, [adminHeaders, queryBase]);

  useEffect(() => {
    if (!authed) return;
    void loadPreview();
  }, [authed, loadPreview]);

  useEffect(() => {
    const label = MARKET_REGIONS.find((r) => r.id === region)?.label.toUpperCase() || region.toUpperCase();
    setVisitArea(label);
  }, [region]);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/customers?region=${encodeURIComponent(region)}&limit=100`, {
          cache: "no-store",
          headers: adminHeaders(),
        });
        const data = await res.json();
        if (!res.ok || cancelled) return;
        const customers = Array.isArray(data.customers) ? data.customers : [];
        setCustomerOptions(
          customers.map((customer: CustomerOption) => ({
            accountNo: String(customer.accountNo || "").toUpperCase(),
            storeName: String(customer.storeName || ""),
          }))
        );
      } catch {
        if (!cancelled) setCustomerOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authed, region, adminHeaders]);

  const rowStats = useMemo(() => computeRowStats(editableRows), [editableRows]);

  const updateRow = (idx: number, patch: Partial<EditableRow>) => {
    setEditableRows((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    setEditableRows((prev) => [...prev, emptyEditableRow()]);
  };

  const removeRow = (idx: number) => {
    setEditableRows((prev) => (prev.length <= 1 ? [emptyEditableRow()] : prev.filter((_, i) => i !== idx)));
  };

  const downloadXlsx = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/weekly-sales-report?${queryBase.toString()}&format=xlsx`, {
        method: "POST",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          marketOverview,
          productUpdate,
          competitorInsight,
          suggestions,
          visitArea,
          sid,
          regionCode,
          reportDate,
          startDate,
          endDate,
          rows: editableRows.map((row) => ({
            weekday: row.weekday,
            orderDate: row.orderDate,
            cid: row.cid.trim().toUpperCase(),
            sales: row.salesInput.trim() === "" ? null : Number(row.salesInput),
            gpPercent: row.gpInput.trim() === "" ? null : Number(row.gpInput),
            insights: row.insights,
            notes: row.notes,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string })?.error || "Download failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `weekly-sales-report-${region}-${endDate.replace(/-/g, "")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setMsg("Downloaded weekly sales report (S70).");
      setMsgTone("success");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Download failed.");
      setMsgTone("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      active="weeklySales"
      title="Weekly Sales Report"
      subtitle="S70 weekly report · edit visit rows below or load from portal orders"
    >
      <Toast message={msg} tone={msgTone} />

      <div style={panel}>
        <div style={panelTitle}>Report settings</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <label style={labelStyle}>
            Visit region
            <select value={region} onChange={(e) => setRegion(e.target.value)} style={inputStyle}>
              {MARKET_REGIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Period start
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Period end
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Report date
            <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            REGION code
            <input value={regionCode} onChange={(e) => setRegionCode(e.target.value.toUpperCase())} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            SID
            <input value={sid} onChange={(e) => setSid(e.target.value.toUpperCase())} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            VISIT AREA
            <input value={visitArea} onChange={(e) => setVisitArea(e.target.value.toUpperCase())} style={inputStyle} />
          </label>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <label style={labelStyle}>
            MARKET OVERVIEW &amp; KEY ISSUES
            <textarea
              value={marketOverview}
              onChange={(e) => setMarketOverview(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>
          <label style={labelStyle}>
            PRODUCT UPDATE
            <textarea
              value={productUpdate}
              onChange={(e) => setProductUpdate(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>
          <label style={labelStyle}>
            COMPETITOR INSIGHT
            <textarea
              value={competitorInsight}
              onChange={(e) => setCompetitorInsight(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>
          <label style={labelStyle}>
            SUGGESTIONS
            <textarea
              value={suggestions}
              onChange={(e) => setSuggestions(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>
        </div>

        <div style={{ marginTop: 14 }}>
          <BtnRow>
            <BtnSecondary onClick={() => void loadPreview()} disabled={busy}>
              Refresh preview
            </BtnSecondary>
            <BtnPrimary onClick={() => void downloadXlsx()} disabled={busy}>
              Download .xlsx (S70)
            </BtnPrimary>
          </BtnRow>
        </div>
      </div>

      {preview ? (
        <div style={{ ...panel, marginTop: 14 }}>
          <StatGrid
            items={[
              { label: "Rows with CID", value: String(rowStats.orderCount) },
              {
                label: "Total Sales ($)",
                value: rowStats.totalSales != null ? rowStats.totalSales.toFixed(2) : "—",
              },
              {
                label: "Avg GP (%)",
                value: rowStats.averageGpPercent != null ? rowStats.averageGpPercent.toFixed(2) : "—",
              },
              { label: "Period", value: preview.meta.periodLabel },
            ]}
          />

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 12 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              Edit <strong>date</strong>, <strong>CID</strong>, <strong>Sales</strong>, GP, insights, and notes — or use{" "}
              <strong>Refresh preview</strong> to pull portal orders, then adjust.
            </p>
            <BtnSecondary onClick={addRow} disabled={busy}>
              + Add row
            </BtnSecondary>
          </div>

          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                  <th style={{ padding: 8, border: "1px solid #d1d5db", minWidth: 130 }}>Visit date</th>
                  <th style={{ padding: 8, border: "1px solid #d1d5db", minWidth: 90 }}>Day</th>
                  <th style={{ padding: 8, border: "1px solid #d1d5db", minWidth: 110 }}>CID</th>
                  <th style={{ padding: 8, border: "1px solid #d1d5db", minWidth: 110 }}>Sales ($)</th>
                  <th style={{ padding: 8, border: "1px solid #d1d5db", minWidth: 90 }}>GP (%)</th>
                  <th style={{ padding: 8, border: "1px solid #d1d5db", minWidth: 220 }}>Customer / market insights</th>
                  <th style={{ padding: 8, border: "1px solid #d1d5db", minWidth: 160 }}>Notes</th>
                  <th style={{ padding: 8, border: "1px solid #d1d5db", width: 72 }} />
                </tr>
              </thead>
              <tbody>
                {editableRows.map((row, idx) => (
                  <tr key={row.id}>
                    <td style={{ padding: 6, border: "1px solid #e5e7eb" }}>
                      <input
                        type="date"
                        value={row.orderDate}
                        onChange={(e) => {
                          const orderDate = e.target.value;
                          updateRow(idx, {
                            orderDate,
                            weekday: weekdayFromDateInput(orderDate),
                          });
                        }}
                        style={{ ...inputStyle, width: "100%", padding: "6px 8px" }}
                      />
                    </td>
                    <td style={{ padding: 6, border: "1px solid #e5e7eb" }}>
                      <select
                        value={row.weekday}
                        onChange={(e) => updateRow(idx, { weekday: e.target.value })}
                        style={{ ...inputStyle, width: "100%", padding: "6px 8px" }}
                      >
                        {WEEKDAY_OPTIONS.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: 6, border: "1px solid #e5e7eb" }}>
                      <input
                        list="weekly-sales-cid-options"
                        value={row.cid}
                        onChange={(e) => updateRow(idx, { cid: e.target.value.toUpperCase() })}
                        placeholder="FL342"
                        style={{ ...inputStyle, width: "100%", padding: "6px 8px" }}
                      />
                    </td>
                    <td style={{ padding: 6, border: "1px solid #e5e7eb" }}>
                      <input
                        value={row.salesInput}
                        onChange={(e) => updateRow(idx, { salesInput: e.target.value })}
                        placeholder="0.00"
                        inputMode="decimal"
                        style={{ ...inputStyle, width: "100%", padding: "6px 8px" }}
                      />
                    </td>
                    <td style={{ padding: 6, border: "1px solid #e5e7eb" }}>
                      <input
                        value={row.gpInput}
                        onChange={(e) => updateRow(idx, { gpInput: e.target.value })}
                        placeholder="—"
                        inputMode="decimal"
                        style={{ ...inputStyle, width: "100%", padding: "6px 8px" }}
                      />
                    </td>
                    <td style={{ padding: 6, border: "1px solid #e5e7eb" }}>
                      <textarea
                        value={row.insights}
                        onChange={(e) => updateRow(idx, { insights: e.target.value })}
                        rows={2}
                        placeholder="e.g. Business remains stable"
                        style={{ ...inputStyle, width: "100%", resize: "vertical", padding: "6px 8px" }}
                      />
                    </td>
                    <td style={{ padding: 6, border: "1px solid #e5e7eb" }}>
                      <textarea
                        value={row.notes}
                        onChange={(e) => updateRow(idx, { notes: e.target.value })}
                        rows={2}
                        style={{ ...inputStyle, width: "100%", resize: "vertical", padding: "6px 8px" }}
                      />
                    </td>
                    <td style={{ padding: 6, border: "1px solid #e5e7eb", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        disabled={busy}
                        style={{
                          border: "1px solid #e5e7eb",
                          background: "#fff",
                          borderRadius: 8,
                          padding: "6px 8px",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="weekly-sales-cid-options">
              {customerOptions.map((customer) => (
                <option
                  key={customer.accountNo}
                  value={customer.accountNo}
                  label={customer.storeName ? `${customer.accountNo} — ${customer.storeName}` : customer.accountNo}
                />
              ))}
            </datalist>
          </div>
        </div>
      ) : null}
    </AdminPage>
  );
}
