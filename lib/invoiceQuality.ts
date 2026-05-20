import { loadInvoiceImports } from "@/lib/analyticsCommon";

export type InvoiceQualityStats = {
  totalImports: number;
  last30Days: number;
  missingAccount: number;
  zeroLines: number;
  notAppliedToHistory: number;
  unknownSkuSet: string[];
  unknownSkuLineCount: number;
  recentWarnings: { id: string; accountNo: string; uploadedAt: string; warnings: string[] }[];
};

export async function getInvoiceQualityStats(): Promise<InvoiceQualityStats> {
  const imports = await loadInvoiceImports();
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const unknownSkus = new Set<string>();

  let last30Days = 0;
  let missingAccount = 0;
  let zeroLines = 0;
  let notAppliedToHistory = 0;
  let unknownSkuLineCount = 0;

  for (const record of imports) {
    const uploaded = new Date(record.uploadedAt).getTime();
    if (Number.isFinite(uploaded) && uploaded >= cutoff) last30Days += 1;

    if (!String(record.accountNo || "").trim()) missingAccount += 1;
    if (!record.lineCount || record.lineCount <= 0) zeroLines += 1;
    if (!record.appliedToHistory) notAppliedToHistory += 1;

    for (const line of record.lines || []) {
      if (!line.inCatalog && line.sku) {
        unknownSkus.add(String(line.sku).toUpperCase());
        unknownSkuLineCount += 1;
      }
    }
  }

  const recentWarnings = imports
    .filter((r) => (r.warnings?.length || 0) > 0)
    .slice(0, 8)
    .map((r) => ({
      id: r.id,
      accountNo: r.accountNo || "—",
      uploadedAt: r.uploadedAt,
      warnings: r.warnings.slice(0, 3),
    }));

  return {
    totalImports: imports.length,
    last30Days,
    missingAccount,
    zeroLines,
    notAppliedToHistory,
    unknownSkuSet: Array.from(unknownSkus).sort(),
    unknownSkuLineCount,
    recentWarnings,
  };
}
