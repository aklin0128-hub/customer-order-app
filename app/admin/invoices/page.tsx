"use client";

import { useEffect, useMemo, useState } from "react";
import { downloadCsv } from "../_components/admin-analytics-ui";
import { downloadInvoiceFile, openInvoiceFile } from "../_components/invoiceFileClient";

import { AdminPage } from "../_components/AdminPage";
import { inputStyle, panel, panelTitle } from "../_components/admin-styles";
import { AdminListPager } from "../_components/AdminListPager";
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

type InvoiceSortField = "uploadedAt" | "account" | "invoiceDate" | "invoiceNo";
type SortDir = "asc" | "desc";

type DuplicateGroupMember = {
  id: string;
  uploadedAt: string;
  accountNo: string;
  invoiceNo: string | null;
  invoiceDate: string | null;
  lineCount: number;
};

type DuplicateGroup = {
  key: string;
  matchBy: "invoiceNo" | "invoiceDate";
  accountNo: string;
  invoiceNo: string | null;
  invoiceDate: string | null;
  imports: DuplicateGroupMember[];
};

const labelStyle = { display: "block" as const, fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#374151" };

export default function AdminInvoicesPage() {
  const { authed, adminHeaders } = useAdminAuth();

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"success" | "error">("success");
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [search, setSearch] = useState("");
  const [listPage, setListPage] = useState(1);
  const [listTotal, setListTotal] = useState(0);
  const [listTotalPages, setListTotalPages] = useState(1);
  const [quality, setQuality] = useState({
    total: 0,
    last30Days: 0,
    missingAccount: 0,
    zeroLines: 0,
    unknownSkus: [] as string[],
  });
  const [sortField, setSortField] = useState<InvoiceSortField>("uploadedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [files, setFiles] = useState<File[]>([]);
  const [accountNo, setAccountNo] = useState("");
  const [storeName, setStoreName] = useState("");
  const [applyHistory, setApplyHistory] = useState(true);
  const [lastRecord, setLastRecord] = useState<ImportRecord | null>(null);
  const [unknownSkus, setUnknownSkus] = useState<string[]>([]);
  const [parsedChars, setParsedChars] = useState(0);
  const [batchResults, setBatchResults] = useState<BatchUploadResult[]>([]);
  const [selectedImportIds, setSelectedImportIds] = useState<string[]>([]);
  const [dupChecked, setDupChecked] = useState(false);
  const [dupGroups, setDupGroups] = useState<DuplicateGroup[]>([]);
  const [selectedDupIds, setSelectedDupIds] = useState<string[]>([]);

  const loadImports = async (page = listPage) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/admin/invoice-imports?${params}`, {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load imports.");
      setImports(Array.isArray(data.imports) ? data.imports : []);
      setListTotal(data.total ?? 0);
      setListTotalPages(data.totalPages ?? 1);
      setListPage(data.page ?? page);
      if (data.quality) setQuality(data.quality);
      setSelectedImportIds((prev) => prev.filter((id) => Array.isArray(data.imports) && data.imports.some((row: ImportRecord) => row.id === id)));
    } catch (err: any) {
      setMsg(err?.message || "Failed to load invoice history.");
      setMsgTone("error");
    }
  };

  useEffect(() => {
    if (!authed) return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const acct = params.get("accountNo");
    if (q && q !== "unknown") setSearch(q);
    if (acct) setAccountNo(acct.trim().toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    const t = setTimeout(() => void loadImports(listPage), search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, search, listPage]);

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

  const reparseImport = async (row: ImportRecord, options: { skipConfirm?: boolean } = {}) => {
    if (
      !options.skipConfirm &&
      !confirm(
        `Re-parse invoice ${row.invoiceNo || row.id}? This keeps the same import and file, but refreshes SKU/qty/prices with the latest parser.`
      )
    ) {
      return false;
    }

    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/invoice-imports/reparse", {
        method: "POST",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to re-parse invoice.");

      const updated = Array.isArray(data.updated) ? data.updated[0] : null;
      if (updated?.id) {
        await loadImports(listPage);
      }
      setMsg(
        updated
          ? `Re-parsed ${row.invoiceNo || row.id}: ${updated.lineCount} lines.`
          : "Re-parse finished."
      );
      setMsgTone("success");
      return true;
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Failed to re-parse invoice.");
      setMsgTone("error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const deleteImport = async (row: Pick<ImportRecord, "id" | "invoiceNo">, options: { skipConfirm?: boolean } = {}) => {
    if (!options.skipConfirm && !confirm(`Delete invoice import ${row.invoiceNo || row.id}? This removes the saved import and invoice file, but does not undo customer history/recent items.`)) return false;

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
      setSelectedImportIds((prev) => prev.filter((id) => id !== row.id));
      setDupGroups((prev) =>
        prev
          .map((group) => ({ ...group, imports: group.imports.filter((item) => item.id !== row.id) }))
          .filter((group) => group.imports.length > 1)
      );
      setSelectedDupIds((prev) => prev.filter((id) => id !== row.id));
      if (lastRecord?.id === row.id) setLastRecord(null);
      setMsg(data?.warning ? `Deleted import, but file delete warning: ${data.warning}` : "Invoice import deleted.");
      setMsgTone(data?.warning ? "error" : "success");
      return true;
    } catch (err: any) {
      setMsg(err?.message || "Failed to delete invoice import.");
      setMsgTone("error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const selectedImports = imports.filter((row) => selectedImportIds.includes(row.id));
  const sortedImports = [...imports].sort((a, b) => {
    const av =
      sortField === "account" ? a.accountNo || "" :
      sortField === "invoiceDate" ? a.invoiceDate || "" :
      sortField === "invoiceNo" ? a.invoiceNo || "" :
      a.uploadedAt || "";
    const bv =
      sortField === "account" ? b.accountNo || "" :
      sortField === "invoiceDate" ? b.invoiceDate || "" :
      sortField === "invoiceNo" ? b.invoiceNo || "" :
      b.uploadedAt || "";
    const result = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sortDir === "asc" ? result : -result;
  });
  const allVisibleSelected = imports.length > 0 && selectedImportIds.length === imports.length;

  const lastRecordUnknownSkus = useMemo(
    () => (lastRecord?.lines || []).filter((line) => !line.inCatalog && line.sku).map((line) => line.sku),
    [lastRecord]
  );

  const extraDupIds = useMemo(
    () => dupGroups.flatMap((group) => group.imports.slice(1).map((row) => row.id)),
    [dupGroups]
  );
  const duplicateImportIds = useMemo(
    () => new Set(dupGroups.flatMap((group) => group.imports.map((row) => row.id))),
    [dupGroups]
  );

  const invoiceQuality = quality;

  const toggleImportSelection = (id: string) => {
    setSelectedImportIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const bulkReparseImports = async () => {
    if (selectedImports.length === 0) return;
    if (
      !confirm(
        `Re-parse ${selectedImports.length} selected invoices with the latest parser? Import ids and files stay the same; only parsed lines/prices update.`
      )
    ) {
      return;
    }

    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/invoice-imports/reparse", {
        method: "POST",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedImports.map((row) => row.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to re-parse invoices.");

      await loadImports(listPage);
      const updatedCount = Array.isArray(data.updated) ? data.updated.length : 0;
      const errorCount = Array.isArray(data.errors) ? data.errors.length : 0;
      setMsg(`Re-parsed ${updatedCount} invoice(s)${errorCount ? `; ${errorCount} failed.` : "."}`);
      setMsgTone(errorCount && updatedCount === 0 ? "error" : "success");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Failed to re-parse invoices.");
      setMsgTone("error");
    } finally {
      setBusy(false);
    }
  };

  const bulkDeleteImports = async () => {
    if (selectedImports.length === 0) return;
    if (!confirm(`Delete ${selectedImports.length} selected invoice imports? This removes saved imports and invoice files, but does not undo customer history/recent items.`)) return;

    setBusy(true);
    let successCount = 0;
    try {
      for (const row of selectedImports) {
        const ok = await deleteImport(row, { skipConfirm: true });
        if (ok) successCount += 1;
      }
      setMsg(`Deleted ${successCount}/${selectedImports.length} selected invoice imports.`);
      setMsgTone(successCount === selectedImports.length ? "success" : "error");
    } finally {
      setBusy(false);
    }
  };

  const checkDuplicateInvoices = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/invoice-imports/duplicates", {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to check duplicate invoices.");

      const groups = Array.isArray(data.groups) ? (data.groups as DuplicateGroup[]) : [];
      const extraCount = Number(data.extraCount) || groups.reduce((sum, group) => sum + Math.max(0, group.imports.length - 1), 0);
      setDupGroups(groups);
      setDupChecked(true);
      setSelectedDupIds([]);
      setMsg(
        groups.length
          ? `Found ${groups.length} duplicate group(s) · ${extraCount} extra cop${extraCount === 1 ? "y" : "ies"}.`
          : "No duplicate invoices found."
      );
      setMsgTone("success");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Failed to check duplicate invoices.");
      setMsgTone("error");
    } finally {
      setBusy(false);
    }
  };

  const toggleDupSelection = (id: string) => {
    setSelectedDupIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const deleteDuplicateImports = async (rows: DuplicateGroupMember[]) => {
    if (rows.length === 0) return;
    if (
      !confirm(
        `Delete ${rows.length} duplicate invoice import${rows.length === 1 ? "" : "s"}? This removes saved imports and invoice files, but does not undo customer history/recent items.`
      )
    ) {
      return;
    }

    setBusy(true);
    let successCount = 0;
    try {
      for (const row of rows) {
        const ok = await deleteImport(row, { skipConfirm: true });
        if (ok) successCount += 1;
      }
      setMsg(`Deleted ${successCount}/${rows.length} duplicate invoice import(s).`);
      setMsgTone(successCount === rows.length ? "success" : "error");
      await loadImports(listPage);
    } finally {
      setBusy(false);
    }
  };

  const exportLatestPricesCsv = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/invoice-latest-prices?format=csv", {
        cache: "no-store",
        headers: adminHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string })?.error || "Failed to export latest prices.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-latest-prices-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setMsg("Downloaded latest invoice prices (account, SKU, price, last price date).");
      setMsgTone("success");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Failed to export latest prices.");
      setMsgTone("error");
    } finally {
      setBusy(false);
    }
  };

  const bulkDownloadImports = async () => {
    if (selectedImports.length === 0) return;

    setBusy(true);
    try {
      for (const row of selectedImports) {
        await downloadInvoiceFile(row, adminHeaders);
      }
      setMsg(`Downloaded ${selectedImports.length} invoice file(s).`);
      setMsgTone("success");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Failed to download invoice.");
      setMsgTone("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      active="invoices"
      title="Invoice import"
      subtitle="PDF extracts text locally; scanned PNG/JPEG uses OCR (eng + kor + vie). Lines must match Vendor table: SKU … Qty Case Type Unit Each Total."
    >
      {msg ? <Toast tone={msgTone} message={msg} /> : null}

      <section style={{ ...panel, marginBottom: 16 }}>
        <h2 style={panelTitle}>Data quality</h2>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
          {invoiceQuality.total} imports · {invoiceQuality.last30Days} in last 30 days ·{" "}
          {invoiceQuality.missingAccount} missing account · {invoiceQuality.zeroLines} empty parses ·{" "}
          {invoiceQuality.unknownSkus.length} unknown SKUs (across all imports)
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: invoiceQuality.unknownSkus.length > 0 ? 8 : 0 }}>
          <button
            type="button"
            onClick={() => void checkDuplicateInvoices()}
            disabled={busy}
            style={{
              border: "1px solid #fcd34d",
              borderRadius: 10,
              padding: "8px 12px",
              background: "#fffbeb",
              color: "#92400e",
              fontWeight: 800,
              fontSize: 12,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            Check duplicates
          </button>
          <button
            type="button"
            onClick={() => void exportLatestPricesCsv()}
            disabled={busy}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 10,
              padding: "8px 12px",
              background: "#fff",
              fontWeight: 800,
              fontSize: 12,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            Export latest prices (CSV)
          </button>
          {invoiceQuality.unknownSkus.length > 0 ? (
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  "invoice-unknown-skus.csv",
                  ["SKU"],
                  invoiceQuality.unknownSkus.map((s) => [s])
                )
              }
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 10,
                padding: "8px 12px",
                background: "#fff",
                fontWeight: 800,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Export unknown SKU list
            </button>
          ) : null}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
          Latest price CSV: one row per account + SKU with columns account, sku, price, lastPriceDate. Re-parse saved imports to refresh dates and prices after parser updates without deleting or re-uploading. Check duplicates groups the same account + invoice #, or the same account + date when no invoice number was parsed.
        </p>
        {dupChecked ? (
          <div
            style={{
              marginTop: 12,
              border: dupGroups.length ? "1px solid #fcd34d" : "1px solid #d1d5db",
              background: dupGroups.length ? "#fffbeb" : "#f9fafb",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: dupGroups.length ? 10 : 0 }}>
              <strong style={{ fontSize: 13, color: dupGroups.length ? "#92400e" : "#374151" }}>
                {dupGroups.length
                  ? `${dupGroups.length} duplicate group(s) · ${extraDupIds.length} extra cop${extraDupIds.length === 1 ? "y" : "ies"}`
                  : "No duplicate invoices found"}
              </strong>
              {dupGroups.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedDupIds(extraDupIds)}
                    disabled={busy || extraDupIds.length === 0}
                    style={{
                      border: "1px solid #fcd34d",
                      background: "#fff",
                      color: "#92400e",
                      borderRadius: 10,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: busy || extraDupIds.length === 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    Select extras ({extraDupIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void deleteDuplicateImports(
                        dupGroups.flatMap((group) => group.imports.filter((row) => selectedDupIds.includes(row.id)))
                      )
                    }
                    disabled={busy || selectedDupIds.length === 0}
                    style={{
                      border: "1px solid #fecaca",
                      background: "#fef2f2",
                      color: "#b91c1c",
                      borderRadius: 10,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: busy || selectedDupIds.length === 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    Delete selected extras ({selectedDupIds.length})
                  </button>
                </>
              ) : null}
            </div>
            {dupGroups.map((group) => {
              const extras = group.imports.slice(1);
              return (
                <div
                  key={group.key}
                  style={{
                    border: "1px solid #fde68a",
                    background: "#fff",
                    borderRadius: 10,
                    padding: 10,
                    marginTop: 8,
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#92400e" }}>
                      {group.accountNo} · {group.matchBy === "invoiceNo" ? group.invoiceNo || "—" : `date ${group.invoiceDate || "—"}`} · {group.imports.length} copies
                    </div>
                    <button
                      type="button"
                      onClick={() => void deleteDuplicateImports(extras)}
                      disabled={busy || extras.length === 0}
                      style={{
                        border: "1px solid #fecaca",
                        background: "#fef2f2",
                        color: "#b91c1c",
                        borderRadius: 8,
                        padding: "5px 8px",
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: busy || extras.length === 0 ? "not-allowed" : "pointer",
                      }}
                    >
                      Keep oldest, delete extras
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                    {group.imports.map((row, index) => (
                      <div key={row.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "#374151" }}>
                        <input
                          type="checkbox"
                          checked={selectedDupIds.includes(row.id)}
                          onChange={() => toggleDupSelection(row.id)}
                          disabled={busy}
                          aria-label={`Select duplicate ${row.invoiceNo || row.id}`}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 800 }}>{index === 0 ? "Oldest" : `Extra ${index}`}</span>
                          {" · "}
                          {row.invoiceNo || "no invoice #"} · {row.invoiceDate || "no date"} · {row.lineCount} lines · uploaded{" "}
                          {new Date(row.uploadedAt).toLocaleString()}
                        </div>
                        <button
                          type="button"
                          onClick={() => void deleteDuplicateImports([row])}
                          disabled={busy}
                          style={{
                            border: "1px solid #fecaca",
                            background: "#fff",
                            color: "#b91c1c",
                            borderRadius: 8,
                            padding: "4px 8px",
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: busy ? "not-allowed" : "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

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
                    {result.record.warnings.some((warning) => warning.toLowerCase().includes("duplicate"))
                      ? " · Duplicate of an existing import"
                      : ""}
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
            <strong>{lastRecord.invoiceNo || "(none)"}</strong> · Date:{" "}
            <strong>{lastRecord.invoiceDate || "not detected"}</strong> · Method:{" "}
            <strong>{lastRecord.extractMethod}</strong> · Chars extracted:{" "}
            <strong>{parsedChars}</strong> · Blob:{" "}
            <button
              type="button"
              onClick={() => void openInvoiceFile(lastRecord, adminHeaders)}
              style={{ border: "none", background: "none", color: "#2563eb", cursor: "pointer", padding: 0, textDecoration: "underline", font: "inherit" }}
            >
              open
            </button>
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

          {lastRecordUnknownSkus.length > 0 ? (
            <p style={{ marginTop: 12, fontSize: 13, color: "#b91c1c", fontWeight: 700 }}>
              {lastRecordUnknownSkus.length} SKU(s) not in catalog master or Redis product overrides:{" "}
              {lastRecordUnknownSkus.join(", ")}
            </p>
          ) : null}
          {unknownSkus.length > lastRecordUnknownSkus.length ? (
            <p style={{ marginTop: 8, fontSize: 12, color: "#92400e" }}>
              Batch total unknown SKUs (all files): {unknownSkus.join(", ")}
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
                  <tr
                    key={`${line.sku}-${line.qty}-${line.lineTotal ?? ""}`}
                    style={{
                      borderBottom: "1px solid #f3f4f6",
                      background: line.inCatalog ? undefined : "#fef2f2",
                    }}
                  >
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
        <h2 style={panelTitle}>Recent imports ({listTotal})</h2>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setListPage(1);
          }}
          placeholder="Search account, invoice #, import id…"
          style={{ ...inputStyle, marginTop: 10, marginBottom: 10 }}
        />
        {imports.length > 0 ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 0 }}>
            <select value={sortField} onChange={(e) => setSortField(e.target.value as InvoiceSortField)} style={{ ...inputStyle, width: "auto", minWidth: 170 }}>
              <option value="uploadedAt">Sort by upload date</option>
              <option value="account">Sort by account #</option>
              <option value="invoiceDate">Sort by invoice date</option>
              <option value="invoiceNo">Sort by invoice no</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDir((prev) => prev === "asc" ? "desc" : "asc")}
              disabled={busy}
              style={{
                border: "1px solid #d1d5db",
                background: "#fff",
                borderRadius: 10,
                padding: "7px 10px",
                fontSize: 12,
                fontWeight: 900,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {sortDir === "asc" ? "Asc ↑" : "Desc ↓"}
            </button>
            <button
              type="button"
              onClick={() => setSelectedImportIds(allVisibleSelected ? [] : sortedImports.map((row) => row.id))}
              disabled={busy}
              style={{
                border: "1px solid #d1d5db",
                background: "#fff",
                borderRadius: 10,
                padding: "7px 10px",
                fontSize: 12,
                fontWeight: 900,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {allVisibleSelected ? "Clear selection" : "Select all"}
            </button>
            <button
              type="button"
              onClick={bulkDownloadImports}
              disabled={busy || selectedImports.length === 0}
              style={{
                border: "1px solid #bfdbfe",
                background: "#eff6ff",
                color: "#1d4ed8",
                borderRadius: 10,
                padding: "7px 10px",
                fontSize: 12,
                fontWeight: 900,
                cursor: busy || selectedImports.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Download selected ({selectedImports.length})
            </button>
            <button
              type="button"
              onClick={() => void bulkReparseImports()}
              disabled={busy || selectedImports.length === 0}
              style={{
                border: "1px solid #bbf7d0",
                background: "#f0fdf4",
                color: "#15803d",
                borderRadius: 10,
                padding: "7px 10px",
                fontSize: 12,
                fontWeight: 900,
                cursor: busy || selectedImports.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Re-parse selected ({selectedImports.length})
            </button>
            <button
              type="button"
              onClick={() => void bulkDeleteImports()}
              disabled={busy || selectedImports.length === 0}
              style={{
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#b91c1c",
                borderRadius: 10,
                padding: "7px 10px",
                fontSize: 12,
                fontWeight: 900,
                cursor: busy || selectedImports.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Delete selected ({selectedImports.length})
            </button>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Re-parse keeps the file and import id; delete does not undo customer recent/history.
            </span>
          </div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {imports.length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 14 }}>No imports yet.</p>
          ) : (
            sortedImports.map((row) => (
              <div
                key={row.id}
                style={{
                  border: duplicateImportIds.has(row.id) ? "1px solid #fcd34d" : "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                  background: duplicateImportIds.has(row.id) ? "#fffbeb" : "#fafafa",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <input
                    type="checkbox"
                    checked={selectedImportIds.includes(row.id)}
                    onChange={() => toggleImportSelection(row.id)}
                    disabled={busy}
                    style={{ marginTop: 2 }}
                    aria-label={`Select invoice ${row.invoiceNo || row.id}`}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 14 }}>
                      {row.invoiceNo || "—"} · {row.accountNo || "no acct"} · {row.lineCount} lines
                      {duplicateImportIds.has(row.id) ? (
                        <span style={{ marginLeft: 8, color: "#92400e", fontSize: 11, fontWeight: 800 }}>DUPLICATE</span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                      Invoice {row.invoiceDate || "date not detected"} · uploaded {new Date(row.uploadedAt).toLocaleString()} · {row.extractMethod}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void downloadInvoiceFile(row, adminHeaders).catch((err: unknown) => {
                      setMsg(err instanceof Error ? err.message : "Failed to download invoice.");
                      setMsgTone("error");
                    })}
                    title="Download invoice"
                    aria-label={`Download invoice ${row.invoiceNo || row.id}`}
                    style={{
                      border: "1px solid #bfdbfe",
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      borderRadius: 10,
                      width: 34,
                      height: 34,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      fontWeight: 900,
                      flexShrink: 0,
                      cursor: "pointer",
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => void reparseImport(row)}
                    disabled={busy}
                    title="Re-parse invoice"
                    aria-label={`Re-parse invoice ${row.invoiceNo || row.id}`}
                    style={{
                      border: "1px solid #bbf7d0",
                      background: "#f0fdf4",
                      color: "#15803d",
                      borderRadius: 10,
                      width: 34,
                      height: 34,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      fontWeight: 900,
                      flexShrink: 0,
                      cursor: busy ? "not-allowed" : "pointer",
                    }}
                  >
                    ↻
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteImport(row)}
                    disabled={busy}
                    title="Delete invoice"
                    aria-label={`Delete invoice ${row.invoiceNo || row.id}`}
                    style={{
                      border: "1px solid #fecaca",
                      background: "#fef2f2",
                      color: "#b91c1c",
                      borderRadius: 10,
                      width: 34,
                      height: 34,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      fontWeight: 900,
                      flexShrink: 0,
                      cursor: busy ? "not-allowed" : "pointer",
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <AdminListPager
          page={listPage}
          totalPages={listTotalPages}
          total={listTotal}
          onPageChange={setListPage}
          disabled={busy}
        />
      </section>
    </AdminPage>
  );
}
