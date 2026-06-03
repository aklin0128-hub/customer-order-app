import { NextResponse } from "next/server";
import { sinceFromDays } from "@/lib/analyticsCommon";
import { getInvoiceLatestPrices, invoiceLatestPricesToCsv } from "@/lib/invoiceLatestPrices";

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
    const format = String(url.searchParams.get("format") || "json").trim().toLowerCase();
    const accountNo = String(url.searchParams.get("accountNo") || "").trim().toUpperCase();
    const days = Number(url.searchParams.get("days") || 0);
    const since = Number.isFinite(days) && days > 0 ? sinceFromDays(days) : null;

    const rows = await getInvoiceLatestPrices({ since, accountNo: accountNo || undefined });

    if (format === "csv") {
      const stamp = new Date().toISOString().slice(0, 10);
      return new NextResponse(invoiceLatestPricesToCsv(rows), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="invoice-latest-prices-${stamp}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      count: rows.length,
      rows,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to export latest prices.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
