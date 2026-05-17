"use client";

import { useEffect, useState } from "react";

import { AdminLogin } from "../_components/AdminLogin";
import { AdminShell } from "../_components/AdminShell";
import { inputStyle, panel, panelTitle } from "../_components/admin-styles";
import { Toast } from "../_components/admin-utils";
import { useAdminAuth } from "../_components/useAdminAuth";

type ImportLine = {
  sku: string;
  qty: number;
  unitPrice?: number;
  lineTotal?: number;
  inCatalog: boolean;
};

type ImportRecord = {
  id: string;
  uploadedAt: string;
  accountNo: string;
  invoiceNo: string | null;
  supplierOrderNo: string | null;
  invoiceDate: string | null;
  blobUrl: string;
  blobPathname?: string;
  extractMethod: "pdf" | "ocr";
  lineCount: number;
  lines: ImportLine[];
  warnings: string[];
  appliedToHistory: boolean;
};

type BatchUploadResult = {
  fileName: string;
  record?: ImportRecord;
  unknownSkus: string[];
  parsedChars: number;
  error?: string;
};

const labelStyle = { display: "block" as const, fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#374151" };

function invoiceFileHref(row: Pick<ImportRecord, "id" | "blobUrl" | "blobPathname">) {
  return row.blobPathname ? `/api/admin/invoice-file?id=${encodeURIComponent(row.id)}` : row.blobUrl;
}

export default function AdminInvoicesPage() {
  const { ready, authed, error, loading, login, logout, adminHeaders } = useAdminAuth();
  const [passwordInput, setPasswordInput] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"success" | "error">("success");
  const [imports, setImports] = useState<ImportRecord[]>([]);

  const [files, setFiles] = useState<File[]>([]);
  const [accountNo, setAccountNo] = useState("");
  const [storeName, setStoreName] = useState("");
  const [applyHistory, setApplyHistory] = useState(true);
  const [lastRecord, setLastRecord] = useState<ImportRecord | null>(null);
  const [unknownSkus, setUnknownSkus] = useState<string[]>([]);
  const [parsedChars, setParsedChars] = useState(0);
  const [batchResults, setBatchResults] = useState<BatchUploadResult[]>([]);

  const loadImports = async () => {
    try {
      const res = await fetch("/api/admin/invoice-imports", {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load imports.");
      setImports(Array.isArray(data.imports) ? data.imports : []);
    } catch (err: any) {
      setMsg(err?.message || "Failed to load invoice history.");
      setMsgTone("error");
    }
  };

  useEffect(() => {
    if (authed) loadImports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const upload = async () => {
    if (files.length === 0) {
      setMsg("Choose one or more PDF/image invoice files.");
      setMsgTone("error");
      return;
    }

    setBusy(true);
    setMsg("");
    setLastRecord(null);
    setUnknownSkus([]);
    setParsedChars(0);
    setBatchResults([]);

    try {
      const results: BatchUploadResult[] = [];

      for (const selectedFile of files) {
        setMsg(`Processing ${results.length + 1}/${files.length}: ${selectedFile.name}`);
        setMsgTone("success");

        try {
          const fd = new FormData();
          fd.set("file", selectedFile);
          if (accountNo.trim()) fd.set("accountNo", accountNo.trim());
          if (storeName.trim()) fd.set("storeName", storeName.trim());
          fd.set("applyHistory", applyHistory ? "true" : "false");

          const res = await fetch("/api/admin/upload-invoice", {
            method: "POST",
            headers: adminHeaders(),
            body: fd,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "Upload failed.");

          const rec = data.record as ImportRecord;
          const result: BatchUploadResult = {
            fileName: selectedFile.name,
            record: rec,
            unknownSkus: Array.isArray(data.unknownSkus) ? data.unknownSkus : [],
            parsedChars: Number(data.parsedTextChars || 0),
          };
          results.push(result);
          setBatchResults([...results]);
          setLastRecord(rec);
          setUnknownSkus(result.unknownSkus);
          setParsedChars(result.parsedChars);
        } catch (err: any) {
          results.push({
            fileName: selectedFile.name,
            unknownSkus: [],
            parsedChars: 0,
            error: err?.message || "Upload failed.",
          });
          setBatchResults([...results]);
        }
      }

      const successCount = results.filter((r) => r.record).length;
      const failedCount = results.length - successCount;
      const combinedUnknown = Array.from(new Set(results.flatMap((r) => r.unknownSkus)));
      setUnknownSkus(combinedUnknown);
      setMsg(`Invoice upload complete: ${successCount} succeeded, ${failedCount} failed.`);
      setMsgTone(failedCount ? "error" : "success");
      await loadImports();
      setFiles([]);
    } catch (err: any) {
      setMsg(err?.message || "Upload failed.");
      setMsgTone("error");
    } finally {
      setBusy(false);
    }
  };

  const deleteImport = async (row: ImportRecord) => {
    if (!confirm(`Delete invoice import ${row.invoiceNo || row.id}? This removes the saved import and invoice file, but does not undo customer history/recent items.`)) return;

    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/invoice-imports?id=${encodeURIComponent(row.id)}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete invoice import.");

      setImports((prev) => prev.filter((item) => item.id !== row.id));
      if (lastRecord?.id === row.id) setLastRecord(null);
      setMsg(data?.warning ? `Deleted import, but file delete warning: ${data.warning}` : "Invoice import deleted.");
      setMsgTone(data?.warning ? "error" : "success");
    } catch (err: any) {
      setMsg(err?.message || "Failed to delete invoice import.");
      setMsgTone("error");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return null;

  if (!authed) {
    return (
      <AdminLogin
        title="Admin sign in"
        subtitle="Upload invoices from the Customers / Orders admin."
        password={passwordInput}
        onPasswordChange={setPasswordInput}
        error={error}
        loading={loading}
        onSubmit={() => login(passwordInput)}
      />
    );
  }

  return (
    <AdminShell
      active="invoices"
      title="Invoice import"
      subtitle="PDF extracts text locally; scanned PNG/JPEG uses OCR (eng + kor + vie). Lines must match Vendor table: SKU … Qty Case Type Unit Each Total."
      onLogout={logout}
    >
      {msg ? <Toast tone={msgTone} message={msg} /> : null}

      <section style={{ ...panel, marginBottom: 16 }}>
        <h2 style={panelTitle}>Upload</h2>
        <div style={{ display: "grid", gap: 12, marginTop: 8, maxWidth: 520 }}>
          <div>
            <label style={labelStyle}>Invoice files (PDF, PNG, JPEG)</label>
            <input
              type="file"
              multiple
              accept=".pdf,application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              style={inputStyle}
            />
            {files.length > 0 ? (
              <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                Selected {files.length}: {files.map((selectedFile) => selectedFile.name).join(", ")}
              </div>
            ) : null}
          </div>
          <div>
            <label style={labelStyle}>Manual account # (optional, overrides OCR)</label>
            <input
              placeholder="e.g. FL111"
              value={accountNo}
              onChange={(e) => setAccountNo(e.target.value.toUpperCase())}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Store label (saved on synthetic history row)</label>
            <input placeholder="Kim & Lee Oriental" value={storeName} onChange={(e) => setStoreName(e.target.value)} style={inputStyle} />
          </div>
          <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={applyHistory} onChange={(e) => setApplyHistory(e.target.checked)} /> Update customer Recent items + order history
          </label>
          <button
            type="button"
            onClick={() => void upload()}
            disabled={busy}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: "none",
              background: busy ? "#93c5fd" : "#2563eb",
              color: "#fff",
              fontWeight: 900,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Processing…" : files.length > 1 ? `Upload & parse ${files.length} files` : "Upload & parse"}
          </button>
        </div>
      </section>

      {batchResults.length > 0 ? (
        <section style={{ ...panel, marginBottom: 16 }}>
          <h2 style={panelTitle}>Batch results</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {batchResults.map((result) => (
              <div
                key={result.fileName}
                style={{
                  border: result.error ? "1px solid #fecaca" : "1px solid #bbf7d0",
                  background: result.error ? "#fef2f2" : "#f0fdf4",
                  borderRadius: 12,
                  padding: 10,
                  fontSize: 13,
                  color: result.error ? "#991b1b" : "#166534",
                }}
              >
                <div style={{ fontWeight: 900 }}>{result.fileName}</div>
                {result.error ? (
                  <div style={{ marginTop: 4 }}>{result.error}</div>
                ) : result.record ? (
                  <div style={{ marginTop: 4 }}>
                    {result.record.accountNo || "no acct"} · {result.record.invoiceNo || "no invoice #"} · {result.record.lineCount} lines · {result.parsedChars} chars
                    {result.unknownSkus.length ? ` · Unknown: ${result.unknownSkus.join(", ")}` : ""}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {lastRecord ? (
        <section style={{ ...panel, marginBottom: 16 }}>
          <h2 style={panelTitle}>Last successful result</h2>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
            Account: <strong>{lastRecord.accountNo || "(none)"}</strong> · Invoice:{" "}
            <strong>{lastRecord.invoiceNo || "(none)"}</strong> · Method:{" "}
            <strong>{lastRecord.extractMethod}</strong> · Chars extracted:{" "}
            <strong>{parsedChars}</strong> · Blob:{" "}
            <a href={invoiceFileHref(lastRecord)} target="_blank" rel="noreferrer">
              open
            </a>
          </p>
          <p style={{ fontSize: 13, color: "#16a34a", fontWeight: 800 }}>
            {lastRecord.appliedToHistory ? "Applied to Recent items / history." : "Not applied (see warnings)."}
          </p>

          {lastRecord.warnings.length > 0 ? (
            <ul style={{ color: "#b45309", fontSize: 13, margin: "12px 0 0", paddingLeft: 18 }}>
              {lastRecord.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          {unknownSkus.length > 0 ? (
            <p style={{ marginTop: 12, fontSize: 13, color: "#b91c1c", fontWeight: 700 }}>
              SKUs not in catalog + Redis overrides: {unknownSkus.join(", ")}
            </p>
          ) : null}

          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: 8 }}>SKU</th>
                  <th style={{ padding: 8 }}>Qty</th>
                  <th style={{ padding: 8 }}>Unit</th>
                  <th style={{ padding: 8 }}>Total</th>
                  <th style={{ padding: 8 }}>Catalog?</th>
                </tr>
              </thead>
              <tbody>
                {lastRecord.lines.map((line) => (
                  <tr key={line.sku} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: 8, fontWeight: 800 }}>{line.sku}</td>
                    <td style={{ padding: 8 }}>{line.qty}</td>
                    <td style={{ padding: 8 }}>{line.unitPrice ?? "—"}</td>
                    <td style={{ padding: 8 }}>{line.lineTotal ?? "—"}</td>
                    <td style={{ padding: 8 }}>{line.inCatalog ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section style={panel}>
        <h2 style={panelTitle}>Recent imports (Redis, last {imports.length})</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {imports.length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 14 }}>No imports yet.</p>
          ) : (
            imports.map((row) => (
              <div key={row.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fafafa" }}>
                <div style={{ fontWeight: 900, fontSize: 14 }}>
                  {row.invoiceNo || "—"} · {row.accountNo || "no acct"} · {row.lineCount} lines
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  {new Date(row.uploadedAt).toLocaleString()} · {row.extractMethod} ·{" "}
                  <a href={invoiceFileHref(row)} target="_blank" rel="noreferrer">
                    file
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => void deleteImport(row)}
                  disabled={busy}
                  style={{
                    marginTop: 8,
                    border: "1px solid #fecaca",
                    background: "#fef2f2",
                    color: "#b91c1c",
                    borderRadius: 10,
                    padding: "7px 10px",
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  Delete import
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </AdminShell>
  );
}
