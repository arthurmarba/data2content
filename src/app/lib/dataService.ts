/**
 * @fileoverview Serviço de acesso a dados (Utilizadores, Métricas, Relatórios, Publicidades, Comunidade).
 * ATUALIZADO v2.14.1 (Conexão MongoDB Robusta):
 * - Implementada função connectToDatabase mais robusta para ambientes serverless,
 * com melhor gerenciamento de estado da conexão e logging detalhado.
 * ATUALIZADO v2.14.0 (Memória de Longo Prazo):
 * - Adicionadas funções para gerenciar memória de longo prazo do usuário.
 * ATUALIZADO v2.13.0 (Exclusão de Conta):
 * - Adicionada função deleteUserAccountAndAssociatedData.
 * @version 2.14.1
 */

import mongoose, { Model, Types, ConnectionStates } from 'mongoose'; // Adicionado ConnectionStates
import { subDays, differenceInDays, startOfDay } from 'date-fns';
import { logger } from '@/app/lib/logger';

// Modelos do Mongoose
import User, { 
    IUser, 
    UserExpertiseLevel, 
    IUserPreferences, 
    IUserLongTermGoal, 
    IUserKeyFact 
} from '@/app/models/User'; 
import MetricModel, { IMetric } from '@/app/models/Metric';
import AdDeal, { IAdDeal } from '@/app/models/AdDeal'; 
import AccountInsightModel, { IAccountInsight } from '@/app/models/AccountInsight';
import CommunityInspirationModel, { ICommunityInspiration } from '@/app/models/CommunityInspiration';
import DailyMetricSnapshotModel from '@/app/models/DailyMetricSnapshot';
import StoryMetricModel from '@/app/models/StoryMetric';


// Funções e tipos de reportHelpers
import {
    buildAggregatedReport,
    AggregatedReport,
    DurationStat,
    OverallStats,
    DetailedContentStat,
    ProposalStat,
    ContextStat,
    PerformanceByDayPCO,
    ReportAggregationError,
    DetailedStatsError
} from '@/app/lib/reportHelpers';

// Erros customizados
import {
    UserNotFoundError,
    MetricsNotFoundError,
    DatabaseError,
    OperationNotPermittedError
} from '@/app/lib/errors';

// --- INÍCIO: Lógica de Conexão MongoDB Robusta ---
let connectionPromise: Promise<typeof mongoose> | null = null;
let connectionTimeout: NodeJS.Timeout | null = null;

const MONGODB_CONNECTION_TIMEOUT_MS = 10000; // 10 segundos para timeout da conexão

const connectToDatabase = async (): Promise<typeof mongoose> => {
    const TAG = '[dataService][connectToDatabase v2.14.1]';
    const currentReadyState = mongoose.connection.readyState;

    // Log do estado atual antes de qualquer ação
    logger.info(`${TAG} Solicitada conexão. Estado atual do Mongoose: ${ConnectionStates[currentReadyState]} (${currentReadyState})`);

    if (connectionPromise && (currentReadyState === ConnectionStates.connected || currentReadyState === ConnectionStates.connecting)) {
        logger.info(`${TAG} Reutilizando promessa de conexão existente ou conexão já ativa/em progresso. DB: ${mongoose.connection.name || 'N/A (ainda)'}`);
        return connectionPromise;
    }
    
    // Limpa timeout anterior se houver
    if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
    }

    if (!process.env.MONGODB_URI) {
        logger.error(`${TAG} MONGODB_URI não está definida no ambiente.`);
        throw new Error('MONGODB_URI não está definida.');
    }

    const uriParts = process.env.MONGODB_URI.split('@');
    const uriDisplay = uriParts.length > 1 ? `mongodb+srv://****@${uriParts[1]}` : process.env.MONGODB_URI.substring(0,30) + "...";
    logger.info(`${TAG} MONGODB_URI (segura): ${uriDisplay}`);
    logger.info(`${TAG} Criando NOVA conexão com MongoDB (ou nova promessa de conexão).`);

    // Configura ouvintes de eventos UMA VEZ por tentativa de conexão para evitar duplicatas
    // Removendo ouvintes antigos para garantir que apenas os atuais estejam ativos
    mongoose.connection.removeAllListeners('connected');
    mongoose.connection.removeAllListeners('error');
    mongoose.connection.removeAllListeners('disconnected');
    mongoose.connection.removeAllListeners('reconnected');
    mongoose.connection.removeAllListeners('close');
    mongoose.connection.removeAllListeners('fullsetup');

    mongoose.connection.on('connected', () => {
        logger.info(`${TAG} Evento 'connected': Conectado ao MongoDB. DB: ${mongoose.connection.name}, Host: ${mongoose.connection.host}`);
        if (connectionTimeout) clearTimeout(connectionTimeout);
    });
    mongoose.connection.on('error', (err) => {
        logger.error(`${TAG} Evento 'error': Erro na conexão MongoDB:`, err);
        if (connectionTimeout) clearTimeout(connectionTimeout);
        connectionPromise = null; 
    });
    mongoose.connection.on('disconnected', () => {
        logger.warn(`${TAG} Evento 'disconnected': Desconectado do MongoDB.`);
        if (connectionTimeout) clearTimeout(connectionTimeout);
        connectionPromise = null;
    });
    mongoose.connection.on('reconnected', () => {
        logger.info(`${TAG} Evento 'reconnected': Reconectado ao MongoDB.`);
        if (connectionTimeout) clearTimeout(connectionTimeout);
    });
     mongoose.connection.on('close', () => {
        logger.info(`${TAG} Evento 'close': Conexão MongoDB fechada.`);
        if (connectionTimeout) clearTimeout(connectionTimeout);
        connectionPromise = null;
    });
    mongoose.connection.on('fullsetup', () => {
        logger.info(`${TAG} Evento 'fullsetup': ReplSet fullsetup concluído.`);
    });


    connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: MONGODB_CONNECTION_TIMEOUT_MS, // Timeout para seleção do servidor
        socketTimeoutMS: 45000, // Tempo de inatividade do socket
        // bufferCommands: false, // Desabilitar buffer pode ajudar a identificar problemas de conexão mais cedo
    }).then(mongooseInstance => {
        logger.info(`${TAG} Conexão MongoDB estabelecida com sucesso (dentro do .then). DB: ${mongooseInstance.connection.name}`);
        if (connectionTimeout) clearTimeout(connectionTimeout);
        return mongooseInstance;
    }).catch(error => {
        logger.error(`${TAG} Falha CRÍTICA ao conectar ao MongoDB (dentro do .catch da promessa):`, error);
        if (connectionTimeout) clearTimeout(connectionTimeout);
        connectionPromise = null; 
        throw error; 
    });
    
    // Configura um timeout para a operação de conexão
    connectionTimeout = setTimeout(() => {
        logger.error(`${TAG} Timeout de ${MONGODB_CONNECTION_TIMEOUT_MS}ms atingido para conexão com MongoDB.`);
        connectionPromise = null; // Limpa a promessa para permitir nova tentativa
        // Não lança erro aqui para permitir que a aplicação tente se recuperar ou lidar com isso
        // Mas a promessa original (connectionPromise) irá rejeitar se o mongoose.connect falhar por timeout
    }, MONGODB_CONNECTION_TIMEOUT_MS);

    return connectionPromise;
};
// --- FIM: Lógica de Conexão MongoDB Robusta ---


