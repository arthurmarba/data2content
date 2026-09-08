import type { CreatorWeeklyReportMetricInput } from './engine';
import type { WeekWindow } from '@/app/lib/relatorio/weekWindow';
import { classifyCreatorHookPattern, CREATOR_HOOK_PATTERN_LABELS } from '@/app/dashboard/boards/videoUpload/creatorHookEvidence';

const DAY = 86_400_000;
export const PROFILE_POLICY_VERSION = 'perfil_evidencia_v2_piloto';

export interface ReadingProgress {
  imported: number;
  classified: number;
  eligible: number;
  analyzed: number;
  pending: number;
  unsupported: number;
  openings: { eligible: number; identified: number; notIdentified: number; pending: number; notApplicable: number; unsupported: number };
}

export interface SubjectObservation {
  label: string;
  postIds: string[];
  evidence: Array<{ postId: string; postLink: string | null; publishedAt: string }>;
  lastSeenAt: string;
  firstSeenAt: string;
  recent: boolean;
}

export interface OpeningExample {
  text: string;
  postId: string;
  postLink: string | null;
  publishedAt: string;
  source: 'speech' | 'visual';
}

export interface ProfileEvolution {
  evaluatedAt: string;
  policyVersion: string;
  status: 'updated' | 'processing' | 'delayed' | 'unavailable' | 'partial' | 'empty';
  lastAnalyzedAt: string | null;
  metricsSyncedAt: string | null;
  metricsPartial: boolean;
  mapReviewedAt: string | null;
  windows: { week: ReadingProgress; recent: ReadingProgress; history: ReadingProgress };
  recentStartsAt: string;
  latestPendingPublishedAt: string | null;
  subjects: SubjectObservation[];
  allObservedSubjects: string[];
  recentOpenings: OpeningExample[];
  openingComparison?: { available: boolean; recentPosts: number; previousPosts: number; mechanisms: Array<{ label: string; recent: number; previous: number }> };
}

export interface ReadingStateInput { _id: string; state: string; reason?: string | null; nextAttemptAt?: Date | string | null }

export function metricIdentity(metric: CreatorWeeklyReportMetricInput): string {
  return String(metric._id ?? metric.instagramMediaId ?? `${metric.postDate}:${metric.postLink ?? ''}`);
}

export function uniqueMetrics(metrics: CreatorWeeklyReportMetricInput[]) {
  return [...new Map(metrics.map(metric => [metric.instagramMediaId || metricIdentity(metric), metric])).values()];
}

export function isoDate(value: unknown): string | null {
  if (!(value instanceof Date) && typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function hasScene(metric: CreatorWeeklyReportMetricInput) { return Boolean(metric.sceneElements?.version); }
export function isVideo(metric: CreatorWeeklyReportMetricInput) { return !metric.type || ['REEL', 'VIDEO'].includes(metric.type); }
export function isReadable(metric: CreatorWeeklyReportMetricInput) { return !metric.type || ['REEL', 'VIDEO', 'IMAGE', 'CAROUSEL_ALBUM'].includes(metric.type); }
const text = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
const key = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export function observedSubjects(metrics: CreatorWeeklyReportMetricInput[], now: Date): SubjectObservation[] {
  const groups = new Map<string, SubjectObservation>();
  for (const metric of uniqueMetrics(metrics)) {
    const at = isoDate(metric.postDate);
    if (!hasScene(metric) || !at) continue;
    const values = Array.isArray(metric.sceneElements?.subjects) ? metric.sceneElements.subjects : [];
    for (const label of values.map(text).filter(Boolean)) {
      const normalized = key(label);
      const current = groups.get(normalized) ?? { label, postIds: [], evidence: [], firstSeenAt: at, lastSeenAt: at, recent: false };
      if (!current.postIds.includes(metricIdentity(metric))) {
        current.postIds.push(metricIdentity(metric));
        current.evidence.push({ postId: metricIdentity(metric), postLink: metric.postLink ?? null, publishedAt: at });
      }
      if (at > current.lastSeenAt) { current.lastSeenAt = at; current.label = label; }
      if (at < current.firstSeenAt) current.firstSeenAt = at;
      groups.set(normalized, current);
    }
  }
  return [...groups.values()].map(item => ({ ...item, recent: new Date(item.firstSeenAt).getTime() >= now.getTime() - 7 * DAY }))
    .sort((a, b) => b.postIds.length - a.postIds.length || b.lastSeenAt.localeCompare(a.lastSeenAt) || a.label.localeCompare(b.label));
}

export function selectSubjectCover(all: SubjectObservation[], limit = 6): SubjectObservation[] {
  const fresh = all.filter(item => item.recent).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt)).slice(0, Math.min(2, limit));
  const freshSet = new Set(fresh.map(item => key(item.label)));
  return [...all.filter(item => !freshSet.has(key(item.label))).slice(0, limit - fresh.length), ...fresh];
}

