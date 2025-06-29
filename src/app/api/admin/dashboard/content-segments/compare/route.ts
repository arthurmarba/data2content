/**
 * @fileoverview API Endpoint for fetching and comparing performance data for multiple content segments.
 * @version 1.0.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import {
  fetchSegmentPerformanceData,
  ISegmentPerformanceResult,
  ISegmentDefinition,
  IFetchSegmentPerformanceArgs,
} from '@/app/lib/dataService/marketAnalysisService';
import { DatabaseError } from '@/app/lib/errors';
import { getAdminSession } from "@/lib/getAdminSession";

const SERVICE_TAG = '[api/admin/dashboard/content-segments/compare]';
const MAX_SEGMENTS_TO_COMPARE_API = 5;

// --- Zod Schemas for Validation ---

const segmentCriteriaSchema = z.object({
  format: z.string().optional(),
  proposal: z.string().optional(),
  context: z.string().optional()
}).refine(data => Object.values(data).some(val => val !== undefined && val !== ''), {
  message: "At least one criterion (format, proposal, or context) must be provided for a segment definition."
});

const dateRangeSchema = z.object({
  startDate: z.string().datetime({ message: "Invalid startDate format. Expected ISO datetime string." }).transform(val => new Date(val)),
  endDate: z.string().datetime({ message: "Invalid endDate format. Expected ISO datetime string." }).transform(val => new Date(val))
}).refine(data => data.startDate <= data.endDate, {
  message: "startDate cannot be after endDate.",
  path: ["endDate"], // Path for error message
});

const segmentObjectSchema = z.object({
  name: z.string().optional(), // Name given by the frontend for the segment
  criteria: segmentCriteriaSchema
});

const requestBodySchema = z.object({
  dateRange: dateRangeSchema,
  segments: z.array(segmentObjectSchema)
    .min(1, { message: "At least one segment is required for comparison." })
    .max(MAX_SEGMENTS_TO_COMPARE_API, { message: `Cannot compare more than ${MAX_SEGMENTS_TO_COMPARE_API} segments at a time.` })
});

// --- Helper Functions ---

// Real Admin Session Validation

function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

function generateSegmentName(criteria: ISegmentDefinition): string {
  const parts: string[] = [];
  if (criteria.format) parts.push(`Formato: ${criteria.format}`);
  if (criteria.proposal) parts.push(`Proposta: ${criteria.proposal}`);
  if (criteria.context) parts.push(`Contexto: ${criteria.context}`);
  if (parts.length === 0) return 'Segmento Geral'; // Should not happen due to Zod .refine on segmentCriteriaSchema
  return parts.join(', ');
}

export interface SegmentComparisonResultItem {
  name: string;
  performance: ISegmentPerformanceResult;
  criteria: ISegmentDefinition; // Include criteria for frontend reference
}

/**
 * @handler POST
 * @description Handles POST requests to fetch and compare performance data for multiple content segments.
 * Validates admin session and the request body containing segments and a date range.
 * Calls `fetchSegmentPerformanceData` for each segment.
 * @param {NextRequest} req - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} A Next.js response object containing an array of segment comparison results or an error.
 */
export async function POST(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[POST]`;
  logger.info(`${TAG} Received request for content segment comparison.`);

  try {
    const session = await getAdminSession(req);
    // CORREÇÃO: Adicionada verificação para session.user para garantir que não seja indefinido.
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
      const serviceArgs: IFetchSegmentPerformanceArgs = {
        criteria: segment.criteria,
        dateRange: dateRange, // Already validated and transformed by Zod
      };

      const performanceResult = await fetchSegmentPerformanceData(serviceArgs);

      comparisonResults.push({
        name: segment.name || generateSegmentName(segment.criteria),
        performance: performanceResult,
        criteria: segment.criteria, // Return criteria for reference on frontend
      });
    }

    logger.info(`${TAG} Successfully fetched and processed data for ${comparisonResults.length} segments.`);
    return NextResponse.json(comparisonResults, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    if (error instanceof DatabaseError) {
      return apiError(`Erro de banco de dados: ${error.message}`, 500);
    } else if (error instanceof z.ZodError) { // Should be caught by safeParse, but as a fallback
        return apiError(`Erro de validação Zod inesperado: ${error.message}`, 400);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}
