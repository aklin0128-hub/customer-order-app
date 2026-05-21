import catalogData from "@/data/catalog_sku_master_extracted.json";
import { cleanSku } from "@/lib/analyticsCommon";
import { getAllCustomers } from "@/lib/customers";
import { IMPORT_LIST_KEY, type InvoiceImportRecord } from "@/lib/invoice/invoiceImportRecord";
import { redis } from "@/lib/redis";

export type AdminSearchResult =
  | { type: "account"; accountNo: string; storeName: string; href: string; label?: string }
  | { type: "sku"; sku: string; name: string; href: string; label?: string }
  | { type: "order"; accountNo: string; orderRef: string; createdAt: string; href: string; label?: string }
  | { type: "invoice"; id: string; accountNo: string; invoiceNo: string; href: string; label?: string };

type OrderRecord = {
  accountNo?: string;
  storeName?: string;
  orderRef?: string;
  createdAt?: string;
};

function rankSku(sku: string, name: string, q: string) {
  const su = sku.toUpperCase();
  if (su.startsWith(q)) return 0;
  if (su.includes(q)) return 1;
  if (name.toUpperCase().includes(q)) return 2;
  return 3;
}

async function searchOrders(q: string, limit: number, results: AdminSearchResult[]) {
  const keys = await redis.keys("orderHistory:*");
  const hits: { result: AdminSearchResult; sortKey: string }[] = [];

  for (const key of keys) {
    if (hits.length >= limit * 3) break;
    const accountNo = key.replace(/^orderHistory:/, "").toUpperCase();
    const history = (await redis.get<OrderRecord[]>(key)) || [];

    for (const entry of history) {
      const orderRef = String(entry?.orderRef || "").trim();
      const createdAt = String(entry?.createdAt || "");
      const storeName = String(entry?.storeName || "");
      const hay = `${accountNo} ${orderRef} ${storeName}`.toUpperCase();
      if (!hay.includes(q)) continue;

      hits.push({
        sortKey: createdAt,
        result: {
          type: "order",
          accountNo,
          orderRef: orderRef || "—",
          createdAt,
          href: `/admin/orders?q=${encodeURIComponent(orderRef || accountNo)}`,
          label: "Order",
        },
      });
      if (hits.length >= limit * 3) break;
    }
  }

  hits.sort((a, b) => String(b.sortKey).localeCompare(String(a.sortKey)));
  for (const h of hits.slice(0, limit)) {
    if (results.length >= limit) break;
    results.push(h.result);
  }
}

async function searchInvoices(q: string, limit: number, results: AdminSearchResult[]) {
  const list = (await redis.get<InvoiceImportRecord[]>(IMPORT_LIST_KEY)) || [];
  const hits = list
    .filter((row) => {
      const hay = `${row.id} ${row.accountNo} ${row.invoiceNo || ""} ${row.supplierOrderNo || ""}`.toUpperCase();
      return hay.includes(q);
    })
    .sort((a, b) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")))
    .slice(0, limit);

  for (const row of hits) {
    if (results.length >= limit) break;
    results.push({
      type: "invoice",
      id: row.id,
      accountNo: row.accountNo || "—",
      invoiceNo: row.invoiceNo || row.id.slice(0, 8),
      href: `/admin/invoices?q=${encodeURIComponent(row.invoiceNo || row.accountNo || row.id)}`,
      label: "Invoice",
    });
  }
}

export async function adminSearch(
  query: string,
  limit = 16,
  options?: { types?: AdminSearchResult["type"][] }
): Promise<AdminSearchResult[]> {
  const q = String(query || "").trim().toUpperCase();
  if (q.length < 2) return [];

  const types = options?.types || ["account", "sku", "order", "invoice"];
  const perType = Math.max(3, Math.ceil(limit / types.length));
  const results: AdminSearchResult[] = [];

  if (types.includes("account")) {
    const customers = await getAllCustomers();
    const accountHits: { rank: number; result: AdminSearchResult }[] = [];
    for (const c of customers) {
      if (
        c.accountNo.includes(q) ||
        String(c.storeName || "").toUpperCase().includes(q) ||
        String(c.email || "").toUpperCase().includes(q)
      ) {
        const rank = c.accountNo.startsWith(q) ? 0 : 1;
        accountHits.push({
          rank,
          result: {
            type: "account",
            accountNo: c.accountNo,
            storeName: c.storeName,
            href: `/admin/account?accountNo=${encodeURIComponent(c.accountNo)}`,
            label: "Account",
          },
        });
      }
    }
    accountHits.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.result.type === "account" && b.result.type === "account") {
        return a.result.accountNo.localeCompare(b.result.accountNo);
      }
      return 0;
    });
    for (const h of accountHits.slice(0, perType)) results.push(h.result);
  }

  if (types.includes("sku")) {
    const skuHits: { rank: number; result: AdminSearchResult }[] = [];
    for (const item of catalogData as { sku?: string; name?: string }[]) {
      const sku = cleanSku(item.sku);
      if (!sku) continue;
      const name = String(item.name || "");
      const su = sku.toUpperCase();
      const nu = name.toUpperCase();
      if (!su.includes(q) && !nu.includes(q)) continue;
      skuHits.push({
        rank: rankSku(sku, name, q),
        result: {
          type: "sku",
          sku,
          name,
          href: `/admin/inventory?sku=${encodeURIComponent(sku)}`,
          label: "SKU · Inventory",
        },
      });
    }
    skuHits.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.result.type === "sku" && b.result.type === "sku") {
        return a.result.sku.localeCompare(b.result.sku);
      }
      return 0;
    });
    for (const h of skuHits.slice(0, perType)) {
      if (results.length >= limit) break;
      results.push(h.result);
    }
  }

  if (types.includes("order") && results.length < limit) {
    await searchOrders(q, perType, results);
  }

  if (types.includes("invoice") && results.length < limit) {
    await searchInvoices(q, perType, results);
  }

  return results.slice(0, limit);
}
