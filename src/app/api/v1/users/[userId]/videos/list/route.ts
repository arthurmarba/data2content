// src/app/api/v1/users/[userId]/videos/list/route.ts

import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
// ALTERADO: Importa a função com o novo nome
import { findUserPosts, toProxyUrl } from '@/app/lib/dataService/marketAnalysis/postsService';
import { mapMetricToDbField } from '@/app/lib/dataService/marketAnalysis/helpers';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import { logger } from '@/app/lib/logger';
import { getErrorMessage, isTransientMongoError } from '@/app/lib/mongoTransient';

export const dynamic = 'force-dynamic';

const DEFAULT_SORT_BY = 'postDate';
const ALLOWED_DURATION_BUCKETS = ['0_15', '15_30', '30_60', '60_plus'] as const;
type DurationBucket = (typeof ALLOWED_DURATION_BUCKETS)[number];

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

function normalizeThumb(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('/api/proxy/thumbnail/')) return url;
  if (/^https?:\/\//i.test(url)) return toProxyUrl(url);
  return url;
}

function toInt(value: string | null, fallback: number): number {
  const n = parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const toHour = (value: string | null): number | null => {
  if (value === null || value === undefined) return null;
  const n = parseInt(String(value), 10);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : null;
};

const toDurationBucket = (value: string | null): DurationBucket | null => {
  if (!value) return null;
  const normalized = String(value).trim();
  return (ALLOWED_DURATION_BUCKETS as readonly string[]).includes(normalized)
    ? (normalized as DurationBucket)
    : null;
};

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
    const limit = Math.min(toInt(searchParams.get('limit'), 10), 200);
    const hourFilter = toHour(searchParams.get('hour'));
    const durationBucketRaw = searchParams.get('durationBucket');
    const durationBucket = toDurationBucket(durationBucketRaw);

    const typesParam = searchParams.get('types');
    const parsedTypes = typesParam
      ? typesParam.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean)
      : undefined;

    const filters = {
      proposal: searchParams.get('proposal') || undefined,
      context: searchParams.get('context') || undefined,
      format: searchParams.get('format') || undefined,
      tone: searchParams.get('tone') || undefined,
      references: searchParams.get('reference') || undefined,
      source: searchParams.get('source') || undefined,
      linkSearch: searchParams.get('linkSearch') || undefined,
      minViews: searchParams.has('minViews') ? toInt(searchParams.get('minViews'), 0) : undefined,
      durationBucket: durationBucket || undefined,
      // se não houver filtro explícito, busca todos os tipos (não só vídeo/reel)
      types: parsedTypes,
    };

    if (durationBucketRaw && !durationBucket) {
      return NextResponse.json(
        { error: `durationBucket inválido. Permitidos: ${ALLOWED_DURATION_BUCKETS.join(', ')}` },
        { status: 400 }
      );
    }

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

    if (hourFilter !== null) {
      // Filtra por hora de publicação se solicitado
      (filters as any).hour = hourFilter;
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
      const proxiedThumb = normalizeThumb(thumb ?? p.thumbnailUrl ?? null);
      const proxiedCover = normalizeThumb(p.coverUrl ?? null);
      return {
        ...p,
        coverUrl: proxiedCover,
        thumbnailUrl: proxiedThumb,
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
    if (isTransientMongoError(error) || isTransientMongoError((error as any)?.cause)) {
      logger.warn('[API USER/POSTS/LIST] Transient Mongo error.', {
        userId,
        error: getErrorMessage((error as any)?.cause ?? error),
      });
      return NextResponse.json(
        { error: 'Serviço temporariamente indisponível. Tente novamente em instantes.' },
        { status: 503 },
      );
    }
    logger.error('[API USER/POSTS/LIST] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      { error: 'Erro ao buscar posts.', details: message },
      { status: 500 },
    );
  }
}
