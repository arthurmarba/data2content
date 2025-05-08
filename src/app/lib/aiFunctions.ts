// @/app/lib/aiFunctions.ts – v0.9.2 (Typed Executor Args + Error Handling)
// - ATUALIZADO: Argumentos das funções executoras agora usam z.infer<> para tipagem forte.
// - ATUALIZADO: Validações internas redundantes (cobertas por Zod) removidas.
// - Baseado na v0.9.1 (Erros Padronizados)

import { Types, Model } from 'mongoose';
import { z } from 'zod'; // <<< Importa Zod
import { logger } from '@/app/lib/logger';

// Importa os Schemas Zod definidos anteriormente (ajuste o path se necessário)
import * as ZodSchemas from './aiFunctionSchemas.zod';

import MetricModel, { IMetric, IMetricStats } from '@/app/models/Metric';
import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot';
import { IUser } from '@/app/models/User';

import { MetricsNotFoundError } from '@/app/lib/errors';

import {
  fetchAndPrepareReportData,
  getAdDealInsights,
  AdDealInsights,
  IEnrichedReport,
} from './dataService';

// Imports dos arquivos de conhecimento (mantidos)
import * as PricingKnowledge from './knowledge/pricingKnowledge';
import * as AlgorithmKnowledge from './knowledge/algorithmKnowledge';
import * as MetricsKnowledge from './knowledge/metricsKnowledge';
import * as BrandingKnowledge from './knowledge/personalBrandingKnowledge';
import * as MethodologyKnowledge from './knowledge/methodologyDeepDive';


/* ------------------------------------------------------------------ *
 * 1.  JSON-schemas expostos ao LLM (Mantido)                         *
 * ------------------------------------------------------------------ */
export const functionSchemas = [
  {
    name: 'getAggregatedReport',
    description: 'Retorna um relatório completo com métricas agregadas de posts dos últimos 180 dias (likes, reach, shares, etc.) E TAMBÉM os insights sobre parcerias publicitárias recentes do usuário. Use para análises gerais, planos, rankings, perguntas sobre performance e publicidade. **É o ponto de partida OBRIGATÓRIO para a maioria das análises.**',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'getTopPosts',
    description: 'Retorna os N posts com melhor desempenho em uma métrica específica (shares ou saved). Use APENAS se o usuário pedir explicitamente por "top posts" e após ter o relatório geral via getAggregatedReport.',
    parameters: { /* ... (mantido) ... */ }
  },
  {
    name: 'getDayPCOStats',
    description: 'Retorna dados de desempenho médio agrupados por Dia da Semana, Proposta e Contexto (usando nomes padronizados). Use APENAS se o usuário perguntar sobre melhor dia/horário para nichos específicos e após ter o relatório geral via getAggregatedReport.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'getMetricDetailsById',
    description: 'Busca e retorna os detalhes completos (incluindo métricas) de um único post específico, dado o seu ID. Use para aprofundar a análise de um post mencionado (ex: um post do top 3, ou um post encontrado por busca).',
    parameters: { /* ... (mantido) ... */ }
  },
  {
    name: 'findPostsByCriteria',
    description: 'Busca posts que correspondem a critérios específicos como formato, proposta, contexto ou data. Use para encontrar exemplos de posts sobre um tema ou de um tipo específico, APÓS ter a visão geral do relatório (getAggregatedReport), se necessário para aprofundar.',
    parameters: { /* ... (mantido) ... */ }
  },
  {
    name: 'getDailyMetricHistory',
    description: 'Busca o histórico de métricas diárias e cumulativas para um post específico (Metric ID), limitado aos primeiros 30 dias. Use para analisar crescimento, viralização e picos de engajamento, APÓS identificar um post de interesse.',
    parameters: { /* ... (mantido) ... */ }
  },
  {
    name: 'getConsultingKnowledge',
    description: 'Busca informações e explicações detalhadas sobre algoritmos do Instagram, estratégias de precificação, análise de métricas, personal branding ou a metodologia de consultoria.',
    parameters: { /* ... (mantido) ... */ }
  }
] as const;

