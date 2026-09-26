import { Receiver } from "@upstash/qstash";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { conciliarEAvisar } from "@/app/lib/billing/stripeReconciliationRun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TAG = "[cron.stripeReconcile]";

/**
 * Todo dia: confere banco × Stripe, corrige o que não tira acesso de ninguém e
 * manda o relatório quando algo pede atenção (e toda segunda, completo).
 */
export async function POST(request: Request) {
  const body = await request.text();
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  const bearer =
    Boolean(process.env.CRON_SECRET) &&
    request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  const signed =
    currentSigningKey &&
    nextSigningKey &&
    (await new Receiver({ currentSigningKey, nextSigningKey })
      .verify({ signature: request.headers.get("upstash-signature") || "", body })
      .catch(() => false));
  if (!bearer && !signed) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    await connectToDatabase();
    const resultado = await conciliarEAvisar();
    logger.info(`${TAG} Conferência concluída.`, resultado);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (error) {
    logger.error(`${TAG} Falha na conferência.`, {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
