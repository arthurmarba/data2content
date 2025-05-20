/**
 * @fileoverview Serviço para operações relacionadas à Comunidade de Inspiração no dataService.
 * @version 2.14.4
 */
import mongoose, { Types } from 'mongoose';
import { startOfDay } from 'date-fns'; // Para normalizar datas para o início do dia

// Logger e Erros
import { logger } from '@/app/lib/logger'; // Ajuste o caminho se necessário
import { UserNotFoundError, DatabaseError } from '@/app/lib/errors'; // Ajuste o caminho se necessário

// Modelos Mongoose
// Ajuste os caminhos para os seus modelos conforme a estrutura do seu projeto.
import User, { IUser } from '@/app/models/User';
import CommunityInspirationModel, { ICommunityInspiration } from '@/app/models/CommunityInspiration';
import MetricModel, { IMetric } from '@/app/models/Metric'; // Para findUserPostsEligibleForCommunity

// Conexão com o banco de dados e tipos locais
import { connectToDatabase } from './connection';
import { CommunityInspirationFilters } from './types'; // Importa a interface de filtros

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
    const TAG = '[dataService][communityService][optInUserToCommunity]'; // Tag de log atualizada
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
        await connectToDatabase(); // Garante conexão
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    communityInspirationOptIn: true,
                    communityInspirationOptInDate: new Date(),
                    communityInspirationTermsVersion: termsVersion.trim(),
                },
            },
            { new: true, runValidators: true } // Retorna o documento atualizado e executa validadores
        ).lean();

        if (!updatedUser) {
            logger.warn(`${TAG} Utilizador ${userId} não encontrado para opt-in.`);
            throw new UserNotFoundError(`Utilizador ${userId} não encontrado.`);
        }
        logger.info(`${TAG} Opt-in para comunidade registado com sucesso para User ${userId}.`);
        return updatedUser as IUser; // Assegura o tipo IUser
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
    const TAG = '[dataService][communityService][optOutUserFromCommunity]'; // Tag de log atualizada
    logger.info(`${TAG} Registando opt-out da comunidade para User ${userId}.`);

    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de utilizador inválido: ${userId}`);
        throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
    }

    try {
        await connectToDatabase(); // Garante conexão
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $set: { // Define communityInspirationOptIn como false
                    communityInspirationOptIn: false,
                    // Opcionalmente, pode-se limpar communityInspirationOptInDate e communityInspirationTermsVersion
                    // communityInspirationOptInDate: null,
                    // communityInspirationTermsVersion: null,
                },
            },
            { new: true, runValidators: true }
        ).lean();

        if (!updatedUser) {
            logger.warn(`${TAG} Utilizador ${userId} não encontrado para opt-out.`);
            throw new UserNotFoundError(`Utilizador ${userId} não encontrado.`);
        }
        logger.info(`${TAG} Opt-out da comunidade registado com sucesso para User ${userId}.`);
        return updatedUser as IUser; // Assegura o tipo IUser
    } catch (error: any) {
        logger.error(`${TAG} Erro ao registar opt-out para User ${userId}:`, error);
        if (error instanceof UserNotFoundError) throw error;
        throw new DatabaseError(`Erro ao registar opt-out da comunidade: ${error.message}`);
    }
}

/**
 * Adiciona uma nova inspiração à comunidade ou atualiza uma existente com o mesmo postId_Instagram.
 * @param inspirationData - Os dados da inspiração a serem adicionados/atualizados.
 * @returns Uma promessa que resolve para o objeto da inspiração criada ou atualizada.
 * @throws {DatabaseError} Se ocorrer um erro de banco de dados.
 */
export async function addInspiration(
    inspirationData: Partial<ICommunityInspiration> // Permite dados parciais para criação/atualização
): Promise<ICommunityInspiration> {
    const TAG = '[dataService][communityService][addInspiration]'; // Tag de log atualizada
    logger.info(`${TAG} Adicionando/Atualizando inspiração. PostId Instagram: ${inspirationData.postId_Instagram}`);

    if (!inspirationData.postId_Instagram) {
        logger.error(`${TAG} postId_Instagram é obrigatório para adicionar uma inspiração.`);
        throw new DatabaseError('postId_Instagram é obrigatório para adicionar uma inspiração.');
    }

    try {
        await connectToDatabase(); // Garante conexão

        // Tenta encontrar uma inspiração existente com o mesmo postId_Instagram
        const existingInspiration = await CommunityInspirationModel.findOne({
            postId_Instagram: inspirationData.postId_Instagram
        });

        if (existingInspiration) {
            logger.warn(`${TAG} Inspiração com postId_Instagram ${inspirationData.postId_Instagram} já existe (ID: ${existingInspiration._id}). Atualizando...`);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { addedToCommunityAt, _id, ...updateFields } = inspirationData; // Evita sobrescrever addedToCommunityAt e _id
            const updatedInspiration = await CommunityInspirationModel.findByIdAndUpdate(
                existingInspiration._id,
                { $set: updateFields, $currentDate: { updatedAt: true } }, // Atualiza e define updatedAt
                { new: true, runValidators: true }
            ).lean();

            if (!updatedInspiration) {
                 // Isso seria inesperado se existingInspiration foi encontrado
                 logger.error(`${TAG} Falha ao ATUALIZAR inspiração existente com postId_Instagram ${inspirationData.postId_Instagram}`);
                 throw new DatabaseError(`Falha ao ATUALIZAR inspiração existente com postId_Instagram ${inspirationData.postId_Instagram}`);
            }
            logger.info(`${TAG} Inspiração existente ${updatedInspiration._id} atualizada.`);
            return updatedInspiration as ICommunityInspiration; // Assegura o tipo
        }

        // Se não existir, cria uma nova inspiração
        // Define addedToCommunityAt e updatedAt na criação
        const newInspirationData = {
            ...inspirationData,
            addedToCommunityAt: inspirationData.addedToCommunityAt || new Date(),
            updatedAt: new Date()
        };
        const newInspiration = await CommunityInspirationModel.create(newInspirationData);
        logger.info(`${TAG} Nova inspiração ID: ${newInspiration._id} (PostId Instagram: ${newInspiration.postId_Instagram}) criada com sucesso.`);
        return newInspiration as ICommunityInspiration; // Assegura o tipo

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
 * @returns Uma promessa que resolve para um array de inspirações encontradas.
 * @throws {DatabaseError} Se ocorrer um erro de banco de dados.
 */
export async function getInspirations(
    filters: CommunityInspirationFilters,
    limit: number = 3,
    excludeIds?: string[] // IDs a serem excluídos (strings)
): Promise<ICommunityInspiration[]> {
    const TAG = '[dataService][communityService][getInspirations]'; // Tag de log atualizada
    logger.info(`${TAG} Buscando inspirações com filtros: ${JSON.stringify(filters)}, limite: ${limit}, excluir IDs: ${excludeIds?.join(',')}`);

    const query: any = { status: 'active' }; // Filtra por inspirações ativas por padrão

    // Aplica filtros do objeto CommunityInspirationFilters
    if (filters.proposal) query.proposal = filters.proposal;
    if (filters.context) query.context = filters.context;
    if (filters.format) query.format = filters.format;
    if (filters.primaryObjectiveAchieved_Qualitative) query.primaryObjectiveAchieved_Qualitative = filters.primaryObjectiveAchieved_Qualitative;
    if (filters.performanceHighlights_Qualitative_CONTAINS) {
        query.performanceHighlights_Qualitative = {
            $regex: filters.performanceHighlights_Qualitative_CONTAINS,
            $options: "i" // Case-insensitive
        };
    }
    if (filters.tags_IA && filters.tags_IA.length > 0) {
        query.tags_IA = { $in: filters.tags_IA }; // Encontra documentos que contenham qualquer uma das tags
    }

    // Adiciona filtro para excluir IDs, se fornecido
    if (excludeIds && excludeIds.length > 0) {
        const validObjectIds = excludeIds
            .filter(id => mongoose.isValidObjectId(id)) // Filtra apenas IDs válidos
            .map(id => new Types.ObjectId(id)); // Converte para ObjectId
        if (validObjectIds.length > 0) {
            query._id = { $nin: validObjectIds }; // Não incluir estes IDs
        }
    }

    try {
        await connectToDatabase(); // Garante conexão
        const inspirations = await CommunityInspirationModel.find(query)
            .sort({ addedToCommunityAt: -1 }) // Ordena pelas mais recentes adicionadas à comunidade
            .limit(limit) // Aplica o limite de resultados
            .select('-internalMetricsSnapshot -updatedAt -status -__v') // Oculta campos internos/desnecessários
            .lean();

        logger.info(`${TAG} Encontradas ${inspirations.length} inspirações.`);
        return inspirations as ICommunityInspiration[]; // Assegura o tipo
    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar inspirações:`, error);
        throw new DatabaseError(`Erro ao buscar inspirações: ${error.message}`);
    }
}

