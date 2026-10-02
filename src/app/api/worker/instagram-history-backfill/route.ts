/**
 * POST /api/worker/instagram-history-backfill
 *
 * Um passo do histórico antigo do Instagram, puxado na conexão: posts além da
 * janela da sincronização periódica e os 30 dias de seguidores anteriores. Só
 * chamadas ao Instagram — nenhuma leitura de IA. A decisão do próximo passo mora
 * em `historyBackfillQueue`.
 */
import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import mongoose from "mongoose";
import { logger } from "@/app/lib/logger";
import { processInstagramHistoryBackfillJob } from "@/app/lib/instagram/historyBackfillQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TAG = "[Worker InstagramHistoryBackfill]";
const receiver = process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY
  ? new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
    })
  : null;

async function autorizado(request: NextRequest, body: string): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return true;
  if (process.env.CRON_SECRET && request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`) return true;
  if (!receiver) return false;
  return receiver.verify({ signature: request.headers.get("upstash-signature") || "", body }).catch(() => false);
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!(await autorizado(request, body))) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  let payload: { userId?: unknown; after?: unknown; attempt?: unknown };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
  }
  const userId = typeof payload.userId === "string" ? payload.userId : "";
  if (!mongoose.isValidObjectId(userId)) {
    return NextResponse.json({ message: "userId inválido." }, { status: 400 });
  }

  try {
    const result = await processInstagramHistoryBackfillJob({
      userId,
      after: typeof payload.after === "string" ? payload.after : null,
      attempt: typeof payload.attempt === "number" ? payload.attempt : 0,
    });
    return NextResponse.json(result);
  } catch (error) {
    logger.error(`${TAG} falhou para ${userId}.`, error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Erro." }, { status: 500 });
  }
}
