import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const externalOAuthConfigured = Boolean(
    process.env.MCP_OAUTH_ISSUER && process.env.MCP_OAUTH_AUDIENCE && process.env.MCP_OAUTH_JWKS_URL,
  );
  const selfHostedOAuthConfigured = Boolean(process.env.MCP_OAUTH_PRIVATE_JWK);

  return NextResponse.json(
    {
      ok: true,
      service: "data2content-mcp",
      version: "0.1.0",
      authConfigured: externalOAuthConfigured || selfHostedOAuthConfigured,
      oauthMode: selfHostedOAuthConfigured ? "self_hosted" : externalOAuthConfigured ? "external" : "unconfigured",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
