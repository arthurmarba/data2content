/**
 * GET /api/cron/weekly-map-summary
 *
 * Triggered weekly (e.g. every Monday 08:00 BRT) by QStash.
 * Finds creators who have at least one reading and haven't received
 * a weekly map summary in the past 6 days, then generates one for each
 * using GPT-4o-mini via weeklyMapSummaryService.
 *
 * Processing is synchronous and capped at 50 users per invocation
 * to stay within serverless timeout. For larger user bases, switch to
 * the fan-out pattern used by refresh-instagram-data.
 */

import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { generateWeeklyMapSummaryForUser } from "@/app/dashboard/boards/videoUpload/weeklyMapSummaryService";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

let receiver: Receiver | null = null;
if (currentSigningKey && nextSigningKey) {
  receiver = new Receiver({ currentSigningKey, nextSigningKey });
}

const BATCH_SIZE = 50;
const SIX_DAYS_AGO = () => new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);

export async function POST(request: NextRequest) {
  if (!isMobileStrategicProfileEnabled()) {
    return NextResponse.json({ message: "Recurso não habilitado." }, { status: 404 });
  }

  // Verify QStash signature (skip in development)
  if (process.env.NODE_ENV !== "development" && receiver) {
    const signature = request.headers.get("upstash-signature") ?? "";
    const body = await request.text();
    const isValid = await receiver.verify({ signature, body }).catch(() => false);
    if (!isValid) {
      logger.warn("[Cron WeeklyMapSummary] Assinatura QStash inválida.");
      return NextResponse.json({ message: "Assinatura inválida." }, { status: 401 });
    }
  }

  logger.info("[Cron WeeklyMapSummary] Iniciando geração de resumos semanais.");

  try {
    await connectToDatabase();

    // Find eligible users: have readings, summary is stale or never generated
    const sixDaysAgo = SIX_DAYS_AGO();
    const users = await User.find({
      "mobileStrategicProfile.synthesis.analyzedReadingsCount": { $gt: 0 },
      $or: [
        { weeklyMapSummaryGeneratedAt: { $exists: false } },
        { weeklyMapSummaryGeneratedAt: null },
        { weeklyMapSummaryGeneratedAt: { $lte: sixDaysAgo } },
      ],
    })
      .select("_id")
      .limit(BATCH_SIZE)
      .lean<Array<{ _id: { toString(): string } }>>();

    logger.info(`[Cron WeeklyMapSummary] ${users.length} usuários elegíveis encontrados.`);

    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of users) {
      const result = await generateWeeklyMapSummaryForUser(user._id.toString());
      if (result.ok) generated++;
      else if (result.skipped) skipped++;
      else failed++;
    }

    logger.info(
      `[Cron WeeklyMapSummary] Concluído. Gerados: ${generated}, Pulados: ${skipped}, Falhas: ${failed}.`,
    );

    return NextResponse.json({ ok: true, generated, skipped, failed });
  } catch (err) {
    logger.error("[Cron WeeklyMapSummary] Erro:", err);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}

// Allow GET for manual triggering in development
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
  }
  return POST(request);
}
