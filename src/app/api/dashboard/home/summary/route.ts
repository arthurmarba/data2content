import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { Types } from "mongoose";
import PlannerPlanModel from "@/app/models/PlannerPlan";
import MetricModel from "@/app/models/Metric";
import UserModel from "@/app/models/User";
import AudienceDemographicSnapshotModel from "@/app/models/demographics/AudienceDemographicSnapshot";
import { recommendWeeklySlots } from "@/app/lib/planner/recommender";
import { PLANNER_TIMEZONE } from "@/app/lib/planner/constants";
import getBlockSampleCaptions from "@/utils/getBlockSampleCaptions";
import { getCategoryById } from "@/app/lib/classification";
import { formatCompactNumber } from "@/app/landing/utils/format";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getUpcomingMentorshipEvent } from "@/app/lib/community/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PeriodKey = "7d" | "30d" | "90d";
const PERIOD_TO_DAYS: Record<PeriodKey, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};
const COMMUNITY_CACHE_TTL_MS = Math.max(
  30_000,
  Number(process.env.DASHBOARD_HOME_COMMUNITY_TTL_MS ?? 120_000)
);
const communityTotalsCache = new Map<
  PeriodKey,
  { expires: number; data: { current: any; previous: any } }
>();

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function respondError(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour || "0"),
    Number(map.minute || "0"),
    Number(map.second || "0")
  );
  return asUTC - date.getTime();
}

function normalizeToMondayInTZ(d: Date, timeZone: string): Date {
  const zoned = new Date(d.getTime() + getTimeZoneOffsetMs(d, timeZone));
  const dow = zoned.getUTCDay(); // 0..6
  const shift = dow === 0 ? -6 : 1 - dow;
  const mondayLocal = new Date(
    Date.UTC(zoned.getUTCFullYear(), zoned.getUTCMonth(), zoned.getUTCDate() + shift, 0, 0, 0, 0)
  );
  return new Date(mondayLocal.getTime() - getTimeZoneOffsetMs(mondayLocal, timeZone));
}

function formatSlotLabel(dateUtc: Date) {
  const weekday = WEEKDAY_LABELS[dateUtc.getDay()];
  const options: Intl.DateTimeFormatOptions = {
    timeZone: PLANNER_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  const formatted = new Intl.DateTimeFormat("pt-BR", options).format(dateUtc).replace(":00", "h");
  return `${weekday} • ${formatted} (BRT)`;
}

function toPercentDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  if (!Number.isFinite(delta)) return null;
  return Math.round(delta);
}

function firstSentence(text: string | undefined | null, maxLength = 140): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const sentence = trimmed.split(/[\r\n]+/)[0]?.split(/(?<=[.!?])\s+/)[0] ?? trimmed;
  if (sentence.length > maxLength) {
    return `${sentence.slice(0, maxLength - 1).trim()}…`;
  }
  return sentence;
}

