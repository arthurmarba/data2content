/**
 * @fileoverview Reclassificacao seletiva por IA para o resíduo estratégico.
 * @description Prioriza conteúdos recentes, opt-in e ainda sem campos V2/V2.5 preenchidos.
 *
 * @run `tsx --env-file=.env.local ./scripts/reclassifyStrategicResidual.ts`
 * @run `tsx --env-file=.env.local ./scripts/reclassifyStrategicResidual.ts --write --days=180 --limit=100`
 */

import mongoose, { type PipelineStage } from "mongoose";

import { connectToDatabase } from "@/app/lib/mongoose";
import Metric, { type IMetric } from "@/app/models/Metric";
import { logger } from "@/app/lib/logger";
import {
  buildDeferredClassificationErrorMessage,
  classifyAiFailureMessage,
  type ClassificationAiFailureKind,
} from "@/app/lib/classificationAiErrors";
import {
  buildClassificationOpenAiPayload,
  buildMetricClassificationUpdate,
  createEmptyMetricClassificationUpdate,
  normalizeClassificationResponse,
  type ClassificationResult,
} from "@/app/lib/classificationRuntime";

const SCRIPT_TAG = "[SCRIPT_RECLASSIFY_STRATEGIC_RESIDUAL]";
const OPENAI_CLASSIFICATION_MODEL =
  process.env.OPENAI_CLASSIFIER_MODEL?.trim() || "gpt-4o-mini";
const STRATEGIC_FIELDS = [
  "contentIntent",
  "narrativeForm",
  "contentSignals",
  "stance",
  "proofStyle",
  "commercialMode",
] as const;

type CandidateMetric = {
  _id: mongoose.Types.ObjectId;
  description: string;
  source?: string | null;
  type?: string | null;
  format?: string[];
  proposal?: string[];
  context?: string[];
  tone?: string[];
  references?: string[];
  contentIntent?: string[];
  narrativeForm?: string[];
  contentSignals?: string[];
  stance?: string[];
  proofStyle?: string[];
  commercialMode?: string[];
  classificationStatus?: string | null;
  postDate?: Date | null;
  stats?: { total_interactions?: number | null } | null;
  creatorInfo?: { communityInspirationOptIn?: boolean | null } | null;
};

class ClassificationApiError extends Error {
  kind: ClassificationAiFailureKind;
  retryAfterMs?: number;

  constructor(kind: ClassificationAiFailureKind, message: string, retryAfterMs?: number) {
    super(message);
    this.name = "ClassificationApiError";
    this.kind = kind;
    this.retryAfterMs = retryAfterMs;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

function parseRetryAfterMs(retryAfterHeader: string | null): number | undefined {
  if (!retryAfterHeader) return undefined;
  const retryAfterSeconds = Number.parseFloat(retryAfterHeader);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }
  return undefined;
}

async function extractOpenAiError(response: Response): Promise<{
  message: string;
  kind: ClassificationAiFailureKind;
  retryAfterMs?: number;
}> {
  const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));

  let rawMessage = `${response.status} ${response.statusText}`;
  const contentType = response.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const errorBody = await response.json();
      rawMessage =
        errorBody?.error?.message ||
        errorBody?.message ||
        JSON.stringify(errorBody);
    } else {
      const errorBody = await response.text();
      if (errorBody.trim()) rawMessage = errorBody;
    }
  } catch (error) {
    logger.warn(`${SCRIPT_TAG} Falha ao ler erro da OpenAI.`, error);
  }

  return {
    message: rawMessage,
    kind: classifyAiFailureMessage(rawMessage),
    retryAfterMs,
  };
}

async function classifyContent(description: string): Promise<ClassificationResult> {
  const payload = buildClassificationOpenAiPayload(description, OPENAI_CLASSIFICATION_MODEL);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("A variável de ambiente OPENAI_API_KEY não está definida.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const openAiError = await extractOpenAiError(response);
    if (openAiError.kind !== "other" || response.status === 429) {
      throw new ClassificationApiError(
        openAiError.kind === "other" ? "rate_limit" : openAiError.kind,
        openAiError.message,
        openAiError.retryAfterMs
      );
    }

    throw new Error(
      `A API da OpenAI retornou um erro: ${response.status} ${response.statusText} - ${openAiError.message}`
    );
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("A resposta da OpenAI nao continha os dados de classificacao esperados.");
  }

  return normalizeClassificationResponse(JSON.parse(content));
}

function buildStrategicEmptyMatch() {
  return STRATEGIC_FIELDS.reduce<Record<string, unknown>>((acc, field) => {
    acc[field] = { $in: [[], null] };
    return acc;
  }, {});
}

async function fetchCandidates({
  days,
  limit,
  optInOnly,
}: {
  days: number;
  limit?: number;
  optInOnly: boolean;
}) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const pipeline: PipelineStage[] = [
    {
      $match: {
        ...buildStrategicEmptyMatch(),
        description: { $exists: true, $ne: "" },
        postDate: { $gte: cutoffDate },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "creatorInfo",
      },
    },
    { $unwind: { path: "$creatorInfo", preserveNullAndEmptyArrays: true } },
  ];

  if (optInOnly) {
    pipeline.push({ $match: { "creatorInfo.communityInspirationOptIn": true } });
  }

  pipeline.push(
    { $sort: { postDate: -1, "stats.total_interactions": -1 } },
    {
      $project: {
        _id: 1,
        description: 1,
        source: 1,
        type: 1,
        format: 1,
        proposal: 1,
        context: 1,
        tone: 1,
        references: 1,
        contentIntent: 1,
        narrativeForm: 1,
        contentSignals: 1,
        stance: 1,
        proofStyle: 1,
        commercialMode: 1,
        classificationStatus: 1,
        postDate: 1,
        stats: 1,
        creatorInfo: { communityInspirationOptIn: "$creatorInfo.communityInspirationOptIn" },
      },
    }
  );

  if (limit) {
    pipeline.push({ $limit: limit });
  }

  return Metric.aggregate<CandidateMetric>(pipeline).exec();
}

