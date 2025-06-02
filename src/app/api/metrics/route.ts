// src/app/api/metrics/route.ts - v1.3.1 (Correção de importação de tipos Enum)
// - ATUALIZADO: Corrigida importação de FormatType, ProposalType, ContextType.
// - ATUALIZADO: source definido como 'document_ai'.
// - ATUALIZADO: Campo 'type' (media_type) populado com base no 'format'.
// - ATUALIZADO: Uso de valores de 'consolidatedTopLevel' para format, proposal, context com defaults.
// - ATUALIZADO: rawData populado.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric, { IMetric } from "@/app/models/Metric"; // FormatType, ProposalType, ContextType removidos daqui
import { processMultipleImages } from "@/app/lib/parseMetrics"; 
import mongoose from "mongoose";
import { logger } from '@/app/lib/logger';
import { Client } from "@upstash/qstash";
import { 
    VALID_FORMATS, 
    VALID_PROPOSALS, 
    VALID_CONTEXTS,
    DEFAULT_FORMAT_ENUM,
    DEFAULT_PROPOSAL_ENUM,
    DEFAULT_CONTEXT_ENUM,
    FormatType,     // <<< ADICIONADO AQUI
    ProposalType,   // <<< ADICIONADO AQUI
    ContextType     // <<< ADICIONADO AQUI
} from "@/app/lib/constants/communityInspirations.constants";

export const runtime = "nodejs"; 

const qstashClient = process.env.QSTASH_TOKEN ? new Client({ token: process.env.QSTASH_TOKEN }) : null;
if (!qstashClient && process.env.NODE_ENV === 'production') {
    logger.error(`[API Metrics Init] QSTASH_TOKEN não definido! Classificação assíncrona de métricas manuais não funcionará.`);
}


// Função auxiliar para mapear string de formato para o tipo de Mídia do Schema
function mapFormatToMediaType(formatString?: string): IMetric['type'] {
    if (!formatString) return 'UNKNOWN';
    const lowerFormat = formatString.toLowerCase().trim();
    if (lowerFormat.includes('reel')) return 'REEL';
    if (lowerFormat.includes('foto') || lowerFormat.includes('imagem') || lowerFormat.includes('feed')) return 'IMAGE';
    if (lowerFormat.includes('vídeo') || lowerFormat.includes('video')) return 'VIDEO'; // Se for um vídeo que não é Reel
    if (lowerFormat.includes('carrossel') || lowerFormat.includes('carousel')) return 'CAROUSEL_ALBUM';
    if (lowerFormat.includes('story')) return 'STORY';
    return 'UNKNOWN';
}

// Funções auxiliares para validar e obter valores de Enum
function getValidFormat(formatValue?: unknown): FormatType {
    if (typeof formatValue === 'string' && (VALID_FORMATS as readonly string[]).includes(formatValue)) {
        return formatValue as FormatType;
    }
    return DEFAULT_FORMAT_ENUM;
}

function getValidProposal(proposalValue?: unknown): ProposalType {
    if (typeof proposalValue === 'string' && (VALID_PROPOSALS as readonly string[]).includes(proposalValue)) {
        return proposalValue as ProposalType;
    }
    return DEFAULT_PROPOSAL_ENUM;
}

function getValidContext(contextValue?: unknown): ContextType {
    if (typeof contextValue === 'string' && (VALID_CONTEXTS as readonly string[]).includes(contextValue)) {
        return contextValue as ContextType;
    }
    return DEFAULT_CONTEXT_ENUM;
}


