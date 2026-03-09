"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { XMarkIcon, PencilSquareIcon } from "@heroicons/react/24/solid";



type PostsBySliceModalProps = {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  posts: any[];
  enableMetricSort?: boolean;
  onClose: () => void;
  onReviewClick?: (post: any) => void;
  onPlayClick?: (post: any) => void;
  onDetailClick?: (postId: string) => void;
};



const numberFormatter = new Intl.NumberFormat("pt-BR");
type SortMetric = "postDate" | "likes" | "comments" | "shares" | "saves" | "interactions" | "reach";
type SortOrder = "asc" | "desc";

const METRIC_LABELS: Record<SortMetric, string> = {
  postDate: "Data do post",
  likes: "Likes",
  comments: "Comentários",
  shares: "Compartilhamentos",
  saves: "Salvamentos",
  interactions: "Interações",
  reach: "Alcance",
};
type MetricDisplayKey = Exclude<SortMetric, "postDate">;
const METRIC_DISPLAY_ORDER: Array<{
  key: MetricDisplayKey;
  label: string;
}> = [
  { key: "reach", label: "Alcance" },
  { key: "interactions", label: "Interações" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comentários" },
  { key: "shares", label: "Shares" },
  { key: "saves", label: "Salvos" },
];

const toMetricNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const getPostMetricValue = (post: any, metric: SortMetric) => {
  const stats = post?.stats ?? {};
  if (metric === "postDate") {
    const ts = post?.postDate ? new Date(post.postDate).getTime() : 0;
    return Number.isFinite(ts) ? ts : 0;
  }
  if (metric === "likes") return toMetricNumber(stats.likes ?? post?.likes);
  if (metric === "comments") return toMetricNumber(stats.comments ?? post?.comments);
  if (metric === "shares") return toMetricNumber(stats.shares ?? post?.shares);
  if (metric === "saves") return toMetricNumber(stats.saved ?? stats.saves ?? post?.saved ?? post?.saves);
  if (metric === "interactions") {
    const explicit = toMetricNumber(stats.total_interactions ?? post?.total_interactions);
    if (explicit > 0) return explicit;
    return (
      toMetricNumber(stats.likes ?? post?.likes) +
      toMetricNumber(stats.comments ?? post?.comments) +
      toMetricNumber(stats.shares ?? post?.shares) +
      toMetricNumber(stats.saved ?? stats.saves ?? post?.saved ?? post?.saves)
    );
  }
  if (metric === "reach") return toMetricNumber(stats.reach ?? post?.reach);
  return 0;
};

function formatDate(value?: string | Date) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function resolveImageSrc(value?: string) {
  if (!value) return "";
  if (value.startsWith("/api/proxy/thumbnail/")) return value;
  if (/^https?:\/\//i.test(value)) return `/api/proxy/thumbnail/${encodeURIComponent(value)}`;
  return value;
}

export default function PostsBySliceModal({
  isOpen,
  title,
  subtitle,
  posts,
  enableMetricSort = false,
  onClose,
  onReviewClick,
  onPlayClick,
  onDetailClick,
}: PostsBySliceModalProps) {


  const dialogRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [sortMetric, setSortMetric] = useState<SortMetric>("postDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    if (!isOpen) return;
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  const sortedPosts = useMemo(
    () =>
      posts.slice().sort((a, b) => {
        const direction = sortOrder === "asc" ? 1 : -1;
        const aValue = getPostMetricValue(a, sortMetric);
        const bValue = getPostMetricValue(b, sortMetric);
        if (aValue !== bValue) return (aValue - bValue) * direction;
        const aDate = getPostMetricValue(a, "postDate");
        const bDate = getPostMetricValue(b, "postDate");
        return bDate - aDate;
      }),
    [posts, sortMetric, sortOrder]
  );
  const metricMaxByKey = useMemo(() => {
    const maxMap = METRIC_DISPLAY_ORDER.reduce((acc, metric) => {
      acc[metric.key] = 0;
      return acc;
    }, {} as Record<MetricDisplayKey, number>);
    sortedPosts.forEach((post) => {
      METRIC_DISPLAY_ORDER.forEach((metric) => {
        const value = getPostMetricValue(post, metric.key);
        if (value > maxMap[metric.key]) maxMap[metric.key] = value;
      });
    });
    return maxMap;
  }, [sortedPosts]);

  const handleOpenPost = (post: any) => {
    if (onPlayClick) {
      onPlayClick(post);
      return;
    }
    if (onDetailClick && post?._id) {
      onDetailClick(post._id);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex w-screen items-end justify-center bg-slate-900/70 px-0 pt-8 backdrop-blur-[2px] sm:items-start sm:px-4 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[1.75rem] border border-slate-200 bg-white shadow-2xl outline-none sm:max-h-[84vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-5 sm:py-4">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{subtitle || "Seleção"}</p>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">{posts.length} {posts.length === 1 ? "post" : "posts"} encontrados</p>
            {enableMetricSort && posts.length > 1 && (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 sm:inline-flex sm:flex-row sm:flex-wrap sm:items-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Ordenar por</span>
                  <select
                    value={sortMetric}
                    onChange={(e) => setSortMetric(e.target.value as SortMetric)}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200 sm:w-auto"
                  >
                    <option value="postDate">{METRIC_LABELS.postDate}</option>
                    <option value="likes">{METRIC_LABELS.likes}</option>
                    <option value="comments">{METRIC_LABELS.comments}</option>
                    <option value="shares">{METRIC_LABELS.shares}</option>
                    <option value="saves">{METRIC_LABELS.saves}</option>
                    <option value="interactions">{METRIC_LABELS.interactions}</option>
                    <option value="reach">{METRIC_LABELS.reach}</option>
                  </select>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200 sm:w-auto"
                  >
                    <option value="desc">Decrescente</option>
                    <option value="asc">Crescente</option>
                  </select>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
            aria-label="Fechar"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center text-slate-500">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">–</div>
              <p className="text-sm font-medium">Nenhum post para esta seleção</p>
              <p className="text-xs text-slate-500">Tente outro intervalo ou categoria.</p>
            </div>
          ) : (
            <ul className="space-y-2 px-3 py-3 sm:px-4">
              {sortedPosts.map((post, idx) => {
                const formatTags = Array.isArray(post?.format)
                  ? post.format
                  : post?.format
                    ? [post.format]
                    : [];
                const proposalTags = Array.isArray(post?.proposal)
                  ? post.proposal
                  : post?.proposal
                    ? [post.proposal]
                    : [];
                const contextTags = Array.isArray(post?.context)
                  ? post.context
                  : post?.context
                    ? [post.context]
                    : [];
                const visibleTags = [
                  ...formatTags.slice(0, 1).map((value: string) => ({ value, tone: "slate" as const })),
                  ...proposalTags.slice(0, 1).map((value: string) => ({ value, tone: "indigo" as const })),
                  ...contextTags.slice(0, 1).map((value: string) => ({ value, tone: "blue" as const })),
                ];
                const hiddenTagCount =
                  Math.max(0, formatTags.length - 1) +
                  Math.max(0, proposalTags.length - 1) +
                  Math.max(0, contextTags.length - 1);

                return (
                  <li key={post._id || idx} className="rounded-xl border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => handleOpenPost(post)}
                      className="group flex w-full gap-3 p-2.5 text-left transition-colors hover:bg-slate-50/70 sm:gap-4 sm:p-3"
                    >
                      <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 sm:h-28 sm:w-20">
                        {post.thumbnailUrl || post.coverUrl || post.thumbnail ? (
                          <Image
                            src={resolveImageSrc(post.thumbnailUrl || post.coverUrl || post.thumbnail)}
                            alt={post.caption || "Post"}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                            sizes="(max-width: 640px) 64px, 80px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">Sem imagem</div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold leading-tight text-slate-900 sm:text-[15px]">
                          {post.caption || "Sem legenda"}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-4">
                          <span className="text-[11px] font-medium text-slate-500">{formatDate(post.postDate)}</span>
                          {visibleTags.map((tag, tagIndex) => (
                            <span
                              key={`${tag.value}-${tagIndex}`}
                              className={`text-[10px] font-semibold ${
                                tag.tone === "indigo"
                                  ? "text-indigo-700"
                                  : tag.tone === "blue"
                                    ? "text-blue-700"
                                    : "text-slate-600"
                              }`}
                            >
                              {tag.value}
                            </span>
                          ))}
                          {hiddenTagCount > 0 ? (
                            <span className="text-[10px] font-semibold text-slate-500">
                              +{hiddenTagCount}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 grid grid-cols-3 overflow-hidden rounded-md border border-slate-200 bg-slate-50/50 sm:grid-cols-6">
                          {METRIC_DISPLAY_ORDER.map((metric, metricIndex) => {
                            const metricValue = getPostMetricValue(post, metric.key);
                            const maxValue = metricMaxByKey[metric.key];
                            const isTopValue = maxValue > 0 && metricValue === maxValue;
                            const isSortedMetric = sortMetric === metric.key;
                            const hasLeftBorderMobile = metricIndex % 3 !== 0;
                            const hasLeftBorderDesktop = metricIndex % 6 !== 0;
                            return (
                              <div
                                key={metric.key}
                                className={`px-2 py-1.5 ${hasLeftBorderMobile ? "border-l border-slate-200" : ""} ${
                                  hasLeftBorderDesktop ? "sm:border-l sm:border-slate-200" : ""
                                } ${
                                  metricIndex >= 3 ? "border-t border-slate-200 sm:border-t-0" : ""
                                } ${isSortedMetric ? "bg-indigo-50/70" : ""}`}
                              >
                                <p className={`text-[9px] font-semibold uppercase tracking-[0.08em] ${isSortedMetric ? "text-indigo-700" : "text-slate-500"}`}>
                                  {metric.label}
                                </p>
                                <p
                                  className={`mt-1 text-sm font-semibold tabular-nums ${
                                    isTopValue ? "text-emerald-700" : isSortedMetric ? "text-indigo-900" : "text-slate-900"
                                  }`}
                                >
                                  {numberFormatter.format(metricValue)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </button>

                    {onReviewClick ? (
                      <div className="flex justify-end border-t border-slate-100 px-3 py-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onReviewClick(post);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-indigo-700"
                        >
                          <PencilSquareIcon className="h-3.5 w-3.5" />
                          Review
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  if (!mounted) return modalContent;

  const portalTarget = typeof document !== "undefined" ? document.body : null;
  return portalTarget ? createPortal(modalContent, portalTarget) : modalContent;
}