async function run() {
  const dryRun = !hasFlag("--write");
  const limit = readNumberFlag("--limit");
  const days = readNumberFlag("--days") ?? 180;
  const optInOnly = !hasFlag("--include-non-opt-in");
  const sleepMs = readNumberFlag("--sleep-ms") ?? 350;

  logger.info(`${SCRIPT_TAG} Iniciando reclassificacao seletiva.`, {
    dryRun,
    limit: limit ?? null,
    days,
    optInOnly,
    sleepMs,
    model: OPENAI_CLASSIFICATION_MODEL,
  });

  try {
    await connectToDatabase();

    const candidates = await fetchCandidates({ days, limit, optInOnly });

    if (candidates.length === 0) {
      logger.info(`${SCRIPT_TAG} Nenhum candidato encontrado para reclassificacao seletiva.`);
      return;
    }

    logger.info(`${SCRIPT_TAG} Candidatos encontrados.`, {
      count: candidates.length,
      sample: candidates.slice(0, 5).map((candidate) => ({
        id: String(candidate._id),
        postDate: candidate.postDate ?? null,
        interactions: candidate.stats?.total_interactions ?? null,
        optIn: candidate.creatorInfo?.communityInspirationOptIn ?? null,
        descriptionPreview: candidate.description.slice(0, 120),
      })),
    });

    if (dryRun) {
      return;
    }

    let successCount = 0;
    let failCount = 0;
    let deferredCount = 0;

    for (const candidate of candidates) {
      let retries = 3;
      let classified = false;
      let lastRateLimitError: ClassificationApiError | null = null;

      while (retries > 0 && !classified) {
        try {
          const classificationResult = await classifyContent(candidate.description);
          const updateData: Partial<IMetric> = {
            ...buildMetricClassificationUpdate(candidate, classificationResult),
            classificationStatus: "completed",
            classificationError: null,
          };

          await Metric.updateOne({ _id: candidate._id }, { $set: updateData });
          successCount += 1;
          classified = true;

          logger.info(`${SCRIPT_TAG} Item reclassificado com sucesso.`, {
            id: String(candidate._id),
            successCount,
          });

          await sleep(sleepMs);
        } catch (error) {
          if (error instanceof ClassificationApiError && error.kind === "rate_limit") {
            lastRateLimitError = error;
            const waitMatch = error.message.match(/Please try again in ([\d.]+)s/i);
            const retryAfterSeconds = waitMatch?.[1];
            const waitTime =
              error.retryAfterMs ??
              (retryAfterSeconds ? (Number.parseFloat(retryAfterSeconds) + 0.5) * 1000 : 60000);

            logger.warn(`${SCRIPT_TAG} Rate limit atingido.`, {
              id: String(candidate._id),
              retriesRemaining: retries - 1,
              waitTimeMs: waitTime,
            });

            await sleep(waitTime);
            retries -= 1;
          } else {
            const errorMessage =
              error instanceof Error ? error.message : "Erro desconhecido durante a reclassificacao.";
            const failureKind =
              error instanceof ClassificationApiError
                ? error.kind
                : classifyAiFailureMessage(errorMessage);

            if (failureKind !== "other") {
              await Metric.updateOne(
                { _id: candidate._id },
                {
                  $set: {
                    classificationStatus: "pending",
                    classificationError: buildDeferredClassificationErrorMessage(failureKind),
                    ...createEmptyMetricClassificationUpdate(),
                  },
                }
              );
              deferredCount += 1;
            } else {
              await Metric.updateOne(
                { _id: candidate._id },
                {
                  $set: {
                    classificationStatus: "failed",
                    classificationError: `Erro na IA: ${errorMessage}`,
                    ...createEmptyMetricClassificationUpdate(),
                  },
                }
              );
              failCount += 1;
            }

            logger.error(`${SCRIPT_TAG} Falha na reclassificacao seletiva.`, {
              id: String(candidate._id),
              failureKind,
              errorMessage,
            });

            break;
          }
        }
      }

      if (!classified && lastRateLimitError) {
        await Metric.updateOne(
          { _id: candidate._id },
          {
            $set: {
              classificationStatus: "pending",
              classificationError: buildDeferredClassificationErrorMessage("rate_limit"),
              ...createEmptyMetricClassificationUpdate(),
            },
          }
        );
        deferredCount += 1;
      }
    }

    logger.info(`${SCRIPT_TAG} Reclassificacao seletiva concluida.`, {
      processed: candidates.length,
      successCount,
      deferredCount,
      failCount,
    });
  } catch (error) {
    logger.error(`${SCRIPT_TAG} Falha critica na reclassificacao seletiva.`, error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void run();
