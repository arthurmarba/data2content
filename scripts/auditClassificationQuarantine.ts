/**
 * @fileoverview Auditoria do resíduo em classificationQuarantine.
 * @description Resume valores por dimensão de origem e identifica candidatos de remapeamento por outra taxonomia.
 *
 * @run `npx tsx --env-file=.env.local ./scripts/auditClassificationQuarantine.ts`
 */

import mongoose from "mongoose";

import { findCategoryMatchesAcrossTypes, type CategoryType } from "@/app/lib/classification";
import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric from "@/app/models/Metric";
import { CLASSIFICATION_DIMENSIONS, type MetricCategoryField } from "@/app/lib/classificationLegacy";

const SCRIPT_TAG = "[SCRIPT_AUDIT_CLASSIFICATION_QUARANTINE]";

type DistinctValueRow = {
  _id: string;
  count: number;
};

type QuarantineMatch = {
  type: CategoryType;
  id: string;
  label: string;
};

type QuarantineValueSummary = {
  raw: string;
  count: number;
  candidateMatches: QuarantineMatch[];
};

type QuarantineFieldSummary = {
  totalValues: number;
  distinctValues: number;
  exclusivelyRemappable: QuarantineValueSummary[];
  ambiguousOrUnknown: QuarantineValueSummary[];
};

async function aggregateDistinctValues(field: MetricCategoryField): Promise<DistinctValueRow[]> {
  return Metric.aggregate<DistinctValueRow>([
    {
      $project: {
        values: {
          $cond: [{ $isArray: `$classificationQuarantine.${field}` }, `$classificationQuarantine.${field}`, []],
        },
      },
    },
    { $unwind: "$values" },
    {
      $match: {
        values: {
          $type: "string",
          $ne: "",
        },
      },
    },
    {
      $group: {
        _id: "$values",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1, _id: 1 } },
  ]);
}

async function buildFieldSummary(field: MetricCategoryField): Promise<QuarantineFieldSummary> {
  const rows = await aggregateDistinctValues(field);
  const exclusivelyRemappable: QuarantineValueSummary[] = [];
  const ambiguousOrUnknown: QuarantineValueSummary[] = [];
  let totalValues = 0;

  for (const row of rows) {
    const raw = String(row._id || "");
    const count = Number(row.count || 0);
    const candidateMatches = findCategoryMatchesAcrossTypes(raw);
    totalValues += count;

    const summary = { raw, count, candidateMatches };
    if (candidateMatches.length === 1) {
      exclusivelyRemappable.push(summary);
    } else {
      ambiguousOrUnknown.push(summary);
    }
  }

  return {
    totalValues,
    distinctValues: rows.length,
    exclusivelyRemappable,
    ambiguousOrUnknown,
  };
}

async function run() {
  logger.info(`${SCRIPT_TAG} Iniciando auditoria da quarentena de classificação.`);

  try {
    await connectToDatabase();

    const summary = Object.fromEntries(
      await Promise.all(
        CLASSIFICATION_DIMENSIONS.map(async (dimension) => [dimension.field, await buildFieldSummary(dimension.field)])
      )
    ) as Record<MetricCategoryField, QuarantineFieldSummary>;

    for (const dimension of CLASSIFICATION_DIMENSIONS) {
      logger.info(`${SCRIPT_TAG} Resumo da quarentena por dimensão '${dimension.field}'.`, summary[dimension.field]);
    }

    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    logger.error(`${SCRIPT_TAG} Falha na auditoria da quarentena.`, error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void run();
