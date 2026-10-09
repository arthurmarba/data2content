/**
 * Histórico antigo do Instagram, puxado uma vez quando o criador conecta.
 *
 * A sincronização periódica (`triggerDataRefresh`) só olha os últimos
 * `INSIGHT_FETCH_CUTOFF_DAYS` dias: post mais velho que isso nunca entrava no
 * banco, nem como registro. Quem conectava com meses de conta chegava ao conector
 * com metade dos posts — e sem nada que dissesse que faltava.
 *
 * Este trabalho cobre exatamente o que a sincronização periódica não cobre:
 *
 * - posts mais antigos que a janela dela, até `HISTORY_MAX_AGE_DAYS`, com os
 *   números de hoje do Instagram e sem os links de mídia (expiram em dias);
 * - os 30 dias de novos seguidores anteriores à conexão, que é tudo o que a API
 *   guarda.
 *
 * Regra que não se negocia: **só chamadas ao Instagram**. O post antigo é gravado
 * com `skipAiReadings`, sem classificação nem leitura de cena. A repescagem de
 * leituras só olha os últimos 90 dias, então nada mais o manda para a IA depois.
 *
 * Roda em passos: cada execução lê algumas páginas e devolve o cursor para a
 * próxima, para caber no tempo de uma função e para recomeçar de onde parou
 * quando o Instagram pede pausa.
 */
import { Types } from 'mongoose';
import pLimit from 'p-limit';
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose';
import DbUser from '@/app/models/User';
import MetricModel, { IMetricStats } from '@/app/models/Metric';
import InstagramNewFollowersDayModel from '@/app/models/InstagramNewFollowersDay';
import { calcFormulas } from '@/app/lib/formulas';
import {
  FEED_MEDIA_INSIGHTS_METRICS,
  INSIGHT_FETCH_CUTOFF_DAYS,
  INSIGHTS_CONCURRENCY_LIMIT,
  MAX_PAGES_MEDIA,
  REEL_INSIGHTS_METRICS,
} from '../config/instagramApiConfig';
import { fetchDailyNewFollowers, fetchInstagramMedia, fetchMediaInsights } from '../api/fetchers';
import { saveMetricData } from '../db/metricActions';
import { isTokenInvalidError } from '../utils/tokenUtils';
import { probeVideoDurationSecondsFromUrl } from '../utils/videoDurationFromUrl';
import type { InstagramMedia } from '../types';

const TAG = '[instagramHistoryBackfill]';

/**
 * Até onde o histórico vai. O banco é o Atlas gratuito (512 MB): em 02/10/2026 os
 * 55 criadores conectados tinham 50 mil posts fora do banco (~95 MB); os de até
 * dois anos eram 11,8 mil (~22 MB). Ir além disso pede banco maior.
 */
export const HISTORY_MAX_AGE_DAYS = 730;

/**
 * Páginas de 25 posts por execução: ~300 posts cabem com folga em uma função. Tem
 * de ser maior que `MAX_PAGES_MEDIA`: o primeiro passo é quem sabe onde termina o
 * alcance da sincronização periódica.
 */
const PAGES_PER_STEP = Math.max(12, MAX_PAGES_MEDIA + 1);
/** Para antes do teto da função (300 s) mesmo se ainda houver página no passo. */
const TIME_BUDGET_MS = 200_000;

export type HistoryBackfillStep =
  | { status: 'continue'; after: string }
  | { status: 'rate_limited'; after: string | null }
  | { status: 'done' }
  | { status: 'failed'; error: string }
  | { status: 'skipped'; reason: string };

export type HistoryBackfillStepResult = HistoryBackfillStep & {
  pagesRead: number;
  postsSaved: number;
  postsWithoutInsights: number;
  /** Posts que o banco recusou; ficam de fora sem travar o resto da conta. */
  postsFailed: number;
  followerDaysSaved: number;
};

/** O Instagram responde limite de uso com estes códigos (4, 17, 32, 613) ou com o texto. */
export function isInstagramRateLimitError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /\(#(4|17|32|613)\)|\(code:? ?(4|17|32|613)\)|rate limit|request limit|too many calls|limit reached/i.test(message);
}

