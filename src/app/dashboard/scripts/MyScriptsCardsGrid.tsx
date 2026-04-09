"use client";

import dynamic from "next/dynamic";
import React from "react";
import { Check, Link2, Plus } from "lucide-react";

const MyScriptsCardLinkPopover = dynamic(
  () =>
    import("./MyScriptsCardInteractionOverlays").then((mod) => mod.MyScriptsCardLinkPopover),
  { ssr: false, loading: () => null }
);

const MyScriptsQuickPublishOverlay = dynamic(
  () =>
    import("./MyScriptsCardInteractionOverlays").then((mod) => mod.MyScriptsQuickPublishOverlay),
  { ssr: false, loading: () => null }
);

const COMPACT_VISIBLE_BATCH = 4;

type ScriptOrigin = "manual" | "ai" | "planner";
type ScriptLinkType = "standalone" | "planner_slot";

type ScriptPlannerRef = {
  weekStart?: string;
  slotId?: string;
  dayOfWeek?: number;
  blockStartHour?: number;
};

type ScriptPublication = {
  isPosted: boolean;
  postedAt?: string | null;
  content?: {
    id: string;
    caption?: string | null;
    postDate?: string | null;
    postLink?: string | null;
    type?: string | null;
    coverUrl?: string | null;
    engagement?: number | null;
    totalInteractions?: number | null;
  } | null;
};

type ScriptLinkingCampaignSummary = {
  proposalId: string;
  linkId: string;
  campaignTitle: string;
  brandName: string;
  linkedAt: string | null;
};

type ScriptLinkingSummary = {
  isLinked: boolean;
  totalLinks: number;
  campaigns: ScriptLinkingCampaignSummary[];
};

type ScriptItem = {
  id: string;
  title: string;
  content: string;
  source: ScriptOrigin;
  linkType: ScriptLinkType;
  plannerRef?: ScriptPlannerRef | null;
  recommendation?: {
    isRecommended: boolean;
    recommendedByAdminName?: string | null;
    recommendedAt?: string | null;
  } | null;
  adminAnnotation?: {
    notes?: string | null;
    updatedByName?: string | null;
    updatedAt?: string | null;
  } | null;
  publication?: ScriptPublication | null;
  linkingSummary?: ScriptLinkingSummary | null;
  createdAt: string;
  updatedAt: string;
};

type CampaignOption = {
  id: string;
  campaignTitle: string;
  brandName: string;
};

type ContentOption = {
  id: string;
  caption: string;
  postDate: string | null;
  postLink: string | null;
  type: string | null;
  coverUrl: string | null;
  engagement: number | null;
  totalInteractions: number | null;
};

type CardActionFeedback = {
  variant: "success" | "error" | "info";
  message: string;
  phase: "entering" | "shown" | "leaving";
};

const CARD_PREVIEW_MAX_CHARS = 210;
const DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function getDayLabel(dayOfWeek?: number) {
  if (typeof dayOfWeek !== "number") return "Dia";
  if (dayOfWeek === 7) return DAYS_SHORT[0];
  return DAYS_SHORT[dayOfWeek] || "Dia";
}

function getBlockLabel(hour?: number) {
  if (typeof hour !== "number") return "Horário";
  const end = (hour + 3) % 24;
  return `${String(hour).padStart(2, "0")}h-${String(end).padStart(2, "0")}h`;
}

function isScriptFromCalendar(script: Pick<ScriptItem, "source" | "linkType">) {
  return script.linkType === "planner_slot" || script.source === "planner";
}

function getCalendarOriginSummary(plannerRef?: ScriptPlannerRef | null) {
  if (!plannerRef) return "Origem: Calendário";
  const day = getDayLabel(plannerRef.dayOfWeek);
  const block = getBlockLabel(plannerRef.blockStartHour);
  if (day === "Dia" || block === "Horário") return "Origem: Calendário";
  return `Origem: Calendário • ${day} ${block}`;
}

function getSourceLabel(source: ScriptOrigin) {
  if (source === "manual") return "Manual";
  if (source === "ai") return "IA";
  return "Calendário";
}

