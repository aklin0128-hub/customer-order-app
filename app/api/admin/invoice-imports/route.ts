import { matchesQuery, paginateList, parseAdminListQuery } from "@/lib/adminListQuery";
import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { IMPORT_LIST_KEY, type InvoiceImportRecord } from "@/lib/invoice/invoiceImportRecord";
import { bustAnalyticsCache } from "@/lib/analyticsCache";
import { redis } from "@/lib/redis";

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
    const list = (await redis.get<InvoiceImportRecord[]>(IMPORT_LIST_KEY)) || [];

    const unknownSkuSet = new Set<string>();
    let last30Days = 0;
    let missingAccount = 0;
    let zeroLines = 0;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

    for (const row of list) {
      if (new Date(row.uploadedAt).getTime() >= cutoff) last30Days += 1;
      if (!row.accountNo?.trim()) missingAccount += 1;
      if (!row.lineCount) zeroLines += 1;
      for (const line of row.lines || []) {
        if (!line.inCatalog && line.sku) unknownSkuSet.add(line.sku.toUpperCase());
      }
    }

    const filtered = list.filter((row) => {
      const hay = `${row.id} ${row.accountNo} ${row.invoiceNo || ""} ${row.supplierOrderNo || ""}`;
      return matchesQuery(hay, query.q);
    });

    filtered.sort((a, b) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")));

    const summaries = filtered.map(({ lines, ...rest }) => ({
      ...rest,
      unknownSkuCount: (lines || []).filter((l) => !l.inCatalog && l.sku).length,
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

    const list = (await redis.get<InvoiceImportRecord[]>(IMPORT_LIST_KEY)) || [];
    const target = list.find((item) => item.id === id);

    if (!target) {
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

    await redis.set(
      IMPORT_LIST_KEY,
      list.filter((item) => item.id !== id)
    );
    bustAnalyticsCache();

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
