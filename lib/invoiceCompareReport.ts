import {
  addUtcDays,
  buildCatalogMap,
  formatDate,
  loadInvoiceImports,
  parseDate,
} from "@/lib/analyticsCommon";
import { cleanSku, growthPct } from "@/lib/analyticsPure";
import { resolveInvoiceCaseUnitPrice } from "@/lib/invoice/invoiceCaseUnitPrice";
import type {
  InvoiceCompareCell,
  InvoiceCompareColumn,
  InvoiceCompareReport,
  InvoiceCompareRow,
} from "@/lib/invoiceCompareCsv";
import { invoiceCompareAccountsMatch } from "@/lib/invoiceCompareCsv";
import type { InvoiceImportRecord } from "@/lib/invoice/invoiceImportRecord";
import { isOrderableCatalogStatus } from "@/lib/orderableCatalog";

export type {
  InvoiceCompareCell,
  InvoiceCompareColumn,
  InvoiceCompareReport,
  InvoiceCompareRow,
} from "@/lib/invoiceCompareCsv";
export { invoiceCompareToCsv, invoiceCompareAccountKey } from "@/lib/invoiceCompareCsv";

const DEFAULT_LOOKBACK_DAYS = 90;
/** Show every invoice in the window; the table scrolls horizontally. */
const DEFAULT_MAX_INVOICES = 200;
const HARD_MAX_INVOICES = 200;

type MatchedInvoice = {
  importId: string;
  invoiceNo: string;
  date: string;
  sortKey: number;
  prices: Map<string, { price: number; qty: number }>;
};

type AccountCandidate = {
  record: InvoiceImportRecord;
  sortKey: number;
  date: string;
};

function parseIsoDateInput(value: string) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return parseDate(text);
}

