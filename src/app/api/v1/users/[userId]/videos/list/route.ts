// src/app/api/v1/users/[userId]/videos/list/route.ts

import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
// ALTERADO: Importa a função com o novo nome
import { findUserPosts } from '@/app/lib/dataService/marketAnalysis/postsService';
import { mapMetricToDbField } from '@/app/lib/dataService/marketAnalysis/helpers';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';

export const dynamic = 'force-dynamic';

const DEFAULT_SORT_BY = 'postDate';

function extractThumbnail(v: any): string | undefined {
  const fromChildren =
    Array.isArray(v?.children) &&
    (
      v.children.find((c: any) => c?.thumbnail_url || c?.media_url)?.thumbnail_url ||
      v.children.find((c: any) => c?.media_type && c.media_type !== 'VIDEO' && c?.media_url)?.media_url ||
      v.children[0]?.thumbnail_url ||
      v.children[0]?.media_url
    );

  return (
    v.thumbnailUrl ||
    v.coverUrl ||
    v.previewUrl ||
    v.imageUrl ||
    v.thumbnail_url ||
    v.mediaPreviewUrl ||
    v.media_url ||
    v.preview_image_url ||
    v.display_url ||
    fromChildren
  );
}

function toInt(value: string | null, fallback: number): number {
  const n = parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

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

    const timePeriodParam = searchParams.get('timePeriod') as TimePeriod | null;
    const sortByParam = searchParams.get('sortBy') || DEFAULT_SORT_BY;
    const mappedSort = mapMetricToDbField(sortByParam) || DEFAULT_SORT_BY;
    const sortOrder: 'asc' | 'desc' = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    const page = toInt(searchParams.get('page'), 1);
    const limit = Math.min(toInt(searchParams.get('limit'), 10), 50);

    const filters = {
      proposal: searchParams.get('proposal') || undefined,
      context: searchParams.get('context') || undefined,
      format: searchParams.get('format') || undefined,
      linkSearch: searchParams.get('linkSearch') || undefined,
      minViews: searchParams.has('minViews') ? toInt(searchParams.get('minViews'), 0) : undefined,
      types: ['VIDEO', 'REEL'],
    };

    const timePeriod: TimePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
      ? timePeriodParam
      : 'last_90_days';

    if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
      return NextResponse.json(
        { error: `timePeriod inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` },
        { status: 400 }
      );
    }

    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    if (endDate) {
      endDate.setUTCHours(23, 59, 59, 999);
    }

    // ALTERADO: Chama a função correta
    const result = await findUserPosts({
      userId,
      timePeriod,
      sortBy: mappedSort,
      sortOrder,
      page,
      limit,
      filters,
      startDate,
      endDate,
    });

    // ALTERADO: Usa result.posts, que é a nova propriedade de retorno
    const normalizedPosts = (result.posts || []).map((p: any) => {
      const thumb = extractThumbnail(p);
      return {
        ...p,
        coverUrl: p.coverUrl ?? null,
        thumbnailUrl: thumb ?? p.thumbnailUrl ?? null,
      };
    });

    // ALTERADO: Usa result.totalPosts para calcular o total de páginas
    const totalPages = Math.max(1, Math.ceil(result.totalPosts / result.limit));

    // ALTERADO: Retorna um objeto consistente com a mudança (posts, totalPosts)
    return NextResponse.json({
      posts: normalizedPosts,
      pagination: {
        currentPage: result.page,
        totalPages,
        totalPosts: result.totalPosts,
      },
    });
  } catch (error) {
    // ALTERADO: Mensagem de erro mais genérica
    console.error('[API USER/POSTS/LIST] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      { error: 'Erro ao buscar posts.', details: message },
      { status: 500 },
    );
  }
}