// Tipo para os executores (args agora é mais genérico, a tipagem específica será na função)
type ExecutorFn = (args: any, user: IUser) => Promise<unknown>;

/* ---------------------------------------------------------------------- *
 * 2.  Executores das Funções (v0.9.2 - Args Tipados com z.infer)         *
 * ---------------------------------------------------------------------- */

/* 2.1 getAggregatedReport */
// Não recebe args, usa _args para indicar isso. Schema Zod vazio é usado para inferência.
const getAggregatedReport: ExecutorFn = async (_args: z.infer<typeof ZodSchemas.GetAggregatedReportArgsSchema>, loggedUser) => {
  const fnTag = '[fn:getAggregatedReport v0.9.2]'; // Atualiza tag
  try {
    logger.info(`${fnTag} Executando para usuário ${loggedUser._id}`);
    const [reportResult, adDealResult] = await Promise.allSettled([
        fetchAndPrepareReportData({ user: loggedUser, contentMetricModel: MetricModel }),
        getAdDealInsights(loggedUser._id.toString())
    ]);

    let enrichedReportData: IEnrichedReport | null = null;
    let reportError: string | null = null;
    if (reportResult.status === 'fulfilled') { enrichedReportData = reportResult.value.enrichedReport; logger.info(`${fnTag} Relatório agregado de métricas gerado com sucesso.`); }
    else { reportError = `Falha ao gerar parte do relatório (métricas): ${reportResult.reason?.message || 'Erro desconhecido'}`; logger.error(`${fnTag} Erro ao gerar relatório agregado de métricas:`, reportResult.reason); }

    let adDealInsightsData: AdDealInsights | null = null;
    let adDealError: string | null = null;
    if (adDealResult.status === 'fulfilled') { adDealInsightsData = adDealResult.value; logger.info(`${fnTag} Insights de publicidade ${adDealInsightsData ? 'encontrados' : 'não encontrados'}.`); }
    else { adDealError = `Falha ao buscar dados de publicidade: ${adDealResult.reason?.message || 'Erro desconhecido'}`; logger.error(`${fnTag} Erro ao buscar insights de publicidade:`, adDealResult.reason); }

    if (reportError && adDealError) { return { error: "Falha ao buscar dados de métricas e publicidade." }; }

    return { reportData: enrichedReportData, adDealInsights: adDealInsightsData };

  } catch (err) {
    logger.error(`${fnTag} Erro inesperado:`, err);
    return { error: "Ocorreu um erro inesperado ao tentar gerar o relatório completo. Por favor, tente novamente." };
  }
};

/* 2.2 getTopPosts */
// Usa z.infer para tipar args
const getTopPosts: ExecutorFn = async (args: z.infer<typeof ZodSchemas.GetTopPostsArgsSchema>, loggedUser) => {
  const fnTag = '[fn:getTopPosts v0.9.2]';
  try {
    const userId = new Types.ObjectId(loggedUser._id);
    // Acessa args de forma tipada (Zod já aplicou defaults)
    const metric = args.metric;
    const limit = args.limit;
    logger.info(`${fnTag} Executando para user ${userId}. Métrica: ${metric}, Limite: ${limit}`);

    // Validação de métrica redundante (Zod já fez com enum)

    const sortField = `stats.${metric}`;
    const topPosts: Pick<IMetric, '_id' | 'description' | 'postLink' | 'stats'>[] = await MetricModel.find({
        user: userId, postDate: { $exists: true }, [sortField]: { $exists: true, $ne: null }
      })
      .select(`_id description postLink stats.${metric}`) // Seleciona a métrica dinâmica
      .sort({ [sortField]: -1 })
      .limit(limit)
      .lean()
      .exec();

    if (topPosts.length === 0) {
        logger.warn(`${fnTag} Nenhum post encontrado para o ranking com a métrica ${metric}.`);
        return { message: `Nenhum post encontrado com a métrica '${metric}' para criar o ranking.`, metric, limit, posts: [] };
    }

    const formattedPosts = topPosts.map(post => {
        // Acessa o valor da métrica dinamicamente com segurança de tipo
        const metricValue = post.stats?.[metric as keyof IMetricStats] ?? 0;
        return { _id: post._id.toString(), description: post.description ?? 'Sem descrição', postLink: post.postLink, metricValue: metricValue };
    });
    logger.info(`${fnTag} Top ${formattedPosts.length} posts encontrados para métrica ${metric}.`);
    return { metric, limit, posts: formattedPosts };

  } catch (err) {
    logger.error(`${fnTag} Erro:`, err);
    return { error: "Ocorreu um erro inesperado ao buscar os top posts. Por favor, tente novamente." };
  }
};

