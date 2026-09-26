import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { logger } from "@/app/lib/logger";
import { runPluginWeeklyEmails } from "@/app/lib/plugin/weeklyEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TAG = "[cron.pluginWeeklyEmail]";
const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
const receiver = currentSigningKey && nextSigningKey
  ? new Receiver({ currentSigningKey, nextSigningKey })
  : null;

/** Toda semana: uma pauta do mapa para quem conectou por um chat e não assinou. */
export async function POST(request: NextRequest) {
  if (!receiver) {
    logger.error(`${TAG} QStash signing keys não configuradas.`);
    return NextResponse.json({ error: "Receiver not initialised" }, { status: 500 });
  }
  const signature = request.headers.get("upstash-signature");
  const body = await request.text();
  if (!signature || !(await receiver.verify({ signature, body }).catch(() => false))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  try {
    const result = await runPluginWeeklyEmails({ limit: 50 });
    logger.info(`${TAG} Rotina concluída.`, { ...result, preview: undefined });
    return NextResponse.json({ ok: true, sent: result.sent, skipped: result.skipped, failed: result.failed });
  } catch (error) {
    logger.error(`${TAG} Erro ao executar.`, { error: error instanceof Error ? error.name : "unknown_error" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
