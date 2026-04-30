"use client";

import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Save, Trash2, Sparkles, Plus, Undo2, Redo2, Check, Link2, Lock } from "lucide-react";
import { useToast } from "@/app/components/ui/ToastA11yProvider";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { redirectToGoogleConsentLogin } from "@/lib/auth/googleLogin";
import { track } from "@/lib/track";
import { PAYWALL_RETURN_STORAGE_KEY } from "@/types/paywall";
import {
  LAST_VIEWED_SCRIPTS_ADMIN_FEEDBACK_AT_KEY,
  LAST_VIEWED_SCRIPTS_RECOMMENDATIONS_AT_KEY,
} from "@/app/dashboard/hooks/useScriptRecommendationsNotifications";
import type { InlineAnnotation } from "./InlineScriptEditor";

const CreatorQuickSearch = dynamic(
  () => import("@/app/admin/creator-dashboard/components/CreatorQuickSearch"),
  { ssr: false, loading: () => null }
);
import { usePaywallOpener } from "@/app/dashboard/components/sidebar/hooks";

const MyScriptsEditorSurface = dynamic(
  () => import("./MyScriptsEditorSurface").then((mod) => mod.MyScriptsEditorSurface),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-full min-h-[360px] w-full animate-pulse rounded-[1.4rem] border border-zinc-100/80 bg-zinc-50/80"
        aria-hidden="true"
      />
    ),
  }
);

const MyScriptsCardsGrid = dynamic(
  () => import("./MyScriptsCardsGrid").then((mod) => mod.MyScriptsCardsGrid),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={`scripts-grid-loading-${idx}`}
            className="dashboard-panel h-72 animate-pulse rounded-[1.5rem] border border-zinc-100/80 bg-zinc-50/70 sm:h-80 sm:rounded-[2rem]"
            aria-hidden="true"
          />
        ))}
      </div>
    ),
  }
);

type ScriptOrigin = "manual" | "ai" | "planner";
type ScriptLinkType = "standalone" | "planner_slot";
type ScriptPostedFilter = "all" | "posted" | "unposted";

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

type CardActionFeedback = {
  variant: "success" | "error" | "info";
  message: string;
  phase: "entering" | "shown" | "leaving";
};

type CardActionFeedbackInput = {
  variant: "success" | "error" | "info";
  message: string;
};

type ScriptItem = {
  id: string;
  title: string;
  content: string;
  source: ScriptOrigin;
  linkType: ScriptLinkType;
  plannerRef?: ScriptPlannerRef | null;
  aiVersionId?: string | null;
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
  inlineAnnotations?: Array<{
    id: string;
    startIndex: number;
    endIndex: number;
    quote: string;
    comment: string;
    authorName: string;
    isOrphaned: boolean;
    resolved: boolean;
    createdAt: string;
  }>;
  publication?: ScriptPublication | null;
  linkingSummary?: ScriptLinkingSummary | null;
  createdAt: string;
  updatedAt: string;
};

type EditorState = {
  id: string | null;
  clientRequestId: string | null;
  title: string;
  content: string;
  slotId: string;
  recommendation: ScriptItem["recommendation"];
  adminAnnotation: ScriptItem["adminAnnotation"];
  adminAnnotationDraft: string;
  inlineAnnotations: InlineAnnotation[];
  isPosted: boolean;
  postedContentId: string;
  publication: ScriptPublication | null;
  aiPrompt: string;
  saving: boolean;
  saved: boolean;
  deleting: boolean;
  adjusting: boolean;
  error: string | null;
};

type DraftSnapshot = {
  title: string;
  content: string;
};

type DraftHistoryState = {
  past: DraftSnapshot[];
  present: DraftSnapshot;
  future: DraftSnapshot[];
};

type ViewerInfo = {
  id: string;
  role?: string | null;
  name?: string | null;
};

type AdminTargetUser = {
  id: string;
  name: string;
  profilePictureUrl?: string | null;
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

const PAGE_LIMIT = 12;
const CONTENT_OPTIONS_PAGE_LIMIT = 200;
const CARD_PREVIEW_MAX_CHARS = 210;
const HISTORY_LIMIT = 80;
const HISTORY_TYPING_DELAY_MS = 450;
const FETCH_RETRY_DELAYS_MS = [350, 1000];
const INITIAL_LIST_AUTO_RETRY_DELAY_MS = 1800;
const MAX_INITIAL_LIST_AUTO_RETRIES = 3;
const DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function shouldRetryFetchStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

async function fetchJsonWithRetry(
  input: string,
  init?: RequestInit,
  options?: { retries?: number; timeoutMs?: number }
) {
  const retries = Math.max(0, Math.min(options?.retries ?? FETCH_RETRY_DELAYS_MS.length, FETCH_RETRY_DELAYS_MS.length));
  const timeoutMs =
    typeof options?.timeoutMs === "number" && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? Math.floor(options.timeoutMs)
      : 20_000;

  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort(new Error("Request timeout"));
    }, timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      const shouldRetry = !response.ok && shouldRetryFetchStatus(response.status) && attempt < retries;
      if (!shouldRetry) {
        return { response, payload };
      }
    } catch (error) {
      const isAbortError =
        error instanceof DOMException
          ? error.name === "AbortError"
          : error instanceof Error
            ? error.name === "AbortError"
            : false;
      const timeoutError = isAbortError ? new Error("Request timeout") : error;
      if (attempt >= retries) {
        throw timeoutError;
      }
    } finally {
      window.clearTimeout(timeoutId);
    }

    await wait(FETCH_RETRY_DELAYS_MS[attempt] ?? FETCH_RETRY_DELAYS_MS[FETCH_RETRY_DELAYS_MS.length - 1] ?? 350);
  }
}

function getReadableFetchErrorMessage(error: unknown, fallback: string) {
  const rawMessage = error instanceof Error ? error.message.trim() : "";
  if (!rawMessage) return fallback;
  const normalized = rawMessage.toLowerCase();
  if (
    normalized === "failed to fetch" ||
    normalized === "load failed" ||
    normalized.includes("networkerror") ||
    normalized.includes("network request failed")
  ) {
    return fallback;
  }
  return rawMessage;
}

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
      compactChip: "border-indigo-200 bg-indigo-50/90 text-indigo-700",
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
      compactChip: "border-emerald-200 bg-emerald-50/90 text-emerald-700",
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
    compactChip: "border-amber-200 bg-amber-50/90 text-amber-700",
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
  const month = date
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "")
    .trim();
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

function getPostedContentLabel(publication?: ScriptPublication | null) {
  const caption = publication?.content?.caption?.trim();
  if (caption) return caption;
  return "Conteúdo publicado";
}

function getPublicationCoverUrl(publication?: ScriptPublication | null) {
  const coverUrl = publication?.content?.coverUrl?.trim();
  return coverUrl ? coverUrl : null;
}

function getCompactPublicationSummary(publication?: ScriptPublication | null) {
  if (!publication?.isPosted) return "Sem conteúdo vinculado";
  return null;
}

function getCompactCardActionHint(publication?: ScriptPublication | null) {
  return publication?.isPosted ? "Abrir" : "Completar";
}

