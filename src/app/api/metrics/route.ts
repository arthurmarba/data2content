/**
 * @fileoverview API Endpoint for creating new metrics from Document AI processing.
 * @version 2.0.0 - Aligned with 5-dimension classification model.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric, { IMetric } from "@/app/models/Metric";
import { processMultipleImages } from "@/app/lib/parseMetrics"; 
import mongoose from "mongoose";
import { logger } from '@/app/lib/logger';
import { Client } from "@upstash/qstash";
import { getCategoryByValue } from "@/app/lib/classification";

export const runtime = "nodejs"; 

const qstashClient = process.env.QSTASH_TOKEN ? new Client({ token: process.env.QSTASH_TOKEN }) : null;
if (!qstashClient && process.env.NODE_ENV === 'production') {
    logger.error(`[API Metrics Init] QSTASH_TOKEN não definido! Classificação assíncrona de métricas manuais não funcionará.`);
}

// --- Funções Auxiliares ---

/**
 * Mapeia o primeiro formato encontrado para o tipo de mídia principal do post.
 * @param formatValue O valor do formato, que pode ser uma string ou um array.
 * @returns O tipo de mídia correspondente.
 */
function mapFormatToMediaType(formatValue?: string | string[]): IMetric['type'] {
    if (!formatValue) return 'UNKNOWN';
    const primaryFormat = Array.isArray(formatValue) ? formatValue[0] : formatValue;
    if (!primaryFormat) return 'UNKNOWN';

    const lowerFormat = primaryFormat.toLowerCase().trim();
    if (lowerFormat.includes('reel')) return 'REEL';
    if (lowerFormat.includes('foto') || lowerFormat.includes('imagem') || lowerFormat.includes('feed')) return 'IMAGE';
    if (lowerFormat.includes('vídeo') || lowerFormat.includes('video')) return 'VIDEO';
    if (lowerFormat.includes('carrossel') || lowerFormat.includes('carousel')) return 'CAROUSEL_ALBUM';
    if (lowerFormat.includes('story')) return 'STORY';
    return 'UNKNOWN';
}

/**
 * Garante que o valor de entrada seja um array de strings, limpando valores inválidos.
 * @param value O valor de entrada, que pode ser uma string, um array ou indefinido.
 * @returns Um array de strings.
 */
const ensureStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
    }
    if (typeof value === 'string' && value.length > 0) {
        return [value];
    }
    return [];
};

const mapToCategoryIds = (
    value: unknown,
    type: 'format' | 'proposal' | 'context' | 'tone' | 'reference'
): string[] => {
    return ensureStringArray(value).map(v => {
        const match = getCategoryByValue(v, type);
        return match?.id ?? v;
    });
};


export async function POST(request: NextRequest) {
  const TAG = '[API Metrics POST v2.0.0]'; 
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
    const { consolidatedTopLevel, consolidatedStats, calculatedStats } = await processMultipleImages(images);
    logger.info(`${TAG} Imagens processadas.`);
    
    const finalStats = { ...consolidatedStats, ...calculatedStats };
    
    let postDateToUse: Date;
    if (consolidatedTopLevel.postDate instanceof Date) {
        postDateToUse = consolidatedTopLevel.postDate;
    } else if (typeof consolidatedTopLevel.postDate === 'string' && consolidatedTopLevel.postDate) {
        const parsed = new Date(consolidatedTopLevel.postDate);
        postDateToUse = !isNaN(parsed.getTime()) ? parsed : new Date();
    } else {
        postDateToUse = new Date();
    }

    const descriptionToUse = (consolidatedTopLevel.description as string || initialDescription || '').trim();
    const postLinkToUse = (consolidatedTopLevel.postLink as string || initialPostLink || '').trim();
    
    const mediaType = mapFormatToMediaType(consolidatedTopLevel.format as string | string[] | undefined);

    logger.info(`${TAG} Criando documento Metric com source 'document_ai'...`);
    const newMetric = new Metric({
      user: new mongoose.Types.ObjectId(userId),
      postLink: postLinkToUse,
      description: descriptionToUse,
      postDate: postDateToUse,
      
      // ATUALIZADO: Campos de classificação salvos como arrays de strings
      type: mediaType, 
      format: mapToCategoryIds(consolidatedTopLevel.format, 'format'),
      proposal: mapToCategoryIds(consolidatedTopLevel.proposal, 'proposal'),
      context: mapToCategoryIds(consolidatedTopLevel.context, 'context'),
      tone: mapToCategoryIds(consolidatedTopLevel.tone, 'tone'),
      references: mapToCategoryIds(consolidatedTopLevel.references, 'reference'),
      
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
    logger.info(`${TAG} Documento Metric salvo com sucesso: ${savedMetric._id}`);

    const workerUrl = process.env.CLASSIFICATION_WORKER_URL;
    if (workerUrl && qstashClient && savedMetric?._id) {
        try {
            logger.info(`${TAG} Enviando tarefa de classificação para QStash para Metric ID: ${savedMetric._id}`);
            await qstashClient.publishJSON({
                url: workerUrl,
                body: { metricId: savedMetric._id.toString() }, 
            });
            logger.info(`${TAG} Tarefa enviada com sucesso para QStash.`);
        } catch (qstashError) {
            logger.error(`${TAG} ERRO ao enviar tarefa para QStash para Metric ID: ${savedMetric._id}.`, qstashError);
        }
    } else {
         logger.warn(`${TAG} CLASSIFICATION_WORKER_URL ou QStash client não configurado. Tarefa de classificação não enviada.`);
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
