import { NextResponse } from "next/server";
import { getAccount360 } from "@/lib/account360";
import { normalizeAccountNo } from "@/lib/customers";

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
    const accountNo = normalizeAccountNo(url.searchParams.get("accountNo") || "");
    if (!accountNo) {
      return NextResponse.json({ error: "Missing account number." }, { status: 400 });
    }

    const data = await getAccount360(accountNo);
    if (!data) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load account." },
      { status: 500 }
    );
  }
}
