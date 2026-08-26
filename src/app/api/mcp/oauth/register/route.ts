import { NextRequest, NextResponse } from "next/server";
import { registerMcpOAuthClient } from "@/app/lib/mcp/oauth/service";
import { checkRateLimit } from "@/utils/rateLimit";
import { OAUTH_NO_STORE_HEADERS, oauthErrorResponse, requestIp } from "../http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(`mcp_oauth_register:${requestIp(request)}`, 30, 3600);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "temporarily_unavailable", error_description: "Limite de registros OAuth excedido." },
        { status: 429, headers: { ...OAUTH_NO_STORE_HEADERS, "Retry-After": "3600" } },
      );
    }
    const input = await request.json();
    const client = await registerMcpOAuthClient(input);
    return NextResponse.json(client, { status: 201, headers: OAUTH_NO_STORE_HEADERS });
  } catch (error) {
    return oauthErrorResponse(error);
  }
}