/* ------------------------------------------------------------------ *
 * Constantes internas                                                *
 * ------------------------------------------------------------------ */
const DEFAULT_METRICS_FETCH_DAYS = 180;
const NEW_USER_THRESHOLD_DAYS = 90;

/* ------------------------------------------------------------------ *
 * Tipos públicos exportados                                          *
 * ------------------------------------------------------------------ */

export interface IEnrichedReport {
    overallStats?: OverallStats;
    profileSegment: string;
    multimediaSuggestion: string;
    top3Posts?: Pick<IMetric, '_id' | 'description' | 'postLink' | 'stats'>[];
    bottom3Posts?: Pick<IMetric, '_id' | 'description' | 'postLink' | 'stats'>[];
    durationStats?: DurationStat[];
    detailedContentStats?: DetailedContentStat[];
    proposalStats?: ProposalStat[];
    contextStats?: ContextStat[];
    historicalComparisons?: IGrowthComparisons;
    longTermComparisons?: IGrowthComparisons;
    performanceByDayPCO?: PerformanceByDayPCO;
}
interface PreparedData {
    enrichedReport: IEnrichedReport;
}
export type ReferenceSearchResult =
    | { status: 'found'; post: { _id: Types.ObjectId; description: string; proposal?: string; context?: string } }
    | { status: 'clarify'; message: string }
    | { status: 'error'; message: string };
interface IGrowthComparisons {
    weeklyFollowerChange?: number;
    monthlyReachTrend?: 'up' | 'down' | 'stable';
}
interface IGrowthDataResult {
    historical?: IGrowthComparisons;
    longTerm?: IGrowthComparisons;
}
export interface AdDealInsights {
    period: 'last30d' | 'last90d' | 'all';
    totalDeals: number;
    totalRevenueBRL: number;
    averageDealValueBRL?: number;
    commonBrandSegments: string[];
    avgValueByCompensation?: { [key: string]: number };
    commonDeliverables: string[];
    commonPlatforms: string[];
    dealsFrequency?: number;
}

export interface CommunityInspirationFilters {
  proposal?: string;
  context?: string;
  format?: string;
  primaryObjectiveAchieved_Qualitative?: string;
  performanceHighlights_Qualitative_CONTAINS?: string;
  tags_IA?: string[];
  limit?: number;
}

/* ------------------------------------------------------------------ *
 * Funções auxiliares                                                 *
 * ------------------------------------------------------------------ */
function getUserProfileSegment(user: IUser): string {
    const TAG = '[dataService][getUserProfileSegment v2.14.1]';
    if (user.createdAt instanceof Date && !isNaN(+user.createdAt)) {
        const ageInDays = differenceInDays(new Date(), user.createdAt);
        return ageInDays < NEW_USER_THRESHOLD_DAYS ? 'Novo Usuário' : 'Usuário Veterano';
    }
    logger.warn(`${TAG} Data de criação inválida para usuário ${user._id}`);
    return 'Geral';
}
function getMultimediaSuggestion(report?: AggregatedReport | null): string {
    const TAG = '[dataService][getMultimediaSuggestion v2.14.1]';
    const bestDurationStat = report?.durationStats?.sort((a, b) => (b.avgRetentionRate ?? 0) - (a.avgRetentionRate ?? 0))[0];
    if (!bestDurationStat) {
        return '';
    }
    if (bestDurationStat.range.includes('60s')) {
        return 'Vídeos acima de 60 segundos têm mostrado boa retenção média para você. Vale a pena experimentar formatos um pouco mais longos!';
    }
    const retentionPercent = ((bestDurationStat.avgRetentionRate ?? 0) * 100).toFixed(0);
    return `Vídeos na faixa de ${bestDurationStat.range} tiveram um ótimo desempenho recente (${retentionPercent}% retenção média). Teste produzir mais conteúdos nessa duração!`;
}
async function getCombinedGrowthData(userId: Types.ObjectId): Promise<IGrowthDataResult> {
    const TAG = '[dataService][getCombinedGrowthData v2.14.1]';
    logger.debug(`${TAG} Placeholder para usuário ${userId}`);
    return { historical: {}, longTerm: {} };
}

