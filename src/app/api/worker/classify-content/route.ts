/**
 * @fileoverview API Endpoint (Worker) for classifying content based on its description.
 * @version 5.0.1 - Fixed a code path that did not return a value.
 */

import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric, { IMetric } from "@/app/models/Metric";
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
  getEmptyClassificationResult,
  normalizeClassificationResponse,
  type ClassificationResult,
} from "@/app/lib/classificationRuntime";
import mongoose from "mongoose";

const OPENAI_CLASSIFICATION_MODEL =
  process.env.OPENAI_CLASSIFIER_MODEL?.trim() || "gpt-4o-mini";

export const runtime = "nodejs";

const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

// --- Função de Classificação Otimizada com OpenAI ---

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    logger.warn("[classifyContent_Final_Optimized] Falha ao ler corpo de erro da OpenAI.", error);
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
        if (openAiError.kind !== "other" || response.status === 429) {
            throw new ClassificationApiError(
                openAiError.kind === "other" ? "rate_limit" : openAiError.kind,
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


async function handlerLogic(request: NextRequest): Promise<NextResponse> { // Adicionado tipo de retorno explícito
    const TAG = '[Worker Classify Content v5.0.1]';

    let metricId: string | undefined;
    let lastRateLimitError: ClassificationApiError | null = null;

    try {
        const body = await request.json();
        metricId = body.metricId;
        logger.info(`${TAG} Assinatura verificada. Recebida tarefa para Metric ID: ${metricId}`);

        if (!metricId || !mongoose.isValidObjectId(metricId)) {
            logger.error(`${TAG} Erro: metricId inválido ou ausente no payload: ${metricId}`);
            return NextResponse.json({ error: "Metric ID inválido ou ausente" }, { status: 400 });
        }

        await connectToDatabase();
        logger.debug(`${TAG} Conectado ao BD.`);

        const metricDoc = await Metric.findById(metricId);

        if (!metricDoc) {
            logger.warn(`${TAG} Métrica com ID ${metricId} não encontrada no DB. Tarefa ignorada.`);
            return NextResponse.json({ message: "Métrica não encontrada." }, { status: 200 });
        }

        if (metricDoc.classificationStatus === 'completed') {
            logger.info(`${TAG} Métrica ${metricId} já classificada. Tarefa ignorada.`);
            return NextResponse.json({ message: "Métrica já classificada." }, { status: 200 });
        }
        if (!metricDoc.description || metricDoc.description.trim() === "") {
            logger.warn(`${TAG} Métrica ${metricId} não possui descrição. Impossível classificar.`);
            await Metric.updateOne(
                { _id: metricDoc._id },
                {
                  $set: {
                    classificationStatus: 'failed',
                    classificationError: 'Descrição ausente ou vazia.',
                    ...createEmptyMetricClassificationUpdate(),
                  },
                }
            );
            return NextResponse.json({ message: "Métrica sem descrição para classificar." }, { status: 200 });
        }

        logger.debug(`${TAG} Chamando classifyContent para Metric ${metricId}...`);
        
        let retries = 3;
        while (retries > 0) {
            try {
                const classification = await classifyContent(metricDoc.description);
                logger.info(`${TAG} Classificação completa recebida para Metric ${metricId}: ${JSON.stringify(classification)}`);

                const updateData: Partial<IMetric> = {
                    ...buildMetricClassificationUpdate(metricDoc, classification),
                    classificationStatus: 'completed',
                    classificationError: null,
                };

                await Metric.updateOne({ _id: metricDoc._id }, { $set: updateData });
                logger.info(`${TAG} Metric ${metricId} atualizado com sucesso no DB com 5 dimensões (status: completed).`);
                
                return NextResponse.json({ message: "Classificação concluída e métrica atualizada." }, { status: 200 });

            } catch (classError: any) {
                if (classError instanceof ClassificationApiError && classError.kind === 'rate_limit') {
                    lastRateLimitError = classError;
                    const waitMatch = classError.message.match(/Please try again in ([\d.]+)s/i);
                    const retryAfterSeconds = waitMatch?.[1];
                    const waitTime =
                        classError.retryAfterMs ??
                        (retryAfterSeconds ? (parseFloat(retryAfterSeconds) + 0.5) * 1000 : 60000);
                    logger.warn(`${TAG} Rate limit atingido para Metric ${metricId}. Aguardando ${waitTime / 1000} segundos para tentar novamente...`);
                    await sleep(waitTime);
                    retries--;
                } else {
                    throw classError; // Lança outros erros para o catch principal
                }
            }
        }
        
        // CORREÇÃO: Se o loop terminar após todas as retentativas falharem, lança um erro.
        // Isso garante que este caminho também seja tratado pelo bloco catch principal,
        // cobrindo todos os caminhos de código e resolvendo o erro do TypeScript.
        throw lastRateLimitError ?? new ClassificationApiError(
            'rate_limit',
            `Não foi possível classificar o post ${metricId} após múltiplas tentativas de rate limit.`
        );

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        const finalMetricId = metricId || 'ID_DESCONHECIDO';
        const failureKind =
            error instanceof ClassificationApiError ? error.kind : classifyAiFailureMessage(errorMessage);
        logger.error(`${TAG} Falha final ao processar Metric ${finalMetricId}: ${errorMessage}`, error);
        
        if (mongoose.isValidObjectId(finalMetricId)) {
            if (failureKind !== "other") {
                const deferredMessage = buildDeferredClassificationErrorMessage(failureKind);
                await Metric.updateOne(
                    { _id: finalMetricId },
                    {
                        $set: {
                            classificationStatus: 'pending',
                            classificationError: deferredMessage,
                            ...createEmptyMetricClassificationUpdate(),
                        },
                    }
                );

                return NextResponse.json(
                    { message: deferredMessage, retryable: true, kind: failureKind },
                    { status: 503 }
                );
            }

            await Metric.updateOne(
                { _id: finalMetricId },
                {
                  $set: {
                    classificationStatus: 'failed',
                    classificationError: `Erro na IA: ${errorMessage}`,
                    ...createEmptyMetricClassificationUpdate(),
                  },
                }
            );
        }
        
        return NextResponse.json({ error: `Falha ao classificar conteúdo: ${errorMessage}` }, { status: 500 });
    }
}

export const POST = async (request: NextRequest) => {
    const TAG_POST = '[Worker Classify POST v5.0.1]';
    try {
        const signature = request.headers.get("upstash-signature");
        if (!signature) {
            logger.error(`${TAG_POST} Erro: Header 'upstash-signature' ausente.`);
            return new NextResponse("Signature header missing", { status: 401 });
        }
        const bodyAsText = await request.text();
        const isValid = await receiver.verify({
            signature: signature,
            body: bodyAsText,
        });

        if (!isValid) {
            logger.error(`${TAG_POST} Assinatura QStash inválida.`);
            return new NextResponse("Invalid signature", { status: 401 });
        }
        const newRequest = new NextRequest(request.url, {
            method: request.method,
            headers: request.headers,
            body: bodyAsText,
        });
        return await handlerLogic(newRequest);

    } catch (error) {
        logger.error(`${TAG_POST} Erro durante verificação/recriação do request:`, error);
        return NextResponse.json({ error: "Erro ao processar requisição do webhook." }, { status: 500 });
    }
};

export async function GET() {
    return NextResponse.json({ message: "Worker de classificação v5.0.1 ativo." });
}