/* 2.3 getDayPCOStats */
// Não recebe args, usa _args para indicar isso. Schema Zod vazio é usado para inferência.
const getDayPCOStats: ExecutorFn = async (_args: z.infer<typeof ZodSchemas.GetDayPCOStatsArgsSchema>, loggedUser) => {
   const fnTag = '[fn:getDayPCOStats v0.9.2]';
   try {
    logger.info(`${fnTag} Executando para usuário ${loggedUser._id}`);
    const { enrichedReport } = await fetchAndPrepareReportData({ user: loggedUser, contentMetricModel: MetricModel });
    const pcoData = enrichedReport.performanceByDayPCO;

    if (!pcoData || Object.keys(pcoData).length === 0) {
         logger.warn(`${fnTag} Dados Dia/P/C não encontrados ou vazios para ${loggedUser._id}`);
         return { message: "Não encontrei dados suficientes ou classificados por Dia/Proposta/Contexto para esta análise." };
    }

    logger.info(`${fnTag} Dados Dia/P/C obtidos.`);
    return pcoData;

  } catch (err) {
    logger.error(`${fnTag} Erro:`, err);
    if (err instanceof MetricsNotFoundError) {
        return { error: err.message };
    }
    return { error: "Ocorreu um erro inesperado ao buscar as estatísticas Dia/Proposta/Contexto. Por favor, tente novamente." };
  }
};

/* 2.4 getMetricDetailsById */
// Usa z.infer para tipar args
const getMetricDetailsById: ExecutorFn = async (args: z.infer<typeof ZodSchemas.GetMetricDetailsByIdArgsSchema>, loggedUser) => {
    const fnTag = '[fn:getMetricDetailsById v0.9.2]';
    try {
        const userId = new Types.ObjectId(loggedUser._id);
        const metricId = args.metricId; // Acessa arg tipado (string)

        // Validação específica do formato ObjectId (mantida como segurança)
        if (!Types.ObjectId.isValid(metricId)) {
            logger.warn(`${fnTag} ID da métrica inválido (formato): ${metricId}`);
            return { error: "O ID da métrica fornecido não parece ser válido." };
        }
        const objectMetricId = new Types.ObjectId(metricId);

        logger.info(`${fnTag} Buscando detalhes para Metric ID: ${metricId} para User: ${userId}`);
        const metricDoc = await MetricModel.findOne({ _id: objectMetricId, user: userId })
            .select('-rawData -__v')
            .lean()
            .exec();

        if (!metricDoc) {
            logger.warn(`${fnTag} Métrica com ID ${metricId} não encontrada para User ${userId}.`);
            return { error: "Não encontrei nenhuma métrica com este ID que pertença a você." };
        }

        logger.info(`${fnTag} Detalhes da Métrica ${metricId} encontrados.`);
        const result = { ...metricDoc, _id: metricDoc._id.toString(), user: metricDoc.user.toString() };
        return result;

    } catch (err) {
        logger.error(`${fnTag} Erro:`, err);
        return { error: "Ocorreu um erro inesperado ao buscar os detalhes desta métrica. Por favor, tente novamente." };
    }
};

