import { NextResponse } from "next/server";
import { checkCompRequest, compUnauthorizedResponse } from "@/lib/compAuth";
import { getInvoiceCompareReport } from "@/lib/invoiceCompareReport";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!checkCompRequest(req)) {
    return compUnauthorizedResponse();
  }

  try {
    const url = new URL(req.url);
    const accountNo = String(url.searchParams.get("accountNo") || "").trim();
    const date = String(url.searchParams.get("date") || "").trim();
    const lookbackRaw = url.searchParams.get("lookbackDays");
    const maxRaw = url.searchParams.get("maxInvoices");
    const lookbackDays = lookbackRaw != null && lookbackRaw !== "" ? Number(lookbackRaw) : undefined;
    const maxInvoices = maxRaw != null && maxRaw !== "" ? Number(maxRaw) : undefined;

    if (!accountNo) {
      return NextResponse.json({ error: "Account number is required." }, { status: 400 });
    }
    if (!date) {
      return NextResponse.json({ error: "Date is required (YYYY-MM-DD)." }, { status: 400 });
    }

    const report = await getInvoiceCompareReport({
      accountNo,
      date,
      lookbackDays,
      maxInvoices,
    });

    return NextResponse.json({ success: true, ...report });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load invoice compare report.";
    const status = /required|YYYY-MM-DD/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
