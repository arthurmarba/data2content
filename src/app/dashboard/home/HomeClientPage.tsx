// src/app/dashboard/home/HomeClientPage.tsx
// Container client-side da Home com dados placeholders (MVP scaffolding).

"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  FaBullhorn,
  FaCalendarAlt,
  FaCalculator,
  FaChevronDown,
  FaChartLine,
  FaGem,
  FaHandshake,
  FaInstagram,
  FaLink,
  FaMagic,
  FaPuzzlePiece,
  FaRocket,
  FaRobot,
  FaShieldAlt,
  FaUsers,
  FaLock,
  FaExternalLinkAlt,
  FaGlobe,
  FaWhatsapp,
  FaTimes,
  FaCheckCircle,
  FaChevronRight,
  FaVideo,
  FaRegEdit,
  FaRegChartBar,
} from "react-icons/fa";
import type { IconType } from "react-icons";
import { INSTAGRAM_READ_ONLY_COPY } from "@/app/constants/trustCopy";
import { useFeatureFlag } from "@/app/context/FeatureFlagsContext";
import type { PaywallContext, PaywallEventDetail } from "@/types/paywall";

import ActionButton from "./components/ActionButton";
import type { CommunityMetricsCardData, HomeSummaryResponse, JourneyStepId } from "./types";
import { useHomeTelemetry } from "./useHomeTelemetry";
import type { DashboardCtaTarget, DashboardCtaSurface } from "./useHomeTelemetry";
import MinimalDashboard from "./minimal/MinimalDashboard";
import WhatsAppConnectInline from "../WhatsAppConnectInline";
import { useHeaderSetup } from "../context/HeaderContext";
import TutorialProgress, { type TutorialProgressStep } from "./tutorial/TutorialProgress";
import CreatorToolsGrid from "./tutorial/CreatorToolsGrid";
import type { CreatorToolCardProps } from "./tutorial/CreatorToolCard";

const SurveyModal = dynamic(() => import("./minimal/SurveyModal"), {
  ssr: false,
  loading: () => null,
});

type Period = CommunityMetricsCardData["period"];
type SummaryScope = "all" | "core" | "performance" | "proposals" | "community";
const DEFAULT_PERIOD: Period = "30d";
const TRIAL_CTA_LABEL = "⚡ Ativar alertas no WhatsApp";
const HOME_WELCOME_STORAGE_KEY = "home_welcome_dismissed";
const VIP_WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/CKTT84ZHEouKyXoDxIJI4c";
const PAID_PRO_NORMALIZED_STATUSES = new Set(["active", "non_renewing"]);
const BRAND_POSITIONING =
  "Data2Content: a agência estratégica que te ajuda a criar conteúdo para atrair marcas e te conecta com outros criadores para crescerem juntos.";
const BRAND_SUPPORT_PROMISE =
  "Fazemos reuniões semanais de revisão de roteiro e conteúdo, com acompanhamento personalizado gerido pela plataforma.";

type HeroAction = {
  key: string;
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  variant: "primary" | "secondary" | "ghost" | "whatsapp" | "pro" | "vip";
};

type StepStatus = "done" | "in-progress" | "todo" | "loading";

interface JourneyStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: StepStatus;
  actionLabel: string;
  action: () => void;
  variant: "primary" | "secondary" | "ghost" | "vip" | "whatsapp" | "pro";
  disabled?: boolean;
  metric?: string;
  helper?: string;
}

const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  done: "Feito",
  "in-progress": "Em andamento",
  todo: "Próximo passo",
  loading: "Carregando...",
};

const STEP_STATUS_ICONS: Record<StepStatus, string> = {
  done: "✅",
  "in-progress": "🟡",
  todo: "⚪",
  loading: "⏳",
};

type MicroInsightCardState = {
  message: string;
  contextLabel: string | null;
  impactLabel: string | null;
  ctaLabel?: string;
  variant: "primary" | "secondary";
  footnote?: string;
  teaser?: { label: string; blurred: boolean };
};

const PERCENT_HIGHLIGHT_REGEX = /(\+?\d{1,3})%/;
const TIME_WINDOW_REGEX = /\d{1,2}h(?:\s*[–-]\s*\d{1,2}h)?/u;

const TUTORIAL_STEP_ICONS: Record<JourneyStepId, IconType> = {
  connect_instagram: FaInstagram,
  create_media_kit: FaMagic,
  publish_media_kit_link: FaLink,
  personalize_support: FaRobot,
  activate_pro: FaGem,
};

const JOURNEY_STEP_COPY: Record<
  JourneyStepId,
  { stepHelper: string; ctaLabel: string }
> = {
  connect_instagram: {
    stepHelper: "Conecte seu Instagram para gerar seu diagnóstico estratégico e mapear oportunidades com marcas.",
    ctaLabel: "Conectar Instagram",
  },
  create_media_kit: {
    stepHelper: "Monte seu Mídia Kit com posicionamento, métricas e provas para negociar com marcas com clareza.",
    ctaLabel: "Criar mídia kit",
  },
  publish_media_kit_link: {
    stepHelper: "Publique o link do kit na bio e nas propostas para transformar visitas em contatos comerciais.",
    ctaLabel: "Copiar link do kit",
  },
  personalize_support: {
    stepHelper: "Responda a personalização (2 min) para orientar IA, revisão de roteiro e suporte ao seu momento.",
    ctaLabel: "Personalizar suporte",
  },
  activate_pro: {
    stepHelper:
      "Ative o Plano Pro para acompanhamento contínuo: IA aplicada, reuniões semanais e revisão personalizada de conteúdo.",
    ctaLabel: "Ativar Plano Pro",
  },
};

const JOURNEY_DEFAULT_CTA = {
  idleLabel: "Ver campanhas",
  fallbackLabel: "Continuar jornada",
};

function extractInsightHighlight(text?: string | null): string | null {
  if (!text) return null;
  const percentMatch = text.match(PERCENT_HIGHLIGHT_REGEX);
  if (percentMatch?.[1]) return `${percentMatch[1]}%`;
  const timeMatch = text.match(TIME_WINDOW_REGEX);
  if (timeMatch?.[0]) return timeMatch[0];
  return null;
}

