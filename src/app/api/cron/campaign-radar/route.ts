import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runCampaignRadarCollection } from "@/app/lib/campaignRadar/runCollection";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try { return NextResponse.json(await runCampaignRadarCollection(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Falha na coleta do Radar." }, { status: 500 }); }
}