/* ------------------------------------------------------------------ *
 * Funções públicas Exportadas (existentes e novas)                   *
 * ------------------------------------------------------------------ */

export async function lookupUser(fromPhone: string): Promise<IUser> {
    const maskedPhone = fromPhone.slice(0, -4) + '****';
    const fnTag = '[dataService][lookupUser v2.14.1]'; 
    logger.debug(`${fnTag} Buscando usuário para telefone ${maskedPhone}`);
    try {
        await connectToDatabase(); 
        const user = await User.findOne({ whatsappPhone: fromPhone }).lean();
        if (!user) {
            logger.warn(`${fnTag} Usuário não encontrado para telefone ${maskedPhone}`);
            throw new UserNotFoundError(`Usuário não encontrado (${maskedPhone})`);
        }
        logger.info(`${fnTag} Usuário ${user._id} encontrado para telefone ${maskedPhone}`);
        return user as IUser;
    } catch (error: any) {
        if (error instanceof UserNotFoundError) throw error;
        logger.error(`${fnTag} Erro de banco de dados ao buscar usuário ${maskedPhone}:`, error);
        throw new DatabaseError(`Erro ao buscar usuário: ${error.message}`);
    }
}

export async function lookupUserById(userId: string): Promise<IUser> {
    const fnTag = '[dataService][lookupUserById v2.14.1]'; 
    logger.debug(`${fnTag} Buscando usuário por ID ${userId}`);
    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${fnTag} ID de usuário inválido fornecido: ${userId}`);
        throw new DatabaseError(`ID de usuário inválido: ${userId}`);
    }
    try {
        await connectToDatabase(); 
        const user = await User.findById(userId).lean();
        if (!user) {
            logger.warn(`${fnTag} Usuário não encontrado para ID ${userId}`);
            throw new UserNotFoundError(`Usuário não encontrado para ID: ${userId}`);
        }
        logger.info(`${fnTag} Usuário ${userId} encontrado.`);
        return user as IUser;
    } catch (error: any) {
        if (error instanceof UserNotFoundError) throw error;
        logger.error(`${fnTag} Erro de banco de dados ao buscar usuário ${userId}:`, error);
        throw new DatabaseError(`Erro ao buscar usuário por ID: ${error.message}`);
    }
}

export async function updateUserExpertiseLevel(
  userId: string,
  newLevel: UserExpertiseLevel
): Promise<IUser | null> {
  const TAG = '[dataService][updateUserExpertiseLevel v2.14.1]'; 
  if (!mongoose.isValidObjectId(userId)) {
    logger.error(`${TAG} ID de usuário inválido: ${userId}`);
    throw new DatabaseError(`ID de usuário inválido: ${userId}`);
  }
  logger.info(`${TAG} Tentando atualizar inferredExpertiseLevel para '${newLevel}' para User ${userId}.`);
  try {
    await connectToDatabase();
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { inferredExpertiseLevel: newLevel } },
      { new: true, runValidators: true } 
    ).lean();

    if (!updatedUser) {
      logger.warn(`${TAG} Usuário ${userId} não encontrado para atualizar nível de expertise.`);
      return null;
    }
    logger.info(`${TAG} Nível de expertise atualizado com sucesso para User ${userId}. Novo nível: ${updatedUser.inferredExpertiseLevel}`);
    return updatedUser as IUser;
  } catch (error: any) {
    logger.error(`${TAG} Erro ao atualizar nível de expertise para User ${userId}:`, error);
    throw new DatabaseError(`Erro ao atualizar nível de expertise: ${error.message}`);
  }
}

// --- NOVAS FUNÇÕES PARA MEMÓRIA DE LONGO PRAZO (v2.14.0) ---
// (As funções updateUserPreferences, addUserLongTermGoal, addUserKeyFact permanecem como na v2.14.0)
// Para brevidade, elas não são repetidas aqui, mas estão incluídas no arquivo.
export async function updateUserPreferences(
  userId: string,
  preferences: Partial<IUserPreferences>
): Promise<IUser | null> {
  const TAG = '[dataService][updateUserPreferences v2.14.1]';
  if (!mongoose.isValidObjectId(userId)) {
    logger.error(`${TAG} ID de usuário inválido: ${userId}`);
    throw new DatabaseError(`ID de usuário inválido: ${userId}`);
  }
  logger.info(`${TAG} Atualizando userPreferences para User ${userId}: ${JSON.stringify(preferences)}`);
  try {
    await connectToDatabase();
    
    const updatePayload: Record<string, any> = {};
    if (preferences.preferredFormats !== undefined) updatePayload['userPreferences.preferredFormats'] = preferences.preferredFormats;
    if (preferences.dislikedTopics !== undefined) updatePayload['userPreferences.dislikedTopics'] = preferences.dislikedTopics;
    if (preferences.preferredAiTone !== undefined) updatePayload['userPreferences.preferredAiTone'] = preferences.preferredAiTone;

    if (Object.keys(updatePayload).length === 0) {
        logger.warn(`${TAG} Nenhum dado de preferência fornecido para atualização para User ${userId}. Retornando usuário sem alteração.`);
        return lookupUserById(userId); 
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updatePayload },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedUser) {
      logger.warn(`${TAG} Usuário ${userId} não encontrado para atualizar preferências.`);
      return null;
    }
    logger.info(`${TAG} userPreferences atualizadas para User ${userId}.`);
    return updatedUser as IUser;
  } catch (error: any) {
    logger.error(`${TAG} Erro ao atualizar userPreferences para User ${userId}:`, error);
    throw new DatabaseError(`Erro ao atualizar preferências do usuário: ${error.message}`);
  }
}

export async function addUserLongTermGoal(
  userId: string,
  goalDescription: string,
  status: IUserLongTermGoal['status'] = 'ativo'
): Promise<IUser | null> {
  const TAG = '[dataService][addUserLongTermGoal v2.14.1]';
  if (!mongoose.isValidObjectId(userId)) { 
    logger.error(`${TAG} ID de usuário inválido: ${userId}`);
    throw new DatabaseError(`ID de usuário inválido: ${userId}`);
  }
  if (!goalDescription || goalDescription.trim() === '') {
    logger.error(`${TAG} Descrição do objetivo não pode ser vazia para User ${userId}.`);
    throw new DatabaseError(`Descrição do objetivo não pode ser vazia.`);
  }

  logger.info(`${TAG} Adicionando longTermGoal para User ${userId}: "${goalDescription}" com status "${status}"`);
  try {
    await connectToDatabase();
    
    const userWithExistingGoal = await User.findOne({ _id: userId, 'userLongTermGoals.goal': goalDescription });
    if (userWithExistingGoal) {
        logger.warn(`${TAG} Objetivo "${goalDescription}" já existe para User ${userId}. Não adicionando duplicata.`);
        return userWithExistingGoal as IUser;
    }

    const newGoal: IUserLongTermGoal = { 
      goal: goalDescription.trim(), 
      status, 
      addedAt: new Date() 
    };
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { userLongTermGoals: newGoal } }, 
      { new: true, runValidators: true }
    ).lean();
    
    if (!updatedUser) { 
      logger.warn(`${TAG} Usuário ${userId} não encontrado para adicionar longTermGoal.`);
      return null; 
    }
    logger.info(`${TAG} longTermGoal adicionado para User ${userId}.`);
    return updatedUser as IUser;
  } catch (error: any) { 
    logger.error(`${TAG} Erro ao adicionar longTermGoal para User ${userId}:`, error);
    throw new DatabaseError(`Erro ao adicionar objetivo de longo prazo: ${error.message}`); 
  }
}

export async function addUserKeyFact(
  userId: string,
  factDescription: string
): Promise<IUser | null> {
  const TAG = '[dataService][addUserKeyFact v2.14.1]';
  if (!mongoose.isValidObjectId(userId)) { 
    logger.error(`${TAG} ID de usuário inválido: ${userId}`);
    throw new DatabaseError(`ID de usuário inválido: ${userId}`); 
  }
  if (!factDescription || factDescription.trim() === '') {
    logger.error(`${TAG} Descrição do fato não pode ser vazia para User ${userId}.`);
    throw new DatabaseError(`Descrição do fato não pode ser vazia.`);
  }

  logger.info(`${TAG} Adicionando keyFact para User ${userId}: "${factDescription}"`);
  try {
    await connectToDatabase();

    const userWithExistingFact = await User.findOne({ _id: userId, 'userKeyFacts.fact': factDescription });
    if (userWithExistingFact) {
        logger.warn(`${TAG} Fato "${factDescription}" já existe para User ${userId}. Não adicionando duplicata.`);
        return userWithExistingFact as IUser;
    }

    const newFact: IUserKeyFact = { 
      fact: factDescription.trim(), 
      mentionedAt: new Date() 
    };

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { userKeyFacts: newFact } },
      { new: true, runValidators: true }
    ).lean();
    
    if (!updatedUser) { 
      logger.warn(`${TAG} Usuário ${userId} não encontrado para adicionar keyFact.`);
      return null; 
    }
    logger.info(`${TAG} keyFact adicionado para User ${userId}.`);
    return updatedUser as IUser;
  } catch (error: any) { 
    logger.error(`${TAG} Erro ao adicionar keyFact para User ${userId}:`, error);
    throw new DatabaseError(`Erro ao adicionar fato chave: ${error.message}`);
  }
}
// --- FIM DAS NOVAS FUNÇÕES PARA MEMÓRIA DE LONGO PRAZO ---


export async function fetchAndPrepareReportData(
    { user, contentMetricModel, analysisSinceDate }: { user: IUser; contentMetricModel: Model<IMetric>; analysisSinceDate?: Date; }
): Promise<PreparedData> {
    const userId = user._id instanceof Types.ObjectId ? user._id : new Types.ObjectId(user._id);
    const TAG = '[dataService][fetchAndPrepareReportData v2.14.1]'; 
    const sinceDate = analysisSinceDate || subDays(new Date(), DEFAULT_METRICS_FETCH_DAYS);
    logger.info(`${TAG} Iniciando para usuário ${userId}. Período de busca: desde ${sinceDate.toISOString()}`);
    let growthData: IGrowthDataResult;
    try {
        await connectToDatabase(); 
        growthData = await getCombinedGrowthData(userId);
        logger.debug(`${TAG} Dados de crescimento (placeholder) obtidos.`);
    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar dados de crescimento para ${userId}:`, error);
        growthData = { historical: {}, longTerm: {} };
    }
    let aggregatedReport: AggregatedReport;
    try {
        await connectToDatabase(); 
        logger.debug(`${TAG} Gerando relatório agregado (v4.x) para ${userId} desde ${sinceDate.toISOString()}...`);
        aggregatedReport = await buildAggregatedReport(userId,sinceDate,contentMetricModel);
        logger.info(`${TAG} Relatório agregado gerado com sucesso para ${userId}. Posts no relatório: ${aggregatedReport?.overallStats?.totalPosts ?? 'N/A'}`);
        if (!aggregatedReport || !aggregatedReport.overallStats || aggregatedReport.overallStats.totalPosts === 0) {
             const daysAnalyzed = differenceInDays(new Date(), sinceDate);
             logger.warn(`${TAG} Nenhum dado encontrado nos últimos ${daysAnalyzed} dias para gerar relatório para ${userId}. overallStats: ${JSON.stringify(aggregatedReport?.overallStats)}`);
             throw new MetricsNotFoundError(
                 `Você ainda não tem métricas suficientes nos últimos ${daysAnalyzed} dias para gerar este relatório.`
             );
        }
    } catch (error: any) {
        logger.error(`${TAG} Erro ao gerar relatório agregado para ${userId} desde ${sinceDate.toISOString()}:`, error);
        if (error instanceof MetricsNotFoundError || error instanceof ReportAggregationError || error instanceof DetailedStatsError) throw error;
        throw new ReportAggregationError(`Falha ao processar suas métricas para gerar o relatório: ${error.message}`);
    }
    logger.debug(`${TAG} Montando relatório enriquecido final para ${userId}`);
    const enrichedReport: IEnrichedReport = {
        overallStats: aggregatedReport.overallStats,
        profileSegment: getUserProfileSegment(user),
        multimediaSuggestion: getMultimediaSuggestion(aggregatedReport),
        top3Posts: aggregatedReport.top3Posts,
        bottom3Posts: aggregatedReport.bottom3Posts,
        durationStats: aggregatedReport.durationStats,
        detailedContentStats: aggregatedReport.detailedContentStats,
        proposalStats: aggregatedReport.proposalStats,
        contextStats: aggregatedReport.contextStats,
        historicalComparisons: growthData.historical,
        longTermComparisons: growthData.longTerm,
        performanceByDayPCO: aggregatedReport.performanceByDayPCO
    };
    return { enrichedReport };
}

