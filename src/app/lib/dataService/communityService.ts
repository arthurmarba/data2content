// src/app/lib/dataService/communityService.ts - v2.15.2
// - DEBUG FINAL: Adicionado log de diagnóstico que mostra uma amostra de posts rejeitados e suas métricas de performance.
// - DEBUG: Adicionado um log de contagem para verificar quantos documentos correspondem à `baseQuery` antes de aplicar os filtros de performance.
// - REATORADO: A função findUserPostsEligibleForCommunity foi reescrita para usar um pipeline de agregação multi-estágio.
// - ATUALIZADO: Função addInspiration refatorada para usar findOneAndUpdate com upsert:true para maior eficiência e atomicidade.
// - Baseado na v2.14.6.

import mongoose, { Types, PipelineStage } from 'mongoose';
import { startOfDay } from 'date-fns';

import { logger } from '@/app/lib/logger';
import { UserNotFoundError, DatabaseError } from '@/app/lib/errors';

import User, { IUser } from '@/app/models/User';
import CommunityInspirationModel, { ICommunityInspiration } from '@/app/models/CommunityInspiration';
import MetricModel, { IMetric } from '@/app/models/Metric';

import { connectToDatabase } from './connection';
import { CommunityInspirationFilters, CommunityPerformanceCriteria, FindUserPostsEligibleForCommunityResult } from './types';
import {
    FormatType,
    ProposalType,
    ContextType,
    ToneType,
    ReferenceType,
    QualitativeObjectiveType,
    PerformanceHighlightType
} from "@/app/lib/constants/communityInspirations.constants";

const SERVICE_TAG = '[dataService][communityService v2.15.2]'; // Versão atualizada

export interface UserEngagementProfile {
    proposal?: ProposalType;
    context?: ContextType;
    reference?: ReferenceType;
    tone?: ToneType;
}

/**
 * Calcula a similaridade entre o perfil de engajamento do usuário e
 * uma inspiração da comunidade. Cada categoria correspondente soma
 * pontos e o resultado é ponderado pelo saveRate do post, se disponível.
 */
export function calculateInspirationSimilarity(
    profile: UserEngagementProfile,
    insp: ICommunityInspiration
): number {
    let score = 0;
    if (profile.proposal && insp.proposal === profile.proposal) score += 1;
    if (profile.context && insp.context === profile.context) score += 1;
    if (profile.reference && insp.reference === profile.reference) score += 1;
    if (profile.tone && insp.tone === profile.tone) score += 1;

    const saveRate = insp.internalMetricsSnapshot?.saveRate;
    if (typeof saveRate === 'number') {
        score *= 1 + saveRate;
    }
    return score;
}

/**
 * Regista o opt-in de um utilizador para a funcionalidade de inspiração da comunidade.
 * @param userId - O ID do utilizador.
 * @param termsVersion - A versão dos termos aceites pelo utilizador.
 * @returns Uma promessa que resolve para o objeto do utilizador atualizado.
 * @throws {DatabaseError} Se o ID do utilizador for inválido ou ocorrer um erro de banco de dados.
 * @throws {UserNotFoundError} Se o utilizador não for encontrado.
 */
