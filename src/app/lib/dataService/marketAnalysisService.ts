/**
 * @fileoverview Serviço para análises de mercado agregadas da Creator Economy.
 * @version 1.7.0 - Otimizada a busca global de posts e a clareza do código.
 */

import { Types, PipelineStage } from 'mongoose';
import { subDays } from 'date-fns';
import { logger } from '@/app/lib/logger';
import MetricModel, { IMetric, IMetricStats } from '@/app/models/Metric';
import { connectToDatabase } from './connection';
import { DatabaseError } from '@/app/lib/errors';

const SERVICE_TAG = '[dataService][marketAnalysisService v1.7.0]';

// --- Interfaces de Contrato ---

export interface IMarketPerformanceResult {
  avgEngagementRate?: number;
  avgShares?: number;
  avgLikes?: number;
  postCount: number;
}

export interface ITopCreatorResult {
  creatorId: string;
  creatorName?: string;
  metricValue: number;
  totalInteractions: number;
  postCount: number;
}

export interface FindGlobalPostsArgs {
    context?: string;
    proposal?: string;
    format?: string;
    minInteractions?: number;
    limit?: number;
}

export interface IGlobalPostResult extends IMetric {
    creatorName?: string;
}

// --- Funções do Serviço ---

export async function getAvailableContexts(): Promise<string[]> {
    const TAG = `${SERVICE_TAG}[getAvailableContexts]`;
    try {
        await connectToDatabase();
        const contexts = await MetricModel.distinct('context');
        return contexts.filter(c => c); // Filtra valores nulos ou vazios
    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar contextos distintos:`, error);
        throw new DatabaseError(`Falha ao buscar a lista de contextos: ${error.message}`);
    }
}

export async function fetchMarketPerformance(format: string, proposal: string, days: number): Promise<IMarketPerformanceResult> {
  const TAG = `${SERVICE_TAG}[fetchMarketPerformance]`;
  try {
    await connectToDatabase();
    const sinceDate = subDays(new Date(), days);
    const aggregationPipeline: PipelineStage[] = [
      { $match: { format, proposal, postDate: { $gte: sinceDate }, 'stats.engagement_rate_on_reach': { $exists: true, $ne: null } } },
      { $group: { _id: null, avgEngagementRate: { $avg: '$stats.engagement_rate_on_reach' }, avgShares: { $avg: '$stats.shares' }, avgLikes: { $avg: '$stats.likes' }, postCount: { $sum: 1 } } },
      { $project: { _id: 0, avgEngagementRate: 1, avgShares: 1, avgLikes: 1, postCount: 1 } }
    ];
    const results = await MetricModel.aggregate(aggregationPipeline);
    return results[0] || { postCount: 0 };
  } catch (error: any) {
    logger.error(`${TAG} Erro na agregação de performance de mercado:`, error);
    throw new DatabaseError(`Falha ao buscar performance de mercado: ${error.message}`);
  }
}

export async function fetchTopCreators(context: string, metricToSortBy: keyof IMetricStats, days: number, limit: number): Promise<ITopCreatorResult[]> {
  const TAG = `${SERVICE_TAG}[fetchTopCreators]`;
  try {
    await connectToDatabase();
    const sinceDate = subDays(new Date(), days);
    const sortField = `stats.${metricToSortBy}`;
    const matchStage: PipelineStage.Match['$match'] = { postDate: { $gte: sinceDate }, [sortField]: { $exists: true, $ne: null, $gt: 0 } };
    if (context && !['geral', 'todos', 'all'].includes(context.toLowerCase())) {
        matchStage.context = { $regex: context, $options: 'i' };
    }
    const aggregationPipeline: PipelineStage[] = [
      { $match: matchStage },
      { $group: { _id: '$user', metricValue: { $avg: `$${sortField}` }, totalInteractions: { $sum: '$stats.total_interactions' }, postCount: { $sum: 1 } } },
      { $sort: { metricValue: -1 } },
      { $limit: limit },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'creatorInfo' } },
      { $unwind: { path: '$creatorInfo', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, creatorId: '$_id', creatorName: '$creatorInfo.name', totalInteractions: 1, metricValue: 1, postCount: 1 } },
    ];
    return await MetricModel.aggregate(aggregationPipeline);
  } catch (error: any) {
    logger.error(`${TAG} Erro na agregação de top criadores:`, error);
    throw new DatabaseError(`Falha ao buscar top criadores: ${error.message}`);
  }
}

export async function findGlobalPostsByCriteria(args: FindGlobalPostsArgs): Promise<IGlobalPostResult[]> {
    const TAG = `${SERVICE_TAG}[findGlobalPostsByCriteria]`;
    const { context, proposal, format, minInteractions, limit = 5 } = args;
    logger.info(`${TAG} Buscando posts com critérios: ${JSON.stringify(args)}`);

    try {
        await connectToDatabase();
        const matchStage: PipelineStage.Match['$match'] = {};

        if (context) matchStage.context = { $regex: context, $options: 'i' };
        if (proposal) matchStage.proposal = { $regex: proposal, $options: 'i' };
        if (format) matchStage.format = { $regex: format, $options: 'i' };
        if (typeof minInteractions === 'number' && minInteractions > 0) {
            matchStage['stats.total_interactions'] = { $gte: minInteractions };
        }

        const aggregationPipeline: PipelineStage[] = [
            // Estágio 1: Filtrar os posts com base nos critérios fornecidos.
            { $match: matchStage },
            // Estágio 2: Ordenar por interações para trazer os mais relevantes primeiro.
            { $sort: { 'stats.total_interactions': -1 } },
            // Estágio 3: Limitar o número de resultados.
            { $limit: limit },
            // Estágio 4: Juntar com a coleção 'users' para obter o nome do criador.
            { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'creatorInfo' } },
            // Estágio 5: Desconstruir o array 'creatorInfo' para facilitar o acesso.
            { $unwind: { path: '$creatorInfo', preserveNullAndEmptyArrays: true } },
            // Estágio 6: Otimizado para adicionar o campo e remover o objeto aninhado em uma única etapa.
            {
              $project: {
                // Inclui todos os campos existentes do MetricModel
                user: 1, postLink: 1, description: 1, postDate: 1, type: 1,
                format: 1, proposal: 1, context: 1, theme: 1, collab: 1,
                collabCreator: 1, coverUrl: 1, instagramMediaId: 1, source: 1,
                classificationStatus: 1, classificationError: 1, stats: 1, 
                createdAt: 1, updatedAt: 1,
                // Adiciona o novo campo 'creatorName'
                creatorName: "$creatorInfo.name" 
              }
            }
        ];

        const results = await MetricModel.aggregate(aggregationPipeline);
        logger.info(`${TAG} Busca global encontrou ${results.length} posts.`);
        return results as IGlobalPostResult[];
    } catch (error: any) {
        logger.error(`${TAG} Erro ao executar busca global de posts:`, error);
        throw new DatabaseError(`Falha ao buscar posts globais: ${error.message}`);
    }
}