export async function extractReferenceAndFindPost( text: string, userId: Types.ObjectId ): Promise<ReferenceSearchResult> {
    const fnTag = '[dataService][extractReferenceAndFindPost v2.14.1]';
    logger.debug(`${fnTag} Buscando referência "${text}" para usuário ${userId}`);
    const quotedText = text.match(/["“”'](.+?)["“”']/)?.[1];
    const aboutText = text.match(/(?:sobre|referente a)\s+(.+)/i)?.[1]?.trim();
    const reference = quotedText || aboutText || text.trim();
    if (!reference) {
        logger.warn(`${fnTag} Referência vazia ou inválida: "${text}"`);
        return { status: 'clarify', message: 'Hum, não consegui entender a referência do post. 🤔 Poderia me dizer uma parte única da descrição ou o link dele?' };
    }
    logger.debug(`${fnTag} Referência extraída: "${reference}"`);
    try {
        await connectToDatabase(); 
        const escapedReference = reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedReference, 'i');
        const posts = await MetricModel.find({ user: userId, description: regex }).select('_id description proposal context').limit(5).lean();
        if (!posts.length) {
            logger.info(`${fnTag} Nenhum post encontrado para referência "${reference}" e usuário ${userId}`);
            return { status: 'clarify', message: `Não achei nenhum post com a descrição parecida com "${reference}". Pode tentar descrever de outra forma ou me mandar o link?` };
        }
        if (posts.length === 1) {
            const post = posts[0]!;
            logger.info(`${fnTag} Post único encontrado para referência "${reference}" (ID: ${post._id})`);
            return { status: 'found', post: { _id: post._id, description: post.description || '', proposal: post.proposal, context: post.context } };
        }
        logger.info(`${fnTag} ${posts.length} posts encontrados para referência "${reference}", pedindo clarificação.`);
        const postList = posts.map((p, i) => `${i + 1}. "${(p.description || 'Sem descrição').slice(0, 60)}…"`) .join('\n');
        return { status: 'clarify', message: `Encontrei ${posts.length} posts com descrição parecida:\n${postList}\n\nQual deles você quer analisar? (Digite o número)` };
    } catch (error: any) {
        logger.error(`${fnTag} Erro ao buscar post por referência "${reference}" para usuário ${userId}:`, error);
        return { status: 'error', message: `Ocorreu um erro ao buscar o post. Tente novamente mais tarde. (Detalhe: ${error.message})` };
    }
}

export async function getLatestAggregatedReport(userId: string): Promise<AggregatedReport | null> {
    const TAG = '[dataService][getLatestAggregatedReport v2.14.1]';
    logger.debug(`${TAG} Buscando último relatório agregado para usuário ${userId}`);
     if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de usuário inválido fornecido: ${userId}`);
        throw new DatabaseError(`ID de usuário inválido: ${userId}`);
    }
    try {
        await connectToDatabase(); 
        const reportDocument: AggregatedReport | null = null; 
        if (reportDocument) {
            logger.info(`${TAG} Último relatório encontrado para ${userId}.`);
            return reportDocument;
        } else {
            logger.info(`${TAG} Nenhum relatório agregado encontrado para ${userId}.`);
            return null;
        }
    } catch (error: any) {
        logger.error(`${TAG} Erro de banco de dados ao buscar último relatório para ${userId}:`, error);
        throw new DatabaseError(`Erro ao buscar último relatório: ${error.message}`);
    }
}

export async function getLatestAccountInsights(userId: string): Promise<IAccountInsight | null> {
    const TAG = '[dataService][getLatestAccountInsights v2.14.1]';
    logger.debug(`${TAG} Buscando últimos insights da conta para usuário ${userId}`);
    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de usuário inválido fornecido: ${userId}`);
        return null; 
    }
    try {
        await connectToDatabase(); 
        const latestInsight = await AccountInsightModel.findOne({
            user: new Types.ObjectId(userId)
        })
        .sort({ recordedAt: -1 })
        .lean();
        if (!latestInsight) {
            logger.info(`${TAG} Nenhum AccountInsight encontrado para o usuário ${userId}.`);
            return null;
        }
        logger.info(`${TAG} Último AccountInsight encontrado para ${userId}, registrado em: ${latestInsight.recordedAt}.`);
        return latestInsight as IAccountInsight;
    } catch (error: any) {
        logger.error(`${TAG} Erro de banco de dados ao buscar AccountInsight para ${userId}:`, error);
        throw new DatabaseError(`Erro ao buscar insights da conta: ${error.message}`);
    }
}

