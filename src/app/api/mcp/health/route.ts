import { NextResponse } from "next/server";
import { isMcpAdminEnabled, isMcpCampaignRadarEnabled } from "@/app/lib/mcp/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const campaignRadarEnabled = isMcpCampaignRadarEnabled();
  const externalOAuthConfigured = Boolean(
    process.env.MCP_OAUTH_ISSUER && process.env.MCP_OAUTH_AUDIENCE && process.env.MCP_OAUTH_JWKS_URL,
  );
  const selfHostedOAuthConfigured = Boolean(process.env.MCP_OAUTH_PRIVATE_JWK);

  return NextResponse.json(
    {
      ok: true,
      service: "data2content-mcp",
      version: campaignRadarEnabled ? "0.9.0" : "0.8.0",
      adminMcpEnabled: isMcpAdminEnabled(),
      campaignRadarEnabled,
      authConfigured: externalOAuthConfigured || selfHostedOAuthConfigured,
      oauthMode: selfHostedOAuthConfigured ? "self_hosted" : externalOAuthConfigured ? "external" : "unconfigured",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
