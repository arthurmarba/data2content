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
  formatCategories,
  proposalCategories,
  contextCategories,
  toneCategories,
  referenceCategories,
  Category,
  canonicalizeCategoryValues,
} from '@/app/lib/classification';

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

// --- Lógica de Classificação Otimizada ---

interface ClassificationResult {
  format: string[];
  proposal: string[];
  context: string[];
  tone: string[];
  references: string[];
}

const resolveFormatForMetric = (
  metric: Pick<IMetric, 'source' | 'format' | 'type'>,
  classification: ClassificationResult
): string[] => {
  if (metric.source === 'api') {
    switch (metric.type) {
      case 'REEL':
      case 'VIDEO':
        return ['reel'];
      case 'IMAGE':
        return ['photo'];
      case 'CAROUSEL_ALBUM':
        return ['carousel'];
      default:
        return [];
    }
  }
  return canonicalizeCategoryValues(classification.format, 'format');
};

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

const buildCategoryDescriptions = (categories: Category[]): string => {
  return categories.map(cat => {
    let desc = `- **${cat.id} (${cat.label}):** ${cat.description}`;
    if (cat.examples && cat.examples.length > 0) {
      desc += ` (Ex: "${cat.examples.join('", "')}")`;
    }
    if (cat.subcategories && cat.subcategories.length > 0) {
      desc += `\n  Subcategorias:\n` + cat.subcategories.map(sub => `    - **${sub.id} (${sub.label}):** ${sub.description}`).join('\n');
    }
    return desc;
  }).join('\n');
};

function normalizeClassification(rawResult: any): ClassificationResult {
    const normalized: ClassificationResult = {
        format: [], proposal: [], context: [], tone: [], references: [],
    };
    const keyMapping: { [K in keyof ClassificationResult]: string[] } = {
        format: ['format', 'formato do conteúdo', 'formato'],
        proposal: ['proposal', 'proposta'],
        context: ['context', 'contexto'],
        tone: ['tone', 'tom'],
        references: ['references', 'referências', 'referencias'],
    };

    const flattenValue = (value: any): string[] => {
        if (Array.isArray(value)) {
            return value.flatMap(flattenValue);
        }
        if (typeof value === 'object' && value !== null) {
            return flattenValue(Object.values(value));
        }
        if (typeof value === 'string') {
            return [value];
        }
        return [];
    };

    for (const rawKey in rawResult) {
        const cleanedKey = rawKey.toLowerCase().replace(/[\d.]/g, '').trim();
        const standardKey = Object.keys(keyMapping).find(k => 
            keyMapping[k as keyof ClassificationResult].includes(cleanedKey)
        ) as keyof ClassificationResult | undefined;

        if (standardKey) {
            const value = rawResult[rawKey];
            const flatValues = flattenValue(value);
            normalized[standardKey].push(...flatValues);
        }
    }
    
    for (const key in normalized) {
        const typedKey = key as keyof ClassificationResult;
        normalized[typedKey] = [...new Set(normalized[typedKey])].filter(v => typeof v === 'string' && v.length > 0);
    }
    return normalized;
}


async function classifyContent(description: string): Promise<ClassificationResult> {
    const TAG = '[classifyContent_Final_Optimized]';
    if (!description || description.trim() === '') {
        return { format: [], proposal: [], context: [], tone: [], references: [] };
    }

    // ATUALIZAÇÃO FINAL: O prompt agora contém todas as regras que descobrimos.
    const systemPrompt = `
      Você é um especialista em análise de conteúdo de mídias sociais. Sua tarefa é analisar a descrição de um post, incluindo as hashtags, e classificá-lo em CINCO dimensões.

      **REGRAS CRÍTICAS PARA SEGUIR:**
      1.  **USE APENAS IDs:** Sua resposta DEVE conter apenas os IDs das categorias fornecidas. NUNCA use os rótulos em texto (ex: use 'humor_scene', não 'Humor/Cena').
      2.  **NÃO INVENTE CATEGORIAS:** Use EXCLUSIVAMENTE os IDs da lista. Se uma categoria não se encaixar perfeitamente, escolha a mais próxima ou retorne um array vazio.
      3.  **HASHTAGS SÃO A CHAVE:** Analise as hashtags (#) com muita atenção. Elas são a pista principal para definir o 'Contexto' e também podem indicar a 'Proposta' (ex: #humor indica a proposta 'humor_scene').
      4.  **PREFIRA A ESPECIFICIDADE:** Ao classificar 'Contexto' e 'Referências', se uma subcategoria se aplicar, prefira sempre o ID da subcategoria em vez do ID da categoria principal.
      5.  **DETECTE O TOM:** Preste atenção em palavras e emojis. Risadas (haha, kkk) indicam o tom 'humorous'. Emojis de coração (💖) ou palavras de encorajamento indicam 'inspirational'.
      6.  **SAÍDA JSON:** Sua resposta final deve ser APENAS o objeto JSON, sem nenhum texto adicional antes ou depois.
    `;

    const userPrompt = `**Descrição:**\n"${description}"\n\n**Categorias:**\nFormato: ${buildCategoryDescriptions(formatCategories)}\nProposta: ${buildCategoryDescriptions(proposalCategories)}\nContexto: ${buildCategoryDescriptions(contextCategories)}\nTom: ${buildCategoryDescriptions(toneCategories)}\nReferências: ${buildCategoryDescriptions(referenceCategories)}`;

    const payload = {
      model: OPENAI_CLASSIFICATION_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    };
    
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
        const normalizedResult = normalizeClassification(parsedJson);
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
            format: resolveFormatForMetric(metric as IMetric, classificationResult),
            proposal: canonicalizeCategoryValues(classificationResult.proposal, 'proposal'),
            context: canonicalizeCategoryValues(classificationResult.context, 'context'),
            tone: canonicalizeCategoryValues(classificationResult.tone, 'tone'),
            references: canonicalizeCategoryValues(classificationResult.references, 'reference'),
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
                ...(failureKind === 'other'
                  ? {}
                  : {
                      format: [],
                      proposal: [],
                      context: [],
                      tone: [],
                      references: [],
                    }),
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
                format: [],
                proposal: [],
                context: [],
                tone: [],
                references: [],
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