/** Cursor `after` da URL da próxima página — a URL inteira não se guarda: ela traz o token. */
export function afterCursorFromNextPageUrl(nextPageUrl: string | null | undefined): string | null {
  if (!nextPageUrl) return null;
  try {
    return new URL(nextPageUrl).searchParams.get('after');
  } catch {
    return null;
  }
}

/**
 * Post antigo recusa quase tudo: "does not support the views, likes, … metric for
 * this media product type". A chamada é atômica, então a recusa derrubava até o
 * alcance. Devolve a lista sem as recusadas (o que sobra costuma ser reach,saved),
 * ou `null` se a mensagem não é dessa recusa.
 */
export function metricsLeftAfterRejection(message: string | null | undefined, requested: string): string | null {
  const rejected = /does not support the ([a-z_, ]+?) metrics? for this media/i.exec(message ?? '')?.[1];
  if (!rejected) return null;
  const drop = new Set(rejected.split(',').map((metric) => metric.trim().toLowerCase()).filter(Boolean));
  const left = requested.split(',').map((metric) => metric.trim()).filter((metric) => metric && !drop.has(metric));
  return left.length && left.length < requested.split(',').length ? left.join(',') : null;
}

/** Mesma escolha de métricas da sincronização periódica. */
export function insightMetricsForMedia(media: InstagramMedia): string | null {
  if (media.media_product_type === 'REELS') return REEL_INSIGHTS_METRICS;
  if (media.media_product_type === 'FEED' || media.media_product_type === 'AD') return FEED_MEDIA_INSIGHTS_METRICS;
  if (media.media_type === 'CAROUSEL_ALBUM') return FEED_MEDIA_INSIGHTS_METRICS;
  return null;
}

/** Dia civil no horário do Pacífico do dia que termina em `endTime` (como o Instagram fecha o dia). */
export function instagramDayFromEndTime(endTime: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(endTime.getTime() - 1));
}

function isVideoLike(media: InstagramMedia): boolean {
  return media.media_product_type === 'REELS' || media.media_type === 'VIDEO';
}

/**
 * Post antigo costuma vir da API sem `video_duration`, e sem duração não há
 * retenção. Lê a duração no cabeçalho do próprio arquivo (os primeiros 2 MB, sem
 * IA), como a sincronização periódica já faz.
 */
async function withVideoDuration(media: InstagramMedia): Promise<InstagramMedia> {
  if (!isVideoLike(media)) return media;
  const current = (media as { video_duration?: unknown }).video_duration;
  if (typeof current === 'number' && current > 0) return media;
  const url = typeof media.media_url === 'string' ? media.media_url : null;
  const duration = url ? await probeVideoDurationSecondsFromUrl(url) : null;
  return duration && duration > 0 ? ({ ...media, video_duration: duration } as InstagramMedia) : media;
}

/** Histórico já puxado para esta mesma conta não se puxa de novo. */
export function needsHistoryBackfill(state: { status?: string | null; instagramAccountId?: string | null } | null | undefined, instagramAccountId: string): boolean {
  return !(state?.status === 'done' && state.instagramAccountId === instagramAccountId);
}

async function saveNewFollowersHistory(params: {
  userId: Types.ObjectId;
  accountId: string;
  token: string;
  dryRun: boolean;
}): Promise<number> {
  const result = await fetchDailyNewFollowers(params.accountId, params.token);
  if (!result.success || !result.data) {
    // Conta com menos de 100 seguidores não tem esse dado; não é motivo para parar os posts.
    logger.warn(`${TAG} Novos seguidores por dia indisponíveis para ${params.userId}: ${result.error ?? 'sem dados'}`);
    return 0;
  }
  if (params.dryRun || !result.data.length) return result.data.length;
  const fetchedAt = new Date();
  await InstagramNewFollowersDayModel.bulkWrite(result.data.map((day) => ({
    updateOne: {
      filter: { user: params.userId, instagramAccountId: params.accountId, date: instagramDayFromEndTime(day.endTime) },
      update: { $set: { endTime: day.endTime, newFollowers: day.newFollowers, fetchedAt } },
      upsert: true,
    },
  })));
  return result.data.length;
}

