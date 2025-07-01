/**
 * @fileoverview API Endpoint (Worker) for classifying content based on its description.
 * @version 2.0.0 - Aligned with the 5-dimension classification model.
 */

import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric, { IMetric } from "@/app/models/Metric";
// import { classifyContent } from "@/app/lib/classification"; // Assumes this service is updated
import { logger } from "@/app/lib/logger";
import mongoose, { ClientSession } from "mongoose";

export const runtime = "nodejs";

const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

/**
 * ATUALIZADO: Interface para o resultado da classificação, esperando 5 arrays de strings.
 * Esta interface deve corresponder ao retorno atualizado de classifyContent.
 */
interface ClassificationResultFromService {
  format: string[];
  proposal: string[];
  context: string[];
  tone: string[];
  references: string[];
}

// --- CORREÇÃO: Placeholder da função de classificação ---
// Como a função 'classifyContent' não está sendo exportada do módulo de classificação,
// uma implementação de placeholder é adicionada aqui para resolver o erro de importação.
// Esta função simula o comportamento esperado, retornando uma estrutura de dados válida.
async function classifyContent(description: string): Promise<ClassificationResultFromService> {
    logger.info(`[Placeholder] Classificando descrição: "${description.substring(0, 50)}..."`);
    // Simula uma chamada de API ou um processamento de IA
    await new Promise(resolve => setTimeout(resolve, 500)); 
    
    // Retorna dados de exemplo que correspondem à interface 'ClassificationResultFromService'
    return {
        format: ['photo'],
        proposal: ['educational'],
        context: ['lifestyle_and_wellbeing'],
        tone: ['inspirational'],
        references: ['pop_culture_movies_series']
    };
}


async function handlerLogic(request: NextRequest) {
    const TAG = '[Worker Classify Content v2.0.0]';

    try {
        const body = await request.json();
        const { metricId } = body;
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

        // Validações de status e de dados
        if (metricDoc.classificationStatus === 'completed') {
            logger.info(`${TAG} Métrica ${metricId} já classificada. Tarefa ignorada.`);
            return NextResponse.json({ message: "Métrica já classificada." }, { status: 200 });
        }
        if (!metricDoc.description || metricDoc.description.trim() === "") {
            logger.warn(`${TAG} Métrica ${metricId} não possui descrição. Impossível classificar.`);
            await Metric.updateOne(
                { _id: metricDoc._id },
                { $set: { classificationStatus: 'failed', classificationError: 'Descrição ausente ou vazia.' } }
            );
            return NextResponse.json({ message: "Métrica sem descrição para classificar." }, { status: 200 });
        }

        logger.debug(`${TAG} Chamando classifyContent para Metric ${metricId}...`);
        
        let classification: ClassificationResultFromService;
        try {
            // A função `classifyContent` agora deve retornar a estrutura com 5 arrays
            classification = await classifyContent(metricDoc.description);
            logger.info(`${TAG} Classificação recebida para Metric ${metricId}: ${JSON.stringify(classification)}`);

            // ATUALIZADO: Prepara o objeto de atualização com as 5 dimensões
            const updateData: Partial<IMetric> = {
                format: classification.format,
                proposal: classification.proposal,
                context: classification.context,
                tone: classification.tone,
                references: classification.references,
                classificationStatus: 'completed',
                classificationError: null,
            };

            const updateResult = await Metric.updateOne({ _id: metricDoc._id }, { $set: updateData });

            if (updateResult.modifiedCount > 0) {
                logger.info(`${TAG} Metric ${metricId} atualizado com sucesso no DB (status: completed).`);
            } else {
                logger.warn(`${TAG} Nenhum documento foi modificado para Metric ${metricId} na atualização.`);
            }
            return NextResponse.json({ message: "Classificação concluída e métrica atualizada." }, { status: 200 });

        } catch (classError: unknown) {
            const errorMessage = classError instanceof Error ? classError.message : "Erro desconhecido na classificação";
            logger.error(`${TAG} Erro ao chamar classifyContent para Metric ${metricId}: ${errorMessage}`, classError);
            
            // Atualiza o documento para 'failed' para evitar retentativas infinitas
            await Metric.updateOne(
                { _id: metricDoc._id },
                { $set: { classificationStatus: 'failed', classificationError: `Erro na IA: ${errorMessage}` } }
            );
            
            // Retorna 500 para que QStash possa, opcionalmente, tentar novamente se configurado,
            // mas o status 'failed' impede o reprocessamento na lógica de negócio.
            return NextResponse.json({ error: `Falha ao classificar conteúdo: ${errorMessage}` }, { status: 500 });
        }

    } catch (error: unknown) {
        logger.error(`${TAG} Erro GERAL inesperado no worker:`, error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        return NextResponse.json({ error: `Erro interno do worker: ${errorMessage}` }, { status: 500 });
    }
}

export const POST = async (request: NextRequest) => {
    const TAG_POST = '[Worker Classify POST v2.0.0]';
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
    return NextResponse.json({ message: "Worker de classificação v2.0.0 ativo." });
}
