import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { logger } from "@/app/lib/logger";
import { sendMcpUsageWeeklyDigest } from "@/app/lib/mcp/usageWeeklyDigest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TAG = "[cron.mcpUsageWeekly]";
const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
const receiver = currentSigningKey && nextSigningKey
  ? new Receiver({ currentSigningKey, nextSigningKey })
  : null;

/** Toda segunda: resumo interno do uso do conector na semana anterior. */
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
    const result = await sendMcpUsageWeeklyDigest();
    logger.info(`${TAG} Resumo semanal processado.`, result);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error(`${TAG} Erro ao montar ou enviar o resumo.`, { error: error instanceof Error ? error.name : "unknown_error" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