function progress(metrics: CreatorWeeklyReportMetricInput[], states: Map<string, ReadingStateInput>): ReadingProgress {
  const readable = metrics.filter(isReadable);
  const analyzed = readable.filter(hasScene);
  const pending = readable.filter(metric => !hasScene(metric));
  const videos = readable.filter(isVideo);
  const identified = videos.filter(metric => hasScene(metric) && text(metric.sceneElements?.openingLine)).length;
  return {
    imported: metrics.length,
    classified: metrics.filter(metric => metric.classificationStatus === 'completed').length,
    eligible: readable.length,
    analyzed: analyzed.length,
    pending: pending.filter(metric => states.get(metricIdentity(metric))?.state !== 'unsupported').length,
    unsupported: pending.filter(metric => states.get(metricIdentity(metric))?.state === 'unsupported').length,
    openings: { eligible: videos.length, identified, notIdentified: videos.filter(hasScene).length - identified,
      pending: videos.filter(metric => !hasScene(metric) && states.get(metricIdentity(metric))?.state !== 'unsupported').length,
      unsupported: videos.filter(metric => !hasScene(metric) && states.get(metricIdentity(metric))?.state === 'unsupported').length,
      notApplicable: readable.length - videos.length },
  };
}

export function buildProfileEvolution(params: {
  metrics: CreatorWeeklyReportMetricInput[]; week: WeekWindow; now: Date;
  states?: ReadingStateInput[]; providerPaused?: boolean; metricsSyncedAt?: unknown;
  metricsPartial?: boolean; mapReviewedAt?: unknown;
}): ProfileEvolution {
  const { now, week } = params;
  const since = new Date(now.getTime() - 28 * DAY).toISOString();
  const metrics = uniqueMetrics(params.metrics).filter(metric => {
    const at = isoDate(metric.postDate);
    return at && at <= now.toISOString() && new Date(at).getTime() >= now.getTime() - 90 * DAY;
  });
  const states = new Map((params.states ?? []).map(state => [state._id, state]));
  const recent = metrics.filter(metric => (isoDate(metric.postDate) ?? '') >= since);
  const recentProgress = progress(recent, states);
  const pending = recent.filter(metric => isReadable(metric) && !hasScene(metric) && states.get(metricIdentity(metric))?.state !== 'unsupported');
  const overdue = pending.some(metric => {
    const imported = isoDate(metric.createdAt) ?? isoDate(metric.postDate)!;
    return now.getTime() - new Date(imported).getTime() >= DAY;
  });
  const historySubjects = new Map(observedSubjects(metrics, now).map(subject => [key(subject.label), subject]));
  const all = observedSubjects(recent, now).map(subject => ({ ...subject, recent: historySubjects.get(key(subject.label))?.recent ?? subject.recent }));
  const lastAnalyzedAt = metrics.filter(hasScene).map(metric => isoDate(metric.sceneElements?.analyzedAt)).filter((at): at is string => Boolean(at && at <= now.toISOString())).sort().at(-1) ?? null;
  const status = recentProgress.eligible === 0 ? 'empty'
    : pending.length > 0 && params.providerPaused ? 'unavailable'
    : overdue ? 'delayed' : pending.length > 0 ? 'processing'
    : recentProgress.unsupported > 0 ? 'partial' : 'updated';
  return {
    evaluatedAt: now.toISOString(), policyVersion: PROFILE_POLICY_VERSION, status, lastAnalyzedAt,
    metricsSyncedAt: isoDate(params.metricsSyncedAt), metricsPartial: params.metricsPartial === true,
    mapReviewedAt: isoDate(params.mapReviewedAt),
    windows: {
      week: progress(metrics.filter(metric => new Date(metric.postDate) >= week.startsAt && new Date(metric.postDate) <= week.endsAt), states),
      recent: recentProgress, history: progress(metrics, states),
    },
    recentStartsAt: since,
    latestPendingPublishedAt: pending.map(metric => isoDate(metric.postDate)!).sort().at(-1) ?? null,
    subjects: selectSubjectCover(all), allObservedSubjects: all.map(item => item.label),
    openingComparison: compareOpeningPeriods(metrics, now),
    recentOpenings: recent.filter(hasScene).sort((a, b) => new Date(b.postDate).getTime() - new Date(a.postDate).getTime()).flatMap(metric => {
      const source = isVideo(metric) ? 'speech' as const : 'visual' as const;
      const opening = text(source === 'speech' ? metric.sceneElements?.openingLine : metric.sceneElements?.screenTitle);
      return opening ? [{ text: opening, postId: metricIdentity(metric), postLink: metric.postLink ?? null, publishedAt: isoDate(metric.postDate)!, source }] : [];
    }).slice(0, 3),
  };
}

