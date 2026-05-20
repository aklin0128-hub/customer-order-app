import { collectSaleEvents, buildCatalogMap, loadInvoiceImports } from "@/lib/analyticsCommon";
import { getCustomerByAccount, normalizeAccountNo } from "@/lib/customers";
import { marketRegionLabel } from "@/lib/customerRegion";
import { getCustomerHealthRow } from "@/lib/customerHealth";
import { redis } from "@/lib/redis";

type OrderHistoryEntry = {
  accountNo?: string;
  storeName?: string;
  orderRef?: string;
  createdAt?: string;
  items?: { sku?: string; qty?: string | number }[];
  note?: string;
  source?: string;
};

export type Account360Result = {
  accountNo: string;
  customer: {
    storeName: string;
    active: boolean;
    regionLabel: string;
    email?: string;
    phone?: string;
  } | null;
  health: {
    status: string;
    statusLabel: string;
    lastInvoiceDate: string | null;
    qty90: number;
    qty90PriorYear: number;
    revenue90: number;
    yoyQtyGrowthPct: number | null;
  } | null;
  recentOrders: {
    orderRef: string;
    createdAt: string;
    itemCount: number;
    totalCases: number;
    source?: string;
  }[];
  recentInvoices: {
    id: string;
    invoiceDate: string | null;
    uploadedAt: string;
    lineCount: number;
    invoiceNo: string | null;
  }[];
  topSkus: { sku: string; name: string; brand: string; qty: number }[];
  draft: {
    lineCount: number;
    totalCases: number;
    updatedAt: string;
  } | null;
};

export async function getAccount360(accountNo: string): Promise<Account360Result | null> {
  const acct = normalizeAccountNo(accountNo);
  if (!acct) return null;

  const customer = await getCustomerByAccount(acct);
  const healthRow = await getCustomerHealthRow(acct);

  const since90 = new Date();
  since90.setUTCDate(since90.getUTCDate() - 90);
  const events = await collectSaleEvents({ since: since90 });
  const accountEvents = events.filter((e) => e.accountNo === acct);

  const skuQty = new Map<string, number>();
  for (const e of accountEvents) {
    skuQty.set(e.sku, (skuQty.get(e.sku) || 0) + e.qty);
  }

  const catalog = await buildCatalogMap(Array.from(skuQty.keys()));
  const topSkus = Array.from(skuQty.entries())
    .map(([sku, qty]) => {
      const p = catalog.get(sku);
      return { sku, name: p?.name || "", brand: p?.brand || "", qty };
    })
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 15);

  const history = (await redis.get<OrderHistoryEntry[]>(`orderHistory:${acct}`)) || [];
  const recentOrders = history.slice(0, 10).map((entry) => {
    const items = entry.items || [];
    const totalCases = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
    return {
      orderRef: entry.orderRef || "—",
      createdAt: entry.createdAt || "",
      itemCount: items.length,
      totalCases,
      source: entry.source,
    };
  });

  const imports = await loadInvoiceImports();
  const recentInvoices = imports
    .filter((r) => String(r.accountNo || "").trim().toUpperCase() === acct)
    .slice(0, 10)
    .map((r) => ({
      id: r.id,
      invoiceDate: r.invoiceDate,
      uploadedAt: r.uploadedAt,
      lineCount: r.lineCount,
      invoiceNo: r.invoiceNo,
    }));

  const draft = await redis.get<{
    cart?: { sku: string; qty: string }[];
    catalogQtyMap?: Record<string, string>;
    updatedAt?: string;
  }>(`draft:${acct}`);

  let draftSummary: Account360Result["draft"] = null;
  if (draft) {
    const merged = new Map<string, number>();
    for (const item of draft.cart || []) {
      const sku = String(item.sku || "").trim().toUpperCase();
      const q = Number(item.qty) || 0;
      if (sku && q > 0) merged.set(sku, (merged.get(sku) || 0) + q);
    }
    for (const [sku, qty] of Object.entries(draft.catalogQtyMap || {})) {
      const s = String(sku || "").trim().toUpperCase();
      const q = Number(qty) || 0;
      if (s && q > 0) merged.set(s, (merged.get(s) || 0) + q);
    }
    if (merged.size) {
      draftSummary = {
        lineCount: merged.size,
        totalCases: Array.from(merged.values()).reduce((s, q) => s + q, 0),
        updatedAt: draft.updatedAt || "",
      };
    }
  }

  return {
    accountNo: acct,
    customer: customer
      ? {
          storeName: customer.storeName,
          active: customer.active,
          regionLabel: marketRegionLabel(customer.region),
          email: customer.email,
          phone: customer.phone,
        }
      : null,
    health: healthRow
      ? {
          status: healthRow.status,
          statusLabel: healthRow.statusLabel,
          lastInvoiceDate: healthRow.lastInvoiceDate,
          qty90: healthRow.qty90,
          qty90PriorYear: healthRow.qty90PriorYear,
          revenue90: healthRow.revenue90,
          yoyQtyGrowthPct: healthRow.yoyQtyGrowthPct,
        }
      : null,
    recentOrders,
    recentInvoices,
    topSkus,
    draft: draftSummary,
  };
}
