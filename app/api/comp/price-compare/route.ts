import { NextResponse } from "next/server";
import { buildCatalogMap } from "@/lib/analyticsCommon";
import { buildAccountPriceCompareReport, parseAccountPriceCompareList } from "@/lib/accountPriceCompare";
import { checkCompRequest, compUnauthorizedResponse } from "@/lib/compAuth";
import { invoiceCompareAccountsMatch } from "@/lib/invoiceCompareCsv";
import { getInvoiceLatestPrices } from "@/lib/invoiceLatestPrices";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!checkCompRequest(req)) {
    return compUnauthorizedResponse();
  }

  try {
    const url = new URL(req.url);
    const fromList = String(url.searchParams.get("accounts") || "")
      .split(",")
      .map((part) => part.trim());
    const fromRepeat = url.searchParams.getAll("account").map((part) => String(part || "").trim());
    const accounts = parseAccountPriceCompareList([...fromList, ...fromRepeat]);

    if (accounts.length === 0) {
      return NextResponse.json({ error: "Choose at least one customer account." }, { status: 400 });
    }

    const prices = (await getInvoiceLatestPrices()).filter((row) =>
      accounts.some((account) => invoiceCompareAccountsMatch(row.account, account))
    );
    const skus = [...new Set(prices.map((row) => String(row.sku || "").trim().toUpperCase()).filter(Boolean))];
    const catalog = await buildCatalogMap(skus);
    const report = buildAccountPriceCompareReport({ accounts, prices, catalog });

    return NextResponse.json({ success: true, ...report });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load price compare.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
