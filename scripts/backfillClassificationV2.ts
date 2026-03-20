/**
 * @fileoverview Backfill dos campos V2 de classificacao.
 * @description Preenche contentIntent, narrativeForm e contentSignals a partir do legado.
 * Opcionalmente, reescreve proposal/tone removendo valores migrados para a V2.
 *
 * @run `tsx --env-file=.env.local ./scripts/backfillClassificationV2.ts --write`
 * @run `tsx --env-file=.env.local ./scripts/backfillClassificationV2.ts --write --rewrite-legacy`
 */

import mongoose from "mongoose";

import Metric from "@/app/models/Metric";
import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import {
  buildClassificationV2BackfillUpdate,
  hasClassificationV2BackfillChanges,
} from "@/app/lib/classificationV2Bridge";

const SCRIPT_TAG = "[SCRIPT_BACKFILL_CLASSIFICATION_V2]";

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function readNumberFlag(flag: string): number | undefined {
  const prefixedArg = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (!prefixedArg) return undefined;

  const rawValue = prefixedArg.split("=")[1];
  if (!rawValue) return undefined;
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function run() {
  const dryRun = !hasFlag("--write");
  const rewriteLegacy = hasFlag("--rewrite-legacy");
  const limit = readNumberFlag("--limit");
  const batchSize = readNumberFlag("--batch-size") ?? 500;

  logger.info(`${SCRIPT_TAG} Iniciando backfill V2.`, {
    dryRun,
    rewriteLegacy,
    limit: limit ?? null,
    batchSize,
  });

  try {
    await connectToDatabase();

    const query = Metric.find({})
      .select(
        "_id source type description format proposal context tone references contentIntent narrativeForm contentSignals stance proofStyle commercialMode"
      )
      .lean();

    if (limit) {
      query.limit(limit);
    }

    const metrics = await query.exec();

    let docsScanned = 0;
    let docsNeedingUpdate = 0;
    let docsUpdated = 0;
    const sampleChanges: Array<Record<string, unknown>> = [];
    let pendingOperations: Array<{
      updateOne: {
        filter: { _id: unknown };
        update: { $set: Record<string, unknown> };
      };
    }> = [];

    const flushPendingOperations = async () => {
      if (dryRun || pendingOperations.length === 0) return;

      const opsToWrite = pendingOperations;
      pendingOperations = [];

      await Metric.bulkWrite(opsToWrite, { ordered: false });
      docsUpdated += opsToWrite.length;

      logger.info(`${SCRIPT_TAG} Lote aplicado.`, {
        batchSize: opsToWrite.length,
        docsUpdated,
        docsNeedingUpdate,
      });
    };

    for (const metric of metrics as Array<Record<string, unknown>>) {
      docsScanned += 1;

      if (!hasClassificationV2BackfillChanges(metric, { rewriteLegacy })) {
        continue;
      }

      docsNeedingUpdate += 1;
      const update = buildClassificationV2BackfillUpdate(metric, { rewriteLegacy });

      if (sampleChanges.length < 5) {
        sampleChanges.push({
          id: String(metric._id),
          update,
        });
      }

      if (!dryRun) {
        pendingOperations.push({
          updateOne: {
            filter: { _id: metric._id },
            update: {
              $set: update,
            },
          },
        });

        if (pendingOperations.length >= batchSize) {
          await flushPendingOperations();
        }
      }
    }

    await flushPendingOperations();

    logger.info(`${SCRIPT_TAG} Backfill concluido.`, {
      docsScanned,
      docsNeedingUpdate,
      docsUpdated,
      dryRun,
      rewriteLegacy,
      sampleChanges,
    });
  } catch (error) {
    logger.error(`${SCRIPT_TAG} Falha critica no backfill.`, error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void run();
