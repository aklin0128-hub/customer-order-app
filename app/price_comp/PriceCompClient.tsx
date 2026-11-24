"use client";

import { useCallback, useMemo, useState } from "react";
import { downloadCsv } from "@/app/admin/_components/admin-analytics-ui";
import { inputStyle, labelStyle } from "@/app/admin/_components/admin-styles";
import { BtnPrimary, BtnRow, EmptyState, Panel, StatGrid, Toast } from "@/app/admin/_components/admin-utils";
import { CompAccountAutocomplete } from "@/app/comp/CompAccountAutocomplete";
import { useCompAuth } from "@/app/comp/useCompAuth";
import {
  ACCOUNT_PRICE_COMPARE_MAX,
  accountPriceCompareCsvFileName,
  accountPriceCompareToCsv,
  accountPriceRowDiffers,
  formatAccountPriceCell,
  parseAccountPriceCompareList,
  type AccountPriceCompareReport,
} from "@/lib/accountPriceCompare";

export function PriceCompClient() {
  const { authed, compHeaders } = useCompAuth();
  const [draftAccount, setDraftAccount] = useState("");
  const [accounts, setAccounts] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"success" | "error">("success");
  const [report, setReport] = useState<AccountPriceCompareReport | null>(null);
  const [ran, setRan] = useState(false);

  const notify = (text: string, tone: "success" | "error" = "success") => {
    setMsg(text);
    setMsgTone(tone);
    window.setTimeout(() => setMsg(""), 3500);
  };

  const addAccount = (value: string) => {
    const next = parseAccountPriceCompareList([...accounts, value]);
    if (next.length === accounts.length) {
      if (accounts.length >= ACCOUNT_PRICE_COMPARE_MAX) {
        notify(`You can compare up to ${ACCOUNT_PRICE_COMPARE_MAX} customers.`, "error");
      }
      return;
    }
    setAccounts(next);
    setDraftAccount("");
    setReport(null);
  };

  const removeAccount = (account: string) => {
    setAccounts((prev) => prev.filter((row) => row !== account));
    setReport(null);
  };

  const runReport = useCallback(async () => {
    if (!authed) return;
    const selected = parseAccountPriceCompareList(accounts);
    if (selected.length === 0) {
      notify("Add at least one customer account.", "error");
      return;
    }
    setBusy(true);
    setRan(true);
    try {
      const params = new URLSearchParams({ accounts: selected.join(",") });
      const res = await fetch(`/api/comp/price-compare?${params}`, {
        headers: compHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load prices.");
      setReport({
        accounts: Array.isArray(data.accounts) ? data.accounts : selected,
        skuCount: Number(data.skuCount) || 0,
        rows: Array.isArray(data.rows) ? data.rows : [],
      });
    } catch (err: unknown) {
      setReport(null);
      notify(err instanceof Error ? err.message : "Failed to load prices.", "error");
    } finally {
      setBusy(false);
    }
  }, [accounts, authed, compHeaders]);

  const csv = useMemo(() => (report ? accountPriceCompareToCsv(report) : null), [report]);

  const download = () => {
    if (!report || !csv || report.skuCount === 0) return;
    downloadCsv(accountPriceCompareCsvFileName(report.accounts), csv.headerRows, csv.rows);
  };

  return (
    <>
      {msg ? <Toast message={msg} tone={msgTone} /> : null}

      <Panel title="Customers">
        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={labelStyle}>
              Add account ({accounts.length}/{ACCOUNT_PRICE_COMPARE_MAX})
            </span>
            <CompAccountAutocomplete
              value={draftAccount}
              onChange={setDraftAccount}
              onPick={(row) => addAccount(row.accountNo)}
              placeholder="Account # or store…"
              disabled={busy || accounts.length >= ACCOUNT_PRICE_COMPARE_MAX}
              onEnter={() => addAccount(draftAccount)}
            />
          </label>
          {accounts.length ? (
            <div className="pc-chips">
              {accounts.map((account) => (
                <span className="pc-chip" key={account}>
                  {account}
                  <button type="button" aria-label={`Remove ${account}`} onClick={() => removeAccount(account)}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <p className="pc-hint">
            Last invoice case price per SKU, side by side. Missing prices show as -. Export matches the table.
          </p>
          <BtnRow>
            <BtnPrimary disabled={busy} onClick={() => void runReport()}>
              {busy ? "Loading…" : "Compare prices"}
            </BtnPrimary>
            <button
              type="button"
              disabled={!report || report.skuCount === 0 || busy}
              onClick={download}
              style={{
                ...inputStyle,
                width: "auto",
                cursor: !report || report.skuCount === 0 || busy ? "not-allowed" : "pointer",
                fontWeight: 800,
                background: "#111827",
                color: "#fff",
                border: "none",
                opacity: !report || report.skuCount === 0 || busy ? 0.5 : 1,
              }}
            >
              Export CSV
            </button>
          </BtnRow>
        </div>
      </Panel>

      {report ? (
        <>
          <StatGrid
            items={[
              { label: "Customers", value: report.accounts.length },
              { label: "SKUs", value: report.skuCount },
            ]}
          />
          {report.skuCount === 0 ? (
            <EmptyState title="No invoice prices found for these accounts." />
          ) : (
            <div className="pc-table-scroll">
              <table className="pc-table">
                <thead>
                  <tr>
                    <th className="pc-sku">SKU</th>
                    <th className="pc-desc">item DESC</th>
                    {report.accounts.map((account) => (
                      <th key={account}>{account}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.sku} className={accountPriceRowDiffers(row) ? "pc-diff" : undefined}>
                      <td className="pc-sku">{row.sku}</td>
                      <td className="pc-desc">{row.itemDesc || "—"}</td>
                      {row.cells.map((cell, index) => (
                        <td className="pc-price" key={`${row.sku}-${report.accounts[index]}`}>
                          {formatAccountPriceCell(cell.price)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : ran ? null : (
        <EmptyState
          title="Add customers to compare"
          detail="Add up to 7 customer accounts, then compare last invoice prices."
        />
      )}
    </>
  );
}
