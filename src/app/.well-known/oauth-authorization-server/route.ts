import { NextResponse } from "next/server";
import { getMcpOAuthMetadata } from "@/app/lib/mcp/oauth/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getMcpOAuthMetadata(), {
    headers: { "Cache-Control": "public, max-age=300", "Content-Type": "application/json" },
  });
}
