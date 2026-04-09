"use client";

import React, { useMemo } from "react";
import { PlanningAudienceSection } from "./PlanningChartsHeavySections";
import { TopDiscoveryTable } from "./components/TopDiscoveryTable";

const numberFormatter = new Intl.NumberFormat("pt-BR");
const TARGET_TIMEZONE = "America/Sao_Paulo";
const WEEKDAY_SHORT_EN_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};
const zonedDatePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TARGET_TIMEZONE,
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

type PlanningObjectiveMode = "reach" | "engagement" | "leads";

const toNumber = (value: any): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const medianOfNumbers = (values: number[]): number => {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .slice()
    .sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const left = sorted[middle - 1] ?? 0;
    const right = sorted[middle] ?? left;
    return (left + right) / 2;
  }
  return sorted[middle] ?? 0;
};

const resolveLeadIntentProxy = (stats: any): number => {
  const profileVisits = toNumber(stats?.profile_visits) ?? 0;
  const follows = toNumber(stats?.follows) ?? 0;
  const shares = toNumber(stats?.shares) ?? 0;
  const saves = toNumber(stats?.saved) ?? toNumber(stats?.saves) ?? 0;
  const comments = toNumber(stats?.comments) ?? 0;
  const reach = toNumber(stats?.reach) ?? 0;
  const rawScore = profileVisits * 3 + follows * 8 + shares * 2 + saves * 1.5 + comments * 0.5;
  if (rawScore <= 0) return 0;
  if (reach > 0) return (rawScore / reach) * 1000;
  return rawScore;
};

const getPostStableKey = (post: any): string | null =>
  post?._id || post?.id || post?.instagramMediaId || (post?.postDate ? `${post.postDate}-${post?.caption || ""}` : null);

const getTargetDateParts = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = zonedDatePartsFormatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  const weekdayShort = get("weekday");
  const month = Number(get("month"));
  const day = Number(get("day"));
  const year = Number(get("year"));
  const hour = Number(get("hour"));
  const weekdayIndexSun0 = typeof weekdayShort === "string" ? WEEKDAY_SHORT_EN_TO_INDEX[weekdayShort] : undefined;
  if (
    weekdayIndexSun0 === undefined ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(year) ||
    !Number.isFinite(hour)
  ) {
    return null;
  }
  return {
    weekdayIndexSun0,
    year,
    month,
    day,
    hour,
  };
};

const getWeekStart = (value: string | Date) => {
  const parts = getTargetDateParts(value);
  if (!parts) return null;
  const diffToMonday = (parts.weekdayIndexSun0 + 6) % 7;
  const start = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  start.setUTCDate(start.getUTCDate() - diffToMonday);
  return start;
};

