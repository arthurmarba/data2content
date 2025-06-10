/**
 * @fileoverview Define as funções (ferramentas) que a IA da Central de Inteligência
 * pode executar.
 * @version 4.1.0 - Tornou o parâmetro 'context' opcional em getTopCreators.
 */

import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { 
    fetchMarketPerformance, 
    fetchTopCreators,
    getAvailableContexts,
    findGlobalPostsByCriteria,
    type IGlobalPostResult
} from './dataService/marketAnalysisService';

const SERVICE_TAG = '[adminAiFunctions v4.1.0]';
type AdminExecutorFn = (args: any) => Promise<unknown>;

// --- 1. Função: getAvailableContexts ---
const getAvailableContextsSchema = {
  name: 'getAvailableContexts',
  description: 'Retorna uma lista de todos os nichos de mercado (contextos) únicos disponíveis no banco de dados. Use esta função para descobrir quais nichos podem ser analisados.',
  parameters: { type: 'object', properties: {} },
};
const getAvailableContextsExecutor: AdminExecutorFn = async () => {
  return { contexts: await getAvailableContexts() };
};

// --- 2. Função: getMarketPerformance ---
const GetMarketPerformanceArgsSchema = z.object({
  format: z.string().describe("O formato do post. Ex: 'Reel', 'Carrossel'."),
  proposal: z.string().describe("A proposta do conteúdo. Ex: 'Educativo', 'Venda Direta'."),
  periodDays: z.number().default(90),
});
const getMarketPerformanceSchema = {
  name: 'getMarketPerformance',
  description: 'Calcula a performance MÉDIA de métricas para um segmento de mercado específico, que é a combinação de um formato e uma proposta.',
  parameters: { type: 'object', properties: { format: {type: 'string'}, proposal: {type: 'string'}, periodDays: {type: 'number'} } , required: ['format', 'proposal']},
};
const getMarketPerformanceExecutor: AdminExecutorFn = async (rawArgs: unknown) => {
  const validation = GetMarketPerformanceArgsSchema.safeParse(rawArgs);
  if (!validation.success) return { error: "Argumentos inválidos." };
  const { format, proposal, periodDays } = validation.data;
  const result = await fetchMarketPerformance(format, proposal, periodDays);
  if (result.postCount === 0) return { summary: `Não foram encontrados dados para ${format} com proposta '${proposal}'.` };
  const roundedEngRate = ((result.avgEngagementRate ?? 0) * 100).toFixed(2);
  return {
      summary: `Análise de ${result.postCount} posts do tipo '${format}/${proposal}' nos últimos ${periodDays} dias. A taxa de engajamento média foi de ${roundedEngRate}%.`,
      visualizations: [ { type: 'kpi', title: 'Taxa de Engajamento Média', data: { value: roundedEngRate, unit: '%' } }]
  };
};

// --- 3. Função: getTopCreators ---
const GetTopCreatorsArgsSchema = z.object({
  // CORREÇÃO: O contexto agora é opcional.
  context: z.string().optional().describe("Opcional. O contexto ou nicho de mercado a ser analisado. Se omitido, o ranking será geral."),
  metric: z.enum(['total_interactions', 'engagement_rate_on_reach', 'shares', 'saved', 'reach', 'views']).default('total_interactions').describe("A métrica para ordenar o ranking."),
  periodDays: z.number().default(30),
  limit: z.number().min(1).max(10).default(5),
});
const getTopCreatorsSchema = {
  name: 'getTopCreators',
  description: 'Identifica e rankeia os criadores com maior performance, ordenado por uma métrica específica. Pode ser filtrado por um nicho (contexto) ou pode ser um ranking geral.',
  parameters: { 
    type: 'object', 
    properties: { 
        context: {type: 'string', description: "Opcional. O nicho de mercado. Ex: 'Moda'. Se omitido, o ranking será geral."}, 
        metric: {type: 'string', description: "A métrica para ordenar o ranking.", enum: ['total_interactions', 'engagement_rate_on_reach', 'shares', 'saved', 'reach', 'views'], default: 'total_interactions'}, 
        periodDays: {type: 'number', description: "O período em dias.", default: 30}, 
        limit: {type: 'number', description: "O número de criadores no ranking.", default: 5} 
    },
    // CORREÇÃO: 'context' não é mais obrigatório.
    required: []
  },
};
const getTopCreatorsExecutor: AdminExecutorFn = async (rawArgs: unknown) => {
    const validation = GetTopCreatorsArgsSchema.safeParse(rawArgs);
    if (!validation.success) return { error: "Argumentos inválidos." };
    const { context, metric, periodDays, limit } = validation.data;
    
    // CORREÇÃO: Passa "geral" para o serviço se nenhum contexto for fornecido.
    const searchContext = context || 'geral';
    
    const result = await fetchTopCreators(searchContext, metric, periodDays, limit);
    const contextDescription = context ? `em '${context}'` : 'geral';

    if (result.length === 0) return { summary: `Não foram encontrados criadores no ranking ${contextDescription}.` };
    
    return {
        summary: `Ranking dos top ${result.length} criadores ${contextDescription} por '${metric}'. O líder é '${result[0]?.creatorName || 'ID ' + result[0]?.creatorId}'.`,
        visualizations: [{ 
            type: 'bar_chart', 
            title: `Top ${result.length} Criadores ${contextDescription} por ${metric}`,
            data: result.map(c => ({ name: c.creatorName || c.creatorId, value: c.metricValue })) 
        }]
    };
};