/** Compara frequência do mecanismo, sem atribuir crescimento de desempenho à
 * abertura. Duas janelas com leitura suficiente e o mesmo formato (fala). */
function compareOpeningPeriods(metrics: CreatorWeeklyReportMetricInput[], now: Date): NonNullable<ProfileEvolution['openingComparison']> {
  const videos = metrics.filter(isVideo);
  const recent = videos.filter(metric => new Date(metric.postDate).getTime() >= now.getTime() - 28 * DAY);
  const previous = videos.filter(metric => new Date(metric.postDate).getTime() < now.getTime() - 28 * DAY && new Date(metric.postDate).getTime() >= now.getTime() - 56 * DAY);
  const readable = (rows: CreatorWeeklyReportMetricInput[]) => rows.filter(row => hasScene(row) && text(row.sceneElements?.openingLine));
  const recentRead = readable(recent), previousRead = readable(previous);
  const available = recentRead.length >= 6 && previousRead.length >= 6 && recentRead.length >= recent.length * 0.8 && previousRead.length >= previous.length * 0.8;
  const counts = (rows: CreatorWeeklyReportMetricInput[]) => {
    const result = new Map<string, number>();
    for (const row of rows) { const pattern = classifyCreatorHookPattern(text(row.sceneElements?.openingLine)); result.set(pattern, (result.get(pattern) ?? 0) + 1); }
    return result;
  };
  const recentCounts = counts(recentRead), previousCounts = counts(previousRead);
  return { available, recentPosts: recentRead.length, previousPosts: previousRead.length, mechanisms: available ? [...recentCounts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([pattern, count]) => ({ label: CREATOR_HOOK_PATTERN_LABELS[pattern as keyof typeof CREATOR_HOOK_PATTERN_LABELS], recent: count, previous: previousCounts.get(pattern) ?? 0 })) : [] };
}

export function profileProgressMessage(evolution: ProfileEvolution): string {
  const { recent } = evolution.windows;
  if (evolution.status === 'empty') return 'Sem posts elegíveis nos últimos 28 dias. O histórico continua disponível.';
  if (evolution.status === 'unavailable') return `${recent.pending} posts aguardam análise, temporariamente indisponível. Os padrões usam as leituras anteriores.`;
  if (evolution.status === 'delayed') return `${recent.pending} posts recebidos ainda aguardam análise. A leitura está atrasada.`;
  if (evolution.status === 'processing') return `${recent.pending} posts recebidos estão aguardando análise.`;
  if (evolution.status === 'partial') return `${recent.analyzed} de ${recent.eligible} posts analisados; ${recent.unsupported} não puderam ser lidos.`;
  return `${recent.analyzed} de ${recent.eligible} posts analisados nos últimos 28 dias.`;
}