export async function getAdDealInsights( userId: string, period: 'last30d' | 'last90d' | 'all' = 'last90d' ): Promise<AdDealInsights | null> {
    const TAG = '[dataService][getAdDealInsights v2.14.1]';
    logger.debug(`${TAG} Calculando insights de AdDeals para User ${userId}, período: ${period}`);
    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de usuário inválido: ${userId}`);
        throw new DatabaseError(`ID de usuário inválido: ${userId}`);
    }
    const userIdObj = new Types.ObjectId(userId);
    let dateFilter: any = {};
    const now = new Date();
    if (period === 'last30d') { dateFilter = { $gte: subDays(now, 30) }; }
    else if (period === 'last90d') { dateFilter = { $gte: subDays(now, 90) }; }
    try {
        await connectToDatabase(); 
        const baseQuery: any = { userId: userIdObj }; 
        if (Object.keys(dateFilter).length > 0) {
            baseQuery.dealDate = dateFilter;
        }
        const totalDeals = await AdDeal.countDocuments(baseQuery);
        logger.debug(`${TAG} Total de deals no período '${period}': ${totalDeals}`);
        if (totalDeals === 0) {
            logger.info(`${TAG} Nenhum AdDeal encontrado para User ${userId} no período ${period}.`);
            return null;
        }
        const [revenueStats, segmentStats, compensationStats, deliverableStats, platformStats, frequencyStats] = await Promise.all([
            AdDeal.aggregate([ { $match: { ...baseQuery, compensationType: { $in: ['Valor Fixo', 'Misto'] }, compensationCurrency: 'BRL' } }, { $group: { _id: null, totalRevenueBRL: { $sum: '$compensationValue' }, countPaid: { $sum: 1 } } } ]),
            AdDeal.aggregate([ { $match: { ...baseQuery, brandSegment: { $nin: [null, ""] } } }, { $group: { _id: '$brandSegment', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 3 } ]),
            AdDeal.aggregate([ { $match: { ...baseQuery, compensationValue: { $ne: null }, compensationCurrency: 'BRL' } }, { $group: { _id: '$compensationType', avgValueBRL: { $avg: '$compensationValue' }, count: { $sum: 1 } } } ]),
            AdDeal.aggregate([ { $match: { ...baseQuery, deliverables: { $ne: null, $exists: true } } }, { $unwind: '$deliverables' }, { $match: { deliverables: { $nin: [null, ""] } } }, { $group: { _id: '$deliverables', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 } ]),
            AdDeal.aggregate([ { $match: { ...baseQuery, platform: { $nin: [null, ""] } } }, { $group: { _id: '$platform', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 3 } ]),
            AdDeal.aggregate([ { $match: baseQuery }, { $group: { _id: null, firstDealDate: { $min: "$dealDate" }, lastDealDate: { $max: "$dealDate" }, totalDeals: { $sum: 1 } } }, { $project: { _id: 0, totalDeals: 1, periodInDays: { $max: [ { $divide: [ { $subtract: ["$lastDealDate", "$firstDealDate"] }, 1000 * 60 * 60 * 24 ] }, 1 ] } } } ])
       ]);
       const revenueResult = revenueStats[0] || { totalRevenueBRL: 0, countPaid: 0 };
       const avgDealValueBRL = revenueResult.countPaid > 0 ? revenueResult.totalRevenueBRL / revenueResult.countPaid : undefined;
       const commonBrandSegments = segmentStats.map(s => s._id).filter(s => s);
       const avgValueByCompensation = compensationStats.reduce((acc, curr) => { if (curr._id) { acc[curr._id] = curr.avgValueBRL; } return acc; }, {} as { [key: string]: number });
       const commonDeliverables = deliverableStats.map(d => d._id).filter(d => d);
       const commonPlatforms = platformStats.map(p => p._id).filter(p => p);
       let dealsFrequency: number | undefined = undefined;
       if (frequencyStats.length > 0 && frequencyStats[0].periodInDays >= 1 && frequencyStats[0].totalDeals > 1) {
           const days = frequencyStats[0].periodInDays;
           const deals = frequencyStats[0].totalDeals;
           dealsFrequency = (deals / days) * 30.44;
       }
       const insights: AdDealInsights = {
           period, totalDeals, totalRevenueBRL: revenueResult.totalRevenueBRL ?? 0,
           averageDealValueBRL: avgDealValueBRL, commonBrandSegments, avgValueByCompensation,
           commonDeliverables, commonPlatforms, dealsFrequency
       };
       logger.info(`${TAG} Insights de AdDeals calculados com sucesso para User ${userId}.`);
       return insights;
    } catch (error: any) {
        logger.error(`${TAG} Erro ao calcular insights de AdDeals para User ${userId}:`, error);
        throw new DatabaseError(`Erro ao calcular insights de publicidade: ${error.message}`);
    }
}

export async function optInUserToCommunity(
    userId: string,
    termsVersion: string
): Promise<IUser> {
    const TAG = '[dataService][optInUserToCommunity v2.14.1]';
    logger.info(`${TAG} Registrando opt-in para User ${userId}. Termos: ${termsVersion}`);

    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de usuário inválido: ${userId}`);
        throw new DatabaseError(`ID de usuário inválido: ${userId}`);
    }
    try {
        await connectToDatabase(); 
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    communityInspirationOptIn: true,
                    communityInspirationOptInDate: new Date(),
                    communityInspirationTermsVersion: termsVersion,
                },
            },
            { new: true, runValidators: true }
        ).lean();

        if (!updatedUser) {
            logger.warn(`${TAG} Usuário ${userId} não encontrado para opt-in.`);
            throw new UserNotFoundError(`Usuário ${userId} não encontrado.`);
        }
        logger.info(`${TAG} Opt-in para comunidade registrado com sucesso para User ${userId}.`);
        return updatedUser as IUser;
    } catch (error: any) {
        logger.error(`${TAG} Erro ao registrar opt-in para User ${userId}:`, error);
        if (error instanceof UserNotFoundError) throw error;
        throw new DatabaseError(`Erro ao registrar opt-in na comunidade: ${error.message}`);
    }
}