/**
 * Regista as inspirações que foram mostradas a um utilizador num determinado dia.
 * @param userId - O ID do utilizador.
 * @param inspirationIds - Um array de IDs das inspirações mostradas.
 * @returns Uma promessa que resolve quando o registo é concluído.
 * @throws {DatabaseError} Se o ID do utilizador for inválido, não houver IDs de inspiração válidos ou ocorrer um erro de banco de dados.
 */
export async function recordDailyInspirationShown(
    userId: string,
    inspirationIds: string[] // IDs como strings
): Promise<void> {
    const TAG = '[dataService][communityService][recordDailyInspirationShown]'; // Tag de log atualizada

    if (!inspirationIds || inspirationIds.length === 0) {
        logger.debug(`${TAG} Nenhuma ID de inspiração fornecida para User ${userId}. Pulando registo.`);
        return; // Sai se não houver IDs para registar
    }
    logger.info(`${TAG} Registando inspirações [${inspirationIds.join(',')}] como mostradas hoje para User ${userId}.`);

    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de utilizador inválido: ${userId}`);
        throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
    }

    // Valida e converte os IDs de inspiração para ObjectId
    const validInspirationObjectIds = inspirationIds
        .filter(id => mongoose.isValidObjectId(id))
        .map(id => new Types.ObjectId(id));

    if (validInspirationObjectIds.length === 0) {
        logger.warn(`${TAG} Nenhuma ID de inspiração válida fornecida após filtro para User ${userId}. Pulando registo.`);
        return; // Sai se não houver IDs válidos
    }

    try {
        await connectToDatabase(); // Garante conexão
        await User.findByIdAndUpdate(userId, {
            $set: {
                lastCommunityInspirationShown_Daily: {
                    date: startOfDay(new Date()), // Normaliza para o início do dia atual
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
 * @param userId - O ID do utilizador.
 * @param criteria - Critérios para elegibilidade, como data mínima.
 * @param criteria.sinceDate - Data a partir da qual procurar posts.
 * @param criteria.minPerformanceCriteria - (Não implementado no original) Critérios de performance.
 * @returns Uma promessa que resolve para um array de posts (IMetric) elegíveis.
 * @throws {DatabaseError} Se o ID do utilizador for inválido ou ocorrer um erro de banco de dados.
 */
export async function findUserPostsEligibleForCommunity(
    userId: string,
    criteria: { sinceDate: Date; minPerformanceCriteria?: any; }
): Promise<IMetric[]> {
    const TAG = '[dataService][communityService][findUserPostsEligibleForCommunity]'; // Tag de log atualizada
    logger.info(`${TAG} Buscando posts elegíveis para comunidade para User ${userId} desde ${criteria.sinceDate.toISOString()}`);

    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de utilizador inválido: ${userId}`);
        throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
    }

    const userObjectId = new Types.ObjectId(userId);

    // Query base para posts elegíveis
    const query: any = {
        user: userObjectId,
        postDate: { $gte: criteria.sinceDate }, // Posts a partir da data fornecida
        classificationStatus: 'completed', // Post precisa estar classificado (exemplo de critério)
        source: 'api', // Post originado via API (ex: Instagram Graph API, exemplo de critério)
        // Adicionar outros critérios de elegibilidade aqui, se necessário.
        // Por exemplo, verificar se o post já não está na comunidade (requereria um campo no MetricModel ou consulta adicional).
        // Ou critérios de performance (ex: `stats.engagementRate: { $gte: 0.05 }`)
    };

    // if (criteria.minPerformanceCriteria) {
    //     // Lógica para adicionar critérios de performance à query
    //     // Ex: query['stats.likes'] = { $gte: criteria.minPerformanceCriteria.minLikes };
    // }

    try {
        await connectToDatabase(); // Garante conexão
        // Limitar a um número razoável de posts para análise e evitar sobrecarga
        const eligiblePosts = await MetricModel.find(query)
            .sort({ postDate: -1 }) // Mais recentes primeiro
            .limit(50) // Limite de posts a serem retornados
            .lean();

        logger.info(`${TAG} Encontrados ${eligiblePosts.length} posts elegíveis para comunidade para User ${userId}.`);
        return eligiblePosts as IMetric[]; // Assegura o tipo
    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar posts elegíveis para comunidade para User ${userId}:`, error);
        throw new DatabaseError(`Erro ao buscar posts elegíveis: ${error.message}`);
    }
}
