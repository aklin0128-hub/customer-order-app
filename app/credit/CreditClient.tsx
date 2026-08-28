"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";

import { defaultSlipAmount, type StatementLineKind } from "@/lib/credit/parseStatement";
import { MAX_DEPOSIT_SLIP_LINES } from "@/lib/credit/limits";
import { useCreditAuth } from "./useCreditAuth";

type CreditRow = {
  id: string;
  document: string;
  code: StatementLineKind;
  date?: string;
  remainingDebit: number;
  remainingCredit: number;
  selected: boolean;
};

type RowFilter = "all" | "debit" | "credit";

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

function rowMatchesFilter(r: CreditRow, filter: RowFilter) {
  if (filter === "debit") return r.remainingDebit > 0;
  if (filter === "credit") return r.remainingCredit > 0;
  return true;
}

/** Reorder among currently visible rows; keep filtered-out rows in place. */
function reorderVisibleRows(prev: CreditRow[], filter: RowFilter, fromId: string, toId: string) {
  if (fromId === toId) return prev;
  const visible = prev.filter((r) => rowMatchesFilter(r, filter));
  const from = visible.findIndex((r) => r.id === fromId);
  const to = visible.findIndex((r) => r.id === toId);
  if (from < 0 || to < 0) return prev;

  const nextVisible = visible.slice();
  const [item] = nextVisible.splice(from, 1);
  if (!item) return prev;
  nextVisible.splice(to, 0, item);

  let i = 0;
  return prev.map((r) => (rowMatchesFilter(r, filter) ? nextVisible[i++]! : r));
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
  const [filter, setFilter] = useState<RowFilter>("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);

  const visibleRows = useMemo(() => rows.filter((r) => rowMatchesFilter(r, filter)), [rows, filter]);
  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((r) => r.selected);
  const someVisibleSelected = visibleRows.some((r) => r.selected);
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  const selectedRows = useMemo(() => rows.filter((r) => r.selected), [rows]);
  const selectedInvoiceTotal = useMemo(
    () =>
      selectedRows.reduce(
        (sum, r) => sum + defaultSlipAmount({ remainingDebit: r.remainingDebit, remainingCredit: r.remainingCredit }),
        0
      ),
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
        selected: true,
      },
    ]);
  };

  const deleteRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const moveRow = (id: string, direction: -1 | 1) => {
    const idx = visibleRows.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const target = visibleRows[idx + direction];
    if (!target) return;
    setRows((prev) => reorderVisibleRows(prev, filter, id, target.id));
  };

  const clearDrag = () => {
    dragIdRef.current = null;
    setDragId(null);
    setDropId(null);
  };

  const onDragStart = (id: string, e: DragEvent) => {
    dragIdRef.current = id;
    setDragId(id);
    setDropId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const onDragOverRow = (id: string, e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropId !== id) setDropId(id);
  };

  const onDropRow = (id: string, e: DragEvent) => {
    e.preventDefault();
    const fromId = dragIdRef.current || e.dataTransfer.getData("text/plain");
    clearDrag();
    if (!fromId || fromId === id) return;
    setRows((prev) => reorderVisibleRows(prev, filter, fromId, id));
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
        document: r.document.trim().toUpperCase(),
        amount: defaultSlipAmount({
          remainingDebit: r.remainingDebit,
          remainingCredit: r.remainingCredit,
        }),
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
    if (payload.lines.length > MAX_DEPOSIT_SLIP_LINES) {
      setError(`Too many documents selected. Max ${MAX_DEPOSIT_SLIP_LINES} rows.`);
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
        <div className="credit-grid credit-grid-header">
          <label className="credit-store-id">
            Store ID
            <input
              value={storeId}
              onChange={(e) => setStoreId(e.target.value.toUpperCase())}
              placeholder="FL287"
            />
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
          <span className="credit-meta">
            Selected total: {money(selectedInvoiceTotal)} · {selectedRows.length}/{MAX_DEPOSIT_SLIP_LINES} docs
          </span>
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
              Select all
            </button>
            <button type="button" className="credit-btn ghost" onClick={() => toggleAllVisible(false)}>
              Clear
            </button>
          </div>
        </div>

        <div className="credit-table-wrap">
          <table className="credit-table">
            <colgroup>
              <col className="credit-col-check" />
              <col className="credit-col-actions" />
              <col className="credit-col-document" />
              <col className="credit-col-code" />
              <col className="credit-col-money" />
              <col className="credit-col-money" />
            </colgroup>
            <thead>
              <tr>
                <th className="credit-th-check">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    disabled={visibleRows.length === 0}
                    aria-label="Select all"
                    title="Select all"
                    onChange={(e) => toggleAllVisible(e.target.checked)}
                  />
                </th>
                <th className="credit-th-actions">Actions</th>
                <th className="credit-th-document">Document</th>
                <th className="credit-th-code">Code</th>
                <th className="credit-th-money">
                  <span className="credit-money-head">Remaining Debits</span>
                </th>
                <th className="credit-th-money">
                  <span className="credit-money-head">Remaining Credits</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="credit-empty">
                    Upload a statement to begin.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={[
                      row.selected ? "is-selected" : "",
                      dragId === row.id ? "is-dragging" : "",
                      dropId === row.id && dragId && dragId !== row.id ? "is-drop-target" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onDragOver={(e) => onDragOverRow(row.id, e)}
                    onDrop={(e) => onDropRow(row.id, e)}
                    onDragEnd={clearDrag}
                  >
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
                      <div className="credit-row-actions">
                        <button
                          type="button"
                          className="credit-drag-handle"
                          aria-label="Drag to reorder"
                          title="Drag to reorder"
                          draggable
                          onDragStart={(e) => onDragStart(row.id, e)}
                          onClick={(e) => e.preventDefault()}
                        >
                          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                            <path
                              fill="currentColor"
                              d="M5 3.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zm6 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM5 6.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zm6 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM5 10a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zm6 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="credit-icon-btn danger"
                          aria-label="Delete row"
                          title="Delete"
                          onClick={() => deleteRow(row.id)}
                        >
                          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                            <path
                              fill="currentColor"
                              d="M6 2h4l.5 1H13v1.5H3V3h2.5L6 2zm1 4v5H6V6h1zm3 0v5H9V6h1zM4.5 4.5h7l-.6 8.2a1 1 0 0 1-1 .8H6.1a1 1 0 0 1-1-.8L4.5 4.5z"
                            />
                          </svg>
                        </button>
                        <div className="credit-move" role="group" aria-label="Reorder">
                          <button
                            type="button"
                            className="credit-move-btn"
                            aria-label="Move up"
                            disabled={index === 0}
                            onClick={() => moveRow(row.id, -1)}
                          >
                            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                              <path
                                fill="currentColor"
                                d="M8 4.2 3.6 8.6l1.1 1.1L8 6.4l3.3 3.3 1.1-1.1L8 4.2z"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="credit-move-btn"
                            aria-label="Move down"
                            disabled={index === visibleRows.length - 1}
                            onClick={() => moveRow(row.id, 1)}
                          >
                            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                              <path
                                fill="currentColor"
                                d="M8 11.8l4.4-4.4-1.1-1.1L8 9.6 4.7 6.3 3.6 7.4 8 11.8z"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="credit-td-document">
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
                    <td className="credit-td-code">
                      <span className={`credit-code credit-code-${row.code.toLowerCase()}`}>{row.code}</span>
                    </td>
                    <td className="credit-money">
                      {row.remainingDebit ? money(row.remainingDebit) : ""}
                    </td>
                    <td className="credit-money credit-money-credit">
                      {row.remainingCredit ? money(row.remainingCredit) : ""}
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
