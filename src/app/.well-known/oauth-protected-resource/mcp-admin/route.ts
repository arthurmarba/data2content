import { NextResponse } from "next/server";
import {
  getMcpAdminServerUrl,
  getMcpAdminSupportedScopes,
  getMcpOAuthIssuer,
} from "@/app/lib/mcp/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      resource: getMcpAdminServerUrl(),
      authorization_servers: [getMcpOAuthIssuer()],
      scopes_supported: getMcpAdminSupportedScopes(),
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
