// src/app/api/worker/classify-content/route.ts - v1.6 (Correção Erro Permanente)

import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric, { IMetric } from "@/app/models/Metric"; // Usa IMetric atualizado
// <<< REMOVIDO: Importação de PermanentClassificationError >>>
import { classifyContent } from "@/app/lib/classification";
import { logger } from "@/app/lib/logger";
import mongoose, { ClientSession } from "mongoose";

export const runtime = "nodejs";

// Instanciar o Receiver (mantido)
const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

/**
 * Handler principal da lógica do worker.
 * ATUALIZADO v1.6: Remove checagem de PermanentClassificationError.
 */
async function handlerLogic(request: NextRequest) {
    const TAG = '[Worker Classify Content v1.6]'; // Tag atualizada

    let session: ClientSession | null = null;

    try {
        // 1. Extrair corpo da requisição
        const body = await request.json();
        const { metricId } = body;
        logger.info(`${TAG} Assinatura verificada. Recebida tarefa para Metric ID: ${metricId}`);

        // 2. Validar metricId
        if (!metricId || !mongoose.isValidObjectId(metricId)) {
            logger.error(`${TAG} Erro: metricId inválido ou ausente no payload: ${metricId}`);
            // Retorna 400 - não retentar
            return NextResponse.json({ error: "Metric ID inválido ou ausente" }, { status: 400 });
        }

        // 3. Conectar ao Banco de Dados
        await connectToDatabase();
        logger.debug(`${TAG} Conectado ao BD.`);

        // 4. Buscar o documento Metric
        const metricDoc = await Metric.findById(metricId);

        // 5. Validar Métrica e Condições para Classificação
        if (!metricDoc) {
            logger.warn(`${TAG} Métrica com ID ${metricId} não encontrada no DB. Tarefa ignorada.`);
            // Retorna 200 - não retentar
            return NextResponse.json({ message: "Métrica não encontrada." }, { status: 200 });
        }
        // Aceita 'api' ou 'manual'
        if (!['api', 'manual'].includes(metricDoc.source)) {
             logger.warn(`${TAG} Métrica ${metricId} tem source inválida (${metricDoc.source}). Classificação não aplicável.`);
             // Retorna 200 - não retentar
             return NextResponse.json({ message: "Classificação não aplicável para esta fonte." }, { status: 200 });
        }
        // Usa classificationStatus para verificar se já foi processado
        if (metricDoc.classificationStatus === 'completed') {
            logger.info(`${TAG} Métrica ${metricId} já classificada (status: completed). Tarefa ignorada.`);
            // Retorna 200 - não retentar
            return NextResponse.json({ message: "Métrica já classificada." }, { status: 200 });
        }
        // Ignora retentativas automáticas para falhas anteriores
        if (metricDoc.classificationStatus === 'failed') {
             logger.warn(`${TAG} Métrica ${metricId} falhou anteriormente (status: failed). Ignorando retentativa automática.`);
             // Retorna 200 - não retentar
             return NextResponse.json({ message: "Classificação falhou anteriormente." }, { status: 200 });
        }
        // Valida descrição e marca como falha se ausente
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
                 // Retorna 500 aqui, pois a falha em atualizar o status é um problema
                 return NextResponse.json({ error: "Falha ao atualizar status da métrica no banco de dados." }, { status: 500 });
            }
            // Retorna 200 - não retentar
            return NextResponse.json({ message: "Métrica sem descrição para classificar." }, { status: 200 });
        }

        // 6. Chamar a Função de Classificação
        logger.debug(`${TAG} Chamando classifyContent para Metric ${metricId}...`);
        let classification: { proposal: string; context: string; format?: string };
        try {
            classification = await classifyContent(metricDoc.description);
            logger.info(`${TAG} Classificação recebida para Metric ${metricId}: P=${classification.proposal}, C=${classification.context}, F=${classification.format || 'N/A'}`);

            // 7. Atualizar o Documento Metric no Banco de Dados (SUCESSO)
            try {
                const updateData: Partial<IMetric> = {
                    proposal: classification.proposal || "Outro",
                    context: classification.context || "Geral",
                    classificationStatus: 'completed', // Atualiza status
                    classificationError: null // Limpa erro
                };
                // Atualiza formato apenas se for diferente e válido
                if (classification.format && classification.format !== metricDoc.format && classification.format !== 'Desconhecido') {
                    updateData.format = classification.format;
                    logger.info(`${TAG} Atualizando também o formato para '${classification.format}' para Metric ${metricId}.`);
                }

                const updateResult = await Metric.updateOne( { _id: metricDoc._id }, { $set: updateData });

                if (updateResult.modifiedCount > 0) {
                    logger.info(`${TAG} Metric ${metricId} atualizado com sucesso no DB (status: completed).`);
                } else {
                    // Pode acontecer se o status já era 'completed' (corrida) ou se os dados são idênticos
                    logger.warn(`${TAG} Nenhum documento foi modificado para Metric ${metricId} na atualização de sucesso.`);
                }
                // Retorna 200 para QStash confirmar sucesso
                return NextResponse.json({ message: "Classificação concluída e métrica atualizada." }, { status: 200 });

            } catch (dbError) {
                logger.error(`${TAG} Erro ao atualizar Metric ${metricId} no DB após classificação bem-sucedida:`, dbError);
                // Retorna 500 - Tentar salvar novamente
                return NextResponse.json({ error: "Falha ao salvar classificação no banco de dados." }, { status: 500 });
            }

        } catch (classError: unknown) {
            // 8. Tratar Erros da Classificação (FALHA)
            const errorMessage = classError instanceof Error ? classError.message : "Erro desconhecido na classificação";
            logger.error(`${TAG} Erro ao chamar classifyContent para Metric ${metricId}: ${errorMessage}`, classError);

            // <<< ALTERADO: Remove a checagem de erro permanente. Assume erro temporário e retorna 500 >>>
            logger.warn(`${TAG} Erro na classificação para Metric ${metricId}. Solicitando retentativa (500).`);
            // Retorna 500 para QStash tentar novamente
            return NextResponse.json({ error: `Falha ao classificar conteúdo: ${errorMessage}` }, { status: 500 });
            // <<< FIM ALTERAÇÃO >>>
        }

    } catch (error: unknown) {
        logger.error(`${TAG} Erro GERAL inesperado no worker:`, error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        // Retorna 500 para erro geral
        return NextResponse.json({ error: `Erro interno do worker: ${errorMessage}` }, { status: 500 });
    } finally {
        // (Lógica de sessão mantida comentada)
    }
}

