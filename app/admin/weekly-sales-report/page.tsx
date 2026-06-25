"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MARKET_REGIONS } from "@/lib/customerRegion";
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

type EditableRow = ReportRow & { gpInput: string };

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
      setEditableRows(
        (data.rows as ReportRow[]).map((row) => ({
          ...row,
          gpInput: row.gpPercent != null ? String(row.gpPercent) : "",
        }))
      );
      setMsg(`Preview: ${data.meta.orderCount} orders · ${data.meta.periodLabel}`);
      setMsgTone("success");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Failed to preview report.");
      setMsgTone("error");
      setPreview(null);
      setEditableRows([]);
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
            insights: row.insights,
            notes: row.notes,
            gpPercent: row.gpInput.trim() === "" ? null : Number(row.gpInput),
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
      subtitle="S70 weekly report · fill insights & GP before download · Sales from invoice prices"
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
              { label: "Orders in period", value: String(preview.meta.orderCount) },
              { label: "Total Sales ($)", value: preview.meta.totalSales != null ? preview.meta.totalSales.toFixed(2) : "—" },
              { label: "Avg GP (%)", value: preview.meta.averageGpPercent != null ? preview.meta.averageGpPercent.toFixed(2) : "—" },
              { label: "Period", value: preview.meta.periodLabel },
            ]}
          />

          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Edit <strong>Insights</strong>, <strong>GP (%)</strong>, and <strong>Notes</strong> below before download — same as your S70 template.
          </p>

          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                  <th style={{ padding: 8, border: "1px solid #d1d5db" }}>Day</th>
                  <th style={{ padding: 8, border: "1px solid #d1d5db" }}>CID</th>
                  <th style={{ padding: 8, border: "1px solid #d1d5db" }}>Sales ($)</th>
                  <th style={{ padding: 8, border: "1px solid #d1d5db", minWidth: 90 }}>GP (%)</th>
                  <th style={{ padding: 8, border: "1px solid #d1d5db", minWidth: 220 }}>Customer / market insights</th>
                  <th style={{ padding: 8, border: "1px solid #d1d5db", minWidth: 160 }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {editableRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 12, border: "1px solid #e5e7eb", color: "#6b7280" }}>
                      No portal orders in this period for customers assigned to {preview.meta.regionLabel}. Assign region in Admin → Customers.
                    </td>
                  </tr>
                ) : (
                  editableRows.map((row, idx) => (
                    <tr key={`${row.cid}-${row.orderRef}-${idx}`}>
                      <td style={{ padding: 8, border: "1px solid #e5e7eb" }}>{row.weekday}</td>
                      <td style={{ padding: 8, border: "1px solid #e5e7eb", fontWeight: 700 }}>{row.cid}</td>
                      <td style={{ padding: 8, border: "1px solid #e5e7eb" }}>
                        {row.sales != null ? row.sales.toFixed(2) : "—"}
                      </td>
                      <td style={{ padding: 6, border: "1px solid #e5e7eb" }}>
                        <input
                          value={row.gpInput}
                          onChange={(e) =>
                            setEditableRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, gpInput: e.target.value } : r))
                            )
                          }
                          placeholder="—"
                          style={{ ...inputStyle, width: "100%", padding: "6px 8px" }}
                        />
                      </td>
                      <td style={{ padding: 6, border: "1px solid #e5e7eb" }}>
                        <textarea
                          value={row.insights}
                          onChange={(e) =>
                            setEditableRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, insights: e.target.value } : r))
                            )
                          }
                          rows={2}
                          placeholder="e.g. Business remains stable"
                          style={{ ...inputStyle, width: "100%", resize: "vertical", padding: "6px 8px" }}
                        />
                      </td>
                      <td style={{ padding: 6, border: "1px solid #e5e7eb" }}>
                        <textarea
                          value={row.notes}
                          onChange={(e) =>
                            setEditableRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, notes: e.target.value } : r))
                            )
                          }
                          rows={2}
                          style={{ ...inputStyle, width: "100%", resize: "vertical", padding: "6px 8px" }}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </AdminPage>
  );
}