function buildTrialCtaLabel(): string {
  return TRIAL_CTA_LABEL;
}
function formatCountdownLabel(ms: number): string {
  if (ms <= 60_000) return "menos de 1m";
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(minutes, 1)}m`;
}

export default function HomeClientPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const {
    trackCardAction,
    trackHeroAction,
    trackSurfaceView,
    trackWhatsappEvent,
    trackDashboardCta,
    trackTutorialStep,
    trackHomeCard,
  } = useHomeTelemetry();
  const searchParams = useSearchParams();

  const [showWelcomeCard, setShowWelcomeCard] = React.useState(false);
  const [isHydrated, setIsHydrated] = React.useState(false);
  const onboardingCompletionRequested = React.useRef(false);
  const [showSurveyModal, setShowSurveyModal] = React.useState(false);
  const isNewUser = Boolean(session?.user?.isNewUserForOnboarding);
  const focusIntent = searchParams?.get("intent")?.toLowerCase() ?? null;
  const sessionUserId = session?.user?.id ?? null;

  const [summary, setSummary] = React.useState<HomeSummaryResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingSections, setLoadingSections] = React.useState({
    proposals: false,
    performance: false,
  });
  const [initialFetch, setInitialFetch] = React.useState(false);
  const [showWhatsAppConnect, setShowWhatsAppConnect] = React.useState(false);
  const [resolvingVipAccess, setResolvingVipAccess] = React.useState(false);
  const [confirmingVipJoin, setConfirmingVipJoin] = React.useState(false);
  const communityFlag = useFeatureFlag("modules.community_on_home", true);
  const planningFlag = useFeatureFlag("planning.group_locked", false);
  const dashboardMinimalFlag = useFeatureFlag("nav.dashboard_minimal", false);
  const tutorialHomeFlag = useFeatureFlag("home.tutorial_minimal", false);
  const communityOnHome = communityFlag.enabled;
  const planningGroupLocked = planningFlag.enabled;
  const dashboardMinimal = dashboardMinimalFlag.enabled;
  const tutorialHomeEnabled = tutorialHomeFlag.enabled;
  const appendQueryParam = React.useCallback((url: string, key: string, value: string) => {
    if (!value) return url;
    try {
      const [path, search = ""] = url.split("?");
      const params = new URLSearchParams(search);
      params.set(key, value);
      const query = params.toString();
      return query ? `${path}?${query}` : path;
    } catch {
      return url;
    }
  }, []);

  const fetchSummary = React.useCallback(
    async (period: Period, scope: SummaryScope = "all") => {
      const params = new URLSearchParams();
      params.set("period", period);
      if (scope === "core") params.set("scope", "core");
      if (scope === "performance") params.set("scope", "performance");
      if (scope === "community") params.set("scope", "community");
      if (scope === "proposals") params.set("scope", "proposals");

      const res = await fetch(`/api/dashboard/home/summary?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Falha ao carregar (${res.status})`);
      }

      const payload = await res.json();
      if (!payload?.ok) {
        throw new Error(payload?.error || "Não foi possível carregar os cards.");
      }

      return payload.data as Partial<HomeSummaryResponse>;
    },
    []
  );

  const setSectionLoading = React.useCallback(
    (section: "proposals" | "performance", value: boolean) => {
      setLoadingSections((prev) => {
        if (prev[section] === value) return prev;
        return { ...prev, [section]: value };
      });
    },
    []
  );

  const refreshProposalsSummary = React.useCallback(
    async (options?: { silent?: boolean }) => {
      setSectionLoading("proposals", true);
      try {
        const data = await fetchSummary(DEFAULT_PERIOD, "proposals");
        setSummary((prev) => ({
          ...(prev ?? ({} as HomeSummaryResponse)),
          ...data,
        }));
      } catch (error: any) {
        if (!options?.silent) {
          const message = error?.message || "Não foi possível atualizar suas propostas.";
          toast.error(message);
        }
        throw error;
      } finally {
        setSectionLoading("proposals", false);
      }
    },
    [fetchSummary, setSectionLoading]
  );

  const trackMinimalCta = React.useCallback(
    (target: DashboardCtaTarget, surface: DashboardCtaSurface, extra?: Record<string, unknown>) => {
      trackDashboardCta(target, { creator_id: sessionUserId ?? null, surface, ...extra });
    },
    [sessionUserId, trackDashboardCta]
  );

  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  React.useEffect(() => {
    if (dashboardMinimal) {
      setShowWelcomeCard(false);
      return;
    }
    if (!isNewUser) {
      setShowWelcomeCard(false);
      return;
    }
    if (typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem(HOME_WELCOME_STORAGE_KEY) === "1";
    if (!dismissed) {
      setShowWelcomeCard(true);
    }
  }, [dashboardMinimal, isNewUser]);

  React.useEffect(() => {
    if (status !== "authenticated" || initialFetch) return;
    let cancelled = false;
    const mergeSummary = (data: Partial<HomeSummaryResponse>) => {
      if (cancelled) return;
      setSummary((prev) => ({
        ...(prev ?? ({} as HomeSummaryResponse)),
        ...data,
      }));
    };

    const loadBackgroundScope = async (scope: "proposals" | "performance") => {
      setSectionLoading(scope, true);
      try {
        const data = await fetchSummary(DEFAULT_PERIOD, scope);
        mergeSummary(data);
      } catch {
        // Carregamento em segundo plano não deve bloquear a Home.
      } finally {
        if (!cancelled) {
          setSectionLoading(scope, false);
        }
      }
    };

    const loadInitial = async () => {
      setLoading(true);
      setLoadingSections({ proposals: false, performance: false });

      try {
        const coreData = await fetchSummary(DEFAULT_PERIOD, "core");
        if (cancelled) return;
        mergeSummary(coreData);
        setInitialFetch(true);
      } catch (coreError: any) {
        if (cancelled) return;
        try {
          const fallbackData = await fetchSummary(DEFAULT_PERIOD, "all");
          if (cancelled) return;
          mergeSummary(fallbackData);
          setInitialFetch(true);
        } catch (fallbackError: any) {
          if (!cancelled) {
            toast.error(fallbackError?.message || coreError?.message || "Não foi possível carregar a Home.");
          }
          return;
        }
      } finally {
        if (!cancelled) setLoading(false);
      }

      if (cancelled) return;
      void Promise.allSettled([
        loadBackgroundScope("proposals"),
        loadBackgroundScope("performance"),
      ]);
    };

    void loadInitial();

    return () => {
      cancelled = true;
    };
  }, [status, initialFetch, fetchSummary, setSectionLoading]);

  const handleNavigate = React.useCallback(
    (href: string | null | undefined) => {
      if (!href) return;
      if (href.startsWith("http")) {
        window.open(href, "_blank", "noopener,noreferrer");
      } else {
        router.push(href);
      }
    },
    [router]
  );

  const scrollToProgressSection = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const section = document.getElementById("home-progress-section");
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  React.useEffect(() => {
    if (dashboardMinimal) return;
    if (!focusIntent) return;
    scrollToProgressSection();
    trackSurfaceView("home_progress_focus", { intent: focusIntent });
  }, [dashboardMinimal, focusIntent, scrollToProgressSection, trackSurfaceView]);

  const handleNextPostAction = React.useCallback(
    (action: string, origin?: string) => {
      trackCardAction("next_post", action, origin ? { origin } : undefined);
      const plannerUrl = summary?.nextPost?.plannerUrl ?? "/planning/planner";
      const slotId = summary?.nextPost?.plannerSlotId ?? null;
      const plannerUrlWithSlot = slotId ? appendQueryParam(plannerUrl, "slotId", slotId) : plannerUrl;
      switch (action) {
        case "generate_script":
        case "show_variations":
        case "test_idea":
          handleNavigate(plannerUrlWithSlot);
          break;
        case "connect_instagram":
          handleNavigate("/dashboard/instagram/connect");
          break;
        default:
          break;
      }
    },
    [appendQueryParam, handleNavigate, summary?.nextPost?.plannerSlotId, summary?.nextPost?.plannerUrl, trackCardAction]
  );

  const handleConsistencyAction = React.useCallback(
    (action: string) => {
      trackCardAction("consistency", action);
      if (action === "plan_week") {
        handleNavigate(summary?.consistency?.plannerUrl ?? "/planning/planner");
      } else if (action === "view_hot_slots") {
        handleNavigate(summary?.consistency?.hotSlotsUrl ?? "/planning/planner?view=heatmap");
      }
    },
    [trackCardAction, summary?.consistency, handleNavigate]
  );

  const handleMediaKitAction = React.useCallback(
    (action: string) => {
      trackCardAction("media_kit", action);
      switch (action) {
        case "copy_link":
          if (summary?.mediaKit?.shareUrl) {
            navigator.clipboard
              .writeText(summary.mediaKit.shareUrl)
              .then(() => toast.success("Link copiado!"))
              .catch(() => toast.error("Não foi possível copiar o link."));
          }
          break;
        case "refresh_highlights":
          handleNavigate("/media-kit?refresh=1");
          break;
        case "open_brand_view":
          handleNavigate(summary?.mediaKit?.shareUrl);
          break;
        case "create_media_kit":
          handleNavigate("/media-kit");
          break;
        default:
          break;
      }
    },
    [trackCardAction, summary?.mediaKit?.shareUrl, handleNavigate]
  );

  const hasHydratedSummary = initialFetch && Boolean(summary);
  const isInitialLoading = loading && !initialFetch;
  const isSummaryHydrating = loadingSections.proposals || loadingSections.performance;
  const summaryLoading = loading || isSummaryHydrating;
  const firstName = React.useMemo(() => {
    const fullName = session?.user?.name;
    if (!fullName) return "Criador(a)";
    const [first] = fullName.trim().split(" ");
    return first || "Criador(a)";
  }, [session?.user?.name]);

  const weeklyGoal = summary?.consistency?.weeklyGoal ?? 0;
  const postsSoFar = summary?.consistency?.postsSoFar ?? 0;
  const weeklyProgressPercent = weeklyGoal > 0 ? Math.round((postsSoFar / weeklyGoal) * 100) : 0;

  const isInstagramConnected =
    summary?.nextPost?.isInstagramConnected ?? Boolean(session?.user?.instagramConnected);
  const hasMediaKit = summary?.mediaKit?.hasMediaKit ?? false;
  const mediaKitShareUrl = summary?.mediaKit?.shareUrl ?? null;
  const journeyProgress = summary?.journeyProgress ?? null;
  const defaultCommunityFreeUrl =
    process.env.NEXT_PUBLIC_COMMUNITY_FREE_URL ?? "/planning/discover";
  const defaultCommunityVipUrl =
    process.env.NEXT_PUBLIC_COMMUNITY_VIP_URL ?? VIP_WHATSAPP_GROUP_URL;
  const communityFreeMember = summary?.community?.free?.isMember ?? false;
  const communityFreeInviteUrl =
    summary?.community?.free?.inviteUrl ?? defaultCommunityFreeUrl;
  const communityVipHasAccess = summary?.community?.vip?.hasAccess ?? false;
  const communityVipMember = summary?.community?.vip?.isMember ?? false;
  const communityVipNeedsJoinReminder =
    summary?.community?.vip?.needsJoinReminder ??
    (communityVipHasAccess && !communityVipMember);
  const communityVipInviteUrl =
    summary?.community?.vip?.inviteUrl ?? defaultCommunityVipUrl;
  const whatsappLinked = summary?.whatsapp?.linked ?? false;
  const whatsappTrialActive = summary?.whatsapp?.trial?.active ?? false;
  const whatsappTrialEligible = summary?.whatsapp?.trial?.eligible ?? false;
  const whatsappTrialStarted = summary?.whatsapp?.trial?.started ?? false;
  const whatsappTrialExpiresAtIso = summary?.whatsapp?.trial?.expiresAt ?? null;
  const planIsPro = summary?.plan?.isPro ?? false;
  const trialExpired =
    !whatsappTrialActive && whatsappTrialStarted && !whatsappTrialEligible && !planIsPro;
  const iaEngaged = whatsappLinked || whatsappTrialActive || whatsappTrialStarted || planIsPro;
  const hasPremiumAccessPlan = summary?.plan?.hasPremiumAccess ?? false;
  const canAccessVipCommunity =
    communityVipHasAccess && Boolean(communityVipInviteUrl);
  const planTrialActive = summary?.plan?.trial?.active ?? false;
  const planTrialEligible = summary?.plan?.trial?.eligible ?? false;
  const planTrialStarted = summary?.plan?.trial?.started ?? false;
  const planTrialExpiresAtIso =
    summary?.plan?.trial?.expiresAt ?? summary?.plan?.expiresAt ?? null;
  const planTrialExpiresAt = React.useMemo(() => {
    if (!planTrialExpiresAtIso) return null;
    const date = new Date(planTrialExpiresAtIso);
    return Number.isNaN(date.getTime()) ? null : date;
  }, [planTrialExpiresAtIso]);
  const [planTrialCountdownLabel, setPlanTrialCountdownLabel] = React.useState<string | null>(
    null
  );
  const isFreePlan = !(hasPremiumAccessPlan || planTrialActive);
  const microInsight = summary?.microInsight ?? null;

  type HeroStage = "join_free" | "start_trial" | "use_trial" | "upgrade" | "join_vip" | "pro_engaged";


  const heroStage = React.useMemo<HeroStage>(() => {
    if (!communityFreeMember) return "join_free";
    if (!whatsappTrialStarted && whatsappTrialEligible) return "start_trial";
    if (whatsappTrialActive && !planIsPro) return "use_trial";
    if (!planIsPro) return "upgrade";
    if (planIsPro && !communityVipMember) return "join_vip";
    return "pro_engaged";
  }, [communityFreeMember, communityVipMember, planIsPro, whatsappTrialActive, whatsappTrialEligible, whatsappTrialStarted]);

  React.useEffect(() => {
    if (dashboardMinimal) return;
    if (!showWelcomeCard) return;
    trackSurfaceView("home_welcome_card", { stage: heroStage });
  }, [dashboardMinimal, heroStage, showWelcomeCard, trackSurfaceView]);

  const handleWelcomePrimary = React.useCallback(() => {
    trackHeroAction("welcome_cta_first_steps", { stage: heroStage });
    scrollToProgressSection();
  }, [heroStage, scrollToProgressSection, trackHeroAction]);

  const handleWelcomeDismiss = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(HOME_WELCOME_STORAGE_KEY, "1");
    }
    setShowWelcomeCard(false);
    trackHeroAction("welcome_dismiss", { stage: heroStage });
  }, [heroStage, trackHeroAction]);

  React.useEffect(() => {
    if (dashboardMinimal) return;
    if (!planTrialActive || !planTrialExpiresAt) {
      setPlanTrialCountdownLabel(null);
      return;
    }
    const update = () => {
      const diff = planTrialExpiresAt.getTime() - Date.now();
      setPlanTrialCountdownLabel(formatCountdownLabel(diff));
    };
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, [dashboardMinimal, planTrialActive, planTrialExpiresAt]);

  const openSubscribeModal = React.useCallback(
    (context: PaywallContext = "default", detail?: Partial<PaywallEventDetail>) => {
      if (typeof window === "undefined") return;
      window.dispatchEvent(
        new CustomEvent("open-subscribe-modal" as any, {
          detail: {
            context,
            ...(detail ?? {}),
          },
        })
      );
    },
    []
  );

  const handleHeaderConnectInstagram = React.useCallback(() => {
    trackHeroAction("header_cta_connect_instagram", { stage: heroStage });
    router.push("/dashboard/instagram/connect");
  }, [heroStage, router, trackHeroAction]);

  const handleHeaderStartTrial = React.useCallback(() => {
    trackHeroAction("header_cta_start_trial", { stage: heroStage });
    setShowWhatsAppConnect(true);
    trackWhatsappEvent("start", { origin: "header_cta" });
  }, [heroStage, setShowWhatsAppConnect, trackHeroAction, trackWhatsappEvent]);

  const handleHeaderSubscribe = React.useCallback(() => {
    trackHeroAction("header_cta_subscribe", { stage: heroStage });
    if (hasPremiumAccessPlan) {
      router.push("/dashboard/billing");
      return;
    }
    openSubscribeModal();
  }, [hasPremiumAccessPlan, heroStage, openSubscribeModal, router, trackHeroAction]);

  const handleOpenDiscover = React.useCallback(
    (origin?: string) => {
      trackCardAction("connect_prompt", "open_discover", origin ? { origin } : undefined);
      handleNavigate("/planning/discover");
    },
    [handleNavigate, trackCardAction]
  );

  const handleMentorshipAction = React.useCallback(
    (action: string) => {
      trackCardAction("mentorship", action);
      if (action === "join_community") {
        handleNavigate(summary?.mentorship?.joinCommunityUrl ?? communityFreeInviteUrl);
      } else if (action === "add_to_calendar") {
        handleNavigate(summary?.mentorship?.calendarUrl);
      } else if (action === "whatsapp_reminder") {
        handleNavigate(
          summary?.mentorship?.whatsappReminderUrl ?? communityVipInviteUrl ?? communityFreeInviteUrl
        );
      }
    },
    [communityFreeInviteUrl, communityVipInviteUrl, handleNavigate, summary?.mentorship, trackCardAction]
  );

  const isSubscriberPlan = planIsPro || communityVipHasAccess;

  const handleJoinFreeCommunity = React.useCallback(
    (origin?: unknown) => {
      const originLabel = typeof origin === "string" ? origin : "default";
      trackCardAction("connect_prompt", "explore_community", { origin: originLabel });
      if (!communityFreeInviteUrl) return;
      handleNavigate(communityFreeInviteUrl);
    },
    [
      communityFreeInviteUrl,
      handleNavigate,
      trackCardAction,
    ]
  );

  const whatsappBotNumber = React.useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER ?? "552120380975";
    return raw.replace(/[^\d]/g, "");
  }, []);

  const openWhatsAppChat = React.useCallback(() => {
    const href = `https://wa.me/${whatsappBotNumber}`;
    window.open(href, "_blank", "noopener,noreferrer");
  }, [whatsappBotNumber]);

  const handleOpenWhatsApp = React.useCallback(() => {
    if (!whatsappLinked) {
      setShowWhatsAppConnect(true);
      trackWhatsappEvent("start", { origin: "home" });
      return;
    }
    openWhatsAppChat();
  }, [openWhatsAppChat, trackWhatsappEvent, whatsappLinked]);

  const copyTextWithFallback = React.useCallback(async (value: string): Promise<boolean> => {
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText &&
        typeof window !== "undefined" &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      // fallback below
    }

    try {
      if (typeof document === "undefined") return false;
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      return Boolean(success);
    } catch {
      return false;
    }
  }, []);

  const handleCopyMediaKitLink = React.useCallback(
    async (origin: string) => {
      trackDashboardCta("copy_kit_link", { surface: origin });
      if (!mediaKitShareUrl) {
        toast.error("Crie seu Mídia Kit para gerar um link compartilhável.");
        return;
      }
      try {
        const copied = await copyTextWithFallback(mediaKitShareUrl);
        if (!copied) {
          throw new Error("copy_failed");
        }
        toast.success("Link do Mídia Kit copiado!");
      } catch (error) {
        void error;
        if (typeof window !== "undefined") {
          window.prompt("Copie manualmente o link do Mídia Kit:", mediaKitShareUrl);
        } else {
          toast.error("Não foi possível copiar o link agora.");
        }
      }
    },
    [copyTextWithFallback, mediaKitShareUrl, trackDashboardCta]
  );

  const headerCta = React.useMemo(() => null, []);

  const headerPill = React.useMemo(() => {
    if (!isInstagramConnected) {
      return {
        icon: "📊",
        className: "border-blue-200 bg-blue-50 text-blue-700",
        text: "Relatório estratégico gratuito",
      };
    }

    if (!planIsPro) {
      if (planTrialActive) {
        return {
          icon: "⏳",
          className: "border-rose-200 bg-rose-50 text-rose-700",
          text: planTrialCountdownLabel ? `Termina em ${planTrialCountdownLabel}` : "Modo Pro ativo",
        };
      }

      if (planTrialEligible && !planTrialStarted) {
        return {
          icon: "✨",
          className: "border-emerald-200 bg-emerald-50 text-emerald-700",
          text: "Ative o Plano Pro para acompanhamento estratégico completo",
        };
      }

      if (planTrialStarted && !planTrialActive) {
        return {
          icon: "💡",
          className: "border-amber-200 bg-amber-50 text-amber-700",
          text: "Seu acesso promocional terminou — mantenha o Mobi ativo",
        };
      }

      return null;
    }

    return {
      icon: "✅",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      text: "Plano Pro estratégico ativo",
    };
  }, [
    isInstagramConnected,
    planIsPro,
    planTrialActive,
    planTrialCountdownLabel,
    planTrialEligible,
    planTrialStarted,
  ]);

  const headerExtraContent = React.useMemo(() => {
    if (!headerPill) return null;
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none ${headerPill.className}`}
        title={headerPill.text}
      >
        <span aria-hidden="true">{headerPill.icon}</span>
        <span className="truncate max-w-[11rem]">{headerPill.text}</span>
      </span>
    );
  }, [headerPill]);

  const headerSetupConfig = React.useMemo(() => {
    if (dashboardMinimal) {
      return {
        cta: null,
        extraContent: null,
      };
    }
    return {
      cta: headerCta ?? null,
      extraContent: headerExtraContent ?? null,
    };
  }, [dashboardMinimal, headerCta, headerExtraContent]);

  useHeaderSetup(headerSetupConfig, [dashboardMinimal, headerCta, headerExtraContent]);

  const handleTriggerPaywall = React.useCallback(
    (reason: "analyze_with_ai" | "activate_pro") => {
      if (hasPremiumAccessPlan) {
        if (reason === "analyze_with_ai") {
          handleNavigate("/dashboard/proposals?status=novo");
        } else {
          handleNavigate("/dashboard/billing");
        }
        return;
      }
      const context: PaywallContext = reason === "analyze_with_ai" ? "ai_analysis" : "default";
      openSubscribeModal(context, { source: "home_dashboard" });
    },
    [handleNavigate, hasPremiumAccessPlan, openSubscribeModal]
  );

  const microInsightCard = React.useMemo<MicroInsightCardState | null>(() => {
    if (!microInsight?.message) return null;
    const highlight =
      extractInsightHighlight(microInsight.impactLabel) ??
      extractInsightHighlight(microInsight.message);
    const trialLabel = buildTrialCtaLabel();

    return {
      message: microInsight.message,
      contextLabel: microInsight.contextLabel ?? null,
      impactLabel: microInsight.impactLabel ?? null,
      ctaLabel: isFreePlan ? trialLabel : microInsight.ctaLabel ?? "Ver detalhes",
      variant: isFreePlan ? "primary" : "secondary",
      footnote: isFreePlan
        ? "Ative o Plano Pro para liberar acompanhamento estratégico completo."
        : "Incluído no seu plano atual.",
      teaser: highlight ? { label: highlight, blurred: isFreePlan } : undefined,
    };
  }, [isFreePlan, microInsight]);

  const handleMicroInsightAction = React.useCallback(() => {
    if (!microInsightCard) return;
    const highlight =
      extractInsightHighlight(microInsight?.impactLabel) ??
      extractInsightHighlight(microInsight?.message) ??
      undefined;
    const hasHighlight = Boolean(highlight);
    const trialLabel = buildTrialCtaLabel();
    const planLabel = isFreePlan ? "free" : planIsPro ? "pro" : "free";
    const ctaLabel = !isInstagramConnected
      ? "Conectar Instagram"
      : isFreePlan
        ? trialLabel
        : microInsight?.ctaLabel ?? "Ver detalhes";
    const telemetryPayload = {
      cta_label: ctaLabel,
      highlight,
      has_highlight: hasHighlight,
      plan: planLabel,
    };

    if (!isInstagramConnected) {
      trackCardAction("micro_insight", "connect_instagram", telemetryPayload);
      handleNavigate("/dashboard/instagram");
      return;
    }
    if (isFreePlan) {
      trackCardAction("micro_insight", "start_trial", {
        ...telemetryPayload,
        teaser_blurred: hasHighlight,
      });
      openSubscribeModal();
      return;
    }
    if (microInsight?.ctaUrl) {
      trackCardAction("micro_insight", "open_cta", telemetryPayload);
      handleNavigate(microInsight.ctaUrl);
      return;
    }
    trackCardAction("micro_insight", "view_details", telemetryPayload);
  }, [
    handleNavigate,
    isFreePlan,
    isInstagramConnected,
    microInsight?.ctaLabel,
    microInsight?.ctaUrl,
    microInsight?.impactLabel,
    microInsight?.message,
    microInsightCard,
    openSubscribeModal,
    planIsPro,
    trackCardAction,
  ]);

  const resolveVipInviteUrl = React.useCallback(async (): Promise<string | null> => {
    if (canAccessVipCommunity && communityVipInviteUrl) {
      return communityVipInviteUrl;
    }

    try {
      const response = await fetch("/api/plan/status?force=true", { cache: "no-store" });
      if (!response.ok) return null;

      const payload = await response.json().catch(() => null);
      const normalizedStatus =
        typeof payload?.extras?.normalizedStatus === "string"
          ? payload.extras.normalizedStatus.trim().toLowerCase()
          : "";

      if (!PAID_PRO_NORMALIZED_STATUSES.has(normalizedStatus)) {
        return null;
      }

      const inviteUrl = communityVipInviteUrl ?? defaultCommunityVipUrl;
      if (!inviteUrl) return null;

      setSummary((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          plan: prev.plan
            ? {
              ...prev.plan,
              normalizedStatus: normalizedStatus || prev.plan.normalizedStatus,
              hasPremiumAccess: true,
              isPro: true,
            }
            : prev.plan,
          community: prev.community
            ? {
              ...prev.community,
              vip: {
                ...prev.community.vip,
                hasAccess: true,
                isMember: prev.community.vip.isMember ?? false,
                inviteUrl,
                needsJoinReminder: true,
              },
            }
            : prev.community,
        };
      });

      return inviteUrl;
    } catch {
      return null;
    }
  }, [canAccessVipCommunity, communityVipInviteUrl, defaultCommunityVipUrl]);

  const handleJoinVip = React.useCallback(async (surface: string = "mentorship_strip") => {
    if (resolvingVipAccess) return;

    setResolvingVipAccess(true);
    try {
      const inviteUrl = await resolveVipInviteUrl();
      if (inviteUrl) {
        trackCardAction("mentorship", "vip_click", {
          surface,
          access: canAccessVipCommunity ? "allowed" : "revalidated",
        });
        handleNavigate(inviteUrl);
        toast.success("Depois de entrar no grupo VIP, clique em \"Já entrei no grupo\" na Home.");
        return;
      }

      trackCardAction("mentorship", "vip_locked", { surface, access: "blocked" });
      openSubscribeModal("default", { source: "mentorship_strip", returnTo: "/dashboard/home" });
    } finally {
      setResolvingVipAccess(false);
    }
  }, [
    canAccessVipCommunity,
    handleNavigate,
    openSubscribeModal,
    resolveVipInviteUrl,
    resolvingVipAccess,
    trackCardAction,
  ]);

  const handleConfirmVipJoin = React.useCallback(async (surface: string = "vip_reminder") => {
    if (confirmingVipJoin) return;

    if (!communityVipHasAccess) {
      openSubscribeModal("default", { source: "vip_join_confirmation", returnTo: "/dashboard/home" });
      return;
    }

    setConfirmingVipJoin(true);
    try {
      const response = await fetch("/api/dashboard/community/vip-join-confirmation", {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Não foi possível confirmar sua entrada agora.");
      }

      const joinedAtIso =
        typeof payload?.vipCommunityJoinedAt === "string"
          ? payload.vipCommunityJoinedAt
          : new Date().toISOString();

      setSummary((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          community: prev.community
            ? {
              ...prev.community,
              vip: {
                ...prev.community.vip,
                hasAccess: true,
                isMember: true,
                inviteUrl: prev.community.vip.inviteUrl ?? communityVipInviteUrl ?? defaultCommunityVipUrl,
                joinedAt: joinedAtIso,
                needsJoinReminder: false,
              },
            }
            : prev.community,
          mentorship: prev.mentorship
            ? {
              ...prev.mentorship,
              isMember: true,
            }
            : prev.mentorship,
        };
      });

      trackCardAction("mentorship", "vip_join_confirmed", { surface });
      toast.success("Perfeito. Confirmamos sua entrada no grupo VIP.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível confirmar agora. Tente novamente em instantes.");
    } finally {
      setConfirmingVipJoin(false);
    }
  }, [
    communityVipHasAccess,
    communityVipInviteUrl,
    confirmingVipJoin,
    defaultCommunityVipUrl,
    openSubscribeModal,
    trackCardAction,
  ]);

  const handleOpenFreeCommunity = React.useCallback(() => {
    if (!communityFreeInviteUrl) return;
    trackCardAction("mentorship", "free_click", { surface: "mentorship_strip" });
    handleNavigate(communityFreeInviteUrl);
  }, [communityFreeInviteUrl, handleNavigate, trackCardAction]);

  const whatsappBanner = React.useMemo(() => {
    const previewMessages = [
      "🔔 Alerta: janela forte de alcance prevista para 19h.",
      "⏰ Lembrete: revisar roteiro do post das 20h em 30 minutos.",
    ];
    const base = {
      previewMessages,
      heading: "Execução da semana no WhatsApp",
      subheading: "WhatsApp cuida dos alertas rápidos do plano.",
      description: "Estratégia, revisão de roteiro e ajustes ficam na plataforma.",
      bullets: [
        { icon: "🔔", text: "Alertas de timing e ritmo para não perder janela de alcance" },
        { icon: "📊", text: "Sinais de oportunidade para ajustar o conteúdo antes de publicar" },
        { icon: "💬", text: "Atalho para abrir o Chat AI e aplicar as recomendações no seu plano" },
      ],
      footnote: "Conexão segura · menos de 30 segundos.",
    };

    if (trialExpired) {
      return {
        ...base,
        calloutTitle: "Mantenha sua execução estratégica ativa.",
        calloutSubtitle:
          "Ative o Plano Pro para continuar com alertas, reuniões semanais e revisão personalizada de roteiro e conteúdo.",
        primary: {
          label: "Ativar Plano Pro",
          variant: "pro" as const,
          icon: <FaGem />,
          onClick: openSubscribeModal,
          trackingKey: "hero_trial_upgrade",
        },
        footnote: "🔒 Plano Pro mantém alertas + acompanhamento semanal.",
      };
    }

    if (whatsappTrialActive || whatsappLinked) {
      return {
        ...base,
        calloutTitle: "Execução assistida ativa.",
        calloutSubtitle:
          "Você recebe alertas operacionais no WhatsApp e ajusta a estratégia no Chat AI e nas revisões semanais.",
        primary: {
          label: "Abrir WhatsApp (alertas)",
          variant: "whatsapp" as const,
          icon: <FaWhatsapp />,
          onClick: handleOpenWhatsApp,
          trackingKey: "hero_trial_open",
        },
        footnote: "🔔 Alertas no WhatsApp; direção estratégica no app.",
      };
    }

    if (!whatsappTrialStarted && whatsappTrialEligible) {
      return {
        ...base,
        calloutTitle: "Ative os alertas para executar seu plano da semana.",
        calloutSubtitle:
          "O WhatsApp cuida dos avisos rápidos. A revisão estratégica e os roteiros ficam na plataforma.",
        primary: {
          label: TRIAL_CTA_LABEL,
          variant: "whatsapp" as const,
          icon: <FaRocket />,
          className: "border-[#F6007B] bg-[#F6007B] hover:bg-[#e2006f] focus-visible:ring-[#F6007B]/30",
          onClick: () => {
            setShowWhatsAppConnect(true);
            trackWhatsappEvent("start", { origin: "home_hero" });
          },
          trackingKey: "hero_trial_start",
        },
      };
    }

    if (planIsPro) {
      return {
        ...base,
        calloutTitle: "Conecte seu WhatsApp e complete seu fluxo de execução.",
        calloutSubtitle: "Receba alertas de timing no WhatsApp e mantenha os ajustes no Chat AI.",
        primary: {
          label: "Conectar alertas no WhatsApp",
          variant: "whatsapp" as const,
          icon: <FaWhatsapp />,
          onClick: handleOpenWhatsApp,
          trackingKey: "hero_trial_connect",
        },
        footnote: "🔒 Plano Pro ativo com acompanhamento estratégico contínuo.",
      };
    }

    return {
      ...base,
      calloutTitle: "Ative os alertas para executar seu plano da semana.",
      calloutSubtitle:
        "Receba notificações de oportunidades e horários no WhatsApp. Para direção e ajustes, use o Chat AI.",
      primary: {
        label: TRIAL_CTA_LABEL,
        variant: "whatsapp" as const,
        icon: <FaRocket />,
        className: "border-[#F6007B] bg-[#F6007B] hover:bg-[#e2006f] focus-visible:ring-[#F6007B]/30",
        onClick: () => {
          setShowWhatsAppConnect(true);
          trackWhatsappEvent("start", { origin: "home_hero" });
        },
        trackingKey: "hero_trial_start",
      },
    };
  }, [
    handleOpenWhatsApp,
    openSubscribeModal,
    planIsPro,
    setShowWhatsAppConnect,
    trackWhatsappEvent,
    trialExpired,
    whatsappLinked,
    whatsappTrialActive,
    whatsappTrialEligible,
    whatsappTrialStarted,
  ]);

  const nextSlotLabel = summary?.nextPost?.slotLabel?.trim() ?? null;
  React.useEffect(() => {
    if (dashboardMinimal) return;
    if (!hasHydratedSummary) return;
    trackSurfaceView("home_hero", {
      stage: heroStage,
      whatsapp_linked: whatsappLinked,
      plan_is_pro: planIsPro,
      community_free_member: communityFreeMember,
      community_vip_member: communityVipMember,
    });
  }, [
    communityFreeMember,
    communityVipMember,
    dashboardMinimal,
    hasHydratedSummary,
    heroStage,
    planIsPro,
    trackSurfaceView,
    whatsappLinked,
  ]);

  const previousWhatsappLinked = React.useRef(whatsappLinked);

  React.useEffect(() => {
    if (dashboardMinimal) return;
    if (whatsappLinked && !previousWhatsappLinked.current) {
      trackWhatsappEvent("success", { origin: "home" });
      setShowWhatsAppConnect(false);
      toast.success("✅ Conexão com WhatsApp concluída.");
    }
    previousWhatsappLinked.current = whatsappLinked;
  }, [dashboardMinimal, trackWhatsappEvent, whatsappLinked]);

  const isCommunityMember = communityVipHasAccess ? communityVipMember : communityFreeMember;

  const surveyCompleted = React.useMemo(() => {
    const journeyStep = summary?.journeyProgress?.steps?.find((s) => s.id === "personalize_support");
    if (journeyStep) return journeyStep.status === "done";
    return Boolean(
      summary?.journeyProgress?.steps?.some((s) => s.id === "personalize_support" && s.status === "done"),
    );
  }, [summary?.journeyProgress?.steps]);

  const progressItems = React.useMemo<JourneyStep[]>(() => {
    const instagramStatus: StepStatus = isInstagramConnected ? "done" : "todo";
    const iaActive = whatsappLinked || whatsappTrialActive;
    const iaStatus: StepStatus = iaActive ? "done" : "todo";
    const proStatus: StepStatus = planIsPro ? "done" : trialExpired ? "todo" : whatsappTrialActive ? "in-progress" : "todo";
    const mentorshipStatus: StepStatus = communityVipMember
      ? "done"
      : communityVipHasAccess
        ? "in-progress"
        : "todo";
    const surveyStatus: StepStatus = surveyCompleted ? "done" : "todo";

    return [
      {
        id: "progress-pro",
        title: "Ativar Plano Pro",
        description: planIsPro
          ? "Plano Pro ativo: IA aplicada, alertas de execução, reuniões semanais e revisão personalizada já liberados."
          : "Ative o Plano Pro para ter acompanhamento estratégico contínuo e acelerar resultados com marcas.",
        icon: <FaGem />,
        status: proStatus,
        actionLabel: planIsPro ? "Ver painel estratégico" : "Ativar agora",
        action: planIsPro ? () => handleNavigate("/dashboard") : handleHeaderSubscribe,
        variant: "pro",
        disabled: planIsPro,
      },
      {
        id: "progress-instagram",
        title: "Conectar Instagram",
        description: isInstagramConnected
          ? "Diagnóstico estratégico atualizado com dados reais da sua conta."
          : "Conecte em poucos cliques para mapear oportunidades e definir direção de conteúdo com base em dados.",
        icon: <FaInstagram />,
        status: instagramStatus,
        actionLabel: isInstagramConnected ? "Instagram conectado" : "Conectar Instagram",
        action: handleHeaderConnectInstagram,
        variant: "secondary",
        disabled: isInstagramConnected,
      },
      {
        id: "progress-community-vip",
        title: "Entrar no grupo VIP (Revisão semanal)",
        description: communityVipMember
          ? "Você está no grupo VIP com reuniões semanais de revisão de roteiro e trocas com outros criadores."
          : communityVipHasAccess
            ? "Entre no grupo VIP para receber os links das reuniões semanais e fazer networking estratégico."
            : "Ative o Plano Pro para liberar reuniões semanais e networking com criadores.",
        icon: <FaUsers />,
        status: mentorshipStatus,
        actionLabel: communityVipMember
          ? "Grupo VIP ativo"
          : communityVipHasAccess
            ? "Entrar no grupo VIP"
            : "Ativar Pro para entrar",
        action: () => {
          if (communityVipMember) {
            handleMentorshipAction("whatsapp_reminder");
            return;
          }
          void handleJoinVip("progress_section");
        },
        variant: "vip",
        disabled: false,
      },
      {
        id: "progress-personalize-support",
        title: "Personalizar IA e suporte",
        description: surveyCompleted
          ? "Preferências salvas. A IA e o suporte seguem adaptados ao seu momento."
          : "Responda em 2 minutos para personalizar IA, revisões e recomendações estratégicas.",
        icon: <FaRobot />,
        status: surveyStatus,
        actionLabel: surveyCompleted ? "Revisar respostas" : "Responder pesquisa",
        action: () => setShowSurveyModal(true),
        variant: "secondary",
        disabled: false,
      },
    ];
  }, [
    communityVipHasAccess,
    communityVipMember,
    handleHeaderConnectInstagram,
    handleHeaderSubscribe,
    handleNavigate,
    handleJoinVip,
    handleMentorshipAction,
    isInstagramConnected,
    planIsPro,
    trialExpired,
    surveyCompleted,
    whatsappLinked,
    whatsappTrialActive,
  ]);

  const firstPendingJourneyId = React.useMemo(() => {
    const pending = progressItems.find((item) => item.status !== "done");
    return pending?.id ?? null;
  }, [progressItems]);

  const highlightedJourneyId = React.useMemo(() => {
    if (focusIntent) {
      const intentMap: Record<string, string> = {
        instagram: "progress-instagram",
        community: "progress-community-vip",
        whatsapp: "progress-ai",
        ia: "progress-ai",
        plan: "progress-pro",
        subscription: "progress-pro",
        survey: "progress-personalize-support",
      };
      const mapped = intentMap[focusIntent];
      if (mapped) return mapped;
    }
    if (isNewUser && firstPendingJourneyId) return firstPendingJourneyId;
    return null;
  }, [firstPendingJourneyId, focusIntent, isNewUser]);

  const hasCompletedCoreSteps = React.useMemo(() => {
    if (!isInstagramConnected) return false;
    if (!iaEngaged) return false;
    if (!isCommunityMember) return false;
    return !isFreePlan;
  }, [iaEngaged, isCommunityMember, isFreePlan, isInstagramConnected]);

  React.useEffect(() => {
    if (dashboardMinimal) return;
    if (!isNewUser || !hasCompletedCoreSteps || onboardingCompletionRequested.current) return;
    let cancelled = false;
    onboardingCompletionRequested.current = true;
    const complete = async () => {
      try {
        const response = await fetch("/api/user/complete-onboarding", { method: "POST" });
        if (!response.ok) {
          throw new Error(`failed_${response.status}`);
        }
        trackSurfaceView("home_onboarding_completed", { reason: "auto_progress" });
        await update?.({ isNewUserForOnboarding: false }).catch(() => { });
      } catch {
        if (!cancelled) {
          onboardingCompletionRequested.current = false;
        }
      }
    };
    void complete();
    return () => {
      cancelled = true;
    };
  }, [dashboardMinimal, hasCompletedCoreSteps, isNewUser, trackSurfaceView, update]);

  const showTrialMessageCard =
    !planIsPro &&
    (whatsappTrialActive || (!trialExpired && whatsappTrialStarted && whatsappTrialEligible));
  const showProUpsellCard = !planIsPro && trialExpired;
  const showMentorshipStrip = isHydrated && Boolean(communityVipInviteUrl || communityFreeInviteUrl);


  const headerStats = React.useMemo(() => {
    if (!iaEngaged) return [];
    return [
      {
        key: "posts",
        label: "Posts planejados",
        value: weeklyGoal > 0 ? `${postsSoFar}/${weeklyGoal}` : `${postsSoFar}`,
        helper: weeklyGoal > 0 ? "Meta da semana" : "Defina sua meta semanal",
      },
      {
        key: "best_slot",
        label: "Melhor horário hoje",
        value: isInstagramConnected ? nextSlotLabel || "Calculando..." : "Conecte o Instagram",
        helper: isInstagramConnected
          ? "Atualizado pelos seus últimos posts"
          : "Integre para destravar horários",
      },
      {
        key: "last_alert",
        label: "Último alerta",
        value: whatsappLinked ? "WhatsApp ativo" : "Sem alertas ainda",
        helper: whatsappLinked
          ? "Peça uma ideia a qualquer momento"
          : "Conecte para receber lembretes",
      },
    ];
  }, [iaEngaged, isInstagramConnected, nextSlotLabel, postsSoFar, weeklyGoal, whatsappLinked]);

  const heroMessaging = React.useMemo(() => {
    if (!isInstagramConnected) {
      return {
        subtitle:
          "Para participarmos da sua estratégia, conecte seu Instagram. A IA precisa mastigar seus dados antes de nós.",
        helper: "Seguro. Rápido. Libera nosso suporte estratégico.",
        ctaLabel: "🔗 Conectar Instagram p/ Revisão",
        onClick: handleHeaderConnectInstagram,
      };
    }

    if (!planIsPro) {
      return {
        subtitle: "Seu diagnóstico prévio está rodando. Assine o Plano Pro para acessar a revisão humana nas nossas próximas reuniões.",
        helper: "Agenda: Segundas (Boas-vindas), Terças (Roteiro), Quintas (Conteúdo).",
        ctaLabel: "🔒 Liberar Acesso à Consultoria (R$ 49,90)",
        onClick: handleHeaderSubscribe,
      };
    }

    if (!communityVipMember) {
      return {
        subtitle: "Finalize seu acesso entrando no nosso grupo fechado VIP para os links das reuniões.",
        helper: "É lá que enviamos o link do Zoom às 19h.",
        ctaLabel: "💎 Entrar no Grupo VIP",
        onClick: () => handleJoinVip("hero"),
      };
    }

    // Default Pro State
    const today = new Date().getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
    let meetingFocus = "Nossa equipe está acompanhando suas métricas.";
    if (today === 1) meetingFocus = "Hoje às 19h: Networking & Boas-Vindas.";
    if (today === 2) meetingFocus = "Hoje às 19h: Revisão e Estruturação de Roteiros.";
    if (today === 4) meetingFocus = "Hoje às 19h: Revisão de Conteúdo e Performance.";

    return {
      subtitle: `${meetingFocus} Confira abaixo as análises mastigadas pela IA antes da nossa reunião.`,
      helper: whatsappLinked ? "Seus alertas rápidos estão on no WhatsApp." : "",
      ctaLabel: whatsappLinked ? "📱 Abrir WhatsApp" : "🔔 Ativar Alertas no Zap",
      onClick: whatsappLinked ? handleOpenWhatsApp : () => setShowWhatsAppConnect(true),
    };
  }, [
    communityVipMember,
    handleHeaderConnectInstagram,
    handleHeaderSubscribe,
    handleJoinVip,
    handleOpenWhatsApp,
    isInstagramConnected,
    planIsPro,
    whatsappLinked,
  ]);

  const heroFeedbackMessage = React.useMemo(() => {
    if (!isInstagramConnected) return null;
    if (whatsappLinked || whatsappTrialActive) {
      return "🔔 Alertas ativos no WhatsApp. Use o Chat AI e as revisões semanais para ajustar roteiro e execução.";
    }
    return "✅ Instagram conectado! Seu diagnóstico estratégico já está sendo atualizado na plataforma.";
  }, [isInstagramConnected, whatsappLinked, whatsappTrialActive]);

  const journeyStageInfo = React.useMemo(() => {
    const total = progressItems.length;
    if (!total) {
      return { step: 1, total: 1, label: "Primeiros passos" };
    }
    const firstPendingIndex = progressItems.findIndex((item) => item.status !== "done");
    if (firstPendingIndex === -1) {
      return { step: total, total, label: "Experiência completa" };
    }
    return {
      step: firstPendingIndex + 1,
      total,
      label: progressItems[firstPendingIndex]?.title ?? "Próximo passo",
    };
  }, [progressItems]);
  const progressTotalCount = progressItems.length;
  const progressCompletedCount = progressItems.filter((item) => item.status === "done").length;
  const stageProgressPercent = progressTotalCount
    ? Math.round((progressCompletedCount / progressTotalCount) * 100)
    : 0;
  const progressHeading = isNewUser
    ? "Bem-vindo! Vamos ativar sua agência estratégica 👇"
    : "Seu plano estratégico na Data2Content";
  const progressDescription = isNewUser
    ? "Comece pelo próximo passo para atrair marcas com estratégia e consistência."
    : journeyStageInfo.label;
  const toolCards = React.useMemo(() => {
    const plannerMetric = !isInstagramConnected
      ? "Conexão em modo leitura em segundos."
      : nextSlotLabel
        ? `Próximo horário sugerido: ${nextSlotLabel}`
        : weeklyGoal > 0
          ? `Progresso da semana: ${Math.min(postsSoFar, weeklyGoal)}/${weeklyGoal} posts`
          : "Defina sua meta semanal para orientar seu plano de conteúdo.";
    const plannerActionLabel = isInstagramConnected ? "Gerar horários com IA" : "Conectar Instagram";
    const plannerLocked = planningGroupLocked && !(hasPremiumAccessPlan || planTrialActive);
    const chartsLocked = plannerLocked;

    const mediaKitLastUpdate = summary?.mediaKit?.lastUpdatedLabel
      ? `Atualizado ${summary.mediaKit.lastUpdatedLabel}`
      : "Atualize com dados recentes antes de enviar para marcas.";

    const communityStatus = communityVipMember
      ? "Revisões VIP semanais ativas."
      : communityVipHasAccess
        ? "Grupo VIP liberado para você."
        : communityFreeMember
          ? "Você já está na comunidade."
          : "Acesso gratuito para começar a trocar com criadores.";

    const cards = [
      {
        key: "planner",
        icon: <FaCalendarAlt aria-hidden="true" />,
        title: plannerLocked ? "Planejamento (Plano Pro)" : "Planejar com IA",
        description: plannerLocked
          ? "Ative o Plano Pro para liberar planejamento guiado com IA e revisão semanal."
          : isInstagramConnected
            ? "Gere horários personalizados e saia com direção clara para o próximo conteúdo."
            : "Conecte o Instagram e destrave um planejamento baseado nos seus dados.",
        status: plannerLocked ? "Recurso exclusivo Plano Pro" : plannerMetric,
        actionLabel: plannerLocked ? "Ativar Plano Pro" : plannerActionLabel,
        onAction: () => {
          if (plannerLocked) {
            openSubscribeModal();
            return;
          }
          if (!isInstagramConnected) {
            handleNextPostAction("connect_instagram", "tool_card");
            return;
          }
          handleConsistencyAction("plan_week");
        },
      },
      {
        key: "charts",
        icon: <FaChartLine aria-hidden="true" />,
        title: chartsLocked ? "Gráficos (Plano Pro)" : "Gráficos de desempenho",
        description: chartsLocked
          ? "Ative o Plano Pro para destravar leituras estratégicas de alcance e engajamento."
          : "Visualize picos de alcance, formatos e mensagens que mais convertem.",
        status: chartsLocked
          ? "Exclusivo Plano Pro"
          : isInstagramConnected
            ? "Explore tendências com dados reais para orientar próximos roteiros."
            : "Conecte o Instagram para alimentar os gráficos com seus dados.",
        actionLabel: chartsLocked
          ? "Ativar Plano Pro"
          : isInstagramConnected
            ? "Abrir gráficos"
            : "Conectar Instagram",
        onAction: () => {
          if (chartsLocked) {
            openSubscribeModal();
            return;
          }
          if (!isInstagramConnected) {
            handleNavigate("/dashboard/instagram/connect");
            return;
          }
          handleNavigate("/planning/graficos");
        },
      },
      {
        key: "media_kit",
        icon: <FaBullhorn aria-hidden="true" />,
        title: "Kit de mídia",
        description: hasMediaKit
          ? "Mantenha seus números atualizados para negociar com marcas com confiança."
          : "Crie um link profissional com prova social para atrair marcas em minutos.",
        status: hasMediaKit ? mediaKitLastUpdate : "Pronto para criar seu primeiro kit.",
        actionLabel: hasMediaKit ? "Abrir kit" : "Criar kit",
        onAction: () => handleMediaKitAction(hasMediaKit ? "open_brand_view" : "create_media_kit"),
      },
    ];

    if (communityOnHome) {
      cards.push({
        key: "community",
        icon: <FaUsers aria-hidden="true" />,
        title: "Comunidade",
        description: communityFreeMember
          ? "Participe das trocas e desafios com outros criadores."
          : "Entre para trocar bastidores e acelerar sua evolução com outros criadores.",
        status: communityStatus,
        actionLabel: isSubscriberPlan
          ? canAccessVipCommunity
            ? "Abrir comunidade VIP"
            : "Assinar para VIP"
          : communityFreeMember
            ? "Abrir comunidade"
            : "Entrar na comunidade",
        onAction:
          isSubscriberPlan && communityVipInviteUrl
            ? () => {
              void handleJoinVip();
            }
            : () => handleJoinFreeCommunity("tool_card"),
      });
    }

    return cards;
  }, [
    canAccessVipCommunity,
    communityFreeMember,
    communityOnHome,
    communityVipHasAccess,
    communityVipMember,
    communityVipInviteUrl,
    handleConsistencyAction,
    handleJoinFreeCommunity,
    handleJoinVip,
    handleMediaKitAction,
    handleNextPostAction,
    handleNavigate,
    hasMediaKit,
    hasPremiumAccessPlan,
    isInstagramConnected,
    isSubscriberPlan,
    nextSlotLabel,
    openSubscribeModal,
    planTrialActive,
    planningGroupLocked,
    postsSoFar,
    summary?.mediaKit?.lastUpdatedLabel,
    weeklyGoal,
  ]);
  const connectCardViewTracked = React.useRef(false);
  React.useEffect(() => {
    if (!isInstagramConnected && !connectCardViewTracked.current) {
      trackSurfaceView("home_connect_instagram_card", { variant: "empty_state" });
      connectCardViewTracked.current = true;
    }
  }, [isInstagramConnected, trackSurfaceView]);

  const microInsightViewTracked = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!microInsightCard?.teaser) return;
    const keyBase =
      microInsight?.id ??
      microInsight?.message ??
      (isInstagramConnected ? "connected" : "not_connected");
    if (!keyBase) return;
    const highlight =
      extractInsightHighlight(microInsight?.impactLabel) ??
      extractInsightHighlight(microInsight?.message) ??
      "";
    const signature = `${keyBase}|${highlight}|${isFreePlan ? "free" : "pro"}`;
    if (microInsightViewTracked.current === signature) return;
    trackSurfaceView("home_micro_insight_peek", {
      blurred: microInsightCard.teaser?.blurred ?? false,
      plan: isFreePlan ? "free" : "pro",
    });
    microInsightViewTracked.current = signature;
  }, [
    microInsightCard,
    isFreePlan,
    isInstagramConnected,
    microInsight?.id,
    microInsight?.impactLabel,
    microInsight?.message,
    trackSurfaceView,
  ]);


  const shouldDisplayConnectBanner = showWhatsAppConnect && !whatsappLinked;
  const connectBanner = shouldDisplayConnectBanner ? (
    <div className="mb-6 rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
      {trialExpired ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-semibold">Seu acesso promocional chegou ao fim.</p>
              <p className="text-xs text-amber-700">
                Ative o Plano Pro para manter alertas, revisão semanal e acompanhamento estratégico contínuo.
              </p>
            </div>
            <ActionButton
              label="Ativar Plano Pro"
              icon={<FaGem />}
              variant="pro"
              onClick={() => {
                trackHeroAction("connect_banner_upgrade", {
                  stage: heroStage,
                  whatsapp_linked: whatsappLinked,
                  plan_is_pro: planIsPro,
                  community_free_member: communityFreeMember,
                  community_vip_member: communityVipMember,
                });
                openSubscribeModal();
              }}
              className="w-full justify-center px-4 py-2 text-sm sm:w-auto"
            />
          </div>
        </div>
      ) : null}
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Conecte seu WhatsApp</p>
          <p className="text-sm text-slate-600">
            Copie o código, abra o WhatsApp e confirme para ativar os alertas de execução.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowWhatsAppConnect(false)}
          className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Fechar banner de conexão do WhatsApp"
        >
          <FaTimes />
        </button>
      </div>
      <WhatsAppConnectInline />
    </div>
  ) : null;

  const emitTutorialAction = React.useCallback(
    (stepId: JourneyStepId, action: string, extra?: Record<string, unknown>) => {
      trackTutorialStep(stepId, action, { surface: "tutorial_block", ...extra });
    },
    [trackTutorialStep]
  );

  const emitToolClick = React.useCallback(
    (cardId: string, action: string, extra?: Record<string, unknown>) => {
      trackHomeCard(cardId, action, { surface: "creator_tools", ...extra });
    },
    [trackHomeCard]
  );

  const toolsLockedReason = isInstagramConnected
    ? null
    : "Conecte seu Instagram para liberar atalhos com contexto real.";

  const creatorTools = React.useMemo<CreatorToolCardProps[]>(() => {
    const proLocked = !hasPremiumAccessPlan;
    const chartsLocked = planningGroupLocked && !(hasPremiumAccessPlan || planTrialActive);
    const list: CreatorToolCardProps[] = [];

    list.push({
      id: "campaigns",
      title: "Campanhas",
      description: "Receba propostas e responda com direção estratégica",
      icon: <FaBullhorn className="h-5 w-5" aria-hidden />,
      cta: "open",
      onClick: () => {
        emitToolClick("campaigns", "open");
        handleNavigate("/dashboard/proposals");
      },
    });

    list.push({
      id: "media_kit",
      title: "Mídia Kit",
      description: "Sua vitrine estratégica para fechar com marcas",
      icon: <FaMagic className="h-5 w-5" aria-hidden />,
      cta: "open",
      onClick: () => {
        emitToolClick("media_kit", "open");
        handleNavigate("/dashboard/media-kit");
      },
    });

    list.push({
      id: "calculator",
      title: "Calculadora Plano Pro",
      description: "Entenda seu valor comercial com clareza",
      icon: <FaCalculator className="h-5 w-5" aria-hidden />,
      badge: "Pro",
      locked: proLocked,
      cta: proLocked ? "activate" : "open",
      onClick: () => {
        emitToolClick("calculator", proLocked ? "paywall" : "open");
        if (proLocked) {
          openSubscribeModal("calculator", { source: "home_creator_tools" });
          return;
        }
        handleNavigate("/dashboard/calculator");
      },
    });

    list.push({
      id: "calendar",
      title: "Calendário",
      description: "Planeje sua semana com foco em resultado",
      icon: <FaCalendarAlt className="h-5 w-5" aria-hidden />,
      badge: "Pro",
      locked: proLocked,
      cta: proLocked ? "activate" : "open",
      onClick: () => {
        emitToolClick("calendar", proLocked ? "paywall" : "open");
        if (!isInstagramConnected) {
          handleNavigate("/dashboard/instagram/connect");
          return;
        }
        handleNavigate("/planning/planner");
      },
    });

    list.push({
      id: "discovery",
      title: "Descoberta",
      description: "Inspirações com contexto para seu posicionamento",
      icon: <FaUsers className="h-5 w-5" aria-hidden />,
      badge: "Pro",
      locked: proLocked,
      cta: proLocked ? "activate" : "open",
      onClick: () => {
        emitToolClick("discovery", proLocked ? "paywall" : "open");
        handleNavigate("/planning/discover");
      },
    });

    list.push({
      id: "charts",
      title: chartsLocked ? "Gráficos (Plano Pro)" : "Gráficos",
      description: chartsLocked
        ? "Ative o Plano Pro para destravar leituras estratégicas de desempenho."
        : "Veja horários quentes, formatos e mensagens que mais convertem.",
      icon: <FaChartLine className="h-5 w-5" aria-hidden />,
      badge: "Pro",
      locked: chartsLocked,
      cta: chartsLocked ? "activate" : "open",
      onClick: () => {
        emitToolClick("charts", chartsLocked ? "paywall" : "open");
        if (chartsLocked) {
          openSubscribeModal("planning", { source: "home_creator_tools", returnTo: "/planning/graficos" });
          return;
        }
        if (!isInstagramConnected) {
          handleNavigate("/dashboard/instagram/connect");
          return;
        }
        handleNavigate("/planning/graficos");
      },
    });

    list.push({
      id: "chat",
      title: "Chat IA",
      description: "Seu copiloto para revisar roteiro e execução",
      icon: <FaRobot className="h-5 w-5" aria-hidden />,
      badge: "Pro",
      locked: proLocked,
      cta: proLocked ? "activate" : "open",
      onClick: () => {
        emitToolClick("chat", proLocked ? "paywall" : "open");
        handleNavigate("/dashboard/chat");
      },
    });

    list.push({
      id: "whatsapp",
      title: "Alertas no WhatsApp",
      description: "Alertas operacionais no WhatsApp, estratégia no app",
      icon: <FaWhatsapp className="h-5 w-5" aria-hidden />,
      badge: "Pro",
      locked: proLocked,
      cta: proLocked ? "activate" : "open",
      onClick: () => {
        emitToolClick("whatsapp", proLocked ? "paywall" : "open");
        if (proLocked) {
          openSubscribeModal("whatsapp", { source: "home_creator_tools" });
          return;
        }
        if (!whatsappLinked) {
          setShowWhatsAppConnect(true);
          trackWhatsappEvent("start", { origin: "home_creator_tools" });
          return;
        }
        handleOpenWhatsApp();
      },
    });

    list.push({
      id: "affiliate",
      title: "Indique e Ganhe",
      description: "Receba 50% na 1ª fatura do indicado",
      icon: <FaHandshake className="h-5 w-5" aria-hidden />,
      cta: "open",
      onClick: () => {
        emitToolClick("affiliate", "open");
        handleNavigate("/afiliados");
      },
    });

    return list;
  }, [
    emitToolClick,
    handleNavigate,
    handleOpenWhatsApp,
    hasPremiumAccessPlan,
    isInstagramConnected,
    openSubscribeModal,
    planningGroupLocked,
    planTrialActive,
    setShowWhatsAppConnect,
    trackWhatsappEvent,
    whatsappLinked,
  ]);

  const tutorialLoading = (loading || loadingSections.proposals) && !journeyProgress;
  const toolsLoading = summaryLoading && !summary;

  const mediaKitShareIntentUrl = React.useMemo(() => appendQueryParam("/dashboard/media-kit", "intent", "share"), [appendQueryParam]);

  const tutorialSteps = React.useMemo<TutorialProgressStep[]>(() => {
    if (!journeyProgress?.steps?.length) return [];
    return journeyProgress.steps.map((step) => {
      const Icon = TUTORIAL_STEP_ICONS[step.id] ?? FaRocket;
      return {
        ...step,
        helper: step.helper ?? JOURNEY_STEP_COPY[step.id]?.stepHelper ?? null,
        icon: <Icon className="h-5 w-5" aria-hidden />,
      } satisfies TutorialProgressStep;
    });
  }, [journeyProgress?.steps]);

  const nextJourneyStepId = journeyProgress?.nextStepId ?? null;

  const tutorialCtaLabel = React.useMemo(() => {
    if (!nextJourneyStepId) return JOURNEY_DEFAULT_CTA.idleLabel;
    return JOURNEY_STEP_COPY[nextJourneyStepId]?.ctaLabel ?? JOURNEY_DEFAULT_CTA.fallbackLabel;
  }, [nextJourneyStepId]);

  const handleContinueJourney = React.useCallback(() => {
    const stepId = journeyProgress?.nextStepId;
    if (!stepId) {
      trackDashboardCta("open_proposals", { surface: "tutorial_block" });
      handleNavigate("/dashboard/proposals");
      return;
    }

    emitTutorialAction(stepId, "continue_journey");
    const targetByStep: Record<JourneyStepId, DashboardCtaTarget> = {
      connect_instagram: "connect_ig",
      create_media_kit: "create_media_kit",
      publish_media_kit_link: "edit_kit",
      personalize_support: "open_creator_survey",
      activate_pro: "activate_pro",
    };
    const target = targetByStep[stepId] ?? "open_proposals";
    trackDashboardCta(target, { surface: "tutorial_block", step: stepId });

    switch (stepId) {
      case "connect_instagram":
        handleNavigate("/dashboard/instagram/connect");
        break;
      case "create_media_kit":
        handleNavigate("/dashboard/media-kit");
        break;
      case "publish_media_kit_link":
        if (mediaKitShareUrl) {
          void handleCopyMediaKitLink("tutorial_block");
        } else {
          handleNavigate(mediaKitShareIntentUrl);
        }
        break;
      case "personalize_support":
        handleNavigate("/#etapa-5-pesquisa");
        break;
      case "activate_pro":
        if (hasPremiumAccessPlan) {
          handleNavigate("/dashboard/billing");
        } else {
          openSubscribeModal("default", { source: "home_tutorial", returnTo: "/dashboard/home" });
        }
        break;
      default:
        break;
    }
  }, [emitTutorialAction, handleCopyMediaKitLink, handleNavigate, hasPremiumAccessPlan, journeyProgress?.nextStepId, mediaKitShareIntentUrl, mediaKitShareUrl, openSubscribeModal, trackDashboardCta]);

  const mentorshipStrip = showMentorshipStrip ? (
    <div className="sm:flex sm:items-center sm:justify-between sm:gap-4">
      <div className="space-y-1 text-sm text-slate-700">
        <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
          <span>✨ Reuniões semanais e networking do Plano Pro</span>
          {!canAccessVipCommunity ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              <FaLock className="h-3 w-3" />
              Assinantes
            </span>
          ) : null}
        </div>
        <p className="text-slate-600">
          Revisão de roteiro e conteúdo no grupo VIP de assinantes, com comunidade gratuita para troca entre criadores.
        </p>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:mt-0 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => {
            void handleJoinVip();
          }}
          disabled={resolvingVipAccess}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {resolvingVipAccess
            ? "Validando acesso..."
            : canAccessVipCommunity
              ? "Abrir grupo de revisão"
              : "Ativar Pro para entrar"}
          {!canAccessVipCommunity ? (
            <FaLock className="h-4 w-4" />
          ) : (
            <FaExternalLinkAlt className="h-4 w-4" />
          )}
        </button>
        {communityFreeInviteUrl ? (
          <button
            type="button"
            onClick={handleOpenFreeCommunity}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-1.5 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Comunidade gratuita
            <FaGlobe className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div >
  ) : null;

  const affiliateFootnote = hasMediaKit
    ? "Seu mídia kit já leva seu link de afiliado. Novos cadastros vindos dele geram comissão pra você."
    : null;
  const showCreatorToolsSection = false;

  React.useEffect(() => {
    if (dashboardMinimal) return;
    if (shouldDisplayConnectBanner) {
      trackSurfaceView("home_whatsapp_connect", { origin: "home" });
    }
  }, [dashboardMinimal, shouldDisplayConnectBanner, trackSurfaceView]);

  if (tutorialHomeEnabled) {
    return (
      <div className="dashboard-page-shell space-y-8 pt-4 pb-8">
        <section
          id="home-progress-section"
          className="mt-2"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                Etapa {journeyStageInfo.step} de {journeyStageInfo.total}
              </p>
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                {progressHeading}
              </h2>
              {isNewUser ? (
                <p className="mt-1 text-sm font-semibold text-slate-500">{progressDescription}</p>
              ) : null}
            </div>
            <div className="text-left text-sm font-semibold text-slate-500 sm:text-right">
              <p className="text-xs text-slate-400">
                {progressCompletedCount}/{progressTotalCount} etapas concluídas
              </p>
            </div>
          </div>
          <div className="mt-4 h-2 w-full rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-[#F6007B] transition-[width]"
              style={{ width: `${stageProgressPercent}%` }}
            />
          </div>
          <div className="mt-5 flex flex-col gap-3">
            {progressItems.map((item) => {
              const statusEmoji = STEP_STATUS_ICONS[item.status];
              const statusLabel = STEP_STATUS_LABELS[item.status];
              const disabled = item.disabled || item.status === "loading";
              const isHighlighted = highlightedJourneyId === item.id;

              // Media Kit inspired card style
              const cardClassName = [
                "group relative flex w-full items-center gap-4 rounded-3xl border p-5 text-left transition-all duration-200",
                isHighlighted
                  ? "border-[#F6007B]/30 bg-white shadow-[0_8px_30px_rgba(246,0,123,0.12)] ring-1 ring-[#F6007B]/20"
                  : "border-slate-100 bg-white shadow-sm hover:border-slate-200 hover:shadow-md",
                disabled
                  ? "cursor-not-allowed opacity-60 bg-slate-50"
                  : "hover:-translate-y-0.5",
              ].join(" ");

              const iconContainerClass = [
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl transition-colors",
                item.status === "done"
                  ? "bg-emerald-50 text-emerald-600"
                  : isHighlighted
                    ? "bg-[#F6007B]/10 text-[#F6007B]"
                    : "bg-slate-100 text-slate-500 group-hover:bg-slate-200",
              ].join(" ");

              return (
                <button
                  key={`${item.id}-summary`}
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    item.action();
                  }}
                  disabled={disabled}
                  className={cardClassName}
                  data-highlight={isHighlighted ? "true" : undefined}
                >
                  <div className={iconContainerClass}>
                    {item.status === "done" ? <FaCheckCircle className="h-5 w-5" /> : item.icon}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      {item.status === "done" && (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                          Concluído
                        </span>
                      )}
                      {isHighlighted && item.status !== "done" && (
                        <span className="inline-flex items-center rounded-full bg-[#F6007B]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#F6007B]">
                          Próximo passo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
                      {item.description}
                    </p>
                  </div>

                  <div className="hidden sm:block">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${disabled
                        ? "bg-slate-100 text-slate-400"
                        : isHighlighted
                          ? "bg-[#F6007B] text-white shadow-sm hover:bg-[#e2006f]"
                          : "bg-slate-50 text-slate-700 group-hover:bg-slate-100"
                        }`}
                    >
                      {item.actionLabel}
                      {!disabled && (
                        <FaChevronRight className="h-3 w-3" aria-hidden="true" />
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {showCreatorToolsSection ? (
          <div className="pt-4">
            <CreatorToolsGrid
              tools={creatorTools}
              loading={toolsLoading}
              disabledReason={toolsLockedReason}
              footnote={affiliateFootnote}
            />
          </div>
        ) : null}
        {connectBanner}
        {showSurveyModal ? (
          <SurveyModal
            open={showSurveyModal}
            onClose={() => setShowSurveyModal(false)}
            onSaved={() => {
              setShowSurveyModal(false);
              void refreshProposalsSummary();
            }}
          />
        ) : null}
      </div>
    );
  }

  if (dashboardMinimal) {
    return (
      <div className="dashboard-page-shell pt-4 pb-8">
        <MinimalDashboard
          summary={summary}
          loading={summaryLoading}
          onRefresh={refreshProposalsSummary}
          onNavigate={handleNavigate}
          onTriggerPaywall={handleTriggerPaywall}
          trackCta={trackMinimalCta}
          creatorId={sessionUserId}
        />
      </div>
    );
  }

  return (
    <>
      <div className="dashboard-page-shell pt-4 pb-8">
        {connectBanner}
        {showWelcomeCard ? (
          <div className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50/95 px-5 py-5 text-emerald-900 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">
                  Bem-vindo à Data2Content
                </p>
                <p className="text-sm font-semibold">
                  Vamos configurar sua base estratégica para atrair marcas e crescer em comunidade.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handleWelcomePrimary}
                  className="inline-flex items-center justify-center rounded-full bg-[#F6007B] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e2006f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/40 focus-visible:ring-offset-2"
                >
                  Ver primeiros passos
                </button>
                <button
                  type="button"
                  onClick={handleWelcomeDismiss}
                  className="inline-flex items-center justify-center rounded-full border border-emerald-200 px-5 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2"
                >
                  Já entendi
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <section className="mb-4 px-2">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-4 text-center lg:text-left">
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                  <span aria-hidden="true">👋</span>{" "}
                  {isNewUser ? (
                    <>
                      Bem-vindo, <span className="text-[#F6007B]">{firstName}</span>!{" "}
                      <span className="text-slate-900">Sua agência estratégica de conteúdo começa aqui.</span>
                    </>
                  ) : (
                    <>
                      Oi, <span className="text-[#F6007B]">{firstName}</span>!{" "}
                      <span className="text-slate-900">Vamos transformar estratégia em crescimento com marcas.</span>
                    </>
                  )}
                </h1>
                <p className="text-base text-slate-600 sm:text-lg">{heroMessaging.subtitle}</p>
                <p className="text-sm text-slate-500">{BRAND_POSITIONING}</p>
                <p className="text-xs text-slate-500">{BRAND_SUPPORT_PROMISE}</p>
                {heroFeedbackMessage ? (
                  <p className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 lg:justify-start">
                    {heroFeedbackMessage}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col items-stretch justify-start gap-2 sm:inline-flex sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={heroMessaging.onClick}
                  className="inline-flex w-full items-center justify-center rounded-full bg-[#F6007B] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e2006f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/40 focus-visible:ring-offset-2 sm:w-auto"
                >
                  {heroMessaging.ctaLabel}
                </button>
                {heroMessaging.helper ? (
                  <span className="text-xs text-slate-500 sm:text-left">{heroMessaging.helper}</span>
                ) : null}
              </div>
            </div>
            {headerStats.length ? (
              <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-lg">
                {headerStats.map((stat) => (
                  <div
                    key={stat.key}
                    className="px-4 py-4 text-left"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {stat.label}
                    </p>
                    <p className="text-lg font-semibold text-slate-900">{stat.value}</p>
                    {stat.helper ? (
                      <p className="text-xs text-slate-500">{stat.helper}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
        <section
          id="home-progress-section"
          className="mt-2"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                Etapa {journeyStageInfo.step} de {journeyStageInfo.total}
              </p>
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                {progressHeading}
              </h2>
              {isNewUser ? (
                <p className="mt-1 text-sm font-semibold text-slate-500">{progressDescription}</p>
              ) : null}
            </div>
            <div className="text-left text-sm font-semibold text-slate-500 sm:text-right">
              <p className="text-xs text-slate-400">
                {progressCompletedCount}/{progressTotalCount} etapas concluídas
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-4">
            <div className="rounded-3xl border border-[#F6007B] bg-gradient-to-br from-[#FFF6FB] via-white to-white px-6 py-6 shadow-[0_8px_30px_rgba(246,0,123,0.12)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#F6007B]">
                    <FaVideo className="h-3.5 w-3.5" aria-hidden="true" />
                    Saguão da Consultoria
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Agenda Semanal de Reuniões
                  </h3>
                  <p className="text-sm font-medium text-slate-600">
                    Traga seus conteúdos. Nossa inteligência artificial já pré-analisou seus dados mensais.
                  </p>
                </div>
                {!planIsPro && (
                  <button
                    onClick={handleHeaderSubscribe}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 focus-visible:ring-offset-2"
                  >
                    <FaLock className="h-3 w-3" />
                    Ativar Acesso (R$ 49,90)
                  </button>
                )}
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { title: "Boas-Vindas & Networking", day: "Segundas", time: "19h", icon: <FaUsers /> },
                  { title: "Revisão e Estruturação de Roteiros", day: "Terças", time: "19h", icon: <FaRobot /> },
                  { title: "Revisão de Conteúdo e Performance", day: "Quintas", time: "19h", icon: <FaChartLine /> }
                ].map((mtg, i) => (
                  <div key={i} className={`flex flex-col gap-3 rounded-2xl border p-4 transition-all duration-300 ${planIsPro ? "border-slate-200 bg-white hover:border-[#F6007B]/30 hover:shadow-md cursor-pointer" : "border-slate-100 bg-slate-50/50 opacity-80 cursor-not-allowed"}`}>
                    <div className="flex items-center gap-2 text-slate-400">
                      {mtg.icon}
                      <span className="text-[11px] font-bold uppercase tracking-widest">{mtg.day} • {mtg.time}</span>
                    </div>
                    <p className="font-semibold text-slate-900">{mtg.title}</p>
                    {planIsPro ? (
                      <span className="mt-auto text-xs font-bold text-[#F6007B]">Acessar Link Zoom →</span>
                    ) : (
                      <span className="mt-auto text-xs font-medium text-slate-400">Bloqueado</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {communityVipHasAccess && communityVipNeedsJoinReminder ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-900">
                  Falta confirmar sua entrada no grupo VIP
                </p>
                <p className="text-sm text-amber-800">
                  Os links das reuniões e o networking da comunidade acontecem por lá.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    void handleJoinVip("vip_reminder");
                  }}
                  disabled={resolvingVipAccess}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Entrar no grupo VIP
                  <FaExternalLinkAlt className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleConfirmVipJoin("vip_reminder");
                  }}
                  disabled={confirmingVipJoin}
                  className="inline-flex items-center justify-center rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {confirmingVipJoin ? "Confirmando..." : "Já entrei no grupo"}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {/* --- SEUS DIAGNÓSTICOS (Fase 4: Agência Consultiva) --- */}
        <section className="mt-8 sm:mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Seus Diagnósticos
              <span className="bg-[#6E1F93]/10 text-[#6E1F93] text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full">
                Prontuário
              </span>
            </h2>
          </div>
          <p className="text-sm text-slate-600 mb-6 max-w-2xl">
            Acompanhe as anotações feitas pela nossa equipe nas reuniões semanais. Nós avaliamos o seu conteúdo para que <strong className="font-bold text-slate-800">você atraia as marcas certas e aumente o seu valor</strong>, sem precisar ir atrás delas.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Review de Roteiros Card */}
            <div className={`relative flex flex-col p-6 rounded-[2rem] border overflow-hidden transition-all ${planIsPro ? 'border-slate-200 bg-white hover:border-[#6E1F93]/30 hover:shadow-lg group' : 'border-slate-200 bg-white'}`}>
              {!planIsPro && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[5px] p-8 text-center">
                  <div className="bg-white/90 p-3 rounded-2xl shadow-xl mb-4">
                    <FaLock className="text-[#6E1F93] w-5 h-5" />
                  </div>
                  <h4 className="text-slate-900 font-extrabold text-sm mb-4 leading-snug">
                    O diagnóstico desta semana <br />está disponível para você.
                  </h4>
                  <button
                    onClick={handleHeaderSubscribe}
                    className="group/btn relative overflow-hidden bg-[#141C2F] text-white font-black py-3 px-6 rounded-2xl text-[11px] uppercase tracking-wider hover:scale-105 transition-all shadow-2xl"
                  >
                    <span className="relative z-10">Desbloquear Acesso VIP</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-shimmer" />
                  </button>
                </div>
              )}
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${planIsPro ? 'bg-violet-50 text-violet-600' : 'bg-slate-100 text-slate-400'}`}>
                  <FaRegEdit className="w-6 h-6" />
                </div>
              </div>
              <h3 className={`text-lg font-black tracking-tight mb-2 ${planIsPro ? 'text-slate-900 group-hover:text-[#6E1F93] transition-colors' : 'text-slate-500'}`}>
                Revisão de Roteiros
              </h3>
              <p className="text-sm text-slate-500 mb-6 flex-1">
                Acesse as anotações técnicas e direcionamentos da equipe para que o seu conteúdo chame a atenção de marcas.
              </p>
              {planIsPro && (
                <Link href="/dashboard/scripts" className="inline-flex items-center justify-center w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-3 px-4 rounded-xl transition text-sm">
                  Abrir Meus Roteiros
                </Link>
              )}
            </div>

            {/* Review de Conteúdo Card */}
            <div className={`relative flex flex-col p-6 rounded-[2rem] border overflow-hidden transition-all ${planIsPro ? 'border-slate-200 bg-white hover:border-[#F6007B]/30 hover:shadow-lg group' : 'border-slate-200 bg-white'}`}>
              {!planIsPro && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[5px] p-8 text-center">
                  <div className="bg-white/90 p-3 rounded-2xl shadow-xl mb-4">
                    <FaLock className="text-[#F6007B] w-5 h-5" />
                  </div>
                  <h4 className="text-slate-900 font-extrabold text-sm mb-4 leading-snug">
                    Feedback tático da IA <br />disponível para posts recentes.
                  </h4>
                  <button
                    onClick={handleHeaderSubscribe}
                    className="group/btn relative overflow-hidden bg-[#141C2F] text-white font-black py-3 px-6 rounded-2xl text-[11px] uppercase tracking-wider hover:scale-105 transition-all shadow-2xl"
                  >
                    <span className="relative z-10">Desbloquear Acesso VIP</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-shimmer" />
                  </button>
                </div>
              )}
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${planIsPro ? 'bg-pink-50 text-pink-600' : 'bg-slate-100 text-slate-400'}`}>
                  <FaRegChartBar className="w-6 h-6" />
                </div>
              </div>
              <h3 className={`text-lg font-black tracking-tight mb-2 ${planIsPro ? 'text-slate-900 group-hover:text-[#F6007B] transition-colors' : 'text-slate-500'}`}>
                Review de Posts
              </h3>
              <p className="text-sm text-slate-500 mb-6 flex-1">
                Feedbacks táticos sobre os seus posts (o que continuar fazendo e o que parar) visando criar a narrativa certa para as campanhas que você quer fechar.
              </p>
              {planIsPro && (
                <Link href="/dashboard/post-analysis" className="inline-flex items-center justify-center w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-3 px-4 rounded-xl transition text-sm">
                  Ver Diagnósticos
                </Link>
              )}
            </div>
          </div>
        </section>



        {microInsightCard ? (
          <section className="mt-8">
            <div className="">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                <FaMagic className="h-3.5 w-3.5 text-[#F6007B]" aria-hidden />
                Insight estratégico da semana
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-base leading-relaxed text-slate-900">{microInsightCard.message}</p>
                {microInsightCard.impactLabel ? (
                  <p className="text-sm font-semibold text-emerald-600">{microInsightCard.impactLabel}</p>
                ) : null}
                {microInsightCard.contextLabel ? (
                  <p className="text-xs text-slate-500">{microInsightCard.contextLabel}</p>
                ) : null}
                {microInsightCard.teaser ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      Peek de valor
                    </span>
                    <span
                      className={`rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-800 shadow-sm ${microInsightCard.teaser.blurred ? "filter blur-[2px]" : ""
                        }`}
                    >
                      {microInsightCard.teaser.label}
                    </span>
                  </div>
                ) : null}
              </div>
              {microInsightCard.ctaLabel || microInsightCard.footnote ? (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  {microInsightCard.ctaLabel ? (
                    <button
                      type="button"
                      onClick={handleMicroInsightAction}
                      className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${microInsightCard.variant === "primary"
                        ? "bg-[#F6007B] text-white shadow-sm hover:bg-[#e2006f] focus-visible:ring-[#F6007B]/40"
                        : "border border-slate-300 text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-300"
                        }`}
                    >
                      {microInsightCard.ctaLabel}
                    </button>
                  ) : null}
                  {microInsightCard.footnote ? (
                    <span className="flex items-center gap-1 text-[11px] text-slate-500">
                      <FaShieldAlt className="h-3 w-3" aria-hidden />
                      {microInsightCard.footnote}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}


      </div>
    </>
  );
}
