// src/app/lib/dataService/communityService.ts - v2.14.7 (Otimiza addInspiration com findOneAndUpdate e upsert)
// - ATUALIZADO: Função addInspiration refatorada para usar findOneAndUpdate com upsert:true para maior eficiência e atomicidade.
// - Baseado na v2.14.6.

import mongoose, { Types } from 'mongoose';
import { startOfDay } from 'date-fns';

import { logger } from '@/app/lib/logger';
import { UserNotFoundError, DatabaseError } from '@/app/lib/errors';

import User, { IUser } from '@/app/models/User';
import CommunityInspirationModel, { ICommunityInspiration } from '@/app/models/CommunityInspiration';
import MetricModel, { IMetric } from '@/app/models/Metric';

import { connectToDatabase } from './connection';
import { CommunityInspirationFilters, CommunityPerformanceCriteria } from './types';
import {
    FormatType,
    ProposalType,
    ContextType,
    QualitativeObjectiveType,
    PerformanceHighlightType
} from "@/app/lib/constants/communityInspirations.constants";

const SERVICE_TAG = '[dataService][communityService v2.14.7]'; // Versão atualizada

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
    const TAG = `${SERVICE_TAG}[optInUserToCommunity]`; // Mantém versão interna da lógica se não alterada
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
    const TAG = `${SERVICE_TAG}[addInspiration v2.14.7]`; // Tag de função atualizada
    logger.info(`${TAG} Adicionando/Atualizando inspiração. PostId Instagram: ${inspirationData.postId_Instagram}`);

    if (!inspirationData.postId_Instagram) {
        logger.error(`${TAG} postId_Instagram é obrigatório para adicionar uma inspiração.`);
        throw new DatabaseError('postId_Instagram é obrigatório para adicionar uma inspiração.');
    }

    try {
        await connectToDatabase();

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        
        // Verifica se o documento foi inserido ou atualizado para logar corretamente
        // (findOneAndUpdate não indica diretamente se foi upsert ou update no retorno padrão,
        //  mas podemos inferir se o addedToCommunityAt foi setado pelo $setOnInsert,
        //  ou comparando timestamps se necessário, mas para o log, um genérico é suficiente)
        logger.info(`${TAG} Inspiração ID: ${upsertedInspiration._id} (PostId Instagram: ${upsertedInspiration.postId_Instagram}) criada/atualizada com sucesso.`);
        return upsertedInspiration as ICommunityInspiration;

    } catch (error: any) {
        logger.error(`${TAG} Erro ao adicionar/atualizar inspiração para PostId Instagram ${inspirationData.postId_Instagram}:`, error);
        throw new DatabaseError(`Erro ao adicionar/atualizar inspiração: ${error.message}`);
    }
}

/**
 * Busca inspirações na comunidade com base em filtros.
 * ATUALIZADO v2.14.6: Melhorada a ordenação para incluir um fator de "qualidade" (ex: saveRate).
 * @param filters - Os filtros a serem aplicados na busca.
 * @param limit - O número máximo de inspirações a serem retornadas (padrão: 3).
 * @param excludeIds - Um array opcional de IDs de inspiração a serem excluídos dos resultados.
 * @returns Uma promessa que resolve para um array de inspirações encontradas.
 * @throws {DatabaseError} Se ocorrer um erro de banco de dados.
 */
export async function getInspirations(
    filters: CommunityInspirationFilters,
    limit: number = 3,
    excludeIds?: string[]
): Promise<ICommunityInspiration[]> {
    const TAG = `${SERVICE_TAG}[getInspirations v2.14.6]`; // Lógica da v2.14.6 mantida
    logger.info(`${TAG} Buscando inspirações com filtros: ${JSON.stringify(filters)}, limite: ${limit}, excluir IDs: ${excludeIds?.join(',')}`);

    const query: any = { status: 'active' };

    if (filters.proposal) query.proposal = filters.proposal;
    if (filters.context) query.context = filters.context;
    if (filters.format) query.format = filters.format;
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

    try {
        await connectToDatabase();
        const inspirations = await CommunityInspirationModel.find(query)
            .sort({ addedToCommunityAt: -1, 'internalMetricsSnapshot.saveRate': -1 })
            .limit(limit)
            .select('-internalMetricsSnapshot -updatedAt -status -__v') 
            .lean();

        logger.info(`${TAG} Encontradas ${inspirations.length} inspirações.`);
        return inspirations as ICommunityInspiration[];
    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar inspirações:`, error);
        throw new DatabaseError(`Erro ao buscar inspirações: ${error.message}`);
    }
}

/**
 * Regista as inspirações que foram mostradas a um utilizador num determinado dia.
 */
export async function recordDailyInspirationShown(
    userId: string,
    inspirationIds: string[]
): Promise<void> {
    const TAG = `${SERVICE_TAG}[recordDailyInspirationShown v2.14.6]`; // Lógica da v2.14.6 mantida

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
        await User.findByIdAndUpdate(userId, {
            $set: {
                lastCommunityInspirationShown_Daily: {
                    date: startOfDay(new Date()),
                    inspirationIds: validInspirationObjectIds,
                },
            },
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
): Promise<IMetric[]> {
    const TAG = `${SERVICE_TAG}[findUserPostsEligibleForCommunity v2.14.8]`;
    logger.info(`${TAG} Buscando posts elegíveis para comunidade para User ${userId} desde ${criteria.sinceDate.toISOString()}`);

    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de utilizador inválido: ${userId}`);
        throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
    }

    const userObjectId = new Types.ObjectId(userId);

    const query: any = {
        user: userObjectId,
        postDate: { $gte: criteria.sinceDate },
        classificationStatus: 'completed',
        source: 'api',
    };

    if (criteria.minPerformanceCriteria) {
        const perf = criteria.minPerformanceCriteria;
        if (typeof perf.minLikes === 'number') query['stats.likes'] = { $gte: perf.minLikes };
        if (typeof perf.minComments === 'number') query['stats.comments'] = { $gte: perf.minComments };
        if (typeof perf.minShares === 'number') query['stats.shares'] = { $gte: perf.minShares };
        if (typeof perf.minSaved === 'number') query['stats.saved'] = { $gte: perf.minSaved };
        if (typeof perf.minReach === 'number') query['stats.reach'] = { $gte: perf.minReach };

        const exprConditions: any[] = [];
        if (typeof perf.minSaveRate === 'number') {
            exprConditions.push({
                $gte: [
                    { $cond: [ { $gt: ['$stats.reach', 0] }, { $divide: ['$stats.saved', '$stats.reach'] }, 0 ] },
                    perf.minSaveRate
                ]
            });
        }
        if (typeof perf.minShareRate === 'number') {
            exprConditions.push({
                $gte: [
                    { $cond: [ { $gt: ['$stats.reach', 0] }, { $divide: ['$stats.shares', '$stats.reach'] }, 0 ] },
                    perf.minShareRate
                ]
            });
        }
        if (exprConditions.length === 1) {
            query.$expr = exprConditions[0];
        } else if (exprConditions.length > 1) {
            query.$expr = { $and: exprConditions };
        }
    }

    try {
        await connectToDatabase();
        const eligiblePosts = await MetricModel.find(query)
            .sort({ postDate: -1 })
            .limit(50)
            .lean();

        logger.info(`${TAG} Encontrados ${eligiblePosts.length} posts elegíveis para comunidade para User ${userId}.`);
        return eligiblePosts as IMetric[];
    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar posts elegíveis para comunidade para User ${userId}:`, error);
        throw new DatabaseError(`Erro ao buscar posts elegíveis: ${error.message}`);
    }
}