export async function optInUserToCommunity(
    userId: string,
    termsVersion: string
): Promise<IUser> {
    const TAG = `${SERVICE_TAG}[optInUserToCommunity]`;
    logger.info(`${TAG} Registando opt-in para User ${userId}. Termos: ${termsVersion}`);

    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de utilizador inválido: ${userId}`);
        throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
    }
    if (!termsVersion || termsVersion.trim() === '') {
        logger.error(`${TAG} Versão dos termos não pode ser vazia para User ${userId}.`);
        throw new DatabaseError('Versão dos termos é obrigatória para opt-in.');
    }

    try {
        await connectToDatabase();
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    communityInspirationOptIn: true,
                    communityInspirationOptInDate: new Date(),
                    communityInspirationTermsVersion: termsVersion.trim(),
                },
            },
            { new: true, runValidators: true }
        ).lean();

        if (!updatedUser) {
            logger.warn(`${TAG} Utilizador ${userId} não encontrado para opt-in.`);
            throw new UserNotFoundError(`Utilizador ${userId} não encontrado.`);
        }
        logger.info(`${TAG} Opt-in para comunidade registado com sucesso para User ${userId}.`);
        return updatedUser as IUser;
    } catch (error: any) {
        logger.error(`${TAG} Erro ao registar opt-in para User ${userId}:`, error);
        if (error instanceof UserNotFoundError) throw error;
        throw new DatabaseError(`Erro ao registar opt-in na comunidade: ${error.message}`);
    }
}

/**
 * Regista o opt-out de um utilizador da funcionalidade de inspiração da comunidade.
 * @param userId - O ID do utilizador.
 * @returns Uma promessa que resolve para o objeto do utilizador atualizado.
 * @throws {DatabaseError} Se o ID do utilizador for inválido ou ocorrer um erro de banco de dados.
 * @throws {UserNotFoundError} Se o utilizador não for encontrado.
 */
export async function optOutUserFromCommunity(userId: string): Promise<IUser> {
    const TAG = `${SERVICE_TAG}[optOutUserFromCommunity]`;
    logger.info(`${TAG} Registando opt-out da comunidade para User ${userId}.`);

    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de utilizador inválido: ${userId}`);
        throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
    }

    try {
        await connectToDatabase();
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    communityInspirationOptIn: false,
                },
            },
            { new: true, runValidators: true }
        ).lean();

        if (!updatedUser) {
            logger.warn(`${TAG} Utilizador ${userId} não encontrado para opt-out.`);
            throw new UserNotFoundError(`Utilizador ${userId} não encontrado.`);
        }
        logger.info(`${TAG} Opt-out da comunidade registado com sucesso para User ${userId}.`);
        return updatedUser as IUser;
    } catch (error: any) {
        logger.error(`${TAG} Erro ao registar opt-out para User ${userId}:`, error);
        if (error instanceof UserNotFoundError) throw error;
        throw new DatabaseError(`Erro ao registar opt-out da comunidade: ${error.message}`);
    }
}

/**
 * Adiciona uma nova inspiração à comunidade ou atualiza uma existente com o mesmo postId_Instagram.
 * ATUALIZADO v2.14.7: Usa findOneAndUpdate com upsert para maior eficiência.
 * @param inspirationData - Os dados da inspiração a serem adicionados/atualizados.
 * @returns Uma promessa que resolve para o objeto da inspiração criada ou atualizada.
 * @throws {DatabaseError} Se ocorrer um erro de banco de dados.
 */
export async function addInspiration(
    inspirationData: Partial<ICommunityInspiration>
): Promise<ICommunityInspiration> {
    const TAG = `${SERVICE_TAG}[addInspiration]`;
    logger.info(`${TAG} Adicionando/Atualizando inspiração. PostId Instagram: ${inspirationData.postId_Instagram}`);

    if (!inspirationData.postId_Instagram) {
        logger.error(`${TAG} postId_Instagram é obrigatório para adicionar uma inspiração.`);
        throw new DatabaseError('postId_Instagram é obrigatório para adicionar uma inspiração.');
    }

    try {
        await connectToDatabase();

        const { addedToCommunityAt, _id, ...updateFields } = inspirationData;

        const upsertedInspiration = await CommunityInspirationModel.findOneAndUpdate(
            { postId_Instagram: inspirationData.postId_Instagram }, // Filtro para encontrar o documento
            {
                $set: updateFields, // Campos a serem atualizados se encontrado
                $setOnInsert: { addedToCommunityAt: inspirationData.addedToCommunityAt || new Date() } // Campo a ser definido apenas na inserção
            },
            {
                new: true, // Retorna o documento modificado (ou o novo, se criado)
                upsert: true, // Cria o documento se não for encontrado
                runValidators: true, // Roda validadores do schema
                lean: true // Retorna um POJO
            }
        );

        if (!upsertedInspiration) {
            // Este caso não deveria acontecer com upsert:true, a menos que haja um erro muito específico.
            logger.error(`${TAG} Falha ao criar/atualizar inspiração com postId_Instagram ${inspirationData.postId_Instagram} usando findOneAndUpdate.`);
            throw new DatabaseError(`Falha ao criar/atualizar inspiração com postId_Instagram ${inspirationData.postId_Instagram}`);
        }

        logger.info(`${TAG} Inspiração ID: ${upsertedInspiration._id} (PostId Instagram: ${upsertedInspiration.postId_Instagram}) criada/atualizada com sucesso.`);
        return upsertedInspiration as ICommunityInspiration;

    } catch (error: any) {
        logger.error(`${TAG} Erro ao adicionar/atualizar inspiração para PostId Instagram ${inspirationData.postId_Instagram}:`, error);
        throw new DatabaseError(`Erro ao adicionar/atualizar inspiração: ${error.message}`);
    }
}

