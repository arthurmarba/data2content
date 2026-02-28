"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Save, Trash2, Sparkles, Plus, Undo2, Redo2, Check } from "lucide-react";
import { useToast } from "@/app/components/ui/ToastA11yProvider";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  LAST_VIEWED_SCRIPTS_ADMIN_FEEDBACK_AT_KEY,
  LAST_VIEWED_SCRIPTS_RECOMMENDATIONS_AT_KEY,
} from "@/app/dashboard/hooks/useScriptRecommendationsNotifications";

const CreatorQuickSearch = dynamic(
  () => import("@/app/admin/creator-dashboard/components/CreatorQuickSearch"),
  { ssr: false, loading: () => null }
);
import { InlineScriptEditor, type InlineAnnotation } from "./InlineScriptEditor";

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
    engagement?: number | null;
    totalInteractions?: number | null;
  } | null;
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
  createdAt: string;
  updatedAt: string;
};

type PlannerSlotOption = {
  slotId: string;
  dayOfWeek: number;
  blockStartHour: number;
};

type EditorState = {
  id: string | null;
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
const CARD_PREVIEW_MAX_CHARS = 210;
const HISTORY_LIMIT = 80;
const HISTORY_TYPING_DELAY_MS = 450;
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

function getSourceLabel(source: ScriptOrigin) {
  if (source === "manual") return "Manual";
  if (source === "ai") return "IA";
  return "Planner";
}

function getSourceCardTone(source: ScriptOrigin) {
  if (source === "ai") {
    return {
      header: "bg-violet-50 border-violet-100",
      text: "text-violet-700",
      ring: "hover:ring-violet-200",
    };
  }
  if (source === "planner") {
    return {
      header: "bg-emerald-50 border-emerald-100",
      text: "text-emerald-700",
      ring: "hover:ring-emerald-200",
    };
  }
  return {
    header: "bg-slate-50 border-slate-100",
    text: "text-slate-700",
    ring: "hover:ring-slate-200",
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

function buildContentOptionLabel(option: ContentOption) {
  const dateLabel = option.postDate ? formatDate(option.postDate) : "sem data";
  const engagementLabel =
    typeof option.engagement === "number" && Number.isFinite(option.engagement)
      ? `${option.engagement.toFixed(2)}`
      : "-";
  return `${option.caption} · ${dateLabel} · Eng: ${engagementLabel}`;
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
  return {
    id: null,
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

export default function MyScriptsPage({ viewer }: { viewer?: ViewerInfo }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [plannerWeekStart, setPlannerWeekStart] = useState<string | null>(null);
  const [plannerSlots, setPlannerSlots] = useState<PlannerSlotOption[]>([]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(createInitialEditorState());
  const [adminTargetUser, setAdminTargetUser] = useState<AdminTargetUser | null>(null);
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [linkingToCampaign, setLinkingToCampaign] = useState(false);
  const [contentOptions, setContentOptions] = useState<ContentOption[]>([]);
  const [contentOptionsLoading, setContentOptionsLoading] = useState(false);
  const [publicationSavingScriptId, setPublicationSavingScriptId] = useState<string | null>(null);
  const [quickPublishAnchorScriptId, setQuickPublishAnchorScriptId] = useState<string | null>(null);
  const [quickPublishContentId, setQuickPublishContentId] = useState("");
  const [quickPublishSaving, setQuickPublishSaving] = useState(false);
  const [quickPublishQuery, setQuickPublishQuery] = useState("");
  const [postedFilter, setPostedFilter] = useState<ScriptPostedFilter>("all");
  const requestedScriptId = useMemo(() => {
    const value = searchParams?.get("scriptId");
    if (!value) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }, [searchParams]);
  const requestedProposalId = useMemo(() => {
    const value = searchParams?.get("proposalId");
    if (!value) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }, [searchParams]);
  const { toast } = useToast();
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
  const latestFeedbackToastRef = useRef<string>("");
  const nextCursorRef = useRef<string | null>(null);
  const quickPublishPopoverRef = useRef<HTMLDivElement | null>(null);

  const isAdminViewer = viewer?.role === "admin";
  const isActingOnBehalf = Boolean(
    isAdminViewer &&
    adminTargetUser?.id &&
    viewer?.id &&
    adminTargetUser.id !== viewer.id
  );
  const targetUserId = isActingOnBehalf ? adminTargetUser?.id ?? null : null;
  const handleReturnToCampaign = useCallback(() => {
    if (!requestedProposalId) return;
    router.push(`/campaigns?proposalId=${encodeURIComponent(requestedProposalId)}`);
  }, [requestedProposalId, router]);

  const slotOptions = useMemo(() => {
    return plannerSlots
      .filter((slot) => Boolean(slot.slotId))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.blockStartHour - b.blockStartHour);
  }, [plannerSlots]);

  useEffect(() => {
    hasAutoOpenedQueryScriptRef.current = null;
  }, [requestedScriptId, targetUserId]);

  useEffect(() => {
    nextCursorRef.current = nextCursor;
  }, [nextCursor]);

  useEffect(() => {
    if (!editorOpen || isAdminViewer || hasFetchedCampaignOptionsRef.current) return;

    let cancelled = false;

    async function fetchCampaignOptions() {
      try {
        setCampaignsLoading(true);
        const response = await fetch("/api/proposals?limit=200", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));

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

        if (cancelled) return;

        setCampaignOptions(options);
        hasFetchedCampaignOptionsRef.current = true;
        setSelectedCampaignId((current) => {
          if (current && options.some((option) => option.id === current)) {
            return current;
          }
          return options[0]?.id ?? "";
        });
      } catch (error: any) {
        if (cancelled) return;
        setCampaignOptions([]);
        setSelectedCampaignId("");
        toast({
          variant: "error",
          title: error?.message || "Falha ao carregar campanhas para vinculação.",
        });
      } finally {
        if (!cancelled) setCampaignsLoading(false);
      }
    }

    fetchCampaignOptions();

    return () => {
      cancelled = true;
    };
  }, [editorOpen, isAdminViewer, toast]);

  const ensureContentOptionsLoaded = useCallback(async () => {
    if (hasFetchedContentOptionsRef.current) {
      return contentOptions;
    }

    try {
      setContentOptionsLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (targetUserId) params.set("targetUserId", targetUserId);
      const response = await fetch(`/api/scripts/content-options?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Não foi possível carregar conteúdos publicados.");
      }

      const items = Array.isArray(payload?.items) ? payload.items : [];
      const options: ContentOption[] = items
        .map((item: any) => ({
          id: String(item?.id ?? ""),
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
        }))
        .filter((item: ContentOption) => Boolean(item.id));

      setContentOptions(options);
      hasFetchedContentOptionsRef.current = true;
      return options;
    } catch (error: any) {
      setContentOptions([]);
      hasFetchedContentOptionsRef.current = false;
      toast({
        variant: "warning",
        title: error?.message || "Falha ao carregar conteúdos para vinculação.",
      });
      return null;
    } finally {
      setContentOptionsLoading(false);
    }
  }, [contentOptions, targetUserId, toast]);

  useEffect(() => {
    if (!editorOpen || hasFetchedContentOptionsRef.current) return;
    void ensureContentOptionsLoaded();
  }, [editorOpen, ensureContentOptionsLoaded]);

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
    setQuickPublishAnchorScriptId(null);
    setQuickPublishContentId("");
    setQuickPublishQuery("");
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
      setGlobalError(null);

      if (reset) setLoadingList(true);
      else setLoadingMore(true);

      const params = new URLSearchParams();
      params.set("limit", String(PAGE_LIMIT));
      params.set("posted", postedFilter);
      const cursor = opts?.cursor ?? nextCursorRef.current;
      if (!reset && cursor) params.set("cursor", cursor);
      if (targetUserId) params.set("targetUserId", targetUserId);

      try {
        const res = await fetch(`/api/scripts?${params.toString()}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Não foi possível carregar os roteiros.");
        }

        const incoming = Array.isArray(data?.items) ? (data.items as ScriptItem[]) : [];
        const cursor = data?.pagination?.nextCursor ?? null;
        const more = Boolean(data?.pagination?.hasMore);

        setScripts((prev) => {
          if (reset) return incoming;
          const map = new Map<string, ScriptItem>();
          [...prev, ...incoming].forEach((item) => map.set(item.id, item));
          return Array.from(map.values());
        });
        setNextCursor(cursor);
        setHasMore(more);
      } catch (err: any) {
        setGlobalError(err?.message || "Erro inesperado ao carregar roteiros.");
      } finally {
        if (reset) setLoadingList(false);
        else setLoadingMore(false);
      }
    },
    [postedFilter, targetUserId]
  );

  const fetchPlannerSlots = useCallback(async () => {
    try {
      const res = await fetch("/api/planner/plan", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok) return;
      const weekStart = typeof data?.weekStart === "string" ? data.weekStart : null;
      const slots = Array.isArray(data?.plan?.slots) ? data.plan.slots : [];
      setPlannerWeekStart(weekStart);
      setPlannerSlots(
        slots
          .filter((slot: any) => typeof slot?.slotId === "string")
          .map((slot: any) => ({
            slotId: slot.slotId,
            dayOfWeek: Number(slot.dayOfWeek || 0),
            blockStartHour: Number(slot.blockStartHour || 0),
          }))
      );
    } catch {
      // Falha silenciosa (vínculo é opcional).
    }
  }, []);

  useEffect(() => {
    fetchScripts({ reset: true });
  }, [fetchScripts, postedFilter, targetUserId]);

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
    hasFetchedContentOptionsRef.current = false;
    setPublicationSavingScriptId(null);
    setQuickPublishAnchorScriptId(null);
    setQuickPublishContentId("");
    setQuickPublishSaving(false);
    setQuickPublishQuery("");
  }, [targetUserId, resetDraftHistory]);

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

  const openCreateEditor = useCallback(() => {
    if (!isActingOnBehalf && !plannerWeekStart && plannerSlots.length === 0) {
      void fetchPlannerSlots();
    }
    setEditor(createInitialEditorState());
    resetDraftHistory({ title: "", content: "" });
    setEditorOpen(true);
  }, [fetchPlannerSlots, isActingOnBehalf, plannerSlots.length, plannerWeekStart, resetDraftHistory]);

  const openExistingEditor = useCallback((script: ScriptItem) => {
    if (!isActingOnBehalf && !plannerWeekStart && plannerSlots.length === 0) {
      void fetchPlannerSlots();
    }
    const initialTitle = script.title || "";
    const initialContent = script.content || "";
    setEditor({
      id: script.id,
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
    resetDraftHistory({ title: initialTitle, content: initialContent });
    setEditorOpen(true);
  }, [fetchPlannerSlots, isActingOnBehalf, plannerSlots.length, plannerWeekStart, resetDraftHistory]);

  useEffect(() => {
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
        const response = await fetch(`/api/scripts/${requestedScriptId}${suffix}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok || !payload?.item) {
          throw new Error(payload?.error || "Não foi possível abrir o roteiro da campanha.");
        }
        if (cancelled) return;

        const item = payload.item as ScriptItem;
        hasAutoOpenedQueryScriptRef.current = requestedScriptId;
        setScripts((prev) => (prev.some((entry) => entry.id === item.id) ? prev : [item, ...prev]));
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
    loadingList,
    openExistingEditor,
    requestedScriptId,
    scripts,
    targetUserId,
    toast,
  ]);

  const patchScriptList = useCallback((updated: ScriptItem) => {
    setScripts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  }, []);

  const patchScriptPublication = useCallback(
    async (script: ScriptItem, publicationPatch: { isPosted: boolean; postedContentId: string | null }) => {
      const payload: Record<string, unknown> = {
        title: script.title || "Roteiro sem título",
        content: script.content || "",
        isPosted: publicationPatch.isPosted,
        postedContentId: publicationPatch.postedContentId,
        targetUserId: targetUserId || undefined,
      };

      const res = await fetch(`/api/scripts/${script.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.item) {
        throw new Error(data?.error || "Não foi possível atualizar o status de postagem.");
      }

      const updated = data.item as ScriptItem;
      patchScriptList(updated);
      return updated;
    },
    [patchScriptList, targetUserId]
  );

  const handleCardPublicationAction = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>, script: ScriptItem) => {
      event.preventDefault();
      event.stopPropagation();
      if (publicationSavingScriptId || quickPublishSaving) return;

      if (script.publication?.isPosted) {
        try {
          setPublicationSavingScriptId(script.id);
          await patchScriptPublication(script, { isPosted: false, postedContentId: null });
          toast({ variant: "success", title: "Roteiro desmarcado como postado." });
        } catch (error: any) {
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
      if (!options || options.length === 0) {
        toast({
          variant: "warning",
          title: "Sem conteúdos disponíveis para vincular. Abra o roteiro para escolher depois.",
        });
        return;
      }

      setQuickPublishAnchorScriptId((current) => (current === script.id ? null : script.id));
      setQuickPublishContentId(options[0]?.id || "");
      setQuickPublishQuery("");
    },
    [
      ensureContentOptionsLoaded,
      patchScriptPublication,
      publicationSavingScriptId,
      quickPublishSaving,
      toast,
    ]
  );

  const handleConfirmQuickPublish = useCallback(async () => {
    const targetScript = quickPublishAnchorScriptId
      ? scripts.find((script) => script.id === quickPublishAnchorScriptId) || null
      : null;
    if (!targetScript) return;
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
      toast({ variant: "success", title: "Roteiro marcado como postado." });
      setQuickPublishAnchorScriptId(null);
      setQuickPublishContentId("");
      setQuickPublishQuery("");
    } catch (error: any) {
      toast({
        variant: "error",
        title: error?.message || "Não foi possível marcar o roteiro como postado.",
      });
    } finally {
      setQuickPublishSaving(false);
    }
  }, [patchScriptPublication, quickPublishAnchorScriptId, quickPublishContentId, scripts, toast]);

  const handleSave = useCallback(async () => {
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

        const res = await fetch(`/api/scripts/${editor.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Não foi possível salvar o roteiro.");
        }
        const updated = data.item as ScriptItem;
        patchScriptList(updated);
        patchEditor({
          id: updated.id,
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

        if (editor.slotId && plannerWeekStart) {
          const slot = slotOptions.find((option) => option.slotId === editor.slotId);
          if (slot) {
            body.linkToSlot = {
              slotId: slot.slotId,
              weekStart: plannerWeekStart,
              dayOfWeek: slot.dayOfWeek,
              blockStartHour: slot.blockStartHour,
            };
          }
        }

        const res = await fetch("/api/scripts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Não foi possível criar o roteiro.");
        }

        const created = data.item as ScriptItem;
        setScripts((prev) => [created, ...prev]);
        patchEditor({
          id: created.id,
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
      patchEditor({
        saving: false,
        saved: false,
        error: err?.message || "Erro ao salvar roteiro.",
      });
    }
  }, [editor, flushPendingDraftSnapshot, isAdminViewer, patchEditor, patchScriptList, plannerWeekStart, slotOptions, targetUserId]);

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
      await fetchPlannerSlots();
    } catch (err: any) {
      patchEditor({ deleting: false, error: err?.message || "Erro ao excluir roteiro." });
    }
  }, [editor.id, fetchPlannerSlots, patchEditor, resetDraftHistory, targetUserId]);

  const handleAiAdjust = useCallback(async () => {
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
        setScripts((prev) => [created, ...prev]);
        patchEditor({
          id: created.id,
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
    commitDraftSnapshot,
    editor.adminAnnotationDraft,
    editor.aiPrompt,
    editor.id,
    editor.title,
    flushPendingDraftSnapshot,
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

  const handleLinkToCampaign = useCallback(async () => {
    if (!editor.id) {
      toast({
        variant: "warning",
        title: "Salve o roteiro antes de vincular à campanha.",
      });
      return;
    }

    if (!selectedCampaignId) {
      toast({
        variant: "warning",
        title: "Selecione uma campanha para vincular.",
      });
      return;
    }

    try {
      setLinkingToCampaign(true);
      const response = await fetch(`/api/proposals/${selectedCampaignId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "script",
          entityId: editor.id,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível vincular roteiro à campanha.");
      }

      toast({
        variant: "success",
        title: payload?.created === false ? "Roteiro já estava vinculado." : "Roteiro vinculado à campanha.",
      });
    } catch (error: any) {
      toast({
        variant: "error",
        title: error?.message || "Falha ao vincular roteiro.",
      });
    } finally {
      setLinkingToCampaign(false);
    }
  }, [editor.id, selectedCampaignId, toast]);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const selectedPostedContentOption = contentOptions.find((option) => option.id === editor.postedContentId) || null;
  const selectedPostedContentMissing =
    Boolean(editor.postedContentId) && !selectedPostedContentOption && Boolean(editor.publication?.content);
  const quickPublishQueryNormalized = quickPublishQuery.trim().toLowerCase();
  const filteredQuickPublishOptions = useMemo(() => {
    if (!quickPublishQueryNormalized) return contentOptions;
    return contentOptions.filter((option) => {
      const haystack = `${option.caption} ${option.type || ""}`.toLowerCase();
      return haystack.includes(quickPublishQueryNormalized);
    });
  }, [contentOptions, quickPublishQueryNormalized]);
  const selectedQuickPublishOption =
    contentOptions.find((option) => option.id === quickPublishContentId) || null;

  if (editorOpen) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--header-h,56px))] flex-col overflow-hidden bg-white [-webkit-tap-highlight-color:transparent]">
        <header className="shrink-0 border-b border-slate-100 bg-white">
          <div className="dashboard-page-shell py-3 sm:py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full min-w-0 items-center gap-2 sm:flex-1 sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    flushPendingDraftSnapshot();
                    setEditorOpen(false);
                    setEditor(createInitialEditorState());
                    resetDraftHistory({ title: "", content: "" });
                  }}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
                  aria-label="Voltar para Meus Roteiros"
                >
                  <ArrowLeft size={18} />
                </button>
                <input
                  type="text"
                  value={editor.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  onKeyDown={handleDraftKeyDown}
                  placeholder="Roteiro sem título"
                  className="min-w-0 w-full flex-1 border-0 bg-transparent p-0 text-base font-medium text-slate-900 outline-none ring-0 ring-transparent placeholder:text-slate-300 focus:border-transparent focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 sm:max-w-[520px] sm:min-w-[220px] sm:text-lg"
                />
              </div>

              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
                {requestedProposalId ? (
                  <button
                    type="button"
                    onClick={handleReturnToCampaign}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Voltar para campanha
                  </button>
                ) : null}
                {!isAdminViewer ? (
                  <>
                    <select
                      value={selectedCampaignId}
                      onChange={(e) => setSelectedCampaignId(e.target.value)}
                      disabled={campaignsLoading || linkingToCampaign || campaignOptions.length === 0}
                      className="min-w-[190px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      {campaignsLoading ? (
                        <option value="">Carregando campanhas...</option>
                      ) : campaignOptions.length === 0 ? (
                        <option value="">Sem campanhas disponíveis</option>
                      ) : (
                        campaignOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.campaignTitle} · {option.brandName}
                          </option>
                        ))
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={handleLinkToCampaign}
                      disabled={
                        linkingToCampaign ||
                        campaignsLoading ||
                        !selectedCampaignId ||
                        !editor.id
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      {linkingToCampaign ? "Vinculando..." : "Vincular à campanha"}
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={applyUndo}
                  disabled={!canUndo}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Desfazer edição"
                >
                  <Undo2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={applyRedo}
                  disabled={!canRedo}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Refazer edição"
                >
                  <Redo2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={editor.saving}
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${editor.saved
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                    }`}
                >
                  <Save size={15} />
                  {editor.saving ? "Salvando..." : editor.saved ? "Salvo" : "Salvar"}
                </button>
                {editor.id ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={editor.deleting}
                    className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                  >
                    <Trash2 size={15} />
                    {editor.deleting ? "Excluindo..." : "Excluir"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="dashboard-page-shell flex-1 min-h-0 py-2 flex gap-4 h-full relative">
          <div className="mx-auto flex h-full w-full max-w-[860px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 sm:px-6">
            {editor.recommendation?.isRecommended ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:text-sm">
                Recomendação especial
                {editor.recommendation.recommendedByAdminName
                  ? ` de ${editor.recommendation.recommendedByAdminName}`
                  : " do time"}{" "}
                {editor.recommendation.recommendedAt
                  ? `(${formatDate(editor.recommendation.recommendedAt)})`
                  : ""}.
              </div>
            ) : null}
            {editor.adminAnnotation?.notes?.trim() ? (
              <div className="mt-3 rounded-xl border border-[#FFDEE9] bg-[#FFF6F9] px-3 py-2 text-xs text-slate-700 sm:text-sm">
                <p className="font-semibold text-slate-800">Feedback do admin</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{editor.adminAnnotation.notes}</p>
                {editor.adminAnnotation.updatedAt ? (
                  <p className="mt-1 text-[11px] text-slate-500">
                    {editor.adminAnnotation.updatedByName || "Admin"} · {formatDate(editor.adminAnnotation.updatedAt)}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="flex-1 min-h-[62vh] relative">
              <InlineScriptEditor
                content={editor.content}
                onChangeContent={handleContentChange}
                annotations={editor.inlineAnnotations}
                onAnnotationsChange={(newAnnotations) => patchEditor({ inlineAnnotations: newAnnotations, saved: false })}
                onKeyDown={handleDraftKeyDown}
                isAdminViewer={isAdminViewer}
                viewerName={viewer?.name || "Admin"}
                placeholder="Escreva seu roteiro aqui..."
              />
            </div>

            {isAdminViewer ? (
              <div className="shrink-0 border-t border-slate-100 py-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-500">Feedback para creator (admin)</p>
                  {editor.adminAnnotation?.updatedAt ? (
                    <p className="text-[11px] text-slate-400">
                      {editor.adminAnnotation.updatedByName || "Admin"} · {formatDate(editor.adminAnnotation.updatedAt)}
                    </p>
                  ) : null}
                </div>
                <textarea
                  value={editor.adminAnnotationDraft}
                  onChange={(e) =>
                    patchEditor({
                      adminAnnotationDraft: e.target.value,
                      saved: false,
                    })
                  }
                  placeholder="Esse feedback aparece para o dono do roteiro."
                  className="h-24 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                />
              </div>
            ) : null}

            <div className="shrink-0 border-t border-slate-100 py-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={editor.isPosted}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      patchEditor({
                        isPosted: checked,
                        postedContentId: checked ? editor.postedContentId || contentOptions[0]?.id || "" : "",
                        publication: checked ? editor.publication : null,
                        saved: false,
                        error: null,
                      });
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                  />
                  Marcar como roteiro postado
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  Ao marcar, selecione o conteúdo publicado para correlacionar o engajamento.
                </p>

                {editor.isPosted ? (
                  <div className="mt-3 space-y-2">
                    <select
                      value={editor.postedContentId}
                      onChange={(event) =>
                        patchEditor({
                          postedContentId: event.target.value,
                          saved: false,
                          error: null,
                        })
                      }
                      disabled={contentOptionsLoading || contentOptions.length === 0}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      {contentOptionsLoading ? (
                        <option value="">Carregando conteúdos...</option>
                      ) : (
                        <option value="">Selecione o conteúdo publicado</option>
                      )}
                      {selectedPostedContentMissing ? (
                        <option value={editor.postedContentId}>
                          {getPostedContentLabel(editor.publication)} (vínculo atual)
                        </option>
                      ) : null}
                      {contentOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {buildContentOptionLabel(option)}
                        </option>
                      ))}
                    </select>

                    {selectedPostedContentOption || selectedPostedContentMissing ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                        <p className="font-semibold">
                          {selectedPostedContentOption?.caption || getPostedContentLabel(editor.publication)}
                        </p>
                        <p className="mt-1">
                          Postado em{" "}
                          {selectedPostedContentOption?.postDate
                            ? formatDate(selectedPostedContentOption.postDate)
                            : editor.publication?.content?.postDate
                              ? formatDate(editor.publication.content.postDate)
                              : "-"}{" "}
                          · Interações{" "}
                          {formatNumber(
                            selectedPostedContentOption?.totalInteractions ??
                            editor.publication?.content?.totalInteractions ??
                            null
                          )}{" "}
                          · Engajamento{" "}
                          {typeof (selectedPostedContentOption?.engagement ??
                            editor.publication?.content?.engagement) === "number"
                            ? `${(selectedPostedContentOption?.engagement ??
                              editor.publication?.content?.engagement ??
                              0).toFixed(2)}`
                            : "-"}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-100 py-4">
              <p className="mb-2 text-xs font-medium text-slate-500">Assistente IA</p>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
                <input
                  type="text"
                  value={editor.aiPrompt}
                  onChange={(e) => patchEditor({ aiPrompt: e.target.value })}
                  onKeyDown={handleAiPromptKeyDown}
                  placeholder="Peça um roteiro novo ou ajuste no roteiro atual..."
                  className="flex-1 border-0 bg-transparent px-2 py-2 text-sm text-slate-800 outline-none ring-0 ring-transparent placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0"
                />
                <button
                  type="button"
                  onClick={handleAiAdjust}
                  disabled={editor.adjusting}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  <Sparkles size={14} />
                  {editor.adjusting ? "Processando..." : "Enviar"}
                </button>
              </div>
            </div>
            {editor.error ? <p className="shrink-0 pb-4 text-sm text-rose-600">{editor.error}</p> : null}
          </div>

          {/* Annotations Sidebar */}
          {editor.inlineAnnotations.length > 0 && (
            <div className="hidden xl:flex w-80 shrink-0 flex-col gap-3 overflow-y-auto pl-4 pb-4">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">Comentários</h3>
              {editor.inlineAnnotations.map((ann) => (
                <div
                  key={ann.id}
                  className={`relative flex flex-col gap-2 rounded-xl border p-4 shadow-sm transition-opacity ${ann.isOrphaned ? "border-slate-200 bg-slate-50 opacity-60" : "border-amber-200 bg-amber-50/50 hover:bg-amber-100/50"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">{ann.authorName}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      {ann.isOrphaned ? "Órfão" : formatDate(ann.createdAt)}
                    </span>
                  </div>
                  <p className="border-l-2 border-slate-300 pl-2 text-xs italic text-slate-500 break-words line-clamp-3">
                    &quot;{ann.quote}&quot;
                  </p>
                  <p className="text-sm font-medium text-slate-800 break-words">
                    {ann.comment}
                  </p>
                  {isAdminViewer && !ann.resolved && (
                    <button
                      onClick={() => {
                        const nextAnnotations = editor.inlineAnnotations.map((a) =>
                          a.id === ann.id ? { ...a, resolved: true } : a
                        );
                        patchEditor({ inlineAnnotations: nextAnnotations, saved: false });
                      }}
                      className="mt-2 self-start rounded bg-slate-200 px-2 py-1 text-[10px] font-bold uppercase text-slate-600 hover:bg-slate-300"
                    >
                      Resolver
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="dashboard-page-shell py-8">
        {isAdminViewer ? (
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="w-full sm:max-w-md">
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

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Meus Roteiros</h1>
            {!isActingOnBehalf ? (
              <p className="mt-1 text-slate-500">Escolha um roteiro salvo ou comece um novo.</p>
            ) : null}
          </div>
          {requestedProposalId ? (
            <button
              type="button"
              onClick={handleReturnToCampaign}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Voltar para campanha
            </button>
          ) : null}
        </div>

        <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {([
            { id: "all", label: "Todos" },
            { id: "posted", label: "Postados" },
            { id: "unposted", label: "Não postados" },
          ] as Array<{ id: ScriptPostedFilter; label: string }>).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPostedFilter(option.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                postedFilter === option.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {globalError ? <p className="mb-4 text-sm text-rose-600">{globalError}</p> : null}

        {loadingList ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div
                key={`loading-${idx}`}
                className="h-64 animate-pulse rounded-[1.5rem] border border-slate-200 bg-white shadow-sm sm:h-72 sm:rounded-[2rem]"
              >
                <div className="h-11 border-b border-slate-100 bg-slate-50" />
                <div className="p-5">
                  <div className="h-4 w-2/3 rounded bg-slate-100" />
                  <div className="mt-3 h-3 w-full rounded bg-slate-100/80" />
                  <div className="mt-2 h-3 w-4/5 rounded bg-slate-100/70" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-slate-100/60" />
                </div>
                <div className="mx-5 mt-6 h-10 rounded-xl bg-slate-50" />
              </div>
            ))}
          </div>
        ) : scripts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="mb-4 text-slate-700">
              {isActingOnBehalf
                ? `${adminTargetUser?.name} ainda não tem roteiros salvos.`
                : "Você ainda não tem roteiros salvos."}
            </p>
            <button
              type="button"
              onClick={openCreateEditor}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus size={16} />
              Criar meu primeiro roteiro
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              <button
                type="button"
                onClick={openCreateEditor}
                className="group flex h-64 flex-col overflow-hidden rounded-[1.5rem] border border-slate-300 bg-white text-left shadow-sm ring-1 ring-transparent transition hover:-translate-y-1 hover:border-slate-400 hover:shadow-xl hover:ring-slate-200 sm:h-72 sm:rounded-[2rem]"
              >
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Novo</span>
                </div>
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-5">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition group-hover:bg-slate-900 group-hover:text-white">
                    <Plus size={18} />
                  </span>
                  <span className="text-sm font-semibold text-slate-800">Novo Roteiro</span>
                  <span className="text-xs text-slate-500">Começar em branco</span>
                </div>
              </button>

              {scripts.map((script) => {
                const tone = getSourceCardTone(script.source);
                const hasAdminAnnotation = Boolean(script.adminAnnotation?.notes?.trim());
                const hasUnreadFeedback = unreadFeedbackScriptIds.has(script.id);
                const isPosted = Boolean(script.publication?.isPosted);
                const isPublicationSaving = publicationSavingScriptId === script.id;
                return (
                  <div
                    key={script.id}
                    className={`group relative flex h-64 flex-col overflow-visible rounded-[1.5rem] border border-slate-200 bg-white text-left shadow-sm ring-1 ring-transparent transition hover:-translate-y-1 hover:shadow-xl ${tone.ring} sm:h-72 sm:rounded-[2rem]`}
                  >
                    <button type="button" onClick={() => openExistingEditor(script)} className="flex h-full w-full flex-col text-left">
                      <div className={`flex items-center justify-between gap-2 border-b px-5 py-3 ${tone.header}`}>
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${tone.text}`}>
                          {getSourceLabel(script.source)}
                        </span>
                        {script.recommendation?.isRecommended ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            Recomendação
                          </span>
                        ) : null}
                        {hasAdminAnnotation ? (
                          <span className="rounded-full bg-[#FFE7EF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#C3265C]">
                            {hasUnreadFeedback ? "Novo feedback" : isAdminViewer ? "Feedback ativo" : "Feedback"}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex min-h-0 flex-1 flex-col p-5">
                        <p className="line-clamp-2 text-base font-semibold leading-tight text-slate-900">
                          {getCardTitle(script)}
                        </p>

                        <div className="mt-3 flex-1 overflow-hidden">
                          <p className="line-clamp-7 overflow-hidden break-words text-sm leading-relaxed text-slate-500">
                            {getCardPreview(script)}
                          </p>
                        </div>

                        <p className="mt-auto pt-4 text-[11px] font-medium text-slate-400">
                          Atualizado em {formatDate(script.updatedAt)}
                        </p>
                        {script.recommendation?.isRecommended ? (
                          <p className="pt-1 text-[11px] font-medium text-amber-700">
                            Recomendado por{" "}
                            {script.recommendation.recommendedByAdminName || "Admin"}
                          </p>
                        ) : null}
                        {hasAdminAnnotation ? (
                          <p className="line-clamp-1 pt-1 text-[11px] font-medium text-slate-600">
                            {hasUnreadFeedback ? "Novo: " : ""}Feedback: {script.adminAnnotation?.notes}
                          </p>
                        ) : null}
                        {isPosted ? (
                          <p className="line-clamp-1 pt-1 text-[11px] font-medium text-emerald-700">
                            {getPostedContentLabel(script.publication)}
                            {script.publication?.content?.postDate
                              ? ` · ${formatDate(script.publication.content.postDate)}`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        void handleCardPublicationAction(event, script);
                      }}
                      disabled={isPublicationSaving}
                      className={`absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        isPosted
                          ? "border-emerald-200 bg-emerald-500 text-white"
                          : "border-slate-300 bg-white text-slate-500 hover:border-slate-400"
                      }`}
                      title={isPosted ? "Desmarcar como postado" : "Marcar como postado"}
                      aria-label={isPosted ? "Desmarcar como postado" : "Marcar como postado"}
                    >
                      {isPosted ? <Check size={13} strokeWidth={3} /> : <span className="h-2 w-2 rounded-full bg-current" />}
                    </button>

                    {quickPublishAnchorScriptId === script.id && !isPosted ? (
                      <div
                        ref={quickPublishPopoverRef}
                        className="absolute right-2 top-12 z-20 w-[min(92vw,340px)] rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conteúdo publicado</p>
                        <input
                          type="text"
                          value={quickPublishQuery}
                          onChange={(event) => setQuickPublishQuery(event.target.value)}
                          placeholder="Buscar legenda ou tipo..."
                          disabled={quickPublishSaving}
                          className="mt-2 w-full rounded-md border border-slate-200 px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100"
                        />
                        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-1.5">
                          {contentOptionsLoading ? (
                            <p className="px-2 py-2 text-xs text-slate-500">Carregando conteúdos...</p>
                          ) : filteredQuickPublishOptions.length === 0 ? (
                            <p className="px-2 py-2 text-xs text-slate-500">Nenhum conteúdo encontrado.</p>
                          ) : (
                            filteredQuickPublishOptions.slice(0, 20).map((option) => {
                              const selected = quickPublishContentId === option.id;
                              return (
                                <button
                                  type="button"
                                  key={option.id}
                                  onClick={() => setQuickPublishContentId(option.id)}
                                  disabled={quickPublishSaving}
                                  className={`w-full rounded-md border bg-white px-2 py-2 text-left text-xs transition ${
                                    selected
                                      ? "border-emerald-300 ring-2 ring-emerald-100"
                                      : "border-slate-200 hover:border-slate-300"
                                  }`}
                                >
                                  <p className="line-clamp-2 font-semibold text-slate-700">{option.caption}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    {option.postDate ? formatDateCompact(option.postDate) : "Sem data"} · Eng{" "}
                                    {typeof option.engagement === "number" ? option.engagement.toFixed(2) : "-"} · Interações{" "}
                                    {formatNumber(option.totalInteractions)}
                                  </p>
                                </button>
                              );
                            })
                          )}
                        </div>
                        {selectedQuickPublishOption ? (
                          <p className="mt-2 line-clamp-1 text-[11px] text-emerald-700">
                            Selecionado: {selectedQuickPublishOption.caption}
                          </p>
                        ) : null}
                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (quickPublishSaving) return;
                              setQuickPublishAnchorScriptId(null);
                              setQuickPublishContentId("");
                              setQuickPublishQuery("");
                            }}
                            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            disabled={quickPublishSaving}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleConfirmQuickPublish();
                            }}
                            disabled={quickPublishSaving || !quickPublishContentId}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            <Check size={12} />
                            {quickPublishSaving ? "Salvando..." : "Marcar"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {hasMore ? (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => fetchScripts({ cursor: nextCursor })}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {loadingMore ? "Carregando..." : "Carregar mais"}
                </button>
              </div>
            ) : null}
          </>
        )}

      </div>
    </div>
  );
}
