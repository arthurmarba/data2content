/**
 * POST /api/cron/weekly-scene-evaluation
 *
 * Enfileira, no worker de cena, os vídeos da última semana fechada que ainda não foram
 * conferidos contra o mapa do criador.
 *
 * Agendado para segunda 00h BRT — depois de a semana encerrar e ANTES do
 * `weekly-report-close` (01h), para que o snapshot da semana já saia com os assets e
 * tons preenchidos. O horário após a virada garante que `lastClosedWeek()` selecione
 * a semana que acabou de fechar, não a anterior.
 *
 * POR QUE SÓ A SEMANA, e não um backfill de 90 dias: o corte de elegibilidade olha a
 * janela de 90 dias, e a janela INCLUI a semana corrente. Um território com ~46 posts
 * na semana produz dezenas de ocorrências do papel dominante já na primeira execução —
 * o ranking popula sem pagar pelo trimestre. Medido na base: ~94 vídeos classificáveis
 * por semana ≈ US$ 0,47.
 *
 * Fan-out via QStash, no mesmo padrão de refresh-instagram-data: uma tarefa por vídeo,
 * para que um vídeo grande (que sobe pela Files API e demora) não estoure o timeout do
 * lote inteiro.
 */

import { NextRequest, NextResponse } from "next/server";
import { Receiver, Client as QStashClient } from "@upstash/qstash";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import MetricModel from "@/app/models/Metric";
import UserModel from "@/app/models/User";
import { logger } from "@/app/lib/logger";
import { SCENE_EVALUATION_VERSION } from "@/app/lib/relatorio/sceneEvaluation";
import { lastClosedWeek } from "@/app/lib/relatorio/weekWindow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TAG = "[Cron WeeklySceneEvaluation]";

const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
const receiver =
  currentSigningKey && nextSigningKey
    ? new Receiver({ currentSigningKey, nextSigningKey })
    : null;

const qstash = process.env.QSTASH_TOKEN
  ? new QStashClient({ token: process.env.QSTASH_TOKEN })
  : null;

const workerUrl = `${
  process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL
}/api/worker/classify-published-scene`;

/** Teto de vídeos por execução — teto de custo, não de capacidade. */
const MAX_PER_RUN = Number(process.env.RELATORIO_CENA_MAX_POR_SEMANA ?? 200);

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization");
  let authorized = Boolean(secret && bearer === `Bearer ${secret}`) ||
    process.env.NODE_ENV === "development";

  if (!authorized) {
    if (!receiver) {
      logger.error(`${TAG} signing keys do QStash ausentes — job desabilitado.`);
      return NextResponse.json({ message: "QStash não configurado." }, { status: 500 });
    }
    const signature = request.headers.get("upstash-signature") ?? "";
    const body = await request.text();
    authorized = await receiver.verify({ signature, body }).catch(() => false);
  }
  if (!authorized) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  if (!qstash || !workerUrl.startsWith("http")) {
    logger.error(`${TAG} QSTASH_TOKEN ou APP_BASE_URL ausentes.`);
    return NextResponse.json({ message: "Fan-out não configurado." }, { status: 500 });
  }

  try {
    await connectToDatabase();
    const week = lastClosedWeek();

    // Só criadores com token: sem token não há como baixar o mp4, e enfileirar
    // geraria uma tarefa que falha de propósito.
    const withToken = (await UserModel.find(
      { instagramAccessToken: { $nin: [null, ""] } },
      { _id: 1 },
    )
      .lean()
      .exec()) as unknown as Array<{ _id: Types.ObjectId }>;

    const metrics = (await MetricModel.find(
      {
        postDate: { $gte: week.startsAt, $lte: week.endsAt },
        classificationStatus: "completed",
        instagramMediaId: { $nin: [null, ""] },
        "stats.video_duration_seconds": { $gt: 0 },
        user: { $in: withToken.map((u) => u._id) },
        $or: [
          { sceneElements: { $exists: false } },
          { "sceneElements.version": { $ne: SCENE_EVALUATION_VERSION } },
        ],
      },
      { _id: 1 },
    )
      .limit(MAX_PER_RUN)
      .lean()
      .exec()) as unknown as Array<{ _id: Types.ObjectId }>;

    let queued = 0;
    for (const metric of metrics) {
      try {
        await qstash.publishJSON({
          url: workerUrl,
          body: { metricId: String(metric._id) },
          retries: 2,
        });
        queued += 1;
      } catch (error) {
        logger.warn(`${TAG} falha ao enfileirar ${String(metric._id)}:`, error);
      }
    }

    logger.info(
      `${TAG} semana ${week.weekKey}: ${queued} vídeos enfileirados ` +
        `(≈ US$ ${(queued * 0.005).toFixed(2)}).`,
    );

    return NextResponse.json({
      weekKey: week.weekKey,
      queued,
      custoEstimadoUsd: Number((queued * 0.005).toFixed(2)),
    });
  } catch (error) {
    logger.error(`${TAG} falhou:`, error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro." },
      { status: 500 },
    );
  }
}

export async function GET() {
  const week = lastClosedWeek();
  return NextResponse.json({
    message: "Job semanal de avaliação de cena contra o mapa.",
    proximaSemana: week.weekKey,
    tetoPorExecucao: MAX_PER_RUN,
  });
}
