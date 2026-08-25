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
      version: "0.2.0",
      capabilities: ["period_analysis", "content_detail", "data_coverage", "oauth_step_up"],
      classificationProvider: process.env.LLM_PROVIDER_CLASSIFICATION || "gemini",
      authConfigured: externalOAuthConfigured || selfHostedOAuthConfigured,
      oauthMode: selfHostedOAuthConfigured ? "self_hosted" : externalOAuthConfigured ? "external" : "unconfigured",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