export async function POST(request: NextRequest) {
  const TAG = '[API Metrics POST v1.3.1 DocAI Standardized]'; 
  try {
    const session = await getServerSession({ req: request, ...authOptions });
    if (!session?.user?.id) {
      logger.error(`${TAG} Erro: Usuário não autenticado.`);
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const userId = session.user.id;

    const { images, postLink: initialPostLink, description: initialDescription } = await request.json();
    logger.info(`${TAG} Recebido para User ${userId}: ${images?.length} imagens...`);

    if (!images || !Array.isArray(images) || images.length === 0) {
      logger.error(`${TAG} Erro: Nenhuma imagem enviada.`);
      return NextResponse.json({ error: "Nenhuma imagem enviada" }, { status: 400 });
    }

    await connectToDatabase();
    logger.debug(`${TAG} Conectado ao BD.`);

    logger.info(`${TAG} Processando imagens via processMultipleImages...`);
    // processMultipleImages retorna a estrutura padronizada com chaves canônicas
    const { consolidatedTopLevel, consolidatedStats, calculatedStats } = await processMultipleImages(images);
    logger.info(`${TAG} Imagens processadas.`);
    logger.debug(`${TAG} TopLevel extraído:`, consolidatedTopLevel);
    logger.debug(`${TAG} Stats brutos extraídos (consolidatedStats):`, consolidatedStats);
    logger.debug(`${TAG} Stats calculados (calculatedStats):`, calculatedStats);

    // Combina stats diretos do Document AI com os calculados por formulas.ts
    const finalStats = {
        ...consolidatedStats,
        ...calculatedStats
    };
    logger.debug(`${TAG} Stats finais combinados para salvar:`, finalStats);

    let postDateToUse: Date;
    if (consolidatedTopLevel.postDate instanceof Date) {
        postDateToUse = consolidatedTopLevel.postDate;
        logger.info(`${TAG} PostDate determinada da imagem: ${postDateToUse.toISOString()}`);
    } else if (typeof consolidatedTopLevel.postDate === 'string' && consolidatedTopLevel.postDate) {
        const parsed = new Date(consolidatedTopLevel.postDate); // Tenta parsear se for string
        if (!isNaN(parsed.getTime())) {
            postDateToUse = parsed;
            logger.info(`${TAG} PostDate (string) parseada da imagem: ${postDateToUse.toISOString()}`);
        } else {
            postDateToUse = new Date();
            logger.warn(`${TAG} String de PostDate inválida ("${consolidatedTopLevel.postDate}"), usando data atual: ${postDateToUse.toISOString()}`);
        }
    } else {
        postDateToUse = new Date();
        logger.warn(`${TAG} Não foi possível determinar postDate da imagem, usando data atual: ${postDateToUse.toISOString()}`);
    }

    const descriptionToUse = (consolidatedTopLevel.description as string || initialDescription || '').trim();
    const postLinkToUse = (consolidatedTopLevel.postLink as string || initialPostLink || '').trim();
    
    // Determina o tipo de mídia com base no formato extraído
    const mediaType = mapFormatToMediaType(consolidatedTopLevel.format as string | undefined);

    // Obtém e valida os valores para os campos Enum
    const formatToUse = getValidFormat(consolidatedTopLevel.format);
    const proposalToUse = getValidProposal(consolidatedTopLevel.proposal);
    const contextToUse = getValidContext(consolidatedTopLevel.context);

    logger.info(`${TAG} Criando documento Metric com source 'document_ai'...`);
    const newMetric = new Metric({
      user: new mongoose.Types.ObjectId(userId),
      postLink: postLinkToUse,
      description: descriptionToUse,
      postDate: postDateToUse,
      
      type: mediaType, 
      format: formatToUse, 
      proposal: proposalToUse,
      context: contextToUse, 
      
      theme: consolidatedTopLevel.theme,
      collab: consolidatedTopLevel.collab, 
      collabCreator: consolidatedTopLevel.collabCreator,
      coverUrl: consolidatedTopLevel.coverUrl,
      
      instagramMediaId: null, 
      source: 'document_ai', 
      
      classificationStatus: 'pending', 
      classificationError: null, 
      
      rawData: images.map(img => ({ 
          originalFileName: (img as any).fileName || 'unknown', 
          processedAt: new Date()
      })), 
      stats: finalStats,
    });

    const savedMetric = await newMetric.save();
    logger.info(`${TAG} Documento Metric salvo com sucesso: ${savedMetric._id} com status: ${savedMetric.classificationStatus}, source: ${savedMetric.source}`);

    const workerUrl = process.env.CLASSIFICATION_WORKER_URL;
    if (workerUrl && qstashClient && savedMetric?._id) {
        try {
            logger.info(`${TAG} Enviando tarefa de classificação para QStash (Worker: ${workerUrl}) para Metric ID: ${savedMetric._id}`);
            await qstashClient.publishJSON({
                url: workerUrl,
                body: { metricId: savedMetric._id.toString() }, 
            });
            logger.info(`${TAG} Tarefa enviada com sucesso para QStash.`);
        } catch (qstashError) {
            logger.error(`${TAG} ERRO ao enviar tarefa para QStash para Metric ID: ${savedMetric._id}.`, qstashError);
        }
    } else {
         logger.warn(`${TAG} CLASSIFICATION_WORKER_URL não definida ou QStash client não inicializado ou Metric ID inválido. Tarefa QStash não enviada.`);
    }

    logger.info(`${TAG} Processo concluído com sucesso (classificação pendente).`);
    return NextResponse.json(
      { message: "Métricas manuais salvas. Classificação pendente.", metricId: savedMetric._id }, 
      { status: 200 }
    );

  } catch (error: unknown) {
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
