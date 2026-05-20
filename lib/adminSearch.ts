import catalogData from "@/data/catalog_sku_master_extracted.json";
import { cleanSku } from "@/lib/analyticsCommon";
import { getAllCustomers } from "@/lib/customers";

export type AdminSearchResult =
  | { type: "account"; accountNo: string; storeName: string; href: string }
  | { type: "sku"; sku: string; name: string; href: string };

export async function adminSearch(query: string, limit = 12): Promise<AdminSearchResult[]> {
  const q = String(query || "").trim().toUpperCase();
  if (q.length < 2) return [];

  const results: AdminSearchResult[] = [];
  const customers = await getAllCustomers();

  for (const c of customers) {
    if (results.length >= limit) break;
    if (
      c.accountNo.includes(q) ||
      String(c.storeName || "").toUpperCase().includes(q)
    ) {
      results.push({
        type: "account",
        accountNo: c.accountNo,
        storeName: c.storeName,
        href: `/admin/account?accountNo=${encodeURIComponent(c.accountNo)}`,
      });
    }
  }

  for (const item of catalogData as { sku?: string; name?: string }[]) {
    if (results.length >= limit) break;
    const sku = cleanSku(item.sku);
    if (!sku) continue;
    if (sku.includes(q) || String(item.name || "").toUpperCase().includes(q)) {
      results.push({
        type: "sku",
        sku,
        name: String(item.name || ""),
        href: `/admin/top-skus?sku=${encodeURIComponent(sku)}`,
      });
    }
  }

  return results.slice(0, limit);
}
