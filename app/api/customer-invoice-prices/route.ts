import { NextResponse } from "next/server";
import { getCustomerInvoicePricesForOrder } from "@/lib/customerInvoicePricing";
import { normalizeAccountNo } from "@/lib/customers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountNo = normalizeAccountNo(searchParams.get("accountNo") || "");

    if (!accountNo) {
      return NextResponse.json({ error: "Missing account number." }, { status: 400 });
    }

    const result = await getCustomerInvoicePricesForOrder(accountNo);

    return NextResponse.json({
      success: true,
      accountNo,
      enabled: result.enabled,
      prices: result.prices,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load invoice prices." },
      { status: 500 }
    );
  }
}
