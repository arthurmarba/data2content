"use client";

import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Save, Trash2, Sparkles, Plus, Undo2, Redo2, Check, Link2, Lock } from "lucide-react";
import { useToast } from "@/app/components/ui/ToastA11yProvider";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { redirectToGoogleConsentLogin } from "@/lib/auth/googleLogin";
import { track } from "@/lib/track";
import { PAYWALL_RETURN_STORAGE_KEY } from "@/types/paywall";
import {
  LAST_VIEWED_SCRIPTS_ADMIN_FEEDBACK_AT_KEY,
  LAST_VIEWED_SCRIPTS_RECOMMENDATIONS_AT_KEY,
} from "@/app/dashboard/hooks/useScriptRecommendationsNotifications";

const CreatorQuickSearch = dynamic(
  () => import("@/app/admin/creator-dashboard/components/CreatorQuickSearch"),
  { ssr: false, loading: () => null }
);
import { usePaywallOpener } from "@/app/dashboard/components/sidebar/hooks";
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

type PlannerSlotOption = {
  slotId: string;
  dayOfWeek: number;
  blockStartHour: number;
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

const PREVIEW_SCRIPTS: ScriptItem[] = [
  {
    id: "preview-script-1",
    title: "Roteiro para abrir a semana com posicionamento forte",
    content:
      "Hook: 'Se você começa a semana decidindo post na hora, o problema não é falta de ideia. É falta de sistema.'\n\nCena 1: mostra seu bloco de notas ou calendário aberto.\nCena 2: explica que você separa a semana em conteúdo de autoridade, relacionamento e comercial.\nCena 3: dá um exemplo real de pauta que já virou roteiro.\nCTA: 'Se quiser, comenta CALENDÁRIO que eu trago a estrutura completa.'",
    source: "planner",
    linkType: "planner_slot",
    plannerRef: {
      slotId: "preview-slot-seg-9",
      weekStart: "2026-03-30",
      dayOfWeek: 1,
      blockStartHour: 9,
    },
    aiVersionId: null,
    recommendation: {
      isRecommended: true,
      recommendedByAdminName: "Time D2C",
      recommendedAt: "2026-03-31T10:00:00.000Z",
    },
    adminAnnotation: null,
    inlineAnnotations: [],
    publication: null,
    linkingSummary: {
      isLinked: false,
      totalLinks: 0,
      campaigns: [],
    },
    createdAt: "2026-03-31T09:00:00.000Z",
    updatedAt: "2026-04-01T12:20:00.000Z",
  },
  {
    id: "preview-script-2",
    title: "Roteiro comercial com cara de caso real, não de publi engessada",
    content:
      "Hook: 'Esse foi o briefing que parecia simples, mas quase derrubou a negociação.'\n\nDesenvolvimento: contextualize a entrega, mostre a objeção principal e como você reposicionou o valor usando dados do perfil.\nProva: entra com um frame de resultado ou bastidor da aprovação.\nCTA: 'Se você quer cobrar melhor sem travar na negociação, salva esse roteiro.'",
    source: "ai",
    linkType: "standalone",
    plannerRef: null,
    aiVersionId: "preview-ai-version",
    recommendation: null,
    adminAnnotation: {
      notes: "Bom exemplo de roteiro comercial que educa antes de vender.",
      updatedByName: "Time D2C",
      updatedAt: "2026-04-01T14:15:00.000Z",
    },
    inlineAnnotations: [],
    publication: {
      isPosted: false,
      postedAt: null,
      content: null,
    },
    linkingSummary: {
      isLinked: true,
      totalLinks: 1,
      campaigns: [
        {
          proposalId: "preview-campaign-1",
          linkId: "preview-link-1",
          campaignTitle: "Campanha de creator commerce para rotina saudável",
          brandName: "VivaLeve",
          linkedAt: "2026-04-01T14:20:00.000Z",
        },
      ],
    },
    createdAt: "2026-03-29T11:00:00.000Z",
    updatedAt: "2026-04-01T14:20:00.000Z",
  },
  {
    id: "preview-script-3",
    title: "Checklist de sexta para não entrar perdido na próxima semana",
    content:
      "Abertura: 'Antes de fechar o notebook hoje, eu faço essas 3 checagens.'\n\n1. Qual conteúdo puxou mais resposta ou compartilhamento.\n2. Qual insight precisa virar pauta na semana que vem.\n3. O que já merece virar roteiro pronto.\n\nFecho: 'Se você é creator e vive começando a semana no improviso, salva isso.'",
    source: "manual",
    linkType: "standalone",
    plannerRef: null,
    aiVersionId: null,
    recommendation: null,
    adminAnnotation: null,
    inlineAnnotations: [],
    publication: {
      isPosted: true,
      postedAt: "2026-03-30T18:00:00.000Z",
      content: {
        id: "preview-content-1",
        caption: "3 checagens simples que eu faço toda sexta para não começar a semana perdida",
        postDate: "2026-03-30T18:00:00.000Z",
        postLink: "https://instagram.com/p/preview",
        type: "reel",
        coverUrl: null,
        engagement: 4.7,
        totalInteractions: 1820,
      },
    },
    linkingSummary: {
      isLinked: false,
      totalLinks: 0,
      campaigns: [],
    },
    createdAt: "2026-03-28T13:00:00.000Z",
    updatedAt: "2026-03-30T18:00:00.000Z",
  },
];

export default function MyScriptsPage({
  viewer,
  compactView = false,
  canInteract = true,
  showPreviewBanner = true,
}: {
  viewer?: ViewerInfo;
  compactView?: boolean;
  canInteract?: boolean;
  showPreviewBanner?: boolean;
}) {
  const openPaywall = usePaywallOpener();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const billingStatus = useBillingStatus();
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
  const [activeInlineAnnotationId, setActiveInlineAnnotationId] = useState<string | null>(null);
  const [adminTargetUser, setAdminTargetUser] = useState<AdminTargetUser | null>(null);
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
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
  const isAdminViewer = viewer?.role === "admin";
  const billingInstagramConnected = Boolean(billingStatus.instagram?.connected);
  const instagramConnected = isAdminViewer
    ? true
    : billingStatus.hasResolvedOnce
      ? billingInstagramConnected
      : billingInstagramConnected || Boolean(session?.user?.instagramConnected);
  const isAuthenticated = Boolean((session?.user as any)?.id || viewer?.id);
  const isPreviewMode = !isAdminViewer && !isAuthenticated && sessionStatus === "unauthenticated";
  const isSessionPending = !isAdminViewer && !isAuthenticated && sessionStatus === "loading";
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

  const slotOptions = useMemo(() => {
    return plannerSlots
      .filter((slot) => Boolean(slot.slotId))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.blockStartHour - b.blockStartHour);
  }, [plannerSlots]);

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

  useEffect(() => {
    if (!editorOpen || isAdminViewer || hasFetchedCampaignOptionsRef.current) return;
    void ensureCampaignOptionsLoaded();
  }, [editorOpen, ensureCampaignOptionsLoaded, isAdminViewer]);

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
      if (contentOptionsNextCursorRef.current && !contentOptionsHydratingRef.current) {
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
      hasFetchedContentOptionsRef.current = true;
      contentOptionsLoadErrorRef.current = null;
      const nextCursor =
        typeof payload?.pagination?.nextCursor === "string" && payload.pagination.nextCursor.trim()
          ? payload.pagination.nextCursor.trim()
          : null;
      contentOptionsNextCursorRef.current =
        Boolean(payload?.pagination?.hasMore) && Boolean(nextCursor) ? nextCursor : null;
      if (contentOptionsNextCursorRef.current) {
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
      contentOptionsLoadErrorRef.current = title;
      toast({
        variant: "warning",
        title,
      });
      return null;
    } finally {
      setContentOptionsLoading(false);
    }
  }, [contentOptions, hydrateRemainingContentOptions, targetUserId, toast]);

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
    [postedFilter, targetUserId]
  );

  const fetchPlannerSlots = useCallback(async () => {
    try {
      const { response, payload } = await fetchJsonWithRetry("/api/planner/plan", { cache: "no-store" });
      if (!response.ok || !payload?.ok) return;
      const weekStart = typeof payload?.weekStart === "string" ? payload.weekStart : null;
      const slots = Array.isArray(payload?.plan?.slots) ? payload.plan.slots : [];
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
    if (isSessionPending) return;
    if (isPreviewMode) {
      setScripts(PREVIEW_SCRIPTS);
      setLoadingList(false);
      setLoadingMore(false);
      setGlobalError(null);
      setNextCursor(null);
      setHasMore(false);
      return;
    }
    void fetchScripts({ reset: true });
  }, [fetchScripts, isPreviewMode, isSessionPending]);

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
    setSelectedCampaignId("");
    hasFetchedCampaignOptionsRef.current = false;
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
    if (!isActingOnBehalf && !plannerWeekStart && plannerSlots.length === 0) {
      void fetchPlannerSlots();
    }
    setEditor(createInitialEditorState());
    setActiveInlineAnnotationId(null);
    resetDraftHistory({ title: "", content: "" });
    setEditorOpen(true);
  }, [
    fetchPlannerSlots,
    isActingOnBehalf,
    isPreviewMode,
    plannerSlots.length,
    plannerWeekStart,
    requestGoogleLogin,
    resetDraftHistory,
  ]);

  const openExistingEditor = useCallback((script: ScriptItem) => {
    if (isPreviewMode) {
      void requestGoogleLogin();
      return;
    }
    if (!isActingOnBehalf && !plannerWeekStart && plannerSlots.length === 0) {
      void fetchPlannerSlots();
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
  }, [
    fetchPlannerSlots,
    isActingOnBehalf,
    isPreviewMode,
    plannerSlots.length,
    plannerWeekStart,
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
    [patchScriptList, targetUserId]
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
    patchEditor,
    patchScriptList,
    plannerWeekStart,
    slotOptions,
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
      await fetchPlannerSlots();
    } catch (err: any) {
      patchEditor({ deleting: false, error: err?.message || "Erro ao excluir roteiro." });
    }
  }, [editor.id, fetchPlannerSlots, patchEditor, resetDraftHistory, targetUserId]);

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
  type CompactEditorSummaryItem = {
    key: "recommendation" | "admin-feedback" | "revisions";
    tone: "amber" | "rose" | "sky";
    title: string;
    description: string;
  };

  const compactEditorSummaryItems: CompactEditorSummaryItem[] = compactView
    ? [
        editor.recommendation?.isRecommended
          ? {
              key: "recommendation",
              tone: "amber" as const,
              title: "Recomendação",
              description: editor.recommendation.recommendedByAdminName
                ? `Sinalizada por ${editor.recommendation.recommendedByAdminName}`
                : "Sinalizada pelo time",
            }
          : null,
        editor.adminAnnotation?.notes?.trim()
          ? {
              key: "admin-feedback",
              tone: "rose" as const,
              title: "Feedback do admin",
              description: editor.adminAnnotation.notes.trim(),
            }
          : null,
        editor.inlineAnnotations.length > 0
          ? {
              key: "revisions",
              tone: "sky" as const,
              title: "Revisões",
              description:
                editor.inlineAnnotations.length === 1
                  ? "1 comentário no texto"
                  : `${editor.inlineAnnotations.length} comentários no texto`,
            }
          : null,
      ].filter((item): item is CompactEditorSummaryItem => item !== null)
    : [];

  if (editorOpen) {
    return (
      <div className={`flex min-h-0 flex-col bg-transparent [-webkit-tap-highlight-color:transparent] ${compactView ? "h-full overflow-hidden" : "h-full overflow-hidden"}`}>
        <header className="shrink-0 border-b border-zinc-100/90 bg-transparent">
          <div className={`mx-auto w-full ${compactView ? "px-3.5 py-2.5" : "max-w-[860px] px-4 py-3 sm:px-6 sm:py-4"}`}>
            <div className={`flex flex-col ${compactView ? "gap-2.5" : "gap-3"}`}>
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    flushPendingDraftSnapshot();
                    setEditorOpen(false);
                    setEditor(createInitialEditorState());
                    resetDraftHistory({ title: "", content: "" });
                  }}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100/80"
                  aria-label="Voltar para Meus Roteiros"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                    Meu roteiro
                  </p>
                  <input
                    type="text"
                    value={editor.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    onKeyDown={handleDraftKeyDown}
                    placeholder="Roteiro sem título"
                    className={`min-w-0 w-full border-0 bg-transparent p-0 font-semibold leading-tight text-slate-900 outline-none ring-0 ring-transparent placeholder:text-slate-300 focus:border-transparent focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 ${compactView ? "text-[17px]" : "text-lg sm:text-[1.65rem]"}`}
                  />
                </div>
              </div>

              <div className={`flex w-full flex-wrap gap-2 border-t border-zinc-100/90 ${compactView ? "items-stretch pt-2.5" : "items-center pt-3"}`}>
                {requestedProposalId ? (
                  <button
                    type="button"
                    onClick={handleReturnToCampaign}
                    className={`inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/84 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-white ${compactView ? "w-full justify-center" : ""}`}
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
                      className={`rounded-xl border border-zinc-200 bg-zinc-50/84 px-3 py-2 text-sm text-zinc-700 outline-none transition focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-100 ${compactView ? "w-full" : "min-w-[190px] flex-1 sm:flex-none"}`}
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
                      onClick={() => {
                        if (!isAuthenticated) {
                          void requestGoogleLogin();
                          return;
                        }
                        if (!canInteract) {
                          openPremiumLinkingPaywall("scripts_editor_link_btn");
                          return;
                        }
                        void handleLinkToCampaign();
                      }}
                      disabled={
                        linkingToCampaign ||
                        campaignsLoading ||
                        !selectedCampaignId ||
                        !editor.id
                      }
                      className={`inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/84 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-white disabled:opacity-60 ${compactView ? "w-full justify-center" : ""}`}
                    >
                      {linkingToCampaign ? "Vinculando..." : "Vincular à campanha"}
                    </button>
                  </>
                ) : null}
                <div className={`flex gap-2 ${compactView ? "w-full" : ""}`}>
                  <button
                    type="button"
                    onClick={applyUndo}
                    disabled={!canUndo}
                    className={`inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50/84 text-zinc-700 transition hover:border-zinc-300 hover:bg-white disabled:opacity-40 ${compactView ? "flex-1" : "w-9"}`}
                    aria-label="Desfazer edição"
                  >
                    <Undo2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={applyRedo}
                    disabled={!canRedo}
                    className={`inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50/84 text-zinc-700 transition hover:border-zinc-300 hover:bg-white disabled:opacity-40 ${compactView ? "flex-1" : "w-9"}`}
                    aria-label="Refazer edição"
                  >
                    <Redo2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={editor.saving}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:opacity-60 ${compactView ? "flex-[1.7]" : ""} ${editor.saved
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "border-zinc-200 bg-zinc-50/84 text-zinc-800 hover:border-zinc-300 hover:bg-white"
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
                      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white/88 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60 ${compactView ? "flex-[1.4]" : ""}`}
                    >
                      <Trash2 size={15} />
                      {editor.deleting ? "Excluindo..." : "Excluir"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className={`${compactView ? "flex min-h-0 flex-1 px-3.5 pb-3 pt-2" : "relative flex h-full min-h-0 flex-1 gap-4 py-2"}`}>
          <div className={`mx-auto flex w-full flex-col rounded-[1.4rem] border border-zinc-100/90 ${compactView ? "h-full min-h-0 overflow-hidden bg-white px-3.5 pt-2.5" : "h-full overflow-hidden max-w-[860px] rounded-[1.7rem] bg-white/72 px-4 backdrop-blur-xl sm:px-6"}`}>
            {compactView && compactEditorSummaryItems.length > 0 ? (
              <div className="shrink-0 space-y-2 border-b border-zinc-100/90 pb-2.5">
                {compactEditorSummaryItems.map((item) => {
                  const toneClasses =
                    item.tone === "amber"
                      ? "bg-amber-50 text-amber-700 ring-amber-100/90"
                      : item.tone === "rose"
                        ? "bg-rose-50 text-rose-600 ring-rose-100/90"
                        : "bg-sky-50 text-sky-600 ring-sky-100/90";
                  return (
                    <div key={item.key} className="flex items-start gap-2.5 rounded-[0.95rem] border border-zinc-100/90 bg-zinc-50/42 px-3 py-2.5">
                      <span className={`inline-flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-[0.75rem] ring-1 ${toneClasses}`}>
                        {item.key === "revisions" ? (
                          <span className="text-[10px] font-semibold">{editor.inlineAnnotations.length}</span>
                        ) : (
                          <Sparkles size={12} />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="dashboard-type-control text-zinc-700">{item.title}</p>
                        <p className="dashboard-type-meta mt-0.5 line-clamp-1 text-zinc-500">{item.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {!compactView && editor.recommendation?.isRecommended ? (
              <div
                className={`${
                  compactView
                    ? "mt-3 rounded-[1.05rem] border border-zinc-100/70 bg-zinc-50/52 px-3 py-3"
                    : "mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 sm:text-sm"
                }`}
              >
                {compactView ? (
                  <div className="flex items-start gap-2.5">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] bg-amber-50 text-amber-600 ring-1 ring-amber-100/90">
                      <Sparkles size={14} />
                    </span>
                    <div className="min-w-0">
                      <p className="dashboard-type-section-title text-zinc-950">Recomendação</p>
                      <p className="dashboard-type-meta mt-1 leading-relaxed text-zinc-500">
                        {editor.recommendation.recommendedByAdminName
                          ? `Sinalizada por ${editor.recommendation.recommendedByAdminName}`
                          : "Sinalizada pelo time"}
                        {editor.recommendation.recommendedAt
                          ? ` em ${formatDate(editor.recommendation.recommendedAt)}`
                          : ""}
                        .
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    Recomendação especial
                    {editor.recommendation.recommendedByAdminName
                      ? ` de ${editor.recommendation.recommendedByAdminName}`
                      : " do time"}{" "}
                    {editor.recommendation.recommendedAt
                      ? `(${formatDate(editor.recommendation.recommendedAt)})`
                      : ""}.
                  </>
                )}
              </div>
            ) : null}
            {!compactView && editor.adminAnnotation?.notes?.trim() ? (
              <div
                className={`mt-3 ${
                  compactView
                    ? "rounded-[1.05rem] border border-zinc-100/70 bg-zinc-50/52 px-3 py-3"
                    : "rounded-xl border border-[#FFDEE9] bg-[#FFF6F9] px-3 py-2 text-xs text-slate-700 sm:text-sm"
                }`}
              >
                {compactView ? (
                  <>
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] bg-rose-50 text-rose-500 ring-1 ring-rose-100/90">
                        <Check size={14} />
                      </span>
                      <p className="dashboard-type-section-title text-zinc-950">Feedback do admin</p>
                    </div>
                    <p className="dashboard-type-body mt-3 whitespace-pre-wrap leading-relaxed text-zinc-700">
                      {editor.adminAnnotation.notes}
                    </p>
                    {editor.adminAnnotation.updatedAt ? (
                      <p className="dashboard-type-meta mt-2 text-zinc-400">
                        {editor.adminAnnotation.updatedByName || "Admin"} · {formatDate(editor.adminAnnotation.updatedAt)}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-slate-800">Feedback do admin</p>
                    <p className="mt-1 whitespace-pre-wrap text-slate-700">{editor.adminAnnotation.notes}</p>
                    {editor.adminAnnotation.updatedAt ? (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {editor.adminAnnotation.updatedByName || "Admin"} · {formatDate(editor.adminAnnotation.updatedAt)}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
            {!compactView && editor.inlineAnnotations.length > 0 ? (
              <div
                className={`mt-3 rounded-xl border border-zinc-100/90 px-3 ${
                  compactView ? "rounded-[1.05rem] bg-zinc-50/52 py-3" : "bg-zinc-50/76 py-3"
                }`}
              >
                <div className={`mb-2 flex items-center justify-between gap-2 ${compactView ? "mb-3" : ""}`}>
                  {compactView ? (
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] bg-sky-50 text-sky-600 ring-1 ring-sky-100/90">
                        <span className="text-[11px] font-semibold">{editor.inlineAnnotations.length}</span>
                      </span>
                      <div>
                        <p className="dashboard-type-section-title text-zinc-950">Revisões no texto</p>
                        <p className="dashboard-type-meta mt-1 text-zinc-500">
                          Comentários e observações para ajustar o roteiro.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Revisões no texto ({editor.inlineAnnotations.length})
                    </p>
                  )}
                  {activeInlineAnnotationId ? (
                    <button
                      type="button"
                      onClick={() => setActiveInlineAnnotationId(null)}
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-700"
                    >
                      Limpar foco
                    </button>
                  ) : null}
                </div>
                <div className="space-y-2">
                  {(compactView ? editor.inlineAnnotations.slice(0, 1) : editor.inlineAnnotations).map((ann) => {
                    const isActive = ann.id === activeInlineAnnotationId;
                    return (
                      <div
                        key={ann.id}
                        className={`rounded-xl border px-3 py-2.5 transition ${
                          ann.isOrphaned
                            ? "border-slate-200 bg-white opacity-70"
                          : isActive
                              ? "border-amber-300 bg-amber-50"
                              : compactView
                                ? "border-zinc-100/90 bg-white"
                                : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={`text-[11px] font-semibold ${compactView ? "text-zinc-700" : "text-slate-700"}`}>
                              {ann.authorName}
                              {ann.resolved ? " · Resolvida" : ann.isOrphaned ? " · Trecho não encontrado" : ""}
                            </p>
                            <p className={`mt-1 line-clamp-2 border-l-2 pl-2 text-[11px] italic ${compactView ? "border-zinc-200 text-zinc-400" : "border-slate-200 text-slate-500"}`}>
                              &quot;{ann.quote}&quot;
                            </p>
                            <p className={`${compactView ? "dashboard-type-body mt-1.5 line-clamp-2 text-zinc-700" : "mt-1 text-sm text-slate-800"}`}>{ann.comment}</p>
                          </div>
                          {!ann.isOrphaned ? (
                            <div className="flex shrink-0 flex-col items-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setActiveInlineAnnotationId(ann.id)}
                                className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                              >
                                Ver no texto
                              </button>
                              {isAdminViewer && !ann.resolved ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextAnnotations = editor.inlineAnnotations.map((a) =>
                                      a.id === ann.id ? { ...a, resolved: true } : a
                                    );
                                    patchEditor({ inlineAnnotations: nextAnnotations, saved: false });
                                  }}
                                  className="rounded-lg bg-slate-200 px-2 py-1 text-[10px] font-bold uppercase text-slate-600 hover:bg-slate-300"
                                >
                                  Resolver
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {compactView && editor.inlineAnnotations.length > 1 ? (
                  <p className="mt-2 text-[11px] font-medium text-slate-500">
                    +{editor.inlineAnnotations.length - 1} revisão(ões) adicionais
                  </p>
                ) : null}
              </div>
            ) : null}
            <div
              className={`relative ${
                compactView
                  ? "mt-2.5 min-h-0 flex-1 overflow-hidden rounded-[1.15rem] border border-zinc-100/90 bg-zinc-50/36 px-3"
                  : "min-h-0 flex-1"
              }`}
            >
              <InlineScriptEditor
                content={editor.content}
                onChangeContent={handleContentChange}
                annotations={editor.inlineAnnotations}
                onAnnotationsChange={(newAnnotations) => patchEditor({ inlineAnnotations: newAnnotations, saved: false })}
                activeAnnotationId={activeInlineAnnotationId}
                onAnnotationFocus={setActiveInlineAnnotationId}
                onKeyDown={handleDraftKeyDown}
                isAdminViewer={isAdminViewer}
                viewerName={viewer?.name || "Admin"}
                placeholder="Escreva seu roteiro aqui..."
                compactView={compactView}
              />
            </div>

            {isAdminViewer ? (
              <div className={`shrink-0 border-t border-slate-100 ${compactView ? "py-2" : "py-4"}`}>
                {compactView ? (
                  <div className="rounded-[1.05rem] border border-zinc-100/70 bg-zinc-50/52 px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] bg-zinc-50 text-zinc-500 ring-1 ring-zinc-100/90">
                        <Check size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="dashboard-type-section-title text-zinc-950">Feedback para creator</p>
                        {editor.adminAnnotation?.updatedAt ? (
                          <p className="dashboard-type-meta mt-1 text-zinc-400">
                            {editor.adminAnnotation.updatedByName || "Admin"} · {formatDate(editor.adminAnnotation.updatedAt)}
                          </p>
                        ) : null}
                      </div>
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
                      className="mt-2.5 h-14 w-full resize-none rounded-[0.95rem] border border-zinc-100/90 bg-white px-3 py-2 text-sm text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-zinc-200 focus:bg-white"
                    />
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            ) : null}

            <div className={`shrink-0 border-t border-slate-100 ${compactView ? "py-2" : "py-4"}`}>
              <div className={compactView ? "rounded-[1.05rem] border border-zinc-100/70 bg-zinc-50/52 px-3 py-2.5" : "rounded-xl border border-slate-200 bg-slate-50/70 p-3"}>
                <label className={`flex cursor-pointer items-center gap-2 font-semibold ${compactView ? "text-[13px] text-zinc-800" : "text-sm text-slate-800"}`}>
                  <input
                    type="checkbox"
                    checked={editor.isPosted}
                    onChange={(event) => {
                      if (!isAuthenticated) {
                        void requestGoogleLogin();
                        return;
                      }
                      if (!canInteract) {
                        openPaywall("planning", { source: "scripts_link_posted_checkbox" });
                        return;
                      }
                      if (!ensureInstagramConnectedForLinking("scripts_link_posted_checkbox")) {
                        return;
                      }
                      const checked = event.target.checked;
                      patchEditor({
                        isPosted: checked,
                        postedContentId: checked ? editor.postedContentId || "" : "",
                        publication: checked ? editor.publication : null,
                        saved: false,
                        error: null,
                      });
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                  />
                  Marcar como roteiro postado
                  {!canInteract ? <Lock className="ml-1.5 h-3 w-3 text-amber-500" /> : null}
                </label>
                <p className={`mt-1 ${compactView ? "text-[11px] leading-5 text-zinc-500" : "text-xs text-slate-500"}`}>
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
                      className={`w-full border bg-white px-3 py-2 text-sm outline-none transition disabled:cursor-not-allowed ${compactView ? "rounded-[0.95rem] border-zinc-200 text-zinc-700 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100 disabled:bg-zinc-100" : "rounded-lg border-slate-200 text-slate-700 focus:border-slate-300 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100"}`}
                    >
                      {contentOptionsLoading ? (
                        <option value="">Carregando conteúdos...</option>
                      ) : (
                        <option value="">
                          {contentOptions.length === 0
                            ? "Nenhum conteúdo disponível"
                            : "Selecione o conteúdo publicado"}
                        </option>
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
                      <div className={`px-3 py-2 ${compactView ? "rounded-[0.95rem] border border-emerald-200 bg-emerald-50 text-[11px] leading-5 text-emerald-900" : "rounded-lg border border-emerald-200 bg-emerald-50 text-xs text-emerald-900"}`}>
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

            <div className={`shrink-0 border-t border-zinc-100/90 ${compactView ? "py-2" : "py-4"}`}>
              <div 
                className={!canInteract ? "cursor-pointer group relative" : ""}
                onClick={() => {
                  if (!isAuthenticated) {
                    void requestGoogleLogin();
                    return;
                  }
                  if (!canInteract) {
                    openPaywall("planning", { source: "scripts_ai_assistant_click" });
                  }
                }}
              >
                {!canInteract && (
                  <div className="absolute inset-0 z-10 flex items-center justify-end pr-4 pointer-events-none">
                    <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-600 ring-1 ring-amber-200/50">
                      <Lock size={10} />
                      PRO
                    </div>
                  </div>
                )}
                <div className={!canInteract ? "opacity-60 grayscale-[0.5] pointer-events-none" : ""}>
                  {compactView ? (
                    <div className="rounded-[1.05rem] border border-zinc-100/70 bg-zinc-50/52 px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100/90">
                          <Sparkles size={14} />
                        </span>
                        <div className="min-w-0">
                          <p className="dashboard-type-section-title text-zinc-950">Assistente IA</p>
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center gap-2 rounded-[0.95rem] border border-zinc-100/90 bg-white p-2">
                        <input
                          type="text"
                          value={editor.aiPrompt}
                          onChange={(e) => patchEditor({ aiPrompt: e.target.value })}
                          onKeyDown={handleAiPromptKeyDown}
                          placeholder="Peça um ajuste no roteiro..."
                          className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2 text-sm text-zinc-800 outline-none ring-0 ring-transparent placeholder:text-zinc-400 focus:border-transparent focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0"
                        />
                        <button
                          type="button"
                          onClick={handleAiAdjust}
                          disabled={editor.adjusting}
                          className="inline-flex shrink-0 items-center justify-center gap-1 rounded-xl bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
                        >
                          <Sparkles size={14} />
                          {editor.adjusting ? "Processando..." : "Enviar"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mb-2 text-xs font-medium text-slate-500">Assistente IA</p>
                      <div className="flex items-center gap-2 rounded-xl border border-zinc-100/90 bg-zinc-50/76 p-2">
                        <input
                          type="text"
                          value={editor.aiPrompt}
                          onChange={(e) => patchEditor({ aiPrompt: e.target.value })}
                          onKeyDown={handleAiPromptKeyDown}
                          placeholder="Peça um roteiro novo ou ajuste no roteiro atual..."
                          className="flex-1 border-0 bg-transparent px-2 py-2 text-sm text-zinc-800 outline-none ring-0 ring-transparent placeholder:text-zinc-400 focus:border-transparent focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0"
                        />
                        <button
                          type="button"
                          onClick={handleAiAdjust}
                          disabled={editor.adjusting}
                          className="inline-flex items-center justify-center gap-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
                        >
                          <Sparkles size={14} />
                          {editor.adjusting ? "Processando..." : "Enviar"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            {editor.error ? <p className="shrink-0 pb-4 text-sm text-rose-600">{editor.error}</p> : null}
          </div>
        </main>
      </div>
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
        ) : (
          <>
            <div className={compactView ? "flex flex-col gap-1.5" : "grid grid-cols-2 gap-3 sm:gap-5"}>
              <button
                type="button"
                onClick={openCreateEditor}
                className={`${compactView ? "group flex min-h-[96px] items-center justify-center overflow-hidden rounded-[1.05rem] border border-indigo-100/90 bg-indigo-50/90 px-4 py-5 text-left transition hover:border-indigo-200 hover:bg-indigo-100/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200" : "dashboard-panel group flex overflow-hidden text-left ring-1 ring-transparent transition flex-col h-72 rounded-[1.5rem] sm:h-80 sm:rounded-[2rem] hover:ring-pink-200/70"}`}
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

              {scripts.map((script) => {
                const tone = getSourceCardTone(script.source);
                const hasAdminAnnotation = Boolean(script.adminAnnotation?.notes?.trim());
                const hasUnreadFeedback = unreadFeedbackScriptIds.has(script.id);
                const isFromCalendar = isScriptFromCalendar(script);
                const calendarOriginSummary = isFromCalendar
                  ? getCalendarOriginSummary(script.plannerRef)
                  : null;
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
                return (
                  <div
                    key={script.id}
                    className={`${compactView ? `group relative flex flex-col overflow-visible rounded-[1.05rem] border border-zinc-100/80 bg-zinc-50/58 transition ${tone.compactCard}` : `dashboard-panel group relative flex flex-col overflow-visible text-left ring-1 ring-transparent transition ${tone.ring} h-72 rounded-[1.5rem] sm:h-80 sm:rounded-[2rem] hover:ring-pink-200/60`}`}
                  >
                      {compactView ? (
                        <div className="grid min-h-0 w-full flex-1 grid-cols-[60px_minmax(0,1fr)] items-start gap-x-3.5 px-2.5 py-2.5 text-left">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!isAuthenticated) {
                                void requestGoogleLogin();
                                return;
                              }
                              if (!canInteract) {
                                openPremiumLinkingPaywall("scripts_card_link_post_btn");
                                return;
                              }
                              void handleCardPublicationAction(event, script);
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
                                    isPosted
                                      ? "bg-white text-emerald-700 ring-emerald-200"
                                      : tone.compactPlaceholderIcon
                                  }`}
                                >
                                  {isPosted ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
                                </span>
                              </div>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => openExistingEditor(script)}
                            className="min-w-0 self-stretch text-left"
                          >
                            <div className="flex min-h-[79px] flex-col justify-between gap-2">
                              <div className="space-y-1.5">
                                <div className="flex items-start justify-between gap-3">
                                  {hasAdminAnnotation || !script.publication?.isPosted ? (
                                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-[0.01em] ${hasAdminAnnotation
                                      ? hasUnreadFeedback
                                        ? "border-rose-200 bg-rose-50 text-rose-700"
                                        : "border-rose-100 bg-rose-50/70 text-rose-600"
                                      : compactStatusClasses}`}>
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
                          onClick={() => openExistingEditor(script)}
                          className="flex min-h-0 w-full flex-1 flex-col text-left"
                        >
                          <div className={`border-b px-4 py-2.5 sm:rounded-t-[2rem] ${tone.header} rounded-t-[1.5rem]`}>
                            <div className="flex items-start justify-between gap-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] sm:text-[10px] border border-white/80 bg-white/72 ${tone.text}`}
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
                                void requestGoogleLogin();
                                return;
                              }
                              if (!canInteract) {
                                openPaywall("planning", { source: "scripts_card_link_btn" });
                                return;
                              }
                              void handleOpenCardLinkPanel(event, script);
                            }}
                            disabled={isCardLinking || campaignsLoading}
                            className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-[1rem] border px-2.5 py-2 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${compactView ? "w-full" : "flex-1"} ${
                              compactView
                                ? linkingSummary.isLinked
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  : tone.compactLinkButton
                                :
                              linkingSummary.isLinked
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
                                void requestGoogleLogin();
                                return;
                              }
                              if (!canInteract) {
                                openPremiumLinkingPaywall("scripts_card_link_post_btn");
                                return;
                              }
                              void handleCardPublicationAction(event, script);
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
                      <div
                        ref={cardLinkPopoverRef}
                        className="absolute inset-x-2 bottom-[4.9rem] z-20 rounded-[1.2rem] border border-zinc-100/90 bg-white/90 p-3 shadow-[0_16px_34px_rgba(15,23,42,0.08)] backdrop-blur-xl"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {linkingSummary.isLinked ? "Gerenciar vínculo" : "Vincular roteiro"}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Conecte este roteiro a uma campanha para acompanhar status e contexto.
                        </p>
                        {linkingSummary.isLinked ? (
                          <div className="mt-2 rounded-md border border-emerald-100 bg-emerald-50 p-2">
                            <p className="text-[11px] font-semibold text-emerald-700">
                              {linkingSummary.totalLinks > 1
                                ? `${linkingSummary.totalLinks} campanhas vinculadas`
                                : "Campanha vinculada"}
                            </p>
                            {linkedCampaigns.slice(0, 2).map((campaign) => (
                              <p key={campaign.linkId} className="line-clamp-1 text-[11px] text-emerald-800">
                                {campaign.campaignTitle} · {campaign.brandName}
                              </p>
                            ))}
                          </div>
                        ) : null}
                        <select
                          value={selectedCardCampaignId}
                          onChange={(event) =>
                            setCardCampaignByScriptId((prev) => ({
                              ...prev,
                              [script.id]: event.target.value,
                            }))
                          }
                          disabled={campaignsLoading || isCardLinking || campaignOptions.length === 0}
                          className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
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
                        {cardLinkError ? (
                          <p className="mt-2 text-[11px] font-medium text-rose-600">{cardLinkError}</p>
                        ) : null}
                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (isCardLinking) return;
                              setActiveCardLinkScriptId(null);
                            }}
                            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            disabled={isCardLinking}
                          >
                            Fechar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (isSelectedCampaignAlreadyLinked) {
                                void handleCardUnlinkConfirm(script);
                                return;
                              }
                              void handleCardLinkConfirm(script);
                            }}
                            disabled={
                              isCardLinking ||
                              campaignsLoading ||
                              !selectedCardCampaignId
                            }
                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${
                              isSelectedCampaignAlreadyLinked
                                ? "bg-rose-600 hover:bg-rose-700"
                                : "bg-slate-900 hover:bg-slate-800"
                            }`}
                          >
                            {isCardLinking
                              ? "Processando..."
                              : isSelectedCampaignAlreadyLinked
                                ? "Desvincular"
                                : linkingSummary.isLinked
                                  ? "Adicionar vínculo"
                                  : "Vincular"}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {!compactView && quickPublishAnchorScriptId === script.id && !isPosted ? (
                      <div
                        ref={quickPublishPopoverRef}
                        className="absolute inset-x-2 bottom-[4.9rem] z-20 rounded-[1.2rem] border border-white/90 bg-white/92 p-3 shadow-[0_26px_54px_rgba(15,23,42,0.16)] backdrop-blur-xl"
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

            {compactView && quickPublishTargetScript ? (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(244,244,245,0.68)] px-3 py-3 backdrop-blur-[2px]">
                <div
                  ref={quickPublishPopoverRef}
                  className="flex max-h-[min(620px,calc(100vh-4rem))] w-full max-w-[390px] min-h-0 flex-col overflow-hidden rounded-[1.35rem] border border-zinc-100/90 bg-white shadow-[0_28px_64px_rgba(15,23,42,0.16)]"
                >
                  <div className="shrink-0 border-b border-zinc-100/90 px-3.5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="dashboard-type-section-title text-zinc-950">Conteúdo publicado</p>
                        <p className="dashboard-type-meta mt-1 text-zinc-500">
                          Escolha o post para vincular ao roteiro.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (quickPublishSaving) return;
                          setQuickPublishAnchorScriptId(null);
                          setQuickPublishContentId("");
                          setQuickPublishQuery("");
                        }}
                        className="dashboard-type-control inline-flex shrink-0 items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-zinc-600 hover:bg-zinc-50"
                        disabled={quickPublishSaving}
                      >
                        Fechar
                      </button>
                    </div>

                    <input
                      type="text"
                      value={quickPublishQuery}
                      onChange={(event) => setQuickPublishQuery(event.target.value)}
                      placeholder="Buscar legenda ou tipo..."
                      disabled={quickPublishSaving}
                      className="mt-3 w-full rounded-[0.95rem] border border-zinc-200 bg-white px-3 py-2.5 text-xs text-zinc-700 outline-none focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100 disabled:bg-zinc-100"
                    />
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
                    <div className="space-y-1.5 rounded-[1rem] border border-zinc-100/90 bg-zinc-50/56 p-1.5">
                      {contentOptionsLoading ? (
                        <p className="px-2 py-2 text-xs text-zinc-500">Carregando conteúdos...</p>
                      ) : filteredQuickPublishOptions.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-zinc-500">Nenhum conteúdo encontrado.</p>
                      ) : (
                        filteredQuickPublishOptions.slice(0, 20).map((option) => {
                          const selected = quickPublishContentId === option.id;
                          return (
                            <button
                              type="button"
                              key={option.id}
                              onClick={() => setQuickPublishContentId(option.id)}
                              disabled={quickPublishSaving}
                              className={`w-full rounded-[0.9rem] border bg-white px-2.5 py-2.5 text-left text-xs transition ${
                                selected
                                  ? "border-emerald-200 ring-2 ring-emerald-100"
                                  : "border-zinc-100 hover:border-zinc-200"
                              }`}
                            >
                              <p className="line-clamp-2 font-semibold leading-snug text-zinc-800">{option.caption}</p>
                              <p className="mt-1 text-[11px] text-zinc-500">
                                {option.postDate ? formatDateCompact(option.postDate) : "Sem data"} · Eng{" "}
                                {typeof option.engagement === "number" ? option.engagement.toFixed(2) : "-"} · Interações{" "}
                                {formatNumber(option.totalInteractions)}
                              </p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 border-t border-zinc-100/90 bg-white px-3.5 py-3">
                    <p className="dashboard-type-meta line-clamp-1 text-zinc-400">
                      Atualizado em {formatDate(quickPublishTargetScript.updatedAt)}
                    </p>
                    {selectedQuickPublishOption ? (
                      <p className="dashboard-type-meta mt-1 line-clamp-1 text-emerald-700">
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
                        className="rounded-[0.9rem] border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
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
                        className="inline-flex items-center gap-1 rounded-[0.9rem] bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                      >
                        <Check size={12} />
                        {quickPublishSaving ? "Salvando..." : "Marcar"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {hasMore ? (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => fetchScripts({ cursor: nextCursor })}
                  className="dashboard-secondary-button px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
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