/* 2.5 findPostsByCriteria */
// Usa z.infer para tipar args
const findPostsByCriteria: ExecutorFn = async (args: z.infer<typeof ZodSchemas.FindPostsByCriteriaArgsSchema>, loggedUser) => {
    const fnTag = '[fn:findPostsByCriteria v0.9.2]';
    try {
        const userId = new Types.ObjectId(loggedUser._id);
        // Acessa args tipados (Zod aplicou defaults para limit, sortBy, sortOrder e validou structure de criteria)
        const { criteria, limit, sortBy, sortOrder } = args;
        logger.info(`${fnTag} Executando busca para User ${userId} com critérios:`, criteria);

        const filter: any = { user: userId };
        // Usa criteria tipado com segurança
        if (criteria.format) filter.format = criteria.format;
        if (criteria.proposal) filter.proposal = criteria.proposal;
        if (criteria.context) filter.context = criteria.context;
        if (criteria.dateRange) {
            filter.postDate = {};
             try {
                 // Zod já validou o formato YYYY-MM-DD
                 if (criteria.dateRange.start) filter.postDate.$gte = new Date(criteria.dateRange.start);
                 if (criteria.dateRange.end) {
                      const endDate = new Date(criteria.dateRange.end);
                      endDate.setUTCHours(23, 59, 59, 999);
                      filter.postDate.$lte = endDate;
                 }
                 // Checagem lógica de datas
                 if(filter.postDate.$gte && filter.postDate.$lte && filter.postDate.$gte > filter.postDate.$lte){
                     return { error: "A data de início não pode ser posterior à data de fim." };
                 }
             } catch(dateErr){
                  logger.warn(`${fnTag} Erro inesperado ao parsear datas já validadas por Zod: ${JSON.stringify(criteria.dateRange)}`, dateErr);
                  return { error: "Ocorreu um erro ao processar o intervalo de datas." };
             }
            if (Object.keys(filter.postDate).length === 0) delete filter.postDate;
        }
        if (criteria.minLikes) filter['stats.likes'] = { $gte: criteria.minLikes };
        if (criteria.minShares) filter['stats.shares'] = { $gte: criteria.minShares };

        // Validação de critério vazio removida (Zod garante que 'criteria' existe se for required)

        // Validação de sortBy/sortOrder removida (Zod garante enum e default)
        const sortOptions: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

        logger.debug(`${fnTag} Filtro MQL:`, JSON.stringify(filter));
        logger.debug(`${fnTag} Ordenação MQL:`, sortOptions);

        const posts = await MetricModel.find(filter)
            .select('_id description postLink postDate stats.likes stats.shares stats.saved stats.reach format proposal context')
            .sort(sortOptions)
            .limit(limit)
            .lean()
            .exec();

        if (posts.length === 0) {
            logger.info(`${fnTag} Nenhum post encontrado para os critérios.`);
            return { message: "Não encontrei nenhum post que corresponda aos seus critérios de busca.", count: 0, posts: [] };
        }

        logger.info(`${fnTag} Encontrados ${posts.length} posts para os critérios.`);
        const formattedPosts = posts.map(post => ({
             _id: post._id.toString(),
             description: post.description ?? 'Sem descrição',
             postLink: post.postLink,
             postDate: post.postDate?.toISOString().split('T')[0],
             format: post.format, proposal: post.proposal, context: post.context,
             likes: post.stats?.likes ?? 0, shares: post.stats?.shares ?? 0, saved: post.stats?.saved ?? 0, reach: post.stats?.reach ?? 0,
        }));
        return { count: formattedPosts.length, posts: formattedPosts };

    } catch (err) {
        logger.error(`${fnTag} Erro:`, err);
        return { error: "Ocorreu um erro inesperado ao buscar posts com esses critérios. Por favor, tente novamente." };
    }
};

