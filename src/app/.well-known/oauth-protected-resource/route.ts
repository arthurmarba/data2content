import { NextResponse } from "next/server";
import {
  getMcpAppBaseUrl,
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
      resource_name: "Data2Content",
      resource_documentation: `${getMcpAppBaseUrl()}/politica-de-privacidade`,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Content-Type": "application/json",
      },
    },
  );
}
