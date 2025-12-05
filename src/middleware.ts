// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
const AFFILIATE_COOKIE_NAME = "d2c_ref";
const AFFILIATE_CODE_REGEX = /^[A-Z0-9_-]{3,32}$/i;

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const rawRef =
    req.nextUrl.searchParams.get("ref") ||
    req.nextUrl.searchParams.get("aff") ||
    "";
  const refCode =
    rawRef && AFFILIATE_CODE_REGEX.test(rawRef) ? rawRef.trim().toUpperCase() : "";

  if (refCode) {
    res.cookies.set(AFFILIATE_COOKIE_NAME, refCode, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge:
        Number(process.env.AFFILIATE_ATTRIBUTION_WINDOW_DAYS || 90) *
        24 *
        60 *
        60,
    });
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/public (public API routes)
     * - publi-share (public share pages)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/public|publi-share|.*\\..*).*)",
  ],
};