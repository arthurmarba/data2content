/**
 * @fileoverview Recoloca em pending as classificações bloqueadas por quota/rate limit da IA.
 * @description Filtra métricas com erro transitório de IA, limpa o estado e opcionalmente
 * reenfileira cada item no worker de classificação via QStash.
 *
 * @run `tsx --env-file=.env.local ./scripts/requeueRetryableClassificationFailures.ts --write --enqueue`
 */

import mongoose from "mongoose";
import { Client } from "@upstash/qstash";

import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric from "@/app/models/Metric";
import { isRetryableAiFailureMessage } from "@/app/lib/classificationAiErrors";
import { createEmptyMetricClassificationUpdate } from "@/app/lib/classificationRuntime";
import { weekWindowFor } from "@/app/lib/relatorio/weekWindow";

const SCRIPT_TAG = "[SCRIPT_REQUEUE_RETRYABLE_CLASSIFICATION_FAILURES]";

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function valueFlag(flag: string): string | null {
  return process.argv.find((value) => value.startsWith(`${flag}=`))?.slice(flag.length + 1) ?? null;
}

function weekFromKey(key: string) {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(key.trim());
  if (!match) throw new Error(`Semana inválida: ${key}`);
  const isoYear = Number(match[1]);
  const isoWeek = Number(match[2]);
  const jan4 = new Date(Date.UTC(isoYear, 0, 4, 12));
  const weekday = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const monday = new Date(jan4.getTime() - (weekday - 1) * 86_400_000);
  const week = weekWindowFor(new Date(monday.getTime() + (isoWeek - 1) * 7 * 86_400_000));
  if (week.weekKey !== `${isoYear}-W${String(isoWeek).padStart(2, "0")}`) {
    throw new Error(`Semana ISO inexistente: ${key}`);
  }
  return week;
}

async function run() {
  const dryRun = !hasFlag("--write");
  const enqueue = hasFlag("--enqueue");
  const classificationWorkerUrl = process.env.CLASSIFICATION_WORKER_URL;
  const qstashToken = process.env.QSTASH_TOKEN;
  const qstashClient = qstashToken ? new Client({ token: qstashToken }) : null;
  const weekKey = valueFlag("--week");
  const week = weekKey ? weekFromKey(weekKey) : null;

  logger.info(`${SCRIPT_TAG} Iniciando reprocessamento de falhas transitórias de classificação.`, {
    dryRun,
    enqueue,
    hasWorkerUrl: Boolean(classificationWorkerUrl),
    hasQstashToken: Boolean(qstashToken),
  });

  try {
    await connectToDatabase();

    const candidates = await Metric.find({
      classificationStatus: { $in: ["failed", "pending"] },
      description: { $exists: true, $ne: "" },
      classificationError: { $exists: true, $ne: null },
      ...(week ? { postDate: { $gte: week.startsAt, $lte: week.endsAt } } : {}),
    })
      .select("_id classificationStatus classificationError")
      .lean<Array<{ _id: mongoose.Types.ObjectId; classificationStatus: string; classificationError?: string | null }>>();

    const matching = candidates.filter((metric) => isRetryableAiFailureMessage(metric.classificationError));

    logger.info(`${SCRIPT_TAG} Métricas elegíveis encontradas.`, {
      totalCandidates: candidates.length,
      retryableMatches: matching.length,
    });

    if (matching.length === 0) {
      logger.info(`${SCRIPT_TAG} Nenhuma métrica com falha transitória encontrada.`);
      return;
    }

    const metricIds = matching.map((metric) => metric._id);

    if (!dryRun) {
      const updateResult = await Metric.updateMany(
        { _id: { $in: metricIds } },
        {
          $set: {
            classificationStatus: "pending",
            classificationError: null,
            ...createEmptyMetricClassificationUpdate(),
          },
        }
      );

      logger.info(`${SCRIPT_TAG} Métricas resetadas para pending.`, {
        matchedCount: updateResult.matchedCount,
        modifiedCount: updateResult.modifiedCount,
      });
    }

    if (!enqueue) return;

    if (dryRun) {
      logger.info(`${SCRIPT_TAG} Dry-run ativo; reenfileiramento não executado.`);
      return;
    }

    if (!classificationWorkerUrl || !qstashClient) {
      logger.warn(`${SCRIPT_TAG} CLASSIFICATION_WORKER_URL ou QSTASH_TOKEN ausentes. Reenfileiramento ignorado.`);
      return;
    }

    let enqueuedCount = 0;
    let enqueueFailures = 0;

    for (const metricId of metricIds) {
      try {
        await qstashClient.publishJSON({
          url: classificationWorkerUrl,
          body: { metricId: metricId.toString() },
        });
        enqueuedCount += 1;
      } catch (error) {
        enqueueFailures += 1;
        logger.error(`${SCRIPT_TAG} Falha ao reenfileirar métrica ${metricId.toString()}.`, error);
      }
    }

    logger.info(`${SCRIPT_TAG} Reenfileiramento concluído.`, {
      enqueuedCount,
      enqueueFailures,
    });
  } catch (error) {
    logger.error(`${SCRIPT_TAG} Falha crítica no reprocessamento.`, error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void run();
