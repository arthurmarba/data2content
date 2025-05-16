// @/app/lib/aiFunctionSchemas.zod.ts
// v1.3.1 (Período de Relatório Flexível para getAggregatedReport)
// - ATUALIZADO: GetAggregatedReportArgsSchema.analysisPeriod para aceitar z.number().
// - Mantém funcionalidade da v1.3.0 (Comunidade de Inspiração).
// Arquivo para definir os schemas Zod para validar os argumentos das funções chamadas pela IA.

import { z } from 'zod';
import { Types } from 'mongoose'; // Importado para validação de ObjectId, se necessário

// Schema para getAggregatedReport (ATUALIZADO v1.3.1)
export const GetAggregatedReportArgsSchema = z.object({
  analysisPeriod: z.number({
      invalid_type_error: "O período de análise deve ser um número de dias.",
      description: "O número de dias a serem considerados para a análise do relatório (ex: 7, 30, 40, 90, 180). Use 180 como padrão se nenhum período específico for solicitado. Use 0 para 'todo o período disponível'."
    })
    .int({ message: "O período de análise deve ser um número inteiro de dias." })
    .min(0, { message: "O período de análise não pode ser negativo. Use 0 para 'todo o período'." }) // Permite 0 para "allTime"
    .optional()
    .default(180) // Default de 180 dias
    .describe("O número de dias para o qual o relatório de agregação deve ser gerado. Padrão: 180 dias. Use 0 para 'todo o período disponível'."),
}).strict().describe("Argumentos para buscar o relatório agregado e insights de publicidade.");

// Schema para getTopPosts (mantido da v1.2.0)
export const GetTopPostsArgsSchema = z.object({
  metric: z.enum(['shares', 'saved', 'likes', 'comments', 'reach', 'views'])
            .optional()
            .default('shares'),
  limit: z.number().int()
           .min(1).max(10)
           .optional()
           .default(3),
}).strict();

// Schema para getDayPCOStats (mantido da v1.2.0)
export const GetDayPCOStatsArgsSchema = z.object({}).strict();

// Schema para getMetricDetailsById (mantido da v1.2.0)
export const GetMetricDetailsByIdArgsSchema = z.object({
  metricId: z.string().min(1, { message: "O ID da métrica não pode ser vazio." })
            // .refine(val => Types.ObjectId.isValid(val), { message: "ID da métrica inválido (formato ObjectId esperado)." })
  ,
}).strict();

// Schema para findPostsByCriteria (mantido da v1.2.0)
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

// Schema para getDailyMetricHistory (mantido da v1.2.0)
export const GetDailyMetricHistoryArgsSchema = z.object({
  metricId: z.string().min(1, { message: "O ID da métrica não pode ser vazio." })
             // .refine(val => Types.ObjectId.isValid(val), { message: "ID da métrica inválido (formato ObjectId esperado)." })
  ,
}).strict();

// Schema para getConsultingKnowledge (mantido da v1.2.0)
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
  'best_posting_times',
  'community_inspiration_overview' // Adicionado conforme promptSystemFC.ts
] as const;

export const GetConsultingKnowledgeArgsSchema = z.object({
  topic: z.enum(validKnowledgeTopics, {
    errorMap: (issue, ctx) => ({ message: `Tópico inválido. Use um dos valores permitidos. Recebido: ${ctx.data}` })
  }),
}).strict();

// Schema para getLatestAccountInsights (mantido da v1.2.0)
export const GetLatestAccountInsightsArgsSchema = z.object({
}).strict().describe("Busca os insights de conta e dados demográficos mais recentes disponíveis para o usuário.");


// Schema para FetchCommunityInspirationsArgsSchema (mantido da v1.3.0)
export const FetchCommunityInspirationsArgsSchema = z.object({
  proposal: z.string().min(1, { message: "O campo 'proposal' é obrigatório para buscar inspirações." })
    .describe("A proposta/tema do conteúdo para o qual se busca inspiração."),
  context: z.string().min(1, { message: "O campo 'context' é obrigatório para buscar inspirações." })
    .describe("O contexto específico dentro da proposta."),
  format: z.string().optional()
    .describe("Opcional. Formato do post (ex: Reels, Foto, Carrossel) para refinar a busca."),
  primaryObjectiveAchieved_Qualitative: z.string().optional()
    .describe("Opcional. O objetivo qualitativo principal que a inspiração deve ter demonstrado (ex: 'gerou_muitos_salvamentos', 'alcancou_nova_audiencia')."),
  count: z.number().int().min(1).max(3).optional().default(2)
    .describe("Número de exemplos de inspiração a retornar (padrão 2, mínimo 1, máximo 3).")
}).strict().describe("Argumentos para buscar inspirações na comunidade de criadores IA Tuca.");


// --- Mapa de Validadores (ATUALIZADO v1.3.1) ---
type ValidatorMap = {
  [key: string]: z.ZodType<any, any, any>;
};

export const functionValidators: ValidatorMap = {
  getAggregatedReport: GetAggregatedReportArgsSchema, // Schema atualizado
  getTopPosts: GetTopPostsArgsSchema,
  getDayPCOStats: GetDayPCOStatsArgsSchema,
  getMetricDetailsById: GetMetricDetailsByIdArgsSchema,
  findPostsByCriteria: FindPostsByCriteriaArgsSchema,
  getDailyMetricHistory: GetDailyMetricHistoryArgsSchema,
  getConsultingKnowledge: GetConsultingKnowledgeArgsSchema,
  getLatestAccountInsights: GetLatestAccountInsightsArgsSchema,
  fetchCommunityInspirations: FetchCommunityInspirationsArgsSchema,
};
