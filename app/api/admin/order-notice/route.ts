import { NextResponse } from "next/server";

import { getOrderNoticeRecord, saveOrderNoticeRecord } from "@/lib/orderNotice";

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
    const record = await getOrderNoticeRecord();
    return NextResponse.json({ success: true, record });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load notice.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const record = await saveOrderNoticeRecord({
      translations: body?.translations,
      title: body?.title,
      body: body?.body,
      enabled: body?.enabled !== false,
      hideOnDate: body?.hideOnDate,
    });
    return NextResponse.json({ success: true, record });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save notice.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
