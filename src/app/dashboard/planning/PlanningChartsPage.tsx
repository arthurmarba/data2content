"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import Image from "next/image";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock3, LineChart as LineChartIcon, Sparkles, Target } from "lucide-react";
import { TopDiscoveryTable } from "./components/TopDiscoveryTable";
import PostsBySliceModal from "./components/PostsBySliceModal";
import DiscoverVideoModal from "@/app/discover/components/DiscoverVideoModal";


const cardBase = "rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm";
const tooltipStyle = { borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,0.12)" };
const DEFAULT_TIME_PERIOD = "last_90_days";
const PERIOD_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Últimos 7 dias", value: "last_7_days" },
  { label: "Últimos 14 dias", value: "last_14_days" },
  { label: "Últimos 30 dias", value: "last_30_days" },
  { label: "Últimos 60 dias", value: "last_60_days" },
  { label: "Últimos 90 dias", value: "last_90_days" },
  { label: "Últimos 120 dias", value: "last_120_days" },
];
const metricCellClass = "text-right tabular-nums text-slate-800 font-semibold";
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
const getWeekStart = (d: string | Date) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.getDay(); // 0 = domingo
  const diffToMonday = (day + 6) % 7;
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - diffToMonday);
  return start;
};

const formatDateKey = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getWeekKey = (d: string | Date) => {
  const start = getWeekStart(d);
  return start ? formatDateKey(start) : null;
};

const stripAccents = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const normalizeLabel = (value: string) => stripAccents(value).trim().toLowerCase();

const toArray = (value: any): string[] => {
  if (Array.isArray(value)) return value.filter(Boolean).map((v) => String(v));
  if (value) return [String(value)];
  return [];
};

const normalizeWeekKey = (value: string | Date | null) => {
  if (!value) return null;
  if (value instanceof Date) return getWeekKey(value);
  if (typeof value === "string") {
    const direct = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (direct) return value;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return getWeekKey(parsed);
  }
  return null;
};