/**
 * Um passo do histórico. Sem `after`, é o começo: marca a conta e puxa os
 * seguidores; com `after`, continua a paginação de onde o passo anterior parou.
 */
export async function runInstagramHistoryBackfillStep(params: {
  userId: string;
  after?: string | null;
  dryRun?: boolean;
  now?: Date;
}): Promise<HistoryBackfillStepResult> {
  const dryRun = Boolean(params.dryRun);
  const now = params.now ?? new Date();
  const startedAt = Date.now();
  const counters = { pagesRead: 0, postsSaved: 0, postsWithoutInsights: 0, postsFailed: 0, followerDaysSaved: 0 };
  const finish = (step: HistoryBackfillStep): HistoryBackfillStepResult => ({ ...step, ...counters });

  await connectToDatabase();
  const userId = new Types.ObjectId(params.userId);
  const user = await DbUser.findById(userId)
    .select('isInstagramConnected instagramAccountId instagramAccessToken')
    .lean<{ isInstagramConnected?: boolean; instagramAccountId?: string | null; instagramAccessToken?: string | null } | null>();
  if (!user?.isInstagramConnected || !user.instagramAccountId || !user.instagramAccessToken) {
    return finish({ status: 'skipped', reason: 'instagram_not_connected' });
  }
  const accountId = user.instagramAccountId;
  const token = user.instagramAccessToken;

  if (!params.after) {
    if (!dryRun) {
      await DbUser.updateOne({ _id: userId }, { $set: { instagramHistoryBackfill: {
        instagramAccountId: accountId, status: 'running', startedAt: now, finishedAt: null,
        postsSaved: 0, pagesRead: 0, followerDaysSaved: 0, lastError: null,
      } } });
    }
    counters.followerDaysSaved = await saveNewFollowersHistory({ userId, accountId, token, dryRun });
  }

  // Tudo que é mais novo que isto é da sincronização periódica, com leitura de IA.
  const regularWindowStart = new Date(now.getTime() - INSIGHT_FETCH_CUTOFF_DAYS * 86_400_000);
  const historyStart = new Date(now.getTime() - HISTORY_MAX_AGE_DAYS * 86_400_000);
  const limitInsights = pLimit(INSIGHTS_CONCURRENCY_LIMIT);
  let after: string | null = params.after ?? null;
  let step: HistoryBackfillStep | null = null;

  while (!step) {
    const page = await fetchInstagramMedia(accountId, token, undefined, after ? { after } : {});
    if (!page.success) {
      const error = page.error ?? 'Falha ao listar mídias.';
      step = isInstagramRateLimitError(error)
        ? { status: 'rate_limited', after }
        : { status: 'failed', error };
      break;
    }
    counters.pagesRead += 1;
    // A sincronização periódica só lê as `MAX_PAGES_MEDIA` primeiras páginas. Quem posta
    // muito tem posts dos últimos 180 dias além delas, que ela nunca alcança: esses
    // também são do histórico (continuação de passo é sempre além do alcance).
    const beyondRegularReach = Boolean(params.after) || counters.pagesRead > MAX_PAGES_MEDIA;

    const oldMedia = (page.data ?? []).filter((media) => {
      if (!media.id || !media.timestamp || (media as { parent_id?: string }).parent_id) return false;
      const postDate = new Date(media.timestamp);
      return Number.isFinite(postDate.getTime())
        && postDate >= historyStart
        && (postDate < regularWindowStart || beyondRegularReach);
    });
    // A API lista do mais novo para o mais velho: página que já passou do limite encerra.
    const reachedHistoryLimit = (page.data ?? []).some((media) =>
      media.timestamp && new Date(media.timestamp) < historyStart);

    // Post antigo que já tem número (de quando era recente) não gasta chamada de
    // novo — a não ser vídeo sem duração, que fica sem retenção.
    const existing = oldMedia.length
      ? await MetricModel.find({ user: userId, instagramMediaId: { $in: oldMedia.map((media) => media.id) } })
        .select('instagramMediaId type stats.reach stats.video_duration_seconds')
        .lean<Array<{ instagramMediaId?: string; type?: string; stats?: { reach?: unknown; video_duration_seconds?: unknown } }>>()
      : [];
    const alreadyMeasured = new Set(existing
      .filter((metric) => typeof metric.stats?.reach === 'number')
      .filter((metric) => !['REEL', 'VIDEO'].includes(String(metric.type)) || typeof metric.stats?.video_duration_seconds === 'number')
      .map((metric) => String(metric.instagramMediaId)));
    const pending = oldMedia.filter((media) => !alreadyMeasured.has(media.id));

    const stop: { rateLimited: boolean; tokenInvalid: string | null } = { rateLimited: false, tokenInvalid: null };
    await Promise.all(pending.map((media) => limitInsights(async () => {
      if (stop.rateLimited || stop.tokenInvalid) return;
      const metrics = insightMetricsForMedia(media);
      let insights = metrics ? await fetchMediaInsights(media.id, token, metrics) : null;
      const accepted = metrics && insights && !insights.success ? metricsLeftAfterRejection(insights.error, metrics) : null;
      if (accepted) insights = await fetchMediaInsights(media.id, token, accepted);
      if (insights && !insights.success) {
        if (isInstagramRateLimitError(insights.error)) { stop.rateLimited = true; return; }
        if (isTokenInvalidError(undefined, undefined, insights.error ?? undefined)) { stop.tokenInvalid = insights.error ?? 'token'; return; }
      }
      const stats: IMetricStats = insights?.success && insights.data
        ? { ...insights.data, ...calcFormulas([insights.data as Record<string, unknown>], media.media_type) } as IMetricStats
        : {} as IMetricStats;
      if (!dryRun) {
        try {
          await saveMetricData(userId, await withVideoDuration(media), stats, { skipAiReadings: true, skipMediaUrls: true });
        } catch (error) {
          // Um post recusado pelo banco não pode travar a conta inteira: antes, o erro
          // derrubava o passo e a fila repetia o mesmo passo até desistir.
          logger.warn(`${TAG} Post ${media.id} de ${params.userId} não gravado: ${error instanceof Error ? error.message : error}`);
          counters.postsFailed += 1;
          return;
        }
      }
      if (!insights?.success) counters.postsWithoutInsights += 1;
      counters.postsSaved += 1;
    })));

    if (stop.tokenInvalid) { step = { status: 'failed', error: `Token recusado pelo Instagram: ${stop.tokenInvalid}` }; break; }
    // A página volta inteira na próxima tentativa; o que já foi gravado é pulado.
    if (stop.rateLimited) { step = { status: 'rate_limited', after }; break; }

    const next = afterCursorFromNextPageUrl(page.nextPageUrl);
    if (!next || reachedHistoryLimit) { step = { status: 'done' }; break; }
    after = next;
    if (counters.pagesRead >= PAGES_PER_STEP || Date.now() - startedAt > TIME_BUDGET_MS) {
      step = { status: 'continue', after };
    }
  }

  const outcome: HistoryBackfillStep = step ?? { status: 'failed', error: 'loop_sem_resultado' };
  if (!dryRun) {
    const terminal = outcome.status === 'done' || outcome.status === 'failed';
    await DbUser.updateOne({ _id: userId }, {
      $inc: {
        'instagramHistoryBackfill.postsSaved': counters.postsSaved,
        'instagramHistoryBackfill.pagesRead': counters.pagesRead,
        'instagramHistoryBackfill.followerDaysSaved': counters.followerDaysSaved,
      },
      $set: {
        ...(terminal ? { 'instagramHistoryBackfill.status': outcome.status, 'instagramHistoryBackfill.finishedAt': new Date() } : {}),
        'instagramHistoryBackfill.lastError': outcome.status === 'failed' ? outcome.error.slice(0, 500) : null,
      },
    });
  }

  logger.info(`${TAG} User ${params.userId}: ${outcome.status}, ${counters.pagesRead} páginas, ${counters.postsSaved} posts antigos gravados (${counters.postsWithoutInsights} sem números, ${counters.postsFailed} recusados), ${counters.followerDaysSaved} dias de seguidores.`);
  return finish(outcome);
}
