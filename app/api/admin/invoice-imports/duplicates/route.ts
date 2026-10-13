import { NextResponse } from "next/server";
import { listDuplicateInvoiceImports } from "@/lib/invoiceDedup";

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
    const result = await listDuplicateInvoiceImports();
    return NextResponse.json({
      success: true,
      groupCount: result.groupCount,
      extraCount: result.extraCount,
      groups: result.groups,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to check duplicate invoices.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
