/**
 * @fileoverview Serviço para operações relacionadas a utilizadores no dataService.
 * @version 2.14.4
 */
import mongoose, { Types } from 'mongoose';
import { logger } from '@/app/lib/logger'; // Ajuste o caminho se necessário
import { UserNotFoundError, DatabaseError } from '@/app/lib/errors'; // OperationNotPermittedError não é usado aqui diretamente

// Modelos Mongoose
// Ajuste os caminhos para os seus modelos conforme a estrutura do seu projeto.
import User, {
    IUser,
    UserExpertiseLevel,
    IUserPreferences,
    IUserLongTermGoal,
    IUserKeyFact,
    IAlertHistoryEntry,
} from '@/app/models/User';
import MetricModel from '@/app/models/Metric';
import DailyMetricSnapshotModel from '@/app/models/DailyMetricSnapshot';
import CommunityInspirationModel from '@/app/models/CommunityInspiration';
import AccountInsightModel from '@/app/models/AccountInsight';
import AdDeal from '@/app/models/AdDeal';
import StoryMetricModel from '@/app/models/StoryMetric'; // Modelo para métricas de stories

// Conexão com o banco de dados
import { connectToDatabase } from './connection';

/**
 * Procura um utilizador pelo número de telefone do WhatsApp.
 * @param fromPhone - O número de telefone para procurar.
 * @returns Uma promessa que resolve para o objeto do utilizador encontrado.
 * @throws {UserNotFoundError} Se o utilizador não for encontrado.
 * @throws {DatabaseError} Se ocorrer um erro de banco de dados.
 */
export async function lookupUser(fromPhone: string): Promise<IUser> {
    const maskedPhone = fromPhone.slice(0, -4) + '****';
    const fnTag = '[dataService][userService][lookupUser]'; // Tag de log atualizada
    logger.debug(`${fnTag} Buscando utilizador para telefone ${maskedPhone}`);
    try {
        await connectToDatabase();
        const user = await User.findOne({ whatsappPhone: fromPhone }).lean();
        if (!user) {
            logger.warn(`${fnTag} Utilizador não encontrado para telefone ${maskedPhone}`);
            throw new UserNotFoundError(`Utilizador não encontrado (${maskedPhone})`);
        }
        logger.info(`${fnTag} Utilizador ${user._id} encontrado para telefone ${maskedPhone}`);
        return user as IUser; // Assegura o tipo IUser
    } catch (error: any) {
        if (error instanceof UserNotFoundError) throw error;
        logger.error(`${fnTag} Erro de banco de dados ao buscar utilizador ${maskedPhone}:`, error);
        throw new DatabaseError(`Erro ao buscar utilizador: ${error.message}`);
    }
}

/**
 * Procura um utilizador pelo seu ID.
 * @param userId - O ID do utilizador a procurar.
 * @returns Uma promessa que resolve para o objeto do utilizador encontrado.
 * @throws {DatabaseError} Se o ID do utilizador for inválido ou ocorrer um erro de banco de dados.
 * @throws {UserNotFoundError} Se o utilizador não for encontrado.
 */
