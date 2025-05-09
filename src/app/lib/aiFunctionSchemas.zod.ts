// @/app/lib/aiFunctionSchemas.zod.ts
// v1.2.0 - Adicionado GetLatestAccountInsightsArgsSchema e atualizado functionValidators.
// Arquivo para definir os schemas Zod para validar os argumentos das funções chamadas pela IA.

import { z } from 'zod';
import { Types } from 'mongoose'; // Importado para validação de ObjectId, se necessário

// Schema para getAggregatedReport (mantido da v1.1.0)
export const GetAggregatedReportArgsSchema = z.object({
  analysisPeriod: z.enum(['last180days', 'last365days', 'allTime'])
    .optional()
    .default('last180days')
    .describe("O período a ser considerado para a análise do relatório. 'last180days' para os últimos 180 dias, 'last365days' para o último ano, 'allTime' para todo o histórico disponível."),
}).strict().describe("Argumentos para buscar o relatório agregado e insights de publicidade.");

// Schema para getTopPosts (mantido da v1.1.0)
export const GetTopPostsArgsSchema = z.object({
  metric: z.enum(['shares', 'saved', 'likes', 'comments', 'reach', 'views']) // Adicionado 'likes', 'comments', 'reach', 'views' para consistência com o que pode ser pedido
            .optional()
            .default('shares'),
  limit: z.number().int()
           .min(1).max(10)
           .optional()
           .default(3),
}).strict();

// Schema para getDayPCOStats (mantido da v1.1.0 - sem argumentos específicos pela IA)
export const GetDayPCOStatsArgsSchema = z.object({}).strict();

// Schema para getMetricDetailsById (mantido da v1.1.0)
export const GetMetricDetailsByIdArgsSchema = z.object({
  metricId: z.string().min(1, { message: "O ID da métrica não pode ser vazio." })
            // .refine(val => Types.ObjectId.isValid(val), { message: "ID da métrica inválido (formato ObjectId esperado)." }) // Validação opcional
  ,
}).strict();

// Schema para findPostsByCriteria (mantido da v1.1.0)
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (esperado YYYY-MM-DD)");

export const FindPostsByCriteriaArgsSchema = z.object({
  criteria: z.object({
    format: z.string().optional(),
    proposal: z.string().optional(),
    context: z.string().optional(),
    dateRange: z.object({
        start: dateStringSchema.optional(),
        end: dateStringSchema.optional(),
      }).optional(),
    minLikes: z.number().int().positive("minLikes deve ser um inteiro positivo.").optional(),
    minShares: z.number().int().positive("minShares deve ser um inteiro positivo.").optional(),
  }).strict("Apenas critérios definidos (format, proposal, etc.) são permitidos."),
  limit: z.number().int().min(1).max(20).optional().default(5),
  sortBy: z.enum(['postDate', 'stats.shares', 'stats.saved', 'stats.likes', 'stats.reach']).optional().default('postDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
}).strict();

// Schema para getDailyMetricHistory (mantido da v1.1.0)
export const GetDailyMetricHistoryArgsSchema = z.object({
  metricId: z.string().min(1, { message: "O ID da métrica não pode ser vazio." })
             // .refine(val => Types.ObjectId.isValid(val), { message: "ID da métrica inválido (formato ObjectId esperado)." }) // Validação opcional
  ,
}).strict();

// Schema para getConsultingKnowledge (mantido da v1.1.0)
const validKnowledgeTopics = [
  'algorithm_overview', 'algorithm_feed', 'algorithm_stories', 'algorithm_reels',
  'algorithm_explore', 'engagement_signals', 'account_type_differences',
  'format_treatment', 'ai_ml_role', 'recent_updates', 'best_practices',
  'pricing_overview_instagram', 'pricing_overview_tiktok',
  'pricing_benchmarks_sector', 'pricing_negotiation_contracts', 'pricing_trends',
  'metrics_analysis', 'metrics_retention_rate',
  'metrics_avg_watch_time', 'metrics_reach_ratio',
  'personal_branding_principles', 'branding_aesthetics',
  'branding_positioning_by_size', 'branding_monetization',
  'branding_case_studies', 'branding_trends',
  'methodology_shares_retention', 'methodology_format_proficiency', 'methodology_cadence_quality',
  'best_posting_times'
] as const;

export const GetConsultingKnowledgeArgsSchema = z.object({
  topic: z.enum(validKnowledgeTopics, {
    errorMap: (issue, ctx) => ({ message: `Tópico inválido. Use um dos valores permitidos. Recebido: ${ctx.data}` })
  }),
}).strict();

// >>> NOVO SCHEMA (v1.2.0) <<<
// Schema para os argumentos de getLatestAccountInsights (sem argumentos específicos pela IA)
export const GetLatestAccountInsightsArgsSchema = z.object({
  // A função usará o userId do contexto do usuário logado.
  // Nenhum parâmetro é esperado da IA para esta função.
}).strict().describe("Busca os insights de conta e dados demográficos mais recentes disponíveis para o usuário.");


// --- Mapa de Validadores (ATUALIZADO v1.2.0) ---
type ValidatorMap = {
  [key: string]: z.ZodType<any, any, any>;
};

export const functionValidators: ValidatorMap = {
  getAggregatedReport: GetAggregatedReportArgsSchema,
  getTopPosts: GetTopPostsArgsSchema,
  getDayPCOStats: GetDayPCOStatsArgsSchema,
  getMetricDetailsById: GetMetricDetailsByIdArgsSchema,
  findPostsByCriteria: FindPostsByCriteriaArgsSchema,
  getDailyMetricHistory: GetDailyMetricHistoryArgsSchema,
  getConsultingKnowledge: GetConsultingKnowledgeArgsSchema,
  getLatestAccountInsights: GetLatestAccountInsightsArgsSchema, // <<< ADICIONADO NOVO SCHEMA AO MAPA
};
