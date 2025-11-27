/**
 * @fileoverview API Endpoint para buscar rankings de categorias de forma genérica.
 * @version 1.2.0
 * @description Rota corrigida para não importar tipos inexistentes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
// CORREÇÃO: Removido 'RankingMetric' da importação, pois ele não é exportado.
import { fetchTopCategories } from '@/app/lib/dataService/marketAnalysis/rankingsService';
import { DatabaseError } from '@/app/lib/errors';
import { dashboardCache, DEFAULT_DASHBOARD_TTL_MS } from '@/app/lib/cache/dashboardCache';
export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/admin/dashboard/rankings/categories]';

// CORREÇÃO: Definindo a constante sem depender de um tipo importado.
// O 'as const' garante que o TypeScript entenda estes como os únicos valores possíveis.
const ALLOWED_METRICS = [
  'views', 'reach', 'likes', 'comments', 'shares',
  'total_interactions', 'avg_total_interactions',
  'posts',
] as const;

// Schema para validar os parâmetros da URL da requisição
const querySchema = z.object({
  category: z.enum(['proposal', 'format', 'context', 'tone', 'references'], {
    errorMap: () => ({ message: "A categoria deve ser 'proposal', 'format', 'context', 'tone' ou 'references'." })
  }),
  // O z.enum agora usa a constante local, o que resolve o problema de tipo.
  metric: z.enum(ALLOWED_METRICS, {
    errorMap: () => ({ message: `Métrica inválida. Use uma de: ${ALLOWED_METRICS.join(', ')}` })
  }),
  startDate: z.string().datetime({ message: 'Formato de data inválido para startDate.' }).transform(val => new Date(val)),
  endDate: z.string().datetime({ message: 'Formato de data inválido para endDate.' }).transform(val => new Date(val)),
  limit: z.coerce.number().int().min(1).max(50).optional().default(5),
  userId: z.string().optional(),
  onlyActiveSubscribers: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  context: z.string().optional(),
  creatorContext: z.string().optional(),
}).refine(data => data.startDate <= data.endDate, {
  message: 'A data de início não pode ser posterior à data de término.',
  path: ['endDate'],
});

// Função de apoio para tratamento de erros da API
function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

// Lógica de validação de sessão (pode ser substituída pela sua implementação real)
async function getAdminSession(req: NextRequest): Promise<{ user: { name: string } } | null> {
  // ATENÇÃO: Substitua pela sua lógica real de autenticação e autorização
  const isAdmin = true; 
  if (isAdmin) {
    return { user: { name: 'Admin User' } };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[GET]`;
  const start = performance.now ? performance.now() : Date.now();
  logger.info(`${TAG} Requisição recebida.`);

  try {
    // 1. Validação da sessão de administrador
    const session = await getAdminSession(req);
    if (!session) {
      return apiError('Acesso não autorizado.', 401);
    }

    // 2. Validação dos parâmetros da requisição
    const { searchParams } = new URL(req.url);
    const validationResult = querySchema.safeParse(Object.fromEntries(searchParams));
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return apiError(`Parâmetros de consulta inválidos: ${errorMessage}`, 400);
    }

    const { category, metric, startDate, endDate, limit, userId, onlyActiveSubscribers, context, creatorContext } = validationResult.data;

    const cacheKey = `${SERVICE_TAG}:${JSON.stringify({
      category,
      metric,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit,
      userId: userId || '',
      onlyActiveSubscribers: Boolean(onlyActiveSubscribers),
      context: context || '',
      creatorContext: creatorContext || '',
    })}`;

    const { value: results, hit } = await dashboardCache.wrap(
      cacheKey,
      () => fetchTopCategories({
        dateRange: { startDate, endDate },
        category,
        metric,
        limit,
        userId,
        ...(onlyActiveSubscribers ? { onlyActiveSubscribers } : {}),
        ...(context ? { context } : {}),
        ...(creatorContext ? { creatorContext } : {}),
      }),
      DEFAULT_DASHBOARD_TTL_MS
    );

    const duration = Math.round((performance.now ? performance.now() : Date.now()) - start);
    logger.info(`${TAG} Responded in ${duration}ms (cacheHit=${hit})`);

    // 4. Retorno dos resultados com sucesso
    return NextResponse.json(results, { status: 200 });

  } catch (error: any) {
    // 5. Tratamento de erros inesperados
    logger.error(`${TAG} Erro inesperado:`, error);
    if (error instanceof DatabaseError) {
      return apiError(error.message, 500);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}
