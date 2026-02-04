export const dynamic = 'force-dynamic';

/**
 * @fileoverview API Endpoint for fetching and comparing performance data for multiple content segments.
 * @version 2.0.0 - Updated to support 5-dimension classification (format, proposal, context, tone, references).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { getServerSession } from 'next-auth/next';
import { resolveAuthOptions } from '@/app/api/auth/resolveAuthOptions';
import {
  fetchSegmentPerformanceData,
  ISegmentPerformanceResult,
  ISegmentDefinition, // This imported type is likely outdated and defined in another file.
  IFetchSegmentPerformanceArgs,
} from '@/app/lib/dataService/marketAnalysisService';
import { DatabaseError } from '@/app/lib/errors';

const SERVICE_TAG = '[api/admin/dashboard/content-segments/compare v2.0.0]';
const MAX_SEGMENTS_TO_COMPARE_API = 5;

// --- Zod Schemas for Validation ---

// ATUALIZADO: Schema de critérios para incluir as 5 dimensões.
const segmentCriteriaSchema = z.object({
  format: z.string().optional(),
  proposal: z.string().optional(),
  context: z.string().optional(),
  tone: z.string().optional(),      // NOVO
  references: z.string().optional() // NOVO
}).refine(data => Object.values(data).some(val => val !== undefined && val !== ''), {
  message: "At least one criterion (format, proposal, context, tone, or references) must be provided for a segment definition."
});

// CORREÇÃO: Inferir o tipo a partir do Zod schema para garantir que ele esteja sempre atualizado.
// Este tipo 'SegmentCriteria' representa a definição correta e completa do segmento.
type SegmentCriteria = z.infer<typeof segmentCriteriaSchema>;

const dateRangeSchema = z.object({
  startDate: z.string().datetime({ message: "Invalid startDate format. Expected ISO datetime string." }).transform(val => new Date(val)),
  endDate: z.string().datetime({ message: "Invalid endDate format. Expected ISO datetime string." }).transform(val => new Date(val))
}).refine(data => data.startDate <= data.endDate, {
  message: "startDate cannot be after endDate.",
  path: ["endDate"],
});

const segmentObjectSchema = z.object({
  name: z.string().optional(),
  criteria: segmentCriteriaSchema
});

const requestBodySchema = z.object({
  dateRange: dateRangeSchema,
  segments: z.array(segmentObjectSchema)
    .min(1, { message: "At least one segment is required for comparison." })
    .max(MAX_SEGMENTS_TO_COMPARE_API, { message: `Cannot compare more than ${MAX_SEGMENTS_TO_COMPARE_API} segments at a time.` })
});

// --- Helper Functions ---

type AdminSession = {
  user?: {
    role?: string;
    name?: string | null;
  };
} | null;

async function getAdminSession(_req: NextRequest): Promise<AdminSession> {
  const authOptions = await resolveAuthOptions();
  const session = (await getServerSession(authOptions as any)) as AdminSession;
  if (!session || session.user?.role !== 'admin') {
    logger.warn(`${SERVICE_TAG} Admin session validation failed.`);
    return null;
  }
  return session;
}

function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

// ATUALIZADO: Função para gerar nome do segmento com as 5 dimensões.
// CORREÇÃO: A assinatura da função agora usa o tipo 'SegmentCriteria' inferido do Zod.
// Isso resolve o erro de tipo, pois 'SegmentCriteria' inclui 'tone' e 'references'.
function generateSegmentName(criteria: SegmentCriteria): string {
  const parts: string[] = [];
  if (criteria.format) parts.push(`Formato: ${criteria.format}`);
  if (criteria.proposal) parts.push(`Proposta: ${criteria.proposal}`);
  if (criteria.context) parts.push(`Contexto: ${criteria.context}`);
  if (criteria.tone) parts.push(`Tom: ${criteria.tone}`);
  if (criteria.references) parts.push(`Referências: ${criteria.references}`);
  if (parts.length === 0) return 'Segmento Geral';
  return parts.join(', ');
}

export interface SegmentComparisonResultItem {
  name: string;
  performance: ISegmentPerformanceResult;
  // CORREÇÃO: O tipo de 'criteria' é atualizado para refletir a estrutura completa.
  criteria: SegmentCriteria;
}

/**
 * @handler POST
 * @description Handles POST requests to fetch and compare performance data for multiple content segments.
 */
export async function POST(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[POST]`;
  logger.info(`${TAG} Received request for content segment comparison.`);

  try {
    const session = await getAdminSession(req);
    if (!session || !session.user) {
      return apiError('Acesso não autorizado. Sessão de administrador inválida.', 401);
    }
    logger.info(`${TAG} Admin session validated for user: ${session.user.name}`);

    const body = await req.json();
    const validationResult = requestBodySchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      logger.warn(`${TAG} Invalid request body: ${errorMessage}`);
      return apiError(`Corpo da requisição inválido: ${errorMessage}`, 400);
    }

    const { dateRange, segments } = validationResult.data;
    const comparisonResults: SegmentComparisonResultItem[] = [];

    logger.info(`${TAG} Processing ${segments.length} segments for comparison.`);

    for (const segment of segments) {
      // O objeto 'segment.criteria' validado pelo Zod contém todos os campos (incluindo os novos).
      // Ele é passado para o serviço, que provavelmente espera o tipo 'ISegmentDefinition'.
      // Como o tipo do Zod é um superconjunto do tipo antigo, a atribuição é estruturalmente compatível.
      // O ideal é atualizar 'ISegmentDefinition' no dataService também.
      const serviceArgs: IFetchSegmentPerformanceArgs = {
        criteria: segment.criteria,
        dateRange: dateRange,
      };

      const performanceResult = await fetchSegmentPerformanceData(serviceArgs);

      comparisonResults.push({
        name: segment.name || generateSegmentName(segment.criteria),
        performance: performanceResult,
        criteria: segment.criteria,
      });
    }

    logger.info(`${TAG} Successfully fetched and processed data for ${comparisonResults.length} segments.`);
    return NextResponse.json(comparisonResults, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    if (error instanceof DatabaseError) {
      return apiError(`Erro de banco de dados: ${error.message}`, 500);
    } else if (error instanceof z.ZodError) {
        return apiError(`Erro de validação Zod inesperado: ${error.message}`, 400);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}
