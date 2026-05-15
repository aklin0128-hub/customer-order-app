import { NextResponse } from "next/server";
import { IMPORT_LIST_KEY, type InvoiceImportRecord } from "@/lib/invoice/invoiceImportRecord";
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
    const list = (await redis.get<InvoiceImportRecord[]>(IMPORT_LIST_KEY)) || [];
    return NextResponse.json({ success: true, imports: list });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load imports." },
      { status: 500 }
    );
  }
}
