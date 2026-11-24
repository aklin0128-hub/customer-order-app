import { NextResponse } from "next/server";
import { loadInvoiceImports } from "@/lib/analyticsCommon";
import { getCustomerByAccount, normalizeAccountNo } from "@/lib/customers";
import { buildSkuInvoicePricePointsFromImports } from "@/lib/skuInvoicePriceHistory";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountNo = normalizeAccountNo(searchParams.get("accountNo") || "");
    const sku = String(searchParams.get("sku") || "")
      .trim()
      .toUpperCase();

    if (!accountNo) {
      return NextResponse.json({ error: "Missing account number." }, { status: 400 });
    }
    if (!sku) {
      return NextResponse.json({ error: "Missing SKU." }, { status: 400 });
    }

    const customer = await getCustomerByAccount(accountNo);
    if (!customer?.invoicePricing) {
      return NextResponse.json({
        success: true,
        accountNo,
        sku,
        enabled: false,
        points: [],
      });
    }

    const imports = await loadInvoiceImports();
    const points = buildSkuInvoicePricePointsFromImports(imports, accountNo, sku);

    return NextResponse.json({
      success: true,
      accountNo,
      sku,
      enabled: true,
      points,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load SKU price history." },
      { status: 500 }
    );
  }
}
