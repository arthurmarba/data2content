import { NextRequest, NextResponse } from "next/server";
import {
  exchangeMcpAuthorizationCode,
  exchangeMcpRefreshToken,
} from "@/app/lib/mcp/oauth/service";
import { McpOAuthError } from "@/app/lib/mcp/oauth/validation";
import { checkRateLimit } from "@/utils/rateLimit";
import { OAUTH_NO_STORE_HEADERS, oauthErrorResponse, requestIp } from "../http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/x-www-form-urlencoded")) {
      throw new McpOAuthError("invalid_request", 400, "Use application/x-www-form-urlencoded.");
    }
    const rate = await checkRateLimit(`mcp_oauth_token:${requestIp(request)}`, 120, 60);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "temporarily_unavailable", error_description: "Muitas tentativas de token." },
        { status: 429, headers: { ...OAUTH_NO_STORE_HEADERS, "Retry-After": "60" } },
      );
    }
    const form = new URLSearchParams(await request.text());
    const grantType = form.get("grant_type");
    const response = grantType === "authorization_code"
      ? await exchangeMcpAuthorizationCode(form)
      : grantType === "refresh_token"
        ? await exchangeMcpRefreshToken(form)
        : (() => { throw new McpOAuthError("unsupported_grant_type", 400, "grant_type não suportado."); })();
    return NextResponse.json(response, { headers: OAUTH_NO_STORE_HEADERS });
  } catch (error) {
    return oauthErrorResponse(error);
  }
}
