import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/app/lib/logger';
import { getAdminSession } from '@/lib/getAdminSession';
import { fetchBrandProposals } from '@/lib/services/adminCreatorService';
import { AdminBrandProposalListParams } from '@/types/admin/brandProposals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/admin/brand-proposals]';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z.string().optional(),
  status: z
    .enum(['all', 'novo', 'visto', 'respondido', 'aceito', 'rejeitado'] as const)
    .optional()
    .default('all'),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'brandName', 'campaignTitle', 'status', 'budget', 'creatorName'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  dateFrom: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), {
      message: 'dateFrom inválida',
    }),
  dateTo: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), {
      message: 'dateTo inválida',
    }),
});

function apiError(message: string, status: number) {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[GET]`;

  try {
    const session = await getAdminSession(req);
    if (!session?.user || session.user.role !== 'admin') {
      return apiError('Acesso não autorizado.', 401);
    }

    const { searchParams } = new URL(req.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validationResult = querySchema.safeParse(queryParams);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map((error) => `${error.path.join('.')}: ${error.message}`)
        .join(', ');
      return apiError(`Parâmetros de consulta inválidos: ${errorMessage}`, 400);
    }

    const params = validationResult.data as AdminBrandProposalListParams;
    const { proposals, totalProposals, totalPages } = await fetchBrandProposals(params);

    return NextResponse.json({
      items: proposals,
      totalItems: totalProposals,
      totalPages,
      currentPage: params.page ?? 1,
      perPage: params.limit ?? 10,
    });
  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    return apiError(error.message || 'Ocorreu um erro interno no servidor.', 500);
  }
}