// --- 4. Função: findGlobalPosts (Otimizada) ---
const FindGlobalPostsArgsSchema = z.object({
    context: z.string().optional().describe("Opcional. Filtra por um nicho de mercado. Ex: 'Moda'"),
    proposal: z.string().optional().describe("Opcional. Filtra por uma proposta de conteúdo. Ex: 'Venda Direta'"),
    format: z.string().optional().describe("Opcional. Filtra por um formato de post. Ex: 'Reel'"),
    minInteractions: z.number().optional().describe("Opcional. Filtra por posts com um número mínimo de interações totais."),
    limit: z.number().max(20).default(5),
});
const findGlobalPostsSchema = {
    name: 'findGlobalPosts',
    description: 'Realiza uma busca GLOBAL por posts que atendem a critérios específicos (nicho, proposta, formato, interações mínimas) para encontrar exemplos de conteúdo.',
    parameters: {
        type: 'object',
        properties: {
            context: { type: 'string', description: "Opcional. O nicho de mercado. Ex: 'Moda'" },
            proposal: { type: 'string', description: "Opcional. A proposta do conteúdo. Ex: 'Venda Direta'" },
            format: { type: 'string', description: "Opcional. O formato do post. Ex: 'Reel'" },
            minInteractions: { type: 'number', description: "Opcional. Número mínimo de interações totais." },
            limit: { type: 'number', default: 5, description: "Número de posts a retornar." },
        },
        required: []
    }
};
const findGlobalPostsExecutor: AdminExecutorFn = async (rawArgs: unknown) => {
    const validation = FindGlobalPostsArgsSchema.safeParse(rawArgs);
    if (!validation.success) return { error: "Argumentos inválidos." };
    const args = validation.data;
    const result = await findGlobalPostsByCriteria(args);
    if (result.length === 0) return { summary: 'Nenhum post encontrado com os critérios especificados.' };
    return {
        summary: `Encontrados ${result.length} posts que atendem aos seus critérios. O post com mais destaque é: "${(result[0]?.description || '').slice(0, 50)}..." do criador ${result[0]?.creatorName}.`,
        visualizations: [{
            type: 'list',
            title: 'Posts Encontrados',
            items: result.map((post: IGlobalPostResult) => `"${(post.description || '').slice(0, 60)}..." (Criador: ${post.creatorName || 'Desconhecido'}, Interações: ${post.stats.total_interactions})`)
        }]
    };
};

// --- EXPORTAÇÕES ---
export const adminFunctionSchemas = [ 
    getAvailableContextsSchema, 
    getMarketPerformanceSchema, 
    getTopCreatorsSchema,
    findGlobalPostsSchema,
];
export const adminFunctionExecutors: Record<string, AdminExecutorFn> = {
  getAvailableContexts: getAvailableContextsExecutor,
  getMarketPerformance: getMarketPerformanceExecutor,
  getTopCreators: getTopCreatorsExecutor,
  findGlobalPosts: findGlobalPostsExecutor,
};
