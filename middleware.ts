import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkAdminRequest, getAdminPassword } from "@/lib/adminAuth";
import { checkCompRequest } from "@/lib/compAuth";
import { checkExpRequest } from "@/lib/expAuth";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith("/api/exp")) {
    if (path === "/api/exp/verify") {
      return NextResponse.next();
    }
    if (!checkExpRequest(request)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (path.startsWith("/api/comp")) {
    if (path === "/api/comp/verify") {
      return NextResponse.next();
    }
    if (!checkCompRequest(request)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!path.startsWith("/api/admin")) {
    return NextResponse.next();
  }

  if (path === "/api/admin/verify") {
    return NextResponse.next();
  }

  if (path === "/api/admin/analytics-snapshot" && request.method === "POST") {
    const secret = request.nextUrl.searchParams.get("secret") || request.headers.get("x-cron-secret");
    const expected = process.env.CRON_SECRET || getAdminPassword();
    if (secret && secret === expected) {
      return NextResponse.next();
    }
  }

  if (!checkAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/admin/:path*", "/api/exp/:path*", "/api/comp/:path*"],
};