export async function lookupUserById(userId: string): Promise<IUser> {
    const fnTag = '[dataService][userService][lookupUserById]'; // Tag de log atualizada
    logger.debug(`${fnTag} Buscando utilizador por ID ${userId}`);
    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${fnTag} ID de utilizador inválido fornecido: ${userId}`);
        throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
    }
    try {
        await connectToDatabase();
        const user = await User.findById(userId).lean();
        if (!user) {
            logger.warn(`${fnTag} Utilizador não encontrado para ID ${userId}`);
            throw new UserNotFoundError(`Utilizador não encontrado para ID: ${userId}`);
        }
        logger.info(`${fnTag} Utilizador ${userId} encontrado.`);
        return user as IUser; // Assegura o tipo IUser
    } catch (error: any) {
        if (error instanceof UserNotFoundError) throw error;
        logger.error(`${fnTag} Erro de banco de dados ao buscar utilizador ${userId}:`, error);
        throw new DatabaseError(`Erro ao buscar utilizador por ID: ${error.message}`);
    }
}

/**
 * Atualiza o nível de especialização inferido de um utilizador.
 * @param userId - O ID do utilizador.
 * @param newLevel - O novo nível de especialização.
 * @returns Uma promessa que resolve para o objeto do utilizador atualizado ou null se não encontrado.
 * @throws {DatabaseError} Se o ID do utilizador for inválido ou ocorrer um erro de banco de dados.
 */
export async function updateUserExpertiseLevel(
  userId: string,
  newLevel: UserExpertiseLevel
): Promise<IUser | null> {
  const TAG = '[dataService][userService][updateUserExpertiseLevel]'; // Tag de log atualizada
  if (!mongoose.isValidObjectId(userId)) {
    logger.error(`${TAG} ID de utilizador inválido: ${userId}`);
    throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
  }
  logger.info(`${TAG} Tentando atualizar inferredExpertiseLevel para '${newLevel}' para User ${userId}.`);
  try {
    await connectToDatabase();
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { inferredExpertiseLevel: newLevel } },
      { new: true, runValidators: true } // Retorna o documento atualizado e executa validadores
    ).lean();

    if (!updatedUser) {
      logger.warn(`${TAG} Utilizador ${userId} não encontrado para atualizar nível de expertise.`);
      return null;
    }
    logger.info(`${TAG} Nível de expertise atualizado com sucesso para User ${userId}. Novo nível: ${updatedUser.inferredExpertiseLevel}`);
    return updatedUser as IUser; // Assegura o tipo IUser
  } catch (error: any) {
    logger.error(`${TAG} Erro ao atualizar nível de expertise para User ${userId}:`, error);
    throw new DatabaseError(`Erro ao atualizar nível de expertise: ${error.message}`);
  }
}

/**
 * Atualiza as preferências de um utilizador.
 * @param userId - O ID do utilizador.
 * @param preferences - Um objeto parcial com as preferências a serem atualizadas.
 * @returns Uma promessa que resolve para o objeto do utilizador atualizado ou null se não encontrado.
 * @throws {DatabaseError} Se o ID do utilizador for inválido ou ocorrer um erro de banco de dados.
 */
export async function updateUserPreferences(
  userId: string,
  preferences: Partial<IUserPreferences>
): Promise<IUser | null> {
  const TAG = '[dataService][userService][updateUserPreferences]'; // Tag de log atualizada
  if (!mongoose.isValidObjectId(userId)) {
    logger.error(`${TAG} ID de utilizador inválido: ${userId}`);
    throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
  }
  logger.info(`${TAG} Atualizando userPreferences para User ${userId}: ${JSON.stringify(preferences)}`);
  try {
    await connectToDatabase();

    const updatePayload: Record<string, any> = {};
    // Mapeia apenas os campos de preferência fornecidos para o $set do MongoDB
    if (preferences.preferredFormats !== undefined) updatePayload['userPreferences.preferredFormats'] = preferences.preferredFormats;
    if (preferences.dislikedTopics !== undefined) updatePayload['userPreferences.dislikedTopics'] = preferences.dislikedTopics;
    if (preferences.preferredAiTone !== undefined) updatePayload['userPreferences.preferredAiTone'] = preferences.preferredAiTone;
    // Adicione outros campos de IUserPreferences aqui se necessário

    if (Object.keys(updatePayload).length === 0) {
        logger.warn(`${TAG} Nenhum dado de preferência fornecido para atualização para User ${userId}. Retornando utilizador sem alteração.`);
        return lookupUserById(userId); // Retorna o utilizador atual se não houver nada para atualizar
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updatePayload },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedUser) {
      logger.warn(`${TAG} Utilizador ${userId} não encontrado para atualizar preferências.`);
      return null;
    }
    logger.info(`${TAG} userPreferences atualizadas para User ${userId}.`);
    return updatedUser as IUser; // Assegura o tipo IUser
  } catch (error: any) {
    logger.error(`${TAG} Erro ao atualizar userPreferences para User ${userId}:`, error);
    throw new DatabaseError(`Erro ao atualizar preferências do utilizador: ${error.message}`);
  }
}

/**
 * Adiciona um objetivo de longo prazo para um utilizador.
 * @param userId - O ID do utilizador.
 * @param goalDescription - A descrição do objetivo.
 * @param status - O status inicial do objetivo (padrão: 'ativo').
 * @returns Uma promessa que resolve para o objeto do utilizador atualizado ou null se não encontrado.
 * @throws {DatabaseError} Se o ID do utilizador for inválido, a descrição for vazia ou ocorrer um erro de banco de dados.
 */
export async function addUserLongTermGoal(
  userId: string,
  goalDescription: string,
  status: IUserLongTermGoal['status'] = 'ativo' // Usa o tipo do model para status
): Promise<IUser | null> {
  const TAG = '[dataService][userService][addUserLongTermGoal]'; // Tag de log atualizada
  if (!mongoose.isValidObjectId(userId)) {
    logger.error(`${TAG} ID de utilizador inválido: ${userId}`);
    throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
  }
  if (!goalDescription || goalDescription.trim() === '') {
    logger.error(`${TAG} Descrição do objetivo não pode ser vazia para User ${userId}.`);
    throw new DatabaseError(`Descrição do objetivo não pode ser vazia.`);
  }

  logger.info(`${TAG} Adicionando longTermGoal para User ${userId}: "${goalDescription}" com status "${status}"`);
  try {
    await connectToDatabase();

    // Verifica se o objetivo já existe para evitar duplicatas
    const userWithExistingGoal = await User.findOne({ _id: userId, 'userLongTermGoals.goal': goalDescription.trim() });
    if (userWithExistingGoal) {
        logger.warn(`${TAG} Objetivo "${goalDescription.trim()}" já existe para User ${userId}. Não adicionando duplicata.`);
        return userWithExistingGoal as IUser;
    }

    const newGoal: IUserLongTermGoal = {
      goal: goalDescription.trim(),
      status,
      addedAt: new Date()
    };

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { userLongTermGoals: newGoal } }, // $addToSet para evitar duplicatas no array
      { new: true, runValidators: true }
    ).lean();

    if (!updatedUser) {
      logger.warn(`${TAG} Utilizador ${userId} não encontrado para adicionar longTermGoal.`);
      return null;
    }
    logger.info(`${TAG} longTermGoal adicionado para User ${userId}.`);
    return updatedUser as IUser; // Assegura o tipo IUser
  } catch (error: any) {
    logger.error(`${TAG} Erro ao adicionar longTermGoal para User ${userId}:`, error);
    throw new DatabaseError(`Erro ao adicionar objetivo de longo prazo: ${error.message}`);
  }
}

/**
 * Adiciona um facto chave para um utilizador.
 * @param userId - O ID do utilizador.
 * @param factDescription - A descrição do facto.
 * @returns Uma promessa que resolve para o objeto do utilizador atualizado ou null se não encontrado.
 * @throws {DatabaseError} Se o ID do utilizador for inválido, a descrição for vazia ou ocorrer um erro de banco de dados.
 */
export async function addUserKeyFact(
  userId: string,
  factDescription: string
): Promise<IUser | null> {
  const TAG = '[dataService][userService][addUserKeyFact]'; // Tag de log atualizada
  if (!mongoose.isValidObjectId(userId)) {
    logger.error(`${TAG} ID de utilizador inválido: ${userId}`);
    throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
  }
  if (!factDescription || factDescription.trim() === '') {
    logger.error(`${TAG} Descrição do facto não pode ser vazia para User ${userId}.`);
    throw new DatabaseError(`Descrição do facto não pode ser vazia.`);
  }

  logger.info(`${TAG} Adicionando keyFact para User ${userId}: "${factDescription}"`);
  try {
    await connectToDatabase();

    // Verifica se o facto já existe para evitar duplicatas
    const userWithExistingFact = await User.findOne({ _id: userId, 'userKeyFacts.fact': factDescription.trim() });
    if (userWithExistingFact) {
        logger.warn(`${TAG} Facto "${factDescription.trim()}" já existe para User ${userId}. Não adicionando duplicata.`);
        return userWithExistingFact as IUser;
    }

    const newFact: IUserKeyFact = {
      fact: factDescription.trim(),
      mentionedAt: new Date()
    };

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { userKeyFacts: newFact } }, // $addToSet para evitar duplicatas
      { new: true, runValidators: true }
    ).lean();

    if (!updatedUser) {
      logger.warn(`${TAG} Utilizador ${userId} não encontrado para adicionar keyFact.`);
      return null;
    }
    logger.info(`${TAG} keyFact adicionado para User ${userId}.`);
    return updatedUser as IUser; // Assegura o tipo IUser
  } catch (error: any) {
    logger.error(`${TAG} Erro ao adicionar keyFact para User ${userId}:`, error);
    throw new DatabaseError(`Erro ao adicionar facto chave: ${error.message}`);
  }
}

/**
 * Adiciona uma nova entrada ao histórico de alertas do Radar Tuca para um utilizador.
 * @param userId - O ID do utilizador.
 * @param alertEntry - O objeto da entrada de alerta a ser adicionado.
 * @returns O documento do utilizador atualizado ou null se o utilizador não for encontrado.
 * @throws DatabaseError em caso de falha na operação do banco de dados ou entrada inválida.
 */
export async function addAlertToHistory(
  userId: string,
  alertEntry: IAlertHistoryEntry // Usa o tipo do model
): Promise<IUser | null> {
  const TAG = '[dataService][userService][addAlertToHistory]'; // Tag de log atualizada
  if (!mongoose.isValidObjectId(userId)) {
    logger.error(`${TAG} ID de utilizador inválido: ${userId}`);
    throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
  }
  // Validação básica da entrada de alerta
  if (!alertEntry || !alertEntry.type || !alertEntry.details || !alertEntry.date) {
      logger.error(`${TAG} Entrada de alerta inválida para User ${userId}: ${JSON.stringify(alertEntry)}`);
      throw new DatabaseError(`Entrada de alerta inválida. Campos obrigatórios: type, details, date.`);
  }

  logger.info(`${TAG} Adicionando alerta ao histórico para User ${userId}. Tipo: ${alertEntry.type}, Data: ${alertEntry.date}`);
  try {
    await connectToDatabase();

    // Garante que a data seja um objeto Date
    const entryToPush: IAlertHistoryEntry = {
        ...alertEntry,
        date: new Date(alertEntry.date)
    };

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $push: { alertHistory: entryToPush } }, // $push para adicionar ao array
      { new: true, runValidators: true }
    ).lean();

    if (!updatedUser) {
      logger.warn(`${TAG} Utilizador ${userId} não encontrado para adicionar alerta ao histórico.`);
      return null;
    }
    logger.info(`${TAG} Alerta adicionado ao histórico para User ${userId}. Novo tamanho do histórico: ${updatedUser.alertHistory?.length || 0}`);
    return updatedUser as IUser; // Assegura o tipo IUser
  } catch (error: any) {
    logger.error(`${TAG} Erro ao adicionar alerta ao histórico para User ${userId}:`, error);
    throw new DatabaseError(`Erro ao adicionar alerta ao histórico: ${error.message}`);
  }
}

export interface FetchUserAlertsOptions {
  limit?: number;
  types?: string[];
}

export interface FetchUserAlertsResult {
  alerts: IAlertHistoryEntry[];
  totalAlerts: number;
}

export async function fetchUserAlerts(
  userId: string,
  { limit = 5, types = [] }: FetchUserAlertsOptions = {}
): Promise<FetchUserAlertsResult> {
  const TAG = '[dataService][userService][fetchUserAlerts]';

  if (!mongoose.isValidObjectId(userId)) {
    logger.error(`${TAG} ID de utilizador inválido: ${userId}`);
    throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
  }

  try {
    await connectToDatabase();
    const userObjectId = new Types.ObjectId(userId);

    const pipeline: any[] = [
      { $match: { _id: userObjectId } },
      { $unwind: '$alertHistory' },
    ];

    if (types.length > 0) {
      pipeline.push({ $match: { 'alertHistory.type': { $in: types } } });
    }

    pipeline.push({
      $facet: {
        alerts: [
          { $sort: { 'alertHistory.date': -1 } },
          { $limit: limit },
          { $replaceRoot: { newRoot: '$alertHistory' } },
        ],
        totalCount: [
          { $count: 'count' },
        ],
      },
    });

    const results = await User.aggregate(pipeline);
    const first = results[0] || { alerts: [], totalCount: [] };

    const alerts = (first.alerts || []) as IAlertHistoryEntry[];
    const totalAlerts = first.totalCount[0]?.count || 0;

    return { alerts, totalAlerts };
  } catch (error: any) {
    logger.error(`${TAG} Erro ao buscar alertas para o utilizador ${userId}:`, error);
    throw new DatabaseError(`Erro ao buscar alertas: ${error.message}`);
  }
}

/**
 * Busca o histórico de alertas de um utilizador.
 * @param userId - O ID do utilizador.
 * @param options - Opcionalmente, tipos para filtrar e limite de resultados.
 * @returns Um objeto contendo o array de alertas e o total encontrado.
 * @throws {DatabaseError} Se o ID for inválido ou ocorrer erro de banco.
 * @throws {UserNotFoundError} Se o utilizador não existir.
 */
export async function fetchUserAlerts(
  userId: string,
  options?: { types?: string[]; limit?: number }
): Promise<{ alerts: IAlertHistoryEntry[]; totalAlerts: number }> {
  const TAG = '[dataService][userService][fetchUserAlerts]';

  if (!mongoose.isValidObjectId(userId)) {
    logger.error(`${TAG} ID de utilizador inválido: ${userId}`);
    throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
  }

  try {
    await connectToDatabase();

    const userDoc = await User.findById(userId)
      .select('alertHistory')
      .lean<{ alertHistory?: IAlertHistoryEntry[] }>();

    if (!userDoc) {
      logger.warn(`${TAG} Utilizador ${userId} não encontrado ao buscar alertas.`);
      throw new UserNotFoundError(`Utilizador não encontrado para ID: ${userId}`);
    }

    let alerts: IAlertHistoryEntry[] = userDoc.alertHistory || [];
    const totalAlerts = alerts.length;

    if (options?.types && Array.isArray(options.types) && options.types.length > 0) {
      alerts = alerts.filter((a) => options.types!.includes(a.type));
    }

    alerts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (options?.limit && typeof options.limit === 'number' && options.limit > 0) {
      alerts = alerts.slice(0, options.limit);
    }

    return { alerts, totalAlerts };
  } catch (error: any) {
    if (error instanceof UserNotFoundError) throw error;
    logger.error(`${TAG} Erro ao buscar alertas para User ${userId}:`, error);
    throw new DatabaseError(`Erro ao buscar histórico de alertas: ${error.message}`);
  }
}

/**
 * Exclui a conta de um utilizador e todos os dados associados de forma transacional.
 * @param userId - O ID do utilizador a ser excluído.
 * @returns Uma promessa que resolve para true se a operação for bem-sucedida (ou se o utilizador já não existir mas os dados foram processados).
 * @throws {DatabaseError} Se o ID do utilizador for inválido ou ocorrer um erro crítico durante a exclusão.
 */
export async function deleteUserAccountAndAssociatedData(userId: string): Promise<boolean> {
  const TAG = '[dataService][userService][deleteUserAccountAndAssociatedData]'; // Tag de log atualizada

  if (!userId || !mongoose.isValidObjectId(userId)) {
    logger.error(`${TAG} ID de utilizador inválido fornecido para exclusão: ${userId}`);
    throw new DatabaseError(`ID de utilizador inválido para exclusão: ${userId}`);
  }

  const userObjectId = new Types.ObjectId(userId);
  let mongoSession: mongoose.ClientSession | null = null;

  try {
    const mongooseInstance = await connectToDatabase(); // Garante que o mongoose está conectado
    mongoSession = await mongooseInstance.startSession();
    mongoSession.startTransaction();
    logger.info(`${TAG} Iniciando transação para exclusão de dados do utilizador: ${userId}`);

    // 1. Encontrar IDs das métricas do utilizador para excluir snapshots associados
    const userMetrics = await MetricModel.find({ user: userObjectId }).select('_id').session(mongoSession).lean();
    const metricIds = userMetrics.map(metric => metric._id);

    if (metricIds.length > 0) {
        logger.info(`${TAG} Encontradas ${metricIds.length} métricas para o utilizador ${userId}.`);
        const snapshotDeletionResult = await DailyMetricSnapshotModel.deleteMany({ metric: { $in: metricIds } }).session(mongoSession);
        logger.info(`${TAG} ${snapshotDeletionResult.deletedCount} snapshots diários de métricas excluídos para o utilizador ${userId}.`);
    } else {
        logger.info(`${TAG} Nenhuma métrica encontrada, portanto, nenhum snapshot diário para excluir para o utilizador ${userId}.`);
    }

    // 2. Excluir inspirações da comunidade criadas pelo utilizador
    const communityDeletionResult = await CommunityInspirationModel.deleteMany({ originalCreatorId: userObjectId }).session(mongoSession);
    logger.info(`${TAG} ${communityDeletionResult.deletedCount} inspirações da comunidade (onde era originalCreatorId) excluídas para o utilizador ${userId}.`);

    // 3. Excluir todas as métricas (IMetric) do utilizador
    const metricsDeletionResult = await MetricModel.deleteMany({ user: userObjectId }).session(mongoSession);
    logger.info(`${TAG} ${metricsDeletionResult.deletedCount} registos de métricas (IMetric) excluídos para o utilizador ${userId}.`);

    // 4. Excluir insights da conta
    const accountInsightsDeletionResult = await AccountInsightModel.deleteMany({ user: userObjectId }).session(mongoSession);
    logger.info(`${TAG} ${accountInsightsDeletionResult.deletedCount} insights da conta excluídos para o utilizador ${userId}.`);

    // 5. Excluir AdDeals
    const adDealsDeletionResult = await AdDeal.deleteMany({ userId: userObjectId }).session(mongoSession);
    logger.info(`${TAG} ${adDealsDeletionResult.deletedCount} AdDeals excluídos para o utilizador ${userId}.`);

    // 6. Excluir Métricas de Stories
    const storyMetricsDeletionResult = await StoryMetricModel.deleteMany({ user: userObjectId }).session(mongoSession);
    logger.info(`${TAG} ${storyMetricsDeletionResult.deletedCount} métricas de stories excluídas para o utilizador ${userId}.`);

    // 7. Excluir o próprio utilizador
    const userDeletionResult = await User.findByIdAndDelete(userObjectId).session(mongoSession);

    await mongoSession.commitTransaction();
    logger.info(`${TAG} Transação commitada com sucesso para exclusão do utilizador ${userId}.`);

    if (!userDeletionResult) {
      // Isso pode acontecer se o utilizador já foi excluído numa tentativa anterior, mas a transação ainda processou outros dados.
      logger.warn(`${TAG} Utilizador ${userId} não encontrado para exclusão final (pode já ter sido excluído), mas dados associados foram processados.`);
    } else {
      logger.info(`${TAG} Utilizador ${userId} excluído com sucesso do banco de dados.`);
    }

    return true;

  } catch (error: any) {
    if (mongoSession) {
      logger.error(`${TAG} Erro durante a transação para o utilizador ${userId}. Abortando transação.`);
      await mongoSession.abortTransaction();
    }
    logger.error(`${TAG} Erro ao excluir conta e dados associados para o utilizador ${userId}:`, error);
    // Não relançar UserNotFoundError aqui, pois o objetivo é excluir.
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError(`Falha crítica durante a exclusão da conta para ${userId}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (mongoSession) {
      mongoSession.endSession();
      logger.info(`${TAG} Sessão do MongoDB finalizada para o utilizador ${userId}.`);
    }
  }
}
