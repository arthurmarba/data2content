/**
 * @fileoverview Define as funções (ferramentas) que a IA da Central de Inteligência
 * pode executar, com uma arquitetura robusta e autocontida.
 * @version 14.8.0
 * @description
 * ## Principais Melhorias na Versão 14.8.0:
 * - **Correção de Erro de Tipo (Executor):** Refatorada a criação do objeto
 * `adminFunctionExecutors` para ser explícita em vez de dinâmica. Isso resolve
 * um erro complexo de tipo genérico do TypeScript, garantindo que cada
 * executor de ferramenta seja validado corretamente.
 */

import { z } from 'zod';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import type { FunctionParameters } from 'openai/resources/shared';

// --- Importações Reais do Projeto ---
import { logger } from './logger';
import { convertZodToJsonSchema } from './utils/zodUtils';
import {
    fetchMarketPerformance, 
    fetchTopCreators,
    getAvailableContexts,
    findGlobalPostsByCriteria,
    getCreatorProfile,
    fetchTucaRadarEffectiveness, 
    fetchCohortComparison,
    TopCreatorMetricEnum,
    type IGlobalPostResult,
    type ITopCreatorResult,
    type ICreatorProfile,
    type ITucaRadarEffectivenessResult
} from './dataService/marketAnalysisService';

// CORREÇÃO: Importando todos os módulos de conhecimento
import * as AlgorithmKnowledge from './knowledge/algorithmKnowledge';
import * as HumorKnowledge from './knowledge/humorScriptWritingKnowledge';
import * as MethodologyKnowledge from './knowledge/methodologyDeepDive';
import * as MetricsKnowledge from './knowledge/metricsKnowledge';
import * as PersonalBrandingKnowledge from './knowledge/personalBrandingKnowledge';
import * as PricingKnowledge from './knowledge/pricingKnowledge';

const SERVICE_TAG = '[adminAiFunctions v14.8.0]';

// --- Objeto Agregador para Conhecimento ---
const AllKnowledge = {
    ...AlgorithmKnowledge,
    ...HumorKnowledge,
    ...MethodologyKnowledge,
    ...MetricsKnowledge,
    ...PersonalBrandingKnowledge,
    ...PricingKnowledge
};

const knowledgeDispatchMap: Record<string, () => string> = {
    'algorithm_overview': AllKnowledge.getAlgorithmOverview,
    'pricing_overview_instagram': AllKnowledge.getInstagramPricingRanges,
};

const Knowledge = {
    getAvailableKnowledgeTopics: () => Object.keys(knowledgeDispatchMap),
    getKnowledgeByTopic: (topic: string): string | null => {
        const executor = knowledgeDispatchMap[topic];
        return executor ? executor() : null;
    }
};


// ============================================================================
// --- ARQUITETURA DE DEFINIÇÃO DE FERRAMENTAS (APRIMORADA) ---
// ============================================================================

interface IAdminTool<T extends z.ZodType<any, any>> {
  schema: ChatCompletionTool;
  validator: T;
  executor: (args: z.infer<T>) => Promise<unknown>;
}

function defineAdminTool<T extends z.ZodObject<any, any>>(
  name: string,
  description: string,
  validator: T, 
  executor: (args: z.infer<T>) => Promise<unknown>
): IAdminTool<T> {
  return {
    schema: { 
        type: 'function', 
        function: { 
            name, 
            description, 
            parameters: convertZodToJsonSchema(validator) as FunctionParameters 
        } 
    },
    validator,
    executor,
  };
}

const knowledgeTopics = z.enum(Knowledge.getAvailableKnowledgeTopics() as [string, ...string[]]);

// ============================================================================
// --- IMPLEMENTAÇÃO DAS FERRAMENTAS ---
// ============================================================================