const formatWeekLabel = (weekKey?: string | null) => {
  if (!weekKey) return "";
  const key = normalizeWeekKey(weekKey);
  if (!key) return weekKey;
  const [year, month, day] = key.split("-");
  if (!year || !month || !day) return key;
  const labelDate = new Date(Number(year), Number(month) - 1, Number(day));
  return labelDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const toVideoProxyUrl = (raw?: string | null) => {
  if (!raw) return raw;
  if (raw.startsWith("/api/proxy/video/")) return raw;
  if (/^https?:\/\//i.test(raw)) return `/api/proxy/video/${encodeURIComponent(raw)}`;
  return raw;
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

const filterPostsByHour = (posts: any[], hour: number) =>
  posts.filter((p) => {
    if (!p?.postDate) return false;
    const d = new Date(p.postDate);
    return !Number.isNaN(d.getTime()) && d.getHours() === hour;
  });

const filterPostsByDayHour = (posts: any[], day: number, startHour: number, endHour: number) =>
  posts.filter((p) => {
    if (!p?.postDate) return false;
    const d = new Date(p.postDate);
    if (Number.isNaN(d.getTime())) return false;
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    const h = d.getHours();
    return dow === day && h >= startHour && h <= endHour;
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

export default function PlanningChartsPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [timePeriod, setTimePeriod] = useState<string>(DEFAULT_TIME_PERIOD);
  const [page, setPage] = useState(1);
  const [postsCache, setPostsCache] = useState<any[]>([]);
  const [autoPaginating, setAutoPaginating] = useState(false);
  const PAGE_LIMIT = 200;
  const MAX_PAGES = 6; // evita loop infinito; 6*200 = 1200 posts em 90 dias

  const handleTimePeriodChange = (value: string) => {
    setTimePeriod(value);
    setPage(1);
    setPostsCache([]);
  };

  const { data: trendData, isLoading: loadingTrend } = useSWR(
    userId ? `/api/v1/users/${userId}/trends/reach-engagement?granularity=weekly&timePeriod=${timePeriod}` : null,
    fetcher
  );
  const { data: timeData, isLoading: loadingTime } = useSWR(
    userId ? `/api/v1/users/${userId}/performance/time-distribution?metric=stats.total_interactions&timePeriod=${timePeriod}` : null,
    fetcher
  );
  const { data: formatData, isLoading: loadingFormat } = useSWR(
    userId
      ? `/api/v1/users/${userId}/performance/engagement-distribution-format?timePeriod=${timePeriod}&engagementMetricField=stats.total_interactions`
      : null,
    fetcher
  );
  const { data: proposalData, isLoading: loadingProposal } = useSWR(
    userId
      ? `/api/v1/users/${userId}/performance/average-engagement?timePeriod=${timePeriod}&engagementMetricField=stats.total_interactions&groupBy=proposal`
      : null,
    fetcher
  );
  const { data: toneData, isLoading: loadingTone } = useSWR(
    userId
      ? `/api/v1/users/${userId}/performance/average-engagement?timePeriod=${timePeriod}&engagementMetricField=stats.total_interactions&groupBy=tone`
      : null,
    fetcher
  );
  const { data: referenceData, isLoading: loadingReference } = useSWR(
    userId
      ? `/api/v1/users/${userId}/performance/average-engagement?timePeriod=${timePeriod}&engagementMetricField=stats.total_interactions&groupBy=references`
      : null,
    fetcher
  );
  const { data: postsData, isLoading: loadingPosts } = useSWR(
    userId
      ? `/api/v1/users/${userId}/videos/list?timePeriod=${timePeriod}&limit=${PAGE_LIMIT}&page=${page}&sortBy=postDate&sortOrder=desc`
      : null,
    fetcher
  );
  const { data: videoMetrics } = useSWR(
    userId ? `/api/v1/users/${userId}/performance/video-metrics?timePeriod=${timePeriod}` : null,
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
      if (!key) return; // descarta pontos sem data válida
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

  const [sliceModal, setSliceModal] = useState<{ open: boolean; title: string; subtitle?: string; posts: any[] }>({
    open: false,
    title: "",
    subtitle: "",
    posts: [],
  });

  const openSliceModal = React.useCallback(
    ({ title, subtitle, posts }: { title: string; subtitle?: string; posts: any[] }) => {
      setSliceModal({ open: true, title, subtitle, posts });
    },
    []
  );

  const closeSliceModal = React.useCallback(() => {
    setSliceModal((prev) => ({ ...prev, open: false }));
  }, []);

  const [isVideoPlayerOpen, setIsVideoPlayerOpen] = useState(false);
  const [selectedVideoForPlayer, setSelectedVideoForPlayer] = useState<any>(null);

  const handlePlayVideo = React.useCallback((post: any) => {
    setSelectedVideoForPlayer(post);
    setIsVideoPlayerOpen(true);
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

  const handleHourClick = React.useCallback(
    async (hour: number, subtitle: string) => {
      const posts = sortPostsByDateDesc(filterPostsByHour(normalizedPosts, hour));
      if (posts.length > 0) {
        openSliceModal({
          title: `Posts no horário ${hour}h`,
          subtitle,
          posts,
        });
        return;
      }

      // Fallback: busca posts do horário no back-end usando o período selecionado.
      if (!userId) return;
      try {
        const res = await fetch(
          `/api/v1/users/${userId}/videos/list?timePeriod=${timePeriod}&hour=${hour}&limit=200&page=1&sortBy=postDate&sortOrder=desc`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          openSliceModal({
            title: `Posts no horário ${hour}h`,
            subtitle,
            posts: [],
          });
          return;
        }
        const data = await res.json();
        const apiPosts = Array.isArray(data?.posts) ? data.posts : [];
        const normalized = apiPosts.map((p: any) => normalizePost(p));
        openSliceModal({
          title: `Posts no horário ${hour}h`,
          subtitle,
          posts: sortPostsByDateDesc(normalized),
        });
      } catch (err) {
        console.warn("[PlanningCharts] Falha ao buscar posts por hora", err);
        openSliceModal({
          title: `Posts no horário ${hour}h`,
          subtitle,
          posts: [],
        });
      }
    },
    [normalizedPosts, openSliceModal, timePeriod, userId]
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

  const mergePosts = (prev: any[], next: any[]) => {
    const map = new Map<string, any>();
    const all = [...prev, ...next];
    all.forEach((p) => {
      const key =
        p?._id ||
        p?.id ||
        p?.instagramMediaId ||
        (p?.postDate ? `${p.postDate}-${p?.caption || ""}` : null) ||
        Math.random().toString(36);
      map.set(key, { ...map.get(key), ...p });
    });
    return Array.from(map.values());
  };

  // acumula posts paginados automaticamente até MAX_PAGES ou até vir menos que PAGE_LIMIT
  useEffect(() => {
    const list = Array.isArray(postsData?.posts)
      ? postsData.posts
      : Array.isArray(postsData?.videos)
        ? postsData.videos
        : [];
    if (!list.length) {
      // se não houver posts na página 1, mantém cache vazio
      if (page === 1) setPostsCache([]);
      return;
    }

    setPostsCache((prev) => mergePosts(prev, list));

    const shouldLoadMore = list.length === PAGE_LIMIT && page < MAX_PAGES;
    if (shouldLoadMore && !autoPaginating) {
      setAutoPaginating(true);
      setTimeout(() => {
        setPage((p) => Math.min(p + 1, MAX_PAGES));
        setAutoPaginating(false);
      }, 0);
    }
  }, [postsData, page, autoPaginating]);

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

        // Fallback: usa visitas ao perfil como proxy de descoberta (assume maioria não seguidor)
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
        const mediaType = String(p?.type || "").toUpperCase();
        const isVideo =
          mediaType === "VIDEO" ||
          mediaType === "REEL" ||
          format.some((f) => /reel|video/i.test(f));
        const rawMediaUrl = p?.mediaUrl || p?.media_url || null;
        const videoUrl = isVideo ? toVideoProxyUrl(rawMediaUrl) : undefined;
        const postLink = p?.permalink || p?.postLink || null;
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
          postLink,
          videoUrl,
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
        postLink?: string | null;
        videoUrl?: string | null;
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
            day: d.getDay() === 0 ? 7 : d.getDay(), // Sunday -> 7
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
        const shares =
          toNumber(p?.stats?.shares) ??
          toNumber((p as any)?.stats?.share_count) ??
          toNumber((p as any)?.stats?.share) ??
          0;
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

  const saveVelocitySeries = useMemo(() => {
    const posts = Array.isArray(postsSource) ? postsSource : [];
    const rows = posts
      .map((p: any) => {
        const saves =
          toNumber(p?.stats?.saved) ??
          toNumber(p?.stats?.saves) ??
          toNumber((p as any)?.stats?.save_count) ??
          0;
        const dateObj = p?.postDate ? new Date(p.postDate) : null;
        return { saves, date: dateObj };
      })
      .filter((p) => p.date && !Number.isNaN(p.date.getTime()));

    if (!rows.length) return [];

    const agg = new Map<string, { saves: number; count: number }>();
    rows.forEach((row) => {
      const key = row.date ? getWeekKey(row.date) : null;
      if (!key) return;
      const bucket = agg.get(key) || { saves: 0, count: 0 };
      bucket.saves += row.saves;
      bucket.count += 1;
      agg.set(key, bucket);
    });

    return Array.from(agg.entries())
      .map(([week, data]) => ({
        date: week,
        avgSaves: data.count ? data.saves / data.count : 0,
      }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [postsSource]);

  const commentVelocitySeries = useMemo(() => {
    const posts = Array.isArray(postsSource) ? postsSource : [];
    const rows = posts
      .map((p: any) => {
        const comments =
          toNumber(p?.stats?.comments) ??
          toNumber((p as any)?.stats?.comment_count) ??
          0;
        const dateObj = p?.postDate ? new Date(p.postDate) : null;
        return { comments, date: dateObj };
      })
      .filter((p) => p.date && !Number.isNaN(p.date.getTime()));

    if (!rows.length) return [];

    const agg = new Map<string, { comments: number; count: number }>();
    rows.forEach((row) => {
      const key = row.date ? getWeekKey(row.date) : null;
      if (!key) return;
      const bucket = agg.get(key) || { comments: 0, count: 0 };
      bucket.comments += row.comments;
      bucket.count += 1;
      agg.set(key, bucket);
    });

    return Array.from(agg.entries())
      .map(([week, data]) => ({
        date: week,
        avgComments: data.count ? data.comments / data.count : 0,
      }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [postsSource]);

  const discoveryStats = useMemo(() => {
    if (!followerMix.length) return null;
    const avgShare =
      followerMix.reduce((sum, p) => sum + (typeof p.nf === "number" ? p.nf : 0), 0) / followerMix.length;
    const avgVisits =
      followerMix.reduce((sum, p) => sum + (typeof p.profileVisits === "number" ? p.profileVisits : 0), 0) /
      followerMix.length;
    const peak = followerMix.slice().sort((a, b) => b.nf - a.nf)[0];
    return {
      avgShare,
      avgVisits,
      peakLabel: peak?.label,
      peakShare: peak?.nf,
    };
  }, [followerMix]);



  return (
    <>
      <main className="w-full pb-12 pt-8">
        <div className="dashboard-page-shell space-y-5">
          <header className="flex flex-col gap-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <LineChartIcon className="h-4 w-4" />
              Gráficos do planejamento
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">Leituras com dados reais</h1>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Atualizado para o período selecionado. Use alcance, interações e horários reais para planejar sem canibalizar posts.
              </p>
              <div className="flex items-center gap-2">
                <label htmlFor="timePeriod" className="text-xs font-semibold text-slate-600">
                  Período
                </label>
                <select
                  id="timePeriod"
                  value={timePeriod}
                  onChange={(e) => handleTimePeriodChange(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {PERIOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
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
                      onClick={(state) => handleWeekClick(state?.activeLabel ?? null, "Alcance x Interações")}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatWeekLabel}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label) => formatWeekLabel(String(label))}
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
                    <BarChart
                      data={hourBars}
                      margin={{ top: 6, right: 8, left: -6, bottom: 0 }}
                      style={{ cursor: "pointer" }}
                    >
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
                      <Bar
                        dataKey="average"
                        name="Interações"
                        fill="#0ea5e9"
                        radius={[6, 6, 0, 0]}
                        onClick={({ payload }) => {
                          const hour = typeof payload?.hour === "number" ? payload.hour : null;
                          if (hour !== null) {
                            handleHourClick(hour, "Entrega média por hora");
                          }
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Velocidade de Salvamentos</p>
                  <h2 className="text-base font-semibold text-slate-900">Média de salvamentos por semana</h2>
                  <p className="text-xs text-slate-500">Quantidade média de salvamentos por post, agregada por semana.</p>
                </div>
                <LineChartIcon className="h-5 w-5 text-rose-500" />
              </header>
              <div className="mt-4 h-64">
                {loadingPosts ? (
                  <p className="text-sm text-slate-500">Carregando série...</p>
                ) : saveVelocitySeries.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem dados suficientes.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={saveVelocitySeries}
                      margin={{ top: 6, right: 12, left: -6, bottom: 0 }}
                      onClick={(state) => handleWeekClick(state?.activeLabel ?? null, "Média de salvamentos por semana")}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatWeekLabel}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        tickFormatter={(value: number) => numberFormatter.format(value)}
                        label={{ value: "Salvamentos médios", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label) => formatWeekLabel(String(label))}
                        formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Salvamentos médios"]}
                      />
                      <Line type="monotone" dataKey="avgSaves" name="Salvamentos médios" stroke="#ec4899" strokeWidth={3} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Velocidade de Comentários</p>
                  <h2 className="text-base font-semibold text-slate-900">Média de comentários por semana</h2>
                  <p className="text-xs text-slate-500">Quantidade média de comentários por post, agregada por semana.</p>
                </div>
                <LineChartIcon className="h-5 w-5 text-indigo-500" />
              </header>
              <div className="mt-4 h-64">
                {loadingPosts ? (
                  <p className="text-sm text-slate-500">Carregando série...</p>
                ) : commentVelocitySeries.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem dados suficientes.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={commentVelocitySeries}
                      margin={{ top: 6, right: 12, left: -6, bottom: 0 }}
                      onClick={(state) => handleWeekClick(state?.activeLabel ?? null, "Média de comentários por semana")}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatWeekLabel}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        tickFormatter={(value: number) => numberFormatter.format(value)}
                        label={{ value: "Comentários médios", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label) => formatWeekLabel(String(label))}
                        formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Comentários médios"]}
                      />
                      <Line type="monotone" dataKey="avgComments" name="Comentários médios" stroke="#6366f1" strokeWidth={3} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                    </LineChart>
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
                      style={{ cursor: "pointer" }}
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
                      <Bar
                        dataKey="value"
                        name="Interações"
                        fill="#0ea5e9"
                        radius={[0, 6, 6, 0]}
                        onClick={({ payload }) => {
                          const value = payload?.name ? String(payload.name) : null;
                          if (value) handleCategoryClick("context", value, "Interação média por contexto");
                        }}
                      />
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
                      style={{ cursor: "pointer" }}
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
                      <Bar
                        dataKey="value"
                        name="Interações"
                        fill="#6366f1"
                        radius={[0, 6, 6, 0]}
                        onClick={({ payload }) => {
                          const value = payload?.name ? String(payload.name) : null;
                          if (value) handleCategoryClick("proposal", value, "Interação média por proposta");
                        }}
                      />
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
                      style={{ cursor: "pointer" }}
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
                      <Bar
                        dataKey="value"
                        name="Interações"
                        fill="#10b981"
                        radius={[0, 6, 6, 0]}
                        onClick={({ payload }) => {
                          const value = payload?.name ? String(payload.name) : null;
                          if (value) handleCategoryClick("tone", value, "Interação média por tom");
                        }}
                      />
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
                      style={{ cursor: "pointer" }}
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
                      <Bar
                        dataKey="value"
                        name="Interações"
                        fill="#f59e0b"
                        radius={[0, 6, 6, 0]}
                        onClick={({ payload }) => {
                          const value = payload?.name ? String(payload.name) : null;
                          if (value) handleCategoryClick("references", value, "Interação média por referência");
                        }}
                      />
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
                          const startHour = Math.min(h, 23);
                          const endHour = Math.min(h + 3, 23);
                          const match = heatmap.reduce((best, curr) => {
                            if (Math.abs(curr.hour - h) <= 1 && curr.day === dow) {
                              return curr.score > (best?.score ?? 0) ? curr : best;
                            }
                            return best;
                          }, null as any);
                          const score = match?.score ?? 0;
                          const bg = `rgba(14,165,233,${0.12 + score * 0.6})`;
                          return (
                            <button
                              key={hIdx}
                              type="button"
                              className="aspect-square rounded border border-slate-100 transition hover:border-slate-300"
                              style={{ background: bg }}
                              onClick={() => handleDayHourClick(dow, startHour, endHour, "Heatmap de janelas")}
                              aria-label={`Posts em ${["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][dow - 1]} entre ${startHour}h e ${endHour}h`}
                            />
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            </article>

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
                      onClick={(state: any) => {
                        const name =
                          state?.activeLabel ||
                          state?.activePayload?.[0]?.payload?.name ||
                          state?.activePayload?.[0]?.payload?.format;
                        if (name) handleCategoryClick("format", String(name), "Distribuição de interações");
                      }}
                      style={{ cursor: "pointer" }}
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
                {loadingPosts ? (
                  <p className="text-sm text-slate-500">Carregando consistência...</p>
                ) : weeklyConsistency.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem posts suficientes no período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={weeklyConsistency}
                      margin={{ top: 6, right: 12, left: -6, bottom: 0 }}
                      onClick={(state) => handleWeekClick(state?.activeLabel ?? null, "Posts por semana vs. média de interações")}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatWeekLabel}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis
                        yAxisId="left"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        tickFormatter={(value: number) => numberFormatter.format(value)}
                        label={{ value: "Posts", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        tickFormatter={(value: number) => numberFormatter.format(value)}
                        label={{ value: "Interações médias", angle: 90, position: "insideRight", fill: "#94a3b8", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label) => `Semana ${formatWeekLabel(String(label)).replace(/\sW/, " W")}`}
                        formatter={(value: number, name) => [
                          numberFormatter.format(Math.round(value)),
                          name === "posts" ? "Posts/semana" : "Média de interações",
                        ]}
                      />
                      <Legend
                        verticalAlign="top"
                        height={28}
                        iconType="circle"
                        formatter={(value) => (value === "posts" ? "Posts/semana" : "Média de interações")}
                      />
                      <Line yAxisId="left" type="monotone" dataKey="posts" name="posts" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="avgInteractions"
                        name="avgInteractions"
                        stroke="#a855f7"
                        strokeWidth={3}
                        dot={{ r: 2.5 }}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>

            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Profundidade</p>
                  <h2 className="text-base font-semibold text-slate-900">Salvos e compartilhamentos a cada 1.000 de alcance</h2>
                  <p className="text-xs text-slate-500">Quanto cada formato gera de profundidade ajustada por alcance.</p>
                </div>
                <Sparkles className="h-5 w-5 text-amber-500" />
              </header>
              <div className="mt-4 h-64">
                {loadingPosts ? (
                  <p className="text-sm text-slate-500">Carregando engajamento profundo...</p>
                ) : deepEngagement.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem dados de salvos/compartilhamentos no período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={deepEngagement}
                      layout="vertical"
                      margin={{ top: 6, right: 12, left: 40, bottom: 0 }}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis
                        type="category"
                        dataKey="format"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#475569", fontSize: 12 }}
                        width={140}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number, name: string, { payload }: any) => {
                          const perK = (value || 0).toFixed(2);
                          const count = payload?.postsCount ?? 0;
                          if (name === "savesPerThousand") {
                            return [`${perK} por 1.000 de alcance · ${count} posts`, "Salvos"];
                          }
                          if (name === "sharesPerThousand") {
                            return [`${perK} por 1.000 de alcance · ${count} posts`, "Compartilhamentos"];
                          }
                          return [`${perK}`, name];
                        }}
                      />
                      <Bar
                        dataKey="savesPerThousand"
                        name="Salvos"
                        stackId="depth"
                        fill="#22c55e"
                        radius={[0, 6, 6, 0]}
                        onClick={({ payload }) => {
                          const value = payload?.format ? String(payload.format) : null;
                          if (value) handleCategoryClick("format", value, "Salvos e compartilhamentos por formato");
                        }}
                      />
                      <Bar
                        dataKey="sharesPerThousand"
                        name="Compartilhamentos"
                        stackId="depth"
                        fill="#0ea5e9"
                        radius={[0, 6, 6, 0]}
                        onClick={({ payload }) => {
                          const value = payload?.format ? String(payload.format) : null;
                          if (value) handleCategoryClick("format", value, "Salvos e compartilhamentos por formato");
                        }}
                      />
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
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Engajamento</p>
                  <h2 className="text-base font-semibold text-slate-900">Taxa média de engajamento por semana</h2>
                  <p className="text-xs text-slate-500">Interações / alcance por semana.</p>
                </div>
                <Sparkles className="h-5 w-5 text-indigo-500" />
              </header>
              <div className="mt-4 h-64">
                {loadingPosts ? (
                  <p className="text-sm text-slate-500">Carregando série...</p>
                ) : weeklyEngagementRate.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem dados suficientes.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={weeklyEngagementRate}
                      margin={{ top: 6, right: 12, left: -6, bottom: 0 }}
                      onClick={(state) => handleWeekClick(state?.activeLabel ?? null, "Taxa média de engajamento por semana")}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatWeekLabel}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis
                        tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label) => formatWeekLabel(String(label))}
                        formatter={(value: number) => [`${(value * 100).toFixed(2)}%`, "Taxa de engajamento (interações/alcance)"]}
                      />
                      <Line type="monotone" dataKey="avgRate" name="Engajamento semanal" stroke="#7c3aed" strokeWidth={3} dot />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>

            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Propagação</p>
                  <h2 className="text-base font-semibold text-slate-900">Compartilhamentos x Visitas</h2>
                  <p className="text-xs text-slate-500">Veja se os shares estão puxando visitas ao perfil.</p>
                </div>
                <LineChartIcon className="h-5 w-5 text-slate-600" />
              </header>
              <div className="mt-4 h-64">
                {loadingPosts ? (
                  <p className="text-sm text-slate-500">Carregando série...</p>
                ) : shareVelocitySeries.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem dados suficientes.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={shareVelocitySeries}
                      margin={{ top: 6, right: 12, left: -6, bottom: 0 }}
                      onClick={(state) => handleWeekClick(state?.activeLabel ?? null, "Compartilhamentos x Visitas")}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatWeekLabel}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label) => formatWeekLabel(String(label))}
                        formatter={(value: number, name) =>
                          name === "shares"
                            ? [numberFormatter.format(Math.round(value)), "Compartilhamentos"]
                            : [numberFormatter.format(Math.round(value)), "Visitas ao perfil"]
                        }
                      />
                      <Line yAxisId="left" type="monotone" dataKey="shares" name="Compartilhamentos" stroke="#f97316" strokeWidth={3} dot />
                      <Line yAxisId="right" type="monotone" dataKey="visits" name="Visitas ao perfil" stroke="#0ea5e9" strokeWidth={3} dot />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
          </section>



          <section className={cardBase}>
            <header className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Top descoberta</p>
                <h3 className="text-base font-semibold text-slate-900">Posts que mais puxam não seguidores</h3>
                <p className="text-xs text-slate-500">Ordenados pelo maior share de não seguidores (ou visitas/reach).</p>
              </div>
              <Sparkles className="h-5 w-5 text-indigo-500" />
            </header>
            {loadingPosts ? (
              <p className="text-sm text-slate-500 mt-3">Carregando lista...</p>
            ) : (
              <TopDiscoveryTable posts={topDiscovery} isLoading={loadingPosts} />
            )}
          </section>
        </div>
      </main>
      <PostsBySliceModal
        isOpen={sliceModal.open}
        title={sliceModal.title}
        subtitle={sliceModal.subtitle}
        posts={sliceModal.posts}
        onClose={closeSliceModal}
        onPlayClick={handlePlayVideo}
      />

      <DiscoverVideoModal
        open={isVideoPlayerOpen}
        onClose={() => setIsVideoPlayerOpen(false)}
        videoUrl={selectedVideoForPlayer?.mediaUrl || selectedVideoForPlayer?.media_url || undefined}
        posterUrl={selectedVideoForPlayer?.thumbnailUrl || selectedVideoForPlayer?.coverUrl || undefined}
        postLink={selectedVideoForPlayer?.permalink || undefined}
      />
    </>

  );
}
