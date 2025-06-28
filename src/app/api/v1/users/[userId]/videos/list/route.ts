// src/app/api/v1/users/[userId]/videos/list/route.ts (Corrigido e Atualizado)

import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { findUserVideoPosts } from '@/app/lib/dataService/marketAnalysis/postsService';
import { mapMetricToDbField } from '@/app/lib/dataService/marketAnalysis/helpers';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';

// Força a rota a ser sempre dinâmica, pois ela lê parâmetros da URL.
export const dynamic = 'force-dynamic';

// Default sorting when none is provided via query params
const DEFAULT_SORT_BY = 'postDate';

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;

  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: 'User ID inválido ou ausente.' }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(request.url);

    // Parâmetros de paginação e ordenação
    const timePeriodParam = searchParams.get('timePeriod') as TimePeriod | null;
    const sortByParam = searchParams.get('sortBy') || DEFAULT_SORT_BY;
    const sortBy = mapMetricToDbField(sortByParam);
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // ==================== INÍCIO DA MUDANÇA ====================
    // Extrai os novos parâmetros de filtro da URL e constrói o objeto de filtros.
    const filters = {
      proposal: searchParams.get('proposal') || undefined,
      context: searchParams.get('context') || undefined,
      format: searchParams.get('format') || undefined,
      linkSearch: searchParams.get('linkSearch') || undefined,
      minViews: searchParams.has('minViews') ? parseInt(searchParams.get('minViews')!, 10) : undefined,
    };
    // ==================== FIM DA MUDANÇA ======================

    const timePeriod: TimePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
      ? timePeriodParam
      : 'last_90_days';

    if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
      return NextResponse.json(
        { error: `timePeriod inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` },
        { status: 400 }
      );
    }

    // Chama a função de serviço, agora passando o objeto de filtros
    const result = await findUserVideoPosts({
      userId,
      timePeriod,
      sortBy,
      sortOrder,
      page,
      limit,
      filters, // Passa os filtros para a camada de serviço
    });

    const totalPages = Math.ceil(result.totalVideos / result.limit) || 1;

    return NextResponse.json({
      videos: result.videos,
      pagination: {
        currentPage: result.page,
        totalPages,
        totalVideos: result.totalVideos,
      },
    });
  } catch (error) {
    console.error('[API USER/VIDEOS/LIST] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      { error: 'Erro ao buscar vídeos.', details: message },
      { status: 500 },
    );
  }
}