/**
 * @fileoverview Move resíduo inválido de classificação para classificationQuarantine.
 * @description Executa em dry-run por padrão. Mantém apenas IDs canônicos nos campos principais.
 *
 * @run `npx tsx --env-file=.env.local ./scripts/quarantineClassificationLegacy.ts`
 * @run `npx tsx --env-file=.env.local ./scripts/quarantineClassificationLegacy.ts --write`
 */

import mongoose from "mongoose";

import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric from "@/app/models/Metric";
import {
  buildMetricClassificationQuarantinePlan,
  CLASSIFICATION_DIMENSIONS,
  type MetricCategoryField,
} from "@/app/lib/classificationLegacy";

const SCRIPT_TAG = "[SCRIPT_QUARANTINE_CLASSIFICATION_LEGACY]";
const BULK_WRITE_BATCH_SIZE = 500;

type QuarantineSummary = {
  dryRun: boolean;
  totalDocs: number;
  docsWithChanges: number;
  docsUpdated: number;
  docsWithQuarantine: number;
  fieldUpdates: Record<MetricCategoryField, number>;
  quarantineFields: Record<MetricCategoryField, number>;
};

type MetricQuarantineCandidate = Partial<Record<MetricCategoryField, unknown>> & {
  classificationQuarantine?: Partial<Record<MetricCategoryField, unknown>>;
};

function parseWriteFlag() {
  return process.argv.includes("--write");
}

function parseLimitArg(): number | undefined {
  const arg = process.argv.find((item) => item.startsWith("--limit="));
  if (!arg) return undefined;
  const value = Number(arg.split("=")[1]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

async function run() {
  const dryRun = !parseWriteFlag();
  const limit = parseLimitArg();
  const fieldUpdates = Object.fromEntries(CLASSIFICATION_DIMENSIONS.map((dimension) => [dimension.field, 0])) as Record<
    MetricCategoryField,
    number
  >;
  const quarantineFields = Object.fromEntries(CLASSIFICATION_DIMENSIONS.map((dimension) => [dimension.field, 0])) as Record<
    MetricCategoryField,
    number
  >;

  const summary: QuarantineSummary = {
    dryRun,
    totalDocs: 0,
    docsWithChanges: 0,
    docsUpdated: 0,
    docsWithQuarantine: 0,
    fieldUpdates,
    quarantineFields,
  };

  logger.info(`${SCRIPT_TAG} Iniciando quarentena do legado de classificação.`, {
    dryRun,
    limit: limit ?? null,
  });

  try {
    await connectToDatabase();
    const pendingOperations: Parameters<typeof Metric.bulkWrite>[0] = [];

    const query = Metric.find({})
      .select("_id format proposal context tone references classificationQuarantine")
      .lean();

    if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
      query.limit(Math.floor(limit));
    }

    const cursor = query.cursor();

    for await (const metric of cursor) {
      summary.totalDocs += 1;
      const plan = buildMetricClassificationQuarantinePlan(metric as MetricQuarantineCandidate);

      const updatePayload: Record<string, string[]> = {};

      for (const field of plan.changedFields) {
        updatePayload[field] = plan.update[field] ?? [];
        summary.fieldUpdates[field] += 1;
      }

      for (const field of plan.quarantinedFields) {
        updatePayload[`classificationQuarantine.${field}`] = plan.quarantineUpdate[field] ?? [];
        summary.quarantineFields[field] += 1;
      }

      if (Object.keys(updatePayload).length === 0) continue;

      summary.docsWithChanges += 1;
      if (plan.quarantinedFields.length > 0) {
        summary.docsWithQuarantine += 1;
      }

      if (!dryRun) {
        pendingOperations.push({
          updateOne: {
            filter: { _id: metric._id },
            update: { $set: updatePayload },
          },
        });

        if (pendingOperations.length >= BULK_WRITE_BATCH_SIZE) {
          await Metric.bulkWrite(pendingOperations, { ordered: false });
          pendingOperations.length = 0;
        }

        summary.docsUpdated += 1;
      }
    }

    if (!dryRun && pendingOperations.length > 0) {
      await Metric.bulkWrite(pendingOperations, { ordered: false });
    }

    logger.info(`${SCRIPT_TAG} Quarentena concluída.`, summary);
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    logger.error(`${SCRIPT_TAG} Falha na quarentena do legado.`, error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void run();
