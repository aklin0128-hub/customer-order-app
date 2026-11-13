"use client";

import { useEffect, useMemo, useState } from "react";

import {
  emptySalesCreditLines,
  formatSalesCreditDate,
  formatSalesCreditMoney,
  salesCreditTotal,
  type SalesCreditLine,
  type SalesCreditRequestForm,
} from "@/lib/credit/salesCreditRequest";
import { buildSalesCreditRequestPdf } from "@/lib/credit/salesCreditRequestPdf";

const DRAFT_KEY = "sales_credit_request_v1";

type PhotoItem = { id: string; file: File; url: string };

function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadDraft(): Partial<SalesCreditRequestForm> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<SalesCreditRequestForm>;
  } catch {
    return null;
  }
}

export function CreditRequestClient() {
  const [salesId, setSalesId] = useState("S32");
  const [customerNo, setCustomerNo] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [dateOfRequest, setDateOfRequest] = useState(todayIso());
  const [customerEmail, setCustomerEmail] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [lines, setLines] = useState<SalesCreditLine[]>(emptySalesCreditLines);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setSalesId(String(draft.salesId || "S32"));
      setCustomerNo(String(draft.customerNo || ""));
      setCustomerName(String(draft.customerName || ""));
      setDateOfRequest(String(draft.dateOfRequest || todayIso()));
      setCustomerEmail(String(draft.customerEmail || ""));
      setInvoiceNo(String(draft.invoiceNo || ""));
      setInvoiceDate(String(draft.invoiceDate || ""));
      if (Array.isArray(draft.lines) && draft.lines.length) {
        const byReason = new Map(draft.lines.map((l) => [l.reason, l]));
        setLines(
          emptySalesCreditLines().map((row) => {
            const saved = byReason.get(row.reason);
            return saved
              ? {
                  reason: row.reason,
                  amount:
                    saved.amount == null || Number.isNaN(Number(saved.amount)) ? null : Number(saved.amount),
                  itemDetail: String(saved.itemDetail || ""),
                }
              : row;
          })
        );
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: SalesCreditRequestForm = {
      salesId,
      customerNo,
      customerName,
      dateOfRequest,
      customerEmail,
      invoiceNo,
      invoiceDate,
      lines,
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {
      /* ignore quota */
    }
  }, [hydrated, salesId, customerNo, customerName, dateOfRequest, customerEmail, invoiceNo, invoiceDate, lines]);

  useEffect(() => {
    return () => {
      for (const p of photos) URL.revokeObjectURL(p.url);
    };
  }, [photos]);

  const total = useMemo(() => salesCreditTotal(lines), [lines]);

  const updateLine = (reason: SalesCreditLine["reason"], patch: Partial<SalesCreditLine>) => {
    setLines((prev) => prev.map((row) => (row.reason === reason ? { ...row, ...patch } : row)));
  };

  const onPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const next: PhotoItem[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      next.push({ id: uid(), file, url: URL.createObjectURL(file) });
    }
    setPhotos((prev) => [...prev, ...next].slice(0, 6));
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  const formForPdf = (): SalesCreditRequestForm => ({
    salesId: salesId.trim().toUpperCase(),
    customerNo: customerNo.trim(),
    customerName: customerName.trim(),
    dateOfRequest: formatSalesCreditDate(dateOfRequest),
    customerEmail: customerEmail.trim(),
    invoiceNo: invoiceNo.trim(),
    invoiceDate: formatSalesCreditDate(invoiceDate),
    lines,
  });

  const savePdf = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const photoBytes = await Promise.all(
        photos.map(async (p) => ({
          bytes: new Uint8Array(await p.file.arrayBuffer()),
          name: p.file.name,
        }))
      );
      const bytes = await buildSalesCreditRequestPdf({
        form: formForPdf(),
        photos: photoBytes,
      });
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const blob = new Blob([copy], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = dateOfRequest || todayIso();
      a.href = url;
      a.download = `sales-credit-request-${salesId || "S32"}-${stamp}.pdf`.replace(/[^a-zA-Z0-9._-]+/g, "-");
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Saved PDF.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save PDF.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="scr-toolbar">
        <div className="scr-actions">
          <button type="button" className="scr-btn primary" onClick={() => void savePdf()} disabled={saving}>
            {saving ? "Saving…" : "Save PDF"}
          </button>
          <button
            type="button"
            className="scr-btn"
            onClick={() => {
              setLines(emptySalesCreditLines());
              setCustomerNo("");
              setCustomerName("");
              setCustomerEmail("");
              setInvoiceNo("");
              setInvoiceDate("");
              setPhotos((prev) => {
                for (const p of prev) URL.revokeObjectURL(p.url);
                return [];
              });
              setMessage("Cleared form.");
            }}
          >
            Clear
          </button>
        </div>
        {error ? <p className="scr-status error">{error}</p> : message ? <p className="scr-status">{message}</p> : null}
      </div>

      <div className="scr-sheet">
        <div className="scr-banner">Sales Credit Request</div>

        <label className="scr-row">
          <span className="scr-label">Sales ID #</span>
          <span className="scr-value">
            <input value={salesId} onChange={(e) => setSalesId(e.target.value)} />
          </span>
        </label>
        <label className="scr-row">
          <span className="scr-label">Customer #</span>
          <span className="scr-value">
            <input value={customerNo} onChange={(e) => setCustomerNo(e.target.value)} />
          </span>
        </label>
        <label className="scr-row">
          <span className="scr-label">Customer Name</span>
          <span className="scr-value">
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </span>
        </label>
        <label className="scr-row">
          <span className="scr-label">Date of Request</span>
          <span className="scr-value">
            <input type="date" value={dateOfRequest} onChange={(e) => setDateOfRequest(e.target.value)} />
          </span>
        </label>
        <label className="scr-row">
          <span className="scr-label">Customer email address</span>
          <span className="scr-value">
            <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
          </span>
        </label>
        <label className="scr-row">
          <span className="scr-label">Invoice #</span>
          <span className="scr-value">
            <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
          </span>
        </label>
        <label className="scr-row">
          <span className="scr-label">Invoice Date:</span>
          <span className="scr-value">
            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </span>
        </label>

        <div className="scr-cols">
          <div className="scr-head">Reason for Credit</div>
          <div className="scr-head">Amount</div>
          <div className="scr-head">Item Detail (Qty) - Per Item Credit</div>
        </div>

        {lines.map((line) => (
          <div className="scr-cols" key={line.reason}>
            <div className="scr-reason">{line.reason}</div>
            <div className="scr-amount">
              <input
                inputMode="decimal"
                value={line.amount == null || Number.isNaN(line.amount) ? "" : String(line.amount)}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  updateLine(line.reason, { amount: raw === "" ? null : Number(raw) });
                }}
              />
            </div>
            <div className="scr-detail">
              <textarea
                rows={2}
                value={line.itemDetail}
                onChange={(e) => updateLine(line.reason, { itemDetail: e.target.value })}
              />
            </div>
          </div>
        ))}

        <div className="scr-cols scr-total">
          <div className="scr-reason">Total</div>
          <div className="scr-amount">{formatSalesCreditMoney(total)}</div>
          <div className="scr-detail" />
        </div>

        <div className="scr-photo-head">Photo</div>
        <div className="scr-photo-box">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              onPhotos(e.target.files);
              e.target.value = "";
            }}
          />
          {photos.length ? (
            <div className="scr-thumbs">
              {photos.map((p) => (
                <div className="scr-thumb" key={p.id}>
                  <img src={p.url} alt="" />
                  <button type="button" onClick={() => removePhoto(p.id)} aria-label="Remove photo">
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="scr-photo-hint">attach here</p>
          )}
        </div>
      </div>
    </div>
  );
}
