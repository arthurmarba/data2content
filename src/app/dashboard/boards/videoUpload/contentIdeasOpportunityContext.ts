import { aggregateUserTimePerformance, type TimeBucket } from "@/utils/aggregateUserTimePerformance";
import { buildCreatorEngagementBaseline } from "./creatorEngagementBaselineService";
import type {
  ContentIdeasCreativeSignals,
  ContentIdeasOpportunityContext,
  ContentIdeaTimingRecommendation,
} from "./contentIdeaOpportunity";

const DAY_LABELS: Record<number, string> = {
  1: "Domingo",
  2: "Segunda-feira",
  3: "Terça-feira",
  4: "Quarta-feira",
  5: "Quinta-feira",
  6: "Sexta-feira",
  7: "Sábado",
};

function dayPeriod(hour: number): string {
  if (hour < 6) return "de madrugada";
  if (hour < 12) return "de manhã";
  if (hour < 18) return "à tarde";
  return "à noite";
}

function formatHour(hour: number): string {
  return `${String(Math.max(0, Math.min(23, hour))).padStart(2, "0")}h`;
}

function chooseTiming(buckets: TimeBucket[]): ContentIdeaTimingRecommendation | null {
  const usable = buckets.filter((bucket) => bucket.count > 0 && Number.isFinite(bucket.average));
  const totalPosts = usable.reduce((sum, bucket) => sum + bucket.count, 0);
  if (totalPosts < 6) return null;

  const bestExact = usable
    .filter((bucket) => bucket.count >= 3)
    .sort((a, b) => b.average - a.average || b.count - a.count)[0];
  if (totalPosts >= 10 && bestExact) {
    const day = DAY_LABELS[bestExact.dayOfWeek];
    if (!day) return null;
    const endHour = (bestExact.hour + 2) % 24;
    const windowLabel = `entre ${formatHour(bestExact.hour)} e ${formatHour(endHour)}`;
    return {
      dayLabel: day,
      windowLabel,
      shortLabel: `${day.replace("-feira", "")}, ${formatHour(bestExact.hour)}–${formatHour(endHour)}`,
      confidence: "high",
      reason: "Seus posts costumam receber mais respostas nesse período.",
      sampleSize: totalPosts,
    };
  }

  const byDay = new Map<number, { total: number; count: number; bestHour: number }>();
  for (const bucket of usable) {
    const current = byDay.get(bucket.dayOfWeek) ?? { total: 0, count: 0, bestHour: bucket.hour };
    current.total += bucket.average * bucket.count;
    current.count += bucket.count;
    if (bucket.average > (usable.find((item) => item.dayOfWeek === bucket.dayOfWeek && item.hour === current.bestHour)?.average ?? -1)) {
      current.bestHour = bucket.hour;
    }
    byDay.set(bucket.dayOfWeek, current);
  }
  const bestDay = [...byDay.entries()]
    .filter(([, value]) => value.count >= 2)
    .map(([dayOfWeek, value]) => ({ dayOfWeek, ...value, average: value.total / value.count }))
    .sort((a, b) => b.average - a.average || b.count - a.count)[0];
  if (!bestDay) return null;
  const day = DAY_LABELS[bestDay.dayOfWeek];
  if (!day) return null;
  const period = dayPeriod(bestDay.bestHour);
  return {
    dayLabel: day,
    windowLabel: period,
    shortLabel: `${day.replace("-feira", "")} ${period}`,
    confidence: "medium",
    reason: "Esse dia teve bons resultados nos seus posts recentes.",
    sampleSize: totalPosts,
  };
}

export async function buildContentIdeasOpportunityContext(
  userId: string,
): Promise<ContentIdeasOpportunityContext> {
  const [baseline, timePerformance] = await Promise.all([
    buildCreatorEngagementBaseline(userId).catch(() => null),
    aggregateUserTimePerformance(userId, 180, "stats.total_interactions").catch(() => null),
  ]);

  const creativeSignals: ContentIdeasCreativeSignals | null = baseline && baseline.postsAnalyzed > 0
    ? {
        postsAnalyzed: baseline.postsAnalyzed,
        windowDays: baseline.windowDays,
        confidence: baseline.confidence,
        subject: baseline.patterns.subject?.label ?? null,
        place: baseline.patterns.place?.label ?? null,
        object: baseline.patterns.object?.label ?? null,
        framing: baseline.patterns.framing?.label ?? null,
        tone: baseline.patterns.tone?.label ?? null,
        openingLines: baseline.examples.openingLines,
        screenTitles: baseline.examples.screenTitles,
      }
    : null;

  return {
    creativeSignals,
    timing: chooseTiming(timePerformance?.buckets ?? []),
  };
}

export { chooseTiming as chooseContentIdeaTiming };
