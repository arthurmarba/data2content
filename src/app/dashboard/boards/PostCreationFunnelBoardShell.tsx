"use client";

import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BadgeHelp,
  BookOpen,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  GraduationCap,
  Layout,
  Lightbulb,
  MessageSquare,
  PenTool,
  Plus,
  Sparkles,
  Target,
  Share2,
  Trophy,
  Users,
  TrendingUp,
  Wand2,
  Video,
  Zap,
  Calendar,
  Hash,
  ArrowRight,
  Link as LinkIcon,
  Trash2,
} from "lucide-react";


import { useSidebarViewport } from "../components/sidebar/hooks";
import { PREVIEW_SCRIPTS } from "../scripts/MyScriptsPreviewData";
import { PREVIEW_PLANNER_SLOTS } from "../planning/mockPlannerData";
import { usePlannerData, type PlannerUISlot } from "@/hooks/usePlannerData";
import { useToast } from "@/app/components/ui/ToastA11yProvider";
import { getCategoryByValue, type CategoryType } from "@/app/lib/classification";
import { track } from "@/lib/track";
import type { PlannerEvidencePost } from "@/types/planner";
import { PAYWALL_URL_PARAM } from "@/types/paywall";

import type { PostCreationFunnelStage } from "./postCreationFunnel";
import {
  POST_CREATION_DECISION_STEP_ORDER,
  POST_CREATION_FUNNEL_STAGE_ORDER,
  createEmptyPostCreationFunnelState,
  isDecisionStepComplete,
  areVisibleDecisionStepsComplete,
  reconcilePostCreationPathState,
  resolveActiveDecisionStep,
  resolveNextFunnelStage,
  type PostCreationDecisionState,
  type PostCreationDecisionStep,
  type PostCreationBlueprintScriptStatus,
  type PostCreationFunnelState,
  type PostCreationIdeaVariant,
} from "./postCreationFunnel";
import {
  buildPostCreationDecisionEngine,
  estimatePlannerSlotInteractions,
  type PostCreationIdeaCandidate,
  type PostCreationOutcomeSignal,
  type PostCreationPreferenceSignals,
} from "./postCreationDecisionEngine";
import { buildBlueprintFromPlannerSlot } from "./postCreationBlueprintBuilder";
import {
  adjustBlueprint,
  type PostCreationBlueprintAdjustment,
} from "./postCreationBlueprintAdjuster";
import BrandNarrativeMatchesPanel from "./components/BrandNarrativeMatchesPanel";

const MyScriptsPage = dynamic(() => import("@/app/dashboard/scripts/MyScriptsPage"), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[360px] w-full animate-pulse rounded-[1.4rem] border border-zinc-100/80 bg-zinc-50/70" />
  ),
});

const FunnelConfetti = dynamic(() => import("./FunnelConfetti"), {
  ssr: false,
  loading: () => null,
});

const FunnelPostLinkGallery = dynamic(() => import("./FunnelPostLinkGallery"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[24rem] max-h-[70vh] items-center justify-center rounded-[32px] border border-white/10 bg-[#0f172a]/95 text-sm font-medium text-white/50 shadow-2xl">
      Carregando galeria...
    </div>
  ),
});

const PostDetailModal = dynamic(() => import("@/app/admin/creator-dashboard/PostDetailModal"), {
  ssr: false,
  loading: () => null,
});

const PostCreationPreviewOverlay = dynamic(() => import("./PostCreationPreviewOverlay"), {
  ssr: false,
  loading: () => null,
});

const PATH_AUTONAV_DELAY_MS = 320;
const IDEA_AUTONAV_DELAY_MS = 340;
const FUNNEL_HISTORY_LOOKBACK_DAYS = 180;
const POST_CREATION_SAVED_FROM = "post_creation_funnel";
const POST_CREATION_LOCAL_CACHE_LIMIT = 12;
const POST_CREATION_PAUTA_REQUEST_VERSION = "pauta-ai-v7";
const POST_CREATION_COLLAB_REQUEST_VERSION = "collab-v5";
const BRAND_MATCHES_ENABLED =
  process.env.NEXT_PUBLIC_POST_CREATION_BRAND_MATCHES_ENABLED !== "0";
const POST_CREATION_DEBUG =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_POST_CREATION_DEBUG === "1";
const POST_CREATION_LOADING_MESSAGES = [
  "Analisando tendências de mercado...",
  "Estruturando ganchos e retenção...",
  "Refinando narrativa de alto impacto...",
  "Finalizando roteiro estratégico...",
  "Quase lá...",
] as const;

const alcances = [
  { min: 50000, label: "Viral" },
  { min: 10000, label: "Alto Impacto" },
  { min: 2000, label: "Muito Bom" },
  { min: 500, label: "Consistente" },
  { min: 0, label: "Estratégia nova" },
];

const DECISION_OPTION_BASE_CLASS =
  "w-full min-h-[56px] rounded-[16px] border px-4 py-3 text-left transition-all duration-200";
const FUNNEL_CANVAS_CLASS =
  "funnel-canvas flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] sm:rounded-[32px] border border-white/90 bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fc_100%)] text-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.98),0_24px_70px_rgba(15,23,42,0.06)]";
const FUNNEL_PANEL_CLASS =
  "dashboard-panel funnel-panel rounded-[24px] sm:rounded-[28px] px-0 py-0";
const FUNNEL_PANEL_SOFT_CLASS =
  "dashboard-panel-subtle funnel-panel-soft rounded-[20px] sm:rounded-[24px]";
const FUNNEL_PANEL_MUTED_CLASS =
  "funnel-panel-muted rounded-[18px] sm:rounded-[22px] border border-slate-200/70 bg-slate-50/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.96)]";
const FUNNEL_TOP_ACTION_CLASS =
  "funnel-top-action inline-flex h-9 sm:h-10 items-center gap-2 rounded-full border border-zinc-200/80 bg-white px-3.5 sm:px-4 text-[13px] sm:text-sm font-semibold text-zinc-700 shadow-[0_10px_20px_rgba(15,23,42,0.04)] transition duration-300 hover:border-zinc-300 hover:bg-white hover:text-zinc-950";
const FUNNEL_BADGE_CLASS =
  "funnel-badge rounded-full border border-zinc-200/80 bg-zinc-50/90 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-zinc-600";
const FUNNEL_STAGE_HEADER_CLASS =
  "rounded-[24px] sm:rounded-[28px] border border-white/90 bg-white/88 px-4 sm:px-5 py-3.5 sm:py-4 shadow-[0_18px_42px_rgba(15,23,42,0.05)] backdrop-blur-xl";
const FUNNEL_SPOTLIGHT_CLASS =
  "dashboard-dark-spotlight relative overflow-hidden rounded-[28px] sm:rounded-[32px] border border-white/10 px-5 sm:px-6 py-6 sm:py-7 shadow-[0_24px_54px_rgba(15,23,42,0.18)]";
const FUNNEL_DARK_CTA_CLASS =
  "funnel-dark-cta border-zinc-950/90 bg-zinc-950 text-white hover:bg-zinc-900 hover:text-white";
const FUNNEL_BUTTON_PRIMARY_CLASS =
  "group relative inline-flex h-14 sm:h-16 w-full items-center justify-center gap-3 overflow-hidden rounded-[18px] sm:rounded-[22px] border border-zinc-950/90 bg-zinc-950 px-4 sm:px-5 text-[13px] sm:text-sm font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-zinc-900 hover:shadow-[0_18px_36px_rgba(15,23,42,0.14)] disabled:cursor-default disabled:border-zinc-900 disabled:bg-zinc-950 disabled:text-white/72 disabled:opacity-75 disabled:hover:translate-y-0 disabled:hover:shadow-none";
const FUNNEL_BUTTON_SECONDARY_CLASS =
  "inline-flex h-14 sm:h-16 w-full items-center justify-center rounded-[18px] sm:rounded-[22px] border border-slate-200/80 bg-white/88 px-4 sm:px-5 text-[13px] sm:text-sm font-semibold text-zinc-700 transition duration-300 hover:border-slate-300 hover:bg-white hover:text-zinc-950";
const FUNNEL_INPUT_CLASS =
  "h-12 rounded-[16px] sm:rounded-[18px] border border-slate-200 bg-white px-4 text-sm text-zinc-950 outline-none transition duration-200 placeholder:text-zinc-400 focus:border-sky-300/60 focus:bg-white";
const FUNNEL_TEXTAREA_CLASS =
  "min-h-[320px] sm:min-h-[360px] rounded-[20px] sm:rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-zinc-950 outline-none transition duration-200 placeholder:text-zinc-400 focus:border-sky-300/60 focus:bg-white";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function buildBrandNarrativeKeywords(...values: Array<string | null | undefined>) {
  const stopWords = new Set([
    "para",
    "com",
    "uma",
    "que",
    "dos",
    "das",
    "por",
    "como",
    "esse",
    "essa",
    "este",
    "esta",
    "sobre",
  ]);

  return Array.from(
    new Set(
      values
        .flatMap((value) => (value || "").split(/[\s,.;:!?()[\]{}"']+/))
        .map((keyword) => keyword.trim())
        .filter((keyword) => keyword.length > 3 && !stopWords.has(keyword.toLowerCase()))
    )
  ).slice(0, 14);
}

function buildBrandNarrativeCategoryValues(
  type: Extract<CategoryType, "proposal" | "context" | "tone" | "format" | "reference"> | null,
  ...values: Array<string | string[] | null | undefined>
) {
  const normalizedValues = values.flatMap((value) => {
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
  });
  const withLabels = normalizedValues.flatMap((value) => {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (!type) return [trimmed];
    const label = formatCategoryLabel(trimmed, type);
    return label && label !== trimmed ? [trimmed, label] : [trimmed];
  });
  const uniqueValues = Array.from(new Set(withLabels.filter((value) => value.trim().length > 0)));
  return uniqueValues.length ? uniqueValues : undefined;
}

function writeBoundedCache<K, V>(cache: Map<K, V>, key: K, value: V, limit = POST_CREATION_LOCAL_CACHE_LIMIT) {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, value);
  while (cache.size > limit) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

function logPostCreationDebug(level: "info" | "warn", message: string, payload: Record<string, unknown>) {
  if (!POST_CREATION_DEBUG) return;
  console[level](message, payload);
}

function getPlannerSlotLibraryKey(slot: Pick<PlannerUISlot, "slotId" | "dayOfWeek" | "blockStartHour">) {
  return slot.slotId || `${slot.dayOfWeek}-${slot.blockStartHour}`;
}

function hasSavedPautaContent(slot: PlannerUISlot | null | undefined) {
  if (!slot) return false;
  return Boolean(
    slot.title?.trim() ||
      slot.scriptShort?.trim() ||
      slot.themeKeyword?.trim() ||
      slot.themes?.some((entry) => typeof entry === "string" && entry.trim())
  );
}

function mergeSavedPautaSlot(existing: PlannerUISlot | undefined, incoming: PlannerUISlot): PlannerUISlot {
  if (!existing) return incoming;
  return {
    ...existing,
    ...incoming,
    slotId: incoming.slotId || existing.slotId,
    title: incoming.title || existing.title,
    scriptShort: incoming.scriptShort || existing.scriptShort,
    themeKeyword: incoming.themeKeyword || existing.themeKeyword,
    themes: incoming.themes?.length ? incoming.themes : existing.themes,
    savedFrom: incoming.savedFrom || existing.savedFrom,
    isSaved: incoming.isSaved === true || existing.isSaved === true,
  };
}

type ViewerInfo = {
  id?: string | null;
  role?: string | null;
  name?: string | null;
  instagramConnected?: boolean | null;
  accountState?: "pre_signup" | "registered" | "merged" | null;
  postCreationTrial?: {
    startedAt?: string | null;
    analysisUsedAt?: string | null;
    pautaUsedAt?: string | null;
    firstDraftId?: string | null;
    instagramAccountId?: string | null;
    completedSignupAt?: string | null;
    subscribedAt?: string | null;
    source?: string | null;
  } | null;
};

type PostCreationFunnelBoardShellProps = {
  viewer?: ViewerInfo;
  canInteract?: boolean;
  viewerPending?: boolean;
  previewMode?: boolean;
  initialInstagramConnected?: boolean;
  isHighlighted?: boolean;
  initialFocusStage?: PostCreationFunnelStage;
  surfaceMode?: "nested" | "board";
  onActivatePreview?: (acceptedLegal?: boolean) => void;
  onRequestAccountGate?: (source?: string) => void;
  onRequestPaywall?: (source?: string) => void;
  activationPending?: boolean;
  activationError?: string | null;
};

type FunnelScriptSummaryItem = {
  id: string;
  title: string;
  source: string;
  plannerRef?: {
    slotId?: string;
  } | null;
  publication?: {
    isPosted?: boolean;
    content?: {
      id?: string;
      engagement?: number | null;
      totalInteractions?: number | null;
    } | null;
  } | null;
  linkingSummary?: {
    isLinked?: boolean;
    totalLinks?: number;
  } | null;
};

type BlueprintScriptDraftState = {
  title: string;
  content: string;
  prompt: string;
};

type PersistedPostCreationDraft = {
  id: string;
  titleSnapshot?: string | null;
  stage: PostCreationFunnelStage;
  state?: Record<string, unknown> | null;
  selectedSlotId?: string | null;
  selectedScriptId?: string | null;
  linkedContentId?: string | null;
};

type GeneratedPautaState = {
  status: "idle" | "loading" | "ready" | "error";
  requestKey: string | null;
  keyword: string | null;
  variants: Array<{ title: string; reason: string }>;
  captions: string[];
  source: "ai" | "fallback";
  error?: string | null;
};

type ThemeCaptionSignalsState = {
  status: "idle" | "loading" | "ready";
  requestKey: string | null;
  captions: string[];
};

type CollabCreatorSuggestion = {
  id: string;
  rank: number;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  followers?: number | null;
  mediaKitSlug?: string | null;
  avgInteractions?: number | null;
  avgReach?: number | null;
  avgShares?: number | null;
  avgSaves?: number | null;
  postCount?: number | null;
  matchedTheme?: boolean;
};

type CollabCreatorsState = {
  status: "idle" | "loading" | "ready";
  requestKey: string | null;
  items: CollabCreatorSuggestion[];
  contextLabel?: string | null;
};

type PostCreationBoardView = "create" | "saved";

function getDecisionStepValue(
  decision: PostCreationDecisionState,
  step: PostCreationDecisionStep
): string | null {
  if (step === "context") return decision.contextId;
  if (step === "proposal") return decision.proposalId;
  if (step === "format") return decision.formatId;
  if (step === "duration") return decision.durationId;
  if (step === "tone") return decision.toneId;
  if (step === "reference") return decision.referenceId;
  if (step === "intent") return decision.intentId;
  if (step === "narrative") return decision.narrativeId;
  if (step === "day") return decision.dayId;
  if (step === "hour") return decision.hourId;
  if (step === "theme") return decision.themeId;
  if (step === "pauta") return decision.pautaId;
  return null;
}

function setDecisionStepValue(
  decision: PostCreationDecisionState,
  step: PostCreationDecisionStep,
  value: string | null
): PostCreationDecisionState {
  return {
    ...decision,
    ...(step === "context" ? { contextId: value } : {}),
    ...(step === "proposal" ? { proposalId: value } : {}),
    ...(step === "format" ? { formatId: value } : {}),
    ...(step === "duration" ? { durationId: value } : {}),
    ...(step === "tone" ? { toneId: value } : {}),
    ...(step === "reference" ? { referenceId: value } : {}),
    ...(step === "intent" ? { intentId: value } : {}),
    ...(step === "narrative" ? { narrativeId: value } : {}),
    ...(step === "day" ? { dayId: value } : {}),
    ...(step === "hour" ? { hourId: value } : {}),
    ...(step === "theme" ? { themeId: value } : {}),
    ...(step === "pauta" ? { pautaId: value } : {}),
  };
}

function clearDecisionStepsAfter(
  decision: PostCreationDecisionState,
  step: PostCreationDecisionStep
): PostCreationDecisionState {
  const stepIndex = POST_CREATION_DECISION_STEP_ORDER.indexOf(step);
  if (stepIndex < 0) return decision;

  return POST_CREATION_DECISION_STEP_ORDER.slice(stepIndex + 1).reduce(
    (current, currentStep) => setDecisionStepValue(current, currentStep, null),
    decision
  );
}

function resolvePrevDecisionStep(
  step: PostCreationDecisionStep | null,
  visibleSteps: readonly PostCreationDecisionStep[]
): PostCreationDecisionStep | null {
  if (!step) return visibleSteps[visibleSteps.length - 1] || null;
  const stepIndex = visibleSteps.indexOf(step);
  if (stepIndex <= 0) return null;
  return visibleSteps[stepIndex - 1] || null;
}

function resolveFirstIncompleteDecisionStep(
  decision: PostCreationDecisionState,
  visibleSteps: readonly PostCreationDecisionStep[]
): PostCreationDecisionStep | null {
  return visibleSteps.find((step) => !isDecisionStepComplete(decision, step)) || null;
}

function resolvePrevFunnelStage(stage: PostCreationFunnelStage): PostCreationFunnelStage | null {
  const currentIndex = POST_CREATION_FUNNEL_STAGE_ORDER.indexOf(stage);
  if (currentIndex <= 0) return null;
  return POST_CREATION_FUNNEL_STAGE_ORDER[currentIndex - 1] ?? null;
}

function resolveBlueprintScriptStatusFromScript(
  script: FunnelScriptSummaryItem | null
): PostCreationBlueprintScriptStatus {
  if (!script) return "ready";
  if (script.publication?.isPosted) return "published";
  if (script.linkingSummary?.isLinked) return "linked";
  return "generated";
}

function getDecisionStepLabel(step: PostCreationDecisionStep | null) {
  if (step === "context") return "Contexto";
  if (step === "proposal") return "Proposta";
  if (step === "tone") return "Tom";
  if (step === "reference") return "Referência";
  if (step === "intent") return "Intenção";
  if (step === "format") return "Formato";
  if (step === "duration") return "Duração";
  if (step === "narrative") return "Narrativa";
  if (step === "day") return "Dia";
  if (step === "hour") return "Hora";
  if (step === "theme") return "Tema";
  if (step === "pauta") return "Pauta";
  return "Direção";
}

function truncateText(value: string, maxChars: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  const sliced = normalized.slice(0, maxChars).trimEnd();
  const lastSpace = sliced.lastIndexOf(" ");
  return `${(lastSpace > maxChars * 0.7 ? sliced.slice(0, lastSpace) : sliced).trimEnd()}...`;
}

function resolveFullDayLabel(value?: string | number | null) {
  const labels = [
    "domingo",
    "segunda feira",
    "terca feira",
    "quarta feira",
    "quinta feira",
    "sexta feira",
    "sabado",
  ];
  const displayLabels = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

  if (typeof value === "number" && Number.isFinite(value)) {
    const normalizedDay = value === 7 ? 0 : value;
    return displayLabels[normalizedDay] || "Dia";
  }

  if (typeof value === "string") {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && value.trim() !== "") {
      const normalizedDay = numericValue === 7 ? 0 : numericValue;
      return displayLabels[normalizedDay] || "Dia";
    }
  }

  const normalized = normalizeOptionToken(typeof value === "string" ? value : String(value || ""));
  if (!normalized) return "Dia";
  const index = labels.findIndex((label) => normalized.startsWith(label));
  if (index >= 0) return displayLabels[index] || "Dia";
  return typeof value === "string" && value.trim() ? value.trim() : "Dia";
}

function buildPautaOptionCopy(label: string, reason?: string | null) {
  const normalized = label.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return {
      title: "Pauta",
      subtitle: reason ? truncateText(reason, 96) : null,
    };
  }

  return {
    title: normalized,
    subtitle: reason ? truncateText(reason, 96) : null,
  };
}

function resolveIntentDescription(value?: string | null) {
  const normalized = normalizeOptionToken(value);
  if (!normalized) return null;
  if (normalized === "educar" || normalized === "teach") return "Ensina algo útil com clareza.";
  if (normalized === "converter" || normalized === "convert") return "Move o público para uma ação concreta.";
  if (normalized === "conectar" || normalized === "connect") return "Cria identificação e aproximação com o público.";
  if (normalized === "entreter" || normalized === "entertain") return "Prende a atenção pela leveza ou performance.";
  if (normalized === "engajar" || normalized === "engage") return "Estimula resposta, conversa ou participação.";
  if (normalized === "autoridade" || normalized === "build authority") return "Reforça domínio e credibilidade no tema.";
  return "Define a resposta que esse conteúdo precisa provocar.";
}

function resolveNarrativeDescription(value?: string | null) {
  const normalized = normalizeOptionToken(value);
  if (!normalized) return null;
  if (normalized.includes("tutorial")) return "Ensina por demonstração, lista ou passo a passo.";
  if (normalized.includes("story") || normalized.includes("storytelling")) {
    return "Conduz por tensão, contexto e resolução.";
  }
  if (normalized.includes("bastidor") || normalized.includes("behind")) {
    return "Mostra processo, making of ou prova de execução.";
  }
  if (normalized.includes("lista") || normalized.includes("list")) {
    return "Organiza a ideia em pontos rápidos e escaneáveis.";
  }
  if (normalized.includes("sketch") || normalized.includes("scene")) {
    return "Encena uma situação para segurar atenção logo no início.";
  }
  if (normalized.includes("camera") || normalized.includes("direct")) {
    return "Fala direta, simples e sem desvio na condução.";
  }
  return "Define como a mensagem será conduzida do começo ao fim.";
}

function resolveDurationDescription(value?: string | null) {
  const normalized = normalizeOptionToken(value);
  if (normalized.includes("15")) {
    if (normalized.includes("30")) return "Tempo curto para desenvolver sem perder ritmo.";
    return "Corte rápido e direto ao ponto.";
  }
  if (normalized.includes("30") && normalized.includes("60")) {
    return "Abre espaço para aprofundar sem alongar demais.";
  }
  if (normalized.includes("60")) return "Permite desenvolver com mais contexto e prova.";
  return "Ajusta o tempo ideal de retenção para esse formato.";
}

function resolveDecisionOptionDescription(
  step: PostCreationDecisionStep,
  optionId: string,
  label: string
) {
  const lookupValue = optionId || label;

  if (step === "context") {
    return getCategoryByValue(lookupValue, "context")?.description || null;
  }
  if (step === "proposal") {
    return getCategoryByValue(lookupValue, "proposal")?.description || null;
  }
  if (step === "format") {
    return getCategoryByValue(lookupValue, "format")?.description || null;
  }
  if (step === "tone") {
    return getCategoryByValue(lookupValue, "tone")?.description || null;
  }
  if (step === "reference") {
    return getCategoryByValue(lookupValue, "reference")?.description || null;
  }
  if (step === "intent") {
    return resolveIntentDescription(lookupValue);
  }
  if (step === "narrative") {
    return resolveNarrativeDescription(lookupValue);
  }
  if (step === "duration") {
    return resolveDurationDescription(lookupValue);
  }
  return null;
}

function buildReferenceOptionSubtitle(label: string, description?: string | null, reason?: string | null) {
  if (description) {
    const normalizedDescription = normalizeOptionToken(description);
    if (normalizedDescription.includes("referencia")) {
      return truncateText(description, 88);
    }
    return truncateText(`Usa ${label.toLowerCase()} como referência. ${description}`, 88);
  }
  return reason ? truncateText(reason, 88) : null;
}

function buildDecisionOptionCopy(params: {
  step: PostCreationDecisionStep;
  optionId: string;
  label: string;
  reason?: string | null;
}) {
  if (params.step === "pauta") {
    return buildPautaOptionCopy(params.label, params.reason);
  }

  const subtitle = resolveDecisionOptionDescription(params.step, params.optionId, params.label);
  const title = params.step === "day" ? resolveFullDayLabel(params.label || params.optionId) : params.label;
  if (params.step === "reference") {
    return {
      title,
      subtitle: buildReferenceOptionSubtitle(params.label, subtitle, params.reason),
    };
  }
  const fallbackSubtitle =
    params.step === "theme" && params.reason ? truncateText(params.reason, 88) : null;

  return {
    title,
    subtitle: subtitle ? truncateText(subtitle, 88) : fallbackSubtitle,
  };
}

function normalizeOptionToken(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizePautaTitleSignature(value?: string | null, themeKeyword?: string | null) {
  let text = (value || "").trim();
  
  // If the title starts with the theme keyword followed by a separator, strip it for comparison
  if (themeKeyword) {
    const themeEscaped = themeKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const prefixRegex = new RegExp(`^${themeEscaped}[:\\-\\s—]+`, "i");
    text = text.replace(prefixRegex, "");
  }

  return normalizeOptionToken(text)
    .replace(/\b(a|as|o|os|um|uma|de|do|da|dos|das|e|em|para|por|com|que)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function arePautaTitlesEquivalent(left?: string | null, right?: string | null, themeKeyword?: string | null) {
  const leftSignature = normalizePautaTitleSignature(left, themeKeyword);
  const rightSignature = normalizePautaTitleSignature(right, themeKeyword);
  if (!leftSignature || !rightSignature) return leftSignature === rightSignature;
  if (leftSignature === rightSignature) return true;

  const shorter = leftSignature.length <= rightSignature.length ? leftSignature : rightSignature;
  const longer = leftSignature.length > rightSignature.length ? leftSignature : rightSignature;
  
  // If one is exactly the same as the other after normalization
  if (shorter === longer) return true;

  // If one starts with the other and they are reasonably long, they are probably the same idea
  // Increased threshold to be less aggressive with deduping
  if (shorter.length >= 60 && longer.startsWith(shorter)) return true;

  const leftWords = new Set(leftSignature.split(" ").filter((word) => word.length >= 4));
  const rightWords = new Set(rightSignature.split(" ").filter((word) => word.length >= 4));
  
  // If we don't have enough words to compare, they must be identical to be equivalent
  if (leftWords.size < 4 || rightWords.size < 4) return leftSignature === rightSignature;

  const overlap = Array.from(leftWords).filter((word) => rightWords.has(word)).length;
  // Increased threshold to 0.95 to be even more conservative
  return overlap / Math.min(leftWords.size, rightWords.size) >= 0.95;
}

function dedupeGeneratedPautaVariants(
  variants: Array<{ title: string; reason: string }>,
  themeKeyword?: string | null,
  maxItems = 5
) {
  const deduped: Array<{ title: string; reason: string }> = [];

  for (const variant of variants) {
    const title = variant.title.replace(/\s+/g, " ").trim();
    if (!title) continue;
    if (deduped.some((existing) => arePautaTitlesEquivalent(existing.title, title, themeKeyword))) continue;
    deduped.push({
      title,
      reason: variant.reason.replace(/\s+/g, " ").trim(),
    });
    if (deduped.length >= maxItems) break;
  }

  return deduped;
}

const THEME_CAPTION_STOPWORDS = new Set([
  "conteudo",
  "conteudos",
  "video",
  "videos",
  "post",
  "posts",
  "reel",
  "reels",
  "story",
  "stories",
  "como",
  "para",
  "com",
  "sem",
  "sobre",
  "esse",
  "essa",
  "essas",
  "esses",
  "uma",
  "umas",
  "uns",
  "que",
  "mais",
  "menos",
  "muito",
  "muita",
  "muitas",
  "muitos",
]);

const THEME_CAPTION_NOISE_TOKENS = new Set([
  ...THEME_CAPTION_STOPWORDS,
  "repost",
  "via",
  "credito",
  "creditos",
  "publi",
  "publicidade",
  "parceria",
  "parcerias",
  "collab",
  "colab",
  "ad",
  "ads",
  "link",
  "bio",
  "instagram",
  "tiktok",
  "youtube",
  "threads",
  "comente",
  "comentem",
  "compartilha",
  "compartilhe",
  "salva",
  "salve",
  "segue",
  "seguir",
  "curte",
  "curtir",
]);

function sanitizeThemeCaptionText(value: string) {
  return value
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/www\.\S+/gi, " ")
    .replace(/@[\w._-]+/g, " ")
    .replace(/#([\p{L}\p{N}_-]+)/gu, (_match, token: string) => {
      const normalizedToken = normalizeOptionToken(token);
      if (!normalizedToken || THEME_CAPTION_NOISE_TOKENS.has(normalizedToken)) {
        return " ";
      }
      return ` ${token.replace(/[_-]+/g, " ")} `;
    })
    .replace(/\b(?:repost|via|cr[eé]ditos?|publi|publicidade)\b/gi, " ")
    .replace(/\s*[|•·]+\s*/g, ". ")
    .replace(/[\[\]{}()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractThemeCaptionWindow(segment: string, matchPhrase: string, themeLabel: string) {
  const words = segment.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || [];
  if (!words.length) return null;

  const normalizedWords = words.map((word) => normalizeOptionToken(word));
  const matchWords = matchPhrase.split(/\s+/).filter(Boolean);
  if (!matchWords.length) return null;

  let matchIndex = -1;
  for (let index = 0; index <= normalizedWords.length - matchWords.length; index += 1) {
    if (matchWords.every((word, offset) => normalizedWords[index + offset] === word)) {
      matchIndex = index;
      break;
    }
  }

  if (matchIndex === -1) return null;

  const windowStart = Math.max(0, matchIndex - 2);
  const windowEnd = Math.min(words.length, matchIndex + matchWords.length + 2);
  const clue = words.slice(windowStart, windowEnd).join(" ").trim();
  if (!clue) return null;

  return normalizeOptionToken(clue) === normalizeOptionToken(themeLabel) ? themeLabel : truncateText(clue, 40);
}

function buildThemeCaptionClue(themeLabel: string, captions: string[]) {
  if (!captions.length) return null;

  const normalizedThemeLabel = normalizeOptionToken(themeLabel);
  const themeTokens = normalizedThemeLabel
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !THEME_CAPTION_STOPWORDS.has(token));
  const searchablePhrases = Array.from(new Set([normalizedThemeLabel, ...themeTokens].filter(Boolean))).sort(
    (left, right) => right.length - left.length
  );

  if (!searchablePhrases.length) return null;

  const matchedSnippets = Array.from(
    new Set(
      captions
        .map((caption) => sanitizeThemeCaptionText(caption || ""))
        .filter(Boolean)
        .flatMap((caption) => {
          const segments = caption
            .split(/[.!?;:\n]+/)
            .map((segment) => segment.trim())
            .filter(Boolean);

          for (const segment of segments) {
            const normalizedSegment = normalizeOptionToken(segment);
            if (!normalizedSegment) continue;

            const matchedPhrase = searchablePhrases.find((phrase) => normalizedSegment.includes(phrase));
            if (!matchedPhrase) continue;

            const clue = extractThemeCaptionWindow(segment, matchedPhrase, themeLabel) || truncateText(segment, 40);
            return clue ? [clue] : [];
          }

          return [];
        })
    )
  ).slice(0, 2);

  const usesWordingForWords = matchedSnippets.every((snippet) => snippet.split(/\s+/).length <= 2);

  if (matchedSnippets.length >= 2) {
    return usesWordingForWords
      ? `Palavras nas legendas: "${matchedSnippets[0]}" e "${matchedSnippets[1]}".`
      : `Trechos nas legendas: "${matchedSnippets[0]}" e "${matchedSnippets[1]}".`;
  }
  if (matchedSnippets.length === 1) {
    return usesWordingForWords
      ? `Palavra na legenda: "${matchedSnippets[0]}".`
      : `Trecho na legenda: "${matchedSnippets[0]}".`;
  }

  return null;
}

function formatCompactDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCompactNumber(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

function formatK(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatProjectedMetricValue(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "—";
  return formatK(Math.round(value));
}

function getInitials(value?: string | null) {
  const parts = (value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "C";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function formatInteractionsCopy(value?: number | null) {
  const formatted = formatCompactNumber(value);
  return formatted ? `${formatted} interações em média` : "Média de interações indisponível";
}

function formatApproxInteractions(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "Média: indisponível";
  }

  return `Média: ~${new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.round(value))} interações`;
}

function resolvePerformanceTier(value: number | null | undefined, candidates: Array<number | null | undefined>) {
  if (typeof value !== "number") {
    return {
      label: "Estratégia nova",
      textClassName: "text-zinc-400",
      iconClassName: "text-zinc-500",
      dotOuterClassName: "bg-zinc-100 ring-zinc-200",
      dotInnerClassName: "bg-zinc-400",
    };
  }

  const alc = alcances.find((a) => value >= a.min);
  if (!alc || value <= 0) {
    return {
      label: "Estratégia nova",
      textClassName: "text-zinc-400",
      iconClassName: "text-zinc-500",
      dotOuterClassName: "bg-zinc-100 ring-zinc-200",
      dotInnerClassName: "bg-zinc-400",
    };
  }

  const validCandidates = candidates
    .filter((candidate): candidate is number => typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0)
    .sort((a, b) => a - b);

  if (!validCandidates.length) {
    return {
      label: "Sem base",
      textClassName: "text-zinc-400",
      iconClassName: "text-zinc-500",
      dotOuterClassName: "bg-zinc-100 ring-zinc-200",
      dotInnerClassName: "bg-zinc-400",
    };
  }

  const minVal = validCandidates[0] ?? value;
  const maxVal = validCandidates[validCandidates.length - 1] ?? value;
  
  if (typeof minVal !== 'number' || typeof maxVal !== 'number') {
    return {
      label: "Sem base",
      textClassName: "text-zinc-400",
      iconClassName: "text-zinc-500",
      dotOuterClassName: "bg-zinc-100 ring-zinc-200",
      dotInnerClassName: "bg-zinc-400",
    };
  }

  const ratio = maxVal === minVal ? 0.7 : (value - minVal) / (maxVal - minVal);

  if (ratio >= 0.85) {
    return {
      label: "Destaque",
      textClassName: "text-emerald-500",
      iconClassName: "text-emerald-500",
      dotOuterClassName: "bg-emerald-50 ring-emerald-200",
      dotInnerClassName: "bg-emerald-500",
    };
  }

  if (ratio >= 0.58) {
    return {
      label: "Alto",
      textClassName: "text-green-500",
      iconClassName: "text-green-500",
      dotOuterClassName: "bg-green-50 ring-green-200",
      dotInnerClassName: "bg-green-500",
    };
  }

  if (ratio >= 0.3) {
    return {
      label: "Médio-Alto",
      textClassName: "text-amber-500",
      iconClassName: "text-amber-500",
      dotOuterClassName: "bg-amber-50 ring-amber-200",
      dotInnerClassName: "bg-amber-500",
    };
  }

  return {
    label: "Médio",
    textClassName: "text-amber-500",
    iconClassName: "text-amber-500",
    dotOuterClassName: "bg-amber-50 ring-amber-200",
    dotInnerClassName: "bg-amber-400",
  };
}

type DecisionOptionCardItem = {
  id: string;
  label: string;
  recommended: boolean;
  reason?: string | null;
  confidence?: number | null;
  sourceSignals?: string[];
  expectedInteractionsAvg?: number | null;
  evidencePosts?: PlannerEvidencePost[];
  evidenceCount?: number | null;
};

type DecisionPathCard = {
  id: PostCreationDecisionStep | string;
  label: string;
  value: string;
  reason: string;
  selectedId: string | null;
  options: DecisionOptionCardItem[];
};

type DecisionTrailItem = {
  id: string;
  label: string;
  emoji: string;
  state: "selected" | "pending";
};

type PerformanceTier = ReturnType<typeof resolvePerformanceTier>;

type AchievementBadgeItem = {
  label: string;
  detail: string;
  accent: string;
  border: string;
  text: string;
  icon: typeof Sparkles;
};

type SelectedConfigurationItem = {
  label: string;
  value: string;
  icon: typeof Sparkles;
};

function ScriptsStageSurfaceSkeleton() {
  return (
    <div className="flex h-full min-h-[360px] w-full animate-pulse flex-col gap-3 rounded-[24px] border border-zinc-100/80 bg-zinc-50/70 p-4 sm:rounded-[28px] sm:p-5">
      <div className="h-10 w-40 rounded-2xl bg-zinc-100" />
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`post-creation-scripts-skeleton-${index}`}
            className="rounded-[22px] border border-zinc-100/80 bg-white/80 p-4 shadow-[0_12px_24px_rgba(15,23,42,0.04)]"
          >
            <div className="h-4 w-2/3 rounded bg-zinc-100" />
            <div className="mt-4 h-3 w-full rounded bg-zinc-100/80" />
            <div className="mt-2 h-3 w-5/6 rounded bg-zinc-100/70" />
            <div className="mt-2 h-3 w-3/4 rounded bg-zinc-100/60" />
            <div className="mt-6 h-10 rounded-2xl bg-zinc-100/90" />
          </div>
        ))}
      </div>
    </div>
  );
}

function getTierPillClassName(label: string) {
  const normalized = normalizeOptionToken(label);
  if (normalized.includes("destaque")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (normalized.includes("alto")) {
    return "border-green-200 bg-green-50 text-green-700";
  }
  if (normalized.includes("medio")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-zinc-200 bg-zinc-50 text-zinc-600";
}

function getEvidenceTotal(option: Pick<DecisionOptionCardItem, "evidencePosts" | "evidenceCount">) {
  const postCount = option.evidencePosts?.length || 0;
  const explicitCount =
    typeof option.evidenceCount === "number" && Number.isFinite(option.evidenceCount)
      ? Math.max(0, Math.round(option.evidenceCount))
      : 0;
  return Math.max(postCount, explicitCount);
}

function mergeEvidencePostGroups(...groups: Array<PlannerEvidencePost[] | null | undefined>) {
  const merged: PlannerEvidencePost[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const post of group || []) {
      const key = post.id || post.postLink || post.coverUrl || post.title || "";
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(post);
      if (merged.length >= 12) return merged;
    }
  }
  return merged;
}

function isPostDetailId(id?: string | null) {
  return typeof id === "string" && /^[a-f0-9]{24}$/i.test(id.trim());
}

function getEvidenceCountFromReason(reason?: string | null) {
  if (!reason) return 0;
  const match = reason.match(/\bBase em\s+(\d+)\s+sinais?\b/i);
  if (!match?.[1]) return 0;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

const EvidenceThumbStrip = memo(function EvidenceThumbStrip({
  labelText = "refs suas",
  maxVisible = 3,
  posts,
  size = "sm",
  total,
}: {
  labelText?: string | null;
  maxVisible?: number;
  posts: PlannerEvidencePost[];
  size?: "sm" | "lg";
  total: number;
}) {
  const visiblePosts = posts
    .filter((post) => typeof post.coverUrl === "string" && post.coverUrl.trim().length > 0)
    .slice(0, maxVisible);
  const overflowCount = Math.max(0, total - visiblePosts.length);
  const isLarge = size === "lg";
  const thumbClassName = isLarge ? "h-12 w-12 rounded-[14px]" : "h-7 w-7 rounded-[9px]";
  const imageSizes = isLarge ? "48px" : "28px";
  const iconClassName = isLarge ? "h-5 w-5" : "h-3.5 w-3.5";

  if (!visiblePosts.length && total <= 0) return null;
  if (!visiblePosts.length) return null;

  return (
    <div
      className={cn("flex items-center", isLarge ? "gap-2" : "gap-1.5")}
      aria-label={`${total} ${total === 1 ? "conteúdo seu usado" : "conteúdos seus usados"} como referência`}
    >
      <div className={cn("flex", isLarge ? "-space-x-2.5" : "-space-x-1.5")}>
        {visiblePosts.map((post, index) => (
          <span
            key={`${post.id}-${index}`}
            className={cn(
              "relative flex shrink-0 overflow-hidden border border-white bg-zinc-100 shadow-[0_4px_10px_rgba(15,23,42,0.08)] ring-1 ring-zinc-200/80",
              thumbClassName
            )}
            title={post.title || "Conteúdo usado como referência"}
          >
            {post.coverUrl ? (
              <Image
                src={post.coverUrl}
                alt=""
                fill
                className="object-cover"
                sizes={imageSizes}
                priority
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-zinc-50 text-zinc-400">
                <Video className={iconClassName} />
              </span>
            )}
          </span>
        ))}
        {overflowCount > 0 ? (
          <span
            className={cn(
              "relative flex shrink-0 items-center justify-center border border-white bg-zinc-950 font-semibold text-white shadow-[0_4px_10px_rgba(15,23,42,0.08)] ring-1 ring-zinc-200/80",
              isLarge
                ? "h-12 min-w-12 rounded-[14px] px-2 text-[12px]"
                : "h-7 min-w-7 rounded-[9px] px-1.5 text-[10px]"
            )}
          >
            +{overflowCount}
          </span>
        ) : null}
      </div>
      {labelText ? (
        <span className="hidden text-[10px] font-medium text-zinc-400 min-[390px]:inline">
          {labelText}
        </span>
      ) : null}
    </div>
  );
});

const ProjectionReferenceSummary = memo(function ProjectionReferenceSummary({
  baseLabel,
  onOpen,
  posts,
  total,
}: {
  baseLabel: string;
  onOpen?: () => void;
  posts: PlannerEvidencePost[];
  total: number;
}) {
  if (total <= 0) {
    return <p className="text-[11px] leading-5 text-zinc-400">Base: {baseLabel}.</p>;
  }

  const suffix = total === 1 ? "post similar" : "posts similares";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-[17px] bg-sky-50/70 px-3.5 py-3 text-left transition duration-300 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60"
      aria-label={`Ver ${total} ${suffix} usados como base da projeção`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-1 text-[13px] font-semibold leading-5 text-zinc-950">
            Base: {total} {suffix}
          </p>
        </div>
        <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-sky-200/75 bg-white px-2.5 text-[10px] font-semibold text-sky-700 transition group-hover:border-sky-300 group-hover:text-sky-800">
          Ver referências
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-3 flex items-center">
        <EvidenceThumbStrip
          labelText={null}
          maxVisible={5}
          posts={posts}
          size="lg"
          total={total}
        />
      </div>
    </button>
  );
});

const ReferencePostsDrawer = memo(function ReferencePostsDrawer({
  isOpen,
  onClose,
  onOpenPost,
  origin,
  posts,
  total,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOpenPost: (post: PlannerEvidencePost) => void;
  origin: "actual" | "idea" | "branch" | "none";
  posts: PlannerEvidencePost[];
  total: number;
}) {
  if (!isOpen) return null;

  const sourceLabel =
    origin === "branch"
      ? "do caminho escolhido"
      : origin === "actual"
        ? "do post conectado"
        : "do seu histórico recente";

  return (
    <main className="flex-1 pb-4 sm:pb-20">
      <div className="flex flex-1 flex-col gap-4">
        <header className="rounded-[24px] border border-zinc-200/74 bg-white/82 px-4 py-4 shadow-[0_10px_26px_rgba(15,23,42,0.028)]">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:-translate-x-0.5 hover:bg-zinc-50 hover:text-zinc-950"
              aria-label="Voltar para pauta validada"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                Base da projeção
              </p>
              <h2 id="post-creation-reference-posts-title" className="mt-1 text-[1.42rem] font-semibold leading-tight tracking-[-0.045em] text-zinc-950">
                Posts similares
              </h2>
              <p className="mt-1 text-sm leading-5 text-zinc-500">
                {total} {total === 1 ? "post similar" : "posts similares"} {sourceLabel}.
              </p>
            </div>
          </div>
        </header>

        <div>
          {posts.length > 0 ? (
            <div className="grid gap-2.5">
              {posts.map((post, index) => {
                const canOpenDetails = isPostDetailId(post.id);
                const canOpenLink = Boolean(post.postLink);
                const title = post.title?.trim() || "Conteúdo usado como referência";
                return (
                  <article
                    key={`${post.id}-${index}`}
                    className={cn(
                      "group grid grid-cols-[5.75rem_minmax(0,1fr)] gap-3 overflow-hidden rounded-[20px] border border-zinc-100 bg-zinc-50/70 p-2.5 transition duration-300 sm:grid-cols-[6.5rem_minmax(0,1fr)]",
                      canOpenDetails || canOpenLink
                        ? "cursor-pointer hover:-translate-y-0.5 hover:border-zinc-200 hover:bg-white hover:shadow-[0_14px_30px_rgba(15,23,42,0.07)]"
                        : "cursor-default"
                    )}
                    role={canOpenDetails || canOpenLink ? "button" : undefined}
                    tabIndex={canOpenDetails || canOpenLink ? 0 : undefined}
                    onClick={canOpenDetails || canOpenLink ? () => onOpenPost(post) : undefined}
                    onKeyDown={
                      canOpenDetails || canOpenLink
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onOpenPost(post);
                            }
                      }
                        : undefined
                    }
                  >
                    <div className="relative aspect-[4/5] overflow-hidden rounded-[16px] border border-white bg-zinc-100">
                      {post.coverUrl ? (
                        <Image
                          src={post.coverUrl}
                          alt={title}
                          fill
                          className="object-cover transition duration-500 group-hover:scale-[1.03]"
                          sizes="(max-width: 640px) 100px, 120px"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-zinc-400">
                          Sem capa
                        </span>
                      )}
                      <span
                        className={cn(
                          "absolute left-2 top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[10px] font-semibold shadow-sm",
                          index === 0 ? "bg-zinc-950 text-white" : "bg-white/92 text-zinc-700"
                        )}
                      >
                        {index === 0 ? "Top" : `#${index + 1}`}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-col py-1 pr-1">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold leading-5 text-zinc-950">
                          {title}
                        </p>
                        <p className="mt-1.5 text-[10px] font-medium leading-4 text-zinc-400">
                          {index === 0 ? "Top referência" : "Referência do caminho"}
                        </p>
                      </div>
                      <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                        <div>
                          <p className="text-[1rem] font-semibold leading-none tracking-[-0.035em] text-zinc-950">
                            {typeof post.totalInteractions === "number" && post.totalInteractions > 0
                              ? formatK(post.totalInteractions)
                              : "N/D"}
                          </p>
                          <p className="mt-1 text-[10px] font-medium text-zinc-400">
                            interações
                          </p>
                        </div>
                        {canOpenDetails || canOpenLink ? (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition group-hover:border-zinc-300 group-hover:text-zinc-900">
                            {canOpenDetails ? <ArrowRight className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-zinc-200 bg-zinc-50 px-5 py-8 text-center">
              <Video className="mx-auto h-5 w-5 text-zinc-400" />
              <p className="mt-3 text-sm font-semibold text-zinc-900">
                Ainda não há prévias individuais para abrir.
              </p>
              <p className="mx-auto mt-2 max-w-[28rem] text-sm leading-6 text-zinc-500">
                A projeção tem {total} {total === 1 ? "sinal" : "sinais"} no caminho escolhido, mas as capas e links desses posts não vieram neste payload.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
});

const DecisionOptionCard = memo(function DecisionOptionCard({
  step,
  option,
  optionIndex,
  candidateExpectedInteractions,
  isAdvancing,
  fallbackRecommended = false,
  onSelect,
}: {
  step: PostCreationDecisionStep;
  option: DecisionOptionCardItem;
  optionIndex: number;
  candidateExpectedInteractions: Array<number | null | undefined>;
  isSelected: boolean;
  isAdvancing: boolean;
  fallbackRecommended?: boolean;
  onSelect: (optionId: string) => void;
}) {
  const optionCopy = buildDecisionOptionCopy({
    step,
    optionId: option.id,
    label: option.label,
    reason: option.reason,
  });
  const isPautaStep = step === "pauta";
  const optionEmoji = resolveDecisionOptionEmoji(step, option.label);
  const performanceTier = resolvePerformanceTier(option.expectedInteractionsAvg, candidateExpectedInteractions);
  const isRecommended = option.recommended || fallbackRecommended;
  const pautaEyebrow = isPautaStep
    ? isRecommended
      ? "Recomendação principal"
      : optionIndex === 1
        ? "Ângulo alternativo"
        : "Outra leitura"
    : null;
  const interactionsLabel =
    typeof option.expectedInteractionsAvg === "number" && option.expectedInteractionsAvg > 0
      ? `~${formatK(option.expectedInteractionsAvg)}`
      : "Sem base recente";
  const usesReasonAsDescription = !optionCopy.subtitle && Boolean(option.reason);
  const categoryDescription = optionCopy.subtitle
    ? truncateText(optionCopy.subtitle, isPautaStep ? 118 : 92)
    : option.reason
      ? truncateText(option.reason, isPautaStep ? 118 : 92)
      : null;
  const supportCopy =
    option.reason && !usesReasonAsDescription && option.reason !== optionCopy.subtitle
      ? truncateText(option.reason, isPautaStep ? 118 : 80)
      : null;
  const evidencePosts = option.evidencePosts || [];
  const evidenceTotal = Math.max(getEvidenceTotal(option), getEvidenceCountFromReason(option.reason));
  const tierPillClassName = getTierPillClassName(performanceTier.label);
  const advancingLabel = isAdvancing ? "Aplicando escolha" : null;
  const ariaLabel = [
    optionCopy.title,
    !isPautaStep ? `qualidade: ${performanceTier.label}` : null,
    !isPautaStep && typeof option.expectedInteractionsAvg === "number" && option.expectedInteractionsAvg > 0
      ? `${interactionsLabel} interações médias`
      : !isPautaStep
        ? interactionsLabel
        : null,
    categoryDescription ? `descrição: ${categoryDescription.replace(/[.!?]+$/, "")}` : null,
    !isPautaStep && evidenceTotal ? `${evidenceTotal} conteúdos seus usados como referência` : null,
    "toque para escolher e continuar",
  ]
    .filter(Boolean)
    .join(". ");

  if (isPautaStep) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => onSelect(option.id)}
        className={cn(
          "group relative w-full rounded-[20px] border px-4 py-3.5 text-left outline-none transition-all duration-300 ease-out active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white transform-gpu backface-hidden",
          isAdvancing
            ? "border-sky-200 bg-white ring-1 ring-sky-100/70 shadow-[0_14px_34px_rgba(56,189,248,0.08)]"
            : "border-zinc-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.025)] hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_16px_30px_rgba(15,23,42,0.06)]"
        )}
      >
        <div className="grid grid-cols-[1.7rem_minmax(0,1fr)_1.25rem] items-center gap-3">
          <span
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-semibold",
              isRecommended
                ? "border-sky-100 bg-sky-50 text-sky-700"
                : "border-zinc-100 bg-zinc-50 text-zinc-500"
            )}
          >
            {String(optionIndex + 1).padStart(2, "0")}
          </span>

          <div className="min-w-0">
            {advancingLabel ? (
              <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="inline-flex h-5 items-center rounded-full border border-sky-100 bg-white px-2 text-[10px] font-semibold text-sky-700">
                  {advancingLabel}
                </span>
              </div>
            ) : null}

            <h3
              className="line-clamp-2 text-[0.98rem] font-semibold leading-[1.18] tracking-[-0.02em] text-zinc-950"
              title={optionCopy.title}
            >
              {optionCopy.title}
            </h3>

            {categoryDescription ? (
              <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-zinc-500">
                {categoryDescription}
              </p>
            ) : null}
          </div>

          <ArrowRight className="h-3.5 w-3.5 shrink-0 justify-self-end text-zinc-300 transition duration-300 group-hover:translate-x-0.5 group-hover:text-zinc-600" />
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => onSelect(option.id)}
      className={cn(
        DECISION_OPTION_BASE_CLASS,
        "group relative flex flex-col overflow-hidden rounded-[22px] border px-4 py-3 text-left shadow-[0_8px_26px_rgba(15,23,42,0.025)] outline-none transition-all duration-300 ease-out active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white transform-gpu backface-hidden",
        isAdvancing
          ? "border-sky-200 bg-white ring-1 ring-sky-100/70 shadow-[0_14px_34px_rgba(56,189,248,0.08)]"
          : "border-zinc-200/80 bg-white hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-white hover:shadow-[0_18px_34px_rgba(15,23,42,0.07)]"
      )}
    >
      {isAdvancing ? (
        <span className="pointer-events-none absolute inset-y-4 left-0 w-1 rounded-r-full bg-sky-400/80" />
      ) : null}

      <div
        className={cn(
          "pointer-events-none absolute inset-0 transition duration-500",
          isAdvancing
            ? "bg-[linear-gradient(180deg,rgba(240,249,255,0.58)_0%,rgba(255,255,255,0.08)_100%)] opacity-100"
            : "bg-transparent opacity-0"
        )}
      />

      <div className="relative flex h-full flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {!isPautaStep ? (
              <span className={cn("inline-flex h-6 items-center rounded-full border px-2 text-[10px] font-semibold", tierPillClassName)}>
                {performanceTier.label}
              </span>
            ) : null}
            {isRecommended ? (
              <span className="inline-flex h-6 items-center rounded-full border border-sky-100 bg-sky-50 px-2 text-[10px] font-semibold text-sky-700">
                {isPautaStep ? "Principal" : "Sinal IA"}
              </span>
            ) : null}
            {advancingLabel ? (
              <span className="inline-flex h-6 items-center rounded-full border border-sky-100 bg-white px-2 text-[10px] font-semibold text-sky-700">
                {advancingLabel}
              </span>
            ) : null}
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300 transition duration-300 group-hover:translate-x-0.5 group-hover:text-zinc-600" />
        </div>

        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border transition-all duration-300",
              isAdvancing
                ? "border-sky-200 bg-white text-slate-950 shadow-sm"
                : "border-zinc-100 bg-zinc-50 text-zinc-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] group-hover:bg-white"
            )}
          >
            <span className="text-[0.95rem] leading-none" aria-hidden="true">
              {optionEmoji}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            {pautaEyebrow ? (
              <p className="mb-1 text-[11px] font-semibold text-zinc-400">
                {pautaEyebrow}
              </p>
            ) : null}

            <h3
              className={cn(
                "font-semibold tracking-[-0.025em] text-zinc-950",
                isPautaStep ? "line-clamp-2 text-[1rem] leading-[1.14]" : "line-clamp-1 text-[0.96rem] leading-[1.14]"
              )}
              title={optionCopy.title}
            >
              {optionCopy.title}
            </h3>

            {categoryDescription ? (
              <p className={cn("mt-1 text-[11px] leading-4 text-zinc-500", isPautaStep ? "line-clamp-2" : "line-clamp-1")}>
                {categoryDescription}
              </p>
            ) : null}
          </div>
        </div>

        {!isPautaStep ? (
        <div className="mt-auto border-t border-zinc-100/80 pt-2.5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-[1.14rem] font-semibold leading-none tracking-[-0.04em] text-zinc-950">
                {interactionsLabel}
              </p>
              <p className="text-[10px] font-medium text-zinc-400">
                {typeof option.expectedInteractionsAvg === "number" && option.expectedInteractionsAvg > 0
                  ? "interações médias"
                  : "sem base recente"}
              </p>
            </div>
            <EvidenceThumbStrip posts={evidencePosts} total={evidenceTotal} />
          </div>
          {!evidenceTotal && supportCopy ? (
            <p className="mt-2 line-clamp-1 text-[10px] font-medium text-zinc-400">
              {supportCopy}
            </p>
          ) : null}
        </div>
        ) : null}
      </div>
    </button>
  );
});

const DecisionTrail = memo(function DecisionTrail({
  items,
}: {
  items: DecisionTrailItem[];
}) {
  if (!items.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <div key={item.id} className="inline-flex max-w-full items-center">
          <div
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium leading-none shadow-[0_2px_4px_rgba(15,23,42,0.02)] transition duration-300 ease-out transform-gpu backface-hidden antialiased",
              item.state === "selected"
                ? "bg-zinc-100/72 text-zinc-600 ring-1 ring-zinc-200/20"
                : "border border-dashed border-zinc-200/80 bg-transparent text-zinc-400"
            )}
          >
            <span className="text-[0.9rem] leading-none" aria-hidden="true">
              {item.state === "selected" ? item.emoji : "+"}
            </span>
            <span className="truncate">{item.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
});

function DecisionTrailProgress({ progressValue }: { progressValue: number }) {
  return (
    <div className="w-full">
      <div className="h-1 overflow-hidden rounded-full bg-zinc-100/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#38bdf8] via-[#60a5fa] to-[#818cf8] shadow-[0_0_8px_rgba(56,189,248,0.4)] transition-[width] duration-500 ease-out transform-gpu backface-hidden"
          style={{ width: `${Math.max(progressValue * 100, 8)}%` }}
        />
      </div>
    </div>
  );
}

const FunnelAmbientBackdrop = memo(function FunnelAmbientBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(255,255,255,0.74)_0%,rgba(247,248,252,0)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(14,165,233,0.045)_0%,rgba(255,255,255,0)_34%,rgba(129,140,248,0.035)_100%)]" />
    </div>
  );
});

