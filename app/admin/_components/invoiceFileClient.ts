type InvoiceFileRow = {
  id: string;
  blobUrl: string;
  blobPathname?: string;
  accountNo?: string;
  invoiceNo?: string | null;
  mimeType?: string;
};

function invoiceFileName(row: InvoiceFileRow) {
  const ext = String(row.mimeType || "").includes("pdf") ? "pdf" : "bin";
  return `${row.accountNo || "invoice"}-${row.invoiceNo || row.id}.${ext}`.replace(/[^\w.-]+/g, "_");
}

async function fetchInvoiceBlob(
  row: InvoiceFileRow,
  adminHeaders: () => Record<string, string>,
  download: boolean
): Promise<Blob> {
  if (!row.blobPathname && row.blobUrl) {
    const res = await fetch(row.blobUrl);
    if (!res.ok) throw new Error("Failed to load invoice.");
    return res.blob();
  }

  const params = new URLSearchParams({ id: row.id });
  if (download) params.set("download", "1");
  const res = await fetch(`/api/admin/invoice-file?${params}`, { headers: adminHeaders() });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Failed to load invoice.");
  }
  return res.blob();
}

export async function downloadInvoiceFile(
  row: InvoiceFileRow,
  adminHeaders: () => Record<string, string>
) {
  const blob = await fetchInvoiceBlob(row, adminHeaders, true);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = invoiceFileName(row);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function openInvoiceFile(row: InvoiceFileRow, adminHeaders: () => Record<string, string>) {
  const blob = await fetchInvoiceBlob(row, adminHeaders, false);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
