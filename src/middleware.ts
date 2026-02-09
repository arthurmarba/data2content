// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
const AFFILIATE_COOKIE_NAME = "d2c_ref";
const AFFILIATE_CODE_REGEX = /^[A-Z0-9_-]{3,32}$/i;
const MEDIA_KIT_PATH_REGEX = /^\/mediakit\/([^/]+)$/i;

function applyAffiliateCookie(res: NextResponse, refCode: string) {
  if (!refCode) return;
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

function extractMediaKitToken(pathname: string): string | null {
  const match = pathname.match(MEDIA_KIT_PATH_REGEX);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]).trim().toLowerCase();
  } catch {
    return match[1].trim().toLowerCase();
  }
}

export async function middleware(req: NextRequest) {
  const rawRef =
    req.nextUrl.searchParams.get("ref") ||
    req.nextUrl.searchParams.get("aff") ||
    "";
  const refCode =
    rawRef && AFFILIATE_CODE_REGEX.test(rawRef) ? rawRef.trim().toUpperCase() : "";

  if (req.nextUrl.pathname !== "/api/resolve-user-id") {
    const mediaKitToken = extractMediaKitToken(req.nextUrl.pathname);
    if (mediaKitToken) {
      try {
        const resolveUrl = req.nextUrl.clone();
        resolveUrl.pathname = "/api/resolve-user-id";
        resolveUrl.search = "";
        resolveUrl.searchParams.set("slug", mediaKitToken);

        const resolveResponse = await fetch(resolveUrl.toString(), { cache: "no-store" });
        if (resolveResponse.ok) {
          const payload = await resolveResponse.json().catch(() => null);
          const canonicalSlug =
            typeof payload?.canonicalSlug === "string"
              ? payload.canonicalSlug.trim().toLowerCase()
              : "";
          const matchedByAlias = Boolean(payload?.matchedByAlias);

          if (matchedByAlias && canonicalSlug && canonicalSlug !== mediaKitToken) {
            const redirectUrl = req.nextUrl.clone();
            redirectUrl.pathname = `/mediakit/${canonicalSlug}`;
            const redirectResponse = NextResponse.redirect(redirectUrl, 308);
            applyAffiliateCookie(redirectResponse, refCode);
            return redirectResponse;
          }
        }
      } catch {
        // Mantém navegação padrão quando houver falha temporária na resolução.
      }
    }
  }

  const res = NextResponse.next();
  applyAffiliateCookie(res, refCode);
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