/* 2.6 getDailyMetricHistory */
// Usa z.infer para tipar args
const getDailyMetricHistory: ExecutorFn = async (args: z.infer<typeof ZodSchemas.GetDailyMetricHistoryArgsSchema>, loggedUser) => {
    const fnTag = '[fn:getDailyMetricHistory v0.9.2]';
    try {
        const userId = new Types.ObjectId(loggedUser._id);
        const metricId = args.metricId; // Acessa arg tipado

        // Validação de formato ObjectId (mantida)
        if (!Types.ObjectId.isValid(metricId)) {
            logger.warn(`${fnTag} ID da métrica inválido fornecido (formato): ${metricId}`);
            return { error: "O ID da métrica fornecido não parece ser válido." };
        }
        const objectMetricId = new Types.ObjectId(metricId);

        logger.info(`${fnTag} Buscando histórico diário para Metric ID: ${metricId} para User: ${userId}`);

        // Checagem de propriedade (mantida)
        const metricOwnerCheck = await MetricModel.findOne({ _id: objectMetricId, user: userId }).select('_id').lean();
        if (!metricOwnerCheck) {
            const metricExists = await MetricModel.findById(objectMetricId).select('_id').lean();
            if (!metricExists) { return { error: "Não encontrei nenhuma métrica com este ID." }; }
            else { return { error: "Você não tem permissão para acessar o histórico desta métrica." }; }
        }

        // Busca dos snapshots (mantida)
        const snapshots = await DailyMetricSnapshotModel.find({ metric: objectMetricId })
            .sort({ date: 1 })
            .select('date dailyViews dailyLikes dailyComments dailyShares dailySaved dailyReach dailyFollows dailyProfileVisits cumulativeViews cumulativeLikes cumulativeComments cumulativeShares cumulativeSaved cumulativeReach cumulativeFollows cumulativeProfileVisits cumulativeTotalInteractions -_id')
            .lean();

        if (snapshots.length === 0) {
            logger.info(`${fnTag} Nenhum snapshot diário encontrado para Metric ${metricId}.`);
            return { message: "Ainda não há histórico diário disponível para este post.", history: [] };
        }

        logger.info(`${fnTag} Encontrados ${snapshots.length} snapshots diários para Metric ${metricId}.`);
        const formattedHistory = snapshots.map(snap => ({ ...snap, date: snap.date.toISOString().split('T')[0] }));
        return { history: formattedHistory };

    } catch (err) {
        // Inclui metricId no log de erro para contexto
        logger.error(`${fnTag} Erro ao buscar histórico diário da métrica ${args?.metricId}:`, err);
        return { error: "Ocorreu um erro inesperado ao buscar o histórico diário deste post. Por favor, tente novamente." };
    }
};


/* 2.7 getConsultingKnowledge */
// Usa z.infer para tipar args
const getConsultingKnowledge: ExecutorFn = async (args: z.infer<typeof ZodSchemas.GetConsultingKnowledgeArgsSchema>, _loggedUser) => {
    const fnTag = '[fn:getConsultingKnowledge v0.9.2]';
    const topic = args.topic; // Acessa arg tipado (Zod validou enum)

    // Validação de input redundante (Zod já fez)
    // if (!topic || typeof topic !== 'string') { ... }

    logger.info(`${fnTag} Buscando conhecimento sobre o tópico: ${topic}`);
    try {
        let knowledge = '';
        // Switch case mantido
        switch (topic) {
            // ... (cases mantidos) ...
             case 'algorithm_overview': knowledge = AlgorithmKnowledge.getAlgorithmOverview(); break;
             case 'algorithm_feed': knowledge = AlgorithmKnowledge.explainFeedAlgorithm(); break;
             // ... (restante dos cases) ...
            default:
                // Não deve ser atingido se Zod validou o enum
                logger.warn(`${fnTag} Tópico não mapeado recebido (apesar da validação Zod?): ${topic}`);
                const validTopics = ZodSchemas.GetConsultingKnowledgeArgsSchema.shape.topic.options;
                return { error: `Tópico de conhecimento inválido: "${topic}".` };
        }
        logger.info(`${fnTag} Conhecimento sobre "${topic}" encontrado.`);
        return { knowledge: knowledge };

    } catch (err) {
        logger.error(`${fnTag} Erro ao buscar conhecimento para o tópico "${topic}":`, err);
        return { error: "Ocorreu um erro interno ao buscar esta informação. Por favor, tente novamente." };
    }
};


/* ------------------------------------------------------------------ *
 * 3.  Mapa exportado (Mantido)                                       *
 * ------------------------------------------------------------------ */
export const functionExecutors: Record<string, ExecutorFn> = {
  getAggregatedReport,
  getTopPosts,
  getDayPCOStats,
  getMetricDetailsById,
  findPostsByCriteria,
  getDailyMetricHistory,
  getConsultingKnowledge,
};

// Removido export duplicado de IMetricStats - assumindo que já está exportado de Metric.ts
// export type { IMetricStats };