const formatDateKey = (value: Date) => {
  const yyyy = value.getUTCFullYear();
  const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(value.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getWeekKey = (value: string | Date) => {
  const start = getWeekStart(value);
  return start ? formatDateKey(start) : null;
};

const toVideoProxyUrl = (raw?: string | null) => {
  if (!raw) return raw;
  if (raw.startsWith("/api/proxy/video/")) return raw;
  if (/^https?:\/\//i.test(raw)) return `/api/proxy/video/${encodeURIComponent(raw)}`;
  return raw;
};

const buildStrategyMatrix = (normalizedPosts: any[], objectiveMode: PlanningObjectiveMode) => {
  const rows = normalizedPosts
    .map((post: any, index: number) => {
      const reach = Math.max(0, toNumber(post?.stats?.reach) ?? toNumber(post?.stats?.views) ?? 0);
      if (reach <= 0) return null;
      const interactions = Math.max(0, toNumber(post?.stats?.total_interactions) ?? 0);
      const leadIntent = resolveLeadIntentProxy(post?.stats);
      const depth =
        objectiveMode === "leads"
          ? leadIntent
          : reach > 0
            ? (interactions / reach) * 1000
            : 0;
      return {
        id: getPostStableKey(post) || `${index}`,
        label: String(post?.caption || `Post ${index + 1}`).slice(0, 36) || `Post ${index + 1}`,
        reach,
        depth,
        post,
      };
    })
    .filter(Boolean) as Array<{ id: string; label: string; reach: number; depth: number; post: any }>;

  if (rows.length < 4) {
    return {
      points: [],
      reachMedian: 0,
      depthMedian: 0,
      winnerCount: 0,
      attractsCount: 0,
      nurturesCount: 0,
      lowPriorityCount: 0,
      summary: "Base curta para montar a matriz.",
      depthLabel: objectiveMode === "leads" ? "Intenção de lead" : "Resposta por 1 mil alcançadas",
    };
  }

  const reachMedian = medianOfNumbers(rows.map((row) => row.reach));
  const depthMedian = medianOfNumbers(rows.map((row) => row.depth));
  const points = rows.map((row) => {
    const isHighReach = row.reach >= reachMedian;
    const isHighDepth = row.depth >= depthMedian;
    const quadrant = isHighReach && isHighDepth
      ? "winner"
      : isHighReach
        ? "attracts"
        : isHighDepth
          ? "nurtures"
          : "low_priority";
    const fill =
      quadrant === "winner"
        ? "#2563eb"
        : quadrant === "attracts"
          ? "#0ea5e9"
          : quadrant === "nurtures"
            ? "#10b981"
            : "#94a3b8";
    return { ...row, quadrant, fill };
  });
  const winnerCount = points.filter((point) => point.quadrant === "winner").length;
  const attractsCount = points.filter((point) => point.quadrant === "attracts").length;
  const nurturesCount = points.filter((point) => point.quadrant === "nurtures").length;
  const summary =
    winnerCount > 0
      ? `${winnerCount} post${winnerCount === 1 ? "" : "s"} equilibram alcance e resposta.`
      : attractsCount > nurturesCount
        ? "Seu conteúdo atrai mais do que aprofunda."
        : nurturesCount > 0
          ? "Há posts que respondem bem, mas com pouco alcance."
          : "Ainda não há padrão forte entre alcance e resposta.";

  return {
    points,
    reachMedian,
    depthMedian,
    winnerCount,
    attractsCount,
    nurturesCount,
    lowPriorityCount: points.length - winnerCount - attractsCount - nurturesCount,
    summary,
    depthLabel: objectiveMode === "leads" ? "Intenção de lead" : "Resposta por 1 mil alcançadas",
  };
};

export default function PlanningChartsAudienceTabSection(props: any) {
  const strategyMatrix = useMemo(
    () => buildStrategyMatrix(Array.isArray(props.normalizedPosts) ? props.normalizedPosts : [], props.objectiveMode),
    [props.normalizedPosts, props.objectiveMode]
  );

  const mobileStrategyHighlights = useMemo(() => {
    const quadrantLabel: Record<string, string> = {
      winner: "Equilíbrio forte",
      attracts: "Puxa alcance",
      nurtures: "Puxa resposta",
      low_priority: "Prioridade baixa",
    };
    return [...strategyMatrix.points]
      .sort((a: any, b: any) => {
        const scoreA =
          (a.quadrant === "winner" ? 3 : a.quadrant === "nurtures" ? 2 : a.quadrant === "attracts" ? 1 : 0) *
            100000 +
          a.depth;
        const scoreB =
          (b.quadrant === "winner" ? 3 : b.quadrant === "nurtures" ? 2 : b.quadrant === "attracts" ? 1 : 0) *
            100000 +
          b.depth;
        return scoreB - scoreA;
      })
      .slice(0, 3)
      .map((point: any) => ({
        id: point.id,
        label: point.label,
        value: point.depth,
        helper: `${quadrantLabel[point.quadrant] || "Leitura"} • ${numberFormatter.format(Math.round(point.reach))} de alcance`,
        post: point.post,
      }));
  }, [strategyMatrix.points]);

  const topDiscovery = useMemo(() => {
    if (!props.showAdvancedSections) return [];
    const posts = Array.isArray(props.normalizedPosts) ? props.normalizedPosts : [];
    const normalizeCategories = (value: any): string[] =>
      Array.isArray(value) ? value.filter(Boolean).map((entry) => String(entry)) : value ? [String(value)] : [];

    return posts
      .map((post: any) => {
        const nf = (() => {
          const direct = toNumber(post?.stats?.reach_non_followers_ratio);
          if (direct !== null) return direct;
          const pv = toNumber(post?.stats?.profile_visits);
          const reach = toNumber(post?.stats?.reach);
          if (pv === null) return 0;
          const base = reach && reach > 0 ? reach : pv;
          return base > 0 ? Math.min(Math.max(pv / base, 0), 1) : null;
        })();
        const pv = toNumber(post?.stats?.profile_visits);
        const reach = toNumber(post?.stats?.reach);
        if (nf === null && pv === null) return null;
        const format = normalizeCategories(post?.format);
        const mediaType = String(post?.type || "").toUpperCase();
        const isVideo =
          mediaType === "VIDEO" ||
          mediaType === "REEL" ||
          format.some((entry) => /reel|video/i.test(entry));
        const rawMediaUrl = post?.mediaUrl || post?.media_url || null;
        return {
          id: post._id,
          caption: post.caption || "Post",
          date: post.postDate,
          metaLabel: post?.metaLabel || "",
          proposal: normalizeCategories(post?.proposal),
          context: normalizeCategories(post?.context),
          tone: normalizeCategories(post?.tone),
          reference: normalizeCategories(post?.references),
          format,
          contentIntent: normalizeCategories(post?.contentIntent),
          narrativeForm: normalizeCategories(post?.narrativeForm),
          contentSignals: normalizeCategories(post?.contentSignals),
          stance: normalizeCategories(post?.stance),
          proofStyle: normalizeCategories(post?.proofStyle),
          commercialMode: normalizeCategories(post?.commercialMode),
          postLink: post?.permalink || post?.postLink || null,
          videoUrl: isVideo ? toVideoProxyUrl(rawMediaUrl) : undefined,
          nf,
          pv,
          reach,
          likes: toNumber(post?.stats?.likes) ?? 0,
          comments: toNumber(post?.stats?.comments) ?? 0,
          shares: toNumber(post?.stats?.shares) ?? 0,
          saves: (toNumber(post?.stats?.saved) ?? toNumber(post?.stats?.saves) ?? 0) || 0,
          thumbnail: post.thumbnailUrl || post.coverUrl || null,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => (b?.nf ?? 0) - (a?.nf ?? 0))
      .slice(0, 10);
  }, [props.normalizedPosts, props.showAdvancedSections]);

  const deepEngagement = useMemo(() => {
    if (!props.showAdvancedSections) return [];
    const posts = Array.isArray(props.postsSource) ? props.postsSource : [];
    if (!posts.length) return [];
    const acc = new Map<string, { saves: number; shares: number; reach: number; count: number }>();
    posts.forEach((post: any) => {
      const formatKey = Array.isArray(post?.format) && post.format[0] ? post.format[0] : "Outro";
      const savesRaw = toNumber(post?.stats?.saved) ?? toNumber(post?.stats?.saves) ?? 0;
      const sharesRaw = toNumber(post?.stats?.shares) ?? 0;
      const reachRaw = toNumber(post?.stats?.reach) ?? 0;
      const bucket = acc.get(formatKey) || { saves: 0, shares: 0, reach: 0, count: 0 };
      bucket.saves += savesRaw;
      bucket.shares += sharesRaw;
      bucket.reach += reachRaw;
      bucket.count += 1;
      acc.set(formatKey, bucket);
    });
    return Array.from(acc.entries())
      .map(([format, data]) => ({
        format,
        savesPerThousand: data.reach > 0 ? (data.saves / data.reach) * 1000 : 0,
        sharesPerThousand: data.reach > 0 ? (data.shares / data.reach) * 1000 : 0,
        postsCount: data.count,
      }))
      .sort(
        (
          a: { savesPerThousand: number; sharesPerThousand: number },
          b: { savesPerThousand: number; sharesPerThousand: number }
        ) => b.savesPerThousand + b.sharesPerThousand - (a.savesPerThousand + a.sharesPerThousand)
      );
  }, [props.postsSource, props.showAdvancedSections]);

  const weeklyEngagementRate = useMemo(() => {
    if (!props.showAdvancedSections) return [];
    const posts = Array.isArray(props.postsSource) ? props.postsSource : [];
    if (!posts.length) return [];
    const weeks = new Map<string, { date: string; totalInteractions: number; totalReach: number; count: number }>();
    posts.forEach((post: any) => {
      if (!post?.postDate) return;
      const reach = toNumber(post?.stats?.reach);
      const interactions = toNumber(post?.stats?.total_interactions);
      if (!reach || reach <= 0 || interactions === null) return;
      const key = getWeekKey(post.postDate);
      if (!key) return;
      const bucket = weeks.get(key) || { date: key, totalInteractions: 0, totalReach: 0, count: 0 };
      bucket.totalInteractions += Math.max(interactions, 0);
      bucket.totalReach += reach;
      bucket.count += 1;
      weeks.set(key, bucket);
    });
    return Array.from(weeks.values())
      .map((week) => ({ ...week, avgRate: week.totalReach > 0 ? week.totalInteractions / week.totalReach : 0 }))
      .sort((a: { date: string }, b: { date: string }) => (a.date > b.date ? 1 : -1));
  }, [props.postsSource, props.showAdvancedSections]);

  const saveVelocitySeries = useMemo(() => {
    const posts = Array.isArray(props.postsSource) ? props.postsSource : [];
    const rows = posts
      .map((post: any) => {
        const saves =
          toNumber(post?.stats?.saved) ??
          toNumber(post?.stats?.saves) ??
          toNumber(post?.stats?.save_count) ??
          0;
        const dateObj = post?.postDate ? new Date(post.postDate) : null;
        return { saves, date: dateObj };
      })
      .filter((row: { saves: number; date: Date | null }) => row.date && !Number.isNaN(row.date.getTime()));

    if (!rows.length) return [];

    const agg = new Map<string, { saves: number; count: number }>();
    rows.forEach((row: { saves: number; date: Date }) => {
      const key = row.date ? getWeekKey(row.date) : null;
      if (!key) return;
      const bucket = agg.get(key) || { saves: 0, count: 0 };
      bucket.saves += row.saves;
      bucket.count += 1;
      agg.set(key, bucket);
    });

    return Array.from(agg.entries())
      .map(([week, data]: [string, { saves: number; count: number }]) => ({
        date: week,
        avgSaves: data.count ? data.saves / data.count : 0,
      }))
      .sort((a: { date: string }, b: { date: string }) => (a.date > b.date ? 1 : -1));
  }, [props.postsSource]);

  const commentVelocitySeries = useMemo(() => {
    const posts = Array.isArray(props.postsSource) ? props.postsSource : [];
    const rows = posts
      .map((post: any) => {
        const comments = toNumber(post?.stats?.comments) ?? toNumber(post?.stats?.comment_count) ?? 0;
        const dateObj = post?.postDate ? new Date(post.postDate) : null;
        return { comments, date: dateObj };
      })
      .filter((row: { comments: number; date: Date | null }) => row.date && !Number.isNaN(row.date.getTime()));

    if (!rows.length) return [];

    const agg = new Map<string, { comments: number; count: number }>();
    rows.forEach((row: { comments: number; date: Date }) => {
      const key = row.date ? getWeekKey(row.date) : null;
      if (!key) return;
      const bucket = agg.get(key) || { comments: 0, count: 0 };
      bucket.comments += row.comments;
      bucket.count += 1;
      agg.set(key, bucket);
    });

    return Array.from(agg.entries())
      .map(([week, data]: [string, { comments: number; count: number }]) => ({
        date: week,
        avgComments: data.count ? data.comments / data.count : 0,
      }))
      .sort((a: { date: string }, b: { date: string }) => (a.date > b.date ? 1 : -1));
  }, [props.postsSource]);

  return (
    <PlanningAudienceSection
      {...props}
      TopDiscoveryTableComponent={TopDiscoveryTable}
      strategyMatrix={strategyMatrix}
      mobileStrategyHighlights={mobileStrategyHighlights}
      topDiscovery={topDiscovery}
      weeklyEngagementRate={weeklyEngagementRate}
      commentVelocitySeries={commentVelocitySeries}
      saveVelocitySeries={saveVelocitySeries}
      deepEngagement={deepEngagement}
    />
  );
}
