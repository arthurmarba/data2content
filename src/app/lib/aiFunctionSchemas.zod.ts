// @/app/lib/aiFunctionSchemas.zod.ts
// Arquivo para definir os schemas Zod para validar os argumentos das funções chamadas pela IA.

import { z } from 'zod';
import { Types } from 'mongoose'; // Importado para validação de ObjectId, se necessário

// Schema para getAggregatedReport (sem argumentos)
export const GetAggregatedReportArgsSchema = z.object({}).strict();

// Schema para getTopPosts
export const GetTopPostsArgsSchema = z.object({
  metric: z.enum(['shares', 'saved'])
            .optional()
            .default('shares'),
  limit: z.number().int()
           .min(1).max(10)
           .optional()
           .default(3),
}).strict();

// Schema para getDayPCOStats (sem argumentos - igual a getAggregatedReport)
// Se esta função realmente não tiver argumentos, podemos reutilizar o schema.
// Certifique-se de que a definição em aiFunctions.ts corresponde.
export const GetDayPCOStatsArgsSchema = z.object({}).strict();

// Schema para getMetricDetailsById
export const GetMetricDetailsByIdArgsSchema = z.object({
  metricId: z.string().min(1, { message: "O ID da métrica não pode ser vazio." })
            // Validação opcional de ObjectId (pode ser feita no executor também)
            // .refine(val => Types.ObjectId.isValid(val), { message: "ID da métrica inválido (formato ObjectId esperado)." })
  ,
}).strict();

// Schema para findPostsByCriteria
// Validação de datas: assegura que é uma string no formato YYYY-MM-DD
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (esperado YYYY-MM-DD)");

export const FindPostsByCriteriaArgsSchema = z.object({
  criteria: z.object({
    format: z.string().optional(),
    proposal: z.string().optional(),
    context: z.string().optional(),
    dateRange: z.object({
        start: dateStringSchema, // Usa schema de data validado
        end: dateStringSchema,   // Usa schema de data validado
      }).optional(),
    minLikes: z.number().int().positive("minLikes deve ser um inteiro positivo.").optional(),
    minShares: z.number().int().positive("minShares deve ser um inteiro positivo.").optional(),
  }).strict("Apenas critérios definidos (format, proposal, etc.) são permitidos."), // Mensagem de erro para chaves extras
  limit: z.number().int().min(1).max(20).optional().default(5),
  sortBy: z.enum(['postDate', 'stats.shares', 'stats.saved', 'stats.likes', 'stats.reach']).optional().default('postDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
}).strict(); // Não permite chaves extras no nível raiz

// Schema para getDailyMetricHistory
export const GetDailyMetricHistoryArgsSchema = z.object({
  metricId: z.string().min(1, { message: "O ID da métrica não pode ser vazio." })
             // .refine(val => Types.ObjectId.isValid(val), { message: "ID da métrica inválido (formato ObjectId esperado)." }) // Opcional
  ,
}).strict();

// Schema para getConsultingKnowledge
// IMPORTANTE: Mantenha esta lista sincronizada com functionSchemas em aiFunctions.ts
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
] as const; // 'as const' ajuda na inferência de tipo para o enum

export const GetConsultingKnowledgeArgsSchema = z.object({
  topic: z.enum(validKnowledgeTopics, {
    errorMap: (issue, ctx) => ({ message: `Tópico inválido. Use um dos valores permitidos. Recebido: ${ctx.data}` })
  }),
}).strict();


// --- Mapa de Validadores ---
// Tipo base para o mapa
type ValidatorMap = {
  [key: string]: z.ZodType<any, any, any>;
};

// Mapa que associa o nome da função ao seu schema Zod de validação de argumentos
export const functionValidators: ValidatorMap = {
  getAggregatedReport: GetAggregatedReportArgsSchema,
  getTopPosts: GetTopPostsArgsSchema,
  getDayPCOStats: GetDayPCOStatsArgsSchema, // Reutiliza se não tiver args
  getMetricDetailsById: GetMetricDetailsByIdArgsSchema,
  findPostsByCriteria: FindPostsByCriteriaArgsSchema,
  getDailyMetricHistory: GetDailyMetricHistoryArgsSchema,
  getConsultingKnowledge: GetConsultingKnowledgeArgsSchema,
  // Certifique-se de que TODAS as suas funções de aiFunctions.ts tenham uma entrada aqui
};