"use client";

import React, { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock3, LineChart as LineChartIcon, Sparkles, Target } from "lucide-react";
import { TopDiscoveryTable } from "@/app/dashboard/planning/components/TopDiscoveryTable";
import PostsBySliceModal from "@/app/dashboard/planning/components/PostsBySliceModal";

const cardBase = "rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm";
const tooltipStyle = { borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,0.12)" };
const TIME_PERIOD = "last_90_days";
const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || res.statusText);
  }
  return res.json();
};
const numberFormatter = new Intl.NumberFormat("pt-BR");
const toNumber = (value: any): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};
const getWeekKey = (d: string | Date) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const oneJan = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil((((date.getTime() - oneJan.getTime()) / 86400000) + oneJan.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
};

const normalizeWeekKey = (value: string | Date | null) => {
  if (!value) return null;
  const direct = getWeekKey(value);
  if (direct) return direct;
  if (typeof value === "string") {
    const match = value.match(/(\d{4}).*?W?(\d{1,2})/i);
    if (match && match[1] && match[2]) return `${match[1]}-W${match[2].padStart(2, "0")}`;
  }
  return null;
};

const toArray = (value: any): string[] => {
  if (Array.isArray(value)) return value.filter(Boolean).map((v) => String(v));
  if (value) return [String(value)];
  return [];
};

const normalizePost = (post: any) => {
  const formatRaw = toArray(post?.format).length ? toArray(post?.format) : toArray(post?.mediaType);
  const format = formatRaw.map((f) => f.trim());
  const proposal = toArray(post?.proposal);
  const context = toArray(post?.context);
  const tone = toArray(post?.tone);
  const references = toArray(post?.references ?? post?.reference);
  const metaLabel = [
    format.length ? `Formato: ${format.join(", ")}` : null,
    proposal.length ? `Proposta: ${proposal.join(", ")}` : null,
    context.length ? `Contexto: ${context.join(", ")}` : null,
    tone.length ? `Tom: ${tone.join(", ")}` : null,
    references.length ? `Ref: ${references.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return {
    ...post,
    format,
    proposal,
    context,
    tone,
    references,
    metaLabel,
    postDate: post?.postDate,
    stats: post?.stats ?? {},
  };
};

const filterPostsByWeek = (posts: any[], weekKey: string | null) => {
  const target = normalizeWeekKey(weekKey);
  if (!target) return [];
  return posts.filter((p) => p?.postDate && normalizeWeekKey(p.postDate) === target);
};

const filterPostsByDayHour = (posts: any[], day: number, startHour: number, endHour: number) =>
  posts.filter((p) => {
    if (!p?.postDate) return false;
    const d = new Date(p.postDate);
    if (Number.isNaN(d.getTime())) return false;
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    const h = d.getHours();
    return dow === day && h >= startHour && h <= endHour;
  });

const filterPostsByHour = (posts: any[], hour: number) =>
  posts.filter((p) => {
    if (!p?.postDate) return false;
    const d = new Date(p.postDate);
    return !Number.isNaN(d.getTime()) && d.getHours() === hour;
  });

const formatAliases: Record<string, string> = {
  photo: "foto",
  imagem: "foto",
  image: "foto",
  carousel: "carrossel",
  carrossel: "carrossel",
  reel: "reels",
  reels: "reels",
  video: "video",
  "vídeo": "video",
};

const stripAccents = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const normalizeLabel = (value: string) => stripAccents(value).trim().toLowerCase();

const matchesValue = (list: string[], target: string) => {
  const targetNorm = normalizeLabel(target);
  return list.some((item) => {
    const norm = normalizeLabel(item);
    if (norm === targetNorm) return true;
    const alias = formatAliases[norm];
    const aliasTarget = formatAliases[targetNorm];
    if (alias && alias === targetNorm) return true;
    if (aliasTarget && aliasTarget === norm) return true;
    return false;
  });
};

const filterPostsByCategory = (posts: any[], field: "format" | "proposal" | "context" | "tone" | "references", value: string) =>
  posts.filter((p) => Array.isArray(p?.[field]) && matchesValue(p[field], value));

const sortPostsByDateDesc = (posts: any[]) =>
  posts.slice().sort((a, b) => {
    const aDate = a?.postDate ? new Date(a.postDate).getTime() : 0;
    const bDate = b?.postDate ? new Date(b.postDate).getTime() : 0;
    return bDate - aDate;
  });



interface AdminPlanningChartsProps {
  userId: string;
  hideHeatmap?: boolean;
}

export default function AdminPlanningCharts({ userId, hideHeatmap = false }: AdminPlanningChartsProps) {
  const [page, setPage] = useState(1);
  const [postsCache, setPostsCache] = useState<any[]>([]);
  const PAGE_LIMIT = 200;

  // Modal States
  const [sliceModal, setSliceModal] = useState<{ open: boolean; title: string; subtitle?: string; posts: any[] }>({
    open: false,
    title: "",
    subtitle: "",
    posts: [],
  });


  const { data: trendData, isLoading: loadingTrend } = useSWR(
    userId ? `/api/v1/users/${userId}/trends/reach-engagement?granularity=weekly&timePeriod=${TIME_PERIOD}` : null,
    fetcher
  );
  const { data: timeData, isLoading: loadingTime } = useSWR(
    userId ? `/api/v1/users/${userId}/performance/time-distribution?metric=stats.total_interactions&timePeriod=${TIME_PERIOD}` : null,
    fetcher
  );
  const { data: formatData, isLoading: loadingFormat } = useSWR(
    userId
      ? `/api/v1/users/${userId}/performance/engagement-distribution-format?timePeriod=${TIME_PERIOD}&engagementMetricField=stats.total_interactions`
      : null,
    fetcher
  );
  const { data: proposalData, isLoading: loadingProposal } = useSWR(
    userId
      ? `/api/v1/users/${userId}/performance/average-engagement?timePeriod=${TIME_PERIOD}&engagementMetricField=stats.total_interactions&groupBy=proposal`
      : null,
    fetcher
  );
  const { data: toneData, isLoading: loadingTone } = useSWR(
    userId
      ? `/api/v1/users/${userId}/performance/average-engagement?timePeriod=${TIME_PERIOD}&engagementMetricField=stats.total_interactions&groupBy=tone`
      : null,
    fetcher
  );
  const { data: referenceData, isLoading: loadingReference } = useSWR(
    userId
      ? `/api/v1/users/${userId}/performance/average-engagement?timePeriod=${TIME_PERIOD}&engagementMetricField=stats.total_interactions&groupBy=references`
      : null,
    fetcher
  );
  const { data: postsData, isLoading: loadingPosts } = useSWR(
    userId
      ? `/api/v1/users/${userId}/videos/list?timePeriod=${TIME_PERIOD}&limit=${PAGE_LIMIT}&page=${page}&sortBy=postDate&sortOrder=desc`
      : null,
    fetcher
  );

  const trendSeries = useMemo(() => {
    const rows = (trendData?.chartData || []).map((point: any) => ({
      date: point.date,
      reach: typeof point.reach === "number" ? point.reach : 0,
      interactions: typeof point.totalInteractions === "number" ? point.totalInteractions : 0,
    }));
    if (!rows.length) return [];
    const agg = new Map<string, { reach: number; interactions: number; count: number }>();
    rows.forEach((row: { date: string; reach: number; interactions: number }) => {
      const key = getWeekKey(row.date) ?? (row.date ? String(row.date) : null);
      if (!key) return;
      const bucket = agg.get(key) || { reach: 0, interactions: 0, count: 0 };
      bucket.reach += row.reach;
      bucket.interactions += row.interactions;
      bucket.count += 1;
      agg.set(key, bucket);
    });
    return Array.from(agg.entries())
      .map(([week, data]) => ({
        date: week,
        reach: data.count ? data.reach / data.count : 0,
        interactions: data.count ? data.interactions / data.count : 0,
      }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [trendData]);

  const postsSource = postsCache;

  const normalizedPosts = useMemo(
    () => (Array.isArray(postsSource) ? postsSource.map((p) => normalizePost(p)) : []),
    [postsSource]
  );

  const openSliceModal = React.useCallback(
    ({ title, subtitle, posts }: { title: string; subtitle?: string; posts: any[] }) => {
      setSliceModal({ open: true, title, subtitle, posts });
    },
    []
  );

  const closeSliceModal = React.useCallback(() => {
    setSliceModal((prev) => ({ ...prev, open: false }));
  }, []);

  const handleWeekClick = React.useCallback(
    (weekKey: string | null, subtitle: string) => {
      if (!weekKey) return;
      const posts = sortPostsByDateDesc(filterPostsByWeek(normalizedPosts, weekKey));
      openSliceModal({
        title: `Posts da semana ${weekKey}`,
        subtitle,
        posts,
      });
    },
    [normalizedPosts, openSliceModal]
  );

  const handleCategoryClick = React.useCallback(
    (field: "format" | "proposal" | "context" | "tone" | "references", value: string, subtitle: string) => {
      const posts = sortPostsByDateDesc(filterPostsByCategory(normalizedPosts, field, value));
      openSliceModal({
        title: `Posts com ${field}: ${value}`,
        subtitle,
        posts,
      });
    },
    [normalizedPosts, openSliceModal]
  );

  const handleDayHourClick = React.useCallback(
    (day: number, startHour: number, endHour: number, subtitle: string) => {
      const posts = sortPostsByDateDesc(filterPostsByDayHour(normalizedPosts, day, startHour, endHour));
      openSliceModal({
        title: `Posts em ${["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][day - 1]} entre ${startHour}h e ${endHour}h`,
        subtitle,
        posts,
      });
    },
    [normalizedPosts, openSliceModal]
  );

  useEffect(() => {
    const list = Array.isArray(postsData?.posts)
      ? postsData.posts
      : Array.isArray(postsData?.videos)
        ? postsData.videos
        : [];
    if (!list.length) {
      setPostsCache([]);
      return;
    }
    setPostsCache(list);
  }, [postsData]);

  const hourBars = useMemo(() => {
    const buckets: Array<{ hour: number; average: number }> = timeData?.buckets || [];
    const source =
      buckets.length > 0
        ? buckets.map(({ hour, average }) => ({ hour, value: average }))
        : Array.isArray(postsSource)
          ? postsSource
            .filter((p) => p?.postDate)
            .map((p) => {
              const d = new Date(p.postDate);
              return {
                hour: d.getHours(),
                value: toNumber(p?.stats?.total_interactions) ?? 0,
              };
            })
          : [];
    if (!source.length) return [];
    const acc = new Map<number, { sum: number; count: number }>();
    source.forEach(({ hour, value }) => {
      const current = acc.get(hour) || { sum: 0, count: 0 };
      acc.set(hour, { sum: current.sum + (value || 0), count: current.count + 1 });
    });
    return Array.from(acc.entries())
      .map(([hour, { sum, count }]) => ({ hour, average: count ? sum / count : 0 }))
      .sort((a, b) => a.hour - b.hour);
  }, [postsSource, timeData]);

  const bestHour = useMemo(() => hourBars?.slice().sort((a, b) => b.average - a.average)?.[0]?.hour ?? null, [hourBars]);

  const formatBars = useMemo(() => formatData?.chartData || [], [formatData]);
  const proposalBars = useMemo(() => (proposalData?.chartData || []).slice(0, 6), [proposalData]);
  const toneBars = useMemo(() => (toneData?.chartData || []).slice(0, 6), [toneData]);
  const referenceBars = useMemo(() => (referenceData?.chartData || []).slice(0, 6), [referenceData]);
  const contextBars = useMemo(() => {
    const contexts =
      Array.isArray(postsSource) && postsSource.length
        ? postsSource.flatMap((p: any) => (Array.isArray(p?.context) ? p.context : p?.context ? [p.context] : []))
        : [];
    if (!contexts.length) return [];
    const acc = contexts.reduce<Record<string, number>>((map, ctx) => {
      const key = String(ctx);
      map[key] = (map[key] || 0) + 1;
      return map;
    }, {});
    return Object.entries(acc)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [postsSource]);

  const followerMix = useMemo(() => {
    const posts = Array.isArray(postsSource) ? postsSource : [];
    const mapped = posts
      .map((p: any, idx: number) => {
        const rawNf = toNumber(p?.stats?.reach_non_followers_ratio);
        const rawF = toNumber(p?.stats?.reach_followers_ratio);
        const pv = toNumber(p?.stats?.profile_visits);
        const reach = toNumber(p?.stats?.reach);

        let nfRatio = rawNf;
        let fRatio = rawF;
        if (nfRatio === null && pv !== null) {
          const base = reach && reach > 0 ? reach : pv;
          nfRatio = base > 0 ? Math.min(Math.max(pv / base, 0), 1) : null;
          fRatio = nfRatio !== null ? Math.max(1 - nfRatio, 0) : null;
        }

        if (nfRatio === null || fRatio === null) {
          nfRatio = 0;
          fRatio = 1;
        }

        const label = p?.caption ? p.caption.slice(0, 22) : `Post ${idx + 1}`;
        return {
          id: p._id || idx,
          label,
          date: p?.postDate,
          nf: Math.min(Math.max(nfRatio * 100, 0), 100),
          f: Math.min(Math.max(fRatio * 100, 0), 100),
          profileVisits: pv,
          reach,
        };
      })
      .filter(Boolean) as Array<{
        id: string | number;
        label: string;
        date?: string;
        nf: number;
        f: number;
        profileVisits?: number;
        reach?: number;
      }>;
    return mapped.slice(0, 8);
  }, [postsSource]);

  const topDiscovery = useMemo(() => {
    const posts = Array.isArray(postsSource) ? postsSource : [];
    const normalizeCategories = (value: any): string[] =>
      Array.isArray(value)
        ? value.filter(Boolean).map((v) => String(v))
        : value
          ? [String(value)]
          : [];
    const buildMetaLabel = (p: any) => {
      const pieces = [
        { label: "Proposta", values: normalizeCategories(p?.proposal) },
        { label: "Contexto", values: normalizeCategories(p?.context) },
        { label: "Tom", values: normalizeCategories(p?.tone) },
        { label: "Referência", values: normalizeCategories(p?.references) },
        { label: "Formato", values: normalizeCategories(p?.format) },
      ]
        .map(({ label, values }) => (values.length ? `${label}: ${values.join(", ")}` : null))
        .filter(Boolean);
      return pieces.join(" • ");
    };
    return posts
      .map((p: any) => {
        const nf = (() => {
          const direct = toNumber(p?.stats?.reach_non_followers_ratio);
          if (direct !== null) return direct;
          const pv = toNumber(p?.stats?.profile_visits);
          const reach = toNumber(p?.stats?.reach);
          if (pv === null) return 0;
          const base = reach && reach > 0 ? reach : pv;
          return base > 0 ? Math.min(Math.max(pv / base, 0), 1) : null;
        })();
        const pv = toNumber(p?.stats?.profile_visits);
        const reach = toNumber(p?.stats?.reach);
        if (nf === null && pv === null) return null;
        const metaLabel = buildMetaLabel(p);
        const proposal = normalizeCategories(p?.proposal);
        const context = normalizeCategories(p?.context);
        const tone = normalizeCategories(p?.tone);
        const reference = normalizeCategories(p?.references);
        const format = normalizeCategories(p?.format);
        return {
          id: p._id,
          caption: p.caption || "Post",
          date: p.postDate,
          metaLabel,
          proposal,
          context,
          tone,
          reference,
          format,
          nf,
          pv,
          reach,
          likes: toNumber(p?.stats?.likes) ?? 0,
          comments: toNumber(p?.stats?.comments) ?? 0,
          shares: toNumber(p?.stats?.shares) ?? 0,
          saves: (toNumber(p?.stats?.saved) ?? toNumber(p?.stats?.saves) ?? 0) || 0,
          thumbnail: p.thumbnailUrl || p.coverUrl || null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.nf ?? 0) - (a?.nf ?? 0))
      .slice(0, 10) as Array<{
        id?: string;
        caption: string;
        date?: string;
        metaLabel: string;
        proposal: string[];
        context: string[];
        tone: string[];
        reference: string[];
        format: string[];
        nf: number | null;
        pv: number | null;
        reach: number | null;
        likes: number;
        comments: number;
        shares: number;
        saves: number;
        thumbnail?: string | null;
      }>;
  }, [postsSource]);

  const heatmap = useMemo(() => {
    const buckets: Array<{ dayOfWeek: number; hour: number; average: number }> = timeData?.buckets || [];
    let source: Array<{ day: number; hour: number; value: number }> = [];
    if (buckets.length) {
      source = buckets.map((b) => ({ day: b.dayOfWeek, hour: b.hour, value: b.average }));
    } else if (Array.isArray(postsSource)) {
      source = postsSource
        .filter((p) => p?.postDate)
        .map((p) => {
          const d = new Date(p.postDate);
          return {
            day: d.getDay() === 0 ? 7 : d.getDay(),
            hour: d.getHours(),
            value: toNumber(p?.stats?.total_interactions) ?? 0,
          };
        });
    }
    if (!source.length) return [];
    const maxVal = Math.max(...source.map((s) => s.value || 0), 0.0001);
    return source.map((s) => ({
      day: s.day,
      hour: s.hour,
      score: (s.value || 0) / maxVal,
    }));
  }, [postsSource, timeData]);

  const weeklyConsistency = useMemo(() => {
    const posts = Array.isArray(postsSource) ? postsSource : [];
    if (!posts.length) return [];
    const weeks = new Map<
      string,
      { date: string; posts: number; totalInteractions: number; avgInteractions: number }
    >();
    posts.forEach((p: any) => {
      if (!p?.postDate) return;
      const key = getWeekKey(p.postDate);
      if (!key) return;
      const bucket = weeks.get(key) || { date: key, posts: 0, totalInteractions: 0, avgInteractions: 0 };
      const inter = typeof p?.stats?.total_interactions === "number" ? p.stats.total_interactions : 0;
      bucket.posts += 1;
      bucket.totalInteractions += inter;
      weeks.set(key, bucket);
    });
    return Array.from(weeks.values())
      .map((w) => ({ ...w, avgInteractions: w.posts ? w.totalInteractions / w.posts : 0 }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [postsSource]);

  const deepEngagement = useMemo(() => {
    const posts = Array.isArray(postsSource) ? postsSource : [];
    if (!posts.length) return [];
    const acc = new Map<string, { saves: number; shares: number; reach: number; count: number }>();
    posts.forEach((p: any) => {
      const formatKey = Array.isArray(p?.format) && p.format[0] ? p.format[0] : "Outro";
      const savesRaw = toNumber(p?.stats?.saved) ?? toNumber(p?.stats?.saves) ?? 0;
      const sharesRaw = toNumber(p?.stats?.shares) ?? 0;
      const reachRaw = toNumber(p?.stats?.reach) ?? 0;
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
      .sort((a, b) => b.savesPerThousand + b.sharesPerThousand - (a.savesPerThousand + a.sharesPerThousand));
  }, [postsSource]);

  const weeklyEngagementRate = useMemo(() => {
    const posts = Array.isArray(postsSource) ? postsSource : [];
    if (!posts.length) return [];
    const weeks = new Map<string, { date: string; sumRate: number; count: number }>();
    posts.forEach((p: any) => {
      if (!p?.postDate) return;
      const reach = toNumber(p?.stats?.reach);
      const interactions = toNumber(p?.stats?.total_interactions);
      if (!reach || reach <= 0 || !interactions || interactions <= 0) return;
      const rate = interactions / reach;
      const key = getWeekKey(p.postDate);
      if (!key) return;
      const bucket = weeks.get(key) || { date: key, sumRate: 0, count: 0 };
      bucket.sumRate += rate;
      bucket.count += 1;
      weeks.set(key, bucket);
    });
    return Array.from(weeks.values())
      .map((w) => ({ ...w, avgRate: w.count ? w.sumRate / w.count : 0 }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [postsSource]);

  const shareVelocitySeries = useMemo(() => {
    const posts = Array.isArray(postsSource) ? postsSource : [];
    const rows = posts
      .map((p: any) => {
        const shares = toNumber(p?.stats?.shares) ?? 0;
        const visits = toNumber(p?.stats?.profile_visits) ?? 0;
        const reach = toNumber(p?.stats?.reach);
        const dateObj = p?.postDate ? new Date(p.postDate) : null;
        return { shares, visits, reach, date: dateObj };
      })
      .filter((p) => p.date && !Number.isNaN(p.date.getTime()));

    if (!rows.length) return [];

    const agg = new Map<string, { shares: number; visits: number; count: number }>();
    rows.forEach((row) => {
      const key = row.date ? getWeekKey(row.date) : null;
      if (!key) return;
      const bucket = agg.get(key) || { shares: 0, visits: 0, count: 0 };
      bucket.shares += row.shares;
      bucket.visits += row.visits;
      bucket.count += 1;
      agg.set(key, bucket);
    });

    return Array.from(agg.entries())
      .map(([week, data]) => ({
        date: week,
        shares: data.count ? data.shares / data.count : 0,
        visits: data.count ? data.visits / data.count : 0,
      }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [postsSource]);

  return (
    <div className="w-full space-y-5">
      <header className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <LineChartIcon className="h-4 w-4" />
          Gráficos do planejamento
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">Leituras com dados reais</h1>
        <p className="text-sm text-slate-600">
          Atualizado para os últimos 90 dias. Use alcance, interações e horários reais para planejar sem canibalizar posts.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <article className={cardBase}>
          <header className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Alcance x Interações</p>
              <h2 className="text-base font-semibold text-slate-900">Evolução semanal</h2>
            </div>
            <Sparkles className="h-5 w-5 text-indigo-500" />
          </header>
          <div className="mt-4 h-64">
            {loadingTrend ? (
              <p className="text-sm text-slate-500">Carregando série...</p>
            ) : trendSeries.length === 0 ? (
              <p className="text-sm text-slate-500">Sem dados no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trendSeries}
                  margin={{ top: 6, right: 8, left: -6, bottom: 0 }}
                  onClick={(data) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      const weekKey = data.activePayload[0].payload.date;
                      handleWeekClick(weekKey, "Alcance x Interações");
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => numberFormatter.format(Math.round(value))}
                  />
                  <Line type="monotone" dataKey="reach" name="Alcance médio" stroke="#2563eb" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="interactions" name="Interações médias" stroke="#7c3aed" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className={cardBase}>
          <header className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Horário</p>
              <h2 className="text-base font-semibold text-slate-900">Entrega média por hora</h2>
              {bestHour !== null && (
                <p className="text-xs text-emerald-700">Melhor janela recente: {bestHour}h</p>
              )}
            </div>
            <Clock3 className="h-5 w-5 text-emerald-500" />
          </header>
          <div className="mt-4 h-64">
            {loadingTime ? (
              <p className="text-sm text-slate-500">Carregando horários...</p>
            ) : hourBars.length === 0 ? (
              <p className="text-sm text-slate-500">Sem dados suficientes.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourBars} margin={{ top: 6, right: 8, left: -6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={(h) => `${h}h`}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                  />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [`${Math.round(value)}`, "Interações"]}
                    labelFormatter={(label) => `${label}h`}
                  />
                  <Bar dataKey="average" name="Interações" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className={cardBase}>
          <header className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Contexto</p>
              <h2 className="text-base font-semibold text-slate-900">Interação média por contexto</h2>
            </div>
            <Target className="h-5 w-5 text-slate-600" />
          </header>
          <div className="mt-4 h-64">
            {loadingPosts ? (
              <p className="text-sm text-slate-500">Carregando contextos...</p>
            ) : contextBars.length === 0 ? (
              <p className="text-sm text-slate-500">Sem contextos registrados no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={contextBars}
                  layout="vertical"
                  margin={{ top: 6, right: 12, left: 30, bottom: 0 }}
                  onClick={(data) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      const context = data.activePayload[0].payload.name;
                      handleCategoryClick("context", context, "Interação por Contexto");
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                    width={140}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Interações"]}
                  />
                  <Bar dataKey="value" name="Interações" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className={cardBase}>
          <header className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Proposta</p>
              <h2 className="text-base font-semibold text-slate-900">Interação média por proposta</h2>
            </div>
            <Sparkles className="h-5 w-5 text-indigo-500" />
          </header>
          <div className="mt-4 h-64">
            {loadingProposal ? (
              <p className="text-sm text-slate-500">Carregando propostas...</p>
            ) : proposalBars.length === 0 ? (
              <p className="text-sm text-slate-500">Sem propostas registradas no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={proposalBars}
                  layout="vertical"
                  margin={{ top: 6, right: 12, left: 30, bottom: 0 }}
                  onClick={(data) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      const proposal = data.activePayload[0].payload.name;
                      handleCategoryClick("proposal", proposal, "Interação por Proposta");
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                    width={140}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Interações"]}
                  />
                  <Bar dataKey="value" name="Interações" fill="#6366f1" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className={cardBase}>
          <header className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Tom</p>
              <h2 className="text-base font-semibold text-slate-900">Interação média por tom</h2>
            </div>
            <Sparkles className="h-5 w-5 text-emerald-500" />
          </header>
          <div className="mt-4 h-64">
            {loadingTone ? (
              <p className="text-sm text-slate-500">Carregando tons...</p>
            ) : toneBars.length === 0 ? (
              <p className="text-sm text-slate-500">Sem tons registrados no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={toneBars}
                  layout="vertical"
                  margin={{ top: 6, right: 12, left: 30, bottom: 0 }}
                  onClick={(data) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      const tone = data.activePayload[0].payload.name;
                      handleCategoryClick("tone", tone, "Interação por Tom");
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                    width={140}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Interações"]}
                  />
                  <Bar dataKey="value" name="Interações" fill="#10b981" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className={cardBase}>
          <header className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Referência</p>
              <h2 className="text-base font-semibold text-slate-900">Interação média por referência</h2>
            </div>
            <Sparkles className="h-5 w-5 text-amber-500" />
          </header>
          <div className="mt-4 h-64">
            {loadingReference ? (
              <p className="text-sm text-slate-500">Carregando referências...</p>
            ) : referenceBars.length === 0 ? (
              <p className="text-sm text-slate-500">Sem referências registradas no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={referenceBars}
                  layout="vertical"
                  margin={{ top: 6, right: 12, left: 30, bottom: 0 }}
                  onClick={(data) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      const references = data.activePayload[0].payload.name;
                      handleCategoryClick("references", references, "Interação por Referência");
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                    width={140}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Interações"]}
                  />
                  <Bar dataKey="value" name="Interações" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {!hideHeatmap && (
          <article className={cardBase}>
            <header className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Heatmap</p>
                <h2 className="text-base font-semibold text-slate-900">Melhores janelas por dia e hora</h2>
                <p className="text-xs text-slate-500">Quanto mais escuro, mais interações médias.</p>
              </div>
              <Clock3 className="h-5 w-5 text-indigo-500" />
            </header>
            <div className="mt-4">
              {loadingTime ? (
                <p className="text-sm text-slate-500">Carregando heatmap...</p>
              ) : heatmap.length === 0 ? (
                <p className="text-sm text-slate-500">Sem dados para montar o heatmap.</p>
              ) : (
                <div className="grid grid-cols-8 gap-1 text-[11px] text-slate-500">
                  <div />
                  {Array.from({ length: 7 }).map((_, idx) => (
                    <div key={idx} className="text-center">{`${idx * 4}h`}</div>
                  ))}
                  {[1, 2, 3, 4, 5, 6, 7].map((dow) => (
                    <React.Fragment key={dow}>
                      <div className="pr-2 text-right">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][dow - 1]}</div>
                      {Array.from({ length: 7 }).map((_, hIdx) => {
                        const h = hIdx * 4;
                        const match = heatmap.reduce((best, curr) => {
                          if (Math.abs(curr.hour - h) <= 1 && curr.day === dow) {
                            return curr.score > (best?.score ?? 0) ? curr : best;
                          }
                          return best;
                        }, null as any);
                        const score = match?.score ?? 0;
                        const bg = `rgba(14,165,233,${0.12 + score * 0.6})`;
                        const startHour = Math.min(h, 23);
                        const endHour = Math.min(h + 3, 23);
                        return (
                          <div
                            key={hIdx}
                            className="aspect-square rounded border border-slate-100 cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all"
                            style={{ background: bg }}
                            onClick={() => handleDayHourClick(dow, startHour, endHour, "Heatmap de janelas")}
                            title={`Ver posts de ${["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][dow - 1]} entre ${startHour}h e ${endHour}h`}
                          />
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </article>
        )}

        <article className={cardBase}>
          <header className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Formato</p>
              <h2 className="text-base font-semibold text-slate-900">Distribuição de interações</h2>
            </div>
            <LineChartIcon className="h-5 w-5 text-amber-500" />
          </header>
          <div className="mt-4 h-64">
            {loadingFormat ? (
              <p className="text-sm text-slate-500">Carregando formatos...</p>
            ) : formatBars.length === 0 ? (
              <p className="text-sm text-slate-500">Sem dados de formato neste período.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={formatBars}
                  margin={{ top: 6, right: 8, left: -6, bottom: 0 }}
                  onClick={(data) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      const format = data.activePayload[0].payload.name;
                      handleCategoryClick("format", format, "Interação por Formato");
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <defs>
                    <linearGradient id="formatGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number, name) =>
                      name === "percentage"
                        ? [`${value.toFixed(1)}%`, "Participação"]
                        : [numberFormatter.format(Math.round(value)), "Interações"]
                    }
                  />
                  <Area type="monotone" dataKey="value" name="Interações" stroke="#f97316" fill="url(#formatGradient)" strokeWidth={3} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className={cardBase}>
          <header className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Consistência</p>
              <h2 className="text-base font-semibold text-slate-900">Posts por semana vs. média de interações</h2>
            </div>
            <LineChartIcon className="h-5 w-5 text-emerald-500" />
          </header>
          <div className="mt-4 h-64">
            {weeklyConsistency.length === 0 ? (
              <p className="text-sm text-slate-500">Sem dados de consistência.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weeklyConsistency}
                  margin={{ top: 6, right: 8, left: -6, bottom: 0 }}
                  onClick={(data) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      const weekKey = data.activePayload[0].payload.date;
                      handleWeekClick(weekKey, "Consistência");
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number, name) => [
                      numberFormatter.format(Math.round(value)),
                      name === "posts" ? "Posts" : "Interações Médias",
                    ]}
                  />
                  <Bar yAxisId="left" dataKey="posts" name="Posts" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={20} />
                  <Line yAxisId="right" type="monotone" dataKey="avgInteractions" name="Média Interações" stroke="#10b981" strokeWidth={3} dot={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className={cardBase}>
          <header className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Engajamento Profundo</p>
              <h2 className="text-base font-semibold text-slate-900">Salvos e Compartilhamentos por 1k de alcance</h2>
            </div>
            <Target className="h-5 w-5 text-indigo-500" />
          </header>
          <div className="mt-4 h-64">
            {deepEngagement.length === 0 ? (
              <p className="text-sm text-slate-500">Sem dados de engajamento profundo.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={deepEngagement}
                  layout="vertical"
                  margin={{ top: 6, right: 12, left: 30, bottom: 0 }}
                  onClick={(data) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      const format = data.activePayload[0].payload.format;
                      handleCategoryClick("format", format, "Engajamento Profundo");
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="format"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [value.toFixed(1), "Por 1k alcance"]}
                  />
                  <Bar dataKey="savesPerThousand" name="Salvos/1k" stackId="a" fill="#818cf8" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="sharesPerThousand" name="Shares/1k" stackId="a" fill="#c7d2fe" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className={cardBase}>
          <header className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Taxa de Engajamento</p>
              <h2 className="text-base font-semibold text-slate-900">Evolução da taxa semanal</h2>
            </div>
            <LineChartIcon className="h-5 w-5 text-indigo-500" />
          </header>
          <div className="mt-4 h-64">
            {weeklyEngagementRate.length === 0 ? (
              <p className="text-sm text-slate-500">Sem dados de taxa.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={weeklyEngagementRate}
                  margin={{ top: 6, right: 8, left: -6, bottom: 0 }}
                  onClick={(data) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      const weekKey = data.activePayload[0].payload.date;
                      handleWeekClick(weekKey, "Taxa de Engajamento");
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <defs>
                    <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [`${(value * 100).toFixed(2)}%`, "Taxa de Engajamento"]}
                  />
                  <Area type="monotone" dataKey="avgRate" name="Taxa Média" stroke="#6366f1" fill="url(#rateGradient)" strokeWidth={3} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className={cardBase}>
          <header className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Velocidade de Compartilhamento</p>
              <h2 className="text-base font-semibold text-slate-900">Shares e Visitas ao Perfil</h2>
            </div>
            <Sparkles className="h-5 w-5 text-amber-500" />
          </header>
          <div className="mt-4 h-64">
            {shareVelocitySeries.length === 0 ? (
              <p className="text-sm text-slate-500">Sem dados de compartilhamento.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={shareVelocitySeries}
                  margin={{ top: 6, right: 8, left: -6, bottom: 0 }}
                  onClick={(data) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      const weekKey = data.activePayload[0].payload.date;
                      handleWeekClick(weekKey, "Velocidade de Compartilhamento");
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number, name) => [numberFormatter.format(Math.round(value)), name === "shares" ? "Shares" : "Visitas"]}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="shares" name="Shares" stroke="#f59e0b" strokeWidth={3} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="visits" name="Visitas" stroke="#64748b" strokeWidth={3} dot={false} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </section>

      <section className={cardBase}>
        <header className="flex items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Top Descoberta</p>
            <h2 className="text-base font-semibold text-slate-900">Posts com maior potencial de alcance</h2>
          </div>
          <Sparkles className="h-5 w-5 text-indigo-500" />
        </header>
        <TopDiscoveryTable posts={topDiscovery} isLoading={loadingPosts} />
      </section>

      {/* Modals */}
      <PostsBySliceModal
        isOpen={sliceModal.open}
        title={sliceModal.title}
        subtitle={sliceModal.subtitle}
        posts={sliceModal.posts}
        onClose={closeSliceModal}
      />
    </div>
  );
}
