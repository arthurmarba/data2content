/**
 * @fileoverview Remapeia, de forma conservadora, valores em classificationQuarantine para outra dimensão.
 * @description Promove aliases reconhecíveis para o campo canônico. Cruzamentos entre dimensões só ocorrem
 * quando há destino único e o campo de destino está vazio ou já contém o valor canônico, evitando manter
 * resíduos redundantes na quarentena.
 *
 * @run `npx tsx --env-file=.env.local ./scripts/remapClassificationQuarantine.ts`
 * @run `npx tsx --env-file=.env.local ./scripts/remapClassificationQuarantine.ts --write`
 */

import mongoose from "mongoose";

import { findCategoryMatchesAcrossTypes, type CategoryType } from "@/app/lib/classification";
import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric from "@/app/models/Metric";
import { CLASSIFICATION_DIMENSIONS, type MetricCategoryField } from "@/app/lib/classificationLegacy";

const SCRIPT_TAG = "[SCRIPT_REMAP_CLASSIFICATION_QUARANTINE]";
const BULK_WRITE_BATCH_SIZE = 500;

const TYPE_TO_FIELD: Record<CategoryType, MetricCategoryField> = {
  format: "format",
  proposal: "proposal",
  context: "context",
  tone: "tone",
  reference: "references",
};

type RemapSummary = {
  dryRun: boolean;
  totalDocs: number;
  docsWithRemaps: number;
  docsUpdated: number;
  resolvedBySourceField: Record<MetricCategoryField, number>;
  appendsByTargetField: Record<MetricCategoryField, number>;
  dropsWithoutAppend: number;
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

function toStringArray(values: unknown): string[] {
  if (Array.isArray(values)) {
    return values
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  if (typeof values === "string") {
    const trimmed = values.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

async function run() {
  const dryRun = !parseWriteFlag();
  const limit = parseLimitArg();
  const resolvedBySourceField = Object.fromEntries(CLASSIFICATION_DIMENSIONS.map((dimension) => [dimension.field, 0])) as Record<
    MetricCategoryField,
    number
  >;
  const appendsByTargetField = Object.fromEntries(CLASSIFICATION_DIMENSIONS.map((dimension) => [dimension.field, 0])) as Record<
    MetricCategoryField,
    number
  >;

  const summary: RemapSummary = {
    dryRun,
    totalDocs: 0,
    docsWithRemaps: 0,
    docsUpdated: 0,
    resolvedBySourceField,
    appendsByTargetField,
    dropsWithoutAppend: 0,
  };

  logger.info(`${SCRIPT_TAG} Iniciando remapeamento conservador da quarentena.`, {
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

      const updatePayload: Record<string, string[]> = {};
      let docHasRemap = false;

      const metricFields = {
        format: uniqueStrings(toStringArray(metric.format)),
        proposal: uniqueStrings(toStringArray(metric.proposal)),
        context: uniqueStrings(toStringArray(metric.context)),
        tone: uniqueStrings(toStringArray(metric.tone)),
        references: uniqueStrings(toStringArray(metric.references)),
      } as Record<MetricCategoryField, string[]>;

      const quarantine = (metric.classificationQuarantine ?? {}) as Partial<Record<MetricCategoryField, unknown>>;

      for (const dimension of CLASSIFICATION_DIMENSIONS) {
        const sourceField = dimension.field;
        const sourceValues = uniqueStrings(toStringArray(quarantine[sourceField]));
        if (sourceValues.length === 0) continue;

        const nextSourceValues = [...sourceValues];

        for (const rawValue of sourceValues) {
          const matches = findCategoryMatchesAcrossTypes(rawValue);
          if (matches.length !== 1) continue;

          const match = matches[0];
          if (!match) continue;
          const targetField = TYPE_TO_FIELD[match.type];
          let appendedToTarget = false;
          let shouldRemoveFromQuarantine = false;

          if (targetField === sourceField) {
            if (!metricFields[targetField].includes(match.id)) {
              metricFields[targetField] = uniqueStrings([...metricFields[targetField], match.id]);
              updatePayload[targetField] = metricFields[targetField];
              appendedToTarget = true;
            }
            shouldRemoveFromQuarantine = true;
          } else {
            if (metricFields[targetField].includes(match.id)) {
              shouldRemoveFromQuarantine = true;
            } else if (metricFields[targetField].length === 0) {
              metricFields[targetField] = uniqueStrings([...metricFields[targetField], match.id]);
              updatePayload[targetField] = metricFields[targetField];
              appendedToTarget = true;
              shouldRemoveFromQuarantine = true;
            }
          }

          if (!shouldRemoveFromQuarantine) continue;

          const removeIndex = nextSourceValues.indexOf(rawValue);
          if (removeIndex >= 0) nextSourceValues.splice(removeIndex, 1);

          summary.resolvedBySourceField[sourceField] += 1;
          if (appendedToTarget) {
            summary.appendsByTargetField[targetField] += 1;
          } else {
            summary.dropsWithoutAppend += 1;
          }
          docHasRemap = true;
        }

        if (nextSourceValues.length !== sourceValues.length) {
          updatePayload[`classificationQuarantine.${sourceField}`] = nextSourceValues;
        }
      }

      if (!docHasRemap) continue;

      summary.docsWithRemaps += 1;
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

    logger.info(`${SCRIPT_TAG} Remapeamento concluído.`, summary);
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    logger.error(`${SCRIPT_TAG} Falha no remapeamento da quarentena.`, error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void run();
