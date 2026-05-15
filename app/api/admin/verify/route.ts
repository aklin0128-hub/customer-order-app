import { NextResponse } from "next/server";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const password = String(body?.password || "").trim();

    if (!password) {
      return NextResponse.json({ error: "Password required." }, { status: 400 });
    }

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Invalid admin password." }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Verification failed." },
      { status: 500 }
    );
  }
}