const tools = {
  // FERRAMENTAS EXISTENTES (ATUALIZADAS PARA O NOVO PADRÃO)
  getAvailableContexts: defineAdminTool(
    'getAvailableContexts',
    'Use para descobrir quais nichos de mercado (contextos) existem na base de dados.',
    z.object({}),
    async () => ({ contexts: await getAvailableContexts() })
  ),

  getMarketPerformance: defineAdminTool(
    'getMarketPerformance',
    'Busca a performance MÉDIA para um segmento de mercado.',
    z.object({
      format: z.string().describe("O formato do post. Ex: 'Reel'."),
      proposal: z.string().describe("A proposta do conteúdo. Ex: 'Educativo'."),
      periodDays: z.number().default(90).describe("O período em dias. Padrão: 90."),
    }),
    async (args) => {
        const result = await fetchMarketPerformance({ format: args.format, proposal: args.proposal, days: args.periodDays });
        if (result.postCount === 0) return { summary: `Não foram encontrados dados para o formato '${args.format}' com a proposta '${args.proposal}'.` };
        const roundedEngRate = ((result.avgEngagementRate ?? 0) * 100).toFixed(2);
        return {
            summary: `Análise de ${result.postCount} posts: engajamento médio de ${roundedEngRate}%.`,
            visualizations: [{ type: 'kpi', title: 'Taxa de Engajamento Média', data: { value: roundedEngRate, unit: '%' } }],
            suggestions: [`Comparar performance de ${args.format} educativos com ${args.format} de humor`, `Ver ranking de criadores de conteúdo ${args.proposal}`]
        };
    }
  ),

  getTopCreators: defineAdminTool(
    'getTopCreators',
    'Cria um ranking de criadores com base em uma métrica.',
    z.object({
      context: z.string().optional().describe("Opcional. O nicho de mercado. Ex: 'Finanças'."),
      metric: TopCreatorMetricEnum.default('total_interactions').describe("A métrica para ordenar."),
      periodDays: z.number().default(30).describe("O período em dias. Padrão: 30."),
      limit: z.number().min(1).max(15).default(5).describe("O número de criadores. Padrão: 5."),
    }),
    async ({ context, metric, periodDays, limit }) => {
        const searchContext = context || 'geral';
        const result: ITopCreatorResult[] = await fetchTopCreators({ context: searchContext, metricToSortBy: metric, days: periodDays, limit });
        if (result.length === 0) return { summary: `Não foram encontrados criadores para o ranking.` };
        const leaderName = result[0]?.creatorName || result[0]?.creatorId;
        return {
            summary: `Ranking dos top ${result.length} criadores por '${metric}'. O líder é '${leaderName}'.`,
            visualizations: [{
                type: 'bar_chart',
                title: `Top ${result.length} Criadores por ${metric} em ${searchContext}`,
                data: result.map(c => ({ name: c.creatorName || c.creatorId, value: c.metricValue }))
            }],
            suggestions: [`Analisar o perfil de '${leaderName}'`, `Qual a performance média do nicho '${searchContext}'?`]
        };
    }
  ),
  
  getCreatorProfile: defineAdminTool(
    'getCreatorProfile',
    'Busca um perfil resumido e métricas de performance agregadas para um único criador específico.',
    z.object({ 
      creatorName: z.string().describe("O nome exato do criador a ser analisado.") 
    }),
    async ({ creatorName }) => {
        const profile: ICreatorProfile | null = await getCreatorProfile({ name: creatorName });
        if (!profile) return { summary: `Não foi possível encontrar um perfil para '${creatorName}'.` };
        const roundedEngRate = (profile.avgEngagementRate * 100).toFixed(2);
        return {
            summary: `${profile.creatorName} tem ${profile.postCount} posts analisados. Performance média: ${Math.round(profile.avgLikes)} likes e ${Math.round(profile.avgShares)} compartilhamentos. Nicho de destaque: '${profile.topPerformingContext}'.`,
            visualizations: [
              { type: 'kpi', title: 'Taxa de Engajamento Média', data: { value: roundedEngRate, unit: '%' } },
              { type: 'kpi', title: 'Total de Posts', data: { value: profile.postCount } },
              { type: 'kpi', title: 'Média de Likes', data: { value: Math.round(profile.avgLikes) } }
            ],
            suggestions: [`Quais são os top posts de ${profile.creatorName}?`, `Comparar a performance de ${profile.creatorName} com o mercado de '${profile.topPerformingContext}'`]
        };
    }
  ),

  findGlobalPosts: defineAdminTool(
    'findGlobalPosts',
    'Busca exemplos de posts de toda a base de dados que atendem a critérios específicos.',
    z.object({
      context: z.string().optional().describe("Opcional. Filtra por nicho de mercado."),
      proposal: z.string().optional().describe("Opcional. Filtra pela proposta."),
      format: z.string().optional().describe("Opcional. Filtra pelo formato."),
      minInteractions: z.number().optional().describe("Opcional. Filtra por um número mínimo de interações."),
      limit: z.number().max(20).default(5).describe("Número de posts a retornar. Padrão: 5."),
    }),
    async (args) => {
        const paginatedResult = await findGlobalPostsByCriteria(args);
        const posts: IGlobalPostResult[] = paginatedResult.posts;
        if (posts.length === 0) return { summary: 'Nenhum post encontrado com os critérios especificados.' };
        return {
            summary: `Encontramos ${posts.length} posts. O destaque é: "${(posts[0]?.description || '').slice(0, 50)}..." de ${posts[0]?.creatorName || 'Desconhecido'}.`,
            visualizations: [{
                type: 'list',
                title: `Top ${posts.length} Posts Encontrados`,
                items: posts.map((post) => `"${(post.description || '').slice(0, 60)}..." (Criador: ${post.creatorName || 'Desconhecido'}, Interações: ${(post.stats?.total_interactions ?? 0).toLocaleString('pt-BR')})`)
            }],
            suggestions: [`Analisar a performance média de posts sobre '${args.context || args.proposal}'`, `Ver o perfil do criador ${posts[0]?.creatorName}`]
        };
    }
  ),
  
  getConsultingKnowledge: defineAdminTool(
    'getConsultingKnowledge',
    'Busca conhecimento estratégico sobre tópicos teóricos (algoritmos, precificação, branding, etc.).',
    z.object({ 
      topic: knowledgeTopics.describe("O tópico de consultoria sobre o qual buscar conhecimento.") 
    }),
    async ({ topic }) => {
        const knowledge = Knowledge.getKnowledgeByTopic(topic);
        if (!knowledge) return { error: `O tópico "${topic}" não foi encontrado.` };
        return { summary: knowledge }; 
    }
  ),
  
  // === NOVAS FERRAMENTAS DA FASE 1 ===

  getTucaRadarEffectiveness: defineAdminTool(
    'getTucaRadarEffectiveness',
    'Mede a eficácia dos alertas do Radar Tuca, analisando as interações dos usuários com eles.',
    z.object({
        alertType: z.string().optional().describe("Opcional. Filtra a análise para um tipo de alerta específico. Ex: 'PeakShares'."),
        periodDays: z.number().default(30).describe("Período de análise em dias. Padrão: 30."),
    }),
    async (args) => {
        const effectivenessData = await fetchTucaRadarEffectiveness(args);
        if (effectivenessData.length === 0) return { summary: 'Não foram encontrados dados de interação com alertas no período.' };
        const leader = effectivenessData[0];
        if (!leader) return { summary: 'A análise de eficácia retornou um resultado inesperado.' };
        return {
            summary: `Análise da eficácia dos alertas: O tipo '${leader.alertType}' possui a maior taxa de interação positiva, com ${(leader.positiveInteractionRate * 100).toFixed(0)}% de engajamento em ${leader.totalAlerts} alertas enviados.`,
            visualizations: [{
                type: 'bar_chart',
                title: `Taxa de Interação Positiva por Tipo de Alerta`,
                data: effectivenessData.map(d => ({ name: d.alertType, value: d.positiveInteractionRate }))
            }],
            suggestions: [`Quais os usuários que mais interagem com o alerta '${leader.alertType}'?`, `Comparar a eficácia dos alertas entre usuários 'iniciantes' e 'avançados'.`]
        };
    }
  ),

  compareUserCohorts: defineAdminTool(
    'compareUserCohorts',
    'Compara a performance média de diferentes segmentos de usuários (coortes).',
    z.object({
        metric: z.string().default('engagement_rate_on_reach').describe("Métrica principal para a comparação. Ex: 'stats.total_interactions'."),
        cohorts: z.array(z.object({
            filterBy: z.enum(['planStatus', 'inferredExpertiseLevel']),
            value: z.string()
        })).min(2, "São necessárias pelo menos duas coortes para comparação.")
    }),
    async (args) => {
        const comparisonData = await fetchCohortComparison(args);
        if (comparisonData.length === 0) return { summary: 'Não foi possível comparar as coortes. Verifique se os valores fornecidos (ex: plano, nível de expertise) existem.' };
        const leader = comparisonData[0];
        if (!leader) return { summary: 'A análise de coortes retornou um resultado inesperado.' };
        return {
            summary: `Comparando coortes pela métrica '${args.metric}': a coorte '${leader.cohortName}' performa melhor, com uma média de ${leader.avgMetricValue.toFixed(2)}.`,
            visualizations: [{
                type: 'bar_chart',
                title: `Comparação de Performance por Coorte (${args.metric})`,
                data: comparisonData.map(d => ({ name: d.cohortName, value: d.avgMetricValue }))
            }],
            suggestions: [`Quais os top criadores na coorte '${leader.cohortName}'?`, `Qual a distribuição de formatos de conteúdo mais usados em cada uma dessas coortes?`]
        };
    }
  ),
};

