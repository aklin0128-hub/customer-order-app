"use client";

import { startTransition, useCallback, useMemo, useState } from "react";
import { downloadCsv } from "@/app/admin/_components/admin-analytics-ui";
import { inputStyle, labelStyle } from "@/app/admin/_components/admin-styles";
import { BtnPrimary, BtnRow, EmptyState, Panel, StatGrid, Toast } from "@/app/admin/_components/admin-utils";
import {
  excludeInvoiceCompareColumns,
  invoiceCompareColumnKey,
  invoiceCompareToCsv,
  type InvoiceCompareReport,
  type InvoiceCompareRow,
} from "@/lib/invoiceCompareCsv";
import { isOrderableCatalogStatus } from "@/lib/orderableCatalog";
import { CompAccountAutocomplete } from "./CompAccountAutocomplete";
import { CompCompareTable } from "./CompCompareTable";
import { useCompAuth } from "./useCompAuth";

function localIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeRows(rows: unknown[]): InvoiceCompareRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((raw) => {
    const row = raw as InvoiceCompareRow;
    const status = String(row.status || "");
    const available =
      typeof row.available === "boolean" ? row.available : isOrderableCatalogStatus(status);
    return { ...row, status, available, cells: Array.isArray(row.cells) ? row.cells : [] };
  });
}

