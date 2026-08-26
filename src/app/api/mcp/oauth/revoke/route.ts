import { NextRequest, NextResponse } from "next/server";
import { revokeMcpRefreshToken } from "@/app/lib/mcp/oauth/service";
import { McpOAuthError } from "@/app/lib/mcp/oauth/validation";
import { OAUTH_NO_STORE_HEADERS, oauthErrorResponse } from "../http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const form = new URLSearchParams(await request.text());
    const token = form.get("token");
    const clientId = form.get("client_id");
    if (!token || !clientId || token.length > 300 || clientId.length > 200) {
      throw new McpOAuthError("invalid_request", 400, "token e client_id são obrigatórios.");
    }
    await revokeMcpRefreshToken(token, clientId);
    return new NextResponse(null, { status: 200, headers: OAUTH_NO_STORE_HEADERS });
  } catch (error) {
    return oauthErrorResponse(error);
  }
}
