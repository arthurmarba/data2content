/**
 * @fileoverview Migração determinística do legado de classificação para IDs canônicos.
 * @description Executa em dry-run por padrão. Só reescreve dimensões sem valores desconhecidos.
 *
 * @run `npx tsx --env-file=.env.local ./scripts/migrateCanonicalCategories.ts`
 * @run `npx tsx --env-file=.env.local ./scripts/migrateCanonicalCategories.ts --write`
 */

import mongoose from "mongoose";

import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric from "@/app/models/Metric";
import {
  buildMetricClassificationMigrationPlan,
  CLASSIFICATION_DIMENSIONS,
  type MetricCategoryField,
} from "@/app/lib/classificationLegacy";

const SCRIPT_TAG = "[SCRIPT_MIGRATE_CANONICAL_CATEGORIES]";
const BULK_WRITE_BATCH_SIZE = 500;

type MigrationSummary = {
  dryRun: boolean;
  totalDocs: number;
  docsUpdated: number;
  docsWithChanges: number;
  docsBlockedByUnknowns: number;
  fieldUpdates: Record<MetricCategoryField, number>;
  blockedFields: Record<MetricCategoryField, number>;
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
  const blockedFields = Object.fromEntries(CLASSIFICATION_DIMENSIONS.map((dimension) => [dimension.field, 0])) as Record<
    MetricCategoryField,
    number
  >;

  const summary: MigrationSummary = {
    dryRun,
    totalDocs: 0,
    docsUpdated: 0,
    docsWithChanges: 0,
    docsBlockedByUnknowns: 0,
    fieldUpdates,
    blockedFields,
  };

  logger.info(`${SCRIPT_TAG} Iniciando migração determinística de categorias.`, {
    dryRun,
    limit: limit ?? null,
  });

  try {
    await connectToDatabase();
    const pendingOperations: Parameters<typeof Metric.bulkWrite>[0] = [];

    const query = Metric.find({})
      .select("_id format proposal context tone references")
      .lean();

    if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
      query.limit(Math.floor(limit));
    }

    const cursor = query.cursor();

    for await (const metric of cursor) {
      summary.totalDocs += 1;
      const plan = buildMetricClassificationMigrationPlan(metric as Record<MetricCategoryField, unknown>);

      if (plan.changedFields.length > 0) {
        summary.docsWithChanges += 1;
        for (const field of plan.changedFields) {
          summary.fieldUpdates[field] += 1;
        }
      }

      if (plan.blockedFields.length > 0) {
        summary.docsBlockedByUnknowns += 1;
        for (const field of plan.blockedFields) {
          summary.blockedFields[field] += 1;
        }
      }

      if (plan.changedFields.length === 0 || dryRun) continue;

      pendingOperations.push({
        updateOne: {
          filter: { _id: metric._id },
          update: { $set: plan.update },
        },
      });

      if (pendingOperations.length >= BULK_WRITE_BATCH_SIZE) {
        await Metric.bulkWrite(pendingOperations, { ordered: false });
        pendingOperations.length = 0;
      }

      summary.docsUpdated += 1;
    }

    if (!dryRun && pendingOperations.length > 0) {
      await Metric.bulkWrite(pendingOperations, { ordered: false });
    }

    logger.info(`${SCRIPT_TAG} Migração concluída.`, summary);
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    logger.error(`${SCRIPT_TAG} Falha na migração determinística.`, error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void run();
