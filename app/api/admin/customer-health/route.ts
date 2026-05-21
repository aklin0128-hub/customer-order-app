import { NextResponse } from "next/server";
import { getCustomerHealth } from "@/lib/customerHealth";

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
    const result = await getCustomerHealth();
    const res = NextResponse.json({ success: true, ...result });
    res.headers.set("Cache-Control", "private, max-age=300");
    return res;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load customer health." },
      { status: 500 }
    );
  }
}
