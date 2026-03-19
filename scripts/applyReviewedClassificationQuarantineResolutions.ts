/**
 * @fileoverview Aplica resoluções humanas revisadas para a classificationQuarantine.
 * @description Executa apenas regras explícitas em REVIEWED_QUARANTINE_RESOLUTIONS.
 *
 * @run `npx tsx --env-file=.env.local ./scripts/applyReviewedClassificationQuarantineResolutions.ts`
 * @run `npx tsx --env-file=.env.local ./scripts/applyReviewedClassificationQuarantineResolutions.ts --write`
 */

import mongoose from "mongoose";

import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric from "@/app/models/Metric";
import { CLASSIFICATION_DIMENSIONS, type MetricCategoryField } from "@/app/lib/classificationLegacy";
import {
  getReviewedQuarantineResolution,
  type ReviewedQuarantineResolution,
} from "@/app/lib/classificationQuarantineResolution";

const SCRIPT_TAG = "[SCRIPT_APPLY_REVIEWED_CLASSIFICATION_QUARANTINE_RESOLUTIONS]";
const BULK_WRITE_BATCH_SIZE = 500;

type ResolutionSummary = {
  dryRun: boolean;
  totalDocs: number;
  docsWithChanges: number;
  docsUpdated: number;
  appliedRules: number;
};

function parseWriteFlag() {
  return process.argv.includes("--write");
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
  const summary: ResolutionSummary = {
    dryRun,
    totalDocs: 0,
    docsWithChanges: 0,
    docsUpdated: 0,
    appliedRules: 0,
  };

  logger.info(`${SCRIPT_TAG} Iniciando aplicação de regras revisadas da quarentena.`, { dryRun });

  try {
    await connectToDatabase();
    const pendingOperations: Parameters<typeof Metric.bulkWrite>[0] = [];

    const cursor = Metric.find({})
      .select("_id format proposal context tone references classificationQuarantine")
      .lean()
      .cursor();

    for await (const metric of cursor) {
      summary.totalDocs += 1;
      const updatePayload: Record<string, string[]> = {};
      let docChanged = false;

      const quarantine = (metric.classificationQuarantine ?? {}) as Partial<Record<MetricCategoryField, unknown>>;
      const metricFields = {
        format: uniqueStrings(toStringArray(metric.format)),
        proposal: uniqueStrings(toStringArray(metric.proposal)),
        context: uniqueStrings(toStringArray(metric.context)),
        tone: uniqueStrings(toStringArray(metric.tone)),
        references: uniqueStrings(toStringArray(metric.references)),
      } as Record<MetricCategoryField, string[]>;

      for (const dimension of CLASSIFICATION_DIMENSIONS) {
        const sourceField = dimension.field;
        const sourceValues = toStringArray(quarantine[sourceField]);
        if (sourceValues.length === 0) continue;

        const nextQuarantine = [...sourceValues];

        for (const raw of sourceValues) {
          const rule = getReviewedQuarantineResolution(sourceField, raw);
          if (!rule) continue;

          if (rule.action === "append_to_target" && rule.targetField && rule.targetId) {
            metricFields[rule.targetField] = uniqueStrings([...metricFields[rule.targetField], rule.targetId]);
            updatePayload[rule.targetField] = metricFields[rule.targetField];
          }

          const index = nextQuarantine.indexOf(raw);
          if (index >= 0) nextQuarantine.splice(index, 1);
          summary.appliedRules += 1;
          docChanged = true;
        }

        if (nextQuarantine.length !== sourceValues.length) {
          updatePayload[`classificationQuarantine.${sourceField}`] = nextQuarantine;
        }
      }

      if (!docChanged) continue;

      summary.docsWithChanges += 1;
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

    logger.info(`${SCRIPT_TAG} Aplicação concluída.`, summary);
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    logger.error(`${SCRIPT_TAG} Falha na aplicação das regras revisadas.`, error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void run();