async function computeNextPostCard(userId: string, periodDays = 90) {
  const uid = new Types.ObjectId(userId);
  const now = new Date();
  const currentWeekStart = normalizeToMondayInTZ(now, PLANNER_TIMEZONE);
  const nextWeekStart = new Date(currentWeekStart);
  nextWeekStart.setUTCDate(nextWeekStart.getUTCDate() + 7);

  const plans = await PlannerPlanModel.find({
    userId: uid,
    weekStart: { $in: [currentWeekStart, nextWeekStart] },
  })
    .lean()
    .exec();

  const enrichedSlots = plans.flatMap((plan) =>
    (plan.slots || []).map((slot) => {
      const date = new Date(plan.weekStart);
      date.setUTCDate(date.getUTCDate() + (slot.dayOfWeek - 1));
      date.setUTCHours(slot.blockStartHour, 0, 0, 0);
      return { slot, slotDate: date };
    })
  );

  const futureSlots = enrichedSlots
    .filter((item) => item.slotDate.getTime() >= now.getTime())
    .sort((a, b) => a.slotDate.getTime() - b.slotDate.getTime());

  const selected = futureSlots[0] ?? null;

  const recommendations = await recommendWeeklySlots({
    userId,
    periodDays,
  }).catch(() => []);

  const matchedRecommendation = selected
    ? recommendations.find(
        (rec) =>
          rec.dayOfWeek === selected.slot.dayOfWeek &&
          rec.blockStartHour === selected.slot.blockStartHour &&
          rec.format === selected.slot.format
      )
    : recommendations[0];

  const slot = selected?.slot ?? null;
  const slotDate = selected?.slotDate ?? null;

  let hooks: string[] = [];
  if (slot) {
    const proposalId = slot.categories?.proposal?.[0];
    const contextId = slot.categories?.context?.[0];
    const referenceId = slot.categories?.reference?.[0];
    const formatId = slot.format;

    const samples = await getBlockSampleCaptions(
      userId,
      periodDays,
      slot.dayOfWeek,
      slot.blockStartHour,
      {
        formatId,
        proposalId,
        contextId,
        referenceId,
      },
      4
    ).catch(() => []);

    hooks = samples.map((caption) => firstSentence(caption, 140)).filter(Boolean) as string[];
  } else if (matchedRecommendation) {
    const proposalId = matchedRecommendation.categories.proposal?.[0];
    const contextId = matchedRecommendation.categories.context?.[0];

    const proposalLabel = proposalId ? getCategoryById(proposalId, "proposal")?.label : null;
    const contextLabel = contextId ? getCategoryById(contextId, "context")?.label : null;

    hooks = [proposalLabel, contextLabel].filter(Boolean) as string[];
  }

  const primaryHook =
    firstSentence(slot?.title, 120) ??
    firstSentence(slot?.scriptShort, 140) ??
    hooks.shift() ??
    null;

  const liftPercent = matchedRecommendation
    ? Math.round((matchedRecommendation.score - 1) * 100)
    : null;

  const slotLabel = slotDate ? formatSlotLabel(slotDate) : null;

  return {
    slotLabel: slotLabel ?? "Próximo slot em breve",
    slotDateIso: slotDate?.toISOString() ?? null,
    primaryHook,
    secondaryHooks: hooks.slice(0, 3),
    expectedLiftPercent: liftPercent,
    plannerUrl: "/dashboard/planning",
    plannerSlotId: slot?.slotId ?? null,
    isInstagramConnected: true,
  };
}

function createDayFormatter() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PLANNER_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

async function computeConsistencyCard(userId: string) {
  const uid = new Types.ObjectId(userId);
  const now = new Date();
  const startWindow = new Date(now);
  startWindow.setUTCDate(startWindow.getUTCDate() - 30);

  const metrics = await MetricModel.find({
    user: uid,
    postDate: { $gte: startWindow, $lte: now },
  })
    .select({ postDate: 1, "stats.total_interactions": 1 })
    .lean()
    .exec();

  if (!metrics.length) {
    return null;
  }

  const formatDay = createDayFormatter();
  const postsByDay = new Map<string, number>();

  for (const metric of metrics) {
    const dayKey = formatDay.format(metric.postDate as Date);
    postsByDay.set(dayKey, (postsByDay.get(dayKey) ?? 0) + 1);
  }

  const countPosts = (days: number) => {
    let total = 0;
    for (let offset = 0; offset < days; offset++) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - offset);
      const key = formatDay.format(d);
      total += postsByDay.get(key) ?? 0;
    }
    return total;
  };

  const postsLast7 = countPosts(7);
  const postsLast14 = countPosts(14);
  const postsLast28 = countPosts(28);

  let streak = 0;
  for (let offset = 0; offset < 30; offset++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - offset);
    const key = formatDay.format(d);
    if ((postsByDay.get(key) ?? 0) > 0) streak += 1;
    else break;
  }

  const weeklyGoal = 4;
  const projected = Math.round((postsLast28 / 28) * 7);
  const overpostingWarning = postsLast7 >= weeklyGoal + 2 || [...postsByDay.values()].some((count) => count >= 3);

  return {
    streakDays: streak,
    weeklyGoal,
    postsSoFar: postsLast7,
    projectedPosts: projected,
    overpostingWarning,
    plannerUrl: "/dashboard/planning",
    hotSlotsUrl: "/dashboard/planning?view=heatmap",
  };
}

function getTimezoneName(date: Date, timeZone: string) {
  try {
    const part = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
    })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

function formatMentorshipLabel(date: Date, timeZone: string) {
  const offset = getTimeZoneOffsetMs(date, timeZone);
  const local = new Date(date.getTime() + offset);
  const weekday = WEEKDAY_LABELS[local.getUTCDay()] ?? "Seg";

  const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const formattedTime = timeFormatter.format(date);
  const [hours, minutes] = formattedTime.split(":");
  const timeLabel = minutes === "00" ? `${hours}h` : `${hours}h${minutes}`;
  const tzName = getTimezoneName(date, timeZone);

  return tzName ? `${weekday} • ${timeLabel} (${tzName})` : `${weekday} • ${timeLabel}`;
}

