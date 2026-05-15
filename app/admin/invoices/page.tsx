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
  extractMethod: "pdf" | "ocr";
  lineCount: number;
  lines: ImportLine[];
  warnings: string[];
  appliedToHistory: boolean;
};

const labelStyle = { display: "block" as const, fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#374151" };

export default function AdminInvoicesPage() {
  const { ready, authed, error, loading, login, logout, adminHeaders } = useAdminAuth();
  const [passwordInput, setPasswordInput] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"success" | "error">("success");
  const [imports, setImports] = useState<ImportRecord[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [accountNo, setAccountNo] = useState("");
  const [storeName, setStoreName] = useState("");
  const [applyHistory, setApplyHistory] = useState(true);
  const [lastRecord, setLastRecord] = useState<ImportRecord | null>(null);
  const [unknownSkus, setUnknownSkus] = useState<string[]>([]);
  const [parsedChars, setParsedChars] = useState(0);

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
    if (!file) {
      setMsg("Choose a PDF or image file.");
      setMsgTone("error");
      return;
    }

    setBusy(true);
    setMsg("");
    setLastRecord(null);
    setUnknownSkus([]);

    try {
      const fd = new FormData();
      fd.set("file", file);
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
      setLastRecord(rec);
      setUnknownSkus(Array.isArray(data.unknownSkus) ? data.unknownSkus : []);
      setParsedChars(Number(data.parsedTextChars || 0));
      setMsg("Invoice parsed. Review lines and warnings below.");
      setMsgTone("success");
      await loadImports();
      setFile(null);
    } catch (err: any) {
      setMsg(err?.message || "Upload failed.");
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
            <label style={labelStyle}>Invoice file (PDF, PNG, JPEG)</label>
            <input type="file" accept=".pdf,application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={inputStyle} />
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
            {busy ? "Processing…" : "Upload & parse"}
          </button>
        </div>
      </section>

      {lastRecord ? (
        <section style={{ ...panel, marginBottom: 16 }}>
          <h2 style={panelTitle}>Last result</h2>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
            Account: <strong>{lastRecord.accountNo || "(none)"}</strong> · Invoice:{" "}
            <strong>{lastRecord.invoiceNo || "(none)"}</strong> · Method:{" "}
            <strong>{lastRecord.extractMethod}</strong> · Chars extracted:{" "}
            <strong>{parsedChars}</strong> · Blob:{" "}
            <a href={lastRecord.blobUrl} target="_blank" rel="noreferrer">
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
                  <a href={row.blobUrl} target="_blank" rel="noreferrer">
                    file
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </AdminShell>
  );
}
