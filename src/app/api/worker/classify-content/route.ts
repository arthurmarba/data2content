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
} from "@/app/lib/classificationAiErrors";
import {
  buildMetricClassificationUpdate,
  createEmptyMetricClassificationUpdate,
} from "@/app/lib/classificationRuntime";
import { classifyContentWithAi } from "@/app/lib/classificationAiProvider";
import mongoose from "mongoose";

export const runtime = "nodejs";

// As signing keys são SEPARADAS do QSTASH_TOKEN: o token publica a tarefa, as
// signing keys verificam a entrega aqui no worker. Se faltarem (erro comum: configurar
// só o QSTASH_TOKEN), TODA entrega vira 401 "Invalid signature" e nenhuma métrica é
// classificada — o card "Sua Audiência" fica preso em "Processando" para sempre, sem
// erro visível. Logamos explicitamente para que essa falha de config seja diagnosticável.
const QSTASH_SIGNING_KEYS_PRESENT = Boolean(
    process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY,
);
if (!QSTASH_SIGNING_KEYS_PRESENT) {
    logger.error(
        "[classify-content] QSTASH_CURRENT_SIGNING_KEY/QSTASH_NEXT_SIGNING_KEY ausentes — " +
        "a verificação de assinatura vai rejeitar TODA entrega (401) e a classificação de " +
        "conteúdo não vai rodar. Configure as duas signing keys do QStash em produção.",
    );
}

const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

async function handlerLogic(request: NextRequest): Promise<NextResponse> { // Adicionado tipo de retorno explícito
    const TAG = '[Worker Classify Content v5.0.1]';

    let metricId: string | undefined;
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

        logger.debug(`${TAG} Chamando o classificador Gemini-first para Metric ${metricId}...`);
        const aiResult = await classifyContentWithAi(metricDoc.description);
        const updateData: Partial<IMetric> = {
            ...buildMetricClassificationUpdate(metricDoc, aiResult.classification),
            classificationStatus: 'completed',
            classificationError: null,
        };

        await Metric.updateOne({ _id: metricDoc._id }, { $set: updateData });
        logger.info(
            `${TAG} Metric ${metricId} classificado. provider=${aiResult.provider} model=${aiResult.model}`,
        );
        return NextResponse.json({
            message: "Classificação concluída e métrica atualizada.",
            provider: aiResult.provider,
            model: aiResult.model,
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        const finalMetricId = metricId || 'ID_DESCONHECIDO';
        const failureKind = classifyAiFailureMessage(errorMessage);
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
        if (!QSTASH_SIGNING_KEYS_PRESENT) {
            // Sinaliza a causa real (config ausente) em vez de mascarar como assinatura inválida.
            logger.error(`${TAG_POST} Signing keys do QStash ausentes — classificação desabilitada por config.`);
            return new NextResponse("QStash signing keys not configured", { status: 500 });
        }
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