function escapeICSText(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildMentorshipCalendarLink(event: {
  title: string;
  description?: string | null;
  startAt: Date;
  endAt?: Date | null;
  timezone: string;
  location?: string | null;
  joinUrl?: string | null;
}) {
  try {
    const start = new Date(event.startAt);
    const end = event.endAt ? new Date(event.endAt) : new Date(start.getTime() + 60 * 60 * 1000);
    const formatDate = (d: Date) =>
      d
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");
    const dtStamp = formatDate(new Date());
    const dtStart = formatDate(start);
    const dtEnd = formatDate(end);
    const summary = escapeICSText(event.title || "Mentoria Data2Content");
    const descriptionParts: string[] = [];
    if (event.description) descriptionParts.push(event.description);
    if (event.joinUrl) descriptionParts.push(`Link: ${event.joinUrl}`);
    const description =
      descriptionParts.length > 0
        ? escapeICSText(descriptionParts.join("\n"))
        : "Traga dúvidas recentes e receba orientações ao vivo com o time Data2Content.";
    const location = event.location ? escapeICSText(event.location) : "Online";

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Data2Content//Mentoria//PT",
      "BEGIN:VEVENT",
      `UID:mentoria-${dtStart}@data2content.ai`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    const payload = lines.join("\r\n");
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(payload)}`;
  } catch (error) {
    logger.warn("[home.summary] Failed to build mentorship ICS link", error);
    return null;
  }
}

function computeNextMentorshipSlot(baseDate: Date) {
  const targetWeekday = 1; // Monday
  const reference = new Date(baseDate.getTime());
  const currentDay = reference.getDay();
  let delta = (targetWeekday - currentDay + 7) % 7;
  if (delta === 0 && reference.getHours() >= 19) {
    delta = 7;
  }

  const next = new Date(reference.getTime());
  next.setDate(reference.getDate() + delta);
  next.setHours(19, 0, 0, 0);
  const label = formatMentorshipLabel(next, "America/Sao_Paulo");

  return {
    isoDate: next.toISOString(),
    display: label,
  };
}

async function computeMediaKitCard(userId: string, appBaseUrl: string | null) {
  const user = await UserModel.findById(userId)
    .select({
      mediaKitToken: 1,
      mediaKitSlug: 1,
    })
    .lean()
    .exec();

  const token = user?.mediaKitToken ?? null;
  const slug = user?.mediaKitSlug ?? null;
  const hasMediaKit = Boolean(token || slug);

  const sharePath = token ? `/mediakit/${token}` : slug ? `/mediakit/${slug}` : null;
  const shareUrl = sharePath && appBaseUrl ? `${appBaseUrl}${sharePath}` : null;

  const now = new Date();
  const start30 = new Date(now);
  start30.setUTCDate(start30.getUTCDate() - 30);

  const metrics = await MetricModel.find({
    user: new Types.ObjectId(userId),
    postDate: { $gte: start30, $lte: now },
  })
    .select({ postDate: 1, description: 1, "stats.views": 1, "stats.reach": 1, "stats.total_interactions": 1, "stats.engagement_rate_on_reach": 1 })
    .sort({ "stats.views": -1 })
    .limit(50)
    .lean()
    .exec();

  const topPost = metrics[0];
  const avgEngagementRates = metrics
    .map((m) => Number((m as any)?.stats?.engagement_rate_on_reach ?? (m as any)?.stats?.engagement_rate))
    .filter((v) => Number.isFinite(v) && v > 0);

  const erAverage = avgEngagementRates.length
    ? (avgEngagementRates.reduce((sum, value) => sum + value, 0) / avgEngagementRates.length) * 100
    : null;

  const engagementLabel = erAverage !== null ? `${erAverage.toFixed(1)}%` : null;

  const demographics = await AudienceDemographicSnapshotModel.findOne({
    user: new Types.ObjectId(userId),
  })
    .sort({ recordedAt: -1 })
    .lean()
    .exec();

  let topCities: string[] = [];
  if (demographics?.demographics?.follower_demographics?.city) {
    const entries = Object.entries(demographics.demographics.follower_demographics.city)
      .map(([value, count]) => ({ value, count: Number(count) || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    topCities = entries.map((entry) => entry.value);
  }

  const highlights: Array<{ label: string; value: string }> = [];
  if (topPost?.stats?.views) {
    highlights.push({
      label: "Top post",
      value: `${formatCompactNumber(topPost.stats.views)} views`,
    });
  }
  if (engagementLabel) {
    highlights.push({
      label: "ER 30 dias",
      value: engagementLabel,
    });
  }
  if (topCities.length) {
    highlights.push({
      label: "Cidades top",
      value: topCities.join(", "),
    });
  }

  const lastUpdated = metrics[0]?.postDate ?? null;
  const lastUpdatedLabel = lastUpdated
    ? formatDistanceToNow(lastUpdated, { addSuffix: true, locale: ptBR })
    : null;

  return {
    shareUrl,
    highlights,
    lastUpdatedLabel,
    hasMediaKit,
  };
}

async function aggregateCommunity(periodKey: PeriodKey) {
  const cached = communityTotalsCache.get(periodKey);
  const nowTs = Date.now();
  if (cached && cached.expires > nowTs) {
    return cached.data;
  }

  const periodDays = PERIOD_TO_DAYS[periodKey];
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setUTCDate(currentStart.getUTCDate() - periodDays + 1);
  currentStart.setUTCHours(0, 0, 0, 0);

  const previousStart = new Date(currentStart);
  previousStart.setUTCDate(previousStart.getUTCDate() - periodDays);

  const currentRange = await MetricModel.aggregate([
    {
      $match: {
        postDate: { $gte: currentStart, $lte: now },
      },
    },
    {
      $group: {
        _id: null,
        postCount: { $sum: 1 },
        totalViews: { $sum: { $ifNull: ["$stats.views", 0] } },
        totalReach: { $sum: { $ifNull: ["$stats.reach", 0] } },
        totalInteractions: { $sum: { $ifNull: ["$stats.total_interactions", 0] } },
        creatorIds: { $addToSet: "$user" },
      },
    },
    {
      $project: {
        _id: 0,
        postCount: 1,
        totalViews: 1,
        totalReach: 1,
        totalInteractions: 1,
        creators: { $size: "$creatorIds" },
      },
    },
  ]).exec();

  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousRange = await MetricModel.aggregate([
    {
      $match: {
        postDate: { $gte: previousStart, $lte: previousEnd },
      },
    },
    {
      $group: {
        _id: null,
        postCount: { $sum: 1 },
        totalViews: { $sum: { $ifNull: ["$stats.views", 0] } },
        totalReach: { $sum: { $ifNull: ["$stats.reach", 0] } },
        totalInteractions: { $sum: { $ifNull: ["$stats.total_interactions", 0] } },
        creatorIds: { $addToSet: "$user" },
      },
    },
    {
      $project: {
        _id: 0,
        postCount: 1,
        totalViews: 1,
        totalReach: 1,
        totalInteractions: 1,
        creators: { $size: "$creatorIds" },
      },
    },
  ]).exec();

  const currentTotals = currentRange[0] ?? {
    postCount: 0,
    totalViews: 0,
    totalReach: 0,
    totalInteractions: 0,
    creators: 0,
  };

  const previousTotals = previousRange[0] ?? {
    postCount: 0,
    totalViews: 0,
    totalReach: 0,
    totalInteractions: 0,
    creators: 0,
  };

  const data = {
    current: currentTotals,
    previous: previousTotals,
  };
  communityTotalsCache.set(periodKey, {
    expires: nowTs + COMMUNITY_CACHE_TTL_MS,
    data,
  });
  return data;
}

function buildCommunityMetrics(period: PeriodKey, current: any, previous: any) {
  const metrics = [
    {
      id: "creators",
      label: "Creators ativos",
      value: formatCompactNumber(current.creators),
      deltaPercent: toPercentDelta(current.creators, previous.creators),
    },
    {
      id: "posts",
      label: "Posts analisados",
      value: formatCompactNumber(current.postCount),
      deltaPercent: toPercentDelta(current.postCount, previous.postCount),
    },
    {
      id: "views",
      label: "Visualizações geradas",
      value: formatCompactNumber(current.totalViews),
      deltaPercent: toPercentDelta(current.totalViews, previous.totalViews),
    },
    {
      id: "interactions",
      label: "Interações totais",
      value: formatCompactNumber(current.totalInteractions),
      deltaPercent: toPercentDelta(current.totalInteractions, previous.totalInteractions),
    },
    {
      id: "reach",
      label: "Alcance somado",
      value: formatCompactNumber(current.totalReach),
      deltaPercent: toPercentDelta(current.totalReach, previous.totalReach),
    },
  ];

  return {
    period,
    metrics: metrics.map((metric) => ({
      ...metric,
      periodLabel: `últimos ${PERIOD_TO_DAYS[period]} dias`,
    })),
  };
}

export async function GET(request: Request) {
  const session = (await getServerSession(authOptions)) as Session | null;
  if (!session?.user?.id) {
    return respondError("Unauthorized", 401);
  }

  const userId = session.user.id as string;
  const searchParams = new URL(request.url).searchParams;
  const scope = searchParams.get("scope") ?? "all";
  const periodParam = (searchParams.get("period") as PeriodKey | null) ?? "30d";
  const period = PERIOD_TO_DAYS[periodParam] ? periodParam : "30d";

  try {
    await connectToDatabase();
  } catch (error) {
    logger.error("[home.summary] Failed to connect to database", error);
    return respondError("Erro ao conectar no banco de dados.");
  }

  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.APP_BASE_URL ||
    null;

  const responsePayload: Record<string, unknown> = {};

  if (scope === "all") {
    try {
      const instagramConnected = Boolean((session.user as any)?.instagramConnected);
      responsePayload.nextPost = instagramConnected ? await computeNextPostCard(userId) : { isInstagramConnected: false };
    } catch (error) {
      logger.error("[home.summary] Failed to compute next post card", error);
      responsePayload.nextPost = { isInstagramConnected: Boolean((session.user as any)?.instagramConnected) };
    }

    try {
      responsePayload.consistency = await computeConsistencyCard(userId);
    } catch (error) {
      logger.error("[home.summary] Failed to compute consistency card", error);
      responsePayload.consistency = null;
    }

    try {
      const user = await UserModel.findById(userId)
        .select({ communityInspirationOptIn: 1, whatsappVerified: 1 })
        .lean()
        .exec();

      const isMember = Boolean(user?.communityInspirationOptIn || user?.whatsappVerified);
      const mentorshipEvent = await getUpcomingMentorshipEvent().catch(() => null);
      const fallbackSlot = computeNextMentorshipSlot(new Date());

      const selectedStart =
        mentorshipEvent && !mentorshipEvent.isFallback
          ? mentorshipEvent.startAt
          : new Date(fallbackSlot.isoDate);
      const selectedTimezone =
        mentorshipEvent?.timezone && mentorshipEvent.timezone.length
          ? mentorshipEvent.timezone
          : "America/Sao_Paulo";
      const label = formatMentorshipLabel(selectedStart, selectedTimezone);

      const calendarUrl = buildMentorshipCalendarLink({
        title: mentorshipEvent?.title ?? "Mentoria semanal Data2Content",
        description:
          mentorshipEvent?.description ??
          "Traga dúvidas recentes e receba orientações ao vivo com o time Data2Content.",
        startAt: selectedStart,
        endAt: mentorshipEvent?.endAt ?? null,
        timezone: selectedTimezone,
        location: mentorshipEvent?.location ?? null,
        joinUrl: mentorshipEvent?.joinUrl ?? null,
      });

      responsePayload.mentorship = {
        nextSessionLabel: label,
        topic: mentorshipEvent?.title ?? "Mentoria semanal Data2Content",
        description: mentorshipEvent?.description ?? undefined,
        joinCommunityUrl: mentorshipEvent?.joinUrl ?? "/dashboard/whatsapp",
        calendarUrl,
        whatsappReminderUrl: mentorshipEvent?.reminderUrl ?? "/dashboard/whatsapp",
        isMember,
      };
    } catch (error) {
      logger.error("[home.summary] Failed to compute mentorship card", error);
      responsePayload.mentorship = null;
    }

    try {
      responsePayload.mediaKit = await computeMediaKitCard(userId, appBaseUrl);
    } catch (error) {
      logger.error("[home.summary] Failed to compute media kit card", error);
      responsePayload.mediaKit = {
        hasMediaKit: false,
        highlights: [],
      };
    }
  }

  try {
    const communityTotals = await aggregateCommunity(period);
    responsePayload.communityMetrics = buildCommunityMetrics(period, communityTotals.current, communityTotals.previous);
  } catch (error) {
    logger.error("[home.summary] Failed to compute community metrics", error);
    responsePayload.communityMetrics = {
      period,
      metrics: [],
    };
  }

  return NextResponse.json({
    ok: true,
    data: responsePayload,
  });
}
