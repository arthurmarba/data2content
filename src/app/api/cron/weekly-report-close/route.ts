/**
 * POST /api/cron/weekly-report-close
 *
 * Fecha a semana do Relatório Semanal: recalcula os rankings da última semana
 * FECHADA e grava o snapshot congelado por território.
 *
 * Agendado para domingo 23h BRT (depois do último refresh-instagram-data do dia), via
 * QStash. Idempotente: rodar duas vezes na mesma semana reescreve o mesmo documento.
 *
 * POR QUE ESTE JOB É O MAIS IMPORTANTE DO PIPELINE: `Metric.stats` é cumulativo e
 * reescrito a cada sync. Se uma semana não é congelada aqui, ela não pode ser
 * reconstruída depois com os números que tinha — e sem o histórico não existe coluna
 * de movimento nem resultado de previsão. Semana perdida é perdida para sempre.
 * Por isso ele roda antes e independente da composição/render.
 */

import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { logger } from "@/app/lib/logger";
import { closeWeek } from "@/app/lib/relatorio/weeklyReportService";
import { lastClosedWeek, weekWindowFor } from "@/app/lib/relatorio/weekWindow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

const receiver =
  currentSigningKey && nextSigningKey
    ? new Receiver({ currentSigningKey, nextSigningKey })
    : null;

const TAG = "[Cron WeeklyReportClose]";

async function authorize(request: NextRequest): Promise<{ ok: true } | { ok: false; status: number }> {
  // CRON_SECRET permite disparo manual pelo operador (runbook de recuperação de
  // semana perdida) sem passar pelo QStash.
  const secret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization");
  if (secret && bearer === `Bearer ${secret}`) return { ok: true };

  if (process.env.NODE_ENV === "development") return { ok: true };

  if (!receiver) {
    logger.error(`${TAG} signing keys do QStash ausentes — job desabilitado por config.`);
    return { ok: false, status: 500 };
  }
  const signature = request.headers.get("upstash-signature");
  if (!signature) return { ok: false, status: 401 };
  const body = await request.text();
  const isValid = await receiver.verify({ signature, body }).catch(() => false);
  return isValid ? { ok: true } : { ok: false, status: 401 };
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (!auth.ok) {
    logger.warn(`${TAG} requisição não autorizada.`);
    return NextResponse.json({ message: "Não autorizado." }, { status: auth.status });
  }

  // ?week=2026-W30 permite refazer uma semana específica (só reescreve o snapshot
  // daquela chave; não toca nas outras).
  const weekParam = request.nextUrl.searchParams.get("week");
  let week = lastClosedWeek();
  if (weekParam) {
    const match = /^(\d{4})-W(\d{1,2})$/.exec(weekParam);
    if (!match) {
      return NextResponse.json({ message: "week inválido. Use 2026-W30." }, { status: 400 });
    }
    const jan4 = new Date(Date.UTC(Number(match[1]), 0, 4, 12));
    const weekday = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
    const week1Monday = new Date(jan4.getTime() - (weekday - 1) * 86_400_000);
    week = weekWindowFor(new Date(week1Monday.getTime() + (Number(match[2]) - 1) * 7 * 86_400_000));
  }

  try {
    const result = await closeWeek({ week });
    logger.info(
      `${TAG} ${result.weekKey} fechada · ${result.territories.length} territórios · ` +
        `${result.report.cover.videos} vídeos de ${result.report.cover.creators} criadores.`,
    );
    return NextResponse.json({
      weekKey: result.weekKey,
      territories: result.territories,
      videos: result.report.cover.videos,
      creators: result.report.cover.creators,
    });
  } catch (error) {
    logger.error(`${TAG} falha ao fechar ${week.weekKey}:`, error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro ao fechar a semana." },
      { status: 500 },
    );
  }
}

export async function GET() {
  const week = lastClosedWeek();
  return NextResponse.json({
    message: "Job de fechamento do Relatório Semanal ativo.",
    proximaSemanaAFechar: week.weekKey,
    intervalo: week.rangeLabel,
  });
}