const SavingIdeaOverlay = memo(function SavingIdeaOverlay() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/62 px-6 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-[28px] border border-white/90 bg-white/94 px-6 py-6 text-center shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
        </div>
        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
          Salvando pauta
        </p>
        <h3 className="mt-3 text-[1.35rem] font-semibold tracking-[-0.04em] text-zinc-950">
          Guardando a estratégia na sua biblioteca.
        </h3>
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          Mantendo tema, categorias, formato e janela exatamente como você aprovou.
        </p>
      </div>
    </div>
  );
});

const DraftHydrationShell = memo(function DraftHydrationShell() {
  return (
    <div className="relative flex-1 overflow-y-auto px-5 pb-6 pt-4 sm:px-6 sm:pb-7" aria-busy="true" aria-live="polite">
      <div className="mx-auto flex w-full max-w-[34rem] flex-col gap-3.5">
        <div className={cn(FUNNEL_PANEL_SOFT_CLASS, "px-4 py-3.5")}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-zinc-100" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-2.5 w-28 animate-pulse rounded-full bg-zinc-100" />
              <div className="h-3 w-44 animate-pulse rounded-full bg-zinc-100" />
            </div>
          </div>
        </div>

        <main className="flex-1 pb-4">
          <div className="px-1">
            <div className="flex flex-1 flex-col gap-6 sm:gap-7">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-zinc-200" />
              </div>
              <div className="flex flex-col gap-4 sm:gap-5">
                <div className="space-y-2">
                  <div className="h-8 w-56 animate-pulse rounded-full bg-zinc-100" />
                  <div className="h-8 w-40 animate-pulse rounded-full bg-zinc-100" />
                </div>
                <p className="text-sm font-medium text-zinc-500">Restaurando sua última pauta…</p>
              </div>
            </div>
          </div>
          <div className="flex-1" />
          <div className="mt-8 grid gap-3 sm:mt-10">
            {[0, 1, 2].map((index) => (
              <div
                key={`post-creation-draft-hydration-${index}`}
                className="rounded-[24px] border border-zinc-200/80 bg-white px-5 py-4.5 shadow-[0_8px_30px_rgba(15,23,42,0.02)]"
              >
                <div className="flex gap-3">
                  <div className="h-10 w-10 shrink-0 animate-pulse rounded-[14px] bg-zinc-100" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-2/3 animate-pulse rounded-full bg-zinc-100" />
                    <div className="h-3 w-full animate-pulse rounded-full bg-zinc-100" />
                  </div>
                </div>
                <div className="mt-4 border-t border-zinc-100 pt-3">
                  <div className="h-3 w-40 animate-pulse rounded-full bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
});

const CompactStageHeader = memo(function CompactStageHeader({
  canGoPrev,
  onPrev,
  stepLabel,
  goalLabel,
  actionLabel,
  onAction,
}: {
  canGoPrev: boolean;
  onPrev: () => void;
  stepLabel: string;
  goalLabel: string;
  actionLabel: string | null;
  onAction: () => void;
}) {
  const shouldShowStepLabel = stepLabel.trim().length > 0 && stepLabel !== "Etapa atual";

  return (
    <header className="relative px-1 pt-1">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(247,248,252,0)_100%)] transform-gpu" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          {canGoPrev ? (
            <button
              type="button"
              onClick={onPrev}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white bg-white text-zinc-700 shadow-[0_8px_22px_rgba(15,23,42,0.04)] transition duration-300 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950 active:scale-95 transform-gpu backface-hidden antialiased"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : null}
          <div className="min-w-0 transform-gpu backface-hidden antialiased">
            {shouldShowStepLabel ? (
              <p className="text-[11px] font-semibold text-zinc-400">
                {stepLabel}
              </p>
            ) : null}
            <h2 className={cn("truncate text-[1.12rem] font-bold tracking-[-0.04em] text-zinc-950", shouldShowStepLabel && "mt-0.5")}>
              {goalLabel}
            </h2>
          </div>
        </div>

        {actionLabel ? (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-zinc-200/70 bg-white/70 px-3 text-[11px] font-semibold text-zinc-600 shadow-[0_6px_16px_rgba(15,23,42,0.03)] backdrop-blur-sm transition duration-300 hover:border-zinc-300 hover:bg-white hover:text-zinc-950 active:scale-95 transform-gpu backface-hidden antialiased"
          >
            <BookOpen className="h-3 w-3 opacity-55" />
            {actionLabel}
          </button>
        ) : null}
      </div>
    </header>
  );
});

const PathDecisionStage = memo(function PathDecisionStage({
  activeDecisionCard,
  activeDecisionExpectedInteractions,
  advancingPathId,
  decisionTrailItems,
  generatedPautasError,
  generatedPautasStatus,
  isFinalPautaDecision,
  progressValue,
  question,
  onSelect,
}: {
  activeDecisionCard: DecisionPathCard;
  activeDecisionExpectedInteractions: Array<number | null | undefined>;
  advancingPathId: string | null;
  decisionTrailItems: DecisionTrailItem[];
  generatedPautasError?: string | null;
  generatedPautasStatus: GeneratedPautaState["status"];
  isFinalPautaDecision: boolean;
  progressValue: number;
  question: string | null | undefined;
  onSelect: (optionId: string) => void;
}) {
  return (
    <main className="flex-1 pb-4">
      <div className="px-1">
        <div className="flex flex-1 flex-col gap-6 sm:gap-7">
          <DecisionTrailProgress progressValue={progressValue} />

          <div className="flex flex-col gap-4 sm:gap-5">
            <h1
              className={cn(
                "max-w-[13.75ch] text-balance font-semibold tracking-[-0.045em] text-zinc-950",
                isFinalPautaDecision
                  ? "text-[1.9rem] leading-[1.01] sm:max-w-[14ch] sm:text-[2.34rem]"
                  : "text-[1.92rem] leading-[1.01] sm:max-w-[14ch] sm:text-[2.42rem]"
              )}
            >
              {question || activeDecisionCard.label}
            </h1>

            <DecisionTrail items={decisionTrailItems} />
          </div>
        </div>
      </div>
      <div className="flex-1" />
      <div className={cn("grid gap-3", activeDecisionCard.id === "pauta" ? "mt-6" : "mt-6 sm:mt-8")}>
        {activeDecisionCard.id === "pauta" && generatedPautasStatus === "loading" ? (
          <div className={cn(FUNNEL_PANEL_SOFT_CLASS, "px-5 py-6 text-center text-sm text-zinc-500")}>
            Gerando pautas com IA a partir do tema e das categorias escolhidas...
          </div>
        ) : null}
        {activeDecisionCard.id === "pauta" && generatedPautasStatus === "error" ? (
          <div className={cn(FUNNEL_PANEL_SOFT_CLASS, "px-5 py-6 text-center text-sm text-red-600")}>
            {generatedPautasError || "Não foi possível gerar 5 pautas com IA para este recorte."}
          </div>
        ) : null}
        {activeDecisionCard.options.map((option, index) => {
          const isSelected = option.id === activeDecisionCard.selectedId;
          const isAdvancing = advancingPathId === `${activeDecisionCard.id}-${option.id}`;

          return (
            <DecisionOptionCard
              key={`${activeDecisionCard.id}-${option.id}`}
              step={activeDecisionCard.id as PostCreationDecisionStep}
              option={option}
              optionIndex={index}
              candidateExpectedInteractions={activeDecisionExpectedInteractions}
              isSelected={isSelected}
              isAdvancing={isAdvancing}
              fallbackRecommended={index === 0}
              onSelect={onSelect}
            />
          );
        })}
        <div className="flex-1" />
      </div>
    </main>
  );
});

const ProjectionSummaryCard = memo(function ProjectionSummaryCard({
  activeStage,
  interactions,
  onOpenReferencePosts,
  origin,
  reach,
  referencePosts,
  referenceTotal,
  saves,
  shares,
  supportCopy,
  tier,
  title,
}: {
  activeStage: PostCreationFunnelStage;
  interactions: number | null;
  onOpenReferencePosts: () => void;
  origin: "actual" | "idea" | "branch" | "none";
  reach: number | null;
  referencePosts: PlannerEvidencePost[];
  referenceTotal: number;
  saves: number | null;
  shares: number | null;
  supportCopy: string;
  tier: PerformanceTier;
  title?: string | null;
}) {
  const metrics = [
    { label: "Alcance", value: formatProjectedMetricValue(reach) },
    { label: "Salvos", value: formatProjectedMetricValue(saves) },
    { label: "Shares", value: formatProjectedMetricValue(shares) },
  ];
  const metricLabel =
    activeStage === "published" ? "interações registradas" : "interações estimadas";
  const baseLabel =
    activeStage === "published"
      ? "post conectado ao funil"
      : origin === "idea"
        ? "posts parecidos no seu histórico recente"
        : origin === "branch"
          ? "escolhas validadas até aqui"
          : "base recente limitada";

  return (
    <section className="relative w-full px-1 py-1 transform-gpu backface-hidden antialiased will-change-transform">
      <div className="relative">
        <h2 className="text-[1.48rem] font-semibold leading-[1.08] tracking-[-0.045em] text-zinc-950 sm:text-[1.7rem]">
          &ldquo;{title || "Pauta em destaque"}&rdquo;
        </h2>
      </div>

      <div className="relative mt-4">
        <div className="flex flex-col">
          <span className="text-[3.35rem] font-black leading-none tracking-[-0.065em] text-zinc-950 sm:text-[3.85rem]">
            {typeof interactions === "number" && interactions > 0 ? formatK(interactions) : "—"}
          </span>
          <span className="mt-0.5 text-[11px] font-semibold leading-4 text-zinc-500">{metricLabel}</span>
        </div>
        <div className="mt-3 grid w-full grid-cols-3 gap-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex flex-col justify-center">
              <p className="text-[1rem] font-semibold tracking-tight text-zinc-900">{metric.value}</p>
              <p className="mt-1 text-[10px] font-semibold text-zinc-400">{metric.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative mt-4">
        <ProjectionReferenceSummary
          baseLabel={baseLabel}
          onOpen={onOpenReferencePosts}
          posts={referencePosts}
          total={referenceTotal}
        />
      </div>
    </section>
  );
});

const CollabCreatorsCard = memo(function CollabCreatorsCard({
  contextLabel,
  items,
  status,
}: {
  contextLabel?: string | null;
  items: CollabCreatorSuggestion[];
  status: CollabCreatorsState["status"];
}) {
  if (status === "idle") return null;

  const isLoading = status === "loading";

  return (
    <section className="mt-4 w-full rounded-[24px] bg-[linear-gradient(180deg,rgba(250,250,251,0.86)_0%,rgba(248,249,252,0.58)_100%)] px-3 py-4 ring-1 ring-white/70 transform-gpu backface-hidden antialiased will-change-transform">
      <div className="min-w-0 px-1">
        <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          Parcerias sugeridas
        </p>
        <h3 className="mt-1.5 text-[1rem] font-semibold leading-tight tracking-[-0.025em] text-zinc-950">
          Collabs que combinam
        </h3>
        <p className="mt-1 text-[12px] font-medium leading-5 text-zinc-500">
          Criadores com audiência próxima desta pauta.
        </p>
        {contextLabel ? (
          <p className="mt-2 inline-flex max-w-full rounded-full bg-white/72 px-2 py-1 text-[10.5px] font-bold leading-4 text-zinc-500 ring-1 ring-zinc-200/55">
            {contextLabel}
          </p>
        ) : null}
      </div>

      <div className="mt-3.5 space-y-1">
        {isLoading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={`collab-skeleton-${index}`} className="grid animate-pulse grid-cols-[3.35rem_minmax(0,1fr)_4.5rem] items-center gap-x-3 rounded-[18px] px-1.5 py-3">
                <div className="h-12 w-12 rounded-full bg-zinc-100" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-32 rounded bg-zinc-100" />
                  <div className="h-2.5 w-full max-w-[220px] rounded bg-zinc-100/80" />
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-14 rounded bg-zinc-100" />
                  <div className="h-3 w-16 rounded bg-zinc-100" />
                </div>
              </div>
            ))
          : items.length
            ? items.map((creator) => {
                const reachValue = formatProjectedMetricValue(creator.avgReach);
                const interactionValue = formatProjectedMetricValue(creator.avgInteractions);

                return (
                  <div
                    key={creator.id}
                    className="grid grid-cols-[54px_minmax(0,1fr)_4.7rem] items-center gap-x-3 rounded-[18px] px-1.5 py-3 transition duration-300 hover:bg-white/65"
                  >
                    <div className="relative h-[54px] w-[54px] shrink-0">
                      <div className="relative h-[54px] w-[54px] overflow-hidden rounded-full border-2 border-white bg-zinc-100 shadow-sm ring-1 ring-zinc-200/70">
                        {creator.avatarUrl ? (
                          <Image
                            src={creator.avatarUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="54px"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[16px] font-bold text-zinc-500">
                            {getInitials(creator.name)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="break-words text-[14px] font-bold leading-[1.15] text-zinc-950">
                        {creator.name}
                      </p>

                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        {creator.username ? (
                          <p className="break-all text-[11px] font-semibold leading-4 text-zinc-400">
                            @{creator.username}
                          </p>
                        ) : null}
                        {creator.mediaKitSlug ? (
                          <a
                            href={`/mediakit/${creator.mediaKitSlug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="group inline-flex items-center gap-1 text-[11px] font-bold leading-4 text-indigo-600 transition duration-300 hover:text-indigo-800"
                            aria-label={`Abrir mídia kit de ${creator.name}`}
                          >
                            Mídia kit
                            <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
                          </a>
                        ) : null}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold leading-4 text-zinc-500">
                        <span>
                          <span className="text-zinc-400">Interações </span>
                          <span className="text-zinc-900">{interactionValue}</span>
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-[13px] font-black leading-4 tracking-[-0.02em] text-zinc-950">
                        {reachValue}
                      </p>
                      <p className="mt-1 text-[9px] font-semibold lowercase leading-3 text-zinc-400">
                        alcance
                      </p>
                    </div>
                  </div>
                );
              })
            : (
                <div className="rounded-[18px] bg-zinc-50/70 px-4 py-4 text-[12px] font-medium leading-5 text-zinc-500">
                  Ainda não há base suficiente para sugerir criadores de collab nesse recorte.
                </div>
              )}
      </div>
    </section>
  );
});

const CollabRadarUpsellBanner = memo(function CollabRadarUpsellBanner({
  onActivate,
}: {
  onActivate: () => void;
}) {
  return (
    <div className="w-full rounded-[22px] border border-indigo-100 bg-indigo-50/70 px-4 py-4 shadow-[0_10px_24px_rgba(79,70,229,0.045)]">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border border-indigo-200/70 bg-white text-indigo-600">
          <Sparkles className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-5 text-zinc-950">
            Seu perfil também pode aparecer aqui
          </p>
          <p className="mt-1 text-[12px] font-medium leading-5 text-zinc-600">
            Assinantes entram no radar de collabs compatíveis e recebem consultorias semanais para melhorar posicionamento.
          </p>
          <button
            type="button"
            onClick={onActivate}
            className="mt-3 inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-zinc-950 px-3.5 text-[11px] font-bold text-white shadow-[0_10px_20px_rgba(15,23,42,0.12)] transition duration-300 hover:bg-zinc-800 active:scale-[0.98]"
          >
            Ativar assinatura
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});

const SurfaceMetricsGrid = memo(function SurfaceMetricsGrid({
  reach,
  saves,
  shares,
}: {
  reach: number | null;
  saves: number | null;
  shares: number | null;
}) {
  const metrics = [
    {
      label: "Alcance",
      value: formatProjectedMetricValue(reach),
      icon: TrendingUp,
      accent: "text-sky-300",
    },
    {
      label: "Salvos",
      value: formatProjectedMetricValue(saves),
      icon: Target,
      accent: "text-emerald-300",
    },
    {
      label: "Shares",
      value: formatProjectedMetricValue(shares),
      icon: Share2,
      accent: "text-indigo-300",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
      {metrics.map((metric) => (
        <div key={metric.label} className={cn(FUNNEL_PANEL_SOFT_CLASS, "px-4 py-5 transition duration-300 hover:bg-white")}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{metric.label}</p>
            <metric.icon className={cn("h-4 w-4", metric.accent)} />
          </div>
          <p className="mt-4 text-[1.6rem] font-semibold leading-none tracking-[-0.05em] text-zinc-950">
            {metric.value}
          </p>
        </div>
      ))}
    </div>
  );
});

const AchievementBadgeCards = memo(function AchievementBadgeCards({
  badges,
}: {
  badges: AchievementBadgeItem[];
}) {
  if (!badges.length) return null;

  return (
    <div className="grid w-full gap-3 md:grid-cols-2">
      {badges.map((badge) => (
        <div
          key={badge.label}
          className={cn(
            "rounded-[24px] border bg-gradient-to-br px-4 py-4 shadow-[0_14px_32px_rgba(15,23,42,0.08)]",
            badge.accent,
            badge.border
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-white/60 bg-white/55">
              <badge.icon className={cn("h-4.5 w-4.5", badge.text)} />
            </div>
            <div>
              <p className={cn("text-sm font-semibold", badge.text)}>{badge.label}</p>
              <p className="mt-1 text-sm leading-6 text-zinc-600">{badge.detail}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

const ConfigurationGrid = memo(function ConfigurationGrid({
  items,
}: {
  items: SelectedConfigurationItem[];
}) {
  return (
    <div className={cn("w-full px-5 py-5", FUNNEL_PANEL_SOFT_CLASS)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
        Configuração
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className={cn("rounded-[18px] px-4 py-3", FUNNEL_PANEL_MUTED_CLASS)}>
            <div className="flex items-center gap-2 text-zinc-400">
              <item.icon className="h-3.5 w-3.5" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em]">{item.label}</p>
            </div>
            <p className="mt-2 text-sm font-semibold leading-6 text-zinc-950">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
});

const IdeaActionButtons = memo(function IdeaActionButtons({
  buttonTone = "dark",
  className,
  hasPostLink = false,
  isPublished = false,
  isSaving,
  isSaved,
  onOpenPublished,
  onOpenLinkGallery,
  onReset,
  onSave,
  resetLabel = "Criar nova pauta",
  saveLabel = "Salvar pauta",
}: {
  buttonTone?: "dark" | "light";
  className?: string;
  hasPostLink?: boolean;
  isPublished?: boolean;
  isSaving: boolean;
  isSaved: boolean;
  onOpenPublished?: () => void;
  onOpenLinkGallery?: () => void;
  onReset: () => void;
  onSave: () => void;
  resetLabel?: string;
  saveLabel?: string;
}) {
  const primaryClassName = cn(
    FUNNEL_BUTTON_PRIMARY_CLASS,
    buttonTone === "light" && "!text-white transform-gpu backface-hidden antialiased"
  );
  const shimmerClassName =
    buttonTone === "light"
      ? "absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent"
      : "absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-black/10 to-transparent";
  const contentClassName = cn("relative flex items-center gap-3", buttonTone === "light" && "!text-white");
  const arrowClassName = cn(
    "h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5",
    buttonTone === "light" && "!text-white"
  );

  if (!isPublished && isSaved) {
    return (
      <div className={cn("mt-4 grid w-full gap-3 sm:mt-0 sm:grid-cols-2", className)}>
        <button type="button" onClick={onReset} className={primaryClassName}>
          <span className={shimmerClassName} />
          <span className={contentClassName}>
            {resetLabel}
            <ArrowRight className={arrowClassName} />
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className={cn("mt-4 grid w-full gap-3 sm:mt-0 sm:grid-cols-2", className)}>
      {isPublished ? (
        <>
          <button type="button" onClick={onOpenPublished} className={FUNNEL_BUTTON_PRIMARY_CLASS}>
            <span className={shimmerClassName} />
            <span className="relative flex items-center gap-3">
              {hasPostLink ? "Abrir post" : "Abrir roteiro"}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </span>
          </button>
          <button type="button" onClick={onOpenLinkGallery} className={FUNNEL_BUTTON_SECONDARY_CLASS}>
            Trocar vínculo
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={onSave} disabled={isSaving} className={primaryClassName}>
            <span className={shimmerClassName} />
            <span className={contentClassName}>
              {isSaving ? "Salvando pauta..." : saveLabel}
              {isSaving ? (
                <div
                  className={cn(
                    "h-4 w-4 animate-spin rounded-full border-2",
                    buttonTone === "light" ? "border-white/20 border-t-white" : "border-black/20 border-t-black"
                  )}
                />
              ) : (
                <ArrowRight className={arrowClassName} />
              )}
            </span>
          </button>
          <button type="button" onClick={onReset} className={FUNNEL_BUTTON_SECONDARY_CLASS}>
            {resetLabel}
          </button>
        </>
      )}
    </div>
  );
});

const DECISION_STEP_META: Record<
  PostCreationDecisionStep,
  {
    icon: typeof Clock;
    goal: string;
    question: string;
  }
> = {
  context: {
    icon: Layout,
    goal: "Contexto",
    question: "Qual contexto?",
  },
  proposal: {
    icon: Target,
    goal: "Proposta",
    question: "Qual proposta?",
  },
  tone: {
    icon: MessageSquare,
    goal: "Tom",
    question: "Qual tom?",
  },
  reference: {
    icon: BadgeHelp,
    goal: "Referência",
    question: "Qual referência?",
  },
  intent: {
    icon: Flame,
    goal: "Intenção",
    question: "Qual intenção?",
  },
  format: {
    icon: Video,
    goal: "Formato",
    question: "Qual formato?",
  },
  duration: {
    icon: Clock,
    goal: "Duração",
    question: "Qual duração?",
  },
  day: {
    icon: Clock,
    goal: "Dia",
    question: "Qual dia?",
  },
  hour: {
    icon: Clock,
    goal: "Horário",
    question: "Qual horário?",
  },
  theme: {
    icon: Sparkles,
    goal: "Tema",
    question: "Qual tema?",
  },
  pauta: {
    icon: Wand2,
    goal: "Pauta Final",
    question: "Qual pauta final?",
  },
  narrative: {
    icon: BookOpen,
    goal: "Narrativa",
    question: "Qual narrativa?",
  },
};

function normalizeUiKey(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveDecisionOptionEmoji(step: PostCreationDecisionStep, label: string) {
  const key = normalizeUiKey(label);

  const contextEmojiById: Record<string, string> = {
    lifestyle_and_wellbeing: "🌿",
    fashion_style: "👗",
    beauty_personal_care: "💄",
    fitness_sports: "🏋️",
    food_culinary: "🍽️",
    health_wellness: "🧘",
    personal_and_professional: "💼",
    relationships_family: "❤️",
    parenting: "👶",
    career_work: "📈",
    finance: "💰",
    personal_development: "🪴",
    education: "📚",
    hobbies_and_interests: "🎨",
    travel_tourism: "✈️",
    home_decor_diy: "🏠",
    technology_digital: "💻",
    art_culture: "🎭",
    gaming: "🎮",
    automotive: "🚗",
    pets: "🐾",
    nature_animals: "🌳",
    science_and_knowledge: "🔬",
    science_communication: "🧪",
    history: "🏛️",
    curiosities: "🧠",
    social_and_events: "🎉",
    events_celebrations: "🥂",
    social_causes_religion: "🤲",
    general: "🌐",
  };

  const proposalEmojiById: Record<string, string> = {
    announcement: "📣",
    behind_the_scenes: "🎬",
    call_to_action: "📢",
    clip: "✂️",
    comparison: "⚖️",
    giveaway: "🎁",
    humor_scene: "😂",
    lifestyle: "✨",
    message_motivational: "💫",
    news: "📰",
    participation: "🤝",
    positioning_authority: "👑",
    publi_divulgation: "📦",
    "q&a": "❓",
    react: "👀",
    review: "📝",
    tips: "💡",
    trend: "📈",
    unboxing: "📬",
  };

  const toneEmojiById: Record<string, string> = {
    humorous: "😂",
    inspirational: "✨",
    educational: "🎓",
    critical: "🧠",
    promotional: "🛍️",
    neutral: "🗂️",
  };

  const referenceEmojiById: Record<string, string> = {
    pop_culture: "🎬",
    pop_culture_movies_series: "🎞️",
    pop_culture_books: "📚",
    pop_culture_games: "🎮",
    pop_culture_music: "🎵",
    pop_culture_internet: "🌐",
    people_and_groups: "🧑‍🤝‍🧑",
    regional_stereotypes: "🗣️",
    professions: "🧑‍💼",
    geography: "📍",
    city: "🏙️",
    country: "🌎",
  };

  const intentEmojiById: Record<string, string> = {
    educar: "🎓",
    teach: "🎓",
    converter: "🎯",
    convert: "🎯",
    conectar: "🤝",
    connect: "🤝",
    entreter: "🎉",
    entertain: "🎉",
    engajar: "💬",
    engage: "💬",
    autoridade: "👑",
    build_authority: "👑",
  };

  const formatEmojiById: Record<string, string> = {
    reel: "🎬",
    photo: "📸",
    carousel: "🖼️",
    long_video: "📹",
  };

  const resolveThemeEmoji = (themeKey: string) => {
    if (!themeKey) return "💡";

    const themeRules: Array<{ pattern: RegExp; emoji: string }> = [
      { pattern: /\b(aniversario|aniversarios|niver|celebracao|celebrar|comemoracao|comemorar|festa)\b/, emoji: "🎉" },
      { pattern: /\b(cotidiano|dia a dia|rotina|bastidor|bastidores|making of)\b/, emoji: "☕" },
      { pattern: /\b(comunidade|comunidades|grupo|grupos|audiencia|publico|seguidores)\b/, emoji: "🤝" },
      { pattern: /\b(produto|produtos|servico|servicos|colecao|kit|linha)\b/, emoji: "📦" },
      { pattern: /\b(lancamento|estreia|novidade|novidades|chegada|novo|nova)\b/, emoji: "🚀" },
      { pattern: /\b(evento|agenda|calendario|data especial|temporada|campanha)\b/, emoji: "📅" },
      { pattern: /\b(dica|dicas|tutorial|guia|passo a passo|checklist)\b/, emoji: "💡" },
      { pattern: /\b(resultado|metricas|numero|numeros|dados|insight|analise|desempenho)\b/, emoji: "📊" },
      { pattern: /\b(erro|erros|ajuste|ajustes|problema|falha|falhas)\b/, emoji: "🛠️" },
      { pattern: /\b(cliente|clientes|depoimento|case|cases|prova social)\b/, emoji: "🗣️" },
      { pattern: /\b(trend|trends|viral|buzz|momento)\b/, emoji: "🔥" },
      { pattern: /\b(venda|vendas|oferta|ofertas|promocao|promocoes|desconto)\b/, emoji: "🛍️" },
      { pattern: /\b(parceria|colaboracao|collab|participacao)\b/, emoji: "🤝" },
      { pattern: /\b(planejamento|estrategia|estrategico|plano)\b/, emoji: "🧭" },
      { pattern: /\b(pergunta|duvida|duvidas|faq|q a|qa)\b/, emoji: "❓" },
      { pattern: /\b(inspiracao|motivacao|motivacional|sonho|visao)\b/, emoji: "✨" },
    ];

    const matchedRule = themeRules.find((rule) => rule.pattern.test(themeKey));
    return matchedRule?.emoji || "🏷️";
  };

  if (step === "hour") {
    if (key.includes("06") || key.includes("07") || key.includes("08")) return "🌅";
    if (key.includes("09") || key.includes("10") || key.includes("11") || key.includes("12")) return "☀️";
    if (key.includes("13") || key.includes("14") || key.includes("15") || key.includes("16")) return "🌤️";
    if (key.includes("17") || key.includes("18") || key.includes("19")) return "🌇";
    if (key.includes("20") || key.includes("21") || key.includes("22")) return "🌙";
    return "🕒";
  }
  if (step === "duration") {
    if (key.includes("15")) return "⚡";
    if (key.includes("30")) return "⏱️";
    if (key.includes("60")) return "🕰️";
    return "⏳";
  }
  if (step === "day") {
    if (key.includes("segunda") || key.includes("seg")) return "💼";
    if (key.includes("terca") || key.includes("terça") || key.includes("ter")) return "🚀";
    if (key.includes("quarta") || key.includes("qua")) return "🗓️";
    if (key.includes("quinta") || key.includes("qui")) return "📈";
    if (key.includes("sexta") || key.includes("sex")) return "🎉";
    if (key.includes("sabado") || key.includes("sábado") || key.includes("sab")) return "🌞";
    if (key.includes("domingo") || key.includes("dom")) return "🌿";
    return "📅";
  }
  if (step === "proposal") {
    const proposal = getCategoryByValue(label, "proposal");
    if (proposal?.id && proposalEmojiById[proposal.id]) return proposalEmojiById[proposal.id];
    return "🎯";
  }
  if (step === "context") {
    const context = getCategoryByValue(label, "context");
    if (context?.id && contextEmojiById[context.id]) return contextEmojiById[context.id];
    return "🧭";
  }
  if (step === "format") {
    const format = getCategoryByValue(label, "format");
    if (format?.id && formatEmojiById[format.id]) return formatEmojiById[format.id];
    if (key.includes("stor")) return "📲";
    return "🎞️";
  }
  if (step === "theme") return resolveThemeEmoji(key);
  if (step === "pauta") return resolveThemeEmoji(key);
  if (step === "tone") {
    const tone = getCategoryByValue(label, "tone");
    if (tone?.id && toneEmojiById[tone.id]) return toneEmojiById[tone.id];
    return "🎤";
  }
  if (step === "reference") {
    const reference = getCategoryByValue(label, "reference");
    if (reference?.id && referenceEmojiById[reference.id]) return referenceEmojiById[reference.id];
    return "🧩";
  }
  if (step === "intent") {
    return intentEmojiById[key] || "🎯";
  }
  if (step === "narrative") return "📖";
  if (key.includes("hook")) return "💡";
  return "✨";
}

function resolveIdeaLaneEmoji(lane: NonNullable<PostCreationFunnelState["idea"]>["lane"]) {
  if (lane === "bold") return "🚀";
  if (lane === "safe") return "🛡️";
  if (lane === "practical") return "🛠️";
  return "💡";
}

function buildHookVariations(blueprint: NonNullable<PostCreationFunnelState["blueprint"]>) {
  const theme = truncateText(blueprint.whatToPost, 40).replace(/[.!?]+$/, "");
  const contrastPrefix = "O erro mais comum é:";

  return [
    {
      id: "question",
      title: "Start with a question",
      detail: `“Você ainda está tratando ${theme.toLowerCase()} do jeito errado?”`,
    },
    {
      id: "contrast",
      title: "Lead with contrast",
      detail: `${contrastPrefix} ${theme.toLowerCase()}.`,
    },
    {
      id: "story",
      title: "Begin with a mini-story",
      detail: `“Eu percebi isso quando tentei ajustar ${theme.toLowerCase()} no último post.”`,
    },
  ];
}

function normalizeLoadedFunnelState(value: unknown): PostCreationFunnelState {
  const empty = createEmptyPostCreationFunnelState();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return empty;
  }

  const candidate = value as Record<string, unknown>;
  const stage =
    candidate.stage === "path" ||
    candidate.stage === "idea" ||
    candidate.stage === "blueprint" ||
    candidate.stage === "script" ||
    candidate.stage === "published"
      ? candidate.stage
      : null;
  const decision =
    candidate.decision && typeof candidate.decision === "object" && !Array.isArray(candidate.decision)
      ? (candidate.decision as Record<string, unknown>)
      : null;
  const idea =
    candidate.idea && typeof candidate.idea === "object" && !Array.isArray(candidate.idea)
      ? (candidate.idea as Record<string, unknown>)
      : null;
  const blueprint =
    candidate.blueprint && typeof candidate.blueprint === "object" && !Array.isArray(candidate.blueprint)
      ? (candidate.blueprint as Record<string, unknown>)
      : null;
  const linkedContent =
    candidate.linkedContent && typeof candidate.linkedContent === "object" && !Array.isArray(candidate.linkedContent)
      ? (candidate.linkedContent as Record<string, unknown>)
      : null;
  const blueprintChecklist =
    candidate.blueprintChecklist &&
    typeof candidate.blueprintChecklist === "object" &&
    !Array.isArray(candidate.blueprintChecklist)
      ? (candidate.blueprintChecklist as Record<string, unknown>)
      : null;

  const next: PostCreationFunnelState = {
    stage: "path",
    activeDecisionStep:
      candidate.activeDecisionStep === "day" ||
      candidate.activeDecisionStep === "hour" ||
      candidate.activeDecisionStep === "duration" ||
      candidate.activeDecisionStep === "proposal" ||
      candidate.activeDecisionStep === "context" ||
      candidate.activeDecisionStep === "format" ||
      candidate.activeDecisionStep === "reference" ||
      candidate.activeDecisionStep === "intent" ||
      candidate.activeDecisionStep === "theme" ||
      candidate.activeDecisionStep === "pauta" ||
      candidate.activeDecisionStep === "narrative" ||
      candidate.activeDecisionStep === "tone"
        ? (candidate.activeDecisionStep as PostCreationDecisionStep)
        : null,
    blueprintScriptStatus:
      candidate.blueprintScriptStatus === "idle" ||
      candidate.blueprintScriptStatus === "ready" ||
      candidate.blueprintScriptStatus === "generating" ||
      candidate.blueprintScriptStatus === "generated" ||
      candidate.blueprintScriptStatus === "linked" ||
      candidate.blueprintScriptStatus === "published"
        ? candidate.blueprintScriptStatus
        : "idle",
    decision: {
      dayId: typeof decision?.dayId === "string" && decision.dayId.trim() ? decision.dayId.trim() : null,
      hourId: typeof decision?.hourId === "string" && decision.hourId.trim() ? decision.hourId.trim() : null,
      durationId: typeof decision?.durationId === "string" && decision.durationId.trim() ? decision.durationId.trim() : null,
      proposalId:
        typeof decision?.proposalId === "string" && decision.proposalId.trim() ? decision.proposalId.trim() : null,
      contextId:
        typeof decision?.contextId === "string" && decision.contextId.trim() ? decision.contextId.trim() : null,
      themeId: typeof decision?.themeId === "string" && decision.themeId.trim() ? decision.themeId.trim() : null,
      formatId: typeof decision?.formatId === "string" && decision.formatId.trim() ? decision.formatId.trim() : null,
      pautaId: typeof decision?.pautaId === "string" && decision.pautaId.trim() ? decision.pautaId.trim() : null,
      narrativeId:
        typeof decision?.narrativeId === "string" && decision.narrativeId.trim()
          ? decision.narrativeId.trim()
          : null,
      toneId: typeof decision?.toneId === "string" && decision.toneId.trim() ? decision.toneId.trim() : null,
      referenceId:
        typeof decision?.referenceId === "string" && decision.referenceId.trim()
          ? decision.referenceId.trim()
          : null,
      intentId:
        typeof decision?.intentId === "string" && decision.intentId.trim() ? decision.intentId.trim() : null,
    },
    idea: idea
      ? {
          id: typeof idea.id === "string" && idea.id.trim() ? idea.id.trim() : "idea",
          title: typeof idea.title === "string" ? idea.title.trim() : "",
          description: typeof idea.description === "string" ? idea.description.trim() : "",
          lane:
            idea.lane === "safe" || idea.lane === "bold" || idea.lane === "practical" ? idea.lane : "recommended",
          source:
            idea.source === "historical_pattern" ||
            idea.source === "ai_idea" ||
            idea.source === "saved_idea" ||
            idea.source === "manual"
              ? idea.source
              : "manual",
          expectedInteractionsAvg:
            typeof idea.expectedInteractionsAvg === "number" && Number.isFinite(idea.expectedInteractionsAvg)
              ? idea.expectedInteractionsAvg
              : null,
          confidence: typeof idea.confidence === "number" ? idea.confidence : null,
          evidence: Array.isArray(idea.evidence)
            ? idea.evidence.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            : undefined,
        }
      : null,
    blueprint: blueprint
      ? {
          whatToPost: typeof blueprint.whatToPost === "string" ? blueprint.whatToPost.trim() : "",
          whyThisPath: typeof blueprint.whyThisPath === "string" ? blueprint.whyThisPath.trim() : "",
          whenToPost: typeof blueprint.whenToPost === "string" ? blueprint.whenToPost.trim() : "",
          howItShouldWork: typeof blueprint.howItShouldWork === "string" ? blueprint.howItShouldWork.trim() : "",
          scenes: Array.isArray(blueprint.scenes)
            ? blueprint.scenes
                .filter((scene): scene is Record<string, unknown> => Boolean(scene && typeof scene === "object"))
                .map((scene, index) => ({
                  id: typeof scene.id === "string" && scene.id.trim() ? scene.id.trim() : `scene-${index + 1}`,
                  title: typeof scene.title === "string" ? scene.title.trim() : "",
                  visual: typeof scene.visual === "string" ? scene.visual.trim() : "",
                  message: typeof scene.message === "string" ? scene.message.trim() : "",
                  direction: typeof scene.direction === "string" ? scene.direction.trim() : "",
                  rationale: typeof scene.rationale === "string" ? scene.rationale.trim() : "",
                }))
            : [],
        }
      : null,
    blueprintChecklist: {
      sceneIds: Array.isArray(blueprintChecklist?.sceneIds)
        ? blueprintChecklist.sceneIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [],
      hookIds: Array.isArray(blueprintChecklist?.hookIds)
        ? blueprintChecklist.hookIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [],
    },
    scriptId:
      typeof candidate.scriptId === "string" && candidate.scriptId.trim() ? candidate.scriptId.trim() : null,
    linkedContent:
      linkedContent && typeof (linkedContent.id || (linkedContent as any).contentId) === "string"
        ? {
            id: (linkedContent.id || (linkedContent as any).contentId).trim(),
            caption:
              typeof linkedContent.caption === "string" && linkedContent.caption.trim()
                ? linkedContent.caption.trim()
                : null,
            postDate:
              typeof linkedContent.postDate === "string" && linkedContent.postDate.trim()
                ? linkedContent.postDate.trim()
                : null,
            postLink:
              typeof linkedContent.postLink === "string" && linkedContent.postLink.trim()
                ? linkedContent.postLink.trim()
                : null,
            coverUrl:
              typeof linkedContent.coverUrl === "string" && linkedContent.coverUrl.trim()
                ? linkedContent.coverUrl.trim()
                : null,
            engagement:
              typeof linkedContent.engagement === "number" && Number.isFinite(linkedContent.engagement)
                ? linkedContent.engagement
                : null,
            totalInteractions:
              typeof linkedContent.totalInteractions === "number" && Number.isFinite(linkedContent.totalInteractions)
                ? linkedContent.totalInteractions
                : null,
          }
        : null,
  };

  next.stage = stage || resolveNextFunnelStage(next);
  if (!next.activeDecisionStep && next.stage === "path") {
    next.activeDecisionStep = resolveFirstIncompleteDecisionStep(
      next.decision,
      POST_CREATION_DECISION_STEP_ORDER
    );
  }
  return next;
}

function isMeaningfulFunnelState(state: PostCreationFunnelState): boolean {
  return Boolean(
    state.idea ||
      state.blueprint ||
      state.scriptId ||
      state.linkedContent ||
      state.decision.contextId ||
      state.decision.proposalId ||
      state.decision.toneId ||
      state.decision.referenceId ||
      state.decision.intentId ||
      state.decision.formatId ||
      state.decision.durationId ||
      state.decision.dayId ||
      state.decision.hourId ||
      state.decision.themeId ||
      state.decision.narrativeId
  );
}

function buildTitleSnapshot(state: PostCreationFunnelState): string | null {
  const candidate =
    state.idea?.title?.trim() ||
    state.blueprint?.whatToPost?.trim() ||
    null;
  return candidate || null;
}

function buildDraftPayload(args: {
  state: PostCreationFunnelState;
  selectedSlotId: string | null;
  selectedScriptId: string | null;
}) {
  return {
    stage: args.state.stage,
    titleSnapshot: buildTitleSnapshot(args.state),
    state: args.state,
    selectedSlotId: args.selectedSlotId,
    selectedScriptId: args.selectedScriptId,
    linkedContentId: args.state.linkedContent?.id || null,
  };
}

function buildDraftSignature(payload: {
  stage: PostCreationFunnelStage;
  titleSnapshot: string | null;
  state: PostCreationFunnelState;
  selectedSlotId: string | null;
  selectedScriptId: string | null;
  linkedContentId: string | null;
}) {
  return JSON.stringify(payload);
}

function resolveScriptStatusLabel(script: FunnelScriptSummaryItem | null): "generated" | "linked" | "published" | null {
  if (!script) return null;
  if (script.publication?.isPosted) return "published";
  if (script.linkingSummary?.isLinked) return "linked";
  return "generated";
}

function getDayLabel(dayOfWeek?: number) {
  return resolveFullDayLabel(dayOfWeek);
}

function getBlockLabel(hour?: number) {
  if (typeof hour !== "number") return "Horário";
  return `${String(hour).padStart(2, "0")}h`;
}

function formatPlannerFormatLabel(format?: string) {
  if (!format) return "Formato";
  const registeredLabel = format ? getCategoryByValue(format, "format")?.label : null;
  if (registeredLabel) return registeredLabel;
  const normalized = format.toLowerCase();
  if (normalized === "reel") return "Reel";
  if (normalized === "carousel") return "Carrossel";
  if (normalized === "story") return "Stories";
  return format;
}

function formatCategoryLabel(
  value?: string | null,
  type?: Extract<CategoryType, "proposal" | "context" | "tone" | "format" | "reference">
) {
  if (!value) return "Item";
  if (type) {
    const registeredLabel = value ? getCategoryByValue(value, type)?.label : null;
    if (registeredLabel) return registeredLabel;
  }
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function inferNarrativeLabel(slot?: PlannerUISlot | null) {
  const narrative = slot?.narrativeForm?.[0];
  if (narrative) return formatCategoryLabel(narrative);
  if (slot?.scriptShort && /erro|ajuste|prova/i.test(slot.scriptShort)) {
    return "Erro -> ajuste -> prova";
  }
  if (slot?.scriptShort && /bastidor|rotina/i.test(slot.scriptShort)) {
    return "Bastidor -> ajuste -> conversa";
  }
  return "Erro -> ajuste -> prova";
}

function inferDurationId(slot?: PlannerUISlot | null) {
  const seconds =
    typeof slot?.recordingTimeSec === "number" && slot.recordingTimeSec > 0
      ? slot.recordingTimeSec
      : null;
  if (seconds !== null) {
    if (seconds <= 15) return "< 15s";
    if (seconds <= 30) return "15-30s";
    if (seconds <= 60) return "30-60s";
    return "60s+";
  }
  if (slot?.format === "story") return "15-30s";
  if (slot?.format === "reel") return "15-30s";
  if (slot?.format === "long_video") return "60s+";
  return null;
}

function pickRecommendedPlannerSlot(slots: PlannerUISlot[]): PlannerUISlot | null {
  if (!slots.length) return null;
  const saved = slots.find((slot) => slot.isSaved && (slot.status === "planned" || slot.status === "drafted"));
  if (saved) return saved;
  const planned = slots.find((slot) => slot.status === "planned" || slot.status === "drafted");
  return planned || slots[0] || null;
}

function buildFallbackRecommendation() {
  return {
    path: [
      {
        id: "day",
        label: "Janela",
        value: "Qui, 19h",
        reason: "Faixa recorrente para conteúdos dessa família no perfil.",
        expectedInteractionsAvg: 1250,
      },
      {
        id: "proposal",
        label: "Proposta",
        value: "Diagnóstico",
        reason: "Essa proposta costuma puxar mais retenção do que explicação aberta.",
        expectedInteractionsAvg: 1100,
      },
      {
        id: "context",
        label: "Contexto",
        value: "Retenção",
        reason: "Esse contexto aparece com recorrência nas combinações fortes do perfil.",
        expectedInteractionsAvg: 950,
      },
      {
        id: "tone",
        label: "Tom",
        value: "Direto",
        reason: "Esse tom tende a segurar melhor a atenção nesse tipo de post.",
        expectedInteractionsAvg: 900,
      },
      {
        id: "theme",
        label: "Tema",
        value: "Abertura do vídeo",
        reason: "Tema mais próximo do que vale puxar agora nessa combinação.",
        expectedInteractionsAvg: 1050,
      },
    ],
    idea: {
      title: "O erro que derruba sua retenção antes da dica",
      summary: "Pauta recomendada a partir da combinação editorial mais forte do perfil agora.",
      variants: ["Mais segura", "Mais ousada", "Mais prática"],
    },
    blueprint: {
      summary: "Blueprint curto com como gravar, por que gravar assim e 4 cenas enxutas.",
      nextStep: "Se fizer sentido, expanda isso para roteiro sugerido sem sair do board.",
    },
  };
}

function buildRecommendationFromPlannerSlot(slot: PlannerUISlot | null) {
  if (!slot) return buildFallbackRecommendation();

  const proposal = slot.categories?.proposal?.[0] || null;
  const tone = slot.categories?.tone || null;
  const context = slot.categories?.context?.[0] || null;
  const windowLabel = `${getDayLabel(slot.dayOfWeek)}, ${getBlockLabel(slot.blockStartHour)}`;
  const proposalLabel = formatCategoryLabel(proposal, "proposal");
  const themeLabel = slot.themeKeyword || slot.themes?.[0] || slot.title || "Tema recomendado";
  const rationale = slot.rationale?.trim() || "Combinação alinhada ao histórico recente do perfil.";

  return {
    path: [
      {
        id: "day",
        label: "Janela",
        value: windowLabel,
        reason: rationale,
      },
      {
        id: "proposal",
        label: "Proposta",
        value: proposalLabel,
        reason: context
          ? `Recorte puxado pelo contexto ${formatCategoryLabel(context, "context").toLowerCase()} do perfil.`
          : "Proposta repetida em slots fortes e fáceis de executar.",
      },
      {
        id: "context",
        label: "Contexto",
        value: formatCategoryLabel(context, "context"),
        reason: `Esse é o contexto mais compatível com ${proposalLabel.toLowerCase()} nessa faixa.`,
      },
      {
        id: "tone",
        label: "Tom",
        value: formatCategoryLabel(tone, "tone"),
        reason: tone
          ? `Tom ${formatCategoryLabel(tone, "tone").toLowerCase()} combina com a leitura que mais engaja no perfil.`
          : "Tom mais compatível com clareza e retenção para esse assunto.",
      },
      {
        id: "theme",
        label: "Tema",
        value: themeLabel,
        reason: "Assunto que melhor fecha a combinação antes da pauta específica.",
      },
    ],
    idea: {
      title: slot.title || "Pauta recomendada do planner",
      summary:
        slot.scriptShort ||
        "Pauta sugerida a partir do planner, pronta para virar direção de gravação e depois roteiro.",
      variants: ["Recomendada", "Mais prática", "Mais ousada"],
    },
    blueprint: {
      summary:
        slot.scriptShort ||
        "Transforme essa pauta em um blueprint curto e depois em roteiro, sem sair do mesmo board.",
      nextStep:
        "Depois de validar a direção editorial, expanda para roteiro e vincule o conteúdo publicado ao mesmo item.",
    },
  };
}

function buildDecisionFromPlannerSlot(slot: PlannerUISlot | null) {
  if (!slot) {
    return {
      dayId: null,
      hourId: null,
      durationId: null,
      proposalId: null,
      contextId: null,
      toneId: null,
      referenceId: null,
      intentId: null,
      formatId: null,
      pautaId: null,
      themeId: null,
      narrativeId: null,
    };
  }

  return {
    dayId: typeof slot.dayOfWeek === "number" ? String(slot.dayOfWeek) : null,
    hourId: typeof slot.blockStartHour === "number" ? String(slot.blockStartHour) : null,
    durationId: inferDurationId(slot),
    formatId: slot.format || null,
    pautaId: slot.slotId || null,
    proposalId: slot.categories?.proposal?.[0] || null,
    contextId: slot.categories?.context?.[0] || null,
    toneId: slot.categories?.tone || null,
    referenceId: slot.categories?.reference?.[0] || null,
    intentId: slot.contentIntent?.[0] || null,
    themeId:
      (slot.themeKeyword || slot.themes?.[0] || slot.title || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim() || null,
    narrativeId: slot.narrativeForm?.[0] || inferNarrativeLabel(slot),
  };
}

function buildGeneratedPautaId(label: string, index: number) {
  const normalized = normalizeOptionToken(label);
  return `ai-pauta-${normalized || "opcao"}-${index + 1}`;
}

function buildGeneratedPautaSlot(
  baseSlot: PlannerUISlot,
  pautaTitle: string,
  keyword: string | null,
  allThemes: string[],
  pautaReason?: string | null,
  decision?: PostCreationDecisionState
): PlannerUISlot {
  return {
    ...baseSlot,
    slotId: decision?.pautaId || baseSlot.slotId,
    format: decision?.formatId || baseSlot.format,
    categories: {
      ...baseSlot.categories,
      context: decision?.contextId ? [decision.contextId] : baseSlot.categories?.context,
      proposal: decision?.proposalId ? [decision.proposalId] : baseSlot.categories?.proposal,
      tone: decision?.toneId || baseSlot.categories?.tone,
      reference: decision?.referenceId ? [decision.referenceId] : baseSlot.categories?.reference,
    },
    contentIntent: decision?.intentId ? [decision.intentId] : baseSlot.contentIntent,
    narrativeForm: decision?.narrativeId ? [decision.narrativeId] : baseSlot.narrativeForm,
    title: pautaTitle,
    scriptShort: pautaReason || pautaTitle,
    rationale: pautaReason || baseSlot.rationale,
    themes: allThemes,
    themeKeyword: keyword || baseSlot.themeKeyword,
  };
}

function resolveGeneratedPautaLane(index: number): PostCreationIdeaVariant["lane"] {
  if (index === 1) return "safe";
  if (index === 2) return "bold";
  if (index === 3) return "practical";
  return "recommended";
}

function getEvidenceInteractionValues(slot: PlannerUISlot | null | undefined) {
  return (slot?.evidencePosts || [])
    .map((post) =>
      typeof post.totalInteractions === "number" && Number.isFinite(post.totalInteractions) && post.totalInteractions > 0
        ? post.totalInteractions
        : null
    )
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);
}

function medianNumber(values: number[]) {
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[middle - 1]! + values[middle]!) / 2 : values[middle]!;
}

function estimateGeneratedPautaInteractions(slot: PlannerUISlot, outcomeSignals: PostCreationOutcomeSignal[]) {
  const broadEstimate = estimatePlannerSlotInteractions({ ...slot, slotId: undefined }, outcomeSignals);
  const evidenceValues = getEvidenceInteractionValues(slot);
  const evidenceMedian = medianNumber(evidenceValues);

  if (typeof evidenceMedian === "number" && Number.isFinite(evidenceMedian) && evidenceMedian > 0) {
    const evidenceWeight = evidenceValues.length >= 3 ? 0.72 : 0.55;
    if (typeof broadEstimate === "number" && Number.isFinite(broadEstimate) && broadEstimate > 0) {
      return Math.round(evidenceMedian * evidenceWeight + broadEstimate * (1 - evidenceWeight));
    }
    return Math.round(evidenceMedian);
  }

  return broadEstimate;
}

function readPositiveMetric(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function estimateProjectedReach(slot: PlannerUISlot | null | undefined, interactions: number | null, activeStage: PostCreationFunnelStage) {
  const viewsP50 = readPositiveMetric(slot?.expectedMetrics?.viewsP50);
  if (activeStage !== "published" && viewsP50) return viewsP50;
  return typeof interactions === "number" && interactions > 0
    ? Math.round(interactions * (activeStage === "published" ? 2.9 : 5.6))
    : null;
}

function estimateProjectedShares(slot: PlannerUISlot | null | undefined, interactions: number | null, activeStage: PostCreationFunnelStage) {
  const sharesP50 = readPositiveMetric(slot?.expectedMetrics?.sharesP50);
  if (activeStage !== "published" && sharesP50) return sharesP50;
  return typeof interactions === "number" && interactions > 0
    ? Math.round(interactions * (activeStage === "published" ? 0.08 : 0.12))
    : null;
}

function estimateProjectedSaves(interactions: number | null, activeStage: PostCreationFunnelStage) {
  return typeof interactions === "number" && interactions > 0
    ? Math.round(interactions * (activeStage === "published" ? 0.14 : 0.19))
    : null;
}

function clampUnit(value: number) {
  return Math.max(0, Math.min(1, value));
}

function computeGeneratedPautaConfidence(params: {
  decision: PostCreationDecisionState;
  index: number;
  slot: PlannerUISlot;
}) {
  const selectedDimensions = [
    params.decision.contextId,
    params.decision.proposalId,
    params.decision.toneId,
    params.decision.referenceId,
    params.decision.intentId,
    params.decision.formatId,
    params.decision.durationId,
    params.decision.narrativeId,
    params.decision.dayId,
    params.decision.hourId,
    params.decision.themeId,
  ].filter(Boolean).length;
  const evidenceTotal = Math.max(params.slot.evidenceCount || 0, params.slot.evidencePosts?.length || 0);
  const hasMetricBaseline = Boolean(params.slot.expectedMetrics?.viewsP50 || params.slot.expectedMetrics?.sharesP50);
  const score =
    0.56 +
    Math.min(0.16, evidenceTotal * 0.018) +
    (hasMetricBaseline ? 0.08 : 0) +
    Math.min(0.1, selectedDimensions * 0.009) -
    params.index * 0.025;

  return Number(clampUnit(Math.min(score, 0.88)).toFixed(2));
}

function buildGeneratedPautaCandidate(params: {
  baseSlot: PlannerUISlot;
  pautaTitle: string;
  pautaReason?: string | null;
  keyword: string | null;
  themes: string[];
  index: number;
  decision: PostCreationDecisionState;
  outcomeSignals: PostCreationOutcomeSignal[];
}): PostCreationIdeaCandidate {
  const slot = buildGeneratedPautaSlot(
    params.baseSlot,
    params.pautaTitle,
    params.keyword,
    params.themes,
    params.pautaReason,
    params.decision
  );
  const id = buildGeneratedPautaId(params.pautaTitle, params.index);
  const lane = resolveGeneratedPautaLane(params.index);
  const expectedInteractionsAvg = estimateGeneratedPautaInteractions(slot, params.outcomeSignals);

  return {
    slot,
    decision: {
      ...params.decision,
      pautaId: id,
    },
    variant: {
      id,
      title: params.pautaTitle,
      description: params.pautaReason || "",
      lane,
      source: "ai_idea",
      expectedInteractionsAvg,
      confidence: computeGeneratedPautaConfidence({
        decision: params.decision,
        index: params.index,
        slot,
      }),
      evidence: params.keyword ? [`Tema-base: ${params.keyword}`] : [],
    },
  };
}

function buildPersistablePlannerSlotFromCandidate(candidate: PostCreationIdeaCandidate): PlannerUISlot {
  const slot = candidate.slot;
  const titleToken = normalizeOptionToken(candidate.variant.title || candidate.decision.pautaId || "pauta");
  const candidateToken = normalizeOptionToken(candidate.variant.id || candidate.decision.pautaId || titleToken);
  const savedSlotId =
    slot.savedFrom === POST_CREATION_SAVED_FROM && slot.slotId
      ? slot.slotId
      : `saved-pauta-${candidateToken || titleToken || "item"}-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;
  return {
    ...slot,
    slotId: savedSlotId,
    dayOfWeek: slot.dayOfWeek,
    blockStartHour: slot.blockStartHour,
    format: slot.format || candidate.decision.formatId || "reel",
    categories: {
      ...slot.categories,
      context: candidate.decision.contextId ? [candidate.decision.contextId] : slot.categories?.context,
      proposal: candidate.decision.proposalId ? [candidate.decision.proposalId] : slot.categories?.proposal,
      tone: candidate.decision.toneId || slot.categories?.tone,
      reference: candidate.decision.referenceId ? [candidate.decision.referenceId] : slot.categories?.reference,
    },
    contentIntent: candidate.decision.intentId ? [candidate.decision.intentId] : slot.contentIntent,
    narrativeForm: candidate.decision.narrativeId ? [candidate.decision.narrativeId] : slot.narrativeForm,
    title: candidate.variant.title,
    scriptShort: candidate.variant.title,
    themeKeyword: slot.themeKeyword || slot.themes?.[0] || undefined,
    status: "drafted",
    savedFrom: POST_CREATION_SAVED_FROM,
    isSaved: true,
  };
}

function buildScriptPromptFromBlueprint(blueprint: NonNullable<PostCreationFunnelState["blueprint"]>) {
  const sceneLines = blueprint.scenes
    .map(
      (scene, index) =>
        `Cena ${index + 1} - ${scene.title}\nVisual: ${scene.visual}\nMensagem: ${scene.message}\nDireção: ${scene.direction}\nPor que assim: ${scene.rationale}`
    )
    .join("\n\n");

  return [
    `Expanda este blueprint em um roteiro pronto para gravação, mantendo a promessa, a estrutura e o tom do plano.`,
    `Título âncora: ${blueprint.whatToPost}`,
    `Por que esse caminho: ${blueprint.whyThisPath}`,
    `Quando postar: ${blueprint.whenToPost}`,
    `Como o vídeo deve funcionar: ${blueprint.howItShouldWork}`,
    sceneLines,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export default function PostCreationFunnelBoardShell({
  viewer,
  canInteract = false,
  viewerPending = false,
  previewMode = false,
  initialInstagramConnected = false,
  isHighlighted = false,
  initialFocusStage = "path",
	  surfaceMode = "nested",
	  onActivatePreview,
	  onRequestAccountGate,
	  onRequestPaywall,
	  activationPending = false,
	  activationError = null,
	}: PostCreationFunnelBoardShellProps) {
  const { isMobile } = useSidebarViewport();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const normalizedViewer = useMemo(
    () => ({
      id: viewer?.id ?? "",
	      role: viewer?.role ?? null,
	      name: viewer?.name ?? null,
	      instagramConnected: viewer?.instagramConnected ?? false,
	      accountState: viewer?.accountState ?? null,
	      postCreationTrial: viewer?.postCreationTrial ?? null,
	    }),
	    [
	      viewer?.accountState,
	      viewer?.id,
	      viewer?.instagramConnected,
	      viewer?.name,
	      viewer?.postCreationTrial,
	      viewer?.role,
	    ]
	  );
  const isPreviewMode = previewMode && !normalizedViewer.id;
  const isPreSignupViewer = normalizedViewer.accountState === "pre_signup";
  const isTrialViewer = !canInteract && !isPreviewMode && Boolean(normalizedViewer.postCreationTrial?.startedAt);
  const instagramConnectedForTrial = Boolean(normalizedViewer.instagramConnected ?? initialInstagramConnected);
  const isPaywallReturning = searchParams?.get(PAYWALL_URL_PARAM) === "1";
  const isPendingPaywall = isPaywallReturning && !canInteract;
  const shouldShowActivationOverlay = (isPreviewMode || (isTrialViewer && !instagramConnectedForTrial)) && !isPendingPaywall;
  const usesBoardSurface = surfaceMode === "board";
  const plannerQueryUserId = !isPreviewMode && normalizedViewer.id ? normalizedViewer.id : "";
  const { weekStart, slots, recommendations, loading: plannerLoading, saveSlots, savePostCreationPauta } = usePlannerData({
    userId: plannerQueryUserId,
    targetSlotsPerWeek: 5,
    periodDays: FUNNEL_HISTORY_LOOKBACK_DAYS,
  });
	  const { toast } = useToast();
	  const [boardView, setBoardView] = useState<PostCreationBoardView>("create");
	  const [recentScripts, setRecentScripts] = useState<FunnelScriptSummaryItem[]>([]);
	  const [funnelState, setFunnelState] = useState<PostCreationFunnelState>(() => createEmptyPostCreationFunnelState());
	  const [trialPautaConsumed, setTrialPautaConsumed] = useState(Boolean(normalizedViewer.postCreationTrial?.pautaUsedAt));
	  const [showLinkGallery, setShowLinkGallery] = useState(false);
  const [isReferenceDrawerOpen, setReferenceDrawerOpen] = useState(false);
  const [selectedReferencePostId, setSelectedReferencePostId] = useState<string | null>(null);
	  const [contentOptions, setContentOptions] = useState<any[]>([]);
  const [contentOptionsLoading, setContentOptionsLoading] = useState(false);
	  const [isScriptsSurfaceReady, setIsScriptsSurfaceReady] = useState(initialFocusStage === "script");
	  const instagramReturnHandledRef = useRef(false);

	  useEffect(() => {
	    if (normalizedViewer.postCreationTrial?.pautaUsedAt) {
	      setTrialPautaConsumed(true);
	    }
	  }, [normalizedViewer.postCreationTrial?.pautaUsedAt]);

	  useEffect(() => {
	    if (instagramReturnHandledRef.current) return;
	    const returnedFromInstagram = searchParams?.get("postCreationConnected") === "1";
	    if (!returnedFromInstagram) return;
	    instagramReturnHandledRef.current = true;
	    toast({
	      variant: "success",
	      title: "Instagram conectado",
	      description: "Você voltou ao board. A análise já pode continuar daqui.",
	    });
	    if (typeof window !== "undefined") {
	      const params = new URLSearchParams(window.location.search);
	      params.delete("instagramLinked");
	      params.delete("postCreationConnected");
	      const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
	      window.history.replaceState({}, "", next);
	    }
	  }, [searchParams, toast]);

	  const requestContinuationGate = useCallback(
	    (source?: string) => {
	      if (isPreviewMode) {
	        onActivatePreview?.();
	        return;
	      }
	      if (isPreSignupViewer) {
	        onRequestAccountGate?.(source);
	        return;
	      }
	      onRequestPaywall?.(source);
	    },
	    [isPreSignupViewer, isPreviewMode, onActivatePreview, onRequestAccountGate, onRequestPaywall]
	  );
	  const gatedSaveLabel = isTrialViewer
	    ? isPreSignupViewer
	      ? "Criar conta para salvar"
	      : "Assinar para salvar"
	    : "Salvar pauta";
	  const gatedResetLabel =
	    isTrialViewer && trialPautaConsumed
	      ? isPreSignupViewer
	        ? "Criar conta para gerar de novo"
	        : "Assinar para gerar de novo"
	      : "Criar nova pauta";
  const handleActivateCollabRadar = useCallback(() => {
    requestContinuationGate("post_creation_collab_radar");
  }, [requestContinuationGate]);
  const fetchContentOptions = useCallback(async () => {
    if (contentOptions.length > 0) return;
    try {
      setContentOptionsLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "40");
      const response = await fetch(`/api/scripts/content-options?${params.toString()}`);
      const payload = await response.json();
      if (response.ok && payload?.ok) {
        setContentOptions(payload.items || []);
      }
    } catch (err) {
      console.error("Failed to load content options", err);
    } finally {
      setContentOptionsLoading(false);
    }
  }, [contentOptions.length]);

  const handleFunnelContentLinked = async (option: any) => {
    setFunnelState((current) => ({
      ...current,
      linkedContent: {
        id: option.id,
        caption: option.caption,
        postDate: option.postDate,
        engagement: option.engagement,
        totalInteractions: option.totalInteractions,
        postLink: option.postLink,
        coverUrl: option.coverUrl,
      },
      stage: "published",
    }));
    setShowLinkGallery(false);

    if (draftId) {
      void fetch(`/api/post-creation/drafts/${encodeURIComponent(draftId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedContentId: option.id, stage: "published" }),
      });
    }

    if (funnelState.scriptId) {
      void fetch(`/api/scripts/${encodeURIComponent(funnelState.scriptId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPosted: true, postedContentId: option.id }),
      });
    }
  };
  const [draftId, setDraftId] = useState<string | null>(null);
  const [hasHydratedDraft, setHasHydratedDraft] = useState(false);
  const [selectedSlotIdState, setSelectedSlotIdState] = useState<string | null>(null);
  const [selectedScriptIdState, setSelectedScriptIdState] = useState<string | null>(null);
  const [isGeneratingBlueprintScript, setIsGeneratingBlueprintScript] = useState(false);
  const [inlineBlueprintScriptDraft, setInlineBlueprintScriptDraft] = useState<BlueprintScriptDraftState | null>(null);
  const [isSavingBlueprintScript, setIsSavingBlueprintScript] = useState(false);
  const [blueprintActionError, setBlueprintActionError] = useState<string | null>(null);
  const [blueprintSaveError, setBlueprintSaveError] = useState<string | null>(null);
  const [preferenceSignals, setPreferenceSignals] = useState<PostCreationPreferenceSignals | null>(null);
  const [advancingPathId, setAdvancingPathId] = useState<string | null>(null);
  const [advancingIdeaId, setAdvancingIdeaId] = useState<string | null>(null);
  const [isSavingIdeaPauta, setIsSavingIdeaPauta] = useState(false);
  const [ideaSaveError, setIdeaSaveError] = useState<string | null>(null);
  const [discardingSavedPautaKey, setDiscardingSavedPautaKey] = useState<string | null>(null);
  const [discardSavedPautaError, setDiscardSavedPautaError] = useState<string | null>(null);
  const [optimisticSavedPautas, setOptimisticSavedPautas] = useState<PlannerUISlot[]>([]);
  const [generatedPautas, setGeneratedPautas] = useState<GeneratedPautaState>({
    status: "idle",
    requestKey: null,
    keyword: null,
    variants: [],
    captions: [],
    source: "fallback",
    error: null,
  });
  const [themeCaptionSignals, setThemeCaptionSignals] = useState<ThemeCaptionSignalsState>({
    status: "idle",
    requestKey: null,
    captions: [],
  });
  const [collabCreators, setCollabCreators] = useState<CollabCreatorsState>({
    status: "idle",
    requestKey: null,
    items: [],
    contextLabel: null,
  });
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    let interval: any;
    if (isGeneratingBlueprintScript) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((s) => (s + 1) % POST_CREATION_LOADING_MESSAGES.length);
      }, 1800);
    }
    return () => clearInterval(interval);
  }, [isGeneratingBlueprintScript]);
  const scriptsSectionRef = useRef<HTMLDivElement | null>(null);
  const stageContentRef = useRef<HTMLDivElement | null>(null);
  const previousStageRef = useRef<PostCreationFunnelStage>(initialFocusStage);
  const draftHydrationRef = useRef(false);
  const skipLatestDraftHydrationRef = useRef(false);
  const hydratedDraftIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<any>(null);
  const autoAdvanceTimerRef = useRef<any>(null);
  const lastSavedSignatureRef = useRef<string>("");
  const hasLocalEditsRef = useRef(false);
  const generatedPautasCacheRef = useRef(
    new Map<string, Omit<GeneratedPautaState, "status" | "requestKey">>()
  );
  const themeCaptionSignalsCacheRef = useRef(new Map<string, string[]>());
  const collabCreatorsCacheRef = useRef(
    new Map<string, Omit<CollabCreatorsState, "status" | "requestKey">>()
  );
  const [stageTransitionDirection, setStageTransitionDirection] = useState<"forward" | "backward">("forward");

  useEffect(() => {
    if (isPreviewMode || !normalizedViewer.id) {
      setRecentScripts(PREVIEW_SCRIPTS as FunnelScriptSummaryItem[]);
      return;
    }

    const controller = new AbortController();
    const loadRecentScripts = async () => {
      try {
        const response = await fetch("/api/scripts?limit=6", { signal: controller.signal });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(payload?.items)) {
          setRecentScripts([]);
          return;
        }
        setRecentScripts(payload.items as FunnelScriptSummaryItem[]);
      } catch {
        if (controller.signal.aborted) return;
        setRecentScripts([]);
      }
    };

    void loadRecentScripts();
    return () => {
      controller.abort();
    };
  }, [isPreviewMode, normalizedViewer.id]);

  useEffect(() => {
    if (isPreviewMode || !normalizedViewer.id) {
      setPreferenceSignals(null);
      return;
    }

    const controller = new AbortController();
    const loadPreferences = async () => {
      try {
        const params = new URLSearchParams();
        params.set("days", "120");
        params.set("targetUserId", normalizedViewer.id);
        const response = await fetch(`/api/post-creation/events/summary?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setPreferenceSignals(null);
          return;
        }
        setPreferenceSignals({
          stepPreferences: payload?.stepPreferences || {},
          stepRules: payload?.stepRules || {},
          lanePreferences: Array.isArray(payload?.lanePreferences) ? payload.lanePreferences : [],
          laneRules: Array.isArray(payload?.laneRules) ? payload.laneRules : [],
          pathPreferences: Array.isArray(payload?.pathPreferences) ? payload.pathPreferences : [],
          pathRules: Array.isArray(payload?.pathRules) ? payload.pathRules : [],
        });
      } catch {
        if (controller.signal.aborted) return;
        setPreferenceSignals(null);
      }
    };

    const idleWindow = window as typeof window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let idleId: number | null = null;
    let timeoutId: number | null = null;

    if (typeof idleWindow.requestIdleCallback === "function") {
      idleId = idleWindow.requestIdleCallback(() => void loadPreferences(), { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(() => void loadPreferences(), 450);
    }

    return () => {
      if (idleId !== null && typeof idleWindow.cancelIdleCallback === "function") {
        idleWindow.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      controller.abort();
    };
  }, [isPreviewMode, normalizedViewer.id]);

  const plannerSlots = useMemo(
    () => (isPreviewMode ? PREVIEW_PLANNER_SLOTS : slots || []),
    [isPreviewMode, slots]
  );
  useEffect(() => {
    if (!plannerSlots.length) return;
    setOptimisticSavedPautas((current) =>
      current.filter((slot) => {
        const match = plannerSlots.find((item) => {
          if (slot.slotId && item.slotId) return slot.slotId === item.slotId;
          return item.dayOfWeek === slot.dayOfWeek && item.blockStartHour === slot.blockStartHour;
        });
        return (
          !match ||
          match.isSaved !== true ||
          match.savedFrom !== POST_CREATION_SAVED_FROM ||
          !hasSavedPautaContent(match)
        );
      })
    );
  }, [plannerSlots]);
  const fallbackRecommendation = useMemo(() => buildFallbackRecommendation(), []);
  const outcomeSignals = useMemo<PostCreationOutcomeSignal[]>(
    () =>
      (isPreviewMode ? (PREVIEW_SCRIPTS as FunnelScriptSummaryItem[]) : recentScripts).map((item) => ({
        slotId: item.plannerRef?.slotId || null,
        title: item.title,
        isPosted: item.publication?.isPosted || false,
        isLinked: item.linkingSummary?.isLinked || false,
        engagement: item.publication?.content?.engagement ?? null,
        totalInteractions: item.publication?.content?.totalInteractions ?? null,
      })),
    [isPreviewMode, recentScripts]
  );
  const decisionEngine = useMemo(
    () =>
      buildPostCreationDecisionEngine(plannerSlots, funnelState.decision, {
        recommendationSlots: isPreviewMode ? PREVIEW_PLANNER_SLOTS.filter((slot) => !slot.isSaved) : recommendations,
        outcomeSignals,
        preferenceSignals: preferenceSignals || undefined,
      }),
    [funnelState.decision, isPreviewMode, outcomeSignals, plannerSlots, preferenceSignals, recommendations]
  );
  const themeCheckpoint = useMemo(
    () => decisionEngine.checkpoints.find((entry) => entry.step === "theme") || null,
    [decisionEngine.checkpoints]
  );
  const selectedThemeOption = useMemo(() => {
    if (!themeCheckpoint) return null;
    return (
      themeCheckpoint.options.find((entry) => entry.id === (funnelState.decision.themeId || themeCheckpoint.selectedId)) ||
      themeCheckpoint.options[0] ||
      null
    );
  }, [funnelState.decision.themeId, themeCheckpoint]);
  const localGeneratedPautaFallback = useMemo(
    () =>
      dedupeGeneratedPautaVariants(
        Array.from(
          decisionEngine.ideaCandidates.reduce((accumulator, candidate) => {
            const title = candidate.variant.title.trim();
            const key = title.toLowerCase();
            if (!key || !title) {
              return accumulator;
            }

            accumulator.set(key, {
              title,
              reason:
                candidate.variant.description?.trim() || "Pauta compatível com o recorte já resolvido no funil.",
            });

            return accumulator;
          }, new Map<string, { title: string; reason: string }>()).values()
        ),
        selectedThemeOption?.label
      ),
    [decisionEngine.ideaCandidates, selectedThemeOption?.label]
  );
  const generatedPautaBaseSlot = useMemo(
    () => decisionEngine.ideaCandidates[0]?.slot || plannerSlots[0] || recommendations[0] || null,
    [decisionEngine.ideaCandidates, plannerSlots, recommendations]
  );
  const resolvedGeneratedPautaDecision = useMemo<PostCreationDecisionState>(
    () => ({
      contextId: funnelState.decision.contextId || decisionEngine.decision.contextId,
      proposalId: funnelState.decision.proposalId || decisionEngine.decision.proposalId,
      toneId: funnelState.decision.toneId || decisionEngine.decision.toneId,
      referenceId: funnelState.decision.referenceId || decisionEngine.decision.referenceId,
      intentId: funnelState.decision.intentId || decisionEngine.decision.intentId,
      formatId: funnelState.decision.formatId || decisionEngine.decision.formatId,
      durationId: funnelState.decision.durationId || decisionEngine.decision.durationId,
      narrativeId: funnelState.decision.narrativeId || decisionEngine.decision.narrativeId,
      dayId: funnelState.decision.dayId || decisionEngine.decision.dayId,
      hourId: funnelState.decision.hourId || decisionEngine.decision.hourId,
      themeId: funnelState.decision.themeId || decisionEngine.decision.themeId,
      pautaId: funnelState.decision.pautaId || decisionEngine.decision.pautaId,
    }),
    [decisionEngine.decision, funnelState.decision]
  );
  const resolvedGeneratedPautaTheme = useMemo(() => {
    const label =
      selectedThemeOption?.label ||
      generatedPautaBaseSlot?.themeKeyword ||
      generatedPautaBaseSlot?.themes?.[0] ||
      (resolvedGeneratedPautaDecision.themeId && resolvedGeneratedPautaDecision.themeId !== "theme"
        ? resolvedGeneratedPautaDecision.themeId
        : null) ||
      generatedPautaBaseSlot?.title ||
      null;
    const normalizedLabel = label?.replace(/\s+/g, " ").trim() || null;

    return {
      id:
        selectedThemeOption?.id ||
        resolvedGeneratedPautaDecision.themeId ||
        (normalizedLabel ? normalizeOptionToken(normalizedLabel) : null),
      label: normalizedLabel,
    };
  }, [
    generatedPautaBaseSlot?.themeKeyword,
    generatedPautaBaseSlot?.themes,
    generatedPautaBaseSlot?.title,
    resolvedGeneratedPautaDecision.themeId,
    selectedThemeOption?.id,
    selectedThemeOption?.label,
  ]);
  const generatedPautaRequestKey = useMemo(() => {
    const requiresDuration = ["reel", "story", "long_video"].includes(resolvedGeneratedPautaDecision.formatId || "");
    const isDurationResolved = !requiresDuration || Boolean(resolvedGeneratedPautaDecision.durationId);
    if (
      !resolvedGeneratedPautaDecision.contextId ||
      !resolvedGeneratedPautaDecision.proposalId ||
      !resolvedGeneratedPautaDecision.formatId ||
      !isDurationResolved ||
      !resolvedGeneratedPautaDecision.dayId ||
      !resolvedGeneratedPautaDecision.hourId ||
      !resolvedGeneratedPautaTheme.id ||
      !resolvedGeneratedPautaTheme.label
    ) {
      return null;
    }

    return [
      POST_CREATION_PAUTA_REQUEST_VERSION,
      resolvedGeneratedPautaDecision.contextId,
      resolvedGeneratedPautaDecision.proposalId,
      resolvedGeneratedPautaDecision.formatId,
      resolvedGeneratedPautaDecision.durationId || "duration",
      resolvedGeneratedPautaDecision.toneId || "tone",
      resolvedGeneratedPautaDecision.referenceId || "reference",
      resolvedGeneratedPautaDecision.intentId || "intent",
      resolvedGeneratedPautaDecision.narrativeId || "narrative",
      resolvedGeneratedPautaDecision.dayId,
      resolvedGeneratedPautaDecision.hourId,
      resolvedGeneratedPautaTheme.id,
      normalizeOptionToken(resolvedGeneratedPautaTheme.label),
    ].join("|");
  }, [
    resolvedGeneratedPautaDecision.contextId,
    resolvedGeneratedPautaDecision.dayId,
    resolvedGeneratedPautaDecision.durationId,
    resolvedGeneratedPautaDecision.formatId,
    resolvedGeneratedPautaDecision.hourId,
    resolvedGeneratedPautaDecision.intentId,
    resolvedGeneratedPautaDecision.narrativeId,
    resolvedGeneratedPautaDecision.proposalId,
    resolvedGeneratedPautaDecision.referenceId,
    resolvedGeneratedPautaDecision.toneId,
    resolvedGeneratedPautaTheme.id,
    resolvedGeneratedPautaTheme.label,
  ]);
  const themeCaptionRequestKey = useMemo(() => {
    const requiresDuration = ["reel", "story", "long_video"].includes(funnelState.decision.formatId || "");
    const isDurationResolved = !requiresDuration || Boolean(funnelState.decision.durationId);

    if (
      !themeCheckpoint ||
      !generatedPautaBaseSlot ||
      !funnelState.decision.contextId ||
      !funnelState.decision.proposalId ||
      !funnelState.decision.formatId ||
      !isDurationResolved ||
      !funnelState.decision.dayId ||
      !funnelState.decision.hourId
    ) {
      return null;
    }

    return [
      funnelState.decision.contextId,
      funnelState.decision.proposalId,
      funnelState.decision.formatId,
      funnelState.decision.durationId || "duration",
      funnelState.decision.toneId || "tone",
      funnelState.decision.referenceId || "reference",
      funnelState.decision.intentId || "intent",
      funnelState.decision.narrativeId || "narrative",
      funnelState.decision.dayId,
      funnelState.decision.hourId,
      "theme-captions",
    ].join("|");
  }, [
    funnelState.decision.contextId,
    funnelState.decision.dayId,
    funnelState.decision.durationId,
    funnelState.decision.formatId,
    funnelState.decision.hourId,
    funnelState.decision.intentId,
    funnelState.decision.proposalId,
    funnelState.decision.narrativeId,
    funnelState.decision.referenceId,
    funnelState.decision.toneId,
    generatedPautaBaseSlot,
    themeCheckpoint,
  ]);

  useEffect(() => {
    if (!themeCaptionRequestKey) {
      setThemeCaptionSignals((current) =>
        current.status === "idle" && current.requestKey === null
          ? current
          : {
              status: "idle",
              requestKey: null,
              captions: [],
            }
      );
      return;
    }

    const cached = themeCaptionSignalsCacheRef.current.get(themeCaptionRequestKey);
    if (cached) {
      setThemeCaptionSignals({
        status: "ready",
        requestKey: themeCaptionRequestKey,
        captions: cached,
      });
      return;
    }

    if (isPreviewMode || !generatedPautaBaseSlot) {
      setThemeCaptionSignals({
        status: "ready",
        requestKey: themeCaptionRequestKey,
        captions: [],
      });
      return;
    }

    const controller = new AbortController();
    setThemeCaptionSignals({
      status: "loading",
      requestKey: themeCaptionRequestKey,
      captions: [],
    });

    const loadThemeCaptions = async () => {
      try {
        const response = await fetch("/api/planner/themes", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dayOfWeek: Number(funnelState.decision.dayId),
            blockStartHour: Number(funnelState.decision.hourId),
            format: funnelState.decision.formatId,
            durationId: funnelState.decision.durationId || undefined,
            categories: {
              ...generatedPautaBaseSlot.categories,
              context: funnelState.decision.contextId ? [funnelState.decision.contextId] : undefined,
              proposal: funnelState.decision.proposalId ? [funnelState.decision.proposalId] : undefined,
              tone: funnelState.decision.toneId || generatedPautaBaseSlot.categories?.tone || undefined,
              reference:
                funnelState.decision.referenceId
                  ? [funnelState.decision.referenceId]
                  : generatedPautaBaseSlot.categories?.reference?.length
                    ? generatedPautaBaseSlot.categories.reference
                    : undefined,
              contentIntent: funnelState.decision.intentId ? [funnelState.decision.intentId] : undefined,
              narrativeForm: funnelState.decision.narrativeId ? [funnelState.decision.narrativeId] : undefined,
            },
            includeCaptions: true,
            periodDays: FUNNEL_HISTORY_LOOKBACK_DAYS,
          }),
        });

        const payload = await response.json().catch(() => null);
        if (controller.signal.aborted) return;

        const captions = Array.isArray(payload?.captions)
          ? (payload.captions as string[]).filter((entry) => typeof entry === "string" && entry.trim())
          : [];

        writeBoundedCache(themeCaptionSignalsCacheRef.current, themeCaptionRequestKey, captions);
        setThemeCaptionSignals({
          status: "ready",
          requestKey: themeCaptionRequestKey,
          captions,
        });
      } catch {
        if (controller.signal.aborted) return;
        setThemeCaptionSignals({
          status: "ready",
          requestKey: themeCaptionRequestKey,
          captions: [],
        });
      }
    };

    void loadThemeCaptions();

    return () => {
      controller.abort();
    };
  }, [
    funnelState.decision.contextId,
    funnelState.decision.dayId,
    funnelState.decision.durationId,
    funnelState.decision.formatId,
    funnelState.decision.hourId,
    funnelState.decision.intentId,
    funnelState.decision.proposalId,
    funnelState.decision.narrativeId,
    funnelState.decision.referenceId,
    funnelState.decision.toneId,
    generatedPautaBaseSlot,
    isPreviewMode,
    themeCaptionRequestKey,
  ]);

  useEffect(() => {
    if (!generatedPautaRequestKey) {
      setGeneratedPautas((current) =>
        current.status === "idle" && current.requestKey === null
          ? current
          : {
              status: "idle",
              requestKey: null,
              keyword: null,
              variants: [],
              captions: [],
              source: "fallback",
              error: null,
            }
      );
      return;
    }

    const cached = generatedPautasCacheRef.current.get(generatedPautaRequestKey);
    if (cached) {
      setGeneratedPautas({
        status: "ready",
        requestKey: generatedPautaRequestKey,
        ...cached,
      });
      return;
    }

    const fallbackThemes = localGeneratedPautaFallback;
    if (isPreviewMode || !generatedPautaBaseSlot) {
      const fallbackState: Omit<GeneratedPautaState, "status" | "requestKey"> = {
        keyword: resolvedGeneratedPautaTheme.label,
        variants: fallbackThemes,
        captions: [],
        source: "fallback",
        error: null,
      };
      writeBoundedCache(generatedPautasCacheRef.current, generatedPautaRequestKey, fallbackState);
      setGeneratedPautas({
        status: "ready",
        requestKey: generatedPautaRequestKey,
        ...fallbackState,
      });
      return;
    }

    const controller = new AbortController();
    setGeneratedPautas({
      status: "loading",
      requestKey: generatedPautaRequestKey,
      keyword: resolvedGeneratedPautaTheme.label,
      variants: [],
      captions: [],
      source: "ai",
      error: null,
    });

    const loadGeneratedPautas = async () => {
      try {
        const requestPayload = {
          dayOfWeek: Number(resolvedGeneratedPautaDecision.dayId),
          blockStartHour: Number(resolvedGeneratedPautaDecision.hourId),
          format: resolvedGeneratedPautaDecision.formatId,
          categories: {
            ...generatedPautaBaseSlot.categories,
            context: resolvedGeneratedPautaDecision.contextId
              ? [resolvedGeneratedPautaDecision.contextId]
              : undefined,
            proposal: resolvedGeneratedPautaDecision.proposalId
              ? [resolvedGeneratedPautaDecision.proposalId]
              : undefined,
            tone: resolvedGeneratedPautaDecision.toneId || generatedPautaBaseSlot.categories?.tone || undefined,
            reference:
              resolvedGeneratedPautaDecision.referenceId
                ? [resolvedGeneratedPautaDecision.referenceId]
                : generatedPautaBaseSlot.categories?.reference?.length
                  ? generatedPautaBaseSlot.categories.reference
                  : undefined,
            contentIntent: resolvedGeneratedPautaDecision.intentId
              ? [resolvedGeneratedPautaDecision.intentId]
              : undefined,
            narrativeForm: resolvedGeneratedPautaDecision.narrativeId
              ? [resolvedGeneratedPautaDecision.narrativeId]
              : undefined,
          },
          themeKeyword: resolvedGeneratedPautaTheme.label || undefined,
          title: resolvedGeneratedPautaTheme.label || undefined,
          count: 5,
          includeCaptions: true,
          periodDays: FUNNEL_HISTORY_LOOKBACK_DAYS,
        };
        logPostCreationDebug("info", "[post-creation/pautas] requesting", {
          requestKey: generatedPautaRequestKey,
          themeKeyword: requestPayload.themeKeyword || null,
          dayOfWeek: requestPayload.dayOfWeek,
          blockStartHour: requestPayload.blockStartHour,
          format: requestPayload.format || null,
          contextId: requestPayload.categories.context?.[0] || null,
          proposalId: requestPayload.categories.proposal?.[0] || null,
          toneId: requestPayload.categories.tone || null,
        });

        const response = await fetch("/api/planner/pautas", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestPayload),
        });

        const payload = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok && payload?.reason === "post_creation_trial_pauta_used") {
          setTrialPautaConsumed(true);
          requestContinuationGate("post_creation_trial_second_pauta");
          setGeneratedPautas({
            status: "error",
            requestKey: generatedPautaRequestKey,
            keyword: resolvedGeneratedPautaTheme.label,
            variants: [],
            captions: [],
            source: "ai",
            error: payload?.error || "Você já usou a pauta gratuita deste teste.",
          });
          return;
        }
        if (payload?.postCreationTrial?.pautaUsedAt) {
          setTrialPautaConsumed(true);
        }

        const fetchedVariants = Array.isArray(payload?.pautas)
          ? dedupeGeneratedPautaVariants(
              (payload.pautas as Array<{ title?: string; reason?: string }>)
                .map((entry) => ({
                  title: typeof entry?.title === "string" ? entry.title.trim() : "",
                  reason: typeof entry?.reason === "string" ? entry.reason.trim() : "",
                }))
                .filter((entry) => entry.title),
              resolvedGeneratedPautaTheme.label
            )
          : [];
        console.log("[Funnel] Deduped fetchedVariants count:", fetchedVariants.length);

        if (!response.ok || !payload?.ok || payload?.source !== "ai" || fetchedVariants.length < 5) {
          throw new Error(
            typeof payload?.error === "string" && payload.error.trim()
              ? payload.error
              : "Não foi possível gerar 5 pautas com IA para este recorte."
          );
        }

        const nextState: Omit<GeneratedPautaState, "status" | "requestKey"> = {
          keyword:
            (typeof payload?.keyword === "string" && payload.keyword.trim()) ||
            resolvedGeneratedPautaTheme.label ||
            null,
          variants: fetchedVariants,
          captions: Array.isArray(payload?.captions)
            ? (payload.captions as string[]).filter((entry) => typeof entry === "string" && entry.trim())
            : [],
          source: "ai",
          error: null,
        };
        logPostCreationDebug("info", "[post-creation/pautas] resolved", {
          requestKey: generatedPautaRequestKey,
          ok: response.ok,
          payloadOk: Boolean(payload?.ok),
          payloadSource: typeof payload?.source === "string" ? payload.source : null,
          variantCount: fetchedVariants.length,
          captionCount: nextState.captions.length,
          resolvedSource: nextState.source,
          keyword: nextState.keyword,
        });

        writeBoundedCache(generatedPautasCacheRef.current, generatedPautaRequestKey, nextState);
        setGeneratedPautas({
          status: "ready",
          requestKey: generatedPautaRequestKey,
          ...nextState,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        logPostCreationDebug("warn", "[post-creation/pautas] request failed", {
          requestKey: generatedPautaRequestKey,
          themeKeyword: resolvedGeneratedPautaTheme.label,
          message: error instanceof Error ? error.message : String(error),
        });
        const fallbackState: Omit<GeneratedPautaState, "status" | "requestKey"> = {
          keyword: resolvedGeneratedPautaTheme.label,
          variants: [],
          captions: [],
          source: "ai",
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível gerar 5 pautas com IA para este recorte.",
        };
        setGeneratedPautas({
          status: "error",
          requestKey: generatedPautaRequestKey,
          ...fallbackState,
        });
      }
    };

    void loadGeneratedPautas();

    return () => {
      controller.abort();
    };
  }, [
    generatedPautaBaseSlot,
    generatedPautaRequestKey,
    isPreviewMode,
    localGeneratedPautaFallback,
    requestContinuationGate,
    resolvedGeneratedPautaDecision.contextId,
    resolvedGeneratedPautaDecision.dayId,
    resolvedGeneratedPautaDecision.formatId,
    resolvedGeneratedPautaDecision.hourId,
    resolvedGeneratedPautaDecision.intentId,
    resolvedGeneratedPautaDecision.narrativeId,
    resolvedGeneratedPautaDecision.proposalId,
    resolvedGeneratedPautaDecision.referenceId,
    resolvedGeneratedPautaDecision.toneId,
    resolvedGeneratedPautaTheme.label,
  ]);

  const generatedPautaCandidates = useMemo(() => {
    if (
      generatedPautas.status !== "ready" ||
      !generatedPautaRequestKey ||
      !generatedPautas.variants.length ||
      !generatedPautaBaseSlot
    ) {
      return [] as PostCreationIdeaCandidate[];
    }

    const distinctVariants = dedupeGeneratedPautaVariants(generatedPautas.variants, generatedPautas.keyword);

    return distinctVariants.map((pauta, index) =>
      buildGeneratedPautaCandidate({
        baseSlot: generatedPautaBaseSlot,
        pautaTitle: pauta.title,
        pautaReason: pauta.reason,
        keyword: generatedPautas.keyword,
        themes: distinctVariants.map((entry) => entry.title),
        index,
        decision: {
          ...funnelState.decision,
          pautaId: buildGeneratedPautaId(pauta.title, index),
        },
        outcomeSignals,
      })
    );
  }, [
    funnelState.decision,
    generatedPautaBaseSlot,
    generatedPautaRequestKey,
    generatedPautas,
    outcomeSignals,
  ]);
  const ideaCandidates =
    generatedPautaCandidates.length > 0 ? generatedPautaCandidates : decisionEngine.ideaCandidates;
  const decisionPathCards = useMemo<DecisionPathCard[]>(() => {
    if (!decisionEngine.checkpoints.length) {
      return fallbackRecommendation.path.map((item) => ({
        id: item.id,
        label: item.label,
        value: item.value,
        reason: item.reason,
        selectedId: item.value,
        options: [
          {
            id: item.value,
            label: item.value,
            recommended: true,
            reason: item.reason,
            confidence: null,
            sourceSignals: [],
            expectedInteractionsAvg: (item as any).expectedInteractionsAvg || 800,
            evidencePosts: [],
            evidenceCount: 0,
          },
        ],
      }));
    }

    return decisionEngine.checkpoints.map((checkpoint) => {
      const generatedOptions =
        checkpoint.step === "pauta" &&
        generatedPautas.status === "ready" &&
        generatedPautaCandidates.length > 0
          ? generatedPautaCandidates.map((candidate, index) => ({
              id: candidate.variant.id,
              label: candidate.variant.title,
              recommended: index === 0,
              reason: candidate.variant.description || "Pauta alinhada ao recorte escolhido no funil.",
              confidence: candidate.variant.confidence ?? null,
              sourceSignals:
                generatedPautas.source === "ai"
                  ? ["Gerado por IA com tema + categorias"]
                  : ["Fallback baseado no histórico recente"],
              expectedInteractionsAvg: candidate.variant.expectedInteractionsAvg ?? null,
              evidencePosts: candidate.slot.evidencePosts || [],
              evidenceCount: candidate.slot.evidenceCount || candidate.slot.evidencePosts?.length || 0,
            }))
          : null;
      const options =
        checkpoint.step === "pauta"
          ? generatedOptions || []
          : checkpoint.options.map((option) => ({
              id: option.id,
              label: option.label,
              recommended: option.recommended,
              reason:
                checkpoint.step === "theme"
                  ? buildThemeCaptionClue(option.label, themeCaptionSignals.captions) || option.shortReason
                  : option.shortReason,
              confidence: option.confidence ?? null,
              sourceSignals: option.sourceSignals || [],
              expectedInteractionsAvg: option.expectedInteractionsAvg ?? null,
              evidencePosts: option.evidencePosts || [],
              evidenceCount: option.evidenceCount ?? option.evidencePosts?.length ?? 0,
            }));
      const selectedOption =
        options.find((option) =>
          option.id ===
          (checkpoint.step === "pauta" ? funnelState.decision.pautaId || checkpoint.selectedId : checkpoint.selectedId)
        ) ||
        options[0] ||
        null;
      return {
        id: checkpoint.step,
        label: checkpoint.label,
        value: selectedOption?.label || checkpoint.label,
        reason: selectedOption?.reason || "Ajuste esse checkpoint para recalcular o melhor caminho.",
        selectedId: checkpoint.step === "pauta" ? funnelState.decision.pautaId : checkpoint.selectedId,
        options,
      };
    });
  }, [
    decisionEngine.checkpoints,
    fallbackRecommendation.path,
    funnelState.decision.pautaId,
    generatedPautaCandidates,
    generatedPautas.source,
    generatedPautas.status,
    themeCaptionSignals.captions,
  ]);
  const visibleDecisionSteps = useMemo(
    () => decisionPathCards.map((item) => item.id as PostCreationDecisionStep),
    [decisionPathCards]
  );
  const activeDecisionStepForUi = useMemo<PostCreationDecisionStep | null>(() => {
    if (!decisionPathCards.length) return funnelState.activeDecisionStep;
    return resolveActiveDecisionStep(funnelState.decision, visibleDecisionSteps, funnelState.activeDecisionStep);
  }, [decisionPathCards, funnelState.activeDecisionStep, funnelState.decision, visibleDecisionSteps]);
  const activeDecisionCard = useMemo(
    () => decisionPathCards.find((item) => item.id === activeDecisionStepForUi) || decisionPathCards[0] || null,
    [activeDecisionStepForUi, decisionPathCards]
  );
  const preferredIdeaCandidate = useMemo(() => {
    const preferredId = funnelState.idea?.id || funnelState.decision.pautaId;
    if (preferredId) {
      const matched = ideaCandidates.find(
        (candidate) =>
          candidate.variant.id === preferredId ||
          (candidate.slot.slotId && candidate.slot.slotId === preferredId)
      );
      if (matched) return matched;
    }
    return ideaCandidates[0] || null;
  }, [funnelState.decision.pautaId, funnelState.idea?.id, ideaCandidates]);
  const fallbackSelectedIdeaCandidate = useMemo(() => {
    if (preferredIdeaCandidate || !generatedPautaBaseSlot) {
      return null;
    }

    const pautaCard = decisionPathCards.find((item) => item.id === "pauta") || null;
    const selectedPautaId = funnelState.decision.pautaId || pautaCard?.selectedId || null;
    const selectedPautaOption =
      pautaCard?.options.find((option) => option.id === selectedPautaId) || pautaCard?.options[0] || null;

    if (!selectedPautaOption) {
      return null;
    }

    return buildGeneratedPautaCandidate({
      baseSlot: generatedPautaBaseSlot,
      pautaTitle: selectedPautaOption.label,
      pautaReason: selectedPautaOption.reason,
      keyword: generatedPautas.keyword || resolvedGeneratedPautaTheme.label,
      themes: pautaCard?.options.map((option) => option.label) || [selectedPautaOption.label],
      index: 0,
      decision: {
        ...funnelState.decision,
        pautaId: selectedPautaOption.id,
      },
      outcomeSignals,
    });
  }, [
    decisionPathCards,
    funnelState.decision,
    generatedPautaBaseSlot,
    generatedPautas.keyword,
    outcomeSignals,
    preferredIdeaCandidate,
    resolvedGeneratedPautaTheme.label,
  ]);
  const selectedIdeaCandidate = preferredIdeaCandidate || fallbackSelectedIdeaCandidate;
  const inlineFallbackIdeaForProjection = useMemo(() => {
    if (funnelState.stage !== "idea") return null;
    const pautaId = funnelState.decision.pautaId || "default";
    const pautaCard = decisionPathCards.find((c) => c.id === "pauta");
    const option = pautaCard?.options.find((o) => o.id === pautaId) || pautaCard?.options[0];
    return {
      id: pautaId,
      title: option?.label || "Pauta validada",
      description: option?.reason || "",
      format: (funnelState.decision.formatId as any) || "feed",
      expectedInteractionsAvg: option?.expectedInteractionsAvg || 500,
    };
  }, [decisionPathCards, funnelState.decision.formatId, funnelState.decision.pautaId, funnelState.stage]);
  const selectedIdeaForProjection =
    funnelState.idea || selectedIdeaCandidate?.variant || ideaCandidates[0]?.variant || inlineFallbackIdeaForProjection || null;
  const selectedSlotId = searchParams?.get("slotId")?.trim() || null;
  const selectedScriptId = searchParams?.get("scriptId")?.trim() || funnelState.scriptId || null;
  const selectedDraftId = searchParams?.get("draftId")?.trim() || null;
  const requestedBoardView = searchParams?.get("view") === "saved" ? "saved" : "create";
  const resolvedSelectedSlotId =
    selectedSlotIdState ||
    selectedSlotId ||
    (funnelState.idea?.source === "saved_idea" ? funnelState.idea.id : null) ||
    null;
  const resolvedSelectedScriptId = selectedScriptIdState || selectedScriptId || funnelState.scriptId || null;
  const savedLibrarySlots = useMemo(() => {
    const merged = new Map<string, PlannerUISlot>();
    plannerSlots.forEach((slot) => {
      if (slot.isSaved !== true) return;
      if (slot.savedFrom !== POST_CREATION_SAVED_FROM) return;
      const key = getPlannerSlotLibraryKey(slot);
      merged.set(key, slot);
    });
    optimisticSavedPautas.forEach((slot) => {
      if (slot.isSaved !== true) return;
      if (slot.savedFrom !== POST_CREATION_SAVED_FROM) return;
      const key = getPlannerSlotLibraryKey(slot);
      merged.set(key, mergeSavedPautaSlot(merged.get(key), slot));
    });
    return Array.from(merged.values());
  }, [optimisticSavedPautas, plannerSlots]);
  const savedPautaEntries = useMemo(
    () =>
      savedLibrarySlots
        .filter((slot) => {
          if (slot.isSaved !== true) return false;
          if (slot.savedFrom !== POST_CREATION_SAVED_FROM) return false;
          return hasSavedPautaContent(slot);
        })
        .map((slot) => {
          const projection = estimatePlannerSlotInteractions(slot, outcomeSignals);
          return {
            id: slot.slotId || `${slot.dayOfWeek}-${slot.blockStartHour}-${normalizeOptionToken(slot.title || slot.themeKeyword || "pauta")}`,
            slot,
            title: slot.title || slot.scriptShort || slot.themeKeyword || "Pauta salva",
            projection,
            primaryActionLabel: "Abrir pauta",
            themeLabel: slot.themeKeyword || slot.themes?.[0] || null,
            windowLabel: `${getDayLabel(slot.dayOfWeek)}, ${getBlockLabel(slot.blockStartHour)}`,
            contextLabel: slot.categories?.context?.[0]
              ? formatCategoryLabel(slot.categories.context[0], "context")
              : null,
            proposalLabel: slot.categories?.proposal?.[0]
              ? formatCategoryLabel(slot.categories.proposal[0], "proposal")
              : null,
            formatLabel: formatPlannerFormatLabel(slot.format),
          };
        })
        .sort((left, right) => {
          const leftSelected = left.slot.slotId && left.slot.slotId === resolvedSelectedSlotId ? 1 : 0;
          const rightSelected = right.slot.slotId && right.slot.slotId === resolvedSelectedSlotId ? 1 : 0;
          if (leftSelected !== rightSelected) return rightSelected - leftSelected;
          const projectionDelta = (right.projection || 0) - (left.projection || 0);
          if (projectionDelta !== 0) return projectionDelta;
          if (left.slot.dayOfWeek !== right.slot.dayOfWeek) {
            return left.slot.dayOfWeek - right.slot.dayOfWeek;
          }
          return left.slot.blockStartHour - right.slot.blockStartHour;
        }),
    [outcomeSignals, resolvedSelectedSlotId, savedLibrarySlots]
  );

  const updateSelectionParams = useCallback(
    (updates: {
      slotId?: string | null;
      scriptId?: string | null;
      draftId?: string | null;
      view?: PostCreationBoardView | null;
    }, options?: { history?: "push" | "replace" }) => {
      const currentQuery =
        typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : searchParams?.toString() || "";
      const params = new URLSearchParams(currentQuery);

      if (updates.slotId === null) {
        params.delete("slotId");
      } else if (typeof updates.slotId === "string" && updates.slotId.trim()) {
        params.set("slotId", updates.slotId.trim());
      }

      if (updates.scriptId === null) {
        params.delete("scriptId");
      } else if (typeof updates.scriptId === "string" && updates.scriptId.trim()) {
        params.set("scriptId", updates.scriptId.trim());
      }

      if (updates.draftId === null) {
        params.delete("draftId");
      } else if (typeof updates.draftId === "string" && updates.draftId.trim()) {
        params.set("draftId", updates.draftId.trim());
      }

      if (Object.prototype.hasOwnProperty.call(updates, "view")) {
        if (updates.view === "saved") {
          params.set("view", "saved");
        } else {
          params.delete("view");
        }
      }

      const nextQuery = params.toString();
      if (nextQuery === currentQuery) {
        return;
      }
      const navigate = options?.history === "push" ? router.push : router.replace;
      startTransition(() => {
        navigate(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  const draftHydrationTarget = useMemo(() => {
    if (selectedDraftId) {
      return `draft:${selectedDraftId}`;
    }
    return "none";
  }, [selectedDraftId]);

  useEffect(() => {
    startTransition(() => {
      setBoardView((current) => (current === requestedBoardView ? current : requestedBoardView));
    });
  }, [requestedBoardView]);

  useEffect(() => {
    if (isPreviewMode || !normalizedViewer.id) {
      setHasHydratedDraft(true);
      setDraftId(null);
      hydratedDraftIdRef.current = null;
      return;
    }

    if (draftHydrationTarget === "none" || !selectedDraftId) {
      setHasHydratedDraft(true);
      return;
    }
    if (selectedDraftId && hydratedDraftIdRef.current === selectedDraftId && draftId === selectedDraftId) {
      setHasHydratedDraft(true);
      return;
    }

    const controller = new AbortController();
    const endpoint = `/api/post-creation/drafts/${encodeURIComponent(selectedDraftId)}`;

    const loadDraft = async () => {
      try {
        const response = await fetch(endpoint, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setHasHydratedDraft(true);
          return;
        }

        const item = payload?.item as PersistedPostCreationDraft | null | undefined;
        if (!item?.id) {
          setHasHydratedDraft(true);
          return;
        }

        if (controller.signal.aborted || hasLocalEditsRef.current) {
          setHasHydratedDraft(true);
          return;
        }

        const normalizedState = normalizeLoadedFunnelState(item.state);
        const nextPayload = buildDraftPayload({
          state: normalizedState,
          selectedSlotId: item.selectedSlotId || null,
          selectedScriptId: item.selectedScriptId || normalizedState.scriptId || null,
        });
        draftHydrationRef.current = true;
        hydratedDraftIdRef.current = item.id;
        lastSavedSignatureRef.current = buildDraftSignature(nextPayload);
        hasLocalEditsRef.current = false;
        setDraftId(item.id);
        setSelectedSlotIdState(item.selectedSlotId || null);
        setSelectedScriptIdState(item.selectedScriptId || normalizedState.scriptId || null);
        setFunnelState(normalizedState);
        updateSelectionParams({
          draftId: item.id,
          slotId: item.selectedSlotId || null,
          scriptId: item.selectedScriptId || normalizedState.scriptId || null,
        });
      } catch {
        if (controller.signal.aborted) return;
      } finally {
        draftHydrationRef.current = false;
        setHasHydratedDraft(true);
      }
    };

    void loadDraft();

    return () => {
      controller.abort();
    };
  }, [draftHydrationTarget, draftId, isPreviewMode, normalizedViewer.id, selectedDraftId, updateSelectionParams]);

  useEffect(() => {
    if (!decisionEngine.checkpoints.length) return;
    setFunnelState((current) => {
      if (isMeaningfulFunnelState(current)) {
        return current;
      }
      if (current.activeDecisionStep) {
        return current;
      }
      const next: PostCreationFunnelState = {
        ...current,
        decision: decisionEngine.decision,
        stage: resolveNextFunnelStage({
          ...current,
          decision: decisionEngine.decision,
        }),
      };
      return next;
    });
  }, [decisionEngine]);

  useEffect(() => {
    if (!visibleDecisionSteps.length) return;
    setFunnelState((current) => reconcilePostCreationPathState(current, visibleDecisionSteps));
  }, [funnelState.activeDecisionStep, funnelState.decision, funnelState.stage, visibleDecisionSteps]);

  const activeStage = funnelState.stage || initialFocusStage;
  const activeStageLegacySurface = activeStage as PostCreationFunnelStage;
  const usesCompactStageSurface = activeStage === "path" || activeStage === "idea";
  const isRestoringSlotSelection =
    boardView === "create" &&
    !isPreviewMode &&
    Boolean(selectedSlotId) &&
    plannerLoading &&
    !plannerSlots.some((slot) => slot.slotId === selectedSlotId);
  const isRestoringDraft =
    isRestoringSlotSelection ||
    (boardView === "create" &&
      !hasHydratedDraft &&
      !isPreviewMode &&
      Boolean(normalizedViewer.id) &&
      draftHydrationTarget !== "none");
  const activeStageIndex = POST_CREATION_FUNNEL_STAGE_ORDER.indexOf(activeStage);
  const stageTransitionClass =
    stageTransitionDirection === "backward"
      ? "funnel-stage-transition funnel-stage-transition-backward"
      : "funnel-stage-transition funnel-stage-transition-forward";
  const activeBlueprint = useMemo(
    () =>
      funnelState.blueprint ||
      (selectedIdeaCandidate
        ? buildBlueprintFromPlannerSlot(selectedIdeaCandidate.slot, {
            titleOverride:
              selectedIdeaCandidate.variant.source === "ai_idea"
                ? selectedIdeaCandidate.variant.title
                : null,
          })
        : null),
    [funnelState.blueprint, selectedIdeaCandidate]
  );
  const hookVariations = useMemo(
    () => (activeBlueprint ? buildHookVariations(activeBlueprint) : []),
    [activeBlueprint]
  );
  const activeBlueprintSlot = useMemo(() => {
    if (selectedIdeaCandidate?.slot) return selectedIdeaCandidate.slot;
    if (resolvedSelectedSlotId) {
      return plannerSlots.find((slot) => slot.slotId === resolvedSelectedSlotId) || null;
    }
    return null;
  }, [plannerSlots, resolvedSelectedSlotId, selectedIdeaCandidate]);
  const activePublishedLabel = funnelState.linkedContent?.id
    ? funnelState.linkedContent.caption?.trim()
      ? truncateText(funnelState.linkedContent.caption, 72)
      : `Conteúdo vinculado: ${funnelState.linkedContent.id}`
    : "Nenhum conteúdo vinculado ainda";
  const linkedContentDateLabel = formatCompactDate(funnelState.linkedContent?.postDate);
  const linkedContentInteractionsLabel = formatCompactNumber(funnelState.linkedContent?.totalInteractions);
  const linkedContentEngagementLabel =
    typeof funnelState.linkedContent?.engagement === "number" && Number.isFinite(funnelState.linkedContent.engagement)
      ? funnelState.linkedContent.engagement.toFixed(2)
      : null;
  const linkedBlueprintScript = useMemo(() => {
    if (!activeBlueprintSlot?.slotId?.trim()) return null;
    if (funnelState.scriptId) {
      return recentScripts.find((item) => item.id === funnelState.scriptId) || null;
    }
    if (
      funnelState.blueprintScriptStatus !== "generated" &&
      funnelState.blueprintScriptStatus !== "linked" &&
      funnelState.blueprintScriptStatus !== "published"
    ) {
      return null;
    }
    const slotId = activeBlueprintSlot?.slotId?.trim();
    return recentScripts.find((item) => item.plannerRef?.slotId?.trim() === slotId) || null;
  }, [activeBlueprintSlot?.slotId, funnelState.blueprintScriptStatus, funnelState.scriptId, recentScripts]);
  const hasInlineBlueprintScriptDraft = Boolean(inlineBlueprintScriptDraft?.content.trim());
  const blueprintPrimaryActionLabel = linkedBlueprintScript?.id
    ? hasInlineBlueprintScriptDraft
      ? "Roteiro salvo"
      : "Gerar nova versão"
    : hasInlineBlueprintScriptDraft
      ? "Regenerar rascunho"
      : "Criar roteiro com IA";
  const blueprintScriptSupportCopy = isGeneratingBlueprintScript
    ? POST_CREATION_LOADING_MESSAGES[loadingStep]
    : linkedBlueprintScript?.id
      ? hasInlineBlueprintScriptDraft
        ? "O roteiro já está salvo e continua editável aqui."
        : "Este slot já tem um roteiro salvo. Se quiser, gere uma nova versão aqui mesmo."
      : hasInlineBlueprintScriptDraft
        ? "A IA abriu um primeiro rascunho para você revisar antes de salvar."
        : "Gere o roteiro aqui e revise sem sair do funnel.";
  const blueprintInlineDraftSaved = Boolean(linkedBlueprintScript?.id && hasInlineBlueprintScriptDraft);

  useEffect(() => {
    setInlineBlueprintScriptDraft(null);
    setBlueprintActionError(null);
    setBlueprintSaveError(null);
  }, [activeBlueprint?.whatToPost, activeBlueprintSlot?.slotId]);

  useEffect(() => {
    setIdeaSaveError(null);
  }, [funnelState.decision.pautaId]);

  useEffect(() => {
    const validSceneIds = new Set((activeBlueprint?.scenes || []).map((scene) => scene.id));
    const validHookIds = new Set(hookVariations.map((item) => item.id));

    setFunnelState((current) => {
      const nextSceneIds = current.blueprintChecklist.sceneIds.filter((id) => validSceneIds.has(id));
      const nextHookIds = current.blueprintChecklist.hookIds.filter((id) => validHookIds.has(id));
      if (
        nextSceneIds.length === current.blueprintChecklist.sceneIds.length &&
        nextHookIds.length === current.blueprintChecklist.hookIds.length
      ) {
        return current;
      }
      return {
        ...current,
        blueprintChecklist: {
          sceneIds: nextSceneIds,
          hookIds: nextHookIds,
        },
      };
    });
  }, [activeBlueprint?.scenes, hookVariations]);

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setAdvancingPathId(null);
    setAdvancingIdeaId(null);
  }, []);
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        window.clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };
  }, []);

  const trackFunnelEvent = useCallback(
    (
      name:
        | "post_creation_checkpoint_selected"
        | "post_creation_idea_selected"
        | "post_creation_blueprint_activated"
        | "post_creation_blueprint_adjusted"
        | "post_creation_blueprint_script_opened"
        | "post_creation_blueprint_script_started"
        | "post_creation_blueprint_script_succeeded"
        | "post_creation_blueprint_script_failed"
        | "post_creation_slot_saved"
        | "post_creation_script_opened"
        | "post_creation_script_saved"
        | "post_creation_content_linked"
        | "post_creation_published_step_reopened"
        | "post_creation_saved_pauta_discarded",
      payload: Record<string, unknown>
    ) => {
      if (isPreviewMode) return;
      track(name, {
        creator_id: normalizedViewer.id || null,
        draft_id: draftId || null,
        ...payload,
      } as any);
      void fetch("/api/post-creation/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        keepalive: true,
        body: JSON.stringify({
          eventName: name,
          stage:
            (typeof payload.stage_after === "string" && payload.stage_after) ||
            (typeof payload.stage === "string" && payload.stage) ||
            funnelState.stage,
          step: typeof payload.step === "string" ? payload.step : null,
          draftId: draftId || null,
          slotId:
            (typeof payload.slot_id === "string" && payload.slot_id) ||
            activeBlueprintSlot?.slotId ||
            resolvedSelectedSlotId ||
            null,
          scriptId:
            (typeof payload.script_id === "string" && payload.script_id) ||
            resolvedSelectedScriptId ||
            funnelState.scriptId ||
            null,
          ideaId:
            (typeof payload.idea_id === "string" && payload.idea_id) ||
            funnelState.idea?.id ||
            null,
          contentId:
            (typeof payload.content_id === "string" && payload.content_id) ||
            funnelState.linkedContent?.id ||
            null,
          source: typeof payload.source === "string" ? payload.source : null,
          lane: typeof payload.lane === "string" ? payload.lane : null,
          scriptStatus: typeof payload.script_status === "string" ? payload.script_status : null,
          recommendedSelected:
            typeof payload.recommended_selected === "boolean" ? payload.recommended_selected : null,
          confidence: typeof payload.confidence === "number" ? payload.confidence : null,
          metadata: payload,
          targetUserId: normalizedViewer.id || "",
        }),
      }).catch(() => undefined);
    },
    [
      activeBlueprintSlot?.slotId,
      draftId,
      funnelState.idea?.id,
      funnelState.linkedContent?.id,
      funnelState.scriptId,
      funnelState.stage,
      isPreviewMode,
      normalizedViewer.id,
      resolvedSelectedScriptId,
      resolvedSelectedSlotId,
    ]
  );

  const handleDecisionOptionSelect = useCallback((step: PostCreationDecisionStep, optionId: string) => {
    const checkpoint = decisionEngine.checkpoints.find((entry) => entry.step === step) || null;
    const option = checkpoint?.options.find((entry) => entry.id === optionId) || null;

    clearAutoAdvanceTimer();
    setAdvancingPathId(`${step}-${optionId}`);

    autoAdvanceTimerRef.current = window.setTimeout(() => {
      autoAdvanceTimerRef.current = null;
      startTransition(() => {
        hasLocalEditsRef.current = true;
        skipLatestDraftHydrationRef.current = true;
        setSelectedSlotIdState(null);
        setSelectedScriptIdState(null);
        updateSelectionParams({
          slotId: null,
          scriptId: null,
          draftId,
        });
        setFunnelState((current) => {
          const nextDecision = clearDecisionStepsAfter(
            setDecisionStepValue(current.decision, step, optionId),
            step
          );

          const isPathComplete = areVisibleDecisionStepsComplete(
            nextDecision,
            visibleDecisionSteps
          );

          const next: PostCreationFunnelState = {
            ...current,
            activeDecisionStep: null,
            blueprintScriptStatus: "idle",
            decision: nextDecision,
            idea: null,
            blueprint: null,
            blueprintChecklist: {
              sceneIds: [],
              hookIds: [],
            },
            scriptId: null,
            linkedContent: null,
          };
          return {
            ...next,
            stage: isPathComplete ? "idea" : resolveNextFunnelStage(next),
          };
        });
      });
      trackFunnelEvent("post_creation_checkpoint_selected", {
        step,
        option_id: optionId,
        option_label: option?.label || optionId,
        recommended_selected: option?.recommended || false,
        stage_before: funnelState.stage,
        stage_after: "path",
      });
      setAdvancingPathId(null);
    }, PATH_AUTONAV_DELAY_MS);
  }, [clearAutoAdvanceTimer, decisionEngine.checkpoints, draftId, funnelState.stage, trackFunnelEvent, updateSelectionParams, visibleDecisionSteps]);

  const handleIdeaSelection = useCallback((candidateId: string) => {
    const candidate =
      ideaCandidates.find((entry) => entry.variant.id === candidateId) ||
      (selectedIdeaCandidate?.variant.id === candidateId ? selectedIdeaCandidate : null);
    if (!candidate) return;

    clearAutoAdvanceTimer();
    setAdvancingIdeaId(candidateId);

    autoAdvanceTimerRef.current = window.setTimeout(() => {
      autoAdvanceTimerRef.current = null;
      startTransition(() => {
        hasLocalEditsRef.current = true;
        skipLatestDraftHydrationRef.current = true;
        setSelectedSlotIdState(candidate.slot.slotId || null);
        setSelectedScriptIdState(null);
        updateSelectionParams({
          slotId: candidate.slot.slotId || null,
          scriptId: null,
          draftId,
        });
        setFunnelState((current) => {
          const next: PostCreationFunnelState = {
            ...current,
            decision: candidate.decision,
            activeDecisionStep: null,
            idea: candidate.variant,
            blueprint: buildBlueprintFromPlannerSlot(candidate.slot, {
              titleOverride: candidate.variant.source === "ai_idea" ? candidate.variant.title : null,
            }),
            blueprintChecklist: {
              sceneIds: [],
              hookIds: [],
            },
            scriptId: null,
            linkedContent: null,
            blueprintScriptStatus: "ready",
            stage: "blueprint",
          };
          return next;
        });
      });
      trackFunnelEvent("post_creation_idea_selected", {
        idea_id: candidate.variant.id,
        lane: candidate.variant.lane,
        source: candidate.variant.source,
        confidence: candidate.variant.confidence ?? null,
        evidence_count: candidate.variant.evidence?.length ?? 0,
        path_key: [
          candidate.decision.contextId || "context",
          candidate.decision.proposalId || "proposal",
          candidate.decision.toneId || "tone",
          candidate.decision.referenceId || "reference",
          candidate.decision.intentId || "intent",
          candidate.decision.formatId || "format",
          candidate.decision.durationId || "duration",
          candidate.decision.narrativeId || "narrative",
          candidate.decision.dayId || "day",
          candidate.decision.hourId || "hour",
          candidate.decision.themeId || "theme",
        ].join("|"),
        day_id: candidate.decision.dayId || null,
        hour_id: candidate.decision.hourId || null,
        proposal_id: candidate.decision.proposalId || null,
        context_id: candidate.decision.contextId || null,
        tone_id: candidate.decision.toneId || null,
        reference_id: candidate.decision.referenceId || null,
        intent_id: candidate.decision.intentId || null,
        theme_id: candidate.decision.themeId || null,
        format_id: candidate.decision.formatId || null,
        narrative_id: candidate.decision.narrativeId || null,
        recommended_selected: ideaCandidates[0]?.variant.id === candidate.variant.id,
        stage_before: funnelState.stage,
        stage_after: "blueprint",
      });
      setAdvancingIdeaId(null);
    }, IDEA_AUTONAV_DELAY_MS);
  }, [clearAutoAdvanceTimer, draftId, funnelState.stage, ideaCandidates, selectedIdeaCandidate, trackFunnelEvent, updateSelectionParams]);

  const handleActiveDecisionOptionSelect = useCallback(
    (optionId: string) => {
      if (!activeDecisionCard) return;
      handleDecisionOptionSelect(activeDecisionCard.id as PostCreationDecisionStep, optionId);
    },
    [activeDecisionCard, handleDecisionOptionSelect]
  );

  const handleFunnelSlotSaved = useCallback((slot: PlannerUISlot) => {
    clearAutoAdvanceTimer();
    hasLocalEditsRef.current = true;
    skipLatestDraftHydrationRef.current = true;
    setBoardView("saved");
    setSelectedSlotIdState(slot.slotId || null);
    updateSelectionParams(
      {
        slotId: slot.slotId || null,
        scriptId: funnelState.scriptId || null,
        draftId,
        view: "saved",
      },
      { history: "push" }
    );
    setFunnelState((current) => {
      const persistedDecision = buildDecisionFromPlannerSlot(slot);
      const next: PostCreationFunnelState = {
        ...current,
        decision: {
          ...persistedDecision,
          pautaId: current.decision.pautaId || persistedDecision.pautaId,
          themeId: current.decision.themeId || persistedDecision.themeId,
          durationId: current.decision.durationId || persistedDecision.durationId,
          toneId: current.decision.toneId || persistedDecision.toneId,
          referenceId: current.decision.referenceId || persistedDecision.referenceId,
          intentId: current.decision.intentId || persistedDecision.intentId,
          narrativeId: current.decision.narrativeId || persistedDecision.narrativeId,
        },
        activeDecisionStep: null,
        idea: {
          id: slot.slotId || `${slot.dayOfWeek}-${slot.blockStartHour}`,
          title: slot.title || "Pauta selecionada",
          description: slot.scriptShort || slot.rationale || "Pauta salva no planejamento.",
          lane: "recommended",
          source: "saved_idea",
          expectedInteractionsAvg: estimatePlannerSlotInteractions(slot, outcomeSignals),
        },
        blueprint: null,
        blueprintChecklist: {
          sceneIds: [],
          hookIds: [],
        },
        blueprintScriptStatus: "idle",
        stage: "idea",
      };
      return next;
    });
    trackFunnelEvent("post_creation_slot_saved", {
      slot_id: slot.slotId || null,
      stage_after: "idea",
      board_view: "saved",
    });
  }, [clearAutoAdvanceTimer, draftId, funnelState.scriptId, outcomeSignals, trackFunnelEvent, updateSelectionParams]);

  const handleSaveIdeaPauta = useCallback(async () => {
    setIdeaSaveError(null);
    setDiscardSavedPautaError(null);

    if (isPreviewMode) {
      onActivatePreview?.();
      return;
    }

	    if (!canInteract) {
        if (selectedIdeaCandidate) {
          window.sessionStorage.setItem("d2c.post_creation.pending_action", JSON.stringify({
            type: "save_pauta",
            candidate: selectedIdeaCandidate
          }));
        }
	      requestContinuationGate("post_creation_save_pauta");
	      return;
	    }

	    if (!selectedIdeaCandidate) {
	      return;
	    }

    hasLocalEditsRef.current = true;
    setIsSavingIdeaPauta(true);
    try {
      const nextSlot = buildPersistablePlannerSlotFromCandidate(selectedIdeaCandidate);
      const persistedSlots = await savePostCreationPauta({
        ...nextSlot,
        isSaved: true,
      });
      const persisted =
        persistedSlots.find((item) => {
          if (nextSlot.slotId && item.slotId) return item.slotId === nextSlot.slotId;
          // If it was a new save, match by title and slot info to be more specific than just day/hour
          return (
            item.dayOfWeek === nextSlot.dayOfWeek &&
            item.blockStartHour === nextSlot.blockStartHour &&
            item.title === nextSlot.title &&
            item.format === nextSlot.format
          );
        }) || {
          ...nextSlot,
          isSaved: true,
        };
      const persistedSavedSlot: PlannerUISlot = {
        ...persisted,
        title: persisted.title || nextSlot.title,
        scriptShort: persisted.scriptShort || nextSlot.scriptShort,
        themeKeyword: persisted.themeKeyword || nextSlot.themeKeyword,
        themes: persisted.themes?.length ? persisted.themes : nextSlot.themes,
        savedFrom: persisted.savedFrom || nextSlot.savedFrom || POST_CREATION_SAVED_FROM,
        isSaved: true,
      };

      setOptimisticSavedPautas((current) => {
        const key = persistedSavedSlot.slotId || `${persistedSavedSlot.dayOfWeek}-${persistedSavedSlot.blockStartHour}`;
        const rest = current.filter((item) => {
          const itemKey = item.slotId || `${item.dayOfWeek}-${item.blockStartHour}`;
          return itemKey !== key;
        });
        return [persistedSavedSlot, ...rest];
      });
      handleFunnelSlotSaved(persistedSavedSlot);
      toast({
        variant: "success",
        title: "Pauta salva com sucesso",
        description: "A pauta já está disponível na sua biblioteca dentro do board.",
      });
    } catch (error) {
      setIdeaSaveError(error instanceof Error ? error.message : "Não foi possível salvar a pauta.");
    } finally {
      setIsSavingIdeaPauta(false);
    }
  }, [
	    canInteract,
	    isPreviewMode,
	    onActivatePreview,
	    requestContinuationGate,
	    savePostCreationPauta,
	    selectedIdeaCandidate,
	    toast,
	    handleFunnelSlotSaved,
  ]);

  const handleDiscardSavedPauta = useCallback(
    async (slot: PlannerUISlot) => {
      if (isPreviewMode) {
        onActivatePreview?.();
        return;
      }

	      if (!canInteract) {
	        requestContinuationGate("post_creation_discard_saved_pauta");
	        return;
	      }

      const targetKey = getPlannerSlotLibraryKey(slot);
      const targetLabel = slot.title || slot.scriptShort || slot.themeKeyword || "esta pauta";
      if (
        typeof window !== "undefined" &&
        !window.confirm(`Descartar "${truncateText(targetLabel, 64)}"? Ela sairá de Pautas salvas.`)
      ) {
        return;
      }

      hasLocalEditsRef.current = true;
      setDiscardSavedPautaError(null);
      setDiscardingSavedPautaKey(targetKey);

      try {
        const persistedMap = new Map<string, PlannerUISlot>();
        plannerSlots.forEach((item) => {
          if (item.isSaved !== true) return;
          persistedMap.set(getPlannerSlotLibraryKey(item), item);
        });
        optimisticSavedPautas.forEach((item) => {
          if (item.isSaved !== true) return;
          const key = getPlannerSlotLibraryKey(item);
          persistedMap.set(key, mergeSavedPautaSlot(persistedMap.get(key), item));
        });
        persistedMap.delete(targetKey);

        await saveSlots(Array.from(persistedMap.values()));
        setOptimisticSavedPautas((current) =>
          current.filter((item) => getPlannerSlotLibraryKey(item) !== targetKey)
        );

        const isCurrentSelection =
          (slot.slotId && resolvedSelectedSlotId ? slot.slotId === resolvedSelectedSlotId : false) ||
          (!slot.slotId &&
            funnelState.idea?.source === "saved_idea" &&
            Number(funnelState.decision.dayId) === slot.dayOfWeek &&
            Number(funnelState.decision.hourId) === slot.blockStartHour);

        if (isCurrentSelection) {
          setSelectedSlotIdState(null);
          updateSelectionParams({
            slotId: null,
            scriptId: funnelState.scriptId || null,
            draftId,
            view: boardView === "saved" ? "saved" : null,
          });
          setFunnelState((current) => ({
            ...current,
            idea: current.idea
              ? {
                  ...current.idea,
                  source: current.idea.source === "saved_idea" ? "manual" : current.idea.source,
                }
              : current.idea,
          }));
        }

        toast({
          variant: "success",
          title: "Pauta descartada",
          description: "Ela saiu da sua biblioteca de pautas salvas.",
        });
        trackFunnelEvent("post_creation_saved_pauta_discarded", {
          slot_id: slot.slotId || null,
          board_view: boardView,
        });
      } catch (error) {
        setDiscardSavedPautaError(
          error instanceof Error ? error.message : "Não foi possível descartar a pauta."
        );
      } finally {
        setDiscardingSavedPautaKey(null);
      }
    },
    [
      boardView,
      canInteract,
      draftId,
      funnelState.decision.dayId,
      funnelState.decision.hourId,
      funnelState.idea?.source,
      funnelState.scriptId,
      isPreviewMode,
	      onActivatePreview,
	      optimisticSavedPautas,
	      plannerSlots,
	      requestContinuationGate,
	      resolvedSelectedSlotId,
      saveSlots,
      toast,
      trackFunnelEvent,
      updateSelectionParams,
    ]
  );

  const handleBlueprintAdjustment = (adjustment: PostCreationBlueprintAdjustment) => {
    if (!activeBlueprint) return;
    const recommendedBlueprint = activeBlueprintSlot ? buildBlueprintFromPlannerSlot(activeBlueprintSlot) : null;
    const adjustedBlueprint = adjustBlueprint(activeBlueprint, adjustment, {
      recommendedBlueprint,
    });

    hasLocalEditsRef.current = true;
    setSelectedScriptIdState(null);
    updateSelectionParams({
      slotId: activeBlueprintSlot?.slotId || resolvedSelectedSlotId,
      scriptId: null,
      draftId,
    });
    setFunnelState((current) => ({
      ...current,
      blueprint: adjustedBlueprint,
      blueprintChecklist: {
        sceneIds: current.blueprintChecklist.sceneIds,
        hookIds: current.blueprintChecklist.hookIds,
      },
      scriptId: null,
      linkedContent: null,
      blueprintScriptStatus: "ready",
      stage: "blueprint",
    }));
    trackFunnelEvent("post_creation_blueprint_adjusted", {
      blueprint_title: adjustedBlueprint.whatToPost,
      source: adjustment,
      stage_before: funnelState.stage,
      stage_after: "blueprint",
    });
  };

  const handleBlueprintScriptAction = useCallback(async () => {
    setBlueprintActionError(null);
    setBlueprintSaveError(null);

    if (linkedBlueprintScript?.id && hasInlineBlueprintScriptDraft) {
      setBlueprintActionError(null);
      return;
    }

    if (isPreviewMode) {
      onActivatePreview?.();
      return;
    }

	    if (!canInteract) {
	      requestContinuationGate("post_creation_generate_script");
	      return;
	    }

    if (!activeBlueprint) return;

    const blueprintPrompt = buildScriptPromptFromBlueprint(activeBlueprint);
    setIsGeneratingBlueprintScript(true);
    trackFunnelEvent("post_creation_blueprint_script_started", {
      blueprint_title: activeBlueprint.whatToPost,
      slot_id: activeBlueprintSlot?.slotId || null,
      has_slot_link: Boolean(activeBlueprintSlot?.slotId && weekStart instanceof Date),
    });
    setFunnelState((current) => ({
      ...current,
      blueprintScriptStatus: "generating",
    }));
    try {
      const payload: Record<string, unknown> = {
        mode: "ai",
        title: activeBlueprint.whatToPost,
        prompt: blueprintPrompt,
        persistResult: false,
      };

      const response = await fetch("/api/scripts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.ok || !result?.draft?.content) {
        throw new Error(result?.error || "Não foi possível gerar o roteiro a partir do blueprint.");
      }

      hasLocalEditsRef.current = true;
      setSelectedScriptIdState(null);
      updateSelectionParams({
        slotId: activeBlueprintSlot?.slotId || resolvedSelectedSlotId,
        scriptId: null,
        draftId,
      });
      setInlineBlueprintScriptDraft({
        title:
          typeof result?.draft?.title === "string" && result.draft.title.trim()
            ? result.draft.title.trim()
            : activeBlueprint.whatToPost,
        content: String(result.draft.content || "").trim(),
        prompt: blueprintPrompt,
      });
      setFunnelState((current) => ({
        ...current,
        scriptId: null,
        blueprintScriptStatus: "generated",
        stage: "blueprint",
      }));
      trackFunnelEvent("post_creation_blueprint_script_succeeded", {
        slot_id: activeBlueprintSlot?.slotId || null,
        linked_to_slot: false,
        draft_only: true,
        stage_after: "blueprint",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Não foi possível gerar o roteiro.";
      setBlueprintActionError(errorMessage);
      setFunnelState((current) => ({
        ...current,
        blueprintScriptStatus:
          inlineBlueprintScriptDraft?.content?.trim() || current.scriptId ? current.blueprintScriptStatus : "ready",
      }));
      trackFunnelEvent("post_creation_blueprint_script_failed", {
        slot_id: activeBlueprintSlot?.slotId || null,
        message: errorMessage,
      });
    } finally {
      setIsGeneratingBlueprintScript(false);
    }
  }, [activeBlueprint, activeBlueprintSlot?.slotId, canInteract, draftId, hasInlineBlueprintScriptDraft, inlineBlueprintScriptDraft?.content, isPreviewMode, linkedBlueprintScript?.id, onActivatePreview, requestContinuationGate, resolvedSelectedSlotId, trackFunnelEvent, updateSelectionParams, weekStart]);

  const handleBlueprintScriptDraftChange = (field: "title" | "content", value: string) => {
    hasLocalEditsRef.current = true;
    setBlueprintSaveError(null);
    setInlineBlueprintScriptDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        [field]: value,
      };
    });
  };

  const handleSaveBlueprintScript = async () => {
    setBlueprintSaveError(null);

    if (isPreviewMode) {
      onActivatePreview?.();
      return;
    }

	    if (!canInteract) {
	      requestContinuationGate("post_creation_save_script");
	      return;
	    }

    if (!inlineBlueprintScriptDraft || !activeBlueprint) return;

    const nextTitle = inlineBlueprintScriptDraft.title.trim() || activeBlueprint.whatToPost;
    const nextContent = inlineBlueprintScriptDraft.content.trim();

    if (!nextContent) {
      setBlueprintSaveError("O roteiro está vazio. Gere ou ajuste o texto antes de salvar.");
      return;
    }

    setIsSavingBlueprintScript(true);

    try {
      const payload: Record<string, unknown> = {
        mode: "ai",
        title: nextTitle,
        content: nextContent,
        prompt: inlineBlueprintScriptDraft.prompt || buildScriptPromptFromBlueprint(activeBlueprint),
        reuseGeneratedDraft: true,
      };

      if (activeBlueprintSlot?.slotId && weekStart instanceof Date) {
        payload.linkToSlot = {
          slotId: activeBlueprintSlot.slotId,
          weekStart: weekStart.toISOString(),
          dayOfWeek: activeBlueprintSlot.dayOfWeek,
          blockStartHour: activeBlueprintSlot.blockStartHour,
        };
      }

      const response = await fetch("/api/scripts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.ok || !result?.item?.id) {
        throw new Error(result?.error || "Não foi possível salvar o roteiro.");
      }

      const created = result.item as FunnelScriptSummaryItem;
      hasLocalEditsRef.current = true;
      setRecentScripts((current) => {
        const next = current.filter((item) => item.id !== created.id);
        return [created, ...next];
      });
      setSelectedScriptIdState(null);
      updateSelectionParams({
        slotId: activeBlueprintSlot?.slotId || resolvedSelectedSlotId,
        scriptId: null,
        draftId,
      });
      setInlineBlueprintScriptDraft((current) =>
        current
          ? {
              ...current,
              title: created.title,
              content: nextContent,
            }
          : current
      );
      setFunnelState((current) => ({
        ...current,
        scriptId: null,
        blueprintScriptStatus: resolveBlueprintScriptStatusFromScript(created),
        stage: "blueprint",
      }));
      trackFunnelEvent("post_creation_script_saved", {
        script_id: created.id,
        script_status: resolveScriptStatusLabel(created),
        source: "blueprint_inline",
        stage_after: "blueprint",
      });
    } catch (error) {
      setBlueprintSaveError(error instanceof Error ? error.message : "Não foi possível salvar o roteiro.");
    } finally {
      setIsSavingBlueprintScript(false);
    }
  };

  const handleFunnelSlotFocus = (slot: PlannerUISlot) => {
    hasLocalEditsRef.current = true;
    skipLatestDraftHydrationRef.current = true;
    setSelectedSlotIdState(slot.slotId || null);
    updateSelectionParams({
      slotId: slot.slotId || null,
      scriptId: funnelState.scriptId || null,
      draftId,
    });
    setFunnelState((current) => {
      const next: PostCreationFunnelState = {
        ...current,
        decision: buildDecisionFromPlannerSlot(slot),
        activeDecisionStep: null,
        blueprintChecklist: {
          sceneIds: [],
          hookIds: [],
        },
        stage: "path",
      };
      return next;
    });
  };

  const handleOpenSavedPauta = useCallback(
    (slot: PlannerUISlot) => {
      clearAutoAdvanceTimer();
      hasLocalEditsRef.current = true;
      skipLatestDraftHydrationRef.current = true;
      setBoardView("create");
      setSelectedSlotIdState(slot.slotId || null);
      setSelectedScriptIdState(null);
      setIdeaSaveError(null);
      setDiscardSavedPautaError(null);
      setBlueprintActionError(null);
      setBlueprintSaveError(null);
      updateSelectionParams({
        slotId: slot.slotId || null,
        scriptId: null,
        draftId,
        view: null,
      });
      setFunnelState((current) => ({
        ...current,
        decision: buildDecisionFromPlannerSlot(slot),
        activeDecisionStep: null,
        idea: {
          id: slot.slotId || `${slot.dayOfWeek}-${slot.blockStartHour}`,
          title: slot.title || "Pauta selecionada",
          description: slot.scriptShort || slot.rationale || "Pauta salva no planejamento.",
          lane: "recommended",
          source: "saved_idea",
          expectedInteractionsAvg: estimatePlannerSlotInteractions(slot, outcomeSignals),
        },
        blueprint: null,
        blueprintChecklist: {
          sceneIds: [],
          hookIds: [],
        },
        blueprintScriptStatus: "idle",
        stage: "idea",
      }));
    },
    [clearAutoAdvanceTimer, draftId, outcomeSignals, updateSelectionParams]
  );

	  const handleOpenSavedView = useCallback(() => {
	    if (!canInteract) {
	      requestContinuationGate("post_creation_open_saved_pautas");
	      return;
	    }
	    clearAutoAdvanceTimer();
	    setDiscardSavedPautaError(null);
	    setBoardView("saved");
    updateSelectionParams(
      {
        view: "saved",
      },
      { history: "push" }
    );
	  }, [canInteract, clearAutoAdvanceTimer, requestContinuationGate, updateSelectionParams]);

  const handleReturnToCreateView = useCallback(() => {
    clearAutoAdvanceTimer();
    setDiscardSavedPautaError(null);
    setBoardView("create");
    updateSelectionParams(
      {
        view: null,
      },
      { history: "replace" }
    );
  }, [clearAutoAdvanceTimer, updateSelectionParams]);

  const handleFunnelScriptOpen = (script: any) => {
    hasLocalEditsRef.current = true;
    setSelectedScriptIdState(script.id);
    updateSelectionParams({
      slotId: resolvedSelectedSlotId,
      scriptId: script.id,
      draftId,
    });
    setFunnelState((current) => {
      return {
        ...current,
        scriptId: script.id,
        blueprintScriptStatus: resolveBlueprintScriptStatusFromScript(script),
        stage: "script",
      };
    });
    trackFunnelEvent("post_creation_script_opened", {
      script_id: script.id,
      script_status: resolveScriptStatusLabel(script),
      stage_after: "script",
    });
  };

  const handleFunnelScriptSaved = (script: any) => {
    hasLocalEditsRef.current = true;
    setSelectedScriptIdState(script.id);
    updateSelectionParams({
      slotId: resolvedSelectedSlotId,
      scriptId: script.id,
      draftId,
    });
    setFunnelState((current) => {
      return {
        ...current,
        scriptId: script.id,
        blueprintScriptStatus: resolveBlueprintScriptStatusFromScript(script),
        stage: "script",
      };
    });
    trackFunnelEvent("post_creation_script_saved", {
      script_id: script.id,
      script_status: resolveScriptStatusLabel(script),
      stage_after: "script",
    });
  };

  const handleScriptPageContentLinked = (script: any) => {
    hasLocalEditsRef.current = true;
    setSelectedScriptIdState(script.id);
    updateSelectionParams({
      slotId: resolvedSelectedSlotId,
      scriptId: script.id,
      draftId,
    });
    setFunnelState((current) => {
      const linkedId = script.publication?.content?.id;
      const next: PostCreationFunnelState = {
        ...current,
        scriptId: script.id,
        linkedContent: linkedId
          ? {
              id: linkedId,
              caption:
                typeof script.publication?.content?.caption === "string" && script.publication.content.caption.trim()
                  ? script.publication.content.caption.trim()
                  : null,
              postDate:
                typeof script.publication?.content?.postDate === "string" && script.publication.content.postDate.trim()
                  ? script.publication.content.postDate.trim()
                  : null,
              postLink:
                typeof script.publication?.content?.postLink === "string" && script.publication.content.postLink.trim()
                  ? script.publication.content.postLink.trim()
                  : null,
              coverUrl:
                typeof script.publication?.content?.coverUrl === "string" && script.publication.content.coverUrl.trim()
                  ? script.publication.content.coverUrl.trim()
                  : null,
              engagement:
                typeof script.publication?.content?.engagement === "number" &&
                Number.isFinite(script.publication.content.engagement)
                  ? script.publication.content.engagement
                  : null,
              totalInteractions:
                typeof script.publication?.content?.totalInteractions === "number" &&
                Number.isFinite(script.publication.content.totalInteractions)
                  ? script.publication.content.totalInteractions
                  : null,
            }
          : current.linkedContent,
        blueprintScriptStatus: linkedId ? "published" : resolveBlueprintScriptStatusFromScript(script),
        stage: "published",
      };
      return next;
    });
    trackFunnelEvent("post_creation_content_linked", {
      script_id: script.id,
      content_id: script.publication?.content?.id || null,
      stage_after: "published",
    });
  };

  const handleOpenLinkedContent = useCallback(() => {
    const postLink = funnelState.linkedContent?.postLink?.trim();
    if (!postLink || typeof window === "undefined") return;
    window.open(postLink, "_blank", "noopener,noreferrer");
  }, [funnelState.linkedContent?.postLink]);

  const jumpToScripts = useCallback(() => {
    setIsScriptsSurfaceReady(true);
    scriptsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleOpenPublishedStep = useCallback(() => {
    if (funnelState.linkedContent?.postLink) {
      handleOpenLinkedContent();
      return;
    }
    jumpToScripts();
  }, [funnelState.linkedContent?.postLink, handleOpenLinkedContent, jumpToScripts]);

  const handleOpenLinkGallery = useCallback(() => {
    void fetchContentOptions();
    setShowLinkGallery(true);
  }, [fetchContentOptions]);

	  const handleResetFunnel = useCallback(() => {
	    if (isTrialViewer && trialPautaConsumed) {
	      requestContinuationGate("post_creation_generate_another_pauta");
	      return;
	    }
	    clearAutoAdvanceTimer();
	    hasLocalEditsRef.current = true;
    skipLatestDraftHydrationRef.current = true;
    draftHydrationRef.current = false;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setBoardView("create");
    setShowLinkGallery(false);
    setContentOptions([]);
    setInlineBlueprintScriptDraft(null);
    setBlueprintActionError(null);
    setBlueprintSaveError(null);
    setIdeaSaveError(null);
    setDiscardSavedPautaError(null);
    setIsSavingIdeaPauta(false);
    setDiscardingSavedPautaKey(null);
    setAdvancingPathId(null);
    setAdvancingIdeaId(null);
    setSelectedSlotIdState(null);
    setSelectedScriptIdState(null);
    setDraftId(null);
    hydratedDraftIdRef.current = null;
    setGeneratedPautas({
      status: "idle",
      requestKey: null,
      keyword: null,
      variants: [],
      captions: [],
      source: "fallback",
      error: null,
    });
    updateSelectionParams({
      slotId: null,
      scriptId: null,
      draftId: null,
      view: null,
    });
    setFunnelState(createEmptyPostCreationFunnelState());
	  }, [clearAutoAdvanceTimer, isTrialViewer, requestContinuationGate, trialPautaConsumed, updateSelectionParams]);

  const toggleChecklistItem = useCallback((collection: "scene" | "hook", id: string) => {
    hasLocalEditsRef.current = true;
    setFunnelState((current) => {
      const currentItems =
        collection === "scene" ? current.blueprintChecklist.sceneIds : current.blueprintChecklist.hookIds;
      const nextItems = currentItems.includes(id)
        ? currentItems.filter((item) => item !== id)
        : [...currentItems, id];

      return {
        ...current,
        blueprintChecklist: {
          ...current.blueprintChecklist,
          ...(collection === "scene" ? { sceneIds: nextItems } : { hookIds: nextItems }),
        },
      };
    });
  }, []);

  const handlePrevStage = useCallback(() => {
    clearAutoAdvanceTimer();
    if (boardView !== "create" || requestedBoardView === "saved") {
      setBoardView("create");
      updateSelectionParams(
        {
          view: null,
        },
        { history: "replace" }
      );
      return;
    }

    if (activeStage === "path") {
      const previousDecisionStep = resolvePrevDecisionStep(activeDecisionStepForUi, visibleDecisionSteps);
      if (!previousDecisionStep) return;
      setFunnelState((current) => ({
        ...current,
        activeDecisionStep: previousDecisionStep,
        stage: "path",
      }));
      return;
    }

    if (activeStage === "script") {
      hasLocalEditsRef.current = true;
      setSelectedScriptIdState(null);
      updateSelectionParams({
        slotId: resolvedSelectedSlotId,
        scriptId: null,
        draftId,
      });
      setFunnelState((current) => ({
        ...current,
        stage: "blueprint",
      }));
      return;
    }

    const stageBefore = funnelState.stage;
    const stageAfter = resolvePrevFunnelStage(funnelState.stage) || funnelState.stage;
    trackFunnelEvent("post_creation_blueprint_activated", {
      stage_before: stageBefore,
      stage_after: stageAfter,
    } as any);
    setFunnelState((current) => {
      const prevStage = resolvePrevFunnelStage(current.stage);
      if (!prevStage) return current;
      return {
        ...current,
        activeDecisionStep:
          prevStage === "path"
            ? (current.activeDecisionStep && visibleDecisionSteps.includes(current.activeDecisionStep)
                ? current.activeDecisionStep
                : null) ||
              resolveFirstIncompleteDecisionStep(current.decision, visibleDecisionSteps) ||
              visibleDecisionSteps[visibleDecisionSteps.length - 1] ||
              null
            : current.activeDecisionStep,
        stage: prevStage,
      };
    });
  }, [
    activeDecisionStepForUi,
    activeStage,
    visibleDecisionSteps,
    draftId,
    funnelState,
    boardView,
    clearAutoAdvanceTimer,
    resolvedSelectedSlotId,
    requestedBoardView,
    trackFunnelEvent,
    updateSelectionParams,
  ]);

  const handleStagePrimaryAction = useCallback(() => {
    if (activeStage === "path" && activeDecisionCard) {
      const recommendedOption =
        activeDecisionCard.options.find((option) => option.recommended) || activeDecisionCard.options[0] || null;
      if (recommendedOption) {
        handleDecisionOptionSelect(activeDecisionCard.id as PostCreationDecisionStep, recommendedOption.id);
      }
      return;
    }

    if (activeStage === "idea" && selectedIdeaCandidate) {
      handleIdeaSelection(selectedIdeaCandidate.variant.id);
      return;
    }

    if (activeStage === "idea" && activeBlueprint && funnelState.idea) {
      setFunnelState((current) => ({
        ...current,
        blueprint: activeBlueprint,
        blueprintChecklist: {
          sceneIds: [],
          hookIds: [],
        },
        blueprintScriptStatus: "ready",
        stage: "blueprint",
      }));
      trackFunnelEvent("post_creation_blueprint_activated", {
        stage_before: "idea",
        stage_after: "blueprint",
        slot_id: activeBlueprintSlot?.slotId || resolvedSelectedSlotId,
      } as any);
      return;
    }

    if (activeStage === "blueprint") {
      void handleBlueprintScriptAction();
      return;
    }

    if (activeStage === "published") {
      handleOpenPublishedStep();
    }
  }, [
    activeBlueprint,
    activeBlueprintSlot?.slotId,
    activeDecisionCard,
    activeStage,
    funnelState.idea,
    handleBlueprintScriptAction,
    handleDecisionOptionSelect,
    handleIdeaSelection,
    handleOpenPublishedStep,
    resolvedSelectedSlotId,
    selectedIdeaCandidate,
    trackFunnelEvent,
  ]);
  const handleHeaderAction = useCallback(() => {
    if (activeStage === "path" || activeStage === "idea") {
      handleOpenSavedView();
      return;
    }

    handleStagePrimaryAction();
  }, [activeStage, handleOpenSavedView, handleStagePrimaryAction]);

  useEffect(() => {
    const previousStage = previousStageRef.current;
    if (previousStage === activeStage) return;
    const previousIndex = POST_CREATION_FUNNEL_STAGE_ORDER.indexOf(previousStage);
    setStageTransitionDirection(activeStageIndex >= previousIndex ? "forward" : "backward");
    previousStageRef.current = activeStage;
    const timeoutId = window.setTimeout(() => {
      stageContentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 24);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeStage, activeStageIndex]);

  useEffect(() => {
    if (isScriptsSurfaceReady) return;
    if (activeStage !== "script" && activeStage !== "published") return;

    if (activeStage === "script" || typeof window === "undefined") {
      startTransition(() => {
        setIsScriptsSurfaceReady(true);
      });
      return;
    }

    const idleWindow = window as typeof window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let frameId: number | null = null;
    let idleId: number | null = null;
    let timeoutId: number | null = null;

    frameId = window.requestAnimationFrame(() => {
      if (typeof idleWindow.requestIdleCallback === "function") {
        idleId = idleWindow.requestIdleCallback(
          () =>
            startTransition(() => {
              setIsScriptsSurfaceReady(true);
            }),
          { timeout: 900 }
        );
        return;
      }

      timeoutId = window.setTimeout(() => {
        startTransition(() => {
          setIsScriptsSurfaceReady(true);
        });
      }, 180);
    });

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      if (idleId !== null && typeof idleWindow.cancelIdleCallback === "function") {
        idleWindow.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeStage, isScriptsSurfaceReady]);

  useEffect(() => {
    if (initialFocusStage !== "script" && initialFocusStage !== "published") return;
    const timeoutId = window.setTimeout(() => {
      setIsScriptsSurfaceReady(true);
      scriptsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [initialFocusStage]);

  useEffect(() => {
    if (!selectedScriptId) return;
    setSelectedScriptIdState(selectedScriptId);
    setFunnelState((current) => {
      if (current.scriptId === selectedScriptId && (current.stage === "script" || current.stage === "published")) {
        return current;
      }
      return {
        ...current,
        scriptId: selectedScriptId,
        blueprintScriptStatus: current.linkedContent ? "published" : current.blueprintScriptStatus === "linked" ? "linked" : "generated",
        stage: current.linkedContent ? "published" : "script",
      };
    });
  }, [selectedScriptId]);

  useEffect(() => {
    if (!selectedSlotId) return;
    setSelectedSlotIdState(selectedSlotId);
    const selectedSlot = plannerSlots.find((slot) => slot.slotId === selectedSlotId);
    if (!selectedSlot) return;
    setFunnelState((current) => {
      if (
        current.idea?.id === selectedSlotId ||
        (current.decision.dayId === String(selectedSlot.dayOfWeek) && current.decision.hourId === String(selectedSlot.blockStartHour))
      ) {
        return current;
      }
      return {
        ...current,
        decision: buildDecisionFromPlannerSlot(selectedSlot),
        activeDecisionStep: null,
        idea: {
          id: selectedSlot.slotId || `${selectedSlot.dayOfWeek}-${selectedSlot.blockStartHour}`,
          title: selectedSlot.title || "Pauta selecionada",
          description:
            selectedSlot.scriptShort || selectedSlot.rationale || "Pauta salva no planejamento.",
          lane: "recommended",
          source: "saved_idea",
          expectedInteractionsAvg: estimatePlannerSlotInteractions(selectedSlot, outcomeSignals),
        },
        blueprint: null,
        blueprintChecklist: {
          sceneIds: [],
          hookIds: [],
        },
        blueprintScriptStatus: "idle",
        stage: "idea",
      };
    });
  }, [outcomeSignals, plannerSlots, selectedSlotId]);

  useEffect(() => {
    if (!hasHydratedDraft) return;
    if (isPreviewMode || !normalizedViewer.id) return;
    if (!isMeaningfulFunnelState(funnelState)) return;
    if (!draftId && !hasLocalEditsRef.current) return;
    if (draftHydrationRef.current) return;

    const payload = buildDraftPayload({
      state: funnelState,
      selectedSlotId: resolvedSelectedSlotId,
      selectedScriptId: resolvedSelectedScriptId,
    });
    const signature = buildDraftSignature(payload);
    if (signature === lastSavedSignatureRef.current) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      const persistDraft = async () => {
        try {
          const response = await fetch(
              draftId ? `/api/post-creation/drafts/${encodeURIComponent(draftId)}` : "/api/post-creation/drafts",
            {
              method: draftId ? "PATCH" : "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            }
          );
          const result = await response.json().catch(() => ({}));
          if (!response.ok) return;
          const item = result?.item as PersistedPostCreationDraft | null | undefined;
          if (!item?.id) return;
          lastSavedSignatureRef.current = signature;
          hasLocalEditsRef.current = false;
          if (!draftId || draftId !== item.id) {
            hydratedDraftIdRef.current = item.id;
            setDraftId(item.id);
            if (selectedDraftId) {
              updateSelectionParams({
                draftId: item.id,
                slotId: payload.selectedSlotId,
                scriptId: payload.selectedScriptId,
              });
            }
          }
        } catch {
          return;
        }
      };

      void persistDraft();
    }, 900);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [
    draftId,
    funnelState,
    hasHydratedDraft,
    isPreviewMode,
    normalizedViewer.id,
    resolvedSelectedScriptId,
    resolvedSelectedSlotId,
    selectedDraftId,
    updateSelectionParams,
  ]);

  const canGoPrev = useMemo(() => {
    if (activeStage === "path") {
      return Boolean(resolvePrevDecisionStep(activeDecisionStepForUi, visibleDecisionSteps));
    }
    if (activeStage === "idea") {
      return false;
    }
    return resolvePrevFunnelStage(funnelState.stage) !== null;
  }, [activeDecisionStepForUi, activeStage, funnelState.stage, visibleDecisionSteps]);

  const contentWidthClass =
    boardView === "saved"
      ? "max-w-[32rem] lg:max-w-[52rem]"
      : activeStage === "script" || activeStage === "published"
      ? "max-w-none"
      : "max-w-[31rem] lg:max-w-[38rem]";
  const completedSceneIds = funnelState.blueprintChecklist.sceneIds;
  const completedHookIds = funnelState.blueprintChecklist.hookIds;
  const directionTaskCount = (activeBlueprint?.scenes.length || 0) + hookVariations.length;
  const completedDirectionTaskCount = completedSceneIds.length + completedHookIds.length;
  const directionProgressRatio = directionTaskCount
    ? Math.min(1, completedDirectionTaskCount / directionTaskCount)
    : 0;
  const decisionStepCount = Math.max(decisionPathCards.length, 1);
  const activeDecisionIndex = activeDecisionStepForUi
    ? Math.max(0, decisionPathCards.findIndex((item) => item.id === activeDecisionStepForUi))
    : 0;
  const activeStepMeta = activeDecisionStepForUi ? DECISION_STEP_META[activeDecisionStepForUi] : null;
  const activeStageExpectedInteractionsAvg = useMemo(() => {
    if (activeStage === "path" && activeDecisionCard) {
      const selectedOption = activeDecisionCard.options.find((option) => option.label === activeDecisionCard.value);
      const highlightedOption =
        selectedOption ||
        activeDecisionCard.options.find((option) => option.recommended) ||
        activeDecisionCard.options[0] ||
        null;
      return highlightedOption?.expectedInteractionsAvg ?? null;
    }

    if (activeStage === "idea") {
      return (
        selectedIdeaCandidate?.variant.expectedInteractionsAvg ??
        funnelState.idea?.expectedInteractionsAvg ??
        ideaCandidates[0]?.variant.expectedInteractionsAvg ??
        null
      );
    }

    if (activeStage === "blueprint" || activeStage === "script") {
      return funnelState.idea?.expectedInteractionsAvg ?? selectedIdeaCandidate?.variant.expectedInteractionsAvg ?? null;
    }

    if (activeStage === "published") {
      return funnelState.linkedContent?.totalInteractions ?? funnelState.idea?.expectedInteractionsAvg ?? null;
    }

    return null;
  }, [
    activeDecisionCard,
    activeStage,
    funnelState.idea?.expectedInteractionsAvg,
    funnelState.linkedContent?.totalInteractions,
    ideaCandidates,
    selectedIdeaCandidate,
  ]);
  const stageMetricCopy =
    activeStage === "published"
      ? activeStageExpectedInteractionsAvg
        ? `${formatCompactNumber(activeStageExpectedInteractionsAvg)} interações registradas`
        : "Interações ainda indisponíveis"
      : formatInteractionsCopy(activeStageExpectedInteractionsAvg);
  const progressValue =
    activeStage === "path"
      ? Math.min(0.88, (activeDecisionIndex + 1) / (decisionStepCount + 1))
      : activeStage === "idea"
        ? 1
        : activeStage === "blueprint"
          ? 0.92
          : 1;
  const isSelectedIdeaSaved = funnelState.idea?.source === "saved_idea" && Boolean(selectedSlotIdState);
  const selectedSavedPautaSlot = useMemo(() => {
    if (!isSelectedIdeaSaved) return null;
    if (resolvedSelectedSlotId) {
      return savedLibrarySlots.find((slot) => slot.slotId === resolvedSelectedSlotId) || null;
    }
    const selectedDay = Number(funnelState.decision.dayId);
    const selectedHour = Number(funnelState.decision.hourId);
    if (!Number.isFinite(selectedDay) || !Number.isFinite(selectedHour)) return null;
    return (
      savedLibrarySlots.find(
        (slot) => slot.dayOfWeek === selectedDay && slot.blockStartHour === selectedHour
      ) || null
    );
  }, [
    funnelState.decision.dayId,
    funnelState.decision.hourId,
    isSelectedIdeaSaved,
    resolvedSelectedSlotId,
    savedLibrarySlots,
  ]);
  const selectedPautaEvidenceOption = useMemo(() => {
    const pautaCard = decisionPathCards.find((card) => card.id === "pauta") || null;
    const pautaId = funnelState.decision.pautaId || pautaCard?.selectedId || null;
    return pautaCard?.options.find((option) => option.id === pautaId) || pautaCard?.options[0] || null;
  }, [decisionPathCards, funnelState.decision.pautaId]);
  const selectedDecisionEvidenceOptions = useMemo(
    () =>
      decisionPathCards
        .map((card) => {
          const selectedId = card.id === "pauta" ? funnelState.decision.pautaId || card.selectedId : card.selectedId;
          return card.options.find((option) => option.id === selectedId) || card.options[0] || null;
        })
        .filter((option): option is DecisionOptionCardItem => Boolean(option)),
    [decisionPathCards, funnelState.decision.pautaId]
  );
  const selectedDecisionEvidencePosts = useMemo(
    () => mergeEvidencePostGroups(...selectedDecisionEvidenceOptions.map((option) => option.evidencePosts)),
    [selectedDecisionEvidenceOptions]
  );
  const selectedIdeaReferencePosts = useMemo(
    () =>
      mergeEvidencePostGroups(
        selectedIdeaCandidate?.slot.evidencePosts,
        selectedSavedPautaSlot?.evidencePosts,
        selectedPautaEvidenceOption?.evidencePosts,
        selectedDecisionEvidencePosts
      ),
    [
      selectedIdeaCandidate?.slot.evidencePosts,
      selectedDecisionEvidencePosts,
      selectedPautaEvidenceOption?.evidencePosts,
      selectedSavedPautaSlot?.evidencePosts,
    ]
  );
  const selectedIdeaReferenceTotal = useMemo(() => {
    const candidateTotal = selectedIdeaCandidate
      ? getEvidenceTotal({
          evidencePosts: selectedIdeaCandidate.slot.evidencePosts,
          evidenceCount: selectedIdeaCandidate.slot.evidenceCount,
        })
      : 0;
    const savedTotal = selectedSavedPautaSlot
      ? getEvidenceTotal({
          evidencePosts: selectedSavedPautaSlot.evidencePosts,
          evidenceCount: selectedSavedPautaSlot.evidenceCount,
        })
      : 0;
    const pautaOptionTotal = selectedPautaEvidenceOption
      ? Math.max(
          getEvidenceTotal(selectedPautaEvidenceOption),
          getEvidenceCountFromReason(selectedPautaEvidenceOption.reason)
        )
      : 0;
    const decisionPathTotal = selectedDecisionEvidenceOptions.reduce(
      (total, option) => Math.max(total, getEvidenceTotal(option), getEvidenceCountFromReason(option.reason)),
      0
    );
    return Math.max(selectedIdeaReferencePosts.length, candidateTotal, savedTotal, pautaOptionTotal, decisionPathTotal);
  }, [
    selectedIdeaCandidate,
    selectedDecisionEvidenceOptions,
    selectedIdeaReferencePosts.length,
    selectedPautaEvidenceOption,
    selectedSavedPautaSlot,
  ]);
  const handleOpenReferenceDrawer = useCallback(() => {
    if (selectedIdeaReferenceTotal <= 0) return;
    setReferenceDrawerOpen(true);
  }, [selectedIdeaReferenceTotal]);
  const handleCloseReferenceDrawer = useCallback(() => {
    setReferenceDrawerOpen(false);
  }, []);
  const handleOpenReferencePost = useCallback((post: PlannerEvidencePost) => {
    if (isPostDetailId(post.id)) {
      setSelectedReferencePostId(post.id);
      return;
    }
    if (post.postLink && typeof window !== "undefined") {
      window.open(post.postLink, "_blank", "noopener,noreferrer");
    }
  }, []);
  const handleCloseReferencePost = useCallback(() => {
    setSelectedReferencePostId(null);
  }, []);
  useEffect(() => {
    if (activeStage === "idea" || activeStage === "published") return;
    setReferenceDrawerOpen(false);
    setSelectedReferencePostId(null);
  }, [activeStage]);
  useEffect(() => {
    if (boardView !== "saved") return;
    setReferenceDrawerOpen(false);
    setSelectedReferencePostId(null);
    setShowLinkGallery(false);
  }, [boardView]);
  const isDiscardingCurrentSavedPauta = selectedSavedPautaSlot
    ? discardingSavedPautaKey === getPlannerSlotLibraryKey(selectedSavedPautaSlot)
    : false;
  const headerGoalLabel =
    activeStage === "path"
      ? activeStepMeta?.goal || "Direção editorial"
    : activeStage === "idea"
        ? "Pauta final"
        : activeStage === "blueprint"
          ? "Direção"
        : activeStage === "published"
          ? "Publicação"
          : "Roteiro";
  const savedViewReturnLabel =
    activeStage === "path"
      ? "Continuar criação"
      : activeStage === "idea"
        ? "Retomar conquista"
        : activeStage === "published"
          ? "Retomar publicação"
          : "Retomar criação";
  const headerActionLabel =
    activeStage === "path"
      ? "Pautas salvas"
      : activeStage === "idea"
        ? "Salvas"
      : activeStage === "blueprint"
        ? linkedBlueprintScript?.id && hasInlineBlueprintScriptDraft
          ? null
          : "Gerar roteiro"
        : activeStage === "published"
          ? "Abrir post"
          : null;
  const isFinalPautaDecision = activeStage === "path" && activeDecisionCard?.id === "pauta";
  const ActiveStageIcon = activeStepMeta?.icon || Sparkles;
  const nextDecisionLabel =
    activeDecisionIndex < decisionPathCards.length - 1
      ? decisionPathCards[activeDecisionIndex + 1]?.label || "Fechamento"
      : "Fechamento";
  const funnelStageMeta = POST_CREATION_FUNNEL_STAGE_ORDER.map((stage, index) => ({
    id: stage,
    label:
      stage === "path"
        ? "Caminho"
        : stage === "idea"
          ? "Conquista"
          : stage === "blueprint"
            ? "Direção"
            : stage === "script"
              ? "Roteiro"
              : "Publicado",
    state: index < activeStageIndex ? "done" : index === activeStageIndex ? "active" : "upcoming",
  }));
  const activeDecisionRecommendedOption =
    activeDecisionCard?.options.find((option) => option.recommended) || activeDecisionCard?.options[0] || null;
  const activeDecisionExpectedInteractions = useMemo(
    () => activeDecisionCard?.options.map((entry) => entry.expectedInteractionsAvg) || [],
    [activeDecisionCard]
  );
  const activeDecisionTier = resolvePerformanceTier(
    activeDecisionRecommendedOption?.expectedInteractionsAvg ?? null,
    activeDecisionExpectedInteractions
  );
  const selectedThemeLabel =
    decisionPathCards.find((item) => item.id === "theme")?.value ||
    funnelState.decision.themeId ||
    "tema";
  const brandNarrativePautaPayload = useMemo(() => {
    if (!selectedIdeaForProjection) return null;

    const evidence =
      "evidence" in selectedIdeaForProjection && Array.isArray(selectedIdeaForProjection.evidence)
        ? selectedIdeaForProjection.evidence.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
    const title = selectedIdeaForProjection.title || null;
    const description = selectedIdeaForProjection.description || null;
    const reason = evidence.length ? evidence.slice(0, 3).join(" | ") : description;
    const theme = selectedThemeLabel || funnelState.decision.themeId || null;

    return {
      title,
      description,
      reason,
      theme,
      keywords: buildBrandNarrativeKeywords(title, description, reason, theme),
    };
  }, [funnelState.decision.themeId, selectedIdeaForProjection, selectedThemeLabel]);
  const selectedPautaLabel =
    funnelState.idea?.title ||
    decisionPathCards.find((item) => item.id === "pauta")?.value ||
    selectedIdeaCandidate?.variant.title ||
    null;
  const selectedConfigurationItems = useMemo(
    () =>
      [
        {
          label: "Contexto",
          icon: Users,
          value:
            decisionPathCards.find((item) => item.id === "context")?.value ||
            formatCategoryLabel(funnelState.decision.contextId, "context"),
        },
        {
          label: "Proposta",
          icon: Target,
          value:
            decisionPathCards.find((item) => item.id === "proposal")?.value ||
            formatCategoryLabel(funnelState.decision.proposalId, "proposal"),
        },
        {
          label: "Tom",
          icon: MessageSquare,
          value:
            decisionPathCards.find((item) => item.id === "tone")?.value ||
            (funnelState.decision.toneId ? formatCategoryLabel(funnelState.decision.toneId, "tone") : null),
        },
        {
          label: "Referência",
          icon: BadgeHelp,
          value:
            decisionPathCards.find((item) => item.id === "reference")?.value ||
            (funnelState.decision.referenceId
              ? formatCategoryLabel(funnelState.decision.referenceId, "reference")
              : null),
        },
        {
          label: "Intenção",
          icon: Flame,
          value:
            decisionPathCards.find((item) => item.id === "intent")?.value ||
            (funnelState.decision.intentId ? formatCategoryLabel(funnelState.decision.intentId) : null),
        },
        {
          label: "Formato",
          icon: Layout,
          value:
            decisionPathCards.find((item) => item.id === "format")?.value ||
            formatCategoryLabel(funnelState.decision.formatId, "format"),
        },
        {
          label: "Narrativa",
          icon: BookOpen,
          value:
            decisionPathCards.find((item) => item.id === "narrative")?.value ||
            (funnelState.decision.narrativeId ? formatCategoryLabel(funnelState.decision.narrativeId) : null),
        },
        {
          label: "Janela",
          icon: Calendar,
          value:
            funnelState.decision.dayId && funnelState.decision.hourId
              ? `${getDayLabel(Number(funnelState.decision.dayId))}, ${getBlockLabel(Number(funnelState.decision.hourId))}`
              : null,
        },
        {
          label: "Tema",
          icon: Hash,
          value: selectedThemeLabel,
        },
        {
          label: "Pauta",
          icon: BookOpen,
          value: selectedPautaLabel,
        },
      ].filter(
        (item): item is SelectedConfigurationItem =>
          typeof item.value === "string" && item.value.trim().length > 0
      ),
    [
      decisionPathCards,
      funnelState.decision.contextId,
      funnelState.decision.formatId,
      funnelState.decision.hourId,
      funnelState.decision.intentId,
      funnelState.decision.narrativeId,
      funnelState.decision.proposalId,
      funnelState.decision.referenceId,
      funnelState.decision.dayId,
      funnelState.decision.toneId,
      selectedPautaLabel,
      selectedThemeLabel,
    ]
  );
  const decisionTrailItems = useMemo(() => {
    if (!activeDecisionCard) return [];

    const selectedTrail = decisionPathCards
      .slice(0, Math.max(activeDecisionIndex, 0))
      .map((card) => ({
        id: `selected-${card.id}`,
        label: card.value,
        emoji: resolveDecisionOptionEmoji(card.id as PostCreationDecisionStep, card.value) || "✨",
        state: "selected" as const,
      }))
      .filter((item) => item.label.trim().length > 0);

    const shouldShowPendingChip = activeDecisionCard.id !== "pauta" || !activeDecisionCard.selectedId;
    if (!shouldShowPendingChip) return selectedTrail;

    return [
      ...selectedTrail,
      {
        id: `pending-${activeDecisionCard.id}`,
        label: activeStepMeta?.goal || activeDecisionCard.label,
        emoji: "",
        state: "pending" as const,
      },
    ];
  }, [activeDecisionCard, activeDecisionIndex, activeStepMeta?.goal, decisionPathCards]);

  const candidateProjectionValues = useMemo(
    () =>
      ideaCandidates
        .map((candidate) => candidate.variant.expectedInteractionsAvg ?? estimatePlannerSlotInteractions(candidate.slot, outcomeSignals))
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0),
    [ideaCandidates, outcomeSignals]
  );
  const selectedIdeaProjectedInteractions = useMemo(() => {
    if (
      typeof selectedIdeaForProjection?.expectedInteractionsAvg === "number" &&
      Number.isFinite(selectedIdeaForProjection.expectedInteractionsAvg) &&
      selectedIdeaForProjection.expectedInteractionsAvg > 0
    ) {
      return Math.round(selectedIdeaForProjection.expectedInteractionsAvg);
    }

    const estimatedFromSlot = selectedIdeaCandidate?.slot
      ? estimatePlannerSlotInteractions(selectedIdeaCandidate.slot, outcomeSignals)
      : null;
    if (typeof estimatedFromSlot === "number" && Number.isFinite(estimatedFromSlot) && estimatedFromSlot > 0) {
      return Math.round(estimatedFromSlot);
    }

    if (
      typeof activeStageExpectedInteractionsAvg === "number" &&
      Number.isFinite(activeStageExpectedInteractionsAvg) &&
      activeStageExpectedInteractionsAvg > 0
    ) {
      return Math.round(activeStageExpectedInteractionsAvg);
    }

    return null;
  }, [
    activeStageExpectedInteractionsAvg,
    outcomeSignals,
    selectedIdeaCandidate?.slot,
    selectedIdeaForProjection?.expectedInteractionsAvg,
  ]);
  const selectedIdeaProjectionOrigin =
    activeStage === "published" && typeof funnelState.linkedContent?.totalInteractions === "number"
      ? "actual"
      : typeof selectedIdeaForProjection?.expectedInteractionsAvg === "number" &&
          Number.isFinite(selectedIdeaForProjection.expectedInteractionsAvg) &&
          selectedIdeaForProjection.expectedInteractionsAvg > 0
        ? "idea"
        : typeof selectedIdeaProjectedInteractions === "number" && selectedIdeaProjectedInteractions > 0
          ? "branch"
          : "none";
  const selectedIdeaTier = resolvePerformanceTier(
    selectedIdeaProjectedInteractions,
    candidateProjectionValues.length ? candidateProjectionValues : selectedIdeaProjectedInteractions ? [selectedIdeaProjectedInteractions] : []
  );
  const selectedIdeaConfidence =
    selectedIdeaForProjection && "confidence" in selectedIdeaForProjection
      ? selectedIdeaForProjection.confidence
      : null;
  const selectedIdeaConfidencePercent =
    typeof selectedIdeaConfidence === "number" && Number.isFinite(selectedIdeaConfidence)
      ? Math.round(selectedIdeaConfidence * 100)
      : null;
  const selectedIdeaLane =
    selectedIdeaForProjection && "lane" in selectedIdeaForProjection ? selectedIdeaForProjection.lane : null;
  const projectedInteractions =
    activeStage === "published"
      ? typeof funnelState.linkedContent?.totalInteractions === "number" && funnelState.linkedContent.totalInteractions > 0
        ? Math.round(funnelState.linkedContent.totalInteractions)
        : selectedIdeaProjectedInteractions
      : selectedIdeaProjectedInteractions;
  const selectedProjectionSlot = selectedIdeaCandidate?.slot || selectedSavedPautaSlot || null;
  const projectedReach = estimateProjectedReach(selectedProjectionSlot, projectedInteractions, activeStage);
  const projectedSaves = estimateProjectedSaves(projectedInteractions, activeStage);
  const projectedShares = estimateProjectedShares(selectedProjectionSlot, projectedInteractions, activeStage);
  const collabCreatorsRequest = useMemo(() => {
    if (boardView !== "create" || activeStage !== "idea" || !selectedIdeaForProjection) return null;
    const contextId = funnelState.decision.contextId || selectedProjectionSlot?.categories?.context?.[0] || null;
    const proposalId = funnelState.decision.proposalId || selectedProjectionSlot?.categories?.proposal?.[0] || null;
    const referenceId = funnelState.decision.referenceId || selectedProjectionSlot?.categories?.reference?.[0] || null;
    const payload = {
      categories: {
        context: contextId ? [contextId] : undefined,
        proposal: proposalId ? [proposalId] : undefined,
        reference: referenceId ? [referenceId] : undefined,
      },
      themeKeyword: selectedThemeLabel || undefined,
      title: selectedIdeaForProjection.title || undefined,
      periodDays: FUNNEL_HISTORY_LOOKBACK_DAYS,
      limit: 3,
    };
    return {
      key: JSON.stringify({
        version: POST_CREATION_COLLAB_REQUEST_VERSION,
        contextId,
        proposalId,
        referenceId,
        themeKeyword: selectedThemeLabel || null,
        title: selectedIdeaForProjection.title || null,
      }),
      payload,
    };
  }, [
    activeStage,
    boardView,
    funnelState.decision.contextId,
    funnelState.decision.proposalId,
    funnelState.decision.referenceId,
    selectedIdeaForProjection,
    selectedProjectionSlot,
    selectedThemeLabel,
  ]);

  const brandNarrativeCategoriesPayload = useMemo(
    () => ({
      context: buildBrandNarrativeCategoryValues(
        "context",
        funnelState.decision.contextId,
        selectedProjectionSlot?.categories?.context
      ),
      proposal: buildBrandNarrativeCategoryValues(
        "proposal",
        funnelState.decision.proposalId,
        selectedProjectionSlot?.categories?.proposal
      ),
      tone: buildBrandNarrativeCategoryValues(
        "tone",
        funnelState.decision.toneId,
        selectedProjectionSlot?.categories?.tone
      ),
      reference: buildBrandNarrativeCategoryValues(
        "reference",
        funnelState.decision.referenceId,
        selectedProjectionSlot?.categories?.reference
      ),
      contentIntent: buildBrandNarrativeCategoryValues(null, funnelState.decision.intentId, selectedProjectionSlot?.contentIntent),
      narrativeForm: buildBrandNarrativeCategoryValues(null, funnelState.decision.narrativeId, selectedProjectionSlot?.narrativeForm),
      contentSignals: buildBrandNarrativeCategoryValues(null, selectedProjectionSlot?.contentSignals),
      stance: buildBrandNarrativeCategoryValues(null, selectedProjectionSlot?.stance),
      proofStyle: buildBrandNarrativeCategoryValues(null, selectedProjectionSlot?.proofStyle),
      commercialMode: buildBrandNarrativeCategoryValues(null, selectedProjectionSlot?.commercialMode),
    }),
    [
      funnelState.decision.contextId,
      funnelState.decision.intentId,
      funnelState.decision.narrativeId,
      funnelState.decision.proposalId,
      funnelState.decision.referenceId,
      funnelState.decision.toneId,
      selectedProjectionSlot?.categories?.context,
      selectedProjectionSlot?.categories?.proposal,
      selectedProjectionSlot?.categories?.reference,
      selectedProjectionSlot?.categories?.tone,
      selectedProjectionSlot?.commercialMode,
      selectedProjectionSlot?.contentIntent,
      selectedProjectionSlot?.contentSignals,
      selectedProjectionSlot?.narrativeForm,
      selectedProjectionSlot?.proofStyle,
      selectedProjectionSlot?.stance,
    ]
  );

  useEffect(() => {
    if (!collabCreatorsRequest) {
      setCollabCreators((current) =>
        current.status === "idle" && current.requestKey === null
          ? current
          : {
              status: "idle",
              requestKey: null,
              items: [],
              contextLabel: null,
            }
      );
      return;
    }

    const cached = collabCreatorsCacheRef.current.get(collabCreatorsRequest.key);
    if (cached) {
      setCollabCreators({
        status: "ready",
        requestKey: collabCreatorsRequest.key,
        ...cached,
      });
      return;
    }

    const controller = new AbortController();
    setCollabCreators({
      status: "loading",
      requestKey: collabCreatorsRequest.key,
      items: [],
      contextLabel: null,
    });

    const loadCollabCreators = async () => {
      try {
        const response = await fetch("/api/planner/collab-creators", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(collabCreatorsRequest.payload),
        });
        const payload = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        const nextState: Omit<CollabCreatorsState, "status" | "requestKey"> = {
          items: Array.isArray(payload?.items) ? payload.items.slice(0, 3) : [],
          contextLabel: typeof payload?.contextLabel === "string" ? payload.contextLabel : null,
        };
        writeBoundedCache(collabCreatorsCacheRef.current, collabCreatorsRequest.key, nextState);
        setCollabCreators({
          status: "ready",
          requestKey: collabCreatorsRequest.key,
          ...nextState,
        });
      } catch {
        if (controller.signal.aborted) return;
        setCollabCreators({
          status: "ready",
          requestKey: collabCreatorsRequest.key,
          items: [],
          contextLabel: null,
        });
      }
    };

    void loadCollabCreators();

    return () => {
      controller.abort();
    };
  }, [collabCreatorsRequest]);

  const finalProjectionSupportCopy =
    activeStage === "published"
      ? typeof funnelState.linkedContent?.totalInteractions === "number" && funnelState.linkedContent.totalInteractions > 0
        ? "Leitura baseada no post já conectado ao funil."
        : "O post já voltou para o funil, mas ainda sem interações suficientes para leitura."
      : selectedIdeaProjectionOrigin === "idea"
        ? "Leitura estimada a partir de posts com configuração parecida no seu histórico recente."
        : selectedIdeaProjectionOrigin === "branch"
          ? "Leitura estimada a partir das escolhas já validadas no caminho."
          : "Ainda não há base recente suficiente para projetar esse fechamento.";
  const achievementBadges = useMemo(
    () =>
      [
        typeof projectedInteractions === "number" && projectedInteractions > 900
          ? {
              label: activeStage === "published" ? "Tração alta" : "Interações fortes",
              detail: activeStage === "published" ? "Acima da média." : "Boa projeção de interações para esse recorte.",
              accent: "from-amber-50 to-orange-50/50",
              border: "border-orange-200/60",
              text: "text-orange-600",
              icon: Flame,
            }
          : null,
        selectedIdeaLane === "bold"
          ? {
              label: "Ângulo criativo",
              detail: "Leitura mais ousada.",
              accent: "from-sky-50 to-indigo-50/50",
              border: "border-indigo-200/60",
              text: "text-indigo-600",
              icon: Sparkles,
            }
          : null,
        selectedIdeaLane === "safe"
          ? {
              label: "Crescimento estável",
              detail: "Execução mais previsível.",
              accent: "from-emerald-50 to-teal-50/50",
              border: "border-emerald-200/60",
              text: "text-emerald-600",
              icon: TrendingUp,
            }
          : null,
        funnelState.linkedContent?.postLink
          ? {
              label: "Sinal ao vivo",
              detail: "Post já conectado ao aprendizado.",
              accent: "from-sky-50 to-indigo-50/50",
              border: "border-indigo-200/60",
              text: "text-indigo-600",
              icon: LinkIcon,
            }
          : null,
      ].filter(Boolean) as AchievementBadgeItem[],
    [activeStage, funnelState.linkedContent?.postLink, projectedInteractions, selectedIdeaLane]
  );
  const highlightedSavedPauta = savedPautaEntries[0] || null;

  return (
    <>
      <div className="post-creation-funnel-light flex h-full min-h-0 w-full flex-col bg-transparent text-zinc-950">
        <main
          className={cn(
            "min-h-0 flex-1",
            usesBoardSurface ? "px-0 pb-0 pt-0" : "px-2 pb-2 pt-1.5 sm:px-3 sm:pb-3 sm:pt-2.5"
          )}
        >
          <div ref={stageContentRef} className={cn("mx-auto flex h-full min-h-0 w-full flex-col", contentWidthClass)}>
            {isPendingPaywall ? (
              <section
                className={cn(
                  FUNNEL_CANVAS_CLASS,
                  stageTransitionClass,
                  usesBoardSurface && "rounded-none border-0 shadow-none",
                  "relative isolate flex items-center justify-center p-8 text-center"
                )}
              >
                <FunnelAmbientBackdrop />
                <div className="flex flex-col items-center gap-5">
                  <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-3xl border border-zinc-200/60 bg-zinc-50/50 shadow-sm">
                    <Zap className="h-7 w-7 text-zinc-400" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-[15px] font-bold text-zinc-900">Preparando ambiente PRO...</h3>
                    <p className="text-[13px] text-zinc-500">Por favor, conclua a assinatura na janela a seguir.</p>
                  </div>
                </div>
              </section>
            ) : boardView === "saved" ? (
              <section
                className={cn(
                  FUNNEL_CANVAS_CLASS,
                  stageTransitionClass,
                  usesBoardSurface && "rounded-none border-0 shadow-none",
                  "relative isolate"
                )}
              >
                <FunnelAmbientBackdrop />

                <div className="relative flex-1 overflow-y-auto px-5 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
                  <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-4">
                    <div className="sticky top-0 z-10 -mx-2 px-2 pb-3 pt-1">
                      <div className="rounded-[22px] border border-zinc-200/74 bg-white/88 px-3.5 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.04)] backdrop-blur-xl">
                        <div className="space-y-3">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border border-zinc-200/70 bg-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                              <BookOpen className="h-4 w-4 text-zinc-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                <h2 className="text-[1.05rem] font-semibold leading-tight tracking-[-0.025em] text-zinc-950">
                                  Biblioteca de pautas
                                </h2>
                                <span className="rounded-full border border-zinc-200/70 bg-zinc-50/82 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                                  {savedPautaEntries.length} {savedPautaEntries.length === 1 ? "pauta" : "pautas"}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] font-medium leading-4 text-zinc-400">
                                {highlightedSavedPauta?.projection
                                  ? `Melhor sinal: ~${formatK(highlightedSavedPauta.projection)}`
                                  : "Pautas salvas para retomar depois."}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-[0.9fr_1.1fr] gap-2 border-t border-zinc-100 pt-3">
                            <button
                              type="button"
                              onClick={handleReturnToCreateView}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-zinc-200/70 bg-white/78 px-3 text-[11px] font-semibold text-zinc-600 transition duration-300 hover:border-zinc-300 hover:bg-white hover:text-zinc-950"
                            >
                              <ArrowLeft className="h-3 w-3" />
                              Retomar
                            </button>
                            <button
                              type="button"
                              onClick={handleResetFunnel}
                              className="funnel-dark-cta inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-zinc-950 px-3.5 text-[11px] font-semibold text-white shadow-[0_10px_22px_rgba(15,23,42,0.14)] transition duration-300 hover:bg-zinc-800 active:scale-[0.98]"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Nova pauta
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {savedPautaEntries.length ? (
                      <div className="grid gap-3">
                        {savedPautaEntries.map((entry) => {
                          const isSelected = entry.slot.slotId && entry.slot.slotId === resolvedSelectedSlotId;
                          const isDiscarding = discardingSavedPautaKey === getPlannerSlotLibraryKey(entry.slot);
                          const chipLabels = [
                            entry.contextLabel || null,
                            entry.formatLabel || null,
                            entry.windowLabel || null,
                          ].filter((label): label is string => Boolean(label));
                          return (
                            <div
                              key={entry.id}
                              className={cn(
                                "group relative w-full overflow-hidden rounded-[24px] border p-4 text-left transition-all duration-300 sm:p-5",
                                isSelected
                                  ? "border-sky-200 bg-white shadow-[0_0_0_3px_rgba(56,189,248,0.07)]"
                                  : "border-zinc-200/80 bg-white/94 shadow-[0_10px_28px_rgba(15,23,42,0.032)] hover:border-zinc-300/90 hover:bg-white"
                              )}
                            >
                              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1 transform-gpu backface-hidden antialiased">
                                  <h3 className="max-w-[24rem] text-[1.08rem] font-semibold leading-[1.18] tracking-[-0.03em] text-zinc-950 sm:text-[1.18rem]">
                                    {entry.title}
                                  </h3>
                                </div>

                                <div className="inline-flex h-7 shrink-0 items-center gap-1.5 self-start rounded-full border border-sky-100 bg-sky-50/58 px-2.5 text-[10px] transition-colors group-hover:border-sky-200 sm:self-auto">
                                  <Zap className="h-3 w-3 fill-sky-500 text-sky-500" />
                                  <span className="font-semibold text-sky-700">IA</span>
                                  <span className="font-bold tracking-tight text-zinc-900">
                                    {entry.projection ? `~${formatK(entry.projection)}` : "—"}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {chipLabels.map((label) => (
                                  <span
                                    key={label}
                                    className="max-w-[10.5rem] truncate rounded-full border border-zinc-100 bg-zinc-50/72 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-600 transition-colors group-hover:bg-white"
                                    title={label || undefined}
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>

                              <div className="mt-5 flex items-center gap-2.5 border-t border-zinc-100 pt-4">
                                <button
                                  type="button"
                                  onClick={() => handleOpenSavedPauta(entry.slot)}
                                  className={cn(
                                    FUNNEL_DARK_CTA_CLASS,
                                    "group/btn relative flex h-11 flex-1 items-center justify-center gap-2.5 overflow-hidden rounded-[16px] text-[13px] font-semibold shadow-[0_12px_26px_rgba(15,23,42,0.14)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:scale-[0.98]"
                                  )}
                                >
                                  <span className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                  <span className="relative">{entry.primaryActionLabel}</span>
                                  <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDiscardSavedPauta(entry.slot)}
                                  disabled={isDiscarding}
                                  className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-transparent bg-transparent text-zinc-300 opacity-80 transition-all duration-300 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-500 hover:opacity-100 active:scale-90 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                                  title="Descartar pauta"
                                  aria-label="Descartar pauta"
                                >
                                  <Trash2 className="h-4.5 w-4.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="relative flex flex-col items-center justify-center rounded-[32px] border border-zinc-200/60 bg-white/60 px-8 py-16 text-center shadow-sm backdrop-blur-sm">
                        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-[32px] bg-gradient-to-br from-zinc-50 to-zinc-100 shadow-inner">
                          <Sparkles className="h-10 w-10 text-zinc-300" />
                        </div>
                        <h3 className="max-w-[15ch] text-[1.85rem] font-semibold leading-[1.05] tracking-[-0.05em] text-zinc-950">
                          Sua biblioteca estratégica está vazia.
                        </h3>
                        <p className="mt-4 max-w-[32ch] text-sm leading-relaxed text-zinc-500">
                          Assim que você validar uma pauta, salve-a para que ela apareça aqui para consulta rápida e criação de roteiros.
                        </p>
                        <button
                          type="button"
                          onClick={handleResetFunnel}
                          className="mt-10 inline-flex h-14 items-center justify-center rounded-2xl bg-zinc-950 px-8 text-sm font-semibold !text-white transition duration-300 hover:bg-zinc-800 hover:shadow-xl hover:shadow-zinc-950/10 active:scale-95"
                        >
                          Criar primeira pauta
                        </button>
                      </div>
                    )}

                    {discardSavedPautaError ? (
                      <p className="text-sm text-rose-600">{discardSavedPautaError}</p>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            {boardView !== "saved" &&
              (activeStage === "path" ||
                activeStage === "idea" ||
                activeStage === "blueprint" ||
                activeStage === "published") && (
              <section
                className={cn(
                  FUNNEL_CANVAS_CLASS,
                  stageTransitionClass,
                  usesBoardSurface && "rounded-none border-0 shadow-none",
                  "relative isolate"
                )}
              >
                <FunnelAmbientBackdrop />
                {activeStage === "idea" && isSavingIdeaPauta ? (
                  <SavingIdeaOverlay />
                ) : null}
                {isRestoringDraft ? (
                  <DraftHydrationShell />
                ) : usesCompactStageSurface ? (
                  <div className="relative flex-1 overflow-y-auto px-5 pb-4 pt-4 sm:px-6 sm:pb-7">
                    <div className="mx-auto flex w-full max-w-[34rem] flex-col gap-3.5">
                      <CompactStageHeader
                        canGoPrev={canGoPrev}
                        onPrev={handlePrevStage}
                        stepLabel={
                          activeStage === "path" && activeDecisionCard
                            ? `Passo ${activeDecisionIndex + 1} de ${decisionStepCount}`
                            : "Etapa atual"
                        }
                        goalLabel={headerGoalLabel}
                        actionLabel={headerActionLabel}
                        onAction={handleHeaderAction}
                      />

                      {activeStage === "path" && activeDecisionCard ? (
                        <PathDecisionStage
                          activeDecisionCard={activeDecisionCard}
                          activeDecisionExpectedInteractions={activeDecisionExpectedInteractions}
                          advancingPathId={advancingPathId}
                          decisionTrailItems={decisionTrailItems}
                          generatedPautasError={generatedPautas.error}
                          generatedPautasStatus={generatedPautas.status}
                          isFinalPautaDecision={isFinalPautaDecision}
                          progressValue={progressValue}
                          question={activeStepMeta?.question}
                          onSelect={handleActiveDecisionOptionSelect}
                        />
                      ) : isReferenceDrawerOpen ? (
                        <ReferencePostsDrawer
                          isOpen={isReferenceDrawerOpen}
                          onClose={handleCloseReferenceDrawer}
                          onOpenPost={handleOpenReferencePost}
                          origin={selectedIdeaProjectionOrigin}
                          posts={selectedIdeaReferencePosts}
                          total={selectedIdeaReferenceTotal}
                        />
                      ) : activeStage === "idea" && selectedIdeaForProjection ? (
                        <main className="flex-1 pb-4 sm:pb-20">
                          <div className="flex flex-1 flex-col items-stretch gap-4">
                            <FunnelConfetti
                              burstKey={`idea-${selectedIdeaForProjection.id || "strategy"}`}
                              variant="success"
                              originSelector='[data-confetti-origin="post-creation-final-status"]'
                            />

                            <span className="sr-only" data-confetti-origin="post-creation-final-status">
                              {isSelectedIdeaSaved ? "Pauta salva" : "Pauta validada"}
                            </span>

                            <ProjectionSummaryCard
                              activeStage={activeStage}
                              interactions={projectedInteractions}
                              onOpenReferencePosts={handleOpenReferenceDrawer}
                              origin={selectedIdeaProjectionOrigin}
                              reach={projectedReach}
                              referencePosts={selectedIdeaReferencePosts}
                              referenceTotal={selectedIdeaReferenceTotal}
                              saves={projectedSaves}
                              shares={projectedShares}
                              supportCopy={finalProjectionSupportCopy}
                              tier={selectedIdeaTier}
                              title={selectedIdeaForProjection.title}
                            />

                            <CollabCreatorsCard
                              contextLabel={collabCreators.contextLabel}
                              items={collabCreators.items}
                              status={collabCreators.status}
                            />
                            {!canInteract ? (
                              <CollabRadarUpsellBanner onActivate={handleActivateCollabRadar} />
                            ) : null}
                            <BrandNarrativeMatchesPanel
                              compact
                              categories={brandNarrativeCategoriesPayload}
                              decision={funnelState.decision}
                              enabled={BRAND_MATCHES_ENABLED}
                              pauta={brandNarrativePautaPayload}
                            />

                            <div className="min-h-2 flex-1" />
                            <div className="mt-1 border-t border-zinc-200/60 pb-2 pt-4">
                              <IdeaActionButtons
                                buttonTone="light"
                                className="mt-0"
                                isSaving={isSavingIdeaPauta}
                                isSaved={isSelectedIdeaSaved}
                                onReset={handleResetFunnel}
                                onSave={handleSaveIdeaPauta}
                                resetLabel={isTrialViewer && trialPautaConsumed ? gatedResetLabel : "Gerar outra pauta"}
                                saveLabel={gatedSaveLabel}
                              />
                            </div>
                            {isSelectedIdeaSaved && selectedSavedPautaSlot ? (
                              <button
                                type="button"
                                onClick={() => void handleDiscardSavedPauta(selectedSavedPautaSlot)}
                                disabled={isDiscardingCurrentSavedPauta}
                                className="mx-auto -mt-1 inline-flex h-9 items-center justify-center rounded-full px-4 text-[12px] font-semibold text-rose-600 transition duration-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-default disabled:opacity-60"
                              >
                                {isDiscardingCurrentSavedPauta ? "Descartando pauta..." : "Descartar pauta salva"}
                              </button>
                            ) : null}
                            {ideaSaveError ? (
                              <p className="w-full text-sm text-rose-600">{ideaSaveError}</p>
                            ) : null}
                            {discardSavedPautaError ? (
                              <p className="w-full text-sm text-rose-600">{discardSavedPautaError}</p>
                            ) : null}
                          </div>
                        </main>
                      ) : (
                        <main className="flex-1 pb-4 sm:pb-20">
                          <div className={cn(FUNNEL_PANEL_SOFT_CLASS, "px-5 py-6 text-center text-sm text-zinc-500")}>
                            Selecione uma pauta para ver a projeção final.
                          </div>
                        </main>
                      )}
                    </div>
                  </div>
                ) : null}

                {!isRestoringDraft && !usesCompactStageSurface ? (
                <div className="relative flex-1 overflow-y-auto px-5 py-6 sm:px-6 sm:py-7">
                  {canGoPrev &&
                  (activeStageLegacySurface === "path" ||
                    activeStageLegacySurface === "idea" ||
                    activeStageLegacySurface === "blueprint") ? (
                    <button
                      type="button"
                      onClick={handlePrevStage}
                      className="absolute left-5 top-6 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 backdrop-blur-xl transition duration-300 hover:-translate-x-0.5 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950 sm:left-6"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                  ) : null}

                  <div className="space-y-6 pt-12 sm:space-y-7 sm:pt-14">
                    <div className={cn("overflow-hidden p-5 sm:p-6", FUNNEL_PANEL_CLASS)}>
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-zinc-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.07)]">
                              <ActiveStageIcon className="h-5 w-5 text-[#6366f1]" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
                                Criação de post
                              </p>
                              <h2 className="text-[1.5rem] font-semibold leading-none tracking-[-0.05em] text-zinc-950 sm:text-[1.8rem]">
                                {activeStageLegacySurface === "path"
                                  ? activeStepMeta?.question || "Qual o melhor próximo passo?"
                                  : activeStageLegacySurface === "idea"
                                    ? "Pauta pronta."
                                    : activeStageLegacySurface === "blueprint"
                                      ? "Próxima etapa."
                                      : "Resultado conectado."}
                              </h2>
                            </div>
                          </div>

                          {headerActionLabel ? (
                            <button
                              type="button"
                              onClick={handleHeaderAction}
                              className={cn(
                                "group hidden shrink-0 text-[11px] uppercase tracking-[0.18em] sm:inline-flex",
                                FUNNEL_TOP_ACTION_CLASS
                              )}
                            >
                              <Sparkles className="h-3.5 w-3.5 text-[#f9a8d4] transition-transform duration-300 group-hover:rotate-12" />
                              {headerActionLabel}
                            </button>
                          ) : null}
                        </div>

                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(17rem,0.9fr)]">
                          <div className={cn(FUNNEL_PANEL_MUTED_CLASS, "px-4 py-4 sm:px-5")}>
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                                  Progresso
                                </p>
                                <p className="mt-2 text-sm text-zinc-700">
                                  {Math.round(progressValue * 100)}% concluído
                                </p>
                              </div>
                              <div className={cn(FUNNEL_BADGE_CLASS, "py-1")}>
                                {headerGoalLabel}
                              </div>
                            </div>
                            <div className="mt-4 grid grid-cols-5 gap-2">
                              {funnelStageMeta.map((stage) => (
                                <div key={stage.id} className="space-y-2">
                                  <div
                                    className={cn(
                                      "h-2 rounded-full transition-all duration-500",
                                      stage.state === "done" &&
                                        "bg-gradient-to-r from-[#7dd3fc] via-[#818cf8] to-[#f9a8d4] shadow-[0_0_24px_rgba(129,140,248,0.38)]",
                                      stage.state === "active" && "bg-zinc-400 shadow-[0_0_20px_rgba(113,113,122,0.16)]",
                                      stage.state === "upcoming" && "bg-zinc-200"
                                    )}
                                  />
                                  <p
                                    className={cn(
                                      "text-[10px] font-medium uppercase tracking-[0.18em]",
                                      stage.state === "active" ? "text-zinc-700" : "text-zinc-400"
                                    )}
                                  >
                                    {stage.label}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className={cn(FUNNEL_PANEL_SOFT_CLASS, "px-4 py-4 sm:px-5")}>
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                                Sinal
                              </p>
                              <TrendingUp className={cn("h-4 w-4", activeDecisionTier.iconClassName)} />
                            </div>
                            <p className="mt-3 text-lg font-semibold leading-tight text-zinc-950">{stageMetricCopy}</p>
                            <p className="mt-2 text-sm leading-6 text-zinc-500">
                              {activeStageLegacySurface === "path"
                                ? `Próxima etapa: ${nextDecisionLabel}.`
                                : activeStageLegacySurface === "blueprint"
                                  ? `${completedDirectionTaskCount}/${directionTaskCount || 0} itens marcados`
                                  : activeStageLegacySurface === "published"
                                    ? "Já influencia as próximas recomendações."
                                    : "Projeção do recorte."}
                            </p>
                          </div>
                        </div>

                        {activeStageLegacySurface === "path" && decisionPathCards.length > 0 ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                                Etapas
                              </p>
                              <p className="text-xs text-zinc-500">
                                {activeDecisionIndex + 1}/{decisionPathCards.length}
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {decisionPathCards.map((card, idx) => (
                                <button
                                  key={`crumb-${card.id}`}
                                  type="button"
                                  onClick={() =>
                                    setFunnelState((current) => ({
                                      ...current,
                                      activeDecisionStep: card.id as PostCreationDecisionStep,
                                      stage: "path",
                                    }))
                                  }
                                  className={cn(
                                    "rounded-[18px] px-3 py-3 text-left transition duration-300",
                                    idx === activeDecisionIndex
                                      ? `${FUNNEL_PANEL_SOFT_CLASS} border-sky-200 bg-white`
                                      : idx < activeDecisionIndex
                                        ? `${FUNNEL_PANEL_SOFT_CLASS} border-zinc-200 bg-zinc-50 hover:bg-white`
                                        : `${FUNNEL_PANEL_SOFT_CLASS} border-zinc-200/80 bg-white/80 hover:bg-white`
                                  )}
                                >
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                                    {String(idx + 1).padStart(2, "0")}
                                  </p>
                                  <p className="mt-2 text-sm font-semibold text-zinc-950">{card.label}</p>
                                  <p className="mt-1 text-xs text-zinc-500">{truncateText(card.value, 26)}</p>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {activeStageLegacySurface === "path" && activeDecisionCard ? (
                      <div className="space-y-4">
                        <div className="space-y-2.5">
                          <DecisionTrail items={decisionTrailItems} />
                          <DecisionTrailProgress progressValue={progressValue} />
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
                              Opções
                            </p>
                          </div>
                          <div className={FUNNEL_BADGE_CLASS}>
                            {activeDecisionTier.label}
                          </div>
                        </div>

                          <div className="grid grid-cols-1 gap-4">
                          {activeDecisionCard.id === "pauta" && generatedPautas.status === "loading" ? (
                            <div className={cn(FUNNEL_PANEL_SOFT_CLASS, "px-5 py-6 text-sm text-zinc-500")}>
                              Gerando pautas com IA a partir do tema e das categorias escolhidas...
                            </div>
                          ) : null}
                          {activeDecisionCard.id === "pauta" && generatedPautas.status === "error" ? (
                            <div className={cn(FUNNEL_PANEL_SOFT_CLASS, "px-5 py-6 text-sm text-red-600")}>
                              {generatedPautas.error || "Não foi possível gerar 5 pautas com IA para este recorte."}
                            </div>
                          ) : null}
                          {activeDecisionCard.options.map((option, index) => {
                            const isSelected = option.id === activeDecisionCard.selectedId;
                            const isAdvancing = advancingPathId === `${activeDecisionCard.id}-${option.id}`;

                            return (
                              <DecisionOptionCard
                                key={`${activeDecisionCard.id}-${option.id}`}
                                step={activeDecisionCard.id as PostCreationDecisionStep}
                                option={option}
                                optionIndex={index}
                                candidateExpectedInteractions={activeDecisionExpectedInteractions}
                                isSelected={isSelected}
                                isAdvancing={isAdvancing}
                                fallbackRecommended={index === 0}
                                onSelect={handleActiveDecisionOptionSelect}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {isReferenceDrawerOpen ? (
                      <ReferencePostsDrawer
                        isOpen={isReferenceDrawerOpen}
                        onClose={handleCloseReferenceDrawer}
                        onOpenPost={handleOpenReferencePost}
                        origin={selectedIdeaProjectionOrigin}
                        posts={selectedIdeaReferencePosts}
                        total={selectedIdeaReferenceTotal}
                      />
                    ) : null}

                    {!isReferenceDrawerOpen &&
                    (activeStageLegacySurface === "idea" || activeStageLegacySurface === "published") &&
                    selectedIdeaForProjection ? (
                      <div className="flex flex-col items-center gap-6 pb-10">
                        <FunnelConfetti
                          burstKey={`${activeStage}-${selectedIdeaForProjection.id || funnelState.linkedContent?.id || "burst"}`}
                          variant={activeStage === "published" ? "success" : "aha"}
                          originSelector='[data-confetti-origin="post-creation-achievement-surface"]'
                        />

                        <div
                          className="relative flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-[28px] border border-zinc-200 bg-white shadow-[0_18px_42px_rgba(15,23,42,0.08)]"
                          data-confetti-origin="post-creation-achievement-surface"
                        >
                          <div className="absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.8),transparent_60%)]" />
                          {activeStage === "published" ? (
                            <Trophy className="relative h-10 w-10 text-amber-500 animate-float" />
                          ) : (
                            <Sparkles className="relative h-10 w-10 text-sky-500 animate-float" />
                          )}
                        </div>

                        <div className="space-y-3 text-center">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-400">
                            {activeStage === "published" ? "Resultado" : isSelectedIdeaSaved ? "Pauta salva" : "Estratégia pronta"}
                          </p>
                          <h3 className="text-[2.5rem] font-semibold leading-[0.95] tracking-[-0.07em] text-zinc-950 sm:text-[3.2rem]">
                            {activeStage === "published" ? "Post conectado." : isSelectedIdeaSaved ? "Pauta salva." : "Pauta validada."}
                          </h3>
                          <p className="mx-auto max-w-[24rem] text-base leading-7 text-zinc-500">
                            {activeStage === "published"
                              ? "A execução voltou para o funnel."
                              : isSelectedIdeaSaved
                                ? "A pauta já foi registrada no planejamento com esta configuração."
                                : "Histórico, timing e formato alinhados."}
                          </p>
                        </div>

                        <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1.28fr)_minmax(16rem,0.72fr)]">
                          <div className="dashboard-dark-spotlight group relative overflow-hidden rounded-[34px] border border-white/10 shadow-[0_24px_54px_rgba(15,23,42,0.18)]">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_36%)] opacity-70" />
                            <div className="relative rounded-[33px] bg-transparent px-6 py-7 sm:px-8 sm:py-9">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <span className="dashboard-glass-pill rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
                                  {activeStage === "published"
                                    ? "Engajamento registrado"
                                    : selectedIdeaProjectionOrigin === "branch"
                                      ? "Sinal projetado do recorte"
                                      : "Engajamento projetado"}
                                </span>
                                <span className="dashboard-glass-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white/80">
                                  <Sparkles className="h-3.5 w-3.5 text-amber-300 animate-spin-slow" />
                                  {activeStage === "published"
                                    ? "Sinal ao vivo"
                                    : selectedIdeaProjectionOrigin === "branch"
                                      ? "Base do recorte"
                                      : selectedIdeaTier.label}
                                </span>
                              </div>
                              <div className="mt-7 flex flex-wrap items-end justify-between gap-6">
                                <div>
                                  <div className="text-[4.4rem] font-semibold leading-none tracking-[-0.1em] text-white sm:text-[5.4rem]">
                                    {typeof projectedInteractions === "number" && projectedInteractions > 0
                                      ? formatK(projectedInteractions)
                                      : "—"}
                                  </div>
                                  <p className="mt-3 max-w-[24rem] text-sm leading-6 text-white/55">
                                    {selectedIdeaForProjection.title || "Pauta em destaque"}
                                  </p>
                                </div>
                                <div className="dashboard-glass-pill rounded-[1.25rem] px-4 py-4">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
                                    Leitura
                                  </p>
                                  <p className="mt-2 text-sm font-semibold text-white">
                                    {selectedIdeaForProjection.description
                                      ? truncateText(selectedIdeaForProjection.description, 90)
                                      : finalProjectionSupportCopy}
                                  </p>
                                </div>
                              </div>
                              {selectedIdeaReferenceTotal > 0 ? (
                                <button
                                  type="button"
                                  onClick={handleOpenReferenceDrawer}
                                  className="dashboard-glass-pill group mt-5 w-full rounded-[1.25rem] px-4 py-3.5 text-left transition duration-300 hover:bg-white/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                                  aria-label={`Ver ${selectedIdeaReferenceTotal} posts similares usados como base da projeção`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="line-clamp-1 text-sm font-semibold text-white">
                                        {selectedIdeaReferenceTotal}{" "}
                                        {selectedIdeaReferenceTotal === 1 ? "post similar" : "posts similares"}
                                      </p>
                                    </div>
                                    <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 text-[10px] font-semibold text-sky-100 transition group-hover:border-white/25 group-hover:bg-white/15 group-hover:text-white">
                                      Referências
                                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                                    </span>
                                  </div>
                                  <div className="mt-3 flex items-center">
                                    <EvidenceThumbStrip
                                      labelText={null}
                                      maxVisible={5}
                                      posts={selectedIdeaReferencePosts}
                                      size="lg"
                                      total={selectedIdeaReferenceTotal}
                                    />
                                  </div>
                                </button>
                              ) : null}
                            </div>
                          </div>

                          <SurfaceMetricsGrid
                            reach={projectedReach}
                            saves={projectedSaves}
                            shares={projectedShares}
                          />
                        </div>

                        {isSelectedIdeaSaved ? (
                          <div className="w-full rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-emerald-200 bg-white">
                                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                                </div>
                              <div>
                                <p className="text-sm font-semibold text-emerald-700">Pauta salva no planejamento</p>
                                <p className="mt-1 text-sm leading-6 text-zinc-600">
                                  Esta pauta já está registrada com dia, hora, formato e categorias escolhidas.
                                </p>
                              </div>
                            </div>
                            {selectedSavedPautaSlot ? (
                              <button
                                type="button"
                                onClick={() => void handleDiscardSavedPauta(selectedSavedPautaSlot)}
                                disabled={isDiscardingCurrentSavedPauta}
                                className="mt-4 text-sm font-semibold text-rose-700 transition duration-300 hover:text-rose-800 disabled:cursor-default disabled:opacity-70"
                              >
                                {isDiscardingCurrentSavedPauta ? "Descartando pauta..." : "Descartar pauta salva"}
                              </button>
                            ) : null}
                          </div>
                        ) : null}

                        <AchievementBadgeCards badges={achievementBadges} />

                        {activeStageLegacySurface === "idea" ? (
                          <ConfigurationGrid items={selectedConfigurationItems} />
                        ) : null}

                        {activeStageLegacySurface === "idea" ? (
                          <BrandNarrativeMatchesPanel
                            categories={brandNarrativeCategoriesPayload}
                            decision={funnelState.decision}
                            enabled={BRAND_MATCHES_ENABLED}
                            pauta={brandNarrativePautaPayload}
                          />
                        ) : null}

                        <IdeaActionButtons
                          hasPostLink={Boolean(funnelState.linkedContent?.postLink)}
                          isPublished={activeStageLegacySurface !== "idea"}
                          isSaving={isSavingIdeaPauta}
                          isSaved={isSelectedIdeaSaved}
                          onOpenPublished={handleOpenPublishedStep}
                          onOpenLinkGallery={handleOpenLinkGallery}
                          onReset={handleResetFunnel}
                          onSave={handleSaveIdeaPauta}
                          resetLabel={gatedResetLabel}
                          saveLabel={gatedSaveLabel}
                        />
                        {discardSavedPautaError ? (
                          <p className="w-full text-sm text-rose-600">{discardSavedPautaError}</p>
                        ) : null}
                        {activeStageLegacySurface === "idea" && ideaSaveError ? (
                          <p className="w-full text-sm text-rose-600">{ideaSaveError}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {activeStage === "blueprint" ? (
                      activeBlueprint ? (
                        <div className="space-y-5">
                          <div className={cn(FUNNEL_PANEL_CLASS, "px-5 py-5 sm:px-6 sm:py-6")}>
                            <div className="flex flex-col gap-5">
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="max-w-[44rem]">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                                      Direção
                                    </span>
                                    <span className={cn(FUNNEL_BADGE_CLASS, "py-1 text-[11px] uppercase tracking-[0.18em]")}>
                                      {stageMetricCopy}
                                    </span>
                                  </div>
                                  <h3 className="mt-4 text-[1.75rem] font-semibold leading-[1.02] tracking-[-0.06em] text-zinc-950 sm:text-[2rem]">
                                    {truncateText(activeBlueprint.whatToPost, 96)}
                                  </h3>
                                  <p className="mt-3 text-sm leading-6 text-zinc-500">
                                    {truncateText(activeBlueprint.whyThisPath, 150)}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={handleBlueprintScriptAction}
                                  disabled={
                                    isGeneratingBlueprintScript ||
                                    Boolean(linkedBlueprintScript?.id && hasInlineBlueprintScriptDraft)
                                  }
                                  className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[18px] border border-zinc-950/90 bg-zinc-950 px-4 text-sm font-semibold text-white transition duration-300 hover:bg-zinc-900 hover:shadow-[0_14px_30px_rgba(15,23,42,0.12)] disabled:cursor-default disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500 sm:min-w-[14rem]"
                                >
                                  {isGeneratingBlueprintScript ? (
                                    <>
                                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                      Gerando...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="h-4 w-4" />
                                      {blueprintPrimaryActionLabel}
                                    </>
                                  )}
                                </button>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-3">
                                {[
                                  { label: "Janela", value: activeBlueprint.whenToPost, icon: Clock },
                                  {
                                    label: "Estrutura",
                                    value: truncateText(activeBlueprint.howItShouldWork, 72),
                                    icon: MessageSquare,
                                  },
                                  {
                                    label: "Progresso",
                                    value: `${completedDirectionTaskCount}/${directionTaskCount || 0} itens`,
                                    icon: CheckCircle2,
                                  },
                                ].map((item) => (
                                  <div
                                    key={item.label}
                                    className={cn(FUNNEL_PANEL_MUTED_CLASS, "px-4 py-4")}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                                        {item.label}
                                      </p>
                                      <item.icon className="h-4 w-4 text-zinc-500" />
                                    </div>
                                    <p className="mt-3 text-sm font-semibold leading-6 text-zinc-950">
                                      {item.value}
                                    </p>
                                  </div>
                                ))}
                              </div>

                              <p className="text-sm leading-6 text-zinc-500">{blueprintScriptSupportCopy}</p>
                              {blueprintActionError ? (
                                <p className="text-sm text-rose-600">{blueprintActionError}</p>
                              ) : null}
                            </div>
                          </div>

                          {hasInlineBlueprintScriptDraft ? (
                            <div className={cn("overflow-hidden", FUNNEL_PANEL_CLASS)}>
                              <div className="border-b border-zinc-200/80 px-5 py-5 sm:px-6">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                                    Roteiro IA
                                  </span>
                                  {blueprintInlineDraftSaved ? (
                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                                      Roteiro salvo
                                    </span>
                                  ) : null}
                                </div>
                                <h4 className="mt-3 text-[1.35rem] font-semibold tracking-[-0.04em] text-zinc-950">
                                  Edite o roteiro aqui
                                </h4>
                                <p className="mt-2 text-sm leading-6 text-zinc-500">
                                  Ajuste a abertura, corte excessos e salve sem sair desta etapa.
                                </p>
                              </div>

                              <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
                                <label className="grid gap-2">
                                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                                    Título
                                  </span>
                                  <input
                                    type="text"
                                    value={inlineBlueprintScriptDraft?.title || ""}
                                    onChange={(event) =>
                                      handleBlueprintScriptDraftChange("title", event.target.value)
                                    }
                                    className={FUNNEL_INPUT_CLASS}
                                    placeholder="Defina um título curto para este roteiro"
                                  />
                                </label>

                                <label className="grid gap-2">
                                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                                    Texto do roteiro
                                  </span>
                                  <textarea
                                    value={inlineBlueprintScriptDraft?.content || ""}
                                    onChange={(event) =>
                                      handleBlueprintScriptDraftChange("content", event.target.value)
                                    }
                                    rows={16}
                                    className={FUNNEL_TEXTAREA_CLASS}
                                    placeholder="O roteiro gerado vai aparecer aqui."
                                  />
                                </label>

                                <div className="flex flex-col gap-3 border-t border-zinc-200/80 pt-5 sm:flex-row sm:items-center sm:justify-between">
                                  <p className="text-sm leading-6 text-zinc-500">
                                    {blueprintInlineDraftSaved
                                      ? "O roteiro já está salvo. Você pode continuar refinando o texto aqui."
                                      : "Salve quando o texto estiver pronto para seguir."}
                                  </p>

                                  <button
                                    type="button"
                                    onClick={handleSaveBlueprintScript}
                                    disabled={isSavingBlueprintScript}
                                    className="inline-flex h-12 items-center justify-center gap-2 rounded-[18px] border border-zinc-950/90 bg-zinc-950 px-5 text-sm font-semibold text-white transition duration-300 hover:bg-zinc-900 hover:shadow-[0_14px_30px_rgba(15,23,42,0.12)] disabled:cursor-wait disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500"
                                  >
                                    {isSavingBlueprintScript ? (
                                      <>
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                        Salvando roteiro...
                                      </>
                                    ) : (
                                      <>
                                        <PenTool className="h-4 w-4" />
                                        Salvar roteiro
                                      </>
                                    )}
                                  </button>
                                </div>

                                {blueprintSaveError ? (
                                  <p className="text-sm text-rose-600">{blueprintSaveError}</p>
                                ) : null}
                              </div>
                            </div>
                          ) : (
                            <div className={cn(FUNNEL_PANEL_CLASS, "border-dashed px-5 py-6 sm:px-6")}>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                                Roteiro
                              </p>
                              <h4 className="mt-3 text-[1.45rem] font-semibold leading-[1.04] tracking-[-0.04em] text-zinc-950">
                                Gere o roteiro para editar e salvar aqui mesmo.
                              </h4>
                              <p className="mt-3 max-w-[42rem] text-sm leading-6 text-zinc-500">
                                Nada precisa abrir em outra tela. Quando você gerar, o editor aparece preenchido nesta mesma etapa.
                              </p>
                            </div>
                          )}

                          <div className="grid gap-5 lg:grid-cols-2">
                            <div className={cn(FUNNEL_PANEL_CLASS, "px-5 py-5 sm:px-6")}>
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-zinc-900">
                                  <Video className="h-4 w-4 text-sky-300" />
                                  <p className="text-sm font-semibold">Cenas</p>
                                </div>
                                <span className="text-xs font-semibold text-zinc-400">
                                  {completedSceneIds.length}/{activeBlueprint.scenes.length}
                                </span>
                              </div>
                              <div className="mt-4 space-y-2.5">
                                {activeBlueprint.scenes.map((scene, index) => {
                                  const checked = completedSceneIds.includes(scene.id);
                                  return (
                                    <button
                                      key={scene.id}
                                      type="button"
                                      onClick={() => toggleChecklistItem("scene", scene.id)}
                                      className={cn(
                                        "flex w-full items-start gap-3 rounded-[18px] px-3 py-3 text-left transition duration-300",
                                        checked
                                          ? "bg-emerald-50 text-zinc-950"
                                          : "bg-zinc-50 text-zinc-700 hover:bg-white hover:text-zinc-950"
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold",
                                          checked
                                            ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                                            : "border-zinc-200 bg-white text-zinc-400"
                                        )}
                                      >
                                        {checked ? <Check className="h-3.5 w-3.5" /> : String(index + 1).padStart(2, "0")}
                                      </span>
                                      <span className="min-w-0">
                                        <span className="block text-sm font-semibold text-zinc-950">{scene.title}</span>
                                        <span className="mt-1 block text-xs leading-5 text-zinc-500">
                                          {truncateText(scene.visual || scene.message, 78)}
                                        </span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="space-y-5">
                              {hookVariations.length ? (
                                <div className={cn(FUNNEL_PANEL_CLASS, "px-5 py-5 sm:px-6")}>
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-zinc-900">
                                      <Lightbulb className="h-4 w-4 text-amber-300" />
                                      <p className="text-sm font-semibold">Aberturas</p>
                                    </div>
                                    <span className="text-xs font-semibold text-zinc-400">
                                      {completedHookIds.length}/{hookVariations.length}
                                    </span>
                                  </div>
                                  <div className="mt-4 space-y-2.5">
                                    {hookVariations.map((hook) => {
                                      const checked = completedHookIds.includes(hook.id);
                                      return (
                                        <button
                                          key={hook.id}
                                          type="button"
                                          onClick={() => toggleChecklistItem("hook", hook.id)}
                                          className={cn(
                                            "flex w-full items-start gap-3 rounded-[18px] px-3 py-3 text-left transition duration-300",
                                            checked
                                              ? "bg-sky-50 text-zinc-950"
                                              : "bg-zinc-50 text-zinc-700 hover:bg-white hover:text-zinc-950"
                                          )}
                                        >
                                          <span className="mt-0.5 text-zinc-500">
                                            {checked ? (
                                              <CheckCircle2 className="h-4.5 w-4.5 text-sky-300" />
                                            ) : (
                                              <Circle className="h-4.5 w-4.5" />
                                            )}
                                          </span>
                                          <span className="min-w-0">
                                            <span className="block text-sm font-semibold text-zinc-950">{hook.title}</span>
                                            <span className="mt-1 block text-xs leading-5 text-zinc-500">
                                              {truncateText(hook.detail, 78)}
                                            </span>
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}

                              <div className={cn(FUNNEL_PANEL_CLASS, "px-5 py-5 sm:px-6")}>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                                  Ajustes rápidos
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {[
                                    { label: "Deixar mais simples", id: "simplify" },
                                    { label: "Abrir mais direto", id: "direct" },
                                  ].map((adjustment) => (
                                    <button
                                      key={adjustment.id}
                                      type="button"
                                      onClick={() =>
                                        handleBlueprintAdjustment(adjustment.id as PostCreationBlueprintAdjustment)
                                      }
                                      className={cn(FUNNEL_TOP_ACTION_CLASS, "h-auto px-3 py-2 text-xs")}
                                    >
                                      {adjustment.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-48 items-center justify-center rounded-[28px] border border-dashed border-zinc-200 bg-white/70 px-6 text-center text-sm leading-7 text-zinc-500">
                          Escolha a pauta que mais vale abrir agora para montar a direção do conteúdo.
                        </div>
                      )
                    ) : null}

                    {showLinkGallery ? (
                      <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
                        <div
                          className="absolute inset-0 bg-black/68 backdrop-blur-md"
                          onClick={() => setShowLinkGallery(false)}
                        />
                        <div className="relative w-full max-w-[540px] funnel-stage-transition funnel-stage-transition-forward">
                          <FunnelPostLinkGallery
                            options={contentOptions}
                            loading={contentOptionsLoading}
                            selectedId={funnelState.linkedContent?.id}
                            onClose={() => setShowLinkGallery(false)}
                            onSelect={handleFunnelContentLinked}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                ) : null}
              </section>
            )}

            {(activeStage === "script" || activeStage === "published") && (
              <section
                className={cn(
                  FUNNEL_CANVAS_CLASS,
                  stageTransitionClass,
                  usesBoardSurface && "rounded-none border-0 shadow-none"
                )}
              >
                <div className="border-b border-white/8 px-5 pb-4 pt-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={handlePrevStage}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/80 transition duration-300 hover:bg-white/[0.09] hover:text-white"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/34">Workspace</p>
                        <h2 className="mt-2 text-[1.1rem] font-semibold tracking-[-0.03em] text-white">
                          {activeStage === "published" ? "Roteiro + publicação" : "Refino do roteiro"}
                        </h2>
                        <p className="mt-2 max-w-[42rem] text-sm leading-6 text-white/56">
                          {activeStage === "published"
                            ? activePublishedLabel
                            : "Abra o roteiro gerado, ajuste a execução e vincule o conteúdo quando estiver no ar."}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {activeStage === "published" ? (
                        <>
                          <button
                            type="button"
                            onClick={handleOpenPublishedStep}
                            className="rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/78 transition duration-300 hover:bg-white/[0.1] hover:text-white"
                          >
                            Abrir post
                          </button>
                          <button
                            type="button"
                            onClick={handleOpenLinkGallery}
                            className="rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/78 transition duration-300 hover:bg-white/[0.1] hover:text-white"
                          >
                            Trocar vínculo
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-full rounded-full bg-gradient-to-r from-[#38bdf8] via-[#818cf8] to-[#f472b6]" />
                  </div>

                  {activeStage === "published" ? (
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/55">
                      {linkedContentDateLabel ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">
                          {linkedContentDateLabel}
                        </span>
                      ) : null}
                      {linkedContentInteractionsLabel ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">
                          {linkedContentInteractionsLabel} interações
                        </span>
                      ) : null}
                      {linkedContentEngagementLabel ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">
                          {linkedContentEngagementLabel}% engaj.
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                  <div className="h-full rounded-[24px] border border-zinc-100 bg-white p-2 shadow-[0_20px_40px_rgba(24,24,27,0.06)] sm:rounded-[28px]">
                    {isScriptsSurfaceReady ? (
                      <MyScriptsPage
                        compactView
                        viewer={normalizedViewer as any}
                        canInteract={canInteract}
                        showPreviewBanner={!isPreviewMode}
                        viewerPending={viewerPending}
                        previewMode={isPreviewMode}
                        initialInstagramConnected={Boolean(normalizedViewer.instagramConnected ?? initialInstagramConnected)}
                        requestedScriptId={resolvedSelectedScriptId}
                        onFunnelScriptOpen={handleFunnelScriptOpen}
                        onFunnelScriptSaved={handleFunnelScriptSaved}
                        onFunnelContentLinked={handleScriptPageContentLinked}
                      />
                    ) : (
                      <ScriptsStageSurfaceSkeleton />
                    )}
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>

		        {shouldShowActivationOverlay ? (
		          <PostCreationPreviewOverlay
		            activationPending={activationPending}
		            activationError={activationError}
            onActivate={(acceptedLegal) => {
              onActivatePreview?.(acceptedLegal);
            }}
          />
        ) : null}
      </div>

      <PostDetailModal
        isOpen={selectedReferencePostId !== null}
        onClose={handleCloseReferencePost}
        postId={selectedReferencePostId}
        publicMode
      />

      <style jsx global>{`
        @keyframes funnel-shimmer {
          0% {
            transform: translateX(-120%) skewX(-20deg);
          }
          100% {
            transform: translateX(220%) skewX(-20deg);
          }
        }

        @keyframes funnel-float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes funnel-pulse-slow {
          0%,
          100% {
            opacity: 0.72;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.06);
          }
        }

        @keyframes funnel-stage-forward {
          0% {
            opacity: 0;
            transform: translate3d(18px, 28px, 0) scale(0.975);
          }
          68% {
            opacity: 1;
            transform: translate3d(-4px, -6px, 0) scale(1.01);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @keyframes funnel-stage-backward {
          0% {
            opacity: 0;
            transform: translate3d(-18px, 28px, 0) scale(0.975);
          }
          68% {
            opacity: 1;
            transform: translate3d(4px, -6px, 0) scale(1.01);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        .animate-shimmer {
          animation: funnel-shimmer 2.8s linear infinite;
        }

        .animate-float {
          animation: funnel-float 4s ease-in-out infinite;
        }

        .animate-pulse-slow {
          animation: funnel-pulse-slow 2.8s ease-in-out infinite;
        }

        .animate-spin-slow {
          animation: spin 6s linear infinite;
        }

        .funnel-stage-transition {
          will-change: auto;
        }

        .post-creation-funnel-light [class~="transform-gpu"] {
          transform: none;
        }

        .post-creation-funnel-light [class~="backface-hidden"] {
          backface-visibility: visible;
        }

        .post-creation-funnel-light [class~="antialiased"] {
          -webkit-font-smoothing: auto;
          -moz-osx-font-smoothing: auto;
        }

        .post-creation-funnel-light [class~="will-change-transform"] {
          will-change: auto;
        }

        .funnel-stage-transition-forward {
          animation: funnel-stage-forward 620ms cubic-bezier(0.2, 0.9, 0.2, 1) both;
        }

        .funnel-stage-transition-backward {
          animation: funnel-stage-backward 620ms cubic-bezier(0.2, 0.9, 0.2, 1) both;
        }

        .post-creation-funnel-light .text-white,
        .post-creation-funnel-light [class*="text-white/9"],
        .post-creation-funnel-light [class*="text-white/8"],
        .post-creation-funnel-light [class*="text-white/7"] {
          color: rgba(24, 24, 27, 0.96) !important;
        }

        .post-creation-funnel-light [class*="text-white/6"],
        .post-creation-funnel-light [class*="text-white/5"] {
          color: rgba(63, 63, 70, 0.86) !important;
        }

        .post-creation-funnel-light [class*="text-white/4"],
        .post-creation-funnel-light [class*="text-white/3"] {
          color: rgba(113, 113, 122, 0.92) !important;
        }

        .post-creation-funnel-light [class*="border-white/"] {
          border-color: rgba(203, 213, 225, 0.95) !important;
        }

        .post-creation-funnel-light [class*="bg-black/20"] {
          background-color: rgba(248, 250, 252, 0.94) !important;
        }

        .post-creation-funnel-light [class*="bg-[#090b10]/"],
        .post-creation-funnel-light [class*="bg-[#040507]/"] {
          background: rgba(255, 255, 255, 0.92) !important;
        }

        .post-creation-funnel-light .funnel-canvas [class*="bg-white/[0.0"],
        .post-creation-funnel-light .funnel-canvas [class*="bg-white/[0.1"] {
          background-color: rgba(255, 255, 255, 0.82) !important;
        }

        .post-creation-funnel-light .funnel-canvas [class*="shadow-[0_24px_80px_rgba(0,0,0,0.35)]"],
        .post-creation-funnel-light .funnel-canvas [class*="shadow-[0_24px_70px_rgba(0,0,0,0.42)]"],
        .post-creation-funnel-light .funnel-canvas [class*="shadow-[0_12px_30px_rgba(0,0,0,0.22)]"] {
          box-shadow: 0 18px 42px rgba(15, 23, 42, 0.09) !important;
        }

        .post-creation-funnel-light .dashboard-dark-spotlight,
        .post-creation-funnel-light .dashboard-dark-spotlight .text-white,
        .post-creation-funnel-light .dashboard-dark-spotlight [class*="text-white/9"],
        .post-creation-funnel-light .dashboard-dark-spotlight [class*="text-white/8"],
        .post-creation-funnel-light .dashboard-dark-spotlight [class*="text-white/7"] {
          color: rgba(255, 255, 255, 0.96) !important;
        }

        .post-creation-funnel-light .dashboard-dark-spotlight [class*="text-white/6"],
        .post-creation-funnel-light .dashboard-dark-spotlight [class*="text-white/5"],
        .post-creation-funnel-light .dashboard-dark-spotlight [class*="text-white/4"],
        .post-creation-funnel-light .dashboard-dark-spotlight [class*="text-white/3"] {
          color: rgba(255, 255, 255, 0.74) !important;
        }

        .post-creation-funnel-light .dashboard-dark-spotlight [class*="border-white/"] {
          border-color: rgba(255, 255, 255, 0.16) !important;
        }

        .post-creation-funnel-light .dashboard-dark-spotlight [class*="bg-white/[0.0"],
        .post-creation-funnel-light .dashboard-dark-spotlight [class*="bg-white/[0.1"] {
          background-color: rgba(255, 255, 255, 0.08) !important;
        }

        .post-creation-funnel-light .dashboard-dark-spotlight .dashboard-glass-pill {
          border-color: rgba(255, 255, 255, 0.14) !important;
          background: rgba(255, 255, 255, 0.08) !important;
        }

        .post-creation-funnel-light .funnel-dark-cta,
        .post-creation-funnel-light .funnel-dark-cta *,
        .post-creation-funnel-light .funnel-dark-cta:hover,
        .post-creation-funnel-light .funnel-dark-cta:hover * {
          color: rgba(255, 255, 255, 0.98) !important;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}