// ============================================================================
// --- EXPORTAÇÕES AUTOMATIZADAS ---
// ============================================================================

type AdminExecutorFn = (args: any) => Promise<unknown>;

export const adminFunctionSchemas: ChatCompletionTool[] = Object.values(tools).map(tool => tool.schema);

const createValidatedExecutor = <T extends z.ZodObject<any, any>>(tool: IAdminTool<T>): AdminExecutorFn => {
  return async (rawArgs: unknown) => {
    try {
      const validation = tool.validator.safeParse(rawArgs);
      if (!validation.success) {
        const errorDetails = validation.error.flatten();
        logger.warn(`${SERVICE_TAG} Argumentos inválidos para a função '${tool.schema.function.name}':`, errorDetails);
        return { error: `Argumentos inválidos para '${tool.schema.function.name}'.`, details: errorDetails.fieldErrors };
      }
      return tool.executor(validation.data);
    } catch (error) {
      logger.error(`${SERVICE_TAG} Erro inesperado no executor da função '${tool.schema.function.name}':`, error);
      return { error: `Ocorreu um erro interno ao executar a ferramenta ${tool.schema.function.name}.` };
    }
  };
};

// CORREÇÃO: Criação explícita do objeto para evitar o erro de tipo do TypeScript.
export const adminFunctionExecutors: Record<string, AdminExecutorFn> = {
    getAvailableContexts: createValidatedExecutor(tools.getAvailableContexts),
    getMarketPerformance: createValidatedExecutor(tools.getMarketPerformance),
    getTopCreators: createValidatedExecutor(tools.getTopCreators),
    getCreatorProfile: createValidatedExecutor(tools.getCreatorProfile),
    findGlobalPosts: createValidatedExecutor(tools.findGlobalPosts),
    getConsultingKnowledge: createValidatedExecutor(tools.getConsultingKnowledge),
    getTucaRadarEffectiveness: createValidatedExecutor(tools.getTucaRadarEffectiveness),
    compareUserCohorts: createValidatedExecutor(tools.compareUserCohorts),
};