export async function optOutUserFromCommunity(userId: string): Promise<IUser> {
    const TAG = '[dataService][optOutUserFromCommunity v2.14.1]';
    logger.info(`${TAG} Registrando opt-out para User ${userId}.`);

    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de usuário inválido: ${userId}`);
        throw new DatabaseError(`ID de usuário inválido: ${userId}`);
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
            logger.warn(`${TAG} Usuário ${userId} não encontrado para opt-out.`);
            throw new UserNotFoundError(`Usuário ${userId} não encontrado.`);
        }
        logger.info(`${TAG} Opt-out da comunidade registrado com sucesso para User ${userId}.`);
        return updatedUser as IUser;
    } catch (error: any) {
        logger.error(`${TAG} Erro ao registrar opt-out para User ${userId}:`, error);
        if (error instanceof UserNotFoundError) throw error;
        throw new DatabaseError(`Erro ao registrar opt-out da comunidade: ${error.message}`);
    }
}

export async function addInspiration(
    inspirationData: Partial<ICommunityInspiration>
): Promise<ICommunityInspiration> {
    const TAG = '[dataService][addInspiration v2.14.1]';
    logger.info(`${TAG} Adicionando nova inspiração. PostId Instagram: ${inspirationData.postId_Instagram}`);

    try {
        await connectToDatabase(); 
        const existingInspiration = await CommunityInspirationModel.findOne({
            postId_Instagram: inspirationData.postId_Instagram
        });

        if (existingInspiration) {
            logger.warn(`${TAG} Inspiração com postId_Instagram ${inspirationData.postId_Instagram} já existe (ID: ${existingInspiration._id}). Atualizando...`);
            const { addedToCommunityAt, ...updateFields } = inspirationData;
            const updatedInspiration = await CommunityInspirationModel.findByIdAndUpdate(
                existingInspiration._id,
                { $set: updateFields },
                { new: true, runValidators: true }
            ).lean();
            if (!updatedInspiration) {
                 throw new DatabaseError(`Falha ao ATUALIZAR inspiração existente com postId_Instagram ${inspirationData.postId_Instagram}`);
            }
            logger.info(`${TAG} Inspiração existente ${updatedInspiration._id} atualizada.`);
            return updatedInspiration as ICommunityInspiration;
        }

        const newInspiration = await CommunityInspirationModel.create(inspirationData);
        logger.info(`${TAG} Nova inspiração ID: ${newInspiration._id} (PostId Instagram: ${newInspiration.postId_Instagram}) criada com sucesso.`);
        return newInspiration as ICommunityInspiration;
    } catch (error: any) {
        logger.error(`${TAG} Erro ao adicionar inspiração para PostId Instagram ${inspirationData.postId_Instagram}:`, error);
        throw new DatabaseError(`Erro ao adicionar inspiração: ${error.message}`);
    }
}

export async function getInspirations(
    filters: CommunityInspirationFilters,
    limit: number = 3,
    excludeIds?: string[]
): Promise<ICommunityInspiration[]> {
    const TAG = '[dataService][getInspirations v2.14.1]';
    logger.info(`${TAG} Buscando inspirações com filtros: ${JSON.stringify(filters)}, limite: ${limit}, excluir: ${excludeIds?.join(',')}`);
    const query: any = { status: 'active' };
    if (filters.proposal) query.proposal = filters.proposal;
    if (filters.context) query.context = filters.context;
    if (filters.format) query.format = filters.format;
    if (filters.primaryObjectiveAchieved_Qualitative) query.primaryObjectiveAchieved_Qualitative = filters.primaryObjectiveAchieved_Qualitative;
    if (filters.performanceHighlights_Qualitative_CONTAINS) query.performanceHighlights_Qualitative = { $regex: filters.performanceHighlights_Qualitative_CONTAINS, $options: "i" }; // Usar regex para 'contains'
    if (filters.tags_IA && filters.tags_IA.length > 0) query.tags_IA = { $in: filters.tags_IA };
    if (excludeIds && excludeIds.length > 0) {
        const validObjectIds = excludeIds.filter(id => mongoose.isValidObjectId(id)).map(id => new Types.ObjectId(id));
        if (validObjectIds.length > 0) {
            query._id = { $nin: validObjectIds };
        }
    }
    try {
        await connectToDatabase(); 
        const inspirations = await CommunityInspirationModel.find(query)
            .sort({ addedToCommunityAt: -1 }) 
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

export async function recordDailyInspirationShown(
    userId: string,
    inspirationIds: string[]
): Promise<void> {
    const TAG = '[dataService][recordDailyInspirationShown v2.14.1]';
    if (inspirationIds.length === 0) {
        logger.debug(`${TAG} Nenhuma ID de inspiração fornecida para User ${userId}. Pulando.`);
        return;
    }
    logger.info(`${TAG} Registrando inspirações ${inspirationIds.join(',')} como mostradas hoje para User ${userId}.`);
    if (!mongoose.isValidObjectId(userId)) throw new DatabaseError(`ID de usuário inválido: ${userId}`);
    const validInspirationObjectIds = inspirationIds.filter(id => mongoose.isValidObjectId(id)).map(id => new Types.ObjectId(id));
    if (validInspirationObjectIds.length === 0) {
        logger.warn(`${TAG} Nenhuma ID de inspiração válida após filtro para User ${userId}.`);
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
        logger.info(`${TAG} Registro de inspirações diárias atualizado para User ${userId}.`);
    } catch (error: any) {
        logger.error(`${TAG} Erro ao registrar inspirações diárias para User ${userId}:`, error);
        throw new DatabaseError(`Erro ao registrar inspirações diárias: ${error.message}`);
    }
}

export async function findUserPostsEligibleForCommunity(
    userId: string,
    criteria: { sinceDate: Date; minPerformanceCriteria?: any; } 
): Promise<IMetric[]> {
    const TAG = '[dataService][findUserPostsEligibleForCommunity v2.14.1]';
    logger.info(`${TAG} Buscando posts elegíveis para comunidade para User ${userId} desde ${criteria.sinceDate.toISOString()}`);
    if (!mongoose.isValidObjectId(userId)) throw new DatabaseError(`ID de usuário inválido: ${userId}`);
    const userObjectId = new Types.ObjectId(userId);
    const query: any = {
        user: userObjectId, 
        postDate: { $gte: criteria.sinceDate },
        classificationStatus: 'completed', 
        source: 'api', 
    };

    try {
        await connectToDatabase(); 
        const eligiblePosts = await MetricModel.find(query).sort({ postDate: -1 }).limit(50).lean(); 
        logger.info(`${TAG} Encontrados ${eligiblePosts.length} posts elegíveis para User ${userId}.`);
        return eligiblePosts as IMetric[];
    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar posts elegíveis para User ${userId}:`, error);
        throw new DatabaseError(`Erro ao buscar posts elegíveis: ${error.message}`);
    }
}