function getCompactStatusClasses(publication?: ScriptPublication | null) {
  if (publication?.isPosted) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function getCompactActionClasses(source: ScriptOrigin, publication?: ScriptPublication | null) {
  if (publication?.isPosted) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return getSourceCardTone(source).compactAction;
}

function buildContentOptionLabel(option: ContentOption) {
  const dateLabel = option.postDate ? formatDate(option.postDate) : "sem data";
  const engagementLabel =
    typeof option.engagement === "number" && Number.isFinite(option.engagement)
      ? `${option.engagement.toFixed(2)}`
      : "-";
  return `${option.caption} · ${dateLabel} · Eng: ${engagementLabel}`;
}

function normalizeContentOption(item: any): ContentOption | null {
  const id = String(item?.id ?? "");
  if (!id) return null;
  return {
    id,
    caption:
      typeof item?.caption === "string" && item.caption.trim()
        ? item.caption.trim()
        : "Conteúdo sem legenda",
    postDate: typeof item?.postDate === "string" ? item.postDate : null,
    postLink: typeof item?.postLink === "string" ? item.postLink : null,
    type: typeof item?.type === "string" ? item.type : null,
    coverUrl: typeof item?.coverUrl === "string" ? item.coverUrl : null,
    engagement:
      typeof item?.engagement === "number" && Number.isFinite(item.engagement)
        ? item.engagement
        : null,
    totalInteractions:
      typeof item?.totalInteractions === "number" && Number.isFinite(item.totalInteractions)
        ? item.totalInteractions
        : null,
  };
}

function buildEmptyLinkingSummary(): ScriptLinkingSummary {
  return {
    isLinked: false,
    totalLinks: 0,
    campaigns: [],
  };
}

function normalizeScriptLinkingSummary(summary?: ScriptLinkingSummary | null): ScriptLinkingSummary {
  if (!summary) return buildEmptyLinkingSummary();
  const campaigns = Array.isArray(summary.campaigns)
    ? summary.campaigns
      .filter((item) => item && typeof item.proposalId === "string" && typeof item.linkId === "string")
      .map((item) => ({
        proposalId: item.proposalId,
        linkId: item.linkId,
        campaignTitle: item.campaignTitle || "Campanha sem título",
        brandName: item.brandName || "Marca",
        linkedAt: item.linkedAt || null,
      }))
    : [];
  const totalLinks =
    typeof summary.totalLinks === "number" && Number.isFinite(summary.totalLinks)
      ? Math.max(summary.totalLinks, campaigns.length)
      : campaigns.length;
  return {
    isLinked: Boolean(summary.isLinked) || totalLinks > 0,
    totalLinks,
    campaigns,
  };
}

function withNormalizedLinkingSummary(script: ScriptItem): ScriptItem {
  return {
    ...script,
    linkingSummary: normalizeScriptLinkingSummary(script.linkingSummary),
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

function createInitialEditorState(): EditorState {
  const generatedRequestId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id: null,
    clientRequestId: generatedRequestId,
    title: "",
    content: "",
    slotId: "",
    recommendation: null,
    adminAnnotation: null,
    adminAnnotationDraft: "",
    inlineAnnotations: [],
    isPosted: false,
    postedContentId: "",
    publication: null,
    aiPrompt: "",
    saving: false,
    saved: false,
    deleting: false,
    adjusting: false,
    error: null,
  };
}

export type MyScriptsPageProps = {
  viewer?: ViewerInfo;
  compactView?: boolean;
  canInteract?: boolean;
  showPreviewBanner?: boolean;
  viewerPending?: boolean;
  previewMode?: boolean;
  initialInstagramConnected?: boolean;
  requestedScriptId?: string | null;
  onFunnelScriptOpen?: (script: ScriptItem) => void;
  onFunnelScriptSaved?: (script: ScriptItem) => void;
  onFunnelContentLinked?: (script: ScriptItem) => void;
};

export function MyScriptsPageSurface({
  viewer,
  compactView = false,
  canInteract = true,
  showPreviewBanner = true,
  viewerPending = false,
  previewMode = false,
  initialInstagramConnected = false,
  requestedScriptId: requestedScriptIdProp,
  onFunnelScriptOpen,
  onFunnelScriptSaved,
  onFunnelContentLinked,
}: MyScriptsPageProps) {
  const openPaywall = usePaywallOpener();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(createInitialEditorState());
  const [cardsReady, setCardsReady] = useState(!compactView);
  const [activeInlineAnnotationId, setActiveInlineAnnotationId] = useState<string | null>(null);
  const [adminTargetUser, setAdminTargetUser] = useState<AdminTargetUser | null>(null);
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [campaignOptionsReady, setCampaignOptionsReady] = useState(false);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [linkingToCampaign, setLinkingToCampaign] = useState(false);
  const [activeCardLinkScriptId, setActiveCardLinkScriptId] = useState<string | null>(null);
  const [cardCampaignByScriptId, setCardCampaignByScriptId] = useState<Record<string, string>>({});
  const [cardLinkingScriptId, setCardLinkingScriptId] = useState<string | null>(null);
  const [cardLinkErrorByScriptId, setCardLinkErrorByScriptId] = useState<Record<string, string>>({});
  const [cardActionFeedbackByScriptId, setCardActionFeedbackByScriptId] = useState<
    Record<string, CardActionFeedback>
  >({});
  const [contentOptions, setContentOptions] = useState<ContentOption[]>([]);
  const [contentOptionsReady, setContentOptionsReady] = useState(false);
  const [contentOptionsLoading, setContentOptionsLoading] = useState(false);
  const [publicationSavingScriptId, setPublicationSavingScriptId] = useState<string | null>(null);
  const [quickPublishAnchorScriptId, setQuickPublishAnchorScriptId] = useState<string | null>(null);
  const [quickPublishContentId, setQuickPublishContentId] = useState("");
  const [quickPublishSaving, setQuickPublishSaving] = useState(false);
  const [quickPublishQuery, setQuickPublishQuery] = useState("");
  const [postedFilter, setPostedFilter] = useState<ScriptPostedFilter>("all");
  const requestedScriptId = useMemo(() => {
    const propValue = typeof requestedScriptIdProp === "string" ? requestedScriptIdProp.trim() : "";
    if (propValue) return propValue;
    const value = searchParams?.get("scriptId");
    if (!value) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }, [requestedScriptIdProp, searchParams]);
  const requestedProposalId = useMemo(() => {
    const value = searchParams?.get("proposalId");
    if (!value) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }, [searchParams]);
  const { toast } = useToast();
  const isAdminViewer = viewer?.role === "admin";
  const instagramConnected = isAdminViewer ? true : initialInstagramConnected;
  const isAuthenticated = Boolean(viewer?.id);
  const isPreviewMode = previewMode || (!isAdminViewer && !isAuthenticated && !viewerPending);
  const isSessionPending = !isAdminViewer && !isAuthenticated && viewerPending;
  const requestGoogleLogin = useCallback(() => {
    const callbackUrl =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}${window.location.hash}`
        : "/calendar";
    redirectToGoogleConsentLogin(callbackUrl);
  }, []);
  const openPremiumLinkingPaywall = useCallback(
    (source: string) => {
      openPaywall("planning", { source });
    },
    [openPaywall]
  );
  const openInstagramConnectForLinking = useCallback(
    (source: string) => {
      if (typeof window !== "undefined") {
        const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        try {
          window.sessionStorage.setItem(
            PAYWALL_RETURN_STORAGE_KEY,
            JSON.stringify({
              context: "planning",
              source,
              returnTo,
              ts: Date.now(),
            })
          );
        } catch {
          /* storage failures are non-fatal */
        }
      }

      router.push("/dashboard/instagram/connect?next=planner");
    },
    [router]
  );
  const ensureLoggedIn = useCallback(async () => {
    if (isAuthenticated) return true;
    await requestGoogleLogin();
    return false;
  }, [isAuthenticated, requestGoogleLogin]);
  const ensureInstagramConnectedForLinking = useCallback(
    (source: string) => {
      if (instagramConnected) return true;
      openInstagramConnectForLinking(source);
      return false;
    },
    [instagramConnected, openInstagramConnectForLinking]
  );
  const [, setLastViewedScriptsRecommendationsAt] = useLocalStorage<string>(
    LAST_VIEWED_SCRIPTS_RECOMMENDATIONS_AT_KEY,
    ""
  );
  const [lastViewedScriptsFeedbackAt, setLastViewedScriptsFeedbackAt] = useLocalStorage<string>(
    LAST_VIEWED_SCRIPTS_ADMIN_FEEDBACK_AT_KEY,
    ""
  );
  const [history, setHistory] = useState<DraftHistoryState>({
    past: [],
    present: { title: "", content: "" },
    future: [],
  });
  const historyRef = useRef<DraftHistoryState>({
    past: [],
    present: { title: "", content: "" },
    future: [],
  });
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSnapshotRef = useRef<DraftSnapshot | null>(null);
  const hasAutoOpenedQueryScriptRef = useRef<string | null>(null);
  const hasFetchedCampaignOptionsRef = useRef(false);
  const hasFetchedContentOptionsRef = useRef(false);
  const contentOptionsNextCursorRef = useRef<string | null>(null);
  const contentOptionsHydratingRef = useRef(false);
  const contentOptionsLoadErrorRef = useRef<string | null>(null);
  const latestFeedbackToastRef = useRef<string>("");
  const nextCursorRef = useRef<string | null>(null);
  const scriptsRequestIdRef = useRef(0);
  const initialListAutoRetryCountRef = useRef(0);
  const initialListAutoRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quickPublishPopoverRef = useRef<HTMLDivElement | null>(null);
  const cardLinkPopoverRef = useRef<HTMLDivElement | null>(null);
  const cardActionFeedbackTimersRef = useRef<
    Map<
      string,
      {
        enter?: ReturnType<typeof setTimeout>;
        dismiss?: ReturnType<typeof setTimeout>;
        remove?: ReturnType<typeof setTimeout>;
      }
    >
  >(new Map());

  const isActingOnBehalf = Boolean(
    isAdminViewer &&
    adminTargetUser?.id &&
    viewer?.id &&
    adminTargetUser.id !== viewer.id
  );
  const targetUserId = isActingOnBehalf ? adminTargetUser?.id ?? null : null;
  const handleGoToCalendar = useCallback(() => {
    router.push("/calendar");
  }, [router]);
  const handleReturnToCampaign = useCallback(() => {
    if (!requestedProposalId) return;
    router.push(`/campaigns?proposalId=${encodeURIComponent(requestedProposalId)}`);
  }, [requestedProposalId, router]);

  useEffect(() => {
    hasAutoOpenedQueryScriptRef.current = null;
  }, [requestedScriptId, targetUserId]);

  useEffect(() => {
    initialListAutoRetryCountRef.current = 0;
    if (!initialListAutoRetryTimerRef.current) return;
    clearTimeout(initialListAutoRetryTimerRef.current);
    initialListAutoRetryTimerRef.current = null;
  }, [postedFilter, targetUserId]);

  useEffect(() => {
    nextCursorRef.current = nextCursor;
  }, [nextCursor]);

  const mergeContentOptions = useCallback((incoming: ContentOption[]) => {
    setContentOptions((prev) => {
      if (!incoming.length) return prev;
      const next = [...prev];
      const seen = new Set(prev.map((item) => item.id));
      incoming.forEach((item) => {
        if (seen.has(item.id)) return;
        seen.add(item.id);
        next.push(item);
      });
      return next;
    });
  }, []);

  const ensureCampaignOptionsLoaded = useCallback(async () => {
    if (isAdminViewer) {
      return [];
    }
    if (hasFetchedCampaignOptionsRef.current) {
      return campaignOptions;
    }

    try {
      setCampaignsLoading(true);
      const { response, payload } = await fetchJsonWithRetry("/api/proposals?limit=200&view=linking", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível carregar campanhas.");
      }

      const items = Array.isArray(payload?.items) ? payload.items : [];
      const options: CampaignOption[] = items
        .map((item: any) => ({
          id: String(item?.id ?? ""),
          campaignTitle:
            typeof item?.campaignTitle === "string" && item.campaignTitle.trim()
              ? item.campaignTitle.trim()
              : "Campanha sem título",
          brandName:
            typeof item?.brandName === "string" && item.brandName.trim()
              ? item.brandName.trim()
              : "Marca",
        }))
        .filter((item: CampaignOption) => Boolean(item.id));

      setCampaignOptions(options);
      setCampaignOptionsReady(true);
      hasFetchedCampaignOptionsRef.current = true;
      setSelectedCampaignId((current) => {
        if (current && options.some((option) => option.id === current)) {
          return current;
        }
        return options[0]?.id ?? "";
      });

      return options;
    } catch (error: any) {
      setCampaignOptions([]);
      setCampaignOptionsReady(false);
      setSelectedCampaignId("");
      hasFetchedCampaignOptionsRef.current = false;
      toast({
        variant: "error",
        title: error?.message || "Falha ao carregar campanhas para vinculação.",
      });
      return [];
    } finally {
      setCampaignsLoading(false);
    }
  }, [campaignOptions, isAdminViewer, toast]);

  const hydrateRemainingContentOptions = useCallback(async () => {
    if (contentOptionsHydratingRef.current) return;
    if (!contentOptionsNextCursorRef.current) return;

    contentOptionsHydratingRef.current = true;
    const seenCursors = new Set<string>();

    try {
      while (contentOptionsNextCursorRef.current) {
        const currentCursor = contentOptionsNextCursorRef.current;
        if (!currentCursor || seenCursors.has(currentCursor)) break;
        const cursor: string = currentCursor;
        seenCursors.add(cursor);

        const params = new URLSearchParams();
        params.set("limit", String(CONTENT_OPTIONS_PAGE_LIMIT));
        params.set("cursor", cursor);
        if (targetUserId) params.set("targetUserId", targetUserId);

        const { response, payload } = await fetchJsonWithRetry(`/api/scripts/content-options?${params.toString()}`, {
          cache: "no-store",
        });

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || "Não foi possível carregar conteúdos publicados.");
        }

        const nextPageItems = (Array.isArray(payload?.items) ? payload.items : [])
          .map((item: any) => normalizeContentOption(item))
          .filter(Boolean) as ContentOption[];
        mergeContentOptions(nextPageItems);

        const nextCursor =
          typeof payload?.pagination?.nextCursor === "string" && payload.pagination.nextCursor.trim()
            ? payload.pagination.nextCursor.trim()
            : null;
        contentOptionsNextCursorRef.current =
          Boolean(payload?.pagination?.hasMore) && Boolean(nextCursor) && nextCursor !== cursor
            ? nextCursor
            : null;
      }
    } catch (error: any) {
      const title = getReadableFetchErrorMessage(
        error,
        "Falha ao carregar conteúdos adicionais para vinculação."
      );
      toast({
        variant: "warning",
        title,
      });
    } finally {
      contentOptionsHydratingRef.current = false;
    }
  }, [mergeContentOptions, targetUserId, toast]);

  const ensureContentOptionsLoaded = useCallback(async () => {
    if (hasFetchedContentOptionsRef.current) {
      if (!compactView && contentOptionsNextCursorRef.current && !contentOptionsHydratingRef.current) {
        void hydrateRemainingContentOptions();
      }
      return contentOptions;
    }

    try {
      setContentOptionsLoading(true);
      const params = new URLSearchParams();
      params.set("limit", String(CONTENT_OPTIONS_PAGE_LIMIT));
      if (targetUserId) params.set("targetUserId", targetUserId);

      const { response, payload } = await fetchJsonWithRetry(`/api/scripts/content-options?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Não foi possível carregar conteúdos publicados.");
      }

      const options = (Array.isArray(payload?.items) ? payload.items : [])
        .map((item: any) => normalizeContentOption(item))
        .filter(Boolean) as ContentOption[];

      setContentOptions(options);
      setContentOptionsReady(true);
      hasFetchedContentOptionsRef.current = true;
      contentOptionsLoadErrorRef.current = null;
      const nextCursor =
        typeof payload?.pagination?.nextCursor === "string" && payload.pagination.nextCursor.trim()
          ? payload.pagination.nextCursor.trim()
          : null;
      contentOptionsNextCursorRef.current =
        Boolean(payload?.pagination?.hasMore) && Boolean(nextCursor) ? nextCursor : null;
      if (!compactView && contentOptionsNextCursorRef.current) {
        void hydrateRemainingContentOptions();
      }
      return options;
    } catch (error: any) {
      const title = getReadableFetchErrorMessage(
        error,
        "Falha ao carregar conteúdos para vinculação. Tente novamente em instantes."
      );
      contentOptionsNextCursorRef.current = null;
      hasFetchedContentOptionsRef.current = false;
      setContentOptionsReady(false);
      contentOptionsLoadErrorRef.current = title;
      toast({
        variant: "warning",
        title,
      });
      return null;
    } finally {
      setContentOptionsLoading(false);
    }
  }, [compactView, contentOptions, hydrateRemainingContentOptions, targetUserId, toast]);

  useEffect(() => {
    if (!quickPublishAnchorScriptId) return;
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (quickPublishPopoverRef.current?.contains(target)) return;
      setQuickPublishAnchorScriptId(null);
      setQuickPublishQuery("");
      setQuickPublishContentId("");
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [quickPublishAnchorScriptId]);

  useEffect(() => {
    if (!activeCardLinkScriptId) return;
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (cardLinkPopoverRef.current?.contains(target)) return;
      setActiveCardLinkScriptId(null);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [activeCardLinkScriptId]);

  useEffect(() => {
    setQuickPublishAnchorScriptId(null);
    setQuickPublishContentId("");
    setQuickPublishQuery("");
    setActiveCardLinkScriptId(null);
  }, [postedFilter]);

  const unreadFeedbackScriptIds = useMemo(() => {
    const ids = new Set<string>();
    if (!scripts.length) return ids;

    const lastViewedTs = lastViewedScriptsFeedbackAt
      ? new Date(lastViewedScriptsFeedbackAt).getTime()
      : null;
    const hasValidLastViewed = Number.isFinite(lastViewedTs);

    scripts.forEach((script) => {
      const notes = script.adminAnnotation?.notes?.trim();
      if (!notes) return;
      const sourceTime = script.adminAnnotation?.updatedAt || script.updatedAt;
      const ts = new Date(sourceTime).getTime();
      if (!Number.isFinite(ts)) return;
      if (!hasValidLastViewed || !lastViewedTs || ts > lastViewedTs) {
        ids.add(script.id);
      }
    });

    return ids;
  }, [lastViewedScriptsFeedbackAt, scripts]);

  const fetchScripts = useCallback(
    async (opts?: { reset?: boolean; cursor?: string | null }) => {
      const reset = Boolean(opts?.reset);
      const requestId = ++scriptsRequestIdRef.current;
      const scriptsPageLimit = compactView ? 8 : PAGE_LIMIT;
      setGlobalError(null);

      if (reset) setLoadingList(true);
      else setLoadingMore(true);

      const params = new URLSearchParams();
      params.set("limit", String(scriptsPageLimit));
      params.set("posted", postedFilter);
      const cursor = opts?.cursor ?? nextCursorRef.current;
      if (!reset && cursor) params.set("cursor", cursor);
      if (targetUserId) params.set("targetUserId", targetUserId);

      try {
        const { response, payload } = await fetchJsonWithRetry(
          `/api/scripts?${params.toString()}`,
          {
            cache: "no-store",
          },
          { retries: 1, timeoutMs: 12_000 }
        );
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || "Não foi possível carregar os roteiros.");
        }
        if (scriptsRequestIdRef.current !== requestId) return;

        const incomingRaw = Array.isArray(payload?.items) ? (payload.items as ScriptItem[]) : [];
        const incoming = incomingRaw.map((item) => withNormalizedLinkingSummary(item));
        const cursor = payload?.pagination?.nextCursor ?? null;
        const more = Boolean(payload?.pagination?.hasMore);

        setScripts((prev) => {
          if (reset) return incoming;
          const map = new Map<string, ScriptItem>();
          [...prev, ...incoming].forEach((item) => map.set(item.id, item));
          return Array.from(map.values());
        });
        setNextCursor(cursor);
        setHasMore(more);
        initialListAutoRetryCountRef.current = 0;
        if (initialListAutoRetryTimerRef.current) {
          clearTimeout(initialListAutoRetryTimerRef.current);
          initialListAutoRetryTimerRef.current = null;
        }
      } catch (err: any) {
        if (scriptsRequestIdRef.current !== requestId) return;
        setGlobalError(err?.message || "Erro inesperado ao carregar roteiros.");
        if (
          reset &&
          initialListAutoRetryCountRef.current < MAX_INITIAL_LIST_AUTO_RETRIES
        ) {
          initialListAutoRetryCountRef.current += 1;
          if (initialListAutoRetryTimerRef.current) {
            clearTimeout(initialListAutoRetryTimerRef.current);
          }
          initialListAutoRetryTimerRef.current = setTimeout(() => {
            initialListAutoRetryTimerRef.current = null;
            void fetchScripts({ reset: true });
          }, INITIAL_LIST_AUTO_RETRY_DELAY_MS);
        }
      } finally {
        if (scriptsRequestIdRef.current !== requestId) return;
        if (reset) setLoadingList(false);
        else setLoadingMore(false);
      }
    },
    [compactView, postedFilter, targetUserId]
  );

  useEffect(() => {
    if (isSessionPending) return undefined;
    if (isPreviewMode) {
      let cancelled = false;
      setLoadingList(true);
      setLoadingMore(false);
      setGlobalError(null);
      setNextCursor(null);
      setHasMore(false);
      void import("./MyScriptsPreviewData")
        .then((mod) => {
          if (cancelled) return;
          setScripts(mod.PREVIEW_SCRIPTS as ScriptItem[]);
          setLoadingList(false);
        })
        .catch((error) => {
          if (cancelled) return;
          console.warn("[MyScripts] Falha ao carregar preview local", error);
          setScripts([]);
          setGlobalError("Não foi possível carregar os roteiros demonstrativos.");
          setLoadingList(false);
        });
      return () => {
        cancelled = true;
      };
    }
    setScripts([]);
    setNextCursor(null);
    setHasMore(false);
    setGlobalError(null);
    setLoadingList(true);
    setLoadingMore(false);
    void fetchScripts({ reset: true });
    return undefined;
  }, [fetchScripts, isPreviewMode, isSessionPending]);

  useEffect(() => {
    if (!compactView) {
      setCardsReady(true);
      return;
    }
    if (loadingList || editorOpen || scripts.length === 0) {
      setCardsReady(false);
      return;
    }

    setCardsReady(false);
    let fallbackTimeoutId: number | null = null;
    const idleWindow = window as typeof window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let idleHandle: number | null = null;
    const frame = window.requestAnimationFrame(() => {
      if (typeof idleWindow.requestIdleCallback === "function") {
        idleHandle = idleWindow.requestIdleCallback(() => {
          setCardsReady(true);
        }, { timeout: 180 });
        return;
      }
      fallbackTimeoutId = window.setTimeout(() => setCardsReady(true), 90);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (idleHandle !== null && typeof idleWindow.cancelIdleCallback === "function") {
        idleWindow.cancelIdleCallback(idleHandle);
      }
      if (fallbackTimeoutId) {
        window.clearTimeout(fallbackTimeoutId);
      }
    };
  }, [compactView, editorOpen, loadingList, scripts.length]);

  useEffect(() => {
    if (loadingList) return;
    if (isActingOnBehalf) return;
    if (!scripts.length) return;

    const hasRecommendations = scripts.some((script) => script.recommendation?.isRecommended);
    if (!hasRecommendations) return;

    setLastViewedScriptsRecommendationsAt(new Date().toISOString());
  }, [isActingOnBehalf, loadingList, scripts, setLastViewedScriptsRecommendationsAt]);

  useEffect(() => {
    if (loadingList) return;
    if (isActingOnBehalf) return;
    if (isAdminViewer) return;
    if (!scripts.length) return;

    const unreadFeedbackScripts = scripts.filter((script) => unreadFeedbackScriptIds.has(script.id));
    if (!unreadFeedbackScripts.length) return;

    const newestFeedbackAt = unreadFeedbackScripts.reduce((latest, script) => {
      const sourceTime = script.adminAnnotation?.updatedAt || script.updatedAt;
      const ts = new Date(sourceTime).getTime();
      if (!Number.isFinite(ts)) return latest;
      return Math.max(latest, ts);
    }, 0);

    const feedbackSignature = `${unreadFeedbackScripts.length}-${newestFeedbackAt}`;
    if (latestFeedbackToastRef.current !== feedbackSignature) {
      toast({
        variant: "info",
        title:
          unreadFeedbackScripts.length === 1
            ? "Você recebeu um novo feedback em roteiro."
            : `Você recebeu ${unreadFeedbackScripts.length} novos feedbacks em roteiros.`,
      });
      latestFeedbackToastRef.current = feedbackSignature;
    }

    setLastViewedScriptsFeedbackAt(new Date().toISOString());
  }, [
    isActingOnBehalf,
    isAdminViewer,
    loadingList,
    scripts,
    setLastViewedScriptsFeedbackAt,
    toast,
    unreadFeedbackScriptIds,
  ]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const mainScroller = document.querySelector("#dashboard-main > div") as HTMLElement | null;
    if (!mainScroller || !editorOpen) return;

    const prevOverflow = mainScroller.style.overflow;
    const prevOverflowY = mainScroller.style.overflowY;
    mainScroller.style.overflow = "hidden";
    mainScroller.style.overflowY = "hidden";

    return () => {
      mainScroller.style.overflow = prevOverflow;
      mainScroller.style.overflowY = prevOverflowY;
    };
  }, [editorOpen]);

  const patchEditor = useCallback((patch: Partial<EditorState>) => {
    setEditor((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearCardActionFeedbackTimers = useCallback((scriptId: string) => {
    const timers = cardActionFeedbackTimersRef.current.get(scriptId);
    if (!timers) return;
    if (timers.enter) clearTimeout(timers.enter);
    if (timers.dismiss) clearTimeout(timers.dismiss);
    if (timers.remove) clearTimeout(timers.remove);
    cardActionFeedbackTimersRef.current.delete(scriptId);
  }, []);

  const removeCardActionFeedback = useCallback(
    (scriptId: string) => {
      setCardActionFeedbackByScriptId((prev) => {
        if (!prev[scriptId]) return prev;
        const next = { ...prev };
        delete next[scriptId];
        return next;
      });
      clearCardActionFeedbackTimers(scriptId);
    },
    [clearCardActionFeedbackTimers]
  );

  const startCardActionFeedbackExit = useCallback(
    (scriptId: string) => {
      setCardActionFeedbackByScriptId((prev) => {
        const current = prev[scriptId];
        if (!current || current.phase === "leaving") return prev;
        return {
          ...prev,
          [scriptId]: {
            ...current,
            phase: "leaving",
          },
        };
      });

      const timers = cardActionFeedbackTimersRef.current.get(scriptId) || {};
      if (timers.remove) clearTimeout(timers.remove);
      timers.remove = setTimeout(() => {
        removeCardActionFeedback(scriptId);
      }, 220);
      cardActionFeedbackTimersRef.current.set(scriptId, timers);
    },
    [removeCardActionFeedback]
  );

  const setCardActionFeedback = useCallback(
    (
      scriptId: string,
      feedback: CardActionFeedbackInput | null,
      options?: { ttlMs?: number }
    ) => {
      clearCardActionFeedbackTimers(scriptId);

      if (!feedback) {
        startCardActionFeedbackExit(scriptId);
        return;
      }

      setCardActionFeedbackByScriptId((prev) => ({
        ...prev,
        [scriptId]: { ...feedback, phase: "entering" },
      }));

      const timers = cardActionFeedbackTimersRef.current.get(scriptId) || {};
      timers.enter = setTimeout(() => {
        setCardActionFeedbackByScriptId((prev) => {
          const current = prev[scriptId];
          if (!current) return prev;
          if (current.message !== feedback.message || current.variant !== feedback.variant) return prev;
          return {
            ...prev,
            [scriptId]: {
              ...current,
              phase: "shown",
            },
          };
        });
      }, 16);

      const ttlMs = options?.ttlMs ?? 4500;
      timers.dismiss = setTimeout(() => {
        startCardActionFeedbackExit(scriptId);
      }, ttlMs);
      cardActionFeedbackTimersRef.current.set(scriptId, timers);
    },
    [clearCardActionFeedbackTimers, startCardActionFeedbackExit]
  );

  const clearHistoryTimer = useCallback(() => {
    if (!historyTimerRef.current) return;
    clearTimeout(historyTimerRef.current);
    historyTimerRef.current = null;
  }, []);

  const resetDraftHistory = useCallback(
    (snapshot: DraftSnapshot) => {
      pendingSnapshotRef.current = null;
      clearHistoryTimer();
      const nextHistory: DraftHistoryState = {
        past: [],
        present: snapshot,
        future: [],
      };
      historyRef.current = nextHistory;
      setHistory(nextHistory);
    },
    [clearHistoryTimer]
  );

  useEffect(() => {
    setEditorOpen(false);
    setEditor(createInitialEditorState());
    resetDraftHistory({ title: "", content: "" });
    setNextCursor(null);
    setHasMore(false);
    setContentOptions([]);
    setContentOptionsReady(false);
    hasFetchedContentOptionsRef.current = false;
    contentOptionsNextCursorRef.current = null;
    contentOptionsHydratingRef.current = false;
    contentOptionsLoadErrorRef.current = null;
    setPublicationSavingScriptId(null);
    setQuickPublishAnchorScriptId(null);
    setQuickPublishContentId("");
    setQuickPublishSaving(false);
    setQuickPublishQuery("");
    setActiveCardLinkScriptId(null);
    setCardCampaignByScriptId({});
    setCardLinkingScriptId(null);
    setCardLinkErrorByScriptId({});
    setCardActionFeedbackByScriptId({});
    cardActionFeedbackTimersRef.current.forEach((timers) => {
      if (timers.enter) clearTimeout(timers.enter);
      if (timers.dismiss) clearTimeout(timers.dismiss);
      if (timers.remove) clearTimeout(timers.remove);
    });
    cardActionFeedbackTimersRef.current.clear();
    setCampaignOptions([]);
    setCampaignOptionsReady(false);
    setSelectedCampaignId("");
    hasFetchedCampaignOptionsRef.current = false;
  }, [targetUserId, resetDraftHistory]);

  const handleEditorCampaignOptionsIntent = useCallback(() => {
    if (isAdminViewer || campaignsLoading || campaignOptionsReady) return;
    void ensureCampaignOptionsLoaded();
  }, [campaignOptionsReady, campaignsLoading, ensureCampaignOptionsLoaded, isAdminViewer]);

  const handleEditorPostedContentIntent = useCallback(() => {
    if (contentOptionsLoading || contentOptionsReady) return;
    void ensureContentOptionsLoaded();
  }, [contentOptionsLoading, contentOptionsReady, ensureContentOptionsLoaded]);

  const commitDraftSnapshot = useCallback((snapshot: DraftSnapshot) => {
    const current = historyRef.current;
    if (snapshot.title === current.present.title && snapshot.content === current.present.content) {
      return;
    }

    const nextPast = [...current.past, current.present];
    const trimmedPast = nextPast.length > HISTORY_LIMIT ? nextPast.slice(nextPast.length - HISTORY_LIMIT) : nextPast;
    const nextHistory: DraftHistoryState = {
      past: trimmedPast,
      present: snapshot,
      future: [],
    };
    historyRef.current = nextHistory;
    setHistory(nextHistory);
  }, []);

  const flushPendingDraftSnapshot = useCallback(() => {
    const pending = pendingSnapshotRef.current;
    if (!pending) return;
    pendingSnapshotRef.current = null;
    clearHistoryTimer();
    commitDraftSnapshot(pending);
  }, [clearHistoryTimer, commitDraftSnapshot]);

  const scheduleDraftSnapshot = useCallback(
    (snapshot: DraftSnapshot) => {
      pendingSnapshotRef.current = snapshot;
      clearHistoryTimer();
      historyTimerRef.current = setTimeout(() => {
        const pending = pendingSnapshotRef.current;
        pendingSnapshotRef.current = null;
        historyTimerRef.current = null;
        if (!pending) return;
        commitDraftSnapshot(pending);
      }, HISTORY_TYPING_DELAY_MS);
    },
    [clearHistoryTimer, commitDraftSnapshot]
  );

  const applyUndo = useCallback(() => {
    flushPendingDraftSnapshot();
    const current = historyRef.current;
    if (current.past.length === 0) return;

    const previous = current.past[current.past.length - 1]!;
    const nextHistory: DraftHistoryState = {
      past: current.past.slice(0, -1),
      present: previous,
      future: [current.present, ...current.future].slice(0, HISTORY_LIMIT),
    };
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    patchEditor({ title: previous.title, content: previous.content, saved: false, error: null });
  }, [flushPendingDraftSnapshot, patchEditor]);

  const applyRedo = useCallback(() => {
    flushPendingDraftSnapshot();
    const current = historyRef.current;
    if (current.future.length === 0) return;

    const next = current.future[0]!;
    const nextHistory: DraftHistoryState = {
      past: [...current.past, current.present].slice(-HISTORY_LIMIT),
      present: next,
      future: current.future.slice(1),
    };
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    patchEditor({ title: next.title, content: next.content, saved: false, error: null });
  }, [flushPendingDraftSnapshot, patchEditor]);

  const handleTitleChange = useCallback(
    (value: string) => {
      patchEditor({ title: value, saved: false });
      scheduleDraftSnapshot({ title: value, content: editor.content });
    },
    [editor.content, patchEditor, scheduleDraftSnapshot]
  );

  const handleContentChange = useCallback(
    (value: string) => {
      patchEditor({ content: value, saved: false });
      scheduleDraftSnapshot({ title: editor.title, content: value });
    },
    [editor.title, patchEditor, scheduleDraftSnapshot]
  );

  const handleDraftKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) applyRedo();
      else applyUndo();
    },
    [applyRedo, applyUndo]
  );

  useEffect(() => {
    return () => clearHistoryTimer();
  }, [clearHistoryTimer]);

  useEffect(() => {
    return () => {
      if (!initialListAutoRetryTimerRef.current) return;
      clearTimeout(initialListAutoRetryTimerRef.current);
      initialListAutoRetryTimerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const feedbackTimers = cardActionFeedbackTimersRef.current;
    return () => {
      feedbackTimers.forEach((timers) => {
        if (timers.enter) clearTimeout(timers.enter);
        if (timers.dismiss) clearTimeout(timers.dismiss);
        if (timers.remove) clearTimeout(timers.remove);
      });
      feedbackTimers.clear();
    };
  }, []);

  const openCreateEditor = useCallback(() => {
    if (isPreviewMode) {
      void requestGoogleLogin();
      return;
    }
    setEditor(createInitialEditorState());
    setActiveInlineAnnotationId(null);
    resetDraftHistory({ title: "", content: "" });
    setEditorOpen(true);
  }, [
    isPreviewMode,
    requestGoogleLogin,
    resetDraftHistory,
  ]);

  const openExistingEditor = useCallback((script: ScriptItem) => {
    if (isPreviewMode) {
      void requestGoogleLogin();
      return;
    }
    const initialTitle = script.title || "";
    const initialContent = script.content || "";
    setEditor({
      id: script.id,
      clientRequestId: null,
      title: initialTitle,
      content: initialContent,
      slotId: script.plannerRef?.slotId || "",
      recommendation: script.recommendation || null,
      adminAnnotation: script.adminAnnotation || null,
      adminAnnotationDraft: script.adminAnnotation?.notes || "",
      inlineAnnotations: script.inlineAnnotations || [],
      isPosted: Boolean(script.publication?.isPosted),
      postedContentId: script.publication?.content?.id || "",
      publication: script.publication || null,
      aiPrompt: "",
      saving: false,
      saved: false,
      deleting: false,
      adjusting: false,
      error: null,
    });
    setActiveInlineAnnotationId(null);
    resetDraftHistory({ title: initialTitle, content: initialContent });
    setEditorOpen(true);
    onFunnelScriptOpen?.(script);
  }, [
    isPreviewMode,
    onFunnelScriptOpen,
    requestGoogleLogin,
    resetDraftHistory,
  ]);

  useEffect(() => {
    if (isPreviewMode) return;
    if (!requestedScriptId) return;
    if (loadingList || editorOpen) return;
    if (hasAutoOpenedQueryScriptRef.current === requestedScriptId) return;

    const currentScript = scripts.find((item) => item.id === requestedScriptId);
    if (currentScript) {
      hasAutoOpenedQueryScriptRef.current = requestedScriptId;
      openExistingEditor(currentScript);
      return;
    }

    let cancelled = false;

    async function loadRequestedScript() {
      try {
        const params = new URLSearchParams();
        if (targetUserId) params.set("targetUserId", targetUserId);
        const suffix = params.toString() ? `?${params.toString()}` : "";
        const { response, payload } = await fetchJsonWithRetry(`/api/scripts/${requestedScriptId}${suffix}`, {
          cache: "no-store",
        });
        if (!response.ok || !payload?.ok || !payload?.item) {
          throw new Error(payload?.error || "Não foi possível abrir o roteiro da campanha.");
        }
        if (cancelled) return;

        const item = payload.item as ScriptItem;
        hasAutoOpenedQueryScriptRef.current = requestedScriptId;
        setScripts((prev) =>
          prev.some((entry) => entry.id === item.id)
            ? prev
            : [withNormalizedLinkingSummary(item), ...prev]
        );
        openExistingEditor(item);
      } catch (error: any) {
        if (cancelled) return;
        hasAutoOpenedQueryScriptRef.current = requestedScriptId;
        toast({
          variant: "warning",
          title: error?.message || "Não foi possível abrir esse roteiro automaticamente.",
        });
      }
    }

    void loadRequestedScript();
    return () => {
      cancelled = true;
    };
  }, [
    editorOpen,
    isPreviewMode,
    loadingList,
    openExistingEditor,
    requestedScriptId,
    scripts,
    targetUserId,
    toast,
  ]);

  const patchScriptList = useCallback((updated: ScriptItem) => {
    setScripts((prev) =>
      prev.map((item) => {
        if (item.id !== updated.id) return item;
        return withNormalizedLinkingSummary({
          ...updated,
          linkingSummary: updated.linkingSummary ?? item.linkingSummary ?? buildEmptyLinkingSummary(),
        });
      })
    );
  }, []);

  const patchScriptPublication = useCallback(
    async (script: ScriptItem, publicationPatch: { isPosted: boolean; postedContentId: string | null }) => {
      const payload: Record<string, unknown> = {
        isPosted: publicationPatch.isPosted,
        postedContentId: publicationPatch.postedContentId,
        targetUserId: targetUserId || undefined,
      };

      try {
        const { response, payload: data } = await fetchJsonWithRetry(
          `/api/scripts/${script.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            cache: "no-store",
          },
          { retries: 2 }
        );

        if (!response.ok || !data?.ok || !data?.item) {
          throw new Error(data?.error || "Não foi possível atualizar o status de postagem.");
        }

        const updated = data.item as ScriptItem;
        patchScriptList(updated);
        onFunnelContentLinked?.(updated);
        return updated;
      } catch (error) {
        throw new Error(
          getReadableFetchErrorMessage(
            error,
            "Não foi possível vincular o conteúdo ao roteiro agora. Tente novamente em instantes."
          )
        );
      }
    },
    [onFunnelContentLinked, patchScriptList, targetUserId]
  );

  const handleCardPublicationAction = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>, script: ScriptItem) => {
      event.preventDefault();
      event.stopPropagation();
      if (publicationSavingScriptId || quickPublishSaving) return;
      if (!(await ensureLoggedIn())) {
        return;
      }
      if (!canInteract) {
        openPremiumLinkingPaywall("scripts_card_link_post_btn");
        return;
      }
      if (!ensureInstagramConnectedForLinking("scripts_card_link_post_btn")) {
        return;
      }

      if (script.publication?.isPosted) {
        try {
          setPublicationSavingScriptId(script.id);
          await patchScriptPublication(script, { isPosted: false, postedContentId: null });
          setCardActionFeedback(script.id, {
            variant: "success",
            message: "Roteiro desmarcado como postado.",
          });
          toast({ variant: "success", title: "Roteiro desmarcado como postado." });
        } catch (error: any) {
          setCardActionFeedback(
            script.id,
            {
              variant: "error",
              message: error?.message || "Não foi possível desmarcar o roteiro como postado.",
            },
            { ttlMs: 6000 }
          );
          toast({
            variant: "error",
            title: error?.message || "Não foi possível desmarcar o roteiro como postado.",
          });
        } finally {
          setPublicationSavingScriptId(null);
        }
        return;
      }

      const options = await ensureContentOptionsLoaded();
      if (options === null) {
        setCardActionFeedback(
          script.id,
          {
            variant: "error",
            message: contentOptionsLoadErrorRef.current || "Não foi possível carregar os conteúdos publicados agora.",
          },
          { ttlMs: 6000 }
        );
        return;
      }

      if (options.length === 0) {
        setCardActionFeedback(
          script.id,
          {
            variant: "error",
            message: "Nenhum conteúdo disponível para vincular a este roteiro.",
          },
          { ttlMs: 6000 }
        );
        toast({
          variant: "warning",
          title: "Sem conteúdos disponíveis para vinculação no momento.",
        });
        return;
      }

      setQuickPublishAnchorScriptId((current) => (current === script.id ? null : script.id));
      setQuickPublishContentId("");
      setQuickPublishQuery("");
      setCardActionFeedback(script.id, {
        variant: "info",
        message: "Selecione o conteúdo publicado para concluir.",
      });
    },
    [
      canInteract,
      ensureLoggedIn,
      ensureInstagramConnectedForLinking,
      ensureContentOptionsLoaded,
      openPremiumLinkingPaywall,
      patchScriptPublication,
      publicationSavingScriptId,
      quickPublishSaving,
      setCardActionFeedback,
      toast,
    ]
  );

  const handleConfirmQuickPublish = useCallback(async () => {
    const targetScript = quickPublishAnchorScriptId
      ? scripts.find((script) => script.id === quickPublishAnchorScriptId) || null
      : null;
    if (!targetScript) return;
    if (!(await ensureLoggedIn())) {
      return;
    }
    if (!canInteract) {
      openPremiumLinkingPaywall("scripts_card_link_post_confirm");
      return;
    }
    if (!ensureInstagramConnectedForLinking("scripts_card_link_post_confirm")) {
      return;
    }
    if (!quickPublishContentId) {
      toast({
        variant: "warning",
        title: "Selecione o conteúdo publicado para marcar o roteiro.",
      });
      return;
    }

    try {
      setQuickPublishSaving(true);
      await patchScriptPublication(targetScript, {
        isPosted: true,
        postedContentId: quickPublishContentId,
      });
      setCardActionFeedback(targetScript.id, {
        variant: "success",
        message: "Roteiro marcado como postado.",
      });
      toast({ variant: "success", title: "Roteiro marcado como postado." });
      setQuickPublishAnchorScriptId(null);
      setQuickPublishContentId("");
      setQuickPublishQuery("");
    } catch (error: any) {
      setCardActionFeedback(
        targetScript.id,
        {
          variant: "error",
          message: error?.message || "Não foi possível marcar o roteiro como postado.",
        },
        { ttlMs: 6000 }
      );
      toast({
        variant: "error",
        title: error?.message || "Não foi possível marcar o roteiro como postado.",
      });
    } finally {
      setQuickPublishSaving(false);
    }
  }, [
    canInteract,
    ensureLoggedIn,
    ensureInstagramConnectedForLinking,
    openPremiumLinkingPaywall,
    patchScriptPublication,
    quickPublishAnchorScriptId,
    quickPublishContentId,
    scripts,
    setCardActionFeedback,
    toast,
  ]);

  const handleSave = useCallback(async () => {
    if (!(await ensureLoggedIn())) {
      return;
    }
    flushPendingDraftSnapshot();
    const title = editor.title.trim();
    const content = editor.content.trim();

    if (!title && !content) {
      patchEditor({ error: "Escreva um título ou conteúdo para salvar o roteiro." });
      return;
    }

    if (!content) {
      patchEditor({ error: "O conteúdo do roteiro não pode ficar vazio." });
      return;
    }

    if (editor.isPosted && !editor.postedContentId) {
      patchEditor({ error: "Selecione o conteúdo publicado para marcar este roteiro como postado." });
      return;
    }

    patchEditor({ saving: true, saved: false, error: null });

    try {
      if (editor.id) {
        const patchBody: Record<string, unknown> = {
          title: title || "Roteiro sem título",
          content,
          targetUserId: targetUserId || undefined,
          inlineAnnotations: editor.inlineAnnotations,
          isPosted: editor.isPosted,
          postedContentId: editor.isPosted ? editor.postedContentId : null,
        };
        if (isAdminViewer) {
          patchBody.adminAnnotation = editor.adminAnnotationDraft;
        }

        const { response: res, payload: data } = await fetchJsonWithRetry(
          `/api/scripts/${editor.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patchBody),
            cache: "no-store",
          },
          { retries: 2 }
        );
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Não foi possível salvar o roteiro.");
        }
        const updated = data.item as ScriptItem;
        patchScriptList(updated);
        onFunnelScriptSaved?.(updated);
        patchEditor({
          id: updated.id,
          clientRequestId: null,
          title: updated.title,
          content: updated.content,
          recommendation: updated.recommendation || null,
          adminAnnotation: updated.adminAnnotation || null,
          adminAnnotationDraft: updated.adminAnnotation?.notes || "",
          inlineAnnotations: updated.inlineAnnotations || [],
          isPosted: Boolean(updated.publication?.isPosted),
          postedContentId: updated.publication?.content?.id || "",
          publication: updated.publication || null,
          saving: false,
          saved: true,
          error: null,
        });
      } else {
        const body: any = {
          mode: "manual",
          clientRequestId: editor.clientRequestId,
          title: title || "Roteiro sem título",
          content,
          targetUserId: targetUserId || undefined,
          inlineAnnotations: editor.inlineAnnotations,
          isPosted: editor.isPosted,
          postedContentId: editor.isPosted ? editor.postedContentId : null,
        };
        if (isAdminViewer) {
          body.adminAnnotation = editor.adminAnnotationDraft;
        }

        const { response: res, payload: data } = await fetchJsonWithRetry(
          "/api/scripts",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store",
          },
          { retries: 2 }
        );
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Não foi possível criar o roteiro.");
        }

        const created = data.item as ScriptItem;
        setScripts((prev) => [withNormalizedLinkingSummary(created), ...prev]);
        onFunnelScriptSaved?.(created);
        patchEditor({
          id: created.id,
          clientRequestId: null,
          title: created.title,
          content: created.content,
          recommendation: created.recommendation || null,
          adminAnnotation: created.adminAnnotation || null,
          adminAnnotationDraft: created.adminAnnotation?.notes || "",
          inlineAnnotations: created.inlineAnnotations || [],
          isPosted: Boolean(created.publication?.isPosted),
          postedContentId: created.publication?.content?.id || "",
          publication: created.publication || null,
          saving: false,
          saved: true,
          error: null,
        });
      }
    } catch (err: any) {
      const title = getReadableFetchErrorMessage(
        err,
        "Não foi possível salvar o roteiro agora. Tente novamente em instantes."
      );
      patchEditor({
        saving: false,
        saved: false,
        error: title,
      });
      toast({
        variant: "error",
        title,
      });
    }
  }, [
    editor,
    ensureLoggedIn,
    flushPendingDraftSnapshot,
    isAdminViewer,
    onFunnelScriptSaved,
    patchEditor,
    patchScriptList,
    targetUserId,
    toast,
  ]);

  const handleDelete = useCallback(async () => {
    if (!editor.id) {
      setEditorOpen(false);
      setEditor(createInitialEditorState());
      resetDraftHistory({ title: "", content: "" });
      return;
    }

    patchEditor({ deleting: true, error: null });
    try {
      const params = new URLSearchParams();
      if (targetUserId) params.set("targetUserId", targetUserId);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/scripts/${editor.id}${suffix}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Não foi possível excluir o roteiro.");
      }

      setScripts((prev) => prev.filter((item) => item.id !== editor.id));
      setEditorOpen(false);
      setEditor(createInitialEditorState());
      resetDraftHistory({ title: "", content: "" });
    } catch (err: any) {
      patchEditor({ deleting: false, error: err?.message || "Erro ao excluir roteiro." });
    }
  }, [editor.id, patchEditor, resetDraftHistory, targetUserId]);

  const handleAiAdjust = useCallback(async () => {
    if (!(await ensureLoggedIn())) {
      return;
    }
    if (!canInteract) {
      openPaywall("planning", { source: "scripts_ai_assistant_click" });
      return;
    }
    const prompt = editor.aiPrompt.trim();
    if (!prompt) {
      patchEditor({ error: "Digite um pedido para a IA." });
      return;
    }

    flushPendingDraftSnapshot();
    patchEditor({ adjusting: true, error: null });
    try {
      if (editor.id) {
        const res = await fetch(`/api/scripts/${editor.id}/ai-adjust`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, targetUserId: targetUserId || undefined }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Não foi possível ajustar com IA.");
        }

        const updated = data.item as ScriptItem;
        patchScriptList(updated);
        onFunnelScriptSaved?.(updated);
        patchEditor({
          title: updated.title,
          content: updated.content,
          recommendation: updated.recommendation || null,
          adminAnnotation: updated.adminAnnotation || null,
          adminAnnotationDraft: updated.adminAnnotation?.notes || editor.adminAnnotationDraft,
          inlineAnnotations: updated.inlineAnnotations || [],
          isPosted: Boolean(updated.publication?.isPosted),
          postedContentId: updated.publication?.content?.id || "",
          publication: updated.publication || null,
          aiPrompt: "",
          adjusting: false,
          error: null,
        });
        commitDraftSnapshot({ title: updated.title, content: updated.content });
      } else {
        const res = await fetch("/api/scripts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "ai",
            clientRequestId: editor.clientRequestId,
            prompt,
            title: editor.title.trim() || undefined,
            targetUserId: targetUserId || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Não foi possível gerar roteiro com IA.");
        }

        const created = data.item as ScriptItem;
        setScripts((prev) => [withNormalizedLinkingSummary(created), ...prev]);
        onFunnelScriptSaved?.(created);
        patchEditor({
          id: created.id,
          clientRequestId: null,
          title: created.title,
          content: created.content,
          recommendation: created.recommendation || null,
          adminAnnotation: created.adminAnnotation || null,
          adminAnnotationDraft: created.adminAnnotation?.notes || editor.adminAnnotationDraft,
          inlineAnnotations: created.inlineAnnotations || [],
          isPosted: Boolean(created.publication?.isPosted),
          postedContentId: created.publication?.content?.id || "",
          publication: created.publication || null,
          aiPrompt: "",
          adjusting: false,
          error: null,
        });
        commitDraftSnapshot({ title: created.title, content: created.content });
      }
    } catch (err: any) {
      patchEditor({
        adjusting: false,
        error: err?.message || "Erro ao processar pedido com IA.",
      });
    }
  }, [
    canInteract,
    commitDraftSnapshot,
    editor.adminAnnotationDraft,
    editor.aiPrompt,
    editor.clientRequestId,
    editor.id,
    editor.title,
    ensureLoggedIn,
    flushPendingDraftSnapshot,
    onFunnelScriptSaved,
    openPaywall,
    patchEditor,
    patchScriptList,
    targetUserId,
  ]);

  const handleAiPromptKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      if ((event.nativeEvent as any)?.isComposing) return;
      event.preventDefault();
      if (editor.adjusting) return;
      void handleAiAdjust();
    },
    [editor.adjusting, handleAiAdjust]
  );

  const patchScriptLinkingSummary = useCallback(
    (params: {
      scriptId: string;
      campaignId: string;
      campaignTitle: string;
      brandName: string;
      linkId?: string | null;
      linkedAt?: string | null;
    }) => {
      setScripts((prev) =>
        prev.map((item) => {
          if (item.id !== params.scriptId) return item;
          const currentSummary = normalizeScriptLinkingSummary(item.linkingSummary);
          const hasCampaign = currentSummary.campaigns.some(
            (campaign) => campaign.proposalId === params.campaignId
          );
          if (hasCampaign) return item;

          const nextCampaigns = [
            {
              proposalId: params.campaignId,
              linkId: params.linkId || `temp-${params.campaignId}`,
              campaignTitle: params.campaignTitle,
              brandName: params.brandName,
              linkedAt: params.linkedAt || new Date().toISOString(),
            },
            ...currentSummary.campaigns,
          ];

          return {
            ...item,
            linkingSummary: {
              isLinked: true,
              totalLinks: nextCampaigns.length,
              campaigns: nextCampaigns,
            },
          };
        })
      );
    },
    []
  );

  const removeScriptLinkingSummaryCampaign = useCallback(
    (params: { scriptId: string; campaignId: string }) => {
      setScripts((prev) =>
        prev.map((item) => {
          if (item.id !== params.scriptId) return item;
          const currentSummary = normalizeScriptLinkingSummary(item.linkingSummary);
          const nextCampaigns = currentSummary.campaigns.filter(
            (campaign) => campaign.proposalId !== params.campaignId
          );
          return {
            ...item,
            linkingSummary: {
              isLinked: nextCampaigns.length > 0,
              totalLinks: nextCampaigns.length,
              campaigns: nextCampaigns,
            },
          };
        })
      );
    },
    []
  );

  const linkScriptToCampaign = useCallback(
    async (params: { scriptId: string; campaignId: string; source: "editor" | "card" }) => {
      const { scriptId, campaignId, source } = params;
      if (!(await ensureLoggedIn())) {
        return;
      }
      if (!canInteract) {
        openPremiumLinkingPaywall(
          source === "editor" ? "scripts_editor_link_btn" : "scripts_card_link_btn"
        );
        return;
      }
      if (
        !ensureInstagramConnectedForLinking(
          source === "editor" ? "scripts_editor_link_btn" : "scripts_card_link_btn"
        )
      ) {
        return;
      }
      if (!scriptId) {
        toast({
          variant: "warning",
          title: "Salve o roteiro antes de vincular à campanha.",
        });
        return;
      }

      if (!campaignId) {
        toast({
          variant: "warning",
          title: "Selecione uma campanha para vincular.",
        });
        return;
      }

      const script = scripts.find((item) => item.id === scriptId);
      const campaign =
        campaignOptions.find((option) => option.id === campaignId) ||
        ({ id: campaignId, campaignTitle: "Campanha", brandName: "Marca" } as CampaignOption);

      if (source === "editor") {
        setLinkingToCampaign(true);
      } else {
        setCardLinkingScriptId(scriptId);
        setCardLinkErrorByScriptId((prev) => ({ ...prev, [scriptId]: "" }));
      }

      if (source === "card") {
        track("script_card_link_cta_clicked", {
          script_id: scriptId,
          state: script?.linkingSummary?.isLinked ? "linked" : "unlinked",
          campaign_id: campaignId,
          source,
        });
      }

      try {
        const response = await fetch(`/api/proposals/${campaignId}/links`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityType: "script",
            entityId: scriptId,
          }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.error || "Não foi possível vincular roteiro à campanha.");
        }

        patchScriptLinkingSummary({
          scriptId,
          campaignId,
          campaignTitle: campaign.campaignTitle,
          brandName: campaign.brandName,
          linkId: payload?.item?.id || null,
          linkedAt: payload?.item?.updatedAt || payload?.item?.createdAt || null,
        });

        toast({
          variant: "success",
          title: payload?.created === false ? "Roteiro já estava vinculado." : "Roteiro vinculado à campanha.",
        });

        if (source === "card") {
          setCardActionFeedback(scriptId, {
            variant: "success",
            message: payload?.created === false ? "Roteiro já estava vinculado." : "Roteiro vinculado à campanha.",
          });
        }

        if (source === "card") {
          track("script_card_link_success", {
            script_id: scriptId,
            campaign_id: campaignId,
            created: payload?.created !== false,
          });
          setActiveCardLinkScriptId(null);
        }
      } catch (error: any) {
        if (source === "card") {
          setCardLinkErrorByScriptId((prev) => ({
            ...prev,
            [scriptId]: error?.message || "Falha ao vincular roteiro.",
          }));
          setCardActionFeedback(
            scriptId,
            {
              variant: "error",
              message: error?.message || "Falha ao vincular roteiro.",
            },
            { ttlMs: 6000 }
          );
          track("script_card_link_failed", {
            script_id: scriptId,
            campaign_id: campaignId,
            message: error?.message || "link_failed",
          });
        }
        toast({
          variant: "error",
          title: error?.message || "Falha ao vincular roteiro.",
        });
      } finally {
        if (source === "editor") {
          setLinkingToCampaign(false);
        } else {
          setCardLinkingScriptId((current) => (current === scriptId ? null : current));
        }
      }
    },
    [
      canInteract,
      campaignOptions,
      ensureLoggedIn,
      ensureInstagramConnectedForLinking,
      openPremiumLinkingPaywall,
      patchScriptLinkingSummary,
      scripts,
      setCardActionFeedback,
      toast,
    ]
  );

  const handleLinkToCampaign = useCallback(async () => {
    await linkScriptToCampaign({
      scriptId: editor.id || "",
      campaignId: selectedCampaignId,
      source: "editor",
    });
  }, [editor.id, linkScriptToCampaign, selectedCampaignId]);

  const handleOpenCardLinkPanel = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>, script: ScriptItem) => {
      event.preventDefault();
      event.stopPropagation();
      if (cardLinkingScriptId || linkingToCampaign) return;
      if (!(await ensureLoggedIn())) {
        return;
      }

      const options = await ensureCampaignOptionsLoaded();
      if (!options.length) {
        setCardActionFeedback(
          script.id,
          {
            variant: "error",
            message: "Nenhuma campanha disponível para vínculo.",
          },
          { ttlMs: 6000 }
        );
        setCardLinkErrorByScriptId((prev) => ({
          ...prev,
          [script.id]: "Nenhuma campanha disponível para vínculo.",
        }));
        return;
      }

      const currentSelected = cardCampaignByScriptId[script.id];
      const hasCurrent = currentSelected && options.some((option) => option.id === currentSelected);
      const firstLinkedCampaignId = script.linkingSummary?.campaigns?.[0]?.proposalId || "";
      const fallbackCampaignId =
        (firstLinkedCampaignId && options.some((option) => option.id === firstLinkedCampaignId)
          ? firstLinkedCampaignId
          : "") || options[0]?.id || "";

      setCardCampaignByScriptId((prev) => ({
        ...prev,
        [script.id]: hasCurrent ? currentSelected : fallbackCampaignId,
      }));
      setCardLinkErrorByScriptId((prev) => ({ ...prev, [script.id]: "" }));
      setCardActionFeedback(script.id, null);
      setActiveCardLinkScriptId((current) => (current === script.id ? null : script.id));

      track("script_card_insight_opened", {
        script_id: script.id,
        insight: "linking",
        state: script.linkingSummary?.isLinked ? "linked" : "unlinked",
      });
    },
    [
      cardCampaignByScriptId,
      cardLinkingScriptId,
      ensureLoggedIn,
      ensureCampaignOptionsLoaded,
      linkingToCampaign,
      setCardActionFeedback,
    ]
  );

  const handleCardLinkConfirm = useCallback(
    async (script: ScriptItem) => {
      const campaignId = cardCampaignByScriptId[script.id] || "";
      await linkScriptToCampaign({
        scriptId: script.id,
        campaignId,
        source: "card",
      });
    },
    [cardCampaignByScriptId, linkScriptToCampaign]
  );

  const handleCardUnlinkConfirm = useCallback(
    async (script: ScriptItem) => {
      if (!(await ensureLoggedIn())) {
        return;
      }
      const campaignId = cardCampaignByScriptId[script.id] || "";
      if (!campaignId) return;
      const linkedCampaign = normalizeScriptLinkingSummary(script.linkingSummary).campaigns.find(
        (campaign) => campaign.proposalId === campaignId
      );
      if (!linkedCampaign?.linkId) {
        setCardActionFeedback(
          script.id,
          { variant: "error", message: "Não foi possível identificar o vínculo para remover." },
          { ttlMs: 6000 }
        );
        return;
      }

      try {
        setCardLinkingScriptId(script.id);
        setCardLinkErrorByScriptId((prev) => ({ ...prev, [script.id]: "" }));
        const response = await fetch(
          `/api/proposals/${campaignId}/links/${linkedCampaign.linkId}`,
          { method: "DELETE" }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Não foi possível remover o vínculo.");
        }

        removeScriptLinkingSummaryCampaign({ scriptId: script.id, campaignId });
        setCardActionFeedback(script.id, {
          variant: "success",
          message: "Vínculo removido com sucesso.",
        });
        toast({ variant: "success", title: "Vínculo removido." });
        track("script_card_unlink_success", {
          script_id: script.id,
          campaign_id: campaignId,
        });
        setActiveCardLinkScriptId(null);
      } catch (error: any) {
        setCardLinkErrorByScriptId((prev) => ({
          ...prev,
          [script.id]: error?.message || "Falha ao remover vínculo.",
        }));
        setCardActionFeedback(
          script.id,
          { variant: "error", message: error?.message || "Falha ao remover vínculo." },
          { ttlMs: 6000 }
        );
        toast({ variant: "error", title: error?.message || "Falha ao remover vínculo." });
        track("script_card_unlink_failed", {
          script_id: script.id,
          campaign_id: campaignId,
          message: error?.message || "unlink_failed",
        });
      } finally {
        setCardLinkingScriptId((current) => (current === script.id ? null : current));
      }
    },
    [cardCampaignByScriptId, ensureLoggedIn, removeScriptLinkingSummaryCampaign, setCardActionFeedback, toast]
  );

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const selectedPostedContentOption = contentOptions.find((option) => option.id === editor.postedContentId) || null;
  const selectedPostedContentMissing =
    Boolean(editor.postedContentId) && !selectedPostedContentOption && Boolean(editor.publication?.content);
  const deferredQuickPublishQuery = useDeferredValue(quickPublishQuery);
  const quickPublishQueryNormalized = deferredQuickPublishQuery.trim().toLowerCase();
  const filteredQuickPublishOptions = useMemo(() => {
    if (!quickPublishQueryNormalized) return contentOptions;
    return contentOptions.filter((option) => {
      const haystack = `${option.caption} ${option.type || ""}`.toLowerCase();
      return haystack.includes(quickPublishQueryNormalized);
    });
  }, [contentOptions, quickPublishQueryNormalized]);
  const selectedQuickPublishOption =
    contentOptions.find((option) => option.id === quickPublishContentId) || null;
  const quickPublishTargetScript = quickPublishAnchorScriptId
    ? scripts.find((script) => script.id === quickPublishAnchorScriptId) || null
    : null;
  if (editorOpen) {
    return (
      <MyScriptsEditorSurface
        compactView={compactView}
        editor={editor}
        viewerName={viewer?.name || "Admin"}
        requestedProposalId={requestedProposalId}
        isAdminViewer={isAdminViewer}
        isAuthenticated={isAuthenticated}
        canInteract={canInteract}
        campaignOptionsReady={campaignOptionsReady}
        campaignsLoading={campaignsLoading}
        linkingToCampaign={linkingToCampaign}
        campaignOptions={campaignOptions}
        selectedCampaignId={selectedCampaignId}
        canUndo={canUndo}
        canRedo={canRedo}
        activeInlineAnnotationId={activeInlineAnnotationId}
        contentOptionsReady={contentOptionsReady}
        contentOptions={contentOptions}
        contentOptionsLoading={contentOptionsLoading}
        selectedPostedContentMissing={selectedPostedContentMissing}
        selectedPostedContentOption={selectedPostedContentOption}
        onBack={() => {
          flushPendingDraftSnapshot();
          setEditorOpen(false);
          setEditor(createInitialEditorState());
          resetDraftHistory({ title: "", content: "" });
        }}
        onReturnToCampaign={handleReturnToCampaign}
        onSelectedCampaignIdChange={setSelectedCampaignId}
        onRequestGoogleLogin={() => {
          void requestGoogleLogin();
        }}
        onOpenPremiumLinkingPaywall={openPremiumLinkingPaywall}
        onCampaignOptionsInteraction={handleEditorCampaignOptionsIntent}
        onLinkToCampaign={() => {
          void handleLinkToCampaign();
        }}
        onUndo={applyUndo}
        onRedo={applyRedo}
        onSave={() => {
          void handleSave();
        }}
        onDelete={() => {
          void handleDelete();
        }}
        onTitleChange={handleTitleChange}
        onDraftKeyDown={handleDraftKeyDown}
        onContentChange={handleContentChange}
        onInlineAnnotationsChange={(newAnnotations) =>
          patchEditor({ inlineAnnotations: newAnnotations, saved: false })
        }
        onInlineAnnotationFocus={setActiveInlineAnnotationId}
        onResolveAnnotation={(annotationId) => {
          const nextAnnotations = editor.inlineAnnotations.map((annotation) =>
            annotation.id === annotationId ? { ...annotation, resolved: true } : annotation
          );
          patchEditor({ inlineAnnotations: nextAnnotations, saved: false });
        }}
        onAdminAnnotationDraftChange={(value) =>
          patchEditor({
            adminAnnotationDraft: value,
            saved: false,
          })
        }
        onPostedToggle={(checked) =>
          {
            patchEditor({
              isPosted: checked,
              postedContentId: checked ? editor.postedContentId || "" : "",
              publication: checked ? editor.publication : null,
              saved: false,
              error: null,
            });
            if (checked) {
              handleEditorPostedContentIntent();
            }
          }
        }
        onPostedContentInteraction={handleEditorPostedContentIntent}
        onPostedContentIdChange={(value) =>
          patchEditor({
            postedContentId: value,
            saved: false,
            error: null,
          })
        }
        onAiPromptChange={(value) => patchEditor({ aiPrompt: value })}
        onAiPromptKeyDown={handleAiPromptKeyDown}
        onAiAdjust={() => {
          void handleAiAdjust();
        }}
        ensureInstagramConnectedForLinking={ensureInstagramConnectedForLinking}
        formatDate={formatDate}
        formatNumber={formatNumber}
        getPostedContentLabel={getPostedContentLabel}
        buildContentOptionLabel={buildContentOptionLabel}
      />
    );
  }

  return (
    <div className={`min-h-0 bg-transparent ${compactView ? "relative" : ""}`}>
      <div className={compactView ? "px-3.5 pb-3 pt-1.5" : "px-4 py-2"}>
        {isAdminViewer ? (
          <div className={`mb-4 flex flex-col gap-2 ${compactView ? "" : "sm:flex-row sm:items-center sm:gap-3"}`}>
            <div className={`w-full ${compactView ? "" : "sm:max-w-md"}`}>
              <CreatorQuickSearch
                onSelect={(creator) =>
                  setAdminTargetUser({
                    id: creator.id,
                    name: creator.name,
                    profilePictureUrl: creator.profilePictureUrl,
                  })
                }
                selectedCreatorName={adminTargetUser?.name || null}
                selectedCreatorPhotoUrl={adminTargetUser?.profilePictureUrl || null}
                onClear={() => setAdminTargetUser(null)}
                apiPrefix="/api/admin"
              />
            </div>
          </div>
        ) : null}

        {isPreviewMode && showPreviewBanner ? (
          <div className="mb-4 rounded-[1.3rem] border border-zinc-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,244,245,0.95))] px-4 py-4 shadow-[0_16px_36px_rgba(24,24,27,0.05)]">
            <div className={`flex flex-col gap-3 ${compactView ? "" : "sm:flex-row sm:items-center sm:justify-between"}`}>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Preview de Exemplo
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">
                  Estes roteiros são demonstrativos para você explorar o board.
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-600">
                  Entre com Google para salvar seus roteiros, usar IA e ativar vínculos reais com campanhas e Instagram.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void requestGoogleLogin();
                }}
                className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Entrar com Google
              </button>
            </div>
          </div>
        ) : null}

        {compactView ? null : (
          <div className="dashboard-segmented mb-4 inline-flex">
            {([
              { id: "all", label: "Todos" },
              { id: "posted", label: "Postados" },
              { id: "unposted", label: "Não postados" },
            ] as Array<{ id: ScriptPostedFilter; label: string }>).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPostedFilter(option.id)}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                  postedFilter === option.id
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {globalError ? (
          <div className={`mb-4 flex flex-wrap items-center gap-3 rounded-[1.4rem] border px-4 py-3 ${compactView ? "border-zinc-100/90 bg-zinc-50/62" : "border-rose-200/80 bg-rose-50/90 shadow-[0_18px_32px_rgba(244,63,94,0.08)]"}`}>
            <p className="text-sm text-rose-700">{globalError}</p>
            <button
              type="button"
              onClick={() => {
                void fetchScripts({ reset: true });
              }}
              className="inline-flex items-center rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}

        {loadingList ? (
          <div className={`grid ${compactView ? "grid-cols-1 gap-3" : "grid-cols-2 gap-3 sm:gap-5"}`}>
            {Array.from({ length: 10 }).map((_, idx) => (
              <div
                key={`loading-${idx}`}
                className={`dashboard-panel animate-pulse ${compactView ? "h-52 rounded-[1.5rem]" : "h-72 rounded-[1.5rem] sm:h-80 sm:rounded-[2rem]"}`}
              >
                <div className="h-11 border-b border-zinc-100 bg-zinc-50/70" />
                <div className="p-5">
                  <div className="h-4 w-2/3 rounded bg-zinc-100" />
                  <div className="mt-3 h-3 w-full rounded bg-zinc-100/80" />
                  <div className="mt-2 h-3 w-4/5 rounded bg-zinc-100/70" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-zinc-100/60" />
                </div>
                <div className="mx-5 mt-6 h-10 rounded-xl bg-zinc-50" />
              </div>
            ))}
          </div>
        ) : scripts.length === 0 ? (
          <div className={`dashboard-empty-state border border-zinc-100/90 text-center ${compactView ? "rounded-[1.2rem] bg-white p-5" : "p-8"}`}>
            <p className="dashboard-muted-label mx-auto mb-3 flex w-fit items-center gap-2 text-zinc-400">
              <Sparkles size={12} />
              Meus Roteiros
            </p>
            <p className="mb-4 text-zinc-700">
              {isActingOnBehalf
                ? `${adminTargetUser?.name} ainda não tem roteiros salvos.`
                : "Você ainda não tem roteiros salvos."}
            </p>
            <button
              type="button"
              onClick={openCreateEditor}
              className="dashboard-primary-button inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold"
            >
              <Plus size={16} />
              {isPreviewMode ? "Entrar para criar roteiro" : "Criar meu primeiro roteiro"}
            </button>
            {!isActingOnBehalf ? (
              <button
                type="button"
                onClick={handleGoToCalendar}
                className="dashboard-secondary-button ml-2 inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold text-emerald-800"
              >
                Ir para Calendário
              </button>
            ) : null}
          </div>
        ) : compactView && !cardsReady ? (
          <div className="grid grid-cols-1 gap-3">
            {Array.from({ length: Math.min(scripts.length + 1, 4) }).map((_, idx) => (
              <div
                key={`compact-card-ready-loading-${idx}`}
                className="animate-pulse rounded-[1.05rem] border border-zinc-100/90 bg-zinc-50/78"
              >
                <div className="grid grid-cols-[60px_minmax(0,1fr)] gap-x-3.5 px-2.5 py-2.5">
                  <div className="h-[78px] w-[60px] rounded-[0.95rem] bg-zinc-100/90" />
                  <div className="flex min-h-[79px] flex-col justify-between gap-2">
                    <div className="space-y-1.5">
                      <div className="h-4 w-24 rounded-full bg-zinc-100/90" />
                      <div className="h-4 w-11/12 rounded bg-zinc-100/80" />
                      <div className="h-4 w-4/5 rounded bg-zinc-100/70" />
                    </div>
                    <div className="space-y-1">
                      <div className="h-3 w-3/4 rounded bg-zinc-100/70" />
                      <div className="h-3 w-2/3 rounded bg-zinc-100/60" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <MyScriptsCardsGrid
            scripts={scripts}
            compactView={compactView}
            isPreviewMode={isPreviewMode}
            isAdminViewer={isAdminViewer}
            isAuthenticated={isAuthenticated}
            canInteract={canInteract}
            unreadFeedbackScriptIds={unreadFeedbackScriptIds}
            publicationSavingScriptId={publicationSavingScriptId}
            cardCampaignByScriptId={cardCampaignByScriptId}
            cardLinkingScriptId={cardLinkingScriptId}
            cardLinkErrorByScriptId={cardLinkErrorByScriptId}
            cardActionFeedbackByScriptId={cardActionFeedbackByScriptId}
            activeCardLinkScriptId={activeCardLinkScriptId}
            campaignOptions={campaignOptions}
            campaignsLoading={campaignsLoading}
            quickPublishAnchorScriptId={quickPublishAnchorScriptId}
            quickPublishQuery={quickPublishQuery}
            quickPublishContentId={quickPublishContentId}
            quickPublishSaving={quickPublishSaving}
            filteredQuickPublishOptions={filteredQuickPublishOptions}
            selectedQuickPublishOption={selectedQuickPublishOption}
            quickPublishTargetScript={quickPublishTargetScript}
            contentOptionsLoading={contentOptionsLoading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            cardLinkPopoverRef={cardLinkPopoverRef}
            quickPublishPopoverRef={quickPublishPopoverRef}
            onCreate={openCreateEditor}
            onOpenScript={openExistingEditor}
            onRequestGoogleLogin={requestGoogleLogin}
            onOpenPlanningPaywall={(source) => openPaywall("planning", { source })}
            onOpenPremiumLinkingPaywall={openPremiumLinkingPaywall}
            onCardPublicationAction={handleCardPublicationAction}
            onOpenCardLinkPanel={handleOpenCardLinkPanel}
            onCardCampaignChange={(scriptId, campaignId) =>
              setCardCampaignByScriptId((prev) => ({
                ...prev,
                [scriptId]: campaignId,
              }))
            }
            onCloseCardLinkPanel={() => {
              setActiveCardLinkScriptId((current) => (cardLinkingScriptId ? current : null));
            }}
            onCardLinkConfirm={handleCardLinkConfirm}
            onCardUnlinkConfirm={handleCardUnlinkConfirm}
            onQuickPublishQueryChange={setQuickPublishQuery}
            onQuickPublishContentChange={setQuickPublishContentId}
            onCloseQuickPublish={() => {
              if (quickPublishSaving) return;
              setQuickPublishAnchorScriptId(null);
              setQuickPublishContentId("");
              setQuickPublishQuery("");
            }}
            onConfirmQuickPublish={handleConfirmQuickPublish}
            onLoadMore={() => {
              void fetchScripts({ cursor: nextCursor });
            }}
          />
        )}

      </div>
    </div>
  );
}