/**
 * Busca inspirações na comunidade com base em filtros.
 * @param filters - Os filtros a serem aplicados na busca.
 * @param limit - O número máximo de inspirações a serem retornadas (padrão: 3).
 * @param excludeIds - Um array opcional de IDs de inspiração a serem excluídos dos resultados.
 * @param excludeCreatorId - ID de criador a ser excluído dos resultados.
 * @returns Uma promessa que resolve para um array de inspirações encontradas.
 * @throws {DatabaseError} Se ocorrer um erro de banco de dados.
 */
export async function getInspirations(
    filters: CommunityInspirationFilters,
    limit: number = 3,
    excludeIds?: string[],
    similarityFn?: (insp: ICommunityInspiration) => number,
    excludeCreatorId?: string
): Promise<ICommunityInspiration[]> {
    const TAG = `${SERVICE_TAG}[getInspirations]`;
    logger.info(`${TAG} Buscando inspirações com filtros: ${JSON.stringify(filters)}, limite: ${limit}, excluir IDs: ${excludeIds?.join(',')}, similarityFn: ${similarityFn ? 'yes' : 'no'}, excludeCreatorId: ${excludeCreatorId}`);

    const query: any = { status: 'active' };

    if (filters.proposal) query.proposal = filters.proposal;
    if (filters.context) query.context = filters.context;
    if (filters.format) query.format = filters.format;
    if (filters.tone) query.tone = filters.tone;
    if (filters.reference) query.reference = filters.reference;
    if (filters.primaryObjectiveAchieved_Qualitative) {
        query.primaryObjectiveAchieved_Qualitative = filters.primaryObjectiveAchieved_Qualitative;
    }

    if (filters.performanceHighlights_Qualitative_INCLUDES_ANY && filters.performanceHighlights_Qualitative_INCLUDES_ANY.length > 0) {
        query.performanceHighlights_Qualitative = { $in: filters.performanceHighlights_Qualitative_INCLUDES_ANY };
    }
    else if (filters.performanceHighlights_Qualitative_CONTAINS) {
        query.performanceHighlights_Qualitative = {
            $regex: filters.performanceHighlights_Qualitative_CONTAINS,
            $options: "i"
        };
    }

    if (filters.tags_IA && filters.tags_IA.length > 0) {
        query.tags_IA = { $in: filters.tags_IA };
    }

    if (excludeIds && excludeIds.length > 0) {
        const validObjectIds = excludeIds
            .filter(id => mongoose.isValidObjectId(id))
            .map(id => new Types.ObjectId(id));
        if (validObjectIds.length > 0) {
            query._id = { $nin: validObjectIds };
        }
    }

    if (excludeCreatorId && mongoose.isValidObjectId(excludeCreatorId)) {
        query.originalCreatorId = { $ne: new Types.ObjectId(excludeCreatorId) };
    }

    try {
        await connectToDatabase();
        let inspirations = await CommunityInspirationModel.find(query)
            .sort({ addedToCommunityAt: -1, 'internalMetricsSnapshot.saveRate': -1 })
            .limit(similarityFn ? limit * 3 : limit)
            .select(similarityFn ? '-updatedAt -status -__v' : '-internalMetricsSnapshot -updatedAt -status -__v')
            .lean();

        if (similarityFn) {
            inspirations.forEach(i => {
                (i as any).similarityScore = similarityFn(i);
            });
            inspirations = inspirations.sort((a, b) =>
                ((b as any).similarityScore ?? 0) - ((a as any).similarityScore ?? 0)
            );
        }

        inspirations = inspirations.slice(0, limit);

        logger.info(`${TAG} Encontradas ${inspirations.length} inspirações.`);
        return inspirations as ICommunityInspiration[];
    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar inspirações:`, error);
        throw new DatabaseError(`Erro ao buscar inspirações: ${error.message}`);
    }
}

/**
 * Busca inspirações usando uma query ponderada para encontrar o melhor match possível em uma única consulta.
 * Substitui a lógica de fallback sequencial.
 */
export async function getInspirationsWeighted(
    filters: CommunityInspirationFilters,
    limit: number = 3,
    excludeIds?: string[],
    excludeCreatorId?: string
): Promise<{
    inspiration: ICommunityInspiration;
    matchType: string;
    score: number;
    narrativeScore: number;
    performanceScore: number;
    personalizationScore: number;
    matchReasons: string[];
}[]> {
    const TAG = `${SERVICE_TAG}[getInspirationsWeighted]`;
    logger.info(`${TAG} Buscando inspirações ponderadas. Filtros: ${JSON.stringify(filters)}, limite: ${limit}`);

    try {
        await connectToDatabase();

        const matchStage: any = { status: 'active' };

        // Exclusões
        if (excludeIds && excludeIds.length > 0) {
            const validObjectIds = excludeIds
                .filter(id => mongoose.isValidObjectId(id))
                .map(id => new Types.ObjectId(id));
            if (validObjectIds.length > 0) {
                matchStage._id = { $nin: validObjectIds };
            }
        }
        if (excludeCreatorId && mongoose.isValidObjectId(excludeCreatorId)) {
            matchStage.originalCreatorId = { $ne: new Types.ObjectId(excludeCreatorId) };
        }

        // Filtro Base: Deve ter pelo menos a Proposta OU o Contexto (se fornecidos)
        // Isso garante que não retornamos coisas totalmente aleatórias.
        const orConditions = [];
        if (filters.proposal) orConditions.push({ proposal: filters.proposal });
        if (filters.context) orConditions.push({ context: filters.context });

        if (orConditions.length > 0) {
            matchStage.$or = orConditions;
        }

        // Filtros adicionais que não entram na pontuação ponderada
        if (filters.reference) {
            matchStage.reference = filters.reference;
        }
        if (filters.primaryObjectiveAchieved_Qualitative) {
            matchStage.primaryObjectiveAchieved_Qualitative = filters.primaryObjectiveAchieved_Qualitative;
        }
        if (filters.performanceHighlights_Qualitative_INCLUDES_ANY && filters.performanceHighlights_Qualitative_INCLUDES_ANY.length > 0) {
            matchStage.performanceHighlights_Qualitative = { $in: filters.performanceHighlights_Qualitative_INCLUDES_ANY };
        } else if (filters.performanceHighlights_Qualitative_CONTAINS) {
            matchStage.performanceHighlights_Qualitative = {
                $regex: filters.performanceHighlights_Qualitative_CONTAINS,
                $options: 'i'
            };
        }
        if (filters.tags_IA && filters.tags_IA.length > 0) {
            matchStage.tags_IA = { $in: filters.tags_IA };
        }

        const hasProposal = Boolean(filters.proposal);
        const hasContext = Boolean(filters.context);
        const hasFormat = Boolean(filters.format);
        const hasTone = Boolean(filters.tone);

        const exactConditions: any[] = [];
        if (hasProposal) exactConditions.push('$proposalMatch');
        if (hasContext) exactConditions.push('$contextMatch');
        if (hasFormat) exactConditions.push('$formatMatch');
        if (hasTone) exactConditions.push('$toneMatch');

        const matchTypeBranches: any[] = [];
        if (exactConditions.length > 0) {
            matchTypeBranches.push({ case: { $and: exactConditions }, then: "exact" });
        }
        if (hasProposal && hasContext) {
            matchTypeBranches.push({ case: { $and: ['$proposalMatch', '$contextMatch'] }, then: "broad_context" });
        }
        if (hasProposal) {
            matchTypeBranches.push({
                case: hasContext ? { $and: ['$proposalMatch', { $not: ['$contextMatch'] }] } : '$proposalMatch',
                then: "proposal_only"
            });
        }
        if (hasContext) {
            matchTypeBranches.push({
                case: hasProposal ? { $and: ['$contextMatch', { $not: ['$proposalMatch'] }] } : '$contextMatch',
                then: "context_only"
            });
        }

        const pipelineLimit = Math.max(limit, limit * 5);

        const pipeline: PipelineStage[] = [
            { $match: matchStage },
            {
                $addFields: {
                    proposalMatch: hasProposal ? { $eq: ["$proposal", filters.proposal] } : false,
                    contextMatch: hasContext ? { $eq: ["$context", filters.context] } : false,
                    formatMatch: hasFormat ? { $eq: ["$format", filters.format] } : false,
                    toneMatch: hasTone ? { $eq: ["$tone", filters.tone] } : false
                }
            },
            {
                $addFields: {
                    matchScore: {
                        $add: [
                            hasProposal ? { $cond: ["$proposalMatch", 10, 0] } : 0,
                            hasContext ? { $cond: ["$contextMatch", 8, 0] } : 0,
                            hasFormat ? { $cond: ["$formatMatch", 3, 0] } : 0,
                            hasTone ? { $cond: ["$toneMatch", 2, 0] } : 0
                        ]
                    }
                }
            },
            { $sort: { matchScore: -1, 'internalMetricsSnapshot.saveRate': -1 } },
            { $limit: pipelineLimit },
            {
                $project: {
                    inspiration: "$$ROOT",
                    matchScore: 1,
                    matchType: {
                        $switch: {
                            branches: matchTypeBranches,
                            default: "partial"
                        }
                    }
                }
            }
        ];

        const results = await CommunityInspirationModel.aggregate(pipeline).exec();

        const tokenize = (value: string) =>
            (value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .split(/[^a-z0-9]+/)
                .map((token) => token.trim())
                .filter((token) => token.length >= 3);
        const stopwords = new Set([
            'para', 'com', 'sem', 'sobre', 'como', 'porque', 'mais', 'menos', 'muito', 'muita', 'depois', 'antes',
            'roteiro', 'conteudo', 'conteudos', 'video', 'videos', 'post', 'posts', 'reel', 'reels', 'story', 'stories',
            'instagram', 'tiktok', 'youtube', 'quero', 'preciso', 'fazer', 'sobre',
        ]);
        const uniqueTokens = (tokens: string[]) => Array.from(new Set(tokens.filter((token) => !stopwords.has(token))));
        const queryTokens = uniqueTokens(tokenize(filters.narrativeQuery || '')).slice(0, 14);
        const queryTokenSet = new Set(queryTokens);
        const userTop = filters.userTopCategories || {};
        const topProposal = new Set((userTop.proposal || []).map((v) => String(v).trim()).filter(Boolean));
        const topContext = new Set((userTop.context || []).map((v) => String(v).trim()).filter(Boolean));
        const topFormat = new Set((userTop.format || []).map((v) => String(v).trim()).filter(Boolean));
        const topTone = new Set((userTop.tone || []).map((v) => String(v).trim()).filter(Boolean));

        const enriched = results.map((row: any) => {
            const inspiration = row.inspiration as ICommunityInspiration;
            const summaryTokens = uniqueTokens(tokenize(inspiration.contentSummary || ''));
            const highlightsTokens = uniqueTokens(
                tokenize(
                    Array.isArray(inspiration.performanceHighlights_Qualitative)
                        ? inspiration.performanceHighlights_Qualitative.join(' ')
                        : ''
                )
            );
            const sourceSet = new Set([...summaryTokens, ...highlightsTokens]);
            const overlap = queryTokens.length
                ? queryTokens.filter((token) => sourceSet.has(token)).length
                : 0;
            const narrativeScore = queryTokens.length ? overlap / queryTokens.length : 0;
            const reasonPieces: string[] = [];
            if (row.matchType === 'exact') {
                reasonPieces.push('match exato de proposta/contexto');
            } else if (row.matchType === 'proposal_only') {
                reasonPieces.push('mesma proposta');
            } else if (row.matchType === 'context_only' || row.matchType === 'broad_context') {
                reasonPieces.push('contexto semelhante');
            }
            if (hasFormat && row?.inspiration?.format === filters.format) {
                reasonPieces.push('formato alinhado');
            }
            if (hasTone && row?.inspiration?.tone === filters.tone) {
                reasonPieces.push('tom alinhado');
            }
            if (narrativeScore >= 0.2) {
                const overlapTokens = summaryTokens
                    .filter((token) => queryTokenSet.has(token))
                    .slice(0, 3);
                if (overlapTokens.length) {
                    reasonPieces.push(`narrativa similar (${overlapTokens.join(', ')})`);
                } else {
                    reasonPieces.push('narrativa semelhante ao pedido');
                }
            }
            const metrics = (inspiration?.internalMetricsSnapshot || {}) as Record<string, number | undefined>;
            const saveRate = Number(metrics.saveRate ?? 0);
            const shareRate = Number(metrics.shareRate ?? 0);
            const comments = Number(metrics.comments ?? 0);
            const likes = Number(metrics.likes ?? 0);
            const interactions = Number(metrics.totalInteractions ?? 0);

            const normalizedSaveRate = Math.max(0, Math.min(saveRate, 0.2)) / 0.2;
            const normalizedShareRate = Math.max(0, Math.min(shareRate, 0.12)) / 0.12;
            const normalizedCommentLike = Math.max(0, Math.min(comments / Math.max(likes, 1), 0.2)) / 0.2;
            const normalizedInteractions = Math.max(0, Math.min(interactions, 10000)) / 10000;
            const performanceScore =
                normalizedSaveRate * 0.45 +
                normalizedShareRate * 0.35 +
                normalizedCommentLike * 0.1 +
                normalizedInteractions * 0.1;

            let personalizationScore = 0;
            if (inspiration?.proposal && topProposal.has(String(inspiration.proposal))) personalizationScore += 0.45;
            if (inspiration?.context && topContext.has(String(inspiration.context))) personalizationScore += 0.35;
            if (inspiration?.format && topFormat.has(String(inspiration.format))) personalizationScore += 0.15;
            if (inspiration?.tone && topTone.has(String(inspiration.tone))) personalizationScore += 0.05;

            if (personalizationScore >= 0.4) {
                reasonPieces.push('alinhado com o que mais performa no seu perfil');
            }
            if (performanceScore >= 0.55) {
                reasonPieces.push('desempenho forte na comunidade (salvamentos/compartilhamentos)');
            }

            const finalScore =
                Number(row.matchScore || 0) +
                narrativeScore * 4 +
                performanceScore * 3 +
                personalizationScore * 3;
            return {
                inspiration,
                matchType: row.matchType as string,
                score: finalScore,
                narrativeScore,
                performanceScore,
                personalizationScore,
                matchReasons: reasonPieces,
            };
        });

        const ranked = enriched
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        logger.info(`${TAG} Encontradas ${ranked.length} inspirações ponderadas após rerank semântico.`);
        return ranked;

    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar inspirações ponderadas:`, error);
        throw new DatabaseError(`Erro ao buscar inspirações ponderadas: ${error.message}`);
    }
}

