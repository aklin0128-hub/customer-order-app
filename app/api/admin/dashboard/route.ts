import { NextResponse } from "next/server";
import { getAdminDashboard } from "@/lib/adminDashboard";

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
    const data = await getAdminDashboard();
    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load dashboard." },
      { status: 500 }
    );
  }
}