export function InvoiceCompareClient() {
  const { authed, compHeaders } = useCompAuth();
  const [accountNo, setAccountNo] = useState("");
  const [date, setDate] = useState(() => localIsoDate(new Date()));
  const [lookbackDays, setLookbackDays] = useState("90");
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"success" | "error">("success");
  const [report, setReport] = useState<InvoiceCompareReport | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [ran, setRan] = useState(false);

  const notify = (text: string, tone: "success" | "error" = "success") => {
    setMsg(text);
    setMsgTone(tone);
    window.setTimeout(() => setMsg(""), 3500);
  };

  const runReport = useCallback(async () => {
    if (!authed) return;
    const cleanAccount = accountNo.trim();
    if (!cleanAccount) {
      notify("Enter an account number.", "error");
      return;
    }
    if (!date) {
      notify("Choose a date.", "error");
      return;
    }

    setBusy(true);
    setRan(true);
    try {
      const params = new URLSearchParams({
        accountNo: cleanAccount,
        date,
        lookbackDays: lookbackDays.trim() || "90",
      });
      const res = await fetch(`/api/comp/invoice-compare?${params}`, {
        headers: compHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load report.");
      const next: InvoiceCompareReport = {
        accountNo: data.accountNo,
        asOfDate: data.asOfDate,
        lookbackDays: Number(data.lookbackDays) || 90,
        invoiceCount: Number(data.invoiceCount) || 0,
        skuCount: Number(data.skuCount) || 0,
        invoices: Array.isArray(data.invoices) ? data.invoices : [],
        rows: normalizeRows(data.rows),
        accountInvoiceCount: Number(data.accountInvoiceCount) || 0,
        note: typeof data.note === "string" ? data.note : undefined,
      };
      startTransition(() => {
        setReport(next);
        setExcluded(new Set());
      });
    } catch (err: unknown) {
      setReport(null);
      notify(err instanceof Error ? err.message : "Failed to load report.", "error");
    } finally {
      setBusy(false);
    }
  }, [authed, compHeaders, accountNo, date, lookbackDays]);

  const visibleReport = useMemo(() => {
    if (!report) return null;
    const withExcluded = excludeInvoiceCompareColumns(report, excluded);
    if (showUnavailable) {
      return {
        ...withExcluded,
        skuCount: withExcluded.rows.length,
      };
    }
    const rows = withExcluded.rows.filter((row) => row.available !== false);
    return {
      ...withExcluded,
      rows,
      skuCount: rows.length,
    };
  }, [report, excluded, showUnavailable]);

  const hiddenUnavailableCount = useMemo(() => {
    if (!report || showUnavailable) return 0;
    return report.rows.filter((row) => row.available === false).length;
  }, [report, showUnavailable]);

  /** Keys of the still-shown invoices, in the same order as visibleReport.invoices. */
  const includedKeys = useMemo(
    () =>
      (report?.invoices || [])
        .map((inv, index) => invoiceCompareColumnKey(inv, index))
        .filter((key) => !excluded.has(key)),
    [report, excluded]
  );

  const toggleInvoice = (key: string) => {
    startTransition(() => {
      setExcluded((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    });
  };

  const download = () => {
    if (!report || !visibleReport || visibleReport.skuCount === 0) return;
    const csv = invoiceCompareToCsv(visibleReport);
    downloadCsv(
      `invoice-compare-${report.accountNo}-${report.asOfDate}.csv`,
      csv.headerRows,
      csv.rows
    );
  };

  return (
    <>
      {msg ? <Toast message={msg} tone={msgTone} /> : null}

      <Panel title="Filters">
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={labelStyle}>Account</span>
            <CompAccountAutocomplete
              value={accountNo}
              onChange={setAccountNo}
              onPick={(row) => setAccountNo(row.accountNo)}
              placeholder="Account # or store…"
              disabled={busy}
              onEnter={() => void runReport()}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={labelStyle}>As-of date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={busy}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={labelStyle}>Lookback days</span>
            <input
              type="number"
              min={1}
              max={365}
              value={lookbackDays}
              onChange={(e) => setLookbackDays(e.target.value)}
              disabled={busy}
              style={inputStyle}
            />
          </label>
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
            fontSize: 13,
            fontWeight: 700,
            color: "#374151",
            cursor: "pointer",
            width: "fit-content",
          }}
        >
          <input
            type="checkbox"
            checked={showUnavailable}
            onChange={(e) => setShowUnavailable(e.target.checked)}
            disabled={busy}
          />
          Show not available SKUs
          {hiddenUnavailableCount > 0 ? (
            <span style={{ color: "#9ca3af", fontWeight: 600 }}>({hiddenUnavailableCount} hidden)</span>
          ) : null}
        </label>
        <BtnRow>
          <BtnPrimary disabled={busy} onClick={() => void runReport()}>
            {busy ? "Loading…" : "Run report"}
          </BtnPrimary>
          <button
            type="button"
            disabled={!visibleReport || visibleReport.skuCount === 0 || busy}
            onClick={download}
            style={{
              ...inputStyle,
              width: "auto",
              cursor: !visibleReport || visibleReport.skuCount === 0 || busy ? "not-allowed" : "pointer",
              fontWeight: 800,
              background: "#111827",
              color: "#fff",
              border: "none",
              opacity: !visibleReport || visibleReport.skuCount === 0 || busy ? 0.5 : 1,
            }}
          >
            Download CSV
          </button>
        </BtnRow>
        <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
          Uses uploaded invoices on or before the as-of date (within lookback). Columns are oldest → newest.
          Price up = red, price down = green. SKUs with any price change are highlighted in amber.
        </p>
      </Panel>

      {report && visibleReport ? (
        <>
          <StatGrid
            items={[
              { label: "Account", value: report.accountNo },
              {
                label: "Invoices",
                value: excluded.size
                  ? `${visibleReport.invoiceCount} / ${report.invoiceCount}`
                  : report.invoiceCount,
              },
              { label: "SKUs", value: visibleReport.skuCount },
              { label: "As of", value: report.asOfDate },
            ]}
          />

          {report.note ? (
            <p
              style={{
                margin: 0,
                padding: "10px 12px",
                borderRadius: 10,
                background: "#fffbeb",
                border: "1px solid #fcd34d",
                color: "#92400e",
                fontSize: 13,
                fontWeight: 600,
                lineHeight: 1.45,
              }}
            >
              {report.note}
            </p>
          ) : null}

          <Panel title="Compare">
            {report.invoiceCount === 0 ? (
              <EmptyState
                title="No invoices found"
                detail={
                  (report.accountInvoiceCount || 0) > 0
                    ? `This account has ${report.accountInvoiceCount} invoice(s) outside the selected window. Try a later as-of date or longer lookback.`
                    : "No uploaded invoices with prices for this account. Check the account number, or upload invoices in Admin → Invoices."
                }
              />
            ) : (
              <>
                {excluded.size > 0 ? (
                  <div className="comp-excluded-bar">
                    <span className="comp-excluded-label">Excluded:</span>
                    {report.invoices.map((inv, index) => {
                      const key = invoiceCompareColumnKey(inv, index);
                      if (!excluded.has(key)) return null;
                      return (
                        <button
                          key={key}
                          type="button"
                          className="comp-excluded-chip"
                          onClick={() => toggleInvoice(key)}
                          title="Add this invoice back"
                        >
                          {inv.invoiceNo || inv.date} <span aria-hidden>+</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className="comp-excluded-reset"
                      onClick={() => startTransition(() => setExcluded(new Set()))}
                    >
                      Reset all
                    </button>
                  </div>
                ) : null}

                <CompCompareTable
                  invoices={visibleReport.invoices}
                  rows={visibleReport.rows}
                  includedKeys={includedKeys}
                  onExclude={toggleInvoice}
                />
              </>
            )}
          </Panel>
        </>
      ) : ran && !busy ? (
        <EmptyState title="No report loaded" detail="Adjust filters and run again." />
      ) : (
        <EmptyState
          title="Run a report"
          detail="Pick an account and as-of date, then click Run report. Download CSV when ready."
        />
      )}
    </>
  );
}