function roundPct(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

function buildPrices(record: { lines?: Array<{ sku?: string; qty?: number; unitPrice?: number; lineTotal?: number }> }) {
  const prices = new Map<string, { price: number; qty: number }>();
  for (const line of record.lines || []) {
    const sku = cleanSku(line.sku);
    if (!sku) continue;
    const price = resolveInvoiceCaseUnitPrice({
      qty: line.qty,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
    });
    if (price == null || !(price > 0)) continue;
    const qty = Number(line.qty) || 0;
    const existing = prices.get(sku);
    if (!existing) {
      prices.set(sku, { price, qty });
    } else {
      existing.price = price;
      existing.qty += qty;
    }
  }
  return prices;
}

function toMatched(candidate: AccountCandidate): MatchedInvoice | null {
  const prices = buildPrices(candidate.record);
  if (prices.size === 0) return null;
  return {
    importId: String(candidate.record.id || "").trim(),
    invoiceNo: String(candidate.record.invoiceNo || "").trim(),
    date: candidate.date,
    sortKey: candidate.sortKey,
    prices,
  };
}

export async function getInvoiceCompareReport(input: {
  accountNo: string;
  date: string;
  lookbackDays?: number;
  maxInvoices?: number;
}): Promise<InvoiceCompareReport & { note?: string; accountInvoiceCount?: number }> {
  const accountNo = String(input.accountNo || "").trim().toUpperCase();
  const asOf = parseIsoDateInput(input.date);
  const lookbackDays =
    Number.isFinite(input.lookbackDays) && Number(input.lookbackDays) > 0
      ? Math.min(365, Math.floor(Number(input.lookbackDays)))
      : DEFAULT_LOOKBACK_DAYS;
  const maxInvoices =
    Number.isFinite(input.maxInvoices) && Number(input.maxInvoices) > 0
      ? Math.min(HARD_MAX_INVOICES, Math.floor(Number(input.maxInvoices)))
      : DEFAULT_MAX_INVOICES;

  if (!accountNo) throw new Error("Account number is required.");
  if (!asOf) throw new Error("Date must be YYYY-MM-DD.");

  const windowStart = addUtcDays(asOf, -lookbackDays);
  const windowEnd = addUtcDays(asOf, lookbackDays);
  const asOfTs = asOf.getTime();
  const windowStartTs = windowStart.getTime();
  const windowEndTs = windowEnd.getTime();

  const imports = await loadInvoiceImports();
  const accountCandidates: AccountCandidate[] = [];

  // Collect account invoices by date only — parse prices after selection.
  for (const record of imports) {
    if (!invoiceCompareAccountsMatch(String(record.accountNo || ""), accountNo)) continue;
    if (!(record.lines && record.lines.length > 0)) continue;

    const effectiveDate = parseDate(record.invoiceDate) || parseDate(record.uploadedAt);
    if (!effectiveDate) continue;

    accountCandidates.push({
      record,
      sortKey: effectiveDate.getTime(),
      date: formatDate(effectiveDate),
    });
  }

  accountCandidates.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    return String(a.record.invoiceNo || "").localeCompare(String(b.record.invoiceNo || ""));
  });

  let picked: AccountCandidate[] = accountCandidates.filter(
    (inv) => inv.sortKey >= windowStartTs && inv.sortKey <= asOfTs
  );
  let note: string | undefined;

  if (picked.length === 0) {
    picked = accountCandidates.filter(
      (inv) => inv.sortKey >= windowStartTs && inv.sortKey <= windowEndTs
    );
    if (picked.length > 0) {
      note = `No invoices on/before ${formatDate(asOf)}; showing invoices within ±${lookbackDays} days.`;
    }
  }

  if (picked.length === 0 && accountCandidates.length > 0) {
    const ranked = [...accountCandidates].sort((a, b) => {
      const da = Math.abs(a.sortKey - asOfTs);
      const db = Math.abs(b.sortKey - asOfTs);
      if (da !== db) return da - db;
      return b.sortKey - a.sortKey;
    });
    picked = ranked.slice(0, maxInvoices).sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
      return String(a.record.invoiceNo || "").localeCompare(String(b.record.invoiceNo || ""));
    });
    const first = picked[0]?.date || "";
    const last = picked[picked.length - 1]?.date || "";
    note = `No invoices near ${formatDate(asOf)} (±${lookbackDays}d). Showing nearest ${picked.length} invoice(s) for this account (${first} → ${last}).`;
  }

  if (picked.length > maxInvoices) {
    picked = picked.slice(picked.length - maxInvoices);
  }

  const selected: MatchedInvoice[] = [];
  for (const candidate of picked) {
    const matched = toMatched(candidate);
    if (matched) selected.push(matched);
  }

  const skuSet = new Set<string>();
  for (const inv of selected) {
    for (const sku of inv.prices.keys()) skuSet.add(sku);
  }
  const skus = [...skuSet].sort((a, b) => a.localeCompare(b));
  const catalog = await buildCatalogMap(skus);

  const invoices: InvoiceCompareColumn[] = selected.map((inv) => ({
    importId: inv.importId,
    invoiceNo: inv.invoiceNo,
    date: inv.date,
  }));

  const rows: InvoiceCompareRow[] = skus.map((sku) => {
    const product = catalog.get(sku);
    const cells: InvoiceCompareCell[] = selected.map((inv, index) => {
      const hit = inv.prices.get(sku);
      const price = hit?.price ?? null;
      let changePct: number | null = null;
      if (index > 0 && price != null) {
        const prev = selected[index - 1].prices.get(sku)?.price;
        if (prev != null && prev > 0) changePct = roundPct(growthPct(price, prev));
      }
      return {
        price,
        qty: hit?.qty ?? 0,
        changePct,
      };
    });

    return {
      sku,
      name: product?.name || "",
      brand: product?.brand || "",
      status: product?.status || "",
      available: isOrderableCatalogStatus(product?.status),
      cells,
    };
  });

  return {
    accountNo,
    asOfDate: formatDate(asOf),
    lookbackDays,
    invoiceCount: invoices.length,
    skuCount: rows.length,
    invoices,
    rows,
    accountInvoiceCount: accountCandidates.length,
    note,
  };
}
