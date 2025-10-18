import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/app/lib/logger";
import processWhatsappTrials from "@/app/lib/cron/processWhatsappTrials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  try {
    const result = await processWhatsappTrials();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    logger.error("[api.cron.whatsappTrial] Falha ao processar", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: "Method Not Allowed" },
    { status: 405, headers: { Allow: "POST" } }
  );
}
