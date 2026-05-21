import { NextResponse } from "next/server";
import { resolveCustomerOrderEmail } from "@/lib/customerOrderEmail";
import { getCustomerByAccount, normalizeAccountNo, upsertCustomerContact } from "@/lib/customers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountNo = normalizeAccountNo(searchParams.get("accountNo") || "");

    if (!accountNo) {
      return NextResponse.json({ error: "Missing account number." }, { status: 400 });
    }

    const customer = await getCustomerByAccount(accountNo);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      accountNo,
      storeName: customer.storeName,
      orderEmail: resolveCustomerOrderEmail(customer.email),
      phone: customer.phone || "",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load customer profile." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const accountNo = normalizeAccountNo(body?.accountNo || "");

    if (!accountNo) {
      return NextResponse.json({ error: "Missing account number." }, { status: 400 });
    }

    const hasPhone = body?.phone !== undefined && body?.phone !== null;

    if (!hasPhone) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const updated = await upsertCustomerContact(accountNo, {
      phone: String(body.phone || "").trim(),
    });

    return NextResponse.json({
      success: true,
      accountNo,
      orderEmail: updated.orderEmail,
      phone: updated.phone || "",
    });
  } catch (error: any) {
    const message = error?.message || "Failed to save customer profile.";
    const status = message.includes("not found") ? 404 : message.includes("inactive") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
