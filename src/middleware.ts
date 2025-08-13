import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { guardPremiumRequest } from "@/app/lib/planGuard";

const AFFILIATE_COOKIE_NAME = "d2c_ref";
const AFFILIATE_CODE_REGEX = /^[A-Z0-9_-]{3,32}$/i;

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const rawRef =
    req.nextUrl.searchParams.get("ref") ||
    req.nextUrl.searchParams.get("aff") ||
    "";
  const refCode = rawRef && AFFILIATE_CODE_REGEX.test(rawRef) ? rawRef.toUpperCase() : "";

  const setAffiliateCookie = (response: NextResponse) => {
    if (refCode) {
      response.cookies.set(AFFILIATE_COOKIE_NAME, refCode, {
        path: "/",
        httpOnly: false, // permite leitura no client para autofill
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: Number(process.env.AFFILIATE_ATTRIBUTION_WINDOW_DAYS || 90) * 24 * 60 * 60,
        // domain: process.env.COOKIE_DOMAIN || undefined, // descomente se usar subdomínios
      });
    }
    return response;
  };

  setAffiliateCookie(res);

  const guardPrefixes = [
    "/api/whatsapp/generateCode",
    "/api/whatsapp/sendTips",
    "/api/whatsapp/verify",
    "/api/whatsapp/weeklyReport",
    "/api/ai",
  ];

  if (guardPrefixes.some((p) => req.nextUrl.pathname.startsWith(p))) {
    const guardResponse = await guardPremiumRequest(req);
    if (guardResponse) {
      return setAffiliateCookie(guardResponse);
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
    "/api/whatsapp/generateCode/:path*",
    "/api/whatsapp/sendTips/:path*",
    "/api/whatsapp/verify/:path*",
    "/api/whatsapp/weeklyReport/:path*",
    "/api/ai/:path*",
  ],
};