// Exporta o handler POST que primeiro verifica a assinatura (mantido)
export const POST = async (request: NextRequest) => {
    const TAG_POST = '[Worker Classify POST v1.6]'; // Atualiza tag
    try {
        // Verifica assinatura
        const signature = request.headers.get("upstash-signature");
        if (!signature) {
            logger.error(`${TAG_POST} Erro: Header 'upstash-signature' ausente.`);
            return new NextResponse("Signature header missing", { status: 401 });
        }

        // Lê corpo para verificação
        const bodyAsText = await request.text();

        // Verifica assinatura
        const isValid = await receiver.verify({
            signature: signature,
            body: bodyAsText,
        });

        if (!isValid) {
            logger.error(`${TAG_POST} Assinatura QStash inválida.`);
            return new NextResponse("Invalid signature", { status: 401 });
        }

        // Recria request para o handler
        const newRequest = new NextRequest(request.url, {
            method: request.method,
            headers: request.headers,
            body: bodyAsText,
        });

        // Chama a lógica principal
        return await handlerLogic(newRequest);

    } catch (error) {
        logger.error(`${TAG_POST} Erro durante verificação/recriação do request:`, error);
        return NextResponse.json({ error: "Erro ao processar requisição do webhook." }, { status: 500 });
    }
};


// GET Handler (mantido)
export async function GET() {
    return NextResponse.json({ message: "Worker de classificação v1.6 ativo." }); // Atualiza versão na mensagem
}
