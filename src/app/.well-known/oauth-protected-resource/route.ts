import { NextResponse } from "next/server";
import {
  getMcpOAuthIssuer,
  getMcpServerUrl,
  getMcpSupportedScopes,
} from "@/app/lib/mcp/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      resource: getMcpServerUrl(),
      authorization_servers: [getMcpOAuthIssuer()],
      scopes_supported: getMcpSupportedScopes(),
      bearer_methods_supported: ["header"],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Content-Type": "application/json",
      },
    },
  );
}
