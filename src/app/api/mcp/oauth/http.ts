import { NextResponse } from "next/server";
import { McpOAuthError } from "@/app/lib/mcp/oauth/validation";

export const OAUTH_NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  Pragma: "no-cache",
};

export function oauthErrorResponse(error: unknown): NextResponse {
  if (error instanceof McpOAuthError) {
    return NextResponse.json(
      { error: error.code, error_description: error.message },
      { status: error.status, headers: OAUTH_NO_STORE_HEADERS },
    );
  }
  return NextResponse.json(
    { error: "server_error", error_description: "Não foi possível concluir a operação OAuth." },
    { status: 500, headers: OAUTH_NO_STORE_HEADERS },
  );
}

export function requestIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
}
