"use client";

import { useMemo, useState } from "react";

import { defaultSlipAmount, type StatementLineKind } from "@/lib/credit/parseStatement";
import { useCreditAuth } from "./useCreditAuth";

type CreditRow = {
  id: string;
  document: string;
  code: StatementLineKind;
  date?: string;
  remainingDebit: number;
  remainingCredit: number;
  amount: number;
  selected: boolean;
};

function money(n: number) {
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `($${abs})` : `$${abs}`;
}

function todayInput() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function toDisplayDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${Number(m)}/${Number(d)}/${y.slice(-2)}`;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function downloadBlob(res: Response, fallbackName: string) {
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const match = cd.match(/filename="([^"]+)"/);
  const name = match?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function CreditClient() {
  const { creditHeaders } = useCreditAuth();
  const [rows, setRows] = useState<CreditRow[]>([]);
  const [storeId, setStoreId] = useState("");
  const [name, setName] = useState("ELLISON LIN");
  const [code, setCode] = useState("S32");
  const [slipDate, setSlipDate] = useState(todayInput());
  const [checkNo, setCheckNo] = useState("");
  const [checkAmount, setCheckAmount] = useState("");
  const [checkDate, setCheckDate] = useState(todayInput());
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "debit" | "credit">("all");

  const visibleRows = useMemo(() => {
    if (filter === "debit") return rows.filter((r) => r.remainingDebit > 0);
    if (filter === "credit") return rows.filter((r) => r.remainingCredit > 0);
    return rows;
  }, [rows, filter]);

  const selectedRows = useMemo(() => rows.filter((r) => r.selected), [rows]);
  const selectedInvoiceTotal = useMemo(
    () => selectedRows.reduce((sum, r) => sum + r.amount, 0),
    [selectedRows]
  );

  const onUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/credit/parse", {
        method: "POST",
        headers: creditHeaders(),
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Parse failed.");

      const next: CreditRow[] = (data.lines || []).map(
        (line: {
          document: string;
          code?: StatementLineKind;
          date?: string;
          remainingDebit?: number;
          remainingCredit?: number;
        }) => {
          const remainingDebit = Number(line.remainingDebit) || 0;
          const remainingCredit = Number(line.remainingCredit) || 0;
          return {
            id: uid(),
            document: String(line.document || "").toUpperCase(),
            code: (line.code || "Other") as StatementLineKind,
            date: line.date,
            remainingDebit,
            remainingCredit,
            amount: defaultSlipAmount({ remainingDebit, remainingCredit }),
            selected: false,
          };
        }
      );

      if (!next.length) {
        throw new Error("No document / remaining debit / credit rows found. Try Excel or a clearer PDF.");
      }

      setRows(next);
      if (data.accountNo) setStoreId(String(data.accountNo).toUpperCase());
      if (data.salesName) setName(String(data.salesName));
      if (data.salesCode) setCode(String(data.salesCode));
      setMessage(`Loaded ${next.length} documents (${data.method || "parse"}).`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const toggleAllVisible = (checked: boolean) => {
    const ids = new Set(visibleRows.map((r) => r.id));
    setRows((prev) => prev.map((r) => (ids.has(r.id) ? { ...r, selected: checked } : r)));
  };

  const autoFillCheckAmount = () => {
    setCheckAmount(String(Math.round(selectedInvoiceTotal * 100) / 100));
  };

  const addManualRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: uid(),
        document: "",
        code: "Invoice",
        remainingDebit: 0,
        remainingCredit: 0,
        amount: 0,
        selected: true,
      },
    ]);
  };

  const deleteRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const moveRow = (id: string, direction: -1 | 1) => {
    setRows((prev) => {
      const visibleIds = prev
        .filter((r) => {
          if (filter === "debit") return r.remainingDebit > 0;
          if (filter === "credit") return r.remainingCredit > 0;
          return true;
        })
        .map((r) => r.id);
      const visIdx = visibleIds.indexOf(id);
      if (visIdx < 0) return prev;
      const swapVisIdx = visIdx + direction;
      if (swapVisIdx < 0 || swapVisIdx >= visibleIds.length) return prev;

      const aId = visibleIds[visIdx]!;
      const bId = visibleIds[swapVisIdx]!;
      const aIdx = prev.findIndex((r) => r.id === aId);
      const bIdx = prev.findIndex((r) => r.id === bId);
      if (aIdx < 0 || bIdx < 0) return prev;

      const next = prev.slice();
      const tmp = next[aIdx]!;
      next[aIdx] = next[bIdx]!;
      next[bIdx] = tmp;
      return next;
    });
  };

  const exportPayload = () => {
    const exportRows = rows.filter((r) => r.selected && r.document.trim());
    const sharedCheckNo = checkNo.trim();
    const deposit =
      checkAmount.trim() !== ""
        ? Number(checkAmount)
        : Math.round(selectedInvoiceTotal * 100) / 100;
    const sharedCheckDate = toDisplayDate(checkDate || todayInput());

    return {
      meta: {
        title: "PNC BANK CHECK DEPOSIT (SE)",
        name,
        code,
        date: toDisplayDate(slipDate),
        storeId,
      },
      lines: exportRows.map((r, index) => ({
        storeId,
        document: r.document.trim().toUpperCase(),
        amount: r.amount,
        // One check for the whole slip — put it on the first line; PDF/XLSX dedupe identical checks.
        checkNo: index === 0 ? sharedCheckNo : "",
        depositAmount: index === 0 && sharedCheckNo ? deposit : null,
        checkDate: index === 0 && sharedCheckNo ? sharedCheckDate : "",
      })),
    };
  };

  const exportFile = async (kind: "pdf" | "xlsx") => {
    const payload = exportPayload();
    if (!payload.lines.length) {
      setError("Select documents to export.");
      return;
    }
    setExporting(kind);
    setError("");
    try {
      const res = await fetch(kind === "pdf" ? "/api/credit/pdf" : "/api/credit/xlsx", {
        method: "POST",
        headers: creditHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Export ${kind} failed.`);
      }
      await downloadBlob(res, `deposit-slip.${kind === "pdf" ? "pdf" : "xlsx"}`);
      setMessage(`Downloaded ${kind.toUpperCase()}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="credit-client">
      <section className="credit-card">
        <h2>1. Upload statement</h2>
        <p className="credit-hint">
          PDF / image / Excel. Extracts <strong>Document</strong>, <strong>Remaining Debits</strong>,{" "}
          <strong>Remaining Credits</strong>.
        </p>
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,application/pdf,image/*,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={uploading}
          onChange={(e) => void onUpload(e.target.files?.[0] || null)}
        />
        {uploading ? <p className="credit-status">Parsing…</p> : null}
      </section>

      <section className="credit-card">
        <h2>2. Deposit slip header</h2>
        <div className="credit-grid">
          <label>
            Store ID
            <input value={storeId} onChange={(e) => setStoreId(e.target.value.toUpperCase())} placeholder="FL287" />
          </label>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Code
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </label>
          <label>
            Slip date
            <input type="date" value={slipDate} onChange={(e) => setSlipDate(e.target.value)} />
          </label>
        </div>
      </section>

      <section className="credit-card">
        <h2>3. Check (one for this deposit)</h2>
        <p className="credit-hint">
          Usually one check covers all selected documents. Enter it once here — it is applied on download.
        </p>
        <div className="credit-grid">
          <label>
            Check NO
            <input value={checkNo} onChange={(e) => setCheckNo(e.target.value)} placeholder="24184" />
          </label>
          <label>
            Check / Deposit amount
            <div className="credit-inline">
              <input
                value={checkAmount}
                onChange={(e) => setCheckAmount(e.target.value.replace(/[^0-9.-]/g, ""))}
                placeholder="auto from selected"
              />
              <button type="button" className="credit-btn ghost" onClick={autoFillCheckAmount}>
                Auto
              </button>
            </div>
          </label>
          <label>
            Check date
            <input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} />
          </label>
        </div>
        <div className="credit-actions">
          <span className="credit-meta">Selected total: {money(selectedInvoiceTotal)}</span>
        </div>
      </section>

      <section className="credit-card">
        <div className="credit-table-head">
          <h2>4. Documents</h2>
          <div className="credit-actions">
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">All</option>
              <option value="debit">Remaining debits</option>
              <option value="credit">Remaining credits</option>
            </select>
            <button type="button" className="credit-btn ghost" onClick={addManualRow}>
              + Add row
            </button>
            <button type="button" className="credit-btn ghost" onClick={() => toggleAllVisible(true)}>
              Select visible
            </button>
            <button type="button" className="credit-btn ghost" onClick={() => toggleAllVisible(false)}>
              Clear
            </button>
          </div>
        </div>

        <div className="credit-table-wrap">
          <table className="credit-table">
            <thead>
              <tr>
                <th />
                <th>Move</th>
                <th>Document</th>
                <th>Code</th>
                <th>Remaining Debits</th>
                <th>Remaining Credits</th>
                <th>Slip Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="credit-empty">
                    Upload a statement to begin.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row, index) => (
                  <tr key={row.id} className={row.selected ? "is-selected" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, selected: e.target.checked } : r))
                          )
                        }
                      />
                    </td>
                    <td>
                      <div className="credit-move">
                        <button
                          type="button"
                          className="credit-move-btn"
                          aria-label="Move up"
                          disabled={index === 0}
                          onClick={() => moveRow(row.id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="credit-move-btn"
                          aria-label="Move down"
                          disabled={index === visibleRows.length - 1}
                          onClick={() => moveRow(row.id, 1)}
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td>
                      <input
                        className="credit-cell"
                        value={row.document}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id ? { ...r, document: e.target.value.toUpperCase() } : r
                            )
                          )
                        }
                      />
                    </td>
                    <td>{row.code}</td>
                    <td>{row.remainingDebit ? money(row.remainingDebit) : ""}</td>
                    <td>{row.remainingCredit ? money(row.remainingCredit) : ""}</td>
                    <td>
                      <input
                        className="credit-cell amount"
                        value={String(row.amount)}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id
                                ? { ...r, amount: Number(e.target.value.replace(/[^0-9.-]/g, "")) || 0 }
                                : r
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="credit-btn danger"
                        aria-label="Delete row"
                        onClick={() => deleteRow(row.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="credit-card credit-export">
        <h2>5. Download</h2>
        <div className="credit-actions">
          <button
            type="button"
            className="credit-btn primary"
            disabled={exporting !== null}
            onClick={() => void exportFile("pdf")}
          >
            {exporting === "pdf" ? "Building PDF…" : "Download PDF"}
          </button>
          <button
            type="button"
            className="credit-btn primary"
            disabled={exporting !== null}
            onClick={() => void exportFile("xlsx")}
          >
            {exporting === "xlsx" ? "Building Excel…" : "Download Excel"}
          </button>
        </div>
      </section>

      {message ? <p className="credit-ok">{message}</p> : null}
      {error ? <p className="credit-error">{error}</p> : null}
    </div>
  );
}
