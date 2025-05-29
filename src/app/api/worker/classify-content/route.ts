// @/app/api/worker/classify-content/route.ts - v1.7 (Alinha com IMetric Enums)
// - ATUALIZADO: Assume que classifyContent retorna tipos Enum e ajusta a atribuição.

import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric, { IMetric } from "@/app/models/Metric"; // Usa IMetric atualizado (v1.5.0+ com Enums)
import { classifyContent } from "@/app/lib/classification"; // Espera-se que classifyContent seja atualizado para retornar Enums
import { logger } from "@/app/lib/logger";
import mongoose, { ClientSession } from "mongoose";
import {
    FormatType,
    ProposalType,
    ContextType,
    // Importar os valores DEFAULT dos enums se precisar de fallbacks explícitos aqui
    // DEFAULT_PROPOSAL_ENUM,
    // DEFAULT_CONTEXT_ENUM,
    // DEFAULT_FORMAT_ENUM
} from "@/app/lib/constants/communityInspirations.constants";

export const runtime = "nodejs";

const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

/**
 * Interface para o resultado da classificação, esperando os tipos Enum.
 * Esta interface deve corresponder ao retorno atualizado de classifyContent.
 */
interface ClassificationResultFromService {
  format: FormatType; // Espera-se que classifyContent retorne FormatType
  proposal: ProposalType; // Espera-se que classifyContent retorne ProposalType
  context: ContextType; // Espera-se que classifyContent retorne ContextType
}

async function handlerLogic(request: NextRequest) {
    const TAG = '[Worker Classify Content v1.7]';

    let session: ClientSession | null = null;

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
        if (!['api', 'manual'].includes(metricDoc.source)) {
             logger.warn(`${TAG} Métrica ${metricId} tem source inválida (${metricDoc.source}). Classificação não aplicável.`);
             return NextResponse.json({ message: "Classificação não aplicável para esta fonte." }, { status: 200 });
        }
        if (metricDoc.classificationStatus === 'completed') {
            logger.info(`${TAG} Métrica ${metricId} já classificada (status: completed). Tarefa ignorada.`);
            return NextResponse.json({ message: "Métrica já classificada." }, { status: 200 });
        }
        if (metricDoc.classificationStatus === 'failed') {
             logger.warn(`${TAG} Métrica ${metricId} falhou anteriormente (status: failed). Ignorando retentativa automática.`);
             return NextResponse.json({ message: "Classificação falhou anteriormente." }, { status: 200 });
        }
        if (!metricDoc.description || metricDoc.description.trim() === "") {
            logger.warn(`${TAG} Métrica ${metricId} não possui descrição. Impossível classificar.`);
            try {
                await Metric.updateOne(
                    { _id: metricDoc._id },
                    { $set: { classificationStatus: 'failed', classificationError: 'Descrição ausente ou vazia.' } }
                );
                logger.info(`${TAG} Status da Métrica ${metricId} atualizado para 'failed' (sem descrição).`);
            } catch (dbUpdateError) {
                 logger.error(`${TAG} Erro ao atualizar status para 'failed' (sem descrição) Metric ${metricId}:`, dbUpdateError);
                 return NextResponse.json({ error: "Falha ao atualizar status da métrica no banco de dados." }, { status: 500 });
            }
            return NextResponse.json({ message: "Métrica sem descrição para classificar." }, { status: 200 });
        }

        logger.debug(`${TAG} Chamando classifyContent para Metric ${metricId}...`);
        let classification: ClassificationResultFromService; // Usa a interface com tipos Enum
        try {
            // É crucial que classifyContent AGORA retorne os tipos Enum corretos.
            // Se classifyContent ainda retorna strings genéricas, um erro de tipo ocorrerá aqui,
            // ou será necessário um cast (o que não é ideal).
            classification = await classifyContent(metricDoc.description) as ClassificationResultFromService;
            logger.info(`${TAG} Classificação recebida para Metric ${metricId}: P=${classification.proposal}, C=${classification.context}, F=${classification.format}`);

            try {
                // ATUALIZADO: Atribuição direta, assumindo que 'classification' já contém os tipos Enum corretos
                // e que os defaults de 'classifyContent' também são valores de Enum válidos.
                const updateData: Partial<IMetric> = {
                    proposal: classification.proposal, // Agora é ProposalType
                    context: classification.context,   // Agora é ContextType
                    classificationStatus: 'completed',
                    classificationError: null
                };

                // O format "Desconhecido" é um valor Enum válido.
                // Atualiza formato apenas se for diferente do existente e não for o default "Desconhecido"
                // (a menos que o existente também fosse "Desconhecido" e a IA classificou como algo melhor).
                if (classification.format !== metricDoc.format && classification.format !== "Desconhecido") {
                    updateData.format = classification.format; // Agora é FormatType
                    logger.info(`${TAG} Atualizando também o formato para '${classification.format}' para Metric ${metricId}.`);
                } else if (classification.format === "Desconhecido" && metricDoc.format && metricDoc.format !== "Desconhecido") {
                    // Se a IA classificou como Desconhecido mas já havia um formato válido, não sobrescrever com Desconhecido.
                    logger.info(`${TAG} Formato classificado como 'Desconhecido', mantendo formato existente '${metricDoc.format}' para Metric ${metricId}.`);
                } else if (classification.format && classification.format !== "Desconhecido") {
                    // Se o formato classificado é o mesmo que o existente (e não é desconhecido), ou se o existente era desconhecido
                    // e o novo é um formato válido, pode-se atualizar ou não, dependendo da lógica desejada.
                    // Para simplificar, a lógica acima (if classification.format !== metricDoc.format ...) já cobre isso.
                    // Se classification.format for válido e diferente de metricDoc.format, ele será atualizado.
                }


                const updateResult = await Metric.updateOne( { _id: metricDoc._id }, { $set: updateData });

                if (updateResult.modifiedCount > 0) {
                    logger.info(`${TAG} Metric ${metricId} atualizado com sucesso no DB (status: completed).`);
                } else {
                    logger.warn(`${TAG} Nenhum documento foi modificado para Metric ${metricId} na atualização de sucesso.`);
                }
                return NextResponse.json({ message: "Classificação concluída e métrica atualizada." }, { status: 200 });

            } catch (dbError) {
                logger.error(`${TAG} Erro ao atualizar Metric ${metricId} no DB após classificação bem-sucedida:`, dbError);
                return NextResponse.json({ error: "Falha ao salvar classificação no banco de dados." }, { status: 500 });
            }

        } catch (classError: unknown) {
            const errorMessage = classError instanceof Error ? classError.message : "Erro desconhecido na classificação";
            logger.error(`${TAG} Erro ao chamar classifyContent para Metric ${metricId}: ${errorMessage}`, classError);
            logger.warn(`${TAG} Erro na classificação para Metric ${metricId}. Solicitando retentativa (500).`);
            return NextResponse.json({ error: `Falha ao classificar conteúdo: ${errorMessage}` }, { status: 500 });
        }

    } catch (error: unknown) {
        logger.error(`${TAG} Erro GERAL inesperado no worker:`, error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        return NextResponse.json({ error: `Erro interno do worker: ${errorMessage}` }, { status: 500 });
    }
}

export const POST = async (request: NextRequest) => {
    const TAG_POST = '[Worker Classify POST v1.7]';
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
    return NextResponse.json({ message: "Worker de classificação v1.7 ativo." });
}
