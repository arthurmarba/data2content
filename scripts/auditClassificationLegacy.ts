/**
 * @fileoverview Auditoria read-only dos valores legados de classificação nas métricas.
 * @description Resume buckets de qualidade por dimensão e estima o alcance de uma migração determinística.
 *
 * @run `npx tsx --env-file=.env.local ./scripts/auditClassificationLegacy.ts`
 */

import mongoose from "mongoose";

import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric from "@/app/models/Metric";
import {
  CLASSIFICATION_DIMENSIONS,
  analyzeLegacyCategoryValues,
  buildMetricClassificationMigrationPlan,
  inspectStoredCategoryValue,
  type MetricCategoryField,
  type StoredCategoryValueBucket,
} from "@/app/lib/classificationLegacy";

const SCRIPT_TAG = "[SCRIPT_AUDIT_CLASSIFICATION_LEGACY]";
const UNKNOWN_SAMPLE_LIMIT = 12;

type DistinctValueRow = {
  _id: string;
  count: number;
};

type ValueBucketSummary = {
  totalValues: number;
  distinctValues: number;
  bucketCounts: Record<StoredCategoryValueBucket, number>;
  unknownSamples: Array<{ raw: string; count: number }>;
  aliasSamples: Array<{ raw: string; canonicalId: string | null; count: number }>;
};

type DocSummary = {
  totalDocs: number;
  docsWithDeterministicChanges: number;
  docsBlockedByUnknowns: number;
  fieldChanges: Record<MetricCategoryField, number>;
  blockedFields: Record<MetricCategoryField, number>;
};

async function aggregateDistinctValues(field: MetricCategoryField): Promise<DistinctValueRow[]> {
  return Metric.aggregate<DistinctValueRow>([
    {
      $project: {
        values: {
          $cond: [{ $isArray: `$${field}` }, `$${field}`, []],
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

async function buildValueSummary(field: MetricCategoryField, type: (typeof CLASSIFICATION_DIMENSIONS)[number]["type"]): Promise<ValueBucketSummary> {
  const rows = await aggregateDistinctValues(field);
  const bucketCounts: Record<StoredCategoryValueBucket, number> = {
    canonical_id: 0,
    canonical_label: 0,
    alias: 0,
    unknown: 0,
  };
  const unknownSamples: Array<{ raw: string; count: number }> = [];
  const aliasSamples: Array<{ raw: string; canonicalId: string | null; count: number }> = [];
  let totalValues = 0;

  for (const row of rows) {
    const inspection = inspectStoredCategoryValue(String(row._id || ""), type);
    const count = Number(row.count || 0);
    totalValues += count;
    bucketCounts[inspection.bucket] += count;

    if (inspection.bucket === "unknown" && unknownSamples.length < UNKNOWN_SAMPLE_LIMIT) {
      unknownSamples.push({ raw: inspection.raw, count });
    }
    if (inspection.bucket === "alias" && aliasSamples.length < UNKNOWN_SAMPLE_LIMIT) {
      aliasSamples.push({ raw: inspection.raw, canonicalId: inspection.canonicalId, count });
    }
  }

  return {
    totalValues,
    distinctValues: rows.length,
    bucketCounts,
    unknownSamples,
    aliasSamples,
  };
}

async function buildDocSummary(limit?: number): Promise<DocSummary> {
  const fieldChanges = Object.fromEntries(CLASSIFICATION_DIMENSIONS.map((dimension) => [dimension.field, 0])) as Record<
    MetricCategoryField,
    number
  >;
  const blockedFields = Object.fromEntries(CLASSIFICATION_DIMENSIONS.map((dimension) => [dimension.field, 0])) as Record<
    MetricCategoryField,
    number
  >;

  let totalDocs = 0;
  let docsWithDeterministicChanges = 0;
  let docsBlockedByUnknowns = 0;

  const query = Metric.find({})
    .select("format proposal context tone references")
    .lean();

  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    query.limit(Math.floor(limit));
  }

  const cursor = query.cursor();

  for await (const metric of cursor) {
    totalDocs += 1;
    const plan = buildMetricClassificationMigrationPlan(metric as Record<MetricCategoryField, unknown>);
    if (plan.changedFields.length > 0) {
      docsWithDeterministicChanges += 1;
      for (const field of plan.changedFields) {
        fieldChanges[field] += 1;
      }
    }
    if (plan.blockedFields.length > 0) {
      docsBlockedByUnknowns += 1;
      for (const field of plan.blockedFields) {
        blockedFields[field] += 1;
      }
    }
  }

  return {
    totalDocs,
    docsWithDeterministicChanges,
    docsBlockedByUnknowns,
    fieldChanges,
    blockedFields,
  };
}

function parseLimitArg(): number | undefined {
  const arg = process.argv.find((item) => item.startsWith("--limit="));
  if (!arg) return undefined;
  const value = Number(arg.split("=")[1]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

async function run() {
  const limit = parseLimitArg();
  logger.info(`${SCRIPT_TAG} Iniciando auditoria do legado de classificação.`, { limit: limit ?? null });

  try {
    await connectToDatabase();

    const valueSummary = Object.fromEntries(
      await Promise.all(
        CLASSIFICATION_DIMENSIONS.map(async (dimension) => [
          dimension.field,
          await buildValueSummary(dimension.field, dimension.type),
        ])
      )
    ) as Record<MetricCategoryField, ValueBucketSummary>;

    const docSummary = await buildDocSummary(limit);

    for (const dimension of CLASSIFICATION_DIMENSIONS) {
      const summary = valueSummary[dimension.field];
      logger.info(`${SCRIPT_TAG} Resumo por dimensão '${dimension.field}'.`, summary);
    }

    logger.info(`${SCRIPT_TAG} Resumo por documento para migração determinística.`, docSummary);
    console.log(
      JSON.stringify(
        {
          valueSummary,
          docSummary,
        },
        null,
        2
      )
    );
  } catch (error) {
    logger.error(`${SCRIPT_TAG} Falha na auditoria do legado.`, error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void run();
