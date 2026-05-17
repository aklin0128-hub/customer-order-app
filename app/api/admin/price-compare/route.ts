import { NextResponse } from "next/server";
import catalogData from "@/data/catalog_sku_master_extracted.json";
import { IMPORT_LIST_KEY, type InvoiceImportRecord } from "@/lib/invoice/invoiceImportRecord";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

type Product = {
  sku: string;
  name?: string;
  brand?: string;
  status?: string;
};

type PricePoint = {
  accountNo: string;
  sku: string;
  invoiceNo: string | null;
  invoiceDate: string;
  uploadedAt: string;
  qty: number;
  price: number;
  importId: string;
};

type PurchasePoint = Omit<PricePoint, "price"> & {
  price: number | null;
};

type OrderHistoryEntry = {
  accountNo?: string;
  createdAt?: string;
  items?: { sku?: string; qty?: string | number }[];
};

type RecentEntry = {
  sku?: string;
  qty?: string | number;
  lastOrderedAt?: string;
};

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

function cleanSku(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function skuAlias(value: unknown) {
  return cleanSku(value).replace(/^0+(?=\d)/, "");
}

function parseDate(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return null;

  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (us) {
    const y = Number(us[3].length === 2 ? `20${us[3]}` : us[3]);
    const m = Number(us[1]) - 1;
    const d = Number(us[2]);
    const date = new Date(Date.UTC(y, m, d, 12));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function displayDate(invoiceDate: string | null, uploadedAt: string) {
  const date = parseDate(invoiceDate) || parseDate(uploadedAt);
  return date ? date.toISOString().slice(0, 10) : "";
}

function priceForLine(line: InvoiceImportRecord["lines"][number]) {
  if (typeof line.unitPrice === "number" && Number.isFinite(line.unitPrice)) return line.unitPrice;
  return null;
}

async function getProductMap(skus: string[]) {
  const wanted = new Set(skus.map(cleanSku).filter(Boolean));
  const wantedAliases = new Set(Array.from(wanted).map(skuAlias).filter(Boolean));
  const map = new Map<string, Product>();

  for (const item of catalogData as Product[]) {
    const sku = cleanSku(item.sku);
    const alias = skuAlias(sku);
    if (!sku || (!wanted.has(sku) && !wantedAliases.has(alias))) continue;

    const product = { ...item, sku };
    map.set(sku, product);
    map.set(alias, product);
    for (const wantedSku of wanted) {
      if (skuAlias(wantedSku) === alias) map.set(wantedSku, product);
    }
  }

  const redisItems = await Promise.all(
    Array.from(wanted).map((sku) => redis.get<Product>(`product:${sku}`))
  );

  for (const item of redisItems) {
    const sku = cleanSku(item?.sku);
    if (!sku) continue;
    const alias = skuAlias(sku);
    const product = { ...(map.get(sku) || map.get(alias) || { sku }), ...item, sku };
    map.set(sku, product);
    map.set(alias, product);
  }

  return map;
}

function pctChange(latest?: number, previous?: number) {
  if (latest === undefined || previous === undefined || previous === 0) return null;
  return ((latest - previous) / previous) * 100;
}

export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const mode = String(url.searchParams.get("mode") || "price").trim();
    const accountNo = String(url.searchParams.get("accountNo") || "").trim().toUpperCase();
    const skuQuery = cleanSku(url.searchParams.get("sku"));
    const days = Number(url.searchParams.get("days") || 0);
    const since =
      Number.isFinite(days) && days > 0
        ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        : null;

    const imports = (await redis.get<InvoiceImportRecord[]>(IMPORT_LIST_KEY)) || [];
    const points: PricePoint[] = [];
    const purchasePoints: PurchasePoint[] = [];
    const skuQueryAlias = skuAlias(skuQuery);

    for (const record of imports) {
      const acct = String(record.accountNo || "").trim().toUpperCase();
      if (!acct) continue;
      if (accountNo && acct !== accountNo) continue;

      const effectiveDate = parseDate(record.invoiceDate) || parseDate(record.uploadedAt);
      if (since && effectiveDate && effectiveDate < since) continue;

      for (const line of record.lines || []) {
        const sku = cleanSku(line.sku);
        if (!sku) continue;
        if (skuQuery && sku !== skuQuery && skuAlias(sku) !== skuQueryAlias) continue;

        const price = priceForLine(line);
        const purchasePoint: PurchasePoint = {
          accountNo: acct,
          sku,
          invoiceNo: record.invoiceNo,
          invoiceDate: displayDate(record.invoiceDate, record.uploadedAt),
          uploadedAt: record.uploadedAt,
          qty: Number(line.qty) || 0,
          price,
          importId: record.id,
        };

        purchasePoints.push(purchasePoint);
        if (price !== null) points.push({ ...purchasePoint, price });
      }
    }

    const buyerImportPoints: PurchasePoint[] = [];
    if (skuQuery && mode === "buyers") {
      for (const record of imports) {
        const acct = String(record.accountNo || "").trim().toUpperCase();
        if (!acct) continue;

        for (const line of record.lines || []) {
          const sku = cleanSku(line.sku);
          if (!sku) continue;
          if (sku !== skuQuery && skuAlias(sku) !== skuQueryAlias) continue;

          const price = priceForLine(line);
          buyerImportPoints.push({
            accountNo: acct,
            sku,
            invoiceNo: record.invoiceNo,
            invoiceDate: displayDate(record.invoiceDate, record.uploadedAt),
            uploadedAt: record.uploadedAt,
            qty: Number(line.qty) || 0,
            price,
            importId: record.id,
          });
        }
      }
    }

    const orderPurchasePoints: PurchasePoint[] = [];
    if (skuQuery && mode === "buyers") {
      const historyKeys = await redis.keys("orderHistory:*");
      const histories = await Promise.all(
        historyKeys.map(async (key) => ({
          accountNo: key.replace(/^orderHistory:/, "").toUpperCase(),
          entries: (await redis.get<OrderHistoryEntry[]>(key)) || [],
        }))
      );

      for (const { accountNo: keyAccountNo, entries } of histories) {
        for (const entry of entries) {
          const entryAccountNo = String(entry.accountNo || keyAccountNo).trim().toUpperCase();
          if (!entryAccountNo) continue;

          for (const item of entry.items || []) {
            const itemSku = cleanSku(item.sku);
            if (!itemSku) continue;
            if (itemSku !== skuQuery && skuAlias(itemSku) !== skuQueryAlias) continue;

            orderPurchasePoints.push({
              accountNo: entryAccountNo,
              sku: itemSku,
              invoiceNo: null,
              invoiceDate: displayDate(null, entry.createdAt || ""),
              uploadedAt: entry.createdAt || "",
              qty: Number(String(item.qty || "").replace(/[^0-9]/g, "")) || 0,
              price: null,
              importId: "",
            });
          }
        }
      }

      if (orderPurchasePoints.length === 0) {
        const recentKeys = await redis.keys("recentItems:*");
        const recentLists = await Promise.all(
          recentKeys.map(async (key) => ({
            accountNo: key.replace(/^recentItems:/, "").toUpperCase(),
            entries: (await redis.get<RecentEntry[]>(key)) || [],
          }))
        );

        for (const { accountNo: recentAccountNo, entries } of recentLists) {
          for (const entry of entries) {
            const itemSku = cleanSku(entry.sku);
            if (!itemSku) continue;
            if (itemSku !== skuQuery && skuAlias(itemSku) !== skuQueryAlias) continue;

            orderPurchasePoints.push({
              accountNo: recentAccountNo,
              sku: itemSku,
              invoiceNo: null,
              invoiceDate: displayDate(null, entry.lastOrderedAt || ""),
              uploadedAt: entry.lastOrderedAt || "",
              qty: Number(String(entry.qty || "").replace(/[^0-9]/g, "")) || 0,
              price: null,
              importId: "",
            });
          }
        }
      }
    }

    const productMap = await getProductMap(
      Array.from(new Set([...purchasePoints.map((p) => p.sku), ...buyerImportPoints.map((p) => p.sku), ...orderPurchasePoints.map((p) => p.sku), skuQuery].filter(Boolean)))
    );

    const accountRows = Array.from(
      points.reduce((map, point) => {
        if (!accountNo) return map;
        const list = map.get(point.sku) || [];
        list.push(point);
        map.set(point.sku, list);
        return map;
      }, new Map<string, PricePoint[]>())
    )
      .map(([sku, list]) => {
        const sorted = list.sort((a, b) =>
          (parseDate(b.invoiceDate)?.getTime() || 0) - (parseDate(a.invoiceDate)?.getTime() || 0) ||
          (parseDate(b.uploadedAt)?.getTime() || 0) - (parseDate(a.uploadedAt)?.getTime() || 0)
        );
        const latest = sorted[0];
        const previous = sorted[1];
        const product = productMap.get(sku);

        return {
          sku,
          name: product?.name || "",
          brand: product?.brand || "",
          status: product?.status || "",
          latestPrice: latest?.price ?? null,
          previousPrice: previous?.price ?? null,
          changePct: pctChange(latest?.price, previous?.price),
          latestDate: latest?.invoiceDate || "",
          previousDate: previous?.invoiceDate || "",
          invoiceNo: latest?.invoiceNo || "",
          importId: latest?.importId || "",
          history: sorted,
        };
      })
      .sort((a, b) => {
        const ac = Math.abs(a.changePct ?? -1);
        const bc = Math.abs(b.changePct ?? -1);
        return bc - ac || a.sku.localeCompare(b.sku);
      });

    const buyerSourcePoints = mode === "buyers"
      ? orderPurchasePoints.length > 0 ? orderPurchasePoints : buyerImportPoints
      : [];
    const buyerRows = Array.from(
      buyerSourcePoints.reduce((map, point) => {
        if (!skuQuery) return map;
        const existing = map.get(point.accountNo) || {
          accountNo: point.accountNo,
          totalQty: 0,
          invoiceCount: 0,
          latestPrice: point.price,
          latestDate: point.invoiceDate,
        };
        existing.totalQty += point.qty;
        existing.invoiceCount += 1;

        const existingDate = parseDate(existing.latestDate)?.getTime() || 0;
        const pointDate = parseDate(point.invoiceDate)?.getTime() || 0;
        if (pointDate >= existingDate) {
          existing.latestPrice = point.price;
          existing.latestDate = point.invoiceDate;
        }

        map.set(point.accountNo, existing);
        return map;
      }, new Map<string, { accountNo: string; totalQty: number; invoiceCount: number; latestPrice: number | null; latestDate: string }>())
        .values()
    ).sort((a, b) => b.totalQty - a.totalQty);

    const skuProduct = skuQuery ? productMap.get(skuQuery) : null;

    return NextResponse.json({
      success: true,
      filters: { mode, accountNo, sku: skuQuery, days: days || null },
      accountRows,
      buyerRows,
      skuProduct: skuProduct ? { ...skuProduct, sku: skuQuery } : skuQuery ? { sku: skuQuery } : null,
      pointCount: purchasePoints.length,
      pricedPointCount: points.length,
      importCount: imports.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load price comparison." },
      { status: 500 }
    );
  }
}
