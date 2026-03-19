/**
 * @fileoverview Auditoria focada em conflitos semânticos restantes na classificationQuarantine.
 * @description Agrupa por valor e mostra se o destino sugerido já está vazio, já contém o valor
 * ou já contém outros valores, para orientar decisões de append/manual review.
 *
 * @run `npx tsx --env-file=.env.local ./scripts/auditClassificationQuarantineConflicts.ts`
 */

import mongoose from "mongoose";

import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric from "@/app/models/Metric";
import { CLASSIFICATION_DIMENSIONS, type MetricCategoryField } from "@/app/lib/classificationLegacy";
import {
  getSuggestedCrossDimensionResolution,
  type ReviewedQuarantineResolution,
} from "@/app/lib/classificationQuarantineResolution";

const SCRIPT_TAG = "[SCRIPT_AUDIT_CLASSIFICATION_QUARANTINE_CONFLICTS]";
const SAMPLE_LIMIT = 5;

type ConflictBucket = {
  sourceField: MetricCategoryField;
  raw: string;
  targetField: MetricCategoryField;
  targetId: string;
  count: number;
  targetEmptyCount: number;
  targetAlreadyContainsCount: number;
  targetHasOtherValuesCount: number;
  sampleMetricIds: string[];
  sampleTargetValues: string[][];
};

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

async function run() {
  logger.info(`${SCRIPT_TAG} Iniciando auditoria de conflitos da quarentena.`);

  try {
    await connectToDatabase();
    const buckets = new Map<string, ConflictBucket>();

    const cursor = Metric.find({})
      .select("_id format proposal context tone references classificationQuarantine")
      .lean()
      .cursor();

    for await (const metric of cursor) {
      const quarantine = (metric.classificationQuarantine ?? {}) as Partial<Record<MetricCategoryField, unknown>>;

      for (const dimension of CLASSIFICATION_DIMENSIONS) {
        const sourceField = dimension.field;
        const sourceValues = toStringArray(quarantine[sourceField]);
        if (sourceValues.length === 0) continue;

        for (const raw of sourceValues) {
          const suggestion = getSuggestedCrossDimensionResolution(sourceField, raw);
          if (!suggestion || suggestion.action !== "append_to_target" || !suggestion.targetField || !suggestion.targetId) {
            continue;
          }

          const targetValues = toStringArray(metric[suggestion.targetField]);
          const bucketKey = `${sourceField}::${raw}=>${suggestion.targetField}::${suggestion.targetId}`;
          const bucket =
            buckets.get(bucketKey) ??
            {
              sourceField,
              raw,
              targetField: suggestion.targetField,
              targetId: suggestion.targetId,
              count: 0,
              targetEmptyCount: 0,
              targetAlreadyContainsCount: 0,
              targetHasOtherValuesCount: 0,
              sampleMetricIds: [],
              sampleTargetValues: [],
            };

          bucket.count += 1;
          if (targetValues.length === 0) {
            bucket.targetEmptyCount += 1;
          } else if (targetValues.includes(suggestion.targetId)) {
            bucket.targetAlreadyContainsCount += 1;
          } else {
            bucket.targetHasOtherValuesCount += 1;
          }

          if (bucket.sampleMetricIds.length < SAMPLE_LIMIT) {
            bucket.sampleMetricIds.push(String(metric._id));
            bucket.sampleTargetValues.push(targetValues);
          }

          buckets.set(bucketKey, bucket);
        }
      }
    }

    const summary = Array.from(buckets.values()).sort((left, right) => right.count - left.count || left.raw.localeCompare(right.raw));
    logger.info(`${SCRIPT_TAG} Conflitos agrupados da quarentena.`, { totalGroups: summary.length });
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    logger.error(`${SCRIPT_TAG} Falha na auditoria de conflitos da quarentena.`, error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void run();
