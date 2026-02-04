/**
 * @fileoverview API Endpoint for fetching dashboard creators.
 * @version 1.1.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { fetchDashboardCreatorsList } from '@/app/lib/dataService/marketAnalysis/dashboardService';
import { IFetchDashboardCreatorsListParams } from '@/app/lib/dataService/marketAnalysis/types';
import { DatabaseError } from '@/app/lib/errors';

export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/admin/dashboard/creators]';

// Schema para a validação dos parâmetros de consulta
const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  sortBy: z.string().optional().default('totalPosts'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  nameSearch: z.string().optional(),
  planStatus: z.string().optional().transform(val => {
    if (!val) return undefined;
    return val.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }).refine(val => val === undefined || (Array.isArray(val) && val.length > 0) ? true : false, {
    message: "planStatus deve ser uma lista de strings separadas por vírgulas.",
  }),
  expertiseLevel: z.string().optional().transform(val => {
    if (!val) return undefined;
    return val.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }).refine(val => val === undefined || (Array.isArray(val) && val.length > 0) ? true : false, {
    message: "expertiseLevel deve ser uma lista de strings separadas por vírgulas.",
  }),
  minTotalPosts: z.coerce.number().int().min(0).optional(),
  startDate: z.string().datetime({ offset: true, message: "Formato de startDate inválido." }).optional(),
  endDate: z.string().datetime({ offset: true, message: "Formato de endDate inválido." }).optional(),
  onlyActiveSubscribers: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
}).refine(data => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, { message: "startDate não pode ser posterior a endDate", path: ["endDate"] });

// Real Admin Session Validation
async function getAdminSession(_req: NextRequest) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session || session.user?.role !== 'admin') {
    logger.warn(`${SERVICE_TAG} Validação da sessão de admin falhou.`);
    return null;
  }
  return session;
}

function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

/**
 * @handler GET
 * @description Trata de pedidos GET para buscar uma lista de criadores do dashboard.
 * @param {NextRequest} req - O objeto de pedido do Next.js.
 * @returns {Promise<NextResponse>} Um objeto de resposta do Next.js.
 */
export async function GET(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[GET]`;
  logger.info(`${TAG} Pedido recebido para a lista de criadores do dashboard.`);

  try {
    const session = await getAdminSession(req);
    // CORREÇÃO: Adicionada verificação explícita para session.user.
    if (!session || !session.user) {
      return apiError('Acesso não autorizado.', 401);
    }
    logger.info(`${TAG} Sessão de admin validada para o utilizador: ${session.user.name}`);

    const { searchParams } = new URL(req.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const validationResult = querySchema.safeParse(queryParams);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      logger.warn(`${TAG} Parâmetros de consulta inválidos: ${errorMessage}`);
      return apiError(`Parâmetros de consulta inválidos: ${errorMessage}`, 400);
    }

    const { nameSearch, planStatus, expertiseLevel, minTotalPosts, startDate, endDate, onlyActiveSubscribers, ...paginationAndSort } = validationResult.data;

    let finalPlanStatus = planStatus;
    if (onlyActiveSubscribers) {
      if (finalPlanStatus) {
        if (!finalPlanStatus.includes('active')) {
          finalPlanStatus.push('active');
        }
        // If user selected other plans but also checked "Only Active", logic is tricky.
        // Usually "Only Active" implies filtering ONLY active.
        // If user selected "Free" AND "Only Active", it's contradictory or intersection.
        // Let's assume "Only Active" enforces active.
        // If planStatus was provided, we should probably intersect?
        // But if planStatus is ['free'] and onlyActive is true, intersection is empty.
        // Let's assume onlyActiveSubscribers overrides or intersects.
        // Simplest: if onlyActiveSubscribers is true, we force planStatus to be ['active'] or intersect with ['active'].
        finalPlanStatus = finalPlanStatus.filter(p => p === 'active');
        if (finalPlanStatus.length === 0) finalPlanStatus = ['active']; // Fallback if intersection empty? Or maybe empty is correct.
        // Actually, if user selected 'free' and 'active', and checked 'only active', result is 'active'.
        // If user selected 'free' and checked 'only active', result is empty (no free user is active).
        // So intersection is correct.
      } else {
        finalPlanStatus = ['active'];
      }
    }

    const params: IFetchDashboardCreatorsListParams = {
      ...paginationAndSort,
      filters: {
        nameSearch,
        planStatus: finalPlanStatus,
        expertiseLevel,
        minTotalPosts,
        startDate,
        endDate,
      },
    };

    // Remove filtros indefinidos para manter a chamada ao serviço limpa
    Object.keys(params.filters!).forEach(key => {
      const filterKey = key as keyof typeof params.filters;
      if (params.filters![filterKey] === undefined) {
        delete params.filters![filterKey];
      }
    });

    logger.info(`${TAG} A chamar fetchDashboardCreatorsList com parâmetros: ${JSON.stringify(params)}`);
    const { creators, totalCreators } = await fetchDashboardCreatorsList(params);

    logger.info(`${TAG} ${creators.length} criadores buscados com sucesso. Total disponível: ${totalCreators}.`);
    return NextResponse.json({ creators, totalCreators, page: params.page, limit: params.limit }, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Erro inesperado:`, error);
    if (error instanceof DatabaseError) {
      return apiError(`Erro de base de dados: ${error.message}`, 500);
    }
    if (error instanceof z.ZodError) {
      return apiError(`Erro de validação: ${error.errors.map(e => e.message).join(', ')}`, 400);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}