/**
 * Regista as inspirações que foram mostradas a um utilizador num determinado dia.
 */
export async function recordDailyInspirationShown(
    userId: string,
    inspirationIds: string[]
): Promise<void> {
    const TAG = `${SERVICE_TAG}[recordDailyInspirationShown]`;

    if (!inspirationIds || inspirationIds.length === 0) {
        logger.debug(`${TAG} Nenhuma ID de inspiração fornecida para User ${userId}. Pulando registo.`);
        return;
    }
    logger.info(`${TAG} Registando inspirações [${inspirationIds.join(',')}] como mostradas hoje para User ${userId}.`);

    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de utilizador inválido: ${userId}`);
        throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
    }

    const validInspirationObjectIds = inspirationIds
        .filter(id => mongoose.isValidObjectId(id))
        .map(id => new Types.ObjectId(id));

    if (validInspirationObjectIds.length === 0) {
        logger.warn(`${TAG} Nenhuma ID de inspiração válida fornecida após filtro para User ${userId}. Pulando registo.`);
        return;
    }

    try {
        await connectToDatabase();
        const today = startOfDay(new Date());
        await User.findByIdAndUpdate(userId, {
            $set: {
                lastCommunityInspirationShown_Daily: {
                    date: today,
                    inspirationIds: validInspirationObjectIds,
                },
            },
            $push: {
                communityInspirationHistory: {
                    $each: [{ date: today, inspirationIds: validInspirationObjectIds }],
                    $slice: -7
                }
            }
        });
        logger.info(`${TAG} Registo de inspirações diárias atualizado para User ${userId}.`);
    } catch (error: any) {
        logger.error(`${TAG} Erro ao registar inspirações diárias para User ${userId}:`, error);
        throw new DatabaseError(`Erro ao registar inspirações diárias: ${error.message}`);
    }
}

/**
 * Encontra posts de um utilizador que são elegíveis para serem adicionados à comunidade.
 */
export async function findUserPostsEligibleForCommunity(
    userId: string,
    criteria: { sinceDate: Date; minPerformanceCriteria?: CommunityPerformanceCriteria }
): Promise<FindUserPostsEligibleForCommunityResult> {
    const TAG = `${SERVICE_TAG}[findUserPostsEligibleForCommunity]`;
    logger.info(`${TAG} Buscando posts elegíveis para comunidade para User ${userId} desde ${criteria.sinceDate.toISOString()}`);

    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de utilizador inválido: ${userId}`);
        throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
    }

    const userObjectId = new Types.ObjectId(userId);

    try {
        await connectToDatabase();

        // 1. Define a consulta base para encontrar o conjunto inicial de documentos.
        const baseQuery = {
            user: userObjectId,
            postDate: { $gte: criteria.sinceDate },
            classificationStatus: 'completed',
            source: 'api',
        };

        const pipeline: PipelineStage[] = [{ $match: baseQuery }];
        const performanceMatch: any = {};
        let fullQueryForDebug: any = { baseQuery: { ...baseQuery } };

        // 2. Se houver critérios de performance, adiciona estágios para calcular e filtrar.
        if (criteria.minPerformanceCriteria) {
            const perf = criteria.minPerformanceCriteria;

            // Adiciona um estágio para calcular taxas (saveRate, shareRate).
            pipeline.push({
                $addFields: {
                    saveRate: {
                        $cond: {
                            if: { $gt: ['$stats.reach', 0] },
                            then: { $divide: [{ $ifNull: ['$stats.saved', 0] }, '$stats.reach'] },
                            else: 0
                        }
                    },
                    shareRate: {
                        $cond: {
                            if: { $gt: ['$stats.reach', 0] },
                            then: { $divide: [{ $ifNull: ['$stats.shares', 0] }, '$stats.reach'] },
                            else: 0
                        }
                    }
                }
            });

            // Constrói o objeto de consulta para o segundo estágio de match (performance).
            if (typeof perf.minLikes === 'number') performanceMatch['stats.likes'] = { $gte: perf.minLikes };
            if (typeof perf.minComments === 'number') performanceMatch['stats.comments'] = { $gte: perf.minComments };
            if (typeof perf.minShares === 'number') performanceMatch['stats.shares'] = { $gte: perf.minShares };
            if (typeof perf.minSaved === 'number') performanceMatch['stats.saved'] = { $gte: perf.minSaved };
            if (typeof perf.minReach === 'number') performanceMatch['stats.reach'] = { $gte: perf.minReach };
            if (typeof perf.minSaveRate === 'number') performanceMatch.saveRate = { $gte: perf.minSaveRate };
            if (typeof perf.minShareRate === 'number') performanceMatch.shareRate = { $gte: perf.minShareRate };

            // Adiciona o estágio de match de performance ao pipeline, se houver critérios.
            if (Object.keys(performanceMatch).length > 0) {
                pipeline.push({ $match: performanceMatch });
                fullQueryForDebug.performanceMatch = { ...performanceMatch };
            }
        }

        // 3. Adiciona o cálculo de interações totais, ordenação e limite.
        const interactionsField = {
            $add: [
                { $ifNull: ['$stats.likes', 0] },
                { $ifNull: ['$stats.comments', 0] },
                { $ifNull: ['$stats.shares', 0] },
                { $ifNull: ['$stats.saved', 0] }
            ]
        };

        pipeline.push(
            {
                $addFields: {
                    'stats.total_interactions': {
                        $ifNull: ['$stats.total_interactions', interactionsField]
                    }
                }
            },
            { $sort: { 'stats.total_interactions': -1 } },
            { $limit: 50 }
        );

        const eligiblePosts = await MetricModel.aggregate(pipeline).exec();

        logger.info(`${TAG} Encontrados ${eligiblePosts.length} posts elegíveis para comunidade para User ${userId}.`);

        if (eligiblePosts.length === 0) {
            logger.debug(`${TAG} Query final para zero resultados: ${JSON.stringify(fullQueryForDebug)}`);
            logger.debug(`${TAG} sinceDate utilizado: ${criteria.sinceDate.toISOString()}`);

            // DEBUG FINAL: Se não encontrou nada, loga uma amostra dos posts que passaram na baseQuery mas falharam na performance.
            try {
                const diagnosticPipeline: PipelineStage[] = [
                    { $match: baseQuery },
                    {
                        $addFields: {
                            saveRate: {
                                $cond: {
                                    if: { $gt: ['$stats.reach', 0] },
                                    then: { $divide: [{ $ifNull: ['$stats.saved', 0] }, '$stats.reach'] },
                                    else: 0
                                }
                            }
                        }
                    },
                    { $limit: 5 },
                    {
                        $project: {
                            _id: 0,
                            postId_Instagram: 1,
                            'stats.shares': 1,
                            'stats.saved': 1,
                            'stats.reach': 1,
                            saveRate: 1
                        }
                    }
                ];
                const rejectedCandidates = await MetricModel.aggregate(diagnosticPipeline).exec();
                if (rejectedCandidates.length > 0) {
                    logger.debug(`${TAG} [DIAGNÓSTICO] Amostra de posts que foram REJEITADOS pelo filtro de performance: ${JSON.stringify(rejectedCandidates, null, 2)}`);
                } else {
                    logger.debug(`${TAG} [DIAGNÓSTICO] Nenhum documento encontrado, mesmo na baseQuery. Verifique os critérios de data, status e source.`);
                }
            } catch (e) {
                logger.warn(`${TAG} [DIAGNÓSTICO] Falha ao executar pipeline de diagnóstico de rejeitados.`, e);
            }
        }

        return { posts: eligiblePosts as IMetric[], query: fullQueryForDebug, sinceDate: criteria.sinceDate };
    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar posts elegíveis para comunidade para User ${userId}:`, error);
        throw new DatabaseError(`Erro ao buscar posts elegíveis: ${error.message}`);
    }
}
