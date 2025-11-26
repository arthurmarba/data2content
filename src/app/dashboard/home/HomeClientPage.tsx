// src/app/dashboard/home/HomeClientPage.tsx
// Container client-side da Home com dados placeholders (MVP scaffolding).

"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
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

type Period = CommunityMetricsCardData["period"];
const DEFAULT_PERIOD: Period = "30d";
const TRIAL_CTA_LABEL = "⚡ Ativar IA no WhatsApp";
const HOME_WELCOME_STORAGE_KEY = "home_welcome_dismissed";

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
  activate_pro: FaGem,
};

const JOURNEY_STEP_COPY: Record<
  JourneyStepId,
  { stepHelper: string; ctaLabel: string }
> = {
  connect_instagram: {
    stepHelper: "Conecte seu IG via Facebook Login para liberar diagnósticos e benchmarks em tempo real.",
    ctaLabel: "Vincular Instagram",
  },
  create_media_kit: {
    stepHelper: "Complete o mídia kit com cases, métricas e contatos para impressionar novas marcas.",
    ctaLabel: "Criar mídia kit",
  },
  publish_media_kit_link: {
    stepHelper: "Adicione o link do kit na bio e em propostas para provar sua autoridade automaticamente.",
    ctaLabel: "Copiar link do kit",
  },
  activate_pro: {
    stepHelper:
      "Posicione seu conteúdo para atrair marcas: IA no WhatsApp 24/7 + mentoria semanal para fechar campanhas sem exclusividade.",
    ctaLabel: "Ativar Plano Agência",
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
  const isNewUser = Boolean(session?.user?.isNewUserForOnboarding);
  const focusIntent = searchParams?.get("intent")?.toLowerCase() ?? null;
  const sessionUserId = session?.user?.id ?? null;

  const [summary, setSummary] = React.useState<HomeSummaryResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [initialFetch, setInitialFetch] = React.useState(false);
  const [showWhatsAppConnect, setShowWhatsAppConnect] = React.useState(false);
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
    async (period: Period, scope: "all" | "community" | "proposals" = "all") => {
      const params = new URLSearchParams();
      params.set("period", period);
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

  const refreshProposalsSummary = React.useCallback(
    async (options?: { silent?: boolean }) => {
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
      }
    },
    [fetchSummary]
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

    setLoading(true);
    fetchSummary(DEFAULT_PERIOD, "all")
      .then((data) => {
        if (cancelled) return;
        setSummary((prev) => ({
          ...(prev ?? ({} as HomeSummaryResponse)),
          ...data,
        }));
        setInitialFetch(true);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status, initialFetch, fetchSummary]);

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
    process.env.NEXT_PUBLIC_COMMUNITY_VIP_URL ??
    "https://chat.whatsapp.com/CKTT84ZHEouKyXoDxIJI4c";
  const communityFreeMember = summary?.community?.free?.isMember ?? false;
  const communityFreeInviteUrl =
    summary?.community?.free?.inviteUrl ?? defaultCommunityFreeUrl;
  const communityVipHasAccess = summary?.community?.vip?.hasAccess ?? false;
  const communityVipMember = summary?.community?.vip?.isMember ?? false;
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
    hasPremiumAccessPlan && communityVipHasAccess && Boolean(communityVipInviteUrl);
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

  const isSubscriberPlan = hasPremiumAccessPlan || planIsPro || communityVipHasAccess;

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

  const handleCopyMediaKitLink = React.useCallback(
    async (origin: string) => {
      trackDashboardCta("copy_kit_link", { surface: origin });
      if (!mediaKitShareUrl) {
        toast.error("Crie seu Mídia Kit para gerar um link compartilhável.");
        return;
      }
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        toast.error("Copie o link direto pelo painel do Mídia Kit.");
        return;
      }
      try {
        await navigator.clipboard.writeText(mediaKitShareUrl);
        toast.success("Link do Mídia Kit copiado!");
      } catch (error) {
        void error;
        toast.error("Não foi possível copiar o link agora.");
      }
    },
    [mediaKitShareUrl, trackDashboardCta]
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
          text: planTrialCountdownLabel ? `Termina em ${planTrialCountdownLabel}` : "Modo Agência ativo",
        };
      }

      if (planTrialEligible && !planTrialStarted) {
        return {
          icon: "✨",
          className: "border-emerald-200 bg-emerald-50 text-emerald-700",
          text: "Assine o Plano Agência para liberar a IA completa",
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
      text: "Plano Agência ativo",
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
        ? "Assine o Plano Agência para liberar a IA completa."
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

  const handleJoinVip = React.useCallback(() => {
    if (!communityVipInviteUrl) return;
    if (canAccessVipCommunity) {
      trackCardAction("mentorship", "vip_click", { surface: "mentorship_strip", access: "allowed" });
      handleNavigate(communityVipInviteUrl);
      return;
    }
    trackCardAction("mentorship", "vip_locked", { surface: "mentorship_strip", access: "blocked" });
    openSubscribeModal("default", { source: "mentorship_strip", returnTo: "/dashboard/home" });
  }, [canAccessVipCommunity, communityVipInviteUrl, handleNavigate, openSubscribeModal, trackCardAction]);

  const handleOpenFreeCommunity = React.useCallback(() => {
    if (!communityFreeInviteUrl) return;
    trackCardAction("mentorship", "free_click", { surface: "mentorship_strip" });
    handleNavigate(communityFreeInviteUrl);
  }, [communityFreeInviteUrl, handleNavigate, trackCardAction]);

  const whatsappBanner = React.useMemo(() => {
    const previewMessages = [
      "IA: Seu melhor horário ainda é às 19h.",
      "IA: Já são 4 dias sem publicar. Quer que eu monte 3 ideias e te lembre 30 min antes?",
    ];
    const base = {
      previewMessages,
      heading: "Mobi no WhatsApp",
      subheading: "Seu assistente de carreira com IA.",
      description: "Conexão segura em menos de 30s.",
      bullets: [
        { icon: "🧠", text: "Conteúdos diários nas categorias que puxam alcance" },
        { icon: "⏰", text: "Melhor dia e horário com base nos seus dados" },
        { icon: "🗓️", text: "Lembrete com roteiro pronto pra publicar" },
      ],
      footnote: "Conexão segura · 30 segundos.",
    };

    if (trialExpired) {
      return {
        ...base,
        calloutTitle: "Continue com a estrategista no WhatsApp.",
        calloutSubtitle:
          "Assine o Plano Agência para seguir recebendo categorias vencedoras, horário ideal e lembretes direto no WhatsApp.",
        primary: {
          label: "Assinar Plano Agência",
          variant: "pro" as const,
          icon: <FaGem />,
          onClick: openSubscribeModal,
          trackingKey: "hero_trial_upgrade",
        },
        footnote: "🔒 Assine o Plano Agência e mantenha os alertas diários no WhatsApp.",
      };
    }

    if (whatsappTrialActive || whatsappLinked) {
      return {
        ...base,
        calloutTitle: "Sua estrategista está ativa no WhatsApp.",
        calloutSubtitle: "Peça novas ideias por categoria e confirme os horários sempre que quiser.",
        primary: {
          label: "Abrir WhatsApp IA",
          variant: "whatsapp" as const,
          icon: <FaWhatsapp />,
          onClick: handleOpenWhatsApp,
          trackingKey: "hero_trial_open",
        },
        footnote: "🔔 Peça novos conteúdos sempre que precisar.",
      };
    }

    if (!whatsappTrialStarted && whatsappTrialEligible) {
      return {
        ...base,
        calloutTitle: "Ative a IA no WhatsApp.",
        calloutSubtitle:
          "Eu analiso seus posts, identifico oportunidades e te lembro dos horários certos.",
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
        calloutTitle: "Conecte seu WhatsApp e mantenha a estratégia no ritmo.",
        calloutSubtitle: "Ative alertas personalizados com horários ideais e roteiro pronto.",
        primary: {
          label: "Conectar WhatsApp IA",
          variant: "whatsapp" as const,
          icon: <FaWhatsapp />,
          onClick: handleOpenWhatsApp,
          trackingKey: "hero_trial_connect",
        },
        footnote: "🔒 Plano Agência ativo — conecte e receba os alertas no WhatsApp.",
      };
    }

    return {
      ...base,
      calloutTitle: "Ative a IA no WhatsApp.",
      calloutSubtitle:
        "Eu analiso seus posts, identifico oportunidades e te lembro dos horários certos.",
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

  const progressItems = React.useMemo<JourneyStep[]>(() => {
    const instagramStatus: StepStatus = isInstagramConnected ? "done" : "todo";
    const iaActive = whatsappLinked || whatsappTrialActive;
    const iaStatus: StepStatus = iaActive ? "done" : "todo";
    const proStatus: StepStatus = planIsPro ? "done" : trialExpired ? "todo" : whatsappTrialActive ? "in-progress" : "todo";
    const mentorshipStatus: StepStatus = communityVipMember ? "done" : "todo";
    const communityFreeStatus: StepStatus = communityFreeMember ? "done" : "todo";

    return [
      {
        id: "progress-instagram",
        title: "Vincular Instagram",
        description: isInstagramConnected
          ? "Relatório gratuito renovado toda semana com horários e tendências personalizadas."
          : "Conecte em poucos cliques para liberar diagnóstico com horários e formatos vencedores.",
        icon: <FaInstagram />,
        status: instagramStatus,
        actionLabel: isInstagramConnected ? "Conectado" : "Vincular Instagram",
        action: handleHeaderConnectInstagram,
        variant: "secondary",
        disabled: isInstagramConnected,
      },
      {
        id: "progress-community-free",
        title: "Acessar comunidade gratuita",
        description: communityFreeMember
          ? "Você já faz parte da comunidade gratuita."
          : "Entre para destravar desafios guiados e feedback de outros criadores.",
        icon: <FaGlobe />,
        status: communityFreeStatus,
        actionLabel: communityFreeMember ? "Acessar comunidade" : "Entrar na comunidade",
        action: () => handleJoinFreeCommunity("progress"),
        variant: "secondary",
        disabled: false,
      },
      {
        id: "progress-pro",
        title: "Assinar Plano Agência",
        description: planIsPro
          ? "IA ilimitada, alertas constantes, convites de publicidade sem comissão e relatórios automáticos já estão ativos."
          : "Assine o Plano Agência para manter a IA ligada, liberar oportunidades com marcas e receber suporte direto da equipe.",
        icon: <FaGem />,
        status: proStatus,
        actionLabel: planIsPro ? "Ver painel Agência" : "Assinar agora",
        action: planIsPro ? () => handleNavigate("/dashboard") : handleHeaderSubscribe,
        variant: "pro",
        disabled: planIsPro,
      },
      {
        id: "progress-community-vip",
        title: "Acessar grupo VIP (Consultoria)",
        description: communityVipMember
          ? "Participando das mentorias semanais e trocas com outros criadores."
          : "Entre para destravar mentorias semanais e networking exclusivo.",
        icon: <FaUsers />,
        status: mentorshipStatus,
        actionLabel: communityVipMember
          ? "Mentoria ativa"
          : communityVipHasAccess
            ? "Entrar no grupo VIP"
            : "Assinar para entrar",
        action: () => {
          if (communityVipMember) {
            handleMentorshipAction("whatsapp_reminder");
            return;
          }
          if (communityVipHasAccess) {
            handleJoinVip();
            return;
          }
          handleHeaderSubscribe();
        },
        variant: "vip",
        disabled: false,
      },
    ];
  }, [
    communityFreeMember,
    communityVipHasAccess,
    communityVipMember,
    handleHeaderConnectInstagram,
    handleHeaderSubscribe,
    handleJoinFreeCommunity,
    handleNavigate,
    handleJoinVip,
    handleMentorshipAction,
    isInstagramConnected,
    planIsPro,
    trialExpired,
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
        community: "progress-community",
        whatsapp: "progress-ai",
        ia: "progress-ai",
        plan: "progress-pro",
        subscription: "progress-pro",
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
          "Conecte seu Instagram e receba um relatório gratuito com horários e tendências personalizadas.",
        helper: "Leitura somente leitura • Sorteio de análise ativado automaticamente.",
        ctaLabel: "🔗 Conectar Instagram",
        onClick: handleHeaderConnectInstagram,
      };
    }

    if (!whatsappLinked && !whatsappTrialActive && !whatsappTrialStarted && whatsappTrialEligible) {
      return {
        subtitle: "Sua IA está quase pronta — ative no WhatsApp com o Plano Agência.",
        helper: "Conexão segura, leva menos de 30s.",
        ctaLabel: TRIAL_CTA_LABEL,
        onClick: handleHeaderStartTrial,
      };
    }

    if (!planIsPro) {
      return {
        subtitle: "Ative o Modo Agência para manter a IA ligada sem limites e receber oportunidades de publicidade sem exclusividade.",
        helper: null,
        ctaLabel: "🚀 Assinar Plano Agência",
        onClick: handleHeaderSubscribe,
      };
    }

    if (!communityFreeMember && !communityVipMember) {
      return {
        subtitle:
          "Entre na comunidade para participar das mentorias semanais e trocar com outros criadores.",
        helper: "Acesso imediato • Mentorias e desafios guiados.",
        ctaLabel: "🌎 Entrar na comunidade",
        onClick: () => handleJoinFreeCommunity("hero"),
      };
    }

    if (planIsPro && !whatsappLinked) {
      return {
        subtitle: "Conecte o WhatsApp para seguir recebendo alertas inteligentes e convites de publicidade.",
        helper: "Conexão segura em segundos.",
        ctaLabel: "🤖 Conectar WhatsApp IA",
        onClick: handleHeaderStartTrial,
      };
    }

    if (planIsPro) {
      return {
        subtitle: "Continue acompanhando seus alertas, relatórios e oportunidades no painel do Plano Agência.",
        helper: null,
        ctaLabel: "📊 Abrir painel Plano Agência",
        onClick: () => handleNavigate("/dashboard"),
      };
    }
    return {
      subtitle: whatsappLinked
        ? "Peça novas ideias no WhatsApp sempre que precisar."
        : "Entre na comunidade para acompanhar os próximos desafios.",
      helper: null,
      ctaLabel: whatsappLinked ? "📱 Abrir WhatsApp IA" : "🌎 Ver comunidade",
      onClick: whatsappLinked ? handleOpenWhatsApp : () => handleJoinFreeCommunity("hero"),
    };
  }, [
    communityFreeMember,
    communityVipMember,
    handleHeaderConnectInstagram,
    handleNavigate,
    handleHeaderStartTrial,
    handleHeaderSubscribe,
    handleJoinFreeCommunity,
    handleOpenWhatsApp,
    isInstagramConnected,
    planIsPro,
    whatsappLinked,
    whatsappTrialActive,
    whatsappTrialEligible,
    whatsappTrialStarted,
  ]);

  const heroFeedbackMessage = React.useMemo(() => {
    if (!isInstagramConnected) return null;
    if (whatsappLinked || whatsappTrialActive) {
      return "🤖 IA no WhatsApp ativa — confira seus alertas e peça novas ideias quando quiser.";
    }
    return "✅ Instagram conectado! Mobi já está analisando seus últimos posts.";
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
    ? "Bem-vindo! Veja o que você pode fazer primeiro 👇"
    : "Seu progresso na Data2Content";
  const progressDescription = isNewUser
    ? "Conecte o Instagram, ative a IA no WhatsApp, participe da comunidade e escolha seu plano ideal."
    : journeyStageInfo.label;
  const toolCards = React.useMemo(() => {
    const plannerMetric = !isInstagramConnected
      ? "Conexão somente leitura em segundos."
      : nextSlotLabel
        ? `Próximo horário sugerido: ${nextSlotLabel}`
        : weeklyGoal > 0
          ? `Progresso da semana: ${Math.min(postsSoFar, weeklyGoal)}/${weeklyGoal} posts`
          : "Defina uma meta semanal e eu gero os horários ideais.";
    const plannerActionLabel = isInstagramConnected ? "Gerar horários com IA" : "Conectar Instagram";
    const plannerLocked = planningGroupLocked && !(hasPremiumAccessPlan || planTrialActive);
    const chartsLocked = plannerLocked;

    const mediaKitLastUpdate = summary?.mediaKit?.lastUpdatedLabel
      ? `Atualizado ${summary.mediaKit.lastUpdatedLabel}`
      : "Atualize com dados recentes antes de enviar.";

    const communityStatus = communityVipMember
      ? "Mentorias VIP ativas."
      : communityVipHasAccess
        ? "Grupo VIP liberado para você."
        : communityFreeMember
          ? "Você já está na comunidade."
          : "Acesso gratuito e leve.";

    const cards = [
      {
        key: "planner",
        icon: <FaCalendarAlt aria-hidden="true" />,
        title: plannerLocked ? "Planejamento (Plano Agência)" : "Planejar com IA",
        description: plannerLocked
          ? "Assine o Plano Agência para liberar horários automáticos e roteiros com IA."
          : isInstagramConnected
            ? "Gere horários personalizados e receba roteiros prontos."
            : "Conecte o Instagram e destrave horários com IA.",
        status: plannerLocked ? "Recurso exclusivo Plano Agência" : plannerMetric,
        actionLabel: plannerLocked ? "Assinar Plano Agência" : plannerActionLabel,
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
        title: chartsLocked ? "Gráficos (Plano Agência)" : "Gráficos de desempenho",
        description: chartsLocked
          ? "Assine o Plano Agência para destravar gráficos de alcance e engajamento."
          : "Visualize picos de alcance, formatos e tons que mais engajam.",
        status: chartsLocked
          ? "Exclusivo Plano Agência"
          : isInstagramConnected
            ? "Explore tendências com dados reais da sua conta."
            : "Conecte o Instagram para popular os gráficos.",
        actionLabel: chartsLocked
          ? "Assinar Plano Agência"
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
          ? "Mantenha seus números atualizados antes de enviar para marcas."
          : "Gere um link com prova social automática em minutos.",
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
          ? "Participe dos desafios e mentorias semanais."
          : "Entre para trocar bastidores com criadores Data2Content.",
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
            ? handleJoinVip
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
                Ative o Plano Agência e continue recebendo roteiros e alertas ilimitados no WhatsApp.
              </p>
            </div>
            <ActionButton
              label="Assinar Plano Agência"
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
            Copie o código, abra o WhatsApp e confirme para liberar a IA direto no app.
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
    : "Conecte seu Instagram para liberar os atalhos.";

  const creatorTools = React.useMemo<CreatorToolCardProps[]>(() => {
    const proLocked = !hasPremiumAccessPlan;
    const chartsLocked = planningGroupLocked && !(hasPremiumAccessPlan || planTrialActive);
    const list: CreatorToolCardProps[] = [];

    list.push({
      id: "campaigns",
      title: "Campanhas",
      description: "Receba e responda propostas com IA",
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
      description: "Sua vitrine pública para marcas",
      icon: <FaMagic className="h-5 w-5" aria-hidden />,
      cta: "open",
      onClick: () => {
        emitToolClick("media_kit", "open");
        handleNavigate("/dashboard/media-kit");
      },
    });

    list.push({
      id: "calculator",
      title: "Calculadora Plano Agência",
      description: "Descubra seu valor de mercado",
      icon: <FaCalculator className="h-5 w-5" aria-hidden />,
      badge: "Agência",
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
      description: "Agende e organize seus posts",
      icon: <FaCalendarAlt className="h-5 w-5" aria-hidden />,
      badge: "Agência",
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
      description: "Inspirações e tendências virais",
      icon: <FaUsers className="h-5 w-5" aria-hidden />,
      badge: "Agência",
      locked: proLocked,
      cta: proLocked ? "activate" : "open",
      onClick: () => {
        emitToolClick("discovery", proLocked ? "paywall" : "open");
        handleNavigate("/planning/discover");
      },
    });

    list.push({
      id: "charts",
      title: chartsLocked ? "Gráficos (Plano Agência)" : "Gráficos",
      description: chartsLocked
        ? "Assine o Plano Agência para destravar gráficos de alcance e engajamento."
        : "Veja horários quentes, formatos e tons que mais engajam.",
      icon: <FaChartLine className="h-5 w-5" aria-hidden />,
      badge: "Agência",
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
      description: "Seu assistente de conteúdo",
      icon: <FaRobot className="h-5 w-5" aria-hidden />,
      badge: "Agência",
      locked: proLocked,
      cta: proLocked ? "activate" : "open",
      onClick: () => {
        emitToolClick("chat", proLocked ? "paywall" : "open");
        handleNavigate("/dashboard/chat");
      },
    });

    list.push({
      id: "whatsapp",
      title: "IA no WhatsApp",
      description: "Diagnóstico e ideias rápidas",
      icon: <FaWhatsapp className="h-5 w-5" aria-hidden />,
      badge: "Agência",
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

  const tutorialLoading = loading && !journeyProgress;
  const toolsLoading = loading && !summary;

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
          <span>✨ Mentorias semanais do Plano Agência</span>
          {!canAccessVipCommunity ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              <FaLock className="h-3 w-3" />
              Assinantes
            </span>
          ) : null}
        </div>
        <p className="text-slate-600">
          Consultorias ao vivo no grupo VIP de assinantes e comunidade gratuita para networking.
        </p>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:mt-0 sm:flex-row sm:items-center">
        {communityVipInviteUrl ? (
          <button
            type="button"
            onClick={handleJoinVip}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {canAccessVipCommunity ? "Abrir grupo VIP" : "Assinar para entrar"}
            {!canAccessVipCommunity ? (
              <FaLock className="h-4 w-4" />
            ) : (
              <FaExternalLinkAlt className="h-4 w-4" />
            )}
          </button>
        ) : null}
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
    </div>
  ) : null;

  const affiliateFootnote = hasMediaKit
    ? "Seu mídia kit já leva seu link de afiliado. Novos cadastros vindos dele geram comissão pra você."
    : null;

  React.useEffect(() => {
    if (dashboardMinimal) return;
    if (shouldDisplayConnectBanner) {
      trackSurfaceView("home_whatsapp_connect", { origin: "home" });
    }
  }, [dashboardMinimal, shouldDisplayConnectBanner, trackSurfaceView]);

  if (tutorialHomeEnabled) {
    return (
      <div className="w-full space-y-8 px-4 pt-4 pb-8 sm:px-6">
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
              <p>{journeyStageInfo.label}</p>
              {isNewUser ? (
                <p className="text-xs text-slate-400">
                  {progressCompletedCount}/{progressTotalCount} passos concluídos
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-4 h-2 w-full rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-[#F6007B] transition-[width]"
              style={{ width: `${stageProgressPercent}%` }}
            />
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>
              {progressCompletedCount}/{progressTotalCount} etapas concluídas
            </span>
            <span>{stageProgressPercent}% da jornada</span>
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

        <div className="pt-4">
          <CreatorToolsGrid
            tools={creatorTools}
            loading={toolsLoading}
            disabledReason={toolsLockedReason}
            footnote={affiliateFootnote}
          />
        </div>
        {connectBanner}
      </div>
    );
  }

  if (dashboardMinimal) {
    return (
      <div className="w-full px-4 pt-4 pb-8 sm:px-6">
        <MinimalDashboard
          summary={summary}
          loading={loading}
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
      <div className="w-full px-4 pt-4 pb-8 sm:px-6">
        {connectBanner}
        {showWelcomeCard ? (
          <div className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50/95 px-5 py-5 text-emerald-900 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">
                  Bem-vindo à Data2Content
                </p>
                <p className="text-sm font-semibold">
                  Veja o que destrava seus diagnósticos: conecte o Instagram, ative a IA no WhatsApp,
                  entre na comunidade e escolha seu plano ideal.
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
                <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500 lg:justify-start">
                  {`Etapa ${journeyStageInfo.step} de ${journeyStageInfo.total} · ${journeyStageInfo.label}`}
                </span>
                <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                  <span aria-hidden="true">👋</span>{" "}
                  {isNewUser ? (
                    <>
                      Bem-vindo, <span className="text-[#F6007B]">{firstName}</span>!{" "}
                      <span className="text-slate-900">Vamos dar os primeiros passos com IA.</span>
                    </>
                  ) : (
                    <>
                      Oi, <span className="text-[#F6007B]">{firstName}</span>!{" "}
                      <span className="text-slate-900">Sua carreira de criador com IA começa aqui.</span>
                    </>
                  )}
                </h1>
                <p className="text-base text-slate-600 sm:text-lg">{heroMessaging.subtitle}</p>
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
              <p>{journeyStageInfo.label}</p>
              {isNewUser ? (
                <p className="text-xs text-slate-400">
                  {progressCompletedCount}/{progressTotalCount} passos concluídos
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-4 h-2 w-full rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-[#F6007B] transition-[width]"
              style={{ width: `${stageProgressPercent}%` }}
            />
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>
              {progressCompletedCount}/{progressTotalCount} etapas concluídas
            </span>
            <span>{stageProgressPercent}% da jornada</span>
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


        <section className="mt-6 rounded-3xl border border-[#FCD6EA] bg-gradient-to-br from-[#FFF6FB] via-white to-white px-6 py-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">IA no WhatsApp</h2>
                <p className="text-sm text-slate-600">
                  {whatsappBanner.subheading} {whatsappBanner.description}
                </p>
              </div>
              <ul className="space-y-2 text-sm text-slate-700">
                {whatsappBanner.bullets.map((item) => (
                  <li key={item.text} className="flex items-start gap-2">
                    <span aria-hidden="true">{item.icon}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
              <div className="space-y-2 rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm">
                <p className="flex items-center gap-2">
                  <span aria-hidden="true">💬</span>
                  Mobi envia alertas quando surge um pico de engajamento no seu perfil.
                </p>
                <p className="flex items-center gap-2">
                  <span aria-hidden="true">🕓</span>
                  Conexão segura em menos de 30 segundos.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900">{whatsappBanner.calloutTitle}</h3>
                <p className="text-xs text-slate-600">{whatsappBanner.calloutSubtitle}</p>
                <ActionButton
                  label={whatsappBanner.primary.label}
                  icon={whatsappBanner.primary.icon}
                  variant={whatsappBanner.primary.variant}
                  onClick={() => {
                    trackHeroAction(whatsappBanner.primary.trackingKey, {
                      stage: heroStage,
                      whatsapp_linked: whatsappLinked,
                      plan_is_pro: planIsPro,
                      community_free_member: communityFreeMember,
                      community_vip_member: communityVipMember,
                    });
                    whatsappBanner.primary.onClick();
                  }}
                  disabled={isInitialLoading}
                  className={[
                    "w-full justify-center rounded-full px-6 py-3 text-sm font-semibold sm:w-auto",
                    whatsappBanner.primary.className ?? null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
                {whatsappBanner.footnote ? (
                  <p className="text-xs text-slate-500">{whatsappBanner.footnote}</p>
                ) : null}
              </div>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-[0_20px_55px_rgba(15,23,42,0.12)] backdrop-blur-sm">
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F6007B]/10 text-[#F6007B]">
                    <FaRobot className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Prévia do chat com a IA</p>
                    <p className="text-xs text-slate-500">Veja como os alertas chegam pra você</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {whatsappBanner.previewMessages.slice(0, 3).map((message, index) => (
                    <div key={message} className="flex items-start gap-2">
                      <span aria-hidden="true" className="mt-1 text-[#F6007B]">
                        🤖
                      </span>
                      <div
                        className={`max-w-[240px] rounded-2xl px-4 py-2 text-[13px] leading-relaxed shadow-sm ${index % 2 === 0 ? "bg-white text-slate-700" : "bg-slate-50 text-slate-700"
                          }`}
                      >
                        {message}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-start gap-2 text-slate-400">
                    <span aria-hidden="true" className="mt-1 text-[#F6007B]">
                      🤖
                    </span>
                    <div className="flex items-center gap-1 rounded-2xl bg-slate-50 px-4 py-2 text-[13px]">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-[#F6007B]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-[#F6007B] [animation-delay:120ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-[#F6007B] [animation-delay:240ms]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>


        <section className="mt-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Ferramentas do criador</h2>
            <p className="text-sm text-slate-500">
              Aja quando quiser: planner, kit de mídia e comunidade em um só lugar.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {toolCards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={card.onAction}
                className="group relative flex flex-col items-start justify-between gap-4 rounded-3xl border border-slate-100 bg-white p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/30 focus-visible:ring-offset-2"
              >
                <div className="w-full space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-xl text-[#F6007B] transition-colors group-hover:bg-[#F6007B]/10">
                      {card.icon}
                    </span>
                    <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {card.status}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-slate-900">{card.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{card.description}</p>
                  </div>
                </div>

                <div className="mt-2 w-full">
                  <span className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors group-hover:bg-slate-100 group-hover:text-slate-900">
                    {card.actionLabel}
                    <FaChevronRight className="h-3 w-3 text-slate-400 transition-colors group-hover:text-slate-600" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
        {microInsightCard ? (
          <section className="mt-8">
            <div className="">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                <FaMagic className="h-3.5 w-3.5 text-[#F6007B]" aria-hidden />
                Micro-insight da semana
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

        {showTrialMessageCard ? (
          <section className="mt-10 rounded-3xl bg-white px-6 py-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                  Teste gratuito da IA em andamento
                </h2>
                <p className="text-sm text-slate-600">
                  Aproveite os próximos {planTrialCountdownLabel ?? "dois dias"} para planejar a semana, pedir ideias e
                  confirmar horários com a IA.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:max-w-xs">
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="inline-flex w-full items-center justify-center rounded-full bg-[#F6007B] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e2006f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/40 focus-visible:ring-offset-2"
                >
                  Ver alertas da IA
                </button>
                <span className="text-center text-xs text-slate-500">
                  Mobi envia lembretes sempre que surge um pico de engajamento.
                </span>
              </div>
            </div>
          </section>
        ) : null}

        {showProUpsellCard ? (
          <section className="mt-10 rounded-3xl bg-gradient-to-br from-[#FFF1F8] via-white to-white px-6 py-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Gostou da IA?</h2>
                <p className="text-sm text-slate-600">
                  Continue com relatórios automáticos, alertas ilimitados e suporte direto da equipe D2C.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:max-w-xs">
                <button
                  type="button"
                  onClick={handleHeaderSubscribe}
                  className="inline-flex w-full items-center justify-center rounded-full bg-[#F6007B] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e2006f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/40 focus-visible:ring-offset-2"
                >
                  Assinar Plano Agência
                </button>
                <span className="text-center text-xs text-slate-500">
                  Alertas ilimitados + relatórios semanais automáticos.
                </span>
              </div>
            </div>
          </section>
        ) : null}

      </div>
    </>
  );
}
