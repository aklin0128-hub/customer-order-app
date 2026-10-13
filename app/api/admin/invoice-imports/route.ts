import { matchesQuery, paginateList, parseAdminListQuery } from "@/lib/adminListQuery";
import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { bustAnalyticsCache } from "@/lib/analyticsCache";
import {
  deleteInvoiceImport,
  loadInvoiceImportSummaries,
} from "@/lib/invoice/invoiceImportStore";
import { refreshInvoiceLatestPricesCache } from "@/lib/invoiceLatestPrices";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const query = parseAdminListQuery(url, 30);
    const list = await loadInvoiceImportSummaries();

    const unknownSkuSet = new Set<string>();
    let last30Days = 0;
    let missingAccount = 0;
    let zeroLines = 0;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

    for (const row of list) {
      if (new Date(row.uploadedAt).getTime() >= cutoff) last30Days += 1;
      if (!row.accountNo?.trim()) missingAccount += 1;
      if (!row.lineCount) zeroLines += 1;
      for (const sku of row.unknownSkus || []) unknownSkuSet.add(String(sku).toUpperCase());
      for (const line of row.lines || []) {
        if (!line.inCatalog && line.sku) unknownSkuSet.add(line.sku.toUpperCase());
      }
    }

    const filtered = list.filter((row) => {
      const hay = `${row.id} ${row.accountNo} ${row.invoiceNo || ""} ${row.supplierOrderNo || ""}`;
      return matchesQuery(hay, query.q);
    });

    filtered.sort((a, b) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")));

    const summaries = filtered.map(({ lines, unknownSkus, ...rest }) => ({
      ...rest,
      unknownSkuCount:
        unknownSkus?.length ||
        (lines || []).filter((l) => !l.inCatalog && l.sku).length,
    }));

    const page = paginateList(summaries, query);

    return NextResponse.json({
      success: true,
      imports: page.items,
      total: page.total,
      page: page.page,
      totalPages: page.totalPages,
      limit: page.limit,
      quality: {
        total: list.length,
        last30Days,
        missingAccount,
        zeroLines,
        unknownSkus: Array.from(unknownSkuSet).sort(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load imports." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const id = String(url.searchParams.get("id") || "").trim();

    if (!id) {
      return NextResponse.json({ error: "Missing import id." }, { status: 400 });
    }

    const removed = await deleteInvoiceImport(id);

    if (!removed.found || !removed.record) {
      return NextResponse.json({ error: "Invoice import not found." }, { status: 404 });
    }

    let blobDeleteWarning = "";
    if (target.blobUrl) {
      try {
        await del(target.blobUrl);
      } catch (error: any) {
        blobDeleteWarning = error?.message || "Invoice file delete failed.";
      }
    }

    bustAnalyticsCache();
    await refreshInvoiceLatestPricesCache();

    return NextResponse.json({
      success: true,
      deletedId: id,
      warning: blobDeleteWarning || undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete invoice import." },
      { status: 500 }
    );
  }
}
