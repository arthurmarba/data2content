// @/app/lib/aiFunctionSchemas.zod.ts
// v1.3.5 (Corrige extensão de importação)
// - CORRIGIDO: Removida extensão .ts da importação de communityInspirations.constants.
// - Baseado na v1.3.4.

import { z } from 'zod';
import { Types } from 'mongoose';
import {
    VALID_FORMATS,
    VALID_PROPOSALS,
    VALID_CONTEXTS,
    VALID_QUALITATIVE_OBJECTIVES,
    FormatType, // Importando os tipos para possível uso futuro, embora z.enum use os arrays diretamente
    ProposalType,
    ContextType,
    QualitativeObjectiveType
} from '@/app/lib/constants/communityInspirations.constants'; // CORRIGIDO: Removido .ts

// Schema para getAggregatedReport (Mantido)
export const GetAggregatedReportArgsSchema = z.object({
  analysisPeriod: z.number({
      invalid_type_error: "O período de análise deve ser um número de dias.",
      description: "O número de dias a serem considerados para a análise do relatório (ex: 7, 30, 40, 90, 180). Use 180 como padrão se nenhum período específico for solicitado. Use 0 para 'todo o período disponível'."
    })
    .int({ message: "O período de análise deve ser um número inteiro de dias." })
    .min(0, { message: "O período de análise não pode ser negativo. Use 0 para 'todo o período'." })
    .optional()
    .default(180)
    .describe("O número de dias para o qual o relatório de agregação deve ser gerado. Padrão: 180 dias. Use 0 para 'todo o período disponível'."),
}).strict().describe("Argumentos para buscar o relatório agregado e insights de publicidade.");

// Schema para getTopPosts (Mantido)
export const GetTopPostsArgsSchema = z.object({
  metric: z.enum(['shares', 'saved', 'likes', 'comments', 'reach', 'views'])
            .optional()
            .default('shares'),
  limit: z.number().int()
           .min(1).max(10)
           .optional()
           .default(3),
}).strict();

// Schema para getDayPCOStats (Mantido)
export const GetDayPCOStatsArgsSchema = z.object({}).strict();

// Schema para getMetricDetailsById (Mantido)
export const GetMetricDetailsByIdArgsSchema = z.object({
  metricId: z.string().min(1, { message: "O ID da métrica não pode ser vazio." }),
}).strict();

// Schema para findPostsByCriteria (ATUALIZADO v1.3.4)
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (esperado YYYY-MM-DD)");

export const FindPostsByCriteriaArgsSchema = z.object({
  criteria: z.object({
    format: z.enum(VALID_FORMATS, {
        invalid_type_error: "Formato inválido. Por favor, use um dos valores de formato conhecidos."
      })
      .optional(),
    proposal: z.enum(VALID_PROPOSALS, {
        invalid_type_error: "Proposta inválida. Por favor, use um dos valores de proposta conhecidos."
      })
      .optional(),
    context: z.enum(VALID_CONTEXTS, {
        invalid_type_error: "Contexto inválido. Por favor, use um dos valores de contexto conhecidos."
      })
      .optional(),
    dateRange: z.object({
        start: dateStringSchema.optional(),
        end: dateStringSchema.optional(),
      }).optional(),
    minLikes: z.number().int().nonnegative("minLikes deve ser um inteiro não-negativo (0 ou mais).").optional(),
    minShares: z.number().int().positive("minShares deve ser um inteiro positivo.").optional(),
  }).strict("Apenas critérios definidos (format, proposal, etc.) são permitidos."),
  limit: z.number().int().min(1).max(20, "O limite máximo de posts a retornar é 20.").optional().default(5),
  sortBy: z.enum(['postDate', 'stats.shares', 'stats.saved', 'stats.likes', 'stats.reach']).optional().default('postDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
}).strict();

// Schema para getDailyMetricHistory (Mantido)
export const GetDailyMetricHistoryArgsSchema = z.object({
  metricId: z.string().min(1, { message: "O ID da métrica não pode ser vazio." }),
}).strict();

// Schema para getConsultingKnowledge (Mantido)
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
  'community_inspiration_overview'
] as const;

export const GetConsultingKnowledgeArgsSchema = z.object({
  topic: z.enum(validKnowledgeTopics, {
    errorMap: (issue, ctx) => ({ message: `Tópico inválido. Use um dos valores permitidos. Recebido: ${ctx.data}` })
  }),
}).strict();

// Schema para getLatestAccountInsights (Mantido)
export const GetLatestAccountInsightsArgsSchema = z.object({
}).strict().describe("Busca os insights de conta e dados demográficos mais recentes disponíveis para o usuário.");


// Schema para FetchCommunityInspirationsArgsSchema (Mantido da v1.3.3)
export const FetchCommunityInspirationsArgsSchema = z.object({
  proposal: z.enum(VALID_PROPOSALS, {
      invalid_type_error: "Proposta inválida. Por favor, use um dos valores de proposta conhecidos.",
      required_error: "O campo 'proposal' é obrigatório para buscar inspirações."
    })
    .describe(`A proposta/tema do conteúdo para o qual se busca inspiração. Valores válidos: ${VALID_PROPOSALS.join(', ')}`),
  context: z.enum(VALID_CONTEXTS, {
      invalid_type_error: "Contexto inválido. Por favor, use um dos valores de contexto conhecidos.",
      required_error: "O campo 'context' é obrigatório para buscar inspirações."
    })
    .describe(`O contexto específico dentro da proposta. Valores válidos: ${VALID_CONTEXTS.join(', ')}`),
  format: z.enum(VALID_FORMATS, {
      invalid_type_error: "Formato inválido. Por favor, use um dos valores de formato conhecidos."
    })
    .optional()
    .describe(`Opcional. Formato do post (ex: Reels, Foto, Carrossel) para refinar a busca. Valores válidos: ${VALID_FORMATS.join(', ')}`),
  primaryObjectiveAchieved_Qualitative: z.enum(VALID_QUALITATIVE_OBJECTIVES, {
      invalid_type_error: "Objetivo qualitativo inválido. Por favor, use um dos valores de objetivo conhecidos."
    })
    .optional()
    .describe(`Opcional. O objetivo qualitativo principal que a inspiração deve ter demonstrado. Valores válidos: ${VALID_QUALITATIVE_OBJECTIVES.join(', ')}`),
  count: z.number().int().min(1).max(3).optional().default(2)
    .describe("Número de exemplos de inspiração a retornar (padrão 2, mínimo 1, máximo 3).")
}).strict().describe("Argumentos para buscar inspirações na comunidade de criadores IA Tuca.");


// --- Mapa de Validadores (ATUALIZADO v1.3.5) ---
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
  getLatestAccountInsights: GetLatestAccountInsightsArgsSchema,
  fetchCommunityInspirations: FetchCommunityInspirationsArgsSchema,
};