export async function deleteUserAccountAndAssociatedData(userId: string): Promise<boolean> {
  const TAG = '[dataService][deleteUserAccountAndAssociatedData v2.14.1]';

  if (!userId || !mongoose.isValidObjectId(userId)) {
    logger.error(`${TAG} ID de utilizador inválido fornecido para exclusão: ${userId}`);
    throw new DatabaseError(`ID de utilizador inválido para exclusão: ${userId}`);
  }

  const userObjectId = new Types.ObjectId(userId);
  let mongoSession: mongoose.ClientSession | null = null; 

  try {
    await connectToDatabase(); 
    mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();
    logger.info(`${TAG} Iniciando transação para exclusão de dados do utilizador: ${userId}`);

    const userMetrics = await MetricModel.find({ user: userObjectId }).select('_id').session(mongoSession).lean();
    const metricIds = userMetrics.map(metric => metric._id);
    if (metricIds.length > 0) {
        logger.info(`${TAG} Encontradas ${metricIds.length} métricas para o utilizador ${userId}. IDs: [${metricIds.join(', ')}]`);
        const snapshotDeletionResult = await DailyMetricSnapshotModel.deleteMany({ metric: { $in: metricIds } }).session(mongoSession);
        logger.info(`${TAG} ${snapshotDeletionResult.deletedCount} snapshots diários de métricas excluídos para o utilizador ${userId}.`);
    } else {
        logger.info(`${TAG} Nenhuma métrica encontrada, portanto, nenhum snapshot diário para excluir para o utilizador ${userId}.`);
    }

    const communityDeletionResult = await CommunityInspirationModel.deleteMany({ originalCreatorId: userObjectId }).session(mongoSession);
    logger.info(`${TAG} ${communityDeletionResult.deletedCount} inspirações da comunidade excluídas para o utilizador ${userId}.`);

    const metricsDeletionResult = await MetricModel.deleteMany({ user: userObjectId }).session(mongoSession);
    logger.info(`${TAG} ${metricsDeletionResult.deletedCount} registos de métricas (IMetric) efetivamente excluídos para o utilizador ${userId}.`);

    const accountInsightsDeletionResult = await AccountInsightModel.deleteMany({ user: userObjectId }).session(mongoSession);
    logger.info(`${TAG} ${accountInsightsDeletionResult.deletedCount} insights da conta excluídos para o utilizador ${userId}.`);

    const adDealsDeletionResult = await AdDeal.deleteMany({ userId: userObjectId }).session(mongoSession);
    logger.info(`${TAG} ${adDealsDeletionResult.deletedCount} AdDeals excluídos para o utilizador ${userId}.`);

    const storyMetricsDeletionResult = await StoryMetricModel.deleteMany({ user: userObjectId }).session(mongoSession);
    logger.info(`${TAG} ${storyMetricsDeletionResult.deletedCount} métricas de stories excluídas para o utilizador ${userId}.`);

    const userDeletionResult = await User.findByIdAndDelete(userObjectId).session(mongoSession);

    await mongoSession.commitTransaction();
    logger.info(`${TAG} Transação commitada com sucesso para exclusão do utilizador ${userId}.`);

    if (!userDeletionResult) {
      logger.warn(`${TAG} Utilizador ${userId} não encontrado para exclusão final (pode já ter sido excluído ou a transação não o encontrou no momento da exclusão), mas dados associados foram processados.`);
    } else {
      logger.info(`${TAG} Utilizador ${userId} excluído com sucesso do banco de dados.`);
    }

    return true;

  } catch (error) {
    if (mongoSession) {
      await mongoSession.abortTransaction();
      logger.error(`${TAG} Transação abortada devido a erro para o utilizador ${userId}.`);
    }
    logger.error(`${TAG} Erro ao excluir conta e dados associados para o utilizador ${userId}:`, error);
    if (error instanceof DatabaseError || error instanceof UserNotFoundError) throw error; 
    throw new DatabaseError(`Falha crítica durante a exclusão da conta para ${userId}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (mongoSession) {
      mongoSession.endSession();
      logger.info(`${TAG} Sessão do MongoDB finalizada para o utilizador ${userId}.`);
    }
  }
}
