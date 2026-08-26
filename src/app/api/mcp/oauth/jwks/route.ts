import { NextResponse } from "next/server";
import { getMcpOAuthJwks } from "@/app/lib/mcp/oauth/crypto";
import { oauthErrorResponse } from "../http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getMcpOAuthJwks(), {
      headers: { "Cache-Control": "public, max-age=300", "Content-Type": "application/json" },
    });
  } catch (error) {
    return oauthErrorResponse(error);
  }
}
