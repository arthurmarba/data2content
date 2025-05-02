// src/app/api/metrics/route.ts - v1.2 (Classificação Assíncrona)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Ajuste o caminho se necessário
import { connectToDatabase } from "@/app/lib/mongoose"; // Ajuste o caminho se necessário
import Metric from "@/app/models/Metric"; // Modelo Metric (v1.3 com classificationStatus)
import { processMultipleImages } from "@/app/lib/parseMetrics"; // Usa a versão atualizada (v3.0)
import mongoose from "mongoose";
// import { classifyContent } from '@/app/lib/classification'; // <<< REMOVIDO: Não chamaremos mais daqui >>>
import { logger } from '@/app/lib/logger'; // Importa o logger
import { Client } from "@upstash/qstash"; // <<< ADICIONADO: Cliente QStash >>>

export const runtime = "nodejs"; // Garante execução no Node.js

// <<< ADICIONADO: Inicializa cliente QStash >>>
// Certifique-se de que QSTASH_TOKEN está nas variáveis de ambiente
const qstashClient = new Client({ token: process.env.QSTASH_TOKEN! });

export async function POST(request: NextRequest) {
  const TAG = '[API Metrics POST v1.2 Async]'; // Tag atualizada
  try {
    // 1) Verifica autenticação
    const session = await getServerSession({ req: request, ...authOptions });
    if (!session?.user?.id) {
      logger.error(`${TAG} Erro: Usuário não autenticado.`);
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const userId = session.user.id;

    // 2) Extrai dados da requisição
    const { images, postLink: initialPostLink, description: initialDescription } = await request.json();
    logger.info(`${TAG} Recebido para User ${userId}: ${images?.length} imagens...`);

    // 3) Valida campos essenciais do request
    if (!images || !Array.isArray(images) || images.length === 0) {
      logger.error(`${TAG} Erro: Nenhuma imagem enviada.`);
      return NextResponse.json({ error: "Nenhuma imagem enviada" }, { status: 400 });
    }

    // 4) Conecta ao BD
    await connectToDatabase();
    logger.debug(`${TAG} Conectado ao BD.`);

    // 5) Processa imagens via parseMetrics (v3.0 - Padronizado)
    logger.info(`${TAG} Processando imagens...`);
    const { consolidatedTopLevel, consolidatedStats, calculatedStats } = await processMultipleImages(images);
    logger.info(`${TAG} Imagens processadas.`);
    logger.debug(`${TAG} TopLevel extraído:`, consolidatedTopLevel);
    logger.debug(`${TAG} Stats brutos extraídos (canônicos):`, consolidatedStats);
    logger.debug(`${TAG} Stats calculados (canônicos/descritivos):`, calculatedStats);

    // 6) Combina stats brutos e calculados num único objeto para Metric.stats
    const finalStats = {
        ...consolidatedStats,
        ...calculatedStats
    };
    logger.debug(`${TAG} Stats finais combinados para salvar:`, finalStats);

    // 7) Determina postDate
    let postDate: Date;
    if (consolidatedTopLevel.postDate instanceof Date) {
        postDate = consolidatedTopLevel.postDate;
        logger.info(`${TAG} PostDate determinada da imagem: ${postDate.toISOString()}`);
    } else {
        postDate = new Date();
        logger.warn(`${TAG} Não foi possível determinar postDate da imagem, usando data atual: ${postDate.toISOString()}`);
    }

    // 8) Determina descrição e link
    const description = (consolidatedTopLevel.description as string || initialDescription || '').trim();
    const postLink = (consolidatedTopLevel.postLink as string || initialPostLink || '').trim();

    // Validações pós-extração (mantidas)
    if (!description) {
        logger.warn(`${TAG} Descrição final está vazia. Classificação pode não ocorrer ou usar defaults no worker.`);
    } else {
        logger.info(`${TAG} Descrição final: ${description.substring(0, 50)}...`);
    }
     if (!postLink) {
        logger.warn(`${TAG} PostLink final está vazio.`);
     } else {
        logger.info(`${TAG} PostLink final: ${postLink}`);
     }

    // 9) <<< REMOVIDO: Classificação Síncrona >>>
    logger.info(`${TAG} Classificação síncrona removida. Será feita pelo worker.`);

    // 10) Cria e salva o Metric com status de classificação pendente
    logger.info(`${TAG} Criando documento Metric com status de classificação pendente...`);
    const newMetric = new Metric({
      user: new mongoose.Types.ObjectId(userId),
      postLink: postLink,
      description: description,
      format: consolidatedTopLevel.format || 'Desconhecido',
      // <<< ALTERADO: Define valores padrão e status pendente >>>
      proposal: "Outro", // Valor padrão inicial
      context: "Geral",  // Valor padrão inicial
      classificationStatus: 'pending', // Define como pendente
      classificationError: null, // Limpa erro anterior (se houver)
      // --- Fim Alteração ---
      theme: consolidatedTopLevel.theme,
      collab: consolidatedTopLevel.collab,
      collabCreator: consolidatedTopLevel.collabCreator,
      coverUrl: consolidatedTopLevel.coverUrl,
      postDate: postDate,
      stats: finalStats,
      source: 'manual',
      // rawData: [], // Omitido
    });

    const savedMetric = await newMetric.save();
    logger.info(`${TAG} Documento Metric salvo com sucesso: ${savedMetric._id} com status: ${savedMetric.classificationStatus}`);

    // 11) <<< ADICIONADO: Envia tarefa para o QStash Worker >>>
    // Certifique-se de que CLASSIFICATION_WORKER_URL está nas variáveis de ambiente
    const workerUrl = process.env.CLASSIFICATION_WORKER_URL;
    if (workerUrl && savedMetric?._id) {
        try {
            logger.info(`${TAG} Enviando tarefa de classificação para QStash (Worker: ${workerUrl}) para Metric ID: ${savedMetric._id}`);
            await qstashClient.publishJSON({
                url: workerUrl,
                body: { metricId: savedMetric._id.toString() }, // Envia o ID como string
                // Opcional: adicionar delay, retentativas específicas, etc.
                // delay: "5s",
                // retries: 3,
            });
            logger.info(`${TAG} Tarefa enviada com sucesso para QStash.`);
        } catch (qstashError) {
            // Loga o erro mas não impede a resposta ao usuário, pois a métrica foi salva.
            // Considere mecanismos de monitoramento/alerta para falhas no QStash.
            logger.error(`${TAG} ERRO ao enviar tarefa para QStash para Metric ID: ${savedMetric._id}. O worker não será chamado automaticamente.`, qstashError);
        }
    } else {
         logger.warn(`${TAG} CLASSIFICATION_WORKER_URL não definida ou Metric ID inválido. Tarefa QStash não enviada.`);
    }
    // <<< FIM ADIÇÃO >>>

    // 12) <<< REMOVIDO: Criação do DailyMetric >>>
    // logger.info(`${TAG} Criação de DailyMetric removida desta rota.`); // Já removido antes

    // 13) Retorna sucesso com o Metric salvo (resposta mais rápida agora)
    logger.info(`${TAG} Processo concluído com sucesso (classificação pendente).`);
    return NextResponse.json(
      { message: "Métricas manuais salvas. Classificação pendente.", metricId: savedMetric._id }, // Mensagem atualizada
      { status: 200 }
    );

  } catch (error: unknown) {
    // Tratamento de erro geral (mantido)
    logger.error(`${TAG} Erro GERAL no processamento:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (error instanceof mongoose.Error.ValidationError) {
        logger.error(`${TAG} Erro de Validação Mongoose:`, error.errors);
        return NextResponse.json({ error: "Erro de validação ao salvar métrica: " + errorMessage, details: error.errors }, { status: 400 });
    }
    if (errorMessage.includes("Erro Document AI") || errorMessage.includes("Falha ao processar imagens")) {
         return NextResponse.json({ error: "Falha ao processar as imagens enviadas: " + errorMessage }, { status: 500 });
    }
    return NextResponse.json({ error: "Erro interno do servidor: " + errorMessage }, { status: 500 });
  }
}