function getSourceCardTone(source: ScriptOrigin) {
  if (source === "ai") {
    return {
      header: "bg-indigo-50/90 border-indigo-100",
      text: "text-indigo-700",
      ring: "hover:ring-indigo-200",
      compactCard: "hover:border-indigo-200/80 hover:bg-white hover:ring-indigo-100/60",
      compactPlaceholder: "border-indigo-100/90 bg-indigo-50 text-indigo-700",
      compactPlaceholderIcon: "bg-white text-indigo-700 ring-indigo-200",
      compactAction: "border-indigo-200 bg-indigo-50/90 text-indigo-700",
      compactLinkButton: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
    };
  }
  if (source === "planner") {
    return {
      header: "bg-emerald-50/90 border-emerald-100",
      text: "text-emerald-700",
      ring: "hover:ring-emerald-200",
      compactCard: "hover:border-emerald-200/80 hover:bg-white hover:ring-emerald-100/60",
      compactPlaceholder: "border-emerald-100/90 bg-emerald-50 text-emerald-700",
      compactPlaceholderIcon: "bg-white text-emerald-700 ring-emerald-200",
      compactAction: "border-emerald-200 bg-emerald-50/90 text-emerald-700",
      compactLinkButton: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    };
  }
  return {
    header: "bg-amber-50/95 border-amber-100",
    text: "text-amber-700",
    ring: "hover:ring-amber-200",
    compactCard: "hover:border-amber-200/80 hover:bg-white hover:ring-amber-100/60",
    compactPlaceholder: "border-amber-100/90 bg-amber-50 text-amber-700",
    compactPlaceholderIcon: "bg-white text-amber-700 ring-amber-200",
    compactAction: "border-amber-200 bg-amber-50/90 text-amber-700",
    compactLinkButton: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateCompact(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const day = date.toLocaleDateString("pt-BR", { day: "2-digit" });
  const month = date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").trim();
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

function getPublicationCoverUrl(publication?: ScriptPublication | null) {
  const coverUrl = publication?.content?.coverUrl?.trim();
  return coverUrl ? coverUrl : null;
}

function getCompactPublicationSummary(publication?: ScriptPublication | null) {
  if (!publication?.isPosted) return "Sem conteúdo vinculado";
  return null;
}

function getCompactStatusClasses(publication?: ScriptPublication | null) {
  if (publication?.isPosted) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function buildEmptyLinkingSummary(): ScriptLinkingSummary {
  return {
    isLinked: false,
    totalLinks: 0,
    campaigns: [],
  };
}

function getCardTitle(script: ScriptItem) {
  const title = script.title?.trim();
  if (title) return title;
  return "Roteiro sem título";
}

function getCardPreview(script: ScriptItem) {
  const content = script.content?.trim();
  if (!content) return "Sem conteúdo ainda.";
  const normalized = content.replace(/\s+/g, " ");
  if (normalized.length <= CARD_PREVIEW_MAX_CHARS) return normalized;

  const sliced = normalized.slice(0, CARD_PREVIEW_MAX_CHARS).trimEnd();
  const lastSpace = sliced.lastIndexOf(" ");
  const safeCut = lastSpace > CARD_PREVIEW_MAX_CHARS * 0.7 ? sliced.slice(0, lastSpace) : sliced;
  return `${safeCut}...`;
}

export type MyScriptsCardsGridProps = {
  scripts: ScriptItem[];
  compactView: boolean;
  isPreviewMode: boolean;
  isAdminViewer: boolean;
  isAuthenticated: boolean;
  canInteract: boolean;
  unreadFeedbackScriptIds: Set<string>;
  publicationSavingScriptId: string | null;
  cardCampaignByScriptId: Record<string, string>;
  cardLinkingScriptId: string | null;
  cardLinkErrorByScriptId: Record<string, string>;
  cardActionFeedbackByScriptId: Record<string, CardActionFeedback>;
  activeCardLinkScriptId: string | null;
  campaignOptions: CampaignOption[];
  campaignsLoading: boolean;
  quickPublishAnchorScriptId: string | null;
  quickPublishQuery: string;
  quickPublishContentId: string;
  quickPublishSaving: boolean;
  filteredQuickPublishOptions: ContentOption[];
  selectedQuickPublishOption: ContentOption | null;
  quickPublishTargetScript: ScriptItem | null;
  contentOptionsLoading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  cardLinkPopoverRef: React.MutableRefObject<HTMLDivElement | null>;
  quickPublishPopoverRef: React.MutableRefObject<HTMLDivElement | null>;
  onCreate: () => void;
  onOpenScript: (script: ScriptItem) => void;
  onRequestGoogleLogin: () => void | Promise<void>;
  onOpenPlanningPaywall: (source: string) => void;
  onOpenPremiumLinkingPaywall: (source: string) => void;
  onCardPublicationAction: (event: React.MouseEvent<HTMLButtonElement>, script: ScriptItem) => void | Promise<void>;
  onOpenCardLinkPanel: (event: React.MouseEvent<HTMLButtonElement>, script: ScriptItem) => void | Promise<void>;
  onCardCampaignChange: (scriptId: string, campaignId: string) => void;
  onCloseCardLinkPanel: () => void;
  onCardLinkConfirm: (script: ScriptItem) => void | Promise<void>;
  onCardUnlinkConfirm: (script: ScriptItem) => void | Promise<void>;
  onQuickPublishQueryChange: (value: string) => void;
  onQuickPublishContentChange: (contentId: string) => void;
  onCloseQuickPublish: () => void;
  onConfirmQuickPublish: () => void | Promise<void>;
  onLoadMore: () => void;
};

export function MyScriptsCardsGrid({
  scripts,
  compactView,
  isPreviewMode,
  isAdminViewer,
  isAuthenticated,
  canInteract,
  unreadFeedbackScriptIds,
  publicationSavingScriptId,
  cardCampaignByScriptId,
  cardLinkingScriptId,
  cardLinkErrorByScriptId,
  cardActionFeedbackByScriptId,
  activeCardLinkScriptId,
  campaignOptions,
  campaignsLoading,
  quickPublishAnchorScriptId,
  quickPublishQuery,
  quickPublishContentId,
  quickPublishSaving,
  filteredQuickPublishOptions,
  selectedQuickPublishOption,
  quickPublishTargetScript,
  contentOptionsLoading,
  loadingMore,
  hasMore,
  cardLinkPopoverRef,
  quickPublishPopoverRef,
  onCreate,
  onOpenScript,
  onRequestGoogleLogin,
  onOpenPlanningPaywall,
  onOpenPremiumLinkingPaywall,
  onCardPublicationAction,
  onOpenCardLinkPanel,
  onCardCampaignChange,
  onCloseCardLinkPanel,
  onCardLinkConfirm,
  onCardUnlinkConfirm,
  onQuickPublishQueryChange,
  onQuickPublishContentChange,
  onCloseQuickPublish,
  onConfirmQuickPublish,
  onLoadMore,
}: MyScriptsCardsGridProps) {
  const [visibleCount, setVisibleCount] = React.useState(() =>
    compactView ? Math.min(scripts.length, COMPACT_VISIBLE_BATCH) : scripts.length
  );
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!compactView) {
      setVisibleCount(scripts.length);
      return;
    }

    setVisibleCount((current) => {
      if (!scripts.length) return 0;
      const minimumVisible = Math.min(scripts.length, COMPACT_VISIBLE_BATCH);
      const clampedVisible = Math.min(current, scripts.length);
      return Math.max(clampedVisible, minimumVisible);
    });
  }, [compactView, scripts.length]);

  const hasLocalMoreCards = compactView && visibleCount < scripts.length;

  React.useEffect(() => {
    if (!hasLocalMoreCards) return;
    const node = loadMoreRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisibleCount((current) => Math.min(scripts.length, current + COMPACT_VISIBLE_BATCH));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const reachedViewport = entries.some((entry) => entry.isIntersecting);
        if (!reachedViewport) return;
        observer.disconnect();
        setVisibleCount((current) => Math.min(scripts.length, current + COMPACT_VISIBLE_BATCH));
      },
      { rootMargin: "240px 0px", threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasLocalMoreCards, scripts.length, visibleCount]);

  const visibleScripts = React.useMemo(
    () => (compactView ? scripts.slice(0, visibleCount) : scripts),
    [compactView, scripts, visibleCount]
  );

  return (
    <>
      <div className={compactView ? "flex flex-col gap-1.5" : "grid grid-cols-2 gap-3 sm:gap-5"}>
        <button
          type="button"
          onClick={onCreate}
          className={`${compactView ? "group flex min-h-[96px] items-center justify-center overflow-hidden rounded-[1.05rem] border border-indigo-100/90 bg-indigo-50/90 px-4 py-5 text-left transition hover:border-indigo-200 hover:bg-indigo-100/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200" : "dashboard-panel group flex h-72 flex-col overflow-hidden text-left ring-1 ring-transparent transition hover:ring-pink-200/70 sm:h-80 sm:rounded-[2rem] rounded-[1.5rem]"}`}
        >
          {compactView ? (
            <span className="inline-flex items-center justify-center gap-2 text-base font-semibold tracking-[-0.01em] text-indigo-700">
              <Plus size={18} className="text-indigo-600" />
              {isPreviewMode ? "Entrar para criar" : "Criar roteiro"}
            </span>
          ) : (
            <>
              <div className="border-b border-zinc-100 bg-zinc-50/70 px-5 py-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-pink-500">Novo</span>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-5">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-pink-50 text-pink-500 transition group-hover:bg-zinc-900 group-hover:text-white">
                  <Plus size={18} />
                </span>
                <span className="text-sm font-semibold text-zinc-900">
                  {isPreviewMode ? "Ativar com Google" : "Novo Roteiro"}
                </span>
                <span className="text-xs text-zinc-500">
                  {isPreviewMode ? "Salvar, usar IA e continuar do seu board" : "Começar em branco"}
                </span>
              </div>
            </>
          )}
        </button>

        {visibleScripts.map((script, index) => {
          const tone = getSourceCardTone(script.source);
          const hasAdminAnnotation = Boolean(script.adminAnnotation?.notes?.trim());
          const hasUnreadFeedback = unreadFeedbackScriptIds.has(script.id);
          const isFromCalendar = isScriptFromCalendar(script);
          const calendarOriginSummary = isFromCalendar ? getCalendarOriginSummary(script.plannerRef) : null;
          const isPosted = Boolean(script.publication?.isPosted);
          const isPublicationSaving = publicationSavingScriptId === script.id;
          const linkingSummary = script.linkingSummary ?? buildEmptyLinkingSummary();
          const linkedCampaigns = linkingSummary.campaigns;
          const isCardLinking = cardLinkingScriptId === script.id;
          const isCardLinkPopoverOpen = activeCardLinkScriptId === script.id;
          const selectedCardCampaignId = cardCampaignByScriptId[script.id] || "";
          const isSelectedCampaignAlreadyLinked = linkedCampaigns.some(
            (campaign) => campaign.proposalId === selectedCardCampaignId
          );
          const cardLinkError = cardLinkErrorByScriptId[script.id];
          const cardActionFeedback = cardActionFeedbackByScriptId[script.id] || null;
          const canLinkFromCard = !isAdminViewer;
          const compactStatusClasses = getCompactStatusClasses(script.publication);
          const headerChips = [
            hasAdminAnnotation
              ? {
                  id: "feedback",
                  label: hasUnreadFeedback ? "Feedback novo" : "Feedback",
                  className:
                    "rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-rose-800 sm:text-[10px]",
                }
              : null,
            script.recommendation?.isRecommended
              ? {
                  id: "recommendation",
                  label: "Recomendação",
                  className:
                    "rounded-full border border-amber-300 bg-amber-200/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-900 sm:text-[10px]",
                }
              : null,
          ].filter(Boolean) as Array<{ id: string; label: string; className: string }>;
          const visibleHeaderChips = compactView ? [] : headerChips.slice(0, 2);
          const hiddenHeaderChipCount = compactView ? 0 : Math.max(0, headerChips.length - visibleHeaderChips.length);
          const deferredCardStyle =
            compactView
              ? index > 1
                ? { contentVisibility: "auto" as const, containIntrinsicSize: "112px 320px" }
                : undefined
              : index > 3
                ? { contentVisibility: "auto" as const, containIntrinsicSize: "320px 320px" }
                : undefined;

          return (
            <div
              key={script.id}
              style={deferredCardStyle}
              className={`${compactView ? `group relative flex flex-col overflow-visible rounded-[1.05rem] border border-zinc-100/80 bg-zinc-50/58 transition ${tone.compactCard}` : `dashboard-panel group relative flex h-72 flex-col overflow-visible text-left ring-1 ring-transparent transition hover:ring-pink-200/60 sm:h-80 sm:rounded-[2rem] rounded-[1.5rem] ${tone.ring}`}`}
            >
              {compactView ? (
                <div className="grid min-h-0 w-full flex-1 grid-cols-[60px_minmax(0,1fr)] items-start gap-x-3.5 px-2.5 py-2.5 text-left">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!isAuthenticated) {
                        void onRequestGoogleLogin();
                        return;
                      }
                      if (!canInteract) {
                        onOpenPremiumLinkingPaywall("scripts_card_link_post_btn");
                        return;
                      }
                      void onCardPublicationAction(event, script);
                    }}
                    disabled={isPublicationSaving}
                    className={`relative mt-0.5 h-[78px] w-[60px] shrink-0 overflow-hidden rounded-[0.95rem] border bg-white transition hover:brightness-[0.99] disabled:opacity-60 ${
                      isPosted ? "border-emerald-200/90" : tone.compactPlaceholder
                    }`}
                    title={isPosted ? "Desvincular do post" : "Vincular ao post"}
                    aria-label={isPosted ? "Desvincular do post" : "Vincular ao post"}
                  >
                    {getPublicationCoverUrl(script.publication) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getPublicationCoverUrl(script.publication)!}
                        alt={getCardTitle(script)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className={`flex h-full w-full flex-col items-center justify-center gap-1 ${
                          isPosted ? "bg-emerald-50/80 text-emerald-700" : tone.compactPlaceholder
                        }`}
                      >
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full ring-1 ${
                            isPosted ? "bg-white text-emerald-700 ring-emerald-200" : tone.compactPlaceholderIcon
                          }`}
                        >
                          {isPosted ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
                        </span>
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenScript(script)}
                    className="min-w-0 self-stretch text-left"
                  >
                    <div className="flex min-h-[79px] flex-col justify-between gap-2">
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-3">
                          {hasAdminAnnotation || !script.publication?.isPosted ? (
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-[0.01em] ${
                                hasAdminAnnotation
                                  ? hasUnreadFeedback
                                    ? "border-rose-200 bg-rose-50 text-rose-700"
                                    : "border-rose-100 bg-rose-50/70 text-rose-600"
                                  : compactStatusClasses
                              }`}
                            >
                              {hasAdminAnnotation
                                ? hasUnreadFeedback
                                  ? "Feedback novo"
                                  : "Feedback disponível"
                                : getCompactPublicationSummary(script.publication)}
                            </span>
                          ) : null}
                          {script.recommendation?.isRecommended ? (
                            <span className="dashboard-type-control mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700 ring-0">
                              Recomendado
                            </span>
                          ) : null}
                        </div>

                        <p className="dashboard-type-item-title line-clamp-2 pr-1 leading-[1.2] text-zinc-900">
                          {getCardTitle(script)}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {calendarOriginSummary ? (
                            <span className="dashboard-type-meta text-zinc-400">{calendarOriginSummary}</span>
                          ) : null}
                          {calendarOriginSummary ? <span className="dashboard-type-meta text-zinc-300">•</span> : null}
                          <span className="dashboard-type-meta text-zinc-400">
                            Atualizado em {formatDate(script.updatedAt)}
                          </span>
                        </div>

                        {hasAdminAnnotation ? (
                          <p className="line-clamp-1 text-[10px] font-medium leading-[1.3] text-zinc-500">
                            {`Feedback: ${script.adminAnnotation?.notes}`}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenScript(script)}
                  className="flex min-h-0 w-full flex-1 flex-col text-left"
                >
                  <div className={`rounded-t-[1.5rem] border-b px-4 py-2.5 sm:rounded-t-[2rem] ${tone.header}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`rounded-full border border-white/80 bg-white/72 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] sm:text-[10px] ${tone.text}`}
                      >
                        {getSourceLabel(script.source)}
                      </span>
                      <div className="flex max-w-[74%] flex-wrap justify-end gap-1.5">
                        {visibleHeaderChips.map((chip) => (
                          <span key={chip.id} className={chip.className}>
                            {chip.label}
                          </span>
                        ))}
                        {hiddenHeaderChipCount > 0 ? (
                          <span className="rounded-full border border-zinc-200 bg-white/85 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-zinc-700 sm:text-[10px]">
                            +{hiddenHeaderChipCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
                    <p className="line-clamp-2 text-[20px] font-semibold leading-[1.12] tracking-[-0.01em] text-zinc-900 sm:text-base sm:leading-tight sm:tracking-normal">
                      {getCardTitle(script)}
                    </p>

                    <div className="mt-3 flex-1 overflow-hidden">
                      <p className="line-clamp-7 overflow-hidden break-words text-[13px] leading-[1.45] text-zinc-600 sm:text-sm sm:leading-relaxed sm:text-zinc-500">
                        {getCardPreview(script)}
                      </p>
                    </div>

                    <div className="mt-3 space-y-1">
                      {hasAdminAnnotation ? (
                        <p
                          className={`line-clamp-1 text-[10px] leading-[1.35] sm:text-[11px] ${
                            hasUnreadFeedback ? "font-semibold text-rose-800" : "font-medium text-rose-700"
                          }`}
                        >
                          Feedback {hasUnreadFeedback ? "novo: " : ": "}
                          {script.adminAnnotation?.notes}
                        </p>
                      ) : null}
                      {script.recommendation?.isRecommended ? (
                        <p className="line-clamp-1 text-[10px] font-semibold leading-[1.35] text-amber-800 sm:text-[11px]">
                          Recomendação: {script.recommendation.recommendedByAdminName || "Admin"}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </button>
              )}

              <div className={`px-4 ${compactView ? "px-2.5 pb-2.5 pt-0" : "pb-4 pt-2 sm:px-5 sm:pt-2.5"}`}>
                {compactView ? null : (
                  <>
                    {calendarOriginSummary ? (
                      <p className="mb-1 text-[10px] font-semibold text-emerald-700 sm:text-[11px]">
                        {calendarOriginSummary}
                      </p>
                    ) : null}
                    <p className="mb-2 text-[10px] font-medium text-zinc-400 sm:text-[11px]">
                      Atualizado em {formatDate(script.updatedAt)}
                    </p>
                  </>
                )}
                <div className={`flex items-center gap-2 ${compactView ? "flex-col" : ""}`}>
                  {canLinkFromCard ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        if (!isAuthenticated) {
                          void onRequestGoogleLogin();
                          return;
                        }
                        if (!canInteract) {
                          onOpenPlanningPaywall("scripts_card_link_btn");
                          return;
                        }
                        void onOpenCardLinkPanel(event, script);
                      }}
                      disabled={isCardLinking || campaignsLoading}
                      className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-[1rem] border px-2.5 py-2 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${compactView ? "w-full" : "flex-1"} ${
                        compactView
                          ? linkingSummary.isLinked
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : tone.compactLinkButton
                          : linkingSummary.isLinked
                            ? "border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-200"
                            : "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                      }`}
                      title={
                        linkingSummary.isLinked
                          ? "Gerenciar vínculo com campanha"
                          : "Vincular este roteiro a uma campanha"
                      }
                      aria-label={
                        linkingSummary.isLinked
                          ? "Gerenciar vínculo com campanha"
                          : "Vincular este roteiro a uma campanha"
                      }
                    >
                      <Link2 size={13} />
                      {isCardLinking ? "Processando..." : linkingSummary.isLinked ? "Vínculo ativo" : "Vincular roteiro"}
                    </button>
                  ) : null}
                  {compactView ? null : (
                    <button
                      type="button"
                      onClick={(event) => {
                        if (!isAuthenticated) {
                          void onRequestGoogleLogin();
                          return;
                        }
                        if (!canInteract) {
                          onOpenPremiumLinkingPaywall("scripts_card_link_post_btn");
                          return;
                        }
                        void onCardPublicationAction(event, script);
                      }}
                      disabled={isPublicationSaving}
                      className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-[1rem] border px-2.5 py-2 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        canLinkFromCard ? "flex-1" : "w-full"
                      } ${
                        isPosted
                          ? "border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700"
                          : "border-zinc-200 bg-white/85 text-zinc-700 hover:border-zinc-300 hover:bg-white"
                      }`}
                      title={isPosted ? "Desvincular do post" : "Vincular ao post"}
                      aria-label={isPosted ? "Desvincular do post" : "Vincular ao post"}
                    >
                      {isPosted ? <Check size={13} strokeWidth={3} /> : <span className="h-2 w-2 rounded-full bg-current" />}
                      {isPublicationSaving ? "Salvando..." : isPosted ? "Desvincular do post" : "Vincular ao post"}
                    </button>
                  )}
                </div>
                {cardActionFeedback ? (
                  <p
                    className={`mt-1 text-center text-[10px] font-semibold leading-[1.25] transition-all duration-200 ease-out ${
                      cardActionFeedback.variant === "success"
                        ? "text-emerald-700"
                        : cardActionFeedback.variant === "error"
                          ? "text-rose-700"
                          : "text-slate-600"
                    } ${
                      cardActionFeedback.phase === "entering"
                        ? "translate-y-0.5 opacity-0"
                        : cardActionFeedback.phase === "leaving"
                          ? "-translate-y-0.5 opacity-0"
                          : "translate-y-0 opacity-100"
                    }`}
                  >
                    {cardActionFeedback.message}
                  </p>
                ) : null}
              </div>

              {isCardLinkPopoverOpen && canLinkFromCard ? (
                <MyScriptsCardLinkPopover
                  cardLinkPopoverRef={cardLinkPopoverRef}
                  linkingSummary={linkingSummary}
                  linkedCampaigns={linkedCampaigns}
                  selectedCardCampaignId={selectedCardCampaignId}
                  onCardCampaignChange={(value) => onCardCampaignChange(script.id, value)}
                  campaignsLoading={campaignsLoading}
                  isCardLinking={isCardLinking}
                  campaignOptions={campaignOptions}
                  cardLinkError={cardLinkError}
                  onCloseCardLinkPanel={onCloseCardLinkPanel}
                  isSelectedCampaignAlreadyLinked={isSelectedCampaignAlreadyLinked}
                  onCardUnlinkConfirm={() => onCardUnlinkConfirm(script)}
                  onCardLinkConfirm={() => onCardLinkConfirm(script)}
                />
              ) : null}

              {!compactView && quickPublishAnchorScriptId === script.id && !isPosted ? (
                <MyScriptsQuickPublishOverlay
                  compactView={false}
                  quickPublishPopoverRef={quickPublishPopoverRef}
                  script={script}
                  quickPublishQuery={quickPublishQuery}
                  onQuickPublishQueryChange={onQuickPublishQueryChange}
                  quickPublishSaving={quickPublishSaving}
                  contentOptionsLoading={contentOptionsLoading}
                  filteredQuickPublishOptions={filteredQuickPublishOptions}
                  quickPublishContentId={quickPublishContentId}
                  onQuickPublishContentChange={onQuickPublishContentChange}
                  formatDateCompact={formatDateCompact}
                  formatNumber={formatNumber}
                  selectedQuickPublishOption={selectedQuickPublishOption}
                  onCloseQuickPublish={onCloseQuickPublish}
                  onConfirmQuickPublish={onConfirmQuickPublish}
                  formatDate={formatDate}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {hasLocalMoreCards ? (
        <div
          ref={loadMoreRef}
          className="rounded-[1rem] border border-dashed border-zinc-200 bg-zinc-50/70 px-3 py-2 text-center text-[11px] text-zinc-500"
        >
          Carregando mais roteiros...
        </div>
      ) : null}

      {compactView && quickPublishTargetScript ? (
        <MyScriptsQuickPublishOverlay
          compactView
          quickPublishPopoverRef={quickPublishPopoverRef}
          script={quickPublishTargetScript}
          quickPublishQuery={quickPublishQuery}
          onQuickPublishQueryChange={onQuickPublishQueryChange}
          quickPublishSaving={quickPublishSaving}
          contentOptionsLoading={contentOptionsLoading}
          filteredQuickPublishOptions={filteredQuickPublishOptions}
          quickPublishContentId={quickPublishContentId}
          onQuickPublishContentChange={onQuickPublishContentChange}
          formatDateCompact={formatDateCompact}
          formatNumber={formatNumber}
          selectedQuickPublishOption={selectedQuickPublishOption}
          onCloseQuickPublish={onCloseQuickPublish}
          onConfirmQuickPublish={onConfirmQuickPublish}
          formatDate={formatDate}
        />
      ) : null}

      {!hasLocalMoreCards && hasMore ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={onLoadMore}
            className="dashboard-secondary-button px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            {loadingMore ? "Carregando..." : "Carregar mais"}
          </button>
        </div>
      ) : null}
    </>
  );
}
