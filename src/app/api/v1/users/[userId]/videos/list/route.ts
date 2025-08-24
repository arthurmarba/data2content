// src/app/api/v1/users/[userId]/videos/list/route.ts

import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { findUserVideoPosts } from '@/app/lib/dataService/marketAnalysis/postsService';
import { mapMetricToDbField } from '@/app/lib/dataService/marketAnalysis/helpers';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';

// Força a rota a ser sempre dinâmica, pois ela lê parâmetros da URL.
export const dynamic = 'force-dynamic';

// Default sorting when none is provided via query params
const DEFAULT_SORT_BY = 'postDate';

// Helper para extrair uma thumbnail confiável de cada item
function extractThumbnail(v: any): string | undefined {
  // Carrossel: tenta a 1ª imagem/vídeo dos filhos
  const fromChildren =
    Array.isArray(v?.children) &&
    (
      v.children.find((c: any) => c?.thumbnail_url || c?.media_url)?.thumbnail_url ||
      // se houver imagem (não vídeo) nos filhos, usa media_url
      v.children.find((c: any) => c?.media_type && c.media_type !== 'VIDEO' && c?.media_url)?.media_url ||
      v.children[0]?.thumbnail_url ||
      v.children[0]?.media_url
    );

  // Ordem de preferência comum a IG/FB Graph e campos internos
  return (
    v.thumbnailUrl ||
    v.coverUrl ||
    v.previewUrl ||
    v.imageUrl ||
    v.thumbnail_url ||
    v.mediaPreviewUrl ||
    v.media_url ||       // quando for imagem single
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

    // Parâmetros de paginação e ordenação
    const timePeriodParam = searchParams.get('timePeriod') as TimePeriod | null;
    const sortByParam = searchParams.get('sortBy') || DEFAULT_SORT_BY;
    const mappedSort = mapMetricToDbField(sortByParam) || DEFAULT_SORT_BY;
    const sortOrder: 'asc' | 'desc' = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    const page = toInt(searchParams.get('page'), 1);
    const limit = Math.min( toInt(searchParams.get('limit'), 10), 50 ); // evita abusos

    // Filtros adicionais
    const filters = {
      proposal: searchParams.get('proposal') || undefined,
      context: searchParams.get('context') || undefined,
      format: searchParams.get('format') || undefined,
      linkSearch: searchParams.get('linkSearch') || undefined,
      minViews: searchParams.has('minViews') ? toInt(searchParams.get('minViews'), 0) : undefined,
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

    // Busca
    const result = await findUserVideoPosts({
      userId,
      timePeriod,
      sortBy: mappedSort,
      sortOrder,
      page,
      limit,
      filters,
    });

    // Normalização: garante sempre um thumbnailUrl (quando possível)
    const normalizedVideos = (result.videos || []).map((v: any) => {
      const thumb = extractThumbnail(v);
      return {
        ...v,
        // preserva coverUrl se vier do serviço
        coverUrl: v.coverUrl ?? null,
        thumbnailUrl: thumb ?? v.thumbnailUrl ?? null,
      };
    });

    const totalPages = Math.max(1, Math.ceil(result.totalVideos / result.limit));

    return NextResponse.json({
      videos: normalizedVideos,
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
