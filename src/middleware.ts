// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
const AFFILIATE_COOKIE_NAME = "d2c_ref";
const AFFILIATE_CODE_REGEX = /^[A-Z0-9_-]{3,32}$/i;
const MEDIA_KIT_PATH_REGEX = /^\/mediakit\/([^/]+)$/i;
const CURRENT_PATH_HEADER = "x-d2c-current-path";
const MOBILE_PROFILE_ROUTE = "/dashboard/boards/mobile-strategic-profile";
const MOBILE_DASHBOARD_ENTRY_PATHS = new Set(["/", "/dashboard", "/dashboard/home"]);
const MOBILE_USER_AGENT_REGEX =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

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

function isMobileStrategicProfileEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_ENABLED === "1" ||
    env.MOBILE_STRATEGIC_PROFILE_SERVER_ENABLED === "1"
  );
}

export function isMobileDashboardEntryPath(pathname?: string | null): boolean {
  return MOBILE_DASHBOARD_ENTRY_PATHS.has(pathname || "");
}

export function isMobileRequestSignal(headers: Pick<Headers, "get">): boolean {
  const secChUaMobile = headers.get("sec-ch-ua-mobile");
  if (secChUaMobile?.trim() === "?1") return true;
  return MOBILE_USER_AGENT_REGEX.test(headers.get("user-agent") || "");
}

export function shouldRedirectMobileDashboardEntry({
  appEnabled,
  headers,
  pathname,
  searchParams,
}: {
  appEnabled: boolean;
  headers: Pick<Headers, "get">;
  pathname?: string | null;
  searchParams: URLSearchParams;
}): boolean {
  if (!appEnabled) return false;
  if (!isMobileDashboardEntryPath(pathname)) return false;
  if (!isMobileRequestSignal(headers)) return false;
  if (searchParams.get("board") === "post-creation") return false;

  const printParam = searchParams.get("print");
  if (printParam === "1" || printParam === "true") return false;

  return true;
}

function createMobileDashboardEntryRedirect(req: NextRequest): NextResponse | null {
  if (
    !shouldRedirectMobileDashboardEntry({
      appEnabled: isMobileStrategicProfileEnabled(),
      headers: req.headers,
      pathname: req.nextUrl.pathname,
      searchParams: req.nextUrl.searchParams,
    })
  ) {
    return null;
  }

  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = MOBILE_PROFILE_ROUTE;
  return NextResponse.redirect(redirectUrl, 307);
}

function createForwardedRequestHeaders(req: NextRequest): Headers {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(CURRENT_PATH_HEADER, `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return requestHeaders;
}

export async function middleware(req: NextRequest) {
  const rawRef =
    req.nextUrl.searchParams.get("ref") ||
    req.nextUrl.searchParams.get("aff") ||
    "";
  const refCode =
    rawRef && AFFILIATE_CODE_REGEX.test(rawRef) ? rawRef.trim().toUpperCase() : "";

  const mobileEntryRedirect = createMobileDashboardEntryRedirect(req);
  if (mobileEntryRedirect) {
    applyAffiliateCookie(mobileEntryRedirect, refCode);
    return mobileEntryRedirect;
  }

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

  const res = NextResponse.next({
    request: {
      headers: createForwardedRequestHeaders(req),
    },
  });
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
