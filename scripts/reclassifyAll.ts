/**
 * @fileoverview Script de migração (backfill) para reclassificar todos os posts existentes usando a API da OpenAI.
 * @version 3.0.0 - Lógica de classificação final otimizada com base na análise de casos.
 * @description Este script busca todos os posts pendentes, aplica a lógica de classificação
 * otimizada e atualiza os documentos no banco de dados.
 *
 * @run `npm run reclassify`
 */

import mongoose from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import Metric, { IMetric } from '@/app/models/Metric';
import { logger } from '@/app/lib/logger';
import {
  buildDeferredClassificationErrorMessage,
  classifyAiFailureMessage,
  type ClassificationAiFailureKind,
} from '@/app/lib/classificationAiErrors';
import {
  buildClassificationOpenAiPayload,
  buildMetricClassificationUpdate,
  createEmptyMetricClassificationUpdate,
  getEmptyClassificationResult,
  normalizeClassificationResponse,
  type ClassificationResult,
} from '@/app/lib/classificationRuntime';

const SCRIPT_TAG = '[MIGRATION_SCRIPT_RECLASSIFY_ALL_OPENAI_FINAL]';
const OPENAI_CLASSIFICATION_MODEL =
  process.env.OPENAI_CLASSIFIER_MODEL?.trim() || 'gpt-4o-mini';

class ClassificationApiError extends Error {
  kind: ClassificationAiFailureKind;
  retryAfterMs?: number;

  constructor(kind: ClassificationAiFailureKind, message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'ClassificationApiError';
    this.kind = kind;
    this.retryAfterMs = retryAfterMs;
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
  const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
  let rawMessage = `${response.status} ${response.statusText}`;
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const errorBody = await response.json();
    rawMessage =
      errorBody?.error?.message ||
      errorBody?.message ||
      JSON.stringify(errorBody);
  } else {
    const errorBody = await response.text();
    if (errorBody.trim()) rawMessage = errorBody;
  }

  return {
    message: rawMessage,
    kind: classifyAiFailureMessage(rawMessage),
    retryAfterMs,
  };
}

async function classifyContent(description: string): Promise<ClassificationResult> {
    const TAG = '[classifyContent_Final_Optimized]';
    if (!description || description.trim() === '') {
        return getEmptyClassificationResult();
    }
    const payload = buildClassificationOpenAiPayload(description, OPENAI_CLASSIFICATION_MODEL);
    
    const apiKey = process.env.OPENAI_API_KEY; 
    if (!apiKey) throw new Error("A variável de ambiente OPENAI_API_KEY não está definida.");
    
    const apiUrl = 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const openAiError = await extractOpenAiError(response);
        if (openAiError.kind !== 'other' || response.status === 429) {
            throw new ClassificationApiError(
                openAiError.kind === 'other' ? 'rate_limit' : openAiError.kind,
                openAiError.message,
                openAiError.retryAfterMs
            );
        }
        throw new Error(`A API da OpenAI retornou um erro: ${response.status} ${response.statusText} - ${openAiError.message}`);
    }

    const result = await response.json();
    
    if (result.choices?.[0]?.message?.content) {
        const content = result.choices[0].message.content;
        const parsedJson = JSON.parse(content);
        const normalizedResult = normalizeClassificationResponse(parsedJson);
        logger.info(`${TAG} Classificação recebida e normalizada: ${JSON.stringify(normalizedResult)}`);
        return normalizedResult;
    } else {
        throw new Error("A resposta da OpenAI não continha os dados de classificação esperados.");
    }
}


// --- Função Principal do Script ---
async function reclassifyAllMetrics() {
  logger.info(`${SCRIPT_TAG} Iniciando script de reclassificação...`);

  try {
    await connectToDatabase();
    logger.info(`${SCRIPT_TAG} Conexão com o banco de dados estabelecida.`);

    const pendingMetrics = await Metric.find({
      classificationStatus: 'pending',
      description: { $exists: true, $ne: "" }
    }).select('_id description source type format').lean();

    if (pendingMetrics.length === 0) {
      logger.info(`${SCRIPT_TAG} Nenhum post pendente de classificação encontrado. Encerrando.`);
      return;
    }

    logger.info(`${SCRIPT_TAG} ${pendingMetrics.length} posts encontrados para reclassificação.`);

    let successCount = 0;
    let failCount = 0;

    for (const metric of pendingMetrics) {
      let retries = 3;
      let classified = false;
      let lastRateLimitError: ClassificationApiError | null = null;
      let failureCounted = false;

      while (retries > 0 && !classified) {
        try {
          const classificationResult = await classifyContent(metric.description);

          const updateData: Partial<IMetric> = {
            ...buildMetricClassificationUpdate(metric, classificationResult),
            classificationStatus: 'completed',
            classificationError: null,
          };

          await Metric.updateOne({ _id: metric._id }, { $set: updateData });
          logger.info(`${SCRIPT_TAG} Post ${metric._id} classificado e atualizado com sucesso.`);
          successCount++;
          classified = true;

          await sleep(500);

        } catch (error: any) {
          if (error instanceof ClassificationApiError && error.kind === 'rate_limit') {
            lastRateLimitError = error;
            const waitMatch = error.message.match(/Please try again in ([\d.]+)s/i);
            const retryAfterSeconds = waitMatch?.[1];
            const waitTime =
              error.retryAfterMs ??
              (retryAfterSeconds ? (parseFloat(retryAfterSeconds) + 0.5) * 1000 : 60000);
            logger.warn(`${SCRIPT_TAG} Rate limit atingido. Aguardando ${waitTime / 1000} segundos para tentar novamente...`);
            await sleep(waitTime);
            retries--;
          } else {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido durante a reclassificação.';
            const failureKind =
              error instanceof ClassificationApiError ? error.kind : classifyAiFailureMessage(errorMessage);

            logger.error(`${SCRIPT_TAG} Falha ao classificar o post ${metric._id}: ${errorMessage}`);
            await Metric.updateOne({ _id: metric._id }, {
              $set: {
                classificationStatus: failureKind === 'other' ? 'failed' : 'pending',
                classificationError:
                  failureKind === 'other'
                    ? errorMessage
                    : buildDeferredClassificationErrorMessage(failureKind),
                ...createEmptyMetricClassificationUpdate(),
              }
            });
            failCount++;
            failureCounted = true;
            break;
          }
        }
      }
      if (!classified) {
        if (lastRateLimitError) {
          await Metric.updateOne(
            { _id: metric._id },
            {
              $set: {
                classificationStatus: 'pending',
                classificationError: buildDeferredClassificationErrorMessage('rate_limit'),
                ...createEmptyMetricClassificationUpdate(),
              },
            }
          );
        }
        logger.error(`${SCRIPT_TAG} Não foi possível classificar o post ${metric._id} após múltiplas tentativas.`);
        if (!failureCounted) failCount++;
      }
    }

    logger.info(`${SCRIPT_TAG} Processo de reclassificação concluído.`);
    logger.info(`${SCRIPT_TAG} Sucesso: ${successCount} | Falhas: ${failCount}`);

  } catch (error) {
    logger.error(`${SCRIPT_TAG} Um erro crítico ocorreu durante a execução do script:`, error);
  } finally {
    await mongoose.disconnect();
    logger.info(`${SCRIPT_TAG} Conexão com o banco de dados encerrada.`);
  }
}

// Executa a função principal
reclassifyAllMetrics();
