"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import useSWR from "swr";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
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
import PostReviewModal from "./PostReviewModal";
import PostDetailModal from "../PostDetailModal";
import DiscoverVideoModal from "@/app/discover/components/DiscoverVideoModal";




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
const formatPostsCount = (count: number) => {
  const rounded = Math.max(0, Math.round(count));
  return `${numberFormatter.format(rounded)} post${rounded === 1 ? "" : "s"}`;
};

type CategoryField = "format" | "proposal" | "context" | "tone" | "references";
type CategoryBarDatum = { name: string; value: number; postsCount: number };
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

const parseIsoWeekKey = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;
  const jan4 = new Date(year, 0, 4);
  const jan4Dow = (jan4.getDay() + 6) % 7; // Monday = 0
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - jan4Dow);
  const target = new Date(week1Monday);
  target.setDate(week1Monday.getDate() + (week - 1) * 7);
  target.setHours(0, 0, 0, 0);
  return target;
};

const getWeekKey = (d: string | Date) => {
  const start = getWeekStart(d);
  return start ? formatDateKey(start) : null;
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

const formatWeekLabel = (value: string | Date) => {
  const key = normalizeWeekKey(value);
  if (!key) return String(value);
  const [year, month, day] = key.split("-");
  if (!year || !month || !day) return key;
  const labelDate = new Date(Number(year), Number(month) - 1, Number(day));
  return labelDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const toArray = (value: any): string[] => {
  if (Array.isArray(value)) return value.filter(Boolean).map((v) => String(v));
  if (value) return [String(value)];
  return [];
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

const filterPostsByCategory = (posts: any[], field: CategoryField, value: string) =>
  posts.filter((p) => Array.isArray(p?.[field]) && matchesValue(p[field], value));

const sortPostsByDateDesc = (posts: any[]) =>
  posts.slice().sort((a, b) => {
    const aDate = a?.postDate ? new Date(a.postDate).getTime() : 0;
    const bDate = b?.postDate ? new Date(b.postDate).getTime() : 0;
    return bDate - aDate;
  });

const aggregateAverageInteractionsByCategory = (posts: any[], field: CategoryField): CategoryBarDatum[] => {
  if (!Array.isArray(posts) || !posts.length) return [];
  const acc = new Map<string, { interactionsSum: number; postsCount: number }>();

  posts.forEach((post) => {
    const categories = Array.from(
      new Set(
        toArray(post?.[field])
          .map((value) => String(value).trim())
          .filter(Boolean)
      )
    );
    if (!categories.length) return;

    const interactions = toNumber(post?.stats?.total_interactions) ?? 0;

    categories.forEach((category) => {
      const current = acc.get(category) || { interactionsSum: 0, postsCount: 0 };
      current.interactionsSum += interactions;
      current.postsCount += 1;
      acc.set(category, current);
    });
  });

  return Array.from(acc.entries())
    .map(([name, data]) => ({
      name,
      value: data.postsCount ? data.interactionsSum / data.postsCount : 0,
      postsCount: data.postsCount,
    }))
    .sort((a, b) => b.value - a.value);
};



interface AdminPlanningChartsProps {
  userId: string;
  hideHeatmap?: boolean;
  hideTopDiscovery?: boolean;
}


interface PlanningBatchResponse {
  trendData: { chartData?: Array<{ date: string; reach: number; totalInteractions: number }> };
  timeData: { buckets?: Array<{ dayOfWeek: number; hour: number; average: number; count: number }> };
  formatData: { chartData?: Array<{ name: string; value: number; percentage: number }> };
  proposalData: { chartData?: Array<{ name: string; value: number; postsCount: number }> };
  toneData: { chartData?: Array<{ name: string; value: number; postsCount: number }> };
  referenceData: { chartData?: Array<{ name: string; value: number; postsCount: number }> };
}

export default function AdminPlanningCharts({
  userId,
  hideHeatmap = false,
  hideTopDiscovery = false
}: AdminPlanningChartsProps) {
  const swrOptions = useMemo(
    () => ({
      revalidateOnFocus: false,
      dedupingInterval: 60 * 1000,
    }),
    []
  );

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


  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedPostForReview, setSelectedPostForReview] = useState<any>(null);
  const [isVideoPlayerOpen, setIsVideoPlayerOpen] = useState(false);
  const [selectedVideoForPlayer, setSelectedVideoForPlayer] = useState<any>(null);
  const [selectedPostIdForDetail, setSelectedPostIdForDetail] = useState<string | null>(null);


  const handleOpenReview = useCallback((post: any) => {
    setSelectedPostForReview(post);
    setIsReviewModalOpen(true);
    setSliceModal(prev => ({ ...prev, open: false }));
  }, []);

  const handlePlayVideo = useCallback((post: any) => {
    setSelectedVideoForPlayer(post);
    setIsVideoPlayerOpen(true);
    setSliceModal(prev => ({ ...prev, open: false }));
  }, []);

  const handleOpenDetail = useCallback((postId: string) => {
    setSelectedPostIdForDetail(postId);
    setSliceModal(prev => ({ ...prev, open: false }));
  }, []);



  const planningBatchUrl = useMemo(() => {
    if (!userId) return null;
    const params = new URLSearchParams({
      timePeriod: TIME_PERIOD,
      granularity: "weekly",
      metric: "stats.total_interactions",
      engagementMetricField: "stats.total_interactions",
    });
    return `/api/admin/dashboard/users/${userId}/planning/batch?${params.toString()}`;
  }, [userId]);

  const { data: planningBatch, isLoading: loadingMetrics } = useSWR<PlanningBatchResponse>(
    planningBatchUrl,
    fetcher,
    swrOptions
  );

  const trendData = planningBatch?.trendData;
  const timeData = planningBatch?.timeData;
  const formatData = planningBatch?.formatData;
  const proposalData = planningBatch?.proposalData;
  const toneData = planningBatch?.toneData;
  const referenceData = planningBatch?.referenceData;

  const loadingTrend = loadingMetrics;
  const loadingTime = loadingMetrics;
  const loadingFormat = loadingMetrics;
  const loadingProposal = loadingMetrics;
  const loadingTone = loadingMetrics;
  const loadingReference = loadingMetrics;
  const { data: postsData, isLoading: loadingPosts } = useSWR(
    userId
      ? `/api/v1/users/${userId}/videos/list?timePeriod=${TIME_PERIOD}&limit=${PAGE_LIMIT}&page=${page}&sortBy=postDate&sortOrder=desc`
      : null,
    fetcher,
    swrOptions
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
      const isoWeekDate = typeof row.date === "string" ? parseIsoWeekKey(row.date) : null;
      const key = isoWeekDate ? formatDateKey(isoWeekDate) : getWeekKey(row.date) ?? (row.date ? String(row.date) : null);
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

  const handleHourClick = React.useCallback(
    (hour: number, subtitle: string) => {
      const posts = sortPostsByDateDesc(filterPostsByHour(normalizedPosts, hour));
      openSliceModal({
        title: `Posts às ${hour}h`,
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
    const buckets: Array<{ hour: number; average: number; count?: number }> = timeData?.buckets || [];
    const source =
      buckets.length > 0
        ? buckets.map(({ hour, average, count }) => {
            const postsCount = typeof count === "number" && count > 0 ? count : 1;
            return {
              hour,
              interactionsSum: (average || 0) * postsCount,
              postsCount,
            };
          })
        : Array.isArray(postsSource)
          ? postsSource
            .filter((p) => p?.postDate)
            .map((p) => {
              const d = new Date(p.postDate);
              return {
                hour: d.getHours(),
                interactionsSum: toNumber(p?.stats?.total_interactions) ?? 0,
                postsCount: 1,
              };
            })
          : [];

    if (!source.length) return [];
    const acc = new Map<number, { interactionsSum: number; postsCount: number }>();
    source.forEach(({ hour, interactionsSum, postsCount }) => {
      const current = acc.get(hour) || { interactionsSum: 0, postsCount: 0 };
      acc.set(hour, {
        interactionsSum: current.interactionsSum + (interactionsSum || 0),
        postsCount: current.postsCount + (postsCount || 0),
      });
    });

    return Array.from(acc.entries())
      .map(([hour, { interactionsSum, postsCount }]) => ({
        hour,
        average: postsCount ? interactionsSum / postsCount : 0,
        postsCount,
      }))
      .sort((a, b) => a.hour - b.hour);
  }, [postsSource, timeData]);

  const bestHour = useMemo(() => hourBars?.slice().sort((a, b) => b.average - a.average)?.[0]?.hour ?? null, [hourBars]);

  const formatBars = useMemo(() => formatData?.chartData || [], [formatData]);
  const proposalBars = useMemo(() => {
    const fromApi = (proposalData?.chartData || []).slice(0, 6) as Array<{ name: string; value: number; postsCount?: number }>;
    const fallbackCounts = aggregateAverageInteractionsByCategory(normalizedPosts, "proposal");
    return fromApi.map((bar) => {
      const fallback = fallbackCounts.find((row) => matchesValue([row.name], bar.name));
      return {
        ...bar,
        postsCount: bar.postsCount ?? fallback?.postsCount ?? 0,
      };
    });
  }, [proposalData, normalizedPosts]);

  const toneBars = useMemo(() => {
    const fromApi = (toneData?.chartData || []).slice(0, 6) as Array<{ name: string; value: number; postsCount?: number }>;
    const fallbackCounts = aggregateAverageInteractionsByCategory(normalizedPosts, "tone");
    return fromApi.map((bar) => {
      const fallback = fallbackCounts.find((row) => matchesValue([row.name], bar.name));
      return {
        ...bar,
        postsCount: bar.postsCount ?? fallback?.postsCount ?? 0,
      };
    });
  }, [toneData, normalizedPosts]);

  const referenceBars = useMemo(() => {
    const fromApi = (referenceData?.chartData || []).slice(0, 6) as Array<{ name: string; value: number; postsCount?: number }>;
    const fallbackCounts = aggregateAverageInteractionsByCategory(normalizedPosts, "references");
    return fromApi.map((bar) => {
      const fallback = fallbackCounts.find((row) => matchesValue([row.name], bar.name));
      return {
        ...bar,
        postsCount: bar.postsCount ?? fallback?.postsCount ?? 0,
      };
    });
  }, [referenceData, normalizedPosts]);

  const contextBars = useMemo(() => {
    return aggregateAverageInteractionsByCategory(normalizedPosts, "context").slice(0, 6);
  }, [normalizedPosts]);

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
        const dateObj = p?.postDate ? new Date(p.postDate) : null;
        return { shares, date: dateObj };
      })
      .filter((p) => p.date && !Number.isNaN(p.date.getTime()));

    if (!rows.length) return [];

    const agg = new Map<string, { shares: number; count: number }>();
    rows.forEach((row) => {
      const key = row.date ? getWeekKey(row.date) : null;
      if (!key) return;
      const bucket = agg.get(key) || { shares: 0, count: 0 };
      bucket.shares += row.shares;
      bucket.count += 1;
      agg.set(key, bucket);
    });

    return Array.from(agg.entries())
      .map(([week, data]) => ({
        date: week,
        avgShares: data.count ? data.shares / data.count : 0,
      }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [postsSource]);

  const saveVelocitySeries = useMemo(() => {
    const posts = Array.isArray(postsSource) ? postsSource : [];
    const rows = posts
      .map((p: any) => {
        const saves = toNumber(p?.stats?.saved) ?? toNumber(p?.stats?.saves) ?? 0;
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
        const comments = toNumber(p?.stats?.comments) ?? 0;
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
                <BarChart
                  data={hourBars}
                  margin={{ top: 20, right: 8, left: -6, bottom: 0 }}
                  onClick={(data) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      const hour = data.activePayload[0].payload.hour;
                      handleHourClick(hour, "Entrega por Hora");
                    }
                  }}
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
                    labelFormatter={(label, payload: any[]) => {
                      const postsCount = payload?.[0]?.payload?.postsCount;
                      return typeof postsCount === "number"
                        ? `${label}h • ${formatPostsCount(postsCount)}`
                        : `${label}h`;
                    }}
                    formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Interações médias"]}
                  />
                  <Bar dataKey="average" name="Interações médias" fill="#0ea5e9" radius={[6, 6, 0, 0]}>
                    <LabelList
                      dataKey="postsCount"
                      position="top"
                      formatter={(value: number) => numberFormatter.format(Math.max(0, Math.round(value)))}
                      fill="#64748b"
                      fontSize={10}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
        <article className={cardBase}>
          <header className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Velocidade de Comentários</p>
              <h2 className="text-base font-semibold text-slate-900">Média de comentários por semana</h2>
            </div>
            <Sparkles className="h-5 w-5 text-indigo-500" />
          </header>
          <div className="mt-4 h-64">
            {commentVelocitySeries.length === 0 ? (
              <p className="text-sm text-slate-500">Sem dados de comentários.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={commentVelocitySeries}
                  margin={{ top: 6, right: 8, left: -6, bottom: 0 }}
                  onClick={(data) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      const weekKey = data.activePayload[0].payload.date;
                      handleWeekClick(weekKey, "Velocidade de Comentários");
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    tickFormatter={formatWeekLabel}
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
                    labelFormatter={(label) => `Semana ${formatWeekLabel(String(label)).replace("Sem ", "")}`}
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
                  margin={{ top: 6, right: 76, left: 30, bottom: 0 }}
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
                    labelFormatter={(label: string, payload: any[]) => {
                      const postsCount = payload?.[0]?.payload?.postsCount;
                      return typeof postsCount === "number"
                        ? `${label} • ${formatPostsCount(postsCount)}`
                        : label;
                    }}
                    formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Interações médias"]}
                  />
                  <Bar dataKey="value" name="Interações médias" fill="#0ea5e9" radius={[0, 6, 6, 0]}>
                    <LabelList
                      dataKey="postsCount"
                      position="right"
                      formatter={(value: number) => formatPostsCount(value)}
                      fill="#64748b"
                      fontSize={11}
                    />
                  </Bar>
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
                  margin={{ top: 6, right: 76, left: 30, bottom: 0 }}
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
                    labelFormatter={(label: string, payload: any[]) => {
                      const postsCount = payload?.[0]?.payload?.postsCount;
                      return typeof postsCount === "number"
                        ? `${label} • ${formatPostsCount(postsCount)}`
                        : label;
                    }}
                    formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Interações médias"]}
                  />
                  <Bar dataKey="value" name="Interações médias" fill="#6366f1" radius={[0, 6, 6, 0]}>
                    <LabelList
                      dataKey="postsCount"
                      position="right"
                      formatter={(value: number) => formatPostsCount(value)}
                      fill="#64748b"
                      fontSize={11}
                    />
                  </Bar>
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
                  margin={{ top: 6, right: 76, left: 30, bottom: 0 }}
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
                    labelFormatter={(label: string, payload: any[]) => {
                      const postsCount = payload?.[0]?.payload?.postsCount;
                      return typeof postsCount === "number"
                        ? `${label} • ${formatPostsCount(postsCount)}`
                        : label;
                    }}
                    formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Interações médias"]}
                  />
                  <Bar dataKey="value" name="Interações médias" fill="#10b981" radius={[0, 6, 6, 0]}>
                    <LabelList
                      dataKey="postsCount"
                      position="right"
                      formatter={(value: number) => formatPostsCount(value)}
                      fill="#64748b"
                      fontSize={11}
                    />
                  </Bar>
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
                  margin={{ top: 6, right: 76, left: 30, bottom: 0 }}
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
                    labelFormatter={(label: string, payload: any[]) => {
                      const postsCount = payload?.[0]?.payload?.postsCount;
                      return typeof postsCount === "number"
                        ? `${label} • ${formatPostsCount(postsCount)}`
                        : label;
                    }}
                    formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Interações médias"]}
                  />
                  <Bar dataKey="value" name="Interações médias" fill="#f59e0b" radius={[0, 6, 6, 0]}>
                    <LabelList
                      dataKey="postsCount"
                      position="right"
                      formatter={(value: number) => formatPostsCount(value)}
                      fill="#64748b"
                      fontSize={11}
                    />
                  </Bar>
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

        {/* Distribuição de interações removida no admin */}
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
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    tickFormatter={formatWeekLabel}
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
                    labelFormatter={(label) => `Semana ${formatWeekLabel(String(label)).replace("Sem ", "")}`}
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
                  <Bar yAxisId="left" dataKey="posts" name="posts" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={18} />
                  <Line yAxisId="right" type="monotone" dataKey="avgInteractions" name="avgInteractions" stroke="#10b981" strokeWidth={3} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
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
              <h2 className="text-base font-semibold text-slate-900">Média de compartilhamentos por semana</h2>
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
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    tickFormatter={formatWeekLabel}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    tickFormatter={(value: number) => numberFormatter.format(value)}
                    label={{ value: "Compartilhamentos médios", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(label) => `Semana ${formatWeekLabel(String(label)).replace("Sem ", "")}`}
                    formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Compartilhamentos médios"]}
                  />
                  <Line type="monotone" dataKey="avgShares" name="Compartilhamentos médios" stroke="#f59e0b" strokeWidth={3} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
        <article className={cardBase}>
          <header className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Velocidade de Salvamentos</p>
              <h2 className="text-base font-semibold text-slate-900">Média de salvamentos por semana</h2>
            </div>
            <Sparkles className="h-5 w-5 text-amber-500" />
          </header>
          <div className="mt-4 h-64">
            {saveVelocitySeries.length === 0 ? (
              <p className="text-sm text-slate-500">Sem dados de salvamentos.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={saveVelocitySeries}
                  margin={{ top: 6, right: 8, left: -6, bottom: 0 }}
                  onClick={(data) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      const weekKey = data.activePayload[0].payload.date;
                      handleWeekClick(weekKey, "Velocidade de Salvamentos");
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    tickFormatter={formatWeekLabel}
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
                    labelFormatter={(label) => `Semana ${formatWeekLabel(String(label)).replace("Sem ", "")}`}
                    formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Salvamentos médios"]}
                  />
                  <Line type="monotone" dataKey="avgSaves" name="Salvamentos médios" stroke="#ec4899" strokeWidth={3} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </section>

      {!hideTopDiscovery && (
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
      )}


      {/* Modals */}
      <PostsBySliceModal
        isOpen={sliceModal.open}
        title={sliceModal.title}
        subtitle={sliceModal.subtitle}
        posts={sliceModal.posts}
        enableMetricSort
        onReviewClick={handleOpenReview}
        onPlayClick={handlePlayVideo}
        onDetailClick={handleOpenDetail}
        onClose={() => setSliceModal({ ...sliceModal, open: false })}
      />

      <PostReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        apiPrefix="/api/admin"
        post={selectedPostForReview ? {
          _id: selectedPostForReview._id,
          coverUrl: selectedPostForReview.thumbnailUrl || selectedPostForReview.coverUrl || selectedPostForReview.thumbnail,
          description: selectedPostForReview.caption,
          creatorName: "Criador",
        } : null}
      />

      <PostDetailModal
        isOpen={selectedPostIdForDetail !== null}
        onClose={() => setSelectedPostIdForDetail(null)}
        postId={selectedPostIdForDetail}
      />

      <DiscoverVideoModal
        open={isVideoPlayerOpen}
        onClose={() => setIsVideoPlayerOpen(false)}
        videoUrl={selectedVideoForPlayer?.mediaUrl || selectedVideoForPlayer?.media_url || undefined}
        posterUrl={selectedVideoForPlayer?.thumbnailUrl || selectedVideoForPlayer?.coverUrl || undefined}
        postLink={selectedVideoForPlayer?.permalink || undefined}
        onReviewClick={() => {
          setIsVideoPlayerOpen(false);
          handleOpenReview(selectedVideoForPlayer);
        }}
      />
    </div>



  );
}
