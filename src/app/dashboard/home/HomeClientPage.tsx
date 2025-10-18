// src/app/dashboard/home/HomeClientPage.tsx
// Container client-side da Home com dados placeholders (MVP scaffolding).

"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  FaBolt,
  FaBullhorn,
  FaCalendarAlt,
  FaChalkboardTeacher,
  FaChevronDown,
  FaGem,
  FaRocket,
  FaWhatsapp,
  FaUsers,
  FaTimes,
} from "react-icons/fa";

import NextPostCard from "./components/cards/NextPostCard";
import ConsistencyCard from "./components/cards/ConsistencyCard";
import MentorshipCard from "./components/cards/MentorshipCard";
import MediaKitCard from "./components/cards/MediaKitCard";
import CommunityMetricsCard from "./components/cards/CommunityMetricsCard";
import HomeGrid from "./components/HomeGrid";
import ActionButton from "./components/ActionButton";
import type { CommunityMetricsCardData, HomeSummaryResponse } from "./types";
import { useHomeTelemetry } from "./useHomeTelemetry";
import WhatsAppConnectInline from "../WhatsAppConnectInline";

type Period = CommunityMetricsCardData["period"];
const DEFAULT_PERIOD: Period = "30d";

type HeroStat = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  accent?: "up" | "down";
};

type HeroAction = {
  key: string;
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  variant: "primary" | "secondary" | "ghost" | "whatsapp" | "pro" | "vip";
};

const HERO_STATS_FALLBACK: HeroStat[] = [
  {
    id: "consistency",
    label: "Constância",
    value: "Ative seu planner semanal",
    hint: "Foque em 3-5 posts por semana",
  },
  {
    id: "proof",
    label: "Provas sociais",
    value: "Atualize o media kit",
    hint: "Mostre evolução para marcas",
  },
  {
    id: "mentoria",
    label: "Mentoria ao vivo",
    value: "Terças às 19h",
    hint: "Leve dúvidas e cases",
  },
];

type StepStatus = "done" | "in-progress" | "todo" | "loading";

interface JourneyStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: StepStatus;
  actionLabel: string;
  action: () => void;
  variant: "primary" | "secondary" | "ghost" | "vip";
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

const STEP_STATUS_CLASSES: Record<StepStatus, string> = {
  done: "bg-emerald-100 text-emerald-700",
  "in-progress": "bg-amber-100 text-amber-700",
  todo: "bg-slate-100 text-slate-600",
  loading: "bg-slate-100 text-slate-500",
};

export default function HomeClientPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const {
    trackCardAction,
    trackCardPeriodChange,
    trackHeroAction,
    trackSurfaceView,
    trackWhatsappEvent,
  } = useHomeTelemetry();

  const [summary, setSummary] = React.useState<HomeSummaryResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [metricsLoading, setMetricsLoading] = React.useState(false);
  const [initialFetch, setInitialFetch] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isChecklistOpen, setIsChecklistOpen] = React.useState(false);
  const [showWhatsAppConnect, setShowWhatsAppConnect] = React.useState(false);
  const [trialCountdown, setTrialCountdown] = React.useState("");
  const checklistId = React.useId();

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
    async (period: Period, scope: "all" | "community" = "all") => {
      const params = new URLSearchParams();
      params.set("period", period);
      if (scope === "community") params.set("scope", "community");

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
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        toast.error(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status, initialFetch, fetchSummary]);

  const handleChangePeriod = React.useCallback(
    (period: Period) => {
      trackCardPeriodChange("community_metrics", period);

      setMetricsLoading(true);
      fetchSummary(period, "community")
        .then((data) => {
          setSummary((prev) => {
            if (!prev) {
              return {
                communityMetrics: data.communityMetrics ?? {
                  period,
                  metrics: [],
                },
              } as HomeSummaryResponse;
            }
            return {
              ...prev,
              communityMetrics: data.communityMetrics ?? prev.communityMetrics,
            };
          });
          setError(null);
        })
        .catch((err) => {
          setError(err.message);
          toast.error(err.message);
        })
        .finally(() => setMetricsLoading(false));
    },
    [fetchSummary, trackCardPeriodChange]
  );

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

  const handleNextPostAction = React.useCallback(
    (action: string) => {
      trackCardAction("next_post", action);
      const plannerUrl = summary?.nextPost?.plannerUrl ?? "/dashboard/planning";
      const slotId = summary?.nextPost?.plannerSlotId ?? null;
      const plannerUrlWithSlot = slotId ? appendQueryParam(plannerUrl, "slotId", slotId) : plannerUrl;
      switch (action) {
        case "generate_script":
        case "show_variations":
        case "test_idea":
          handleNavigate(plannerUrlWithSlot);
          break;
        case "connect_instagram":
          handleNavigate("/dashboard/onboarding");
          break;
        default:
          break;
      }
    },
    [trackCardAction, summary?.nextPost?.plannerUrl, summary?.nextPost?.plannerSlotId, appendQueryParam, handleNavigate]
  );

  const handleConsistencyAction = React.useCallback(
    (action: string) => {
      trackCardAction("consistency", action);
      if (action === "plan_week") {
        handleNavigate(summary?.consistency?.plannerUrl ?? "/dashboard/planning");
      } else if (action === "view_hot_slots") {
        handleNavigate(summary?.consistency?.hotSlotsUrl ?? "/dashboard/planning?view=heatmap");
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
          handleNavigate("/dashboard/media-kit?refresh=1");
          break;
        case "open_brand_view":
          handleNavigate(summary?.mediaKit?.shareUrl);
          break;
        case "create_media_kit":
          handleNavigate("/dashboard/media-kit");
          break;
        default:
          break;
      }
    },
    [trackCardAction, summary?.mediaKit?.shareUrl, handleNavigate]
  );

  const handleViewCommunityInsights = React.useCallback(() => {
    trackCardAction("community_metrics", "view_insights");
    handleNavigate("/dashboard/discover");
  }, [trackCardAction, handleNavigate]);

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

  const quickStats = React.useMemo<HeroStat[]>(() => {
    if (!summary) return [];
    const stats: HeroStat[] = [];

    if (typeof summary.consistency?.streakDays === "number") {
      stats.push({
        id: "streak",
        label: "Streak ativa",
        value: `${summary.consistency.streakDays} dias`,
        hint: summary.consistency.streakDays >= 3 ? "Excelente! Mantenha acima de 3 dias." : "Mire em 3 dias seguidos.",
        accent: summary.consistency.streakDays >= 3 ? "up" : undefined,
      });
    }

    if (weeklyGoal > 0) {
      const clampedPercent = Math.max(0, Math.min(weeklyProgressPercent, 999));
      stats.push({
        id: "weekly_goal",
        label: "Progresso semanal",
        value: `${postsSoFar}/${weeklyGoal} posts`,
        hint: `${clampedPercent}% da meta`,
        accent: clampedPercent >= 75 ? "up" : clampedPercent <= 30 ? "down" : undefined,
      });
    }

    const highlightMetric = summary.communityMetrics?.metrics?.[0];
    if (highlightMetric) {
      const delta =
        typeof highlightMetric.deltaPercent === "number" ? Math.round(highlightMetric.deltaPercent) : null;
      stats.push({
        id: highlightMetric.id,
        label: highlightMetric.label,
        value: highlightMetric.value,
        hint: highlightMetric.periodLabel,
        accent: delta == null ? undefined : delta >= 0 ? "up" : "down",
      });
    } else if (summary.mediaKit?.hasMediaKit) {
      stats.push({
        id: "media-kit",
        label: "Media kit",
        value: summary.mediaKit.lastUpdatedLabel
          ? `Atualizado ${summary.mediaKit.lastUpdatedLabel}`
          : "Pronto para compartilhar",
        hint: "Envie para marcas estratégicas.",
        accent: "up",
      });
    } else if (summary.mentorship?.nextSessionLabel) {
      stats.push({
        id: "mentorship",
        label: "Próxima mentoria",
        value: summary.mentorship.nextSessionLabel,
        hint: summary.mentorship.topic ?? "Traga suas dúvidas ao vivo.",
      });
    } else if (typeof summary.nextPost?.expectedLiftPercent === "number") {
      const lift = Math.round(summary.nextPost.expectedLiftPercent);
      stats.push({
        id: "next-post",
        label: "Próximo post",
        value: `${lift >= 0 ? "+" : ""}${lift}% vs mediana`,
        hint: summary.nextPost.slotLabel ?? "Escolha o melhor horário.",
        accent: lift >= 0 ? "up" : "down",
      });
    }

    return stats;
  }, [summary, weeklyGoal, postsSoFar, weeklyProgressPercent]);

  const displayedHeroStats = React.useMemo<HeroStat[]>(() => {
    if (quickStats.length >= 3) return quickStats.slice(0, 3);
    return [...quickStats, ...HERO_STATS_FALLBACK].slice(0, 3);
  }, [quickStats]);

  const isInstagramConnected = summary?.nextPost?.isInstagramConnected ?? false;
  const hasMediaKit = summary?.mediaKit?.hasMediaKit ?? false;
  const communityFreeMember = summary?.community?.free?.isMember ?? false;
  const communityFreeInviteUrl = summary?.community?.free?.inviteUrl ?? "/dashboard/discover";
  const communityVipHasAccess = summary?.community?.vip?.hasAccess ?? false;
  const communityVipMember = summary?.community?.vip?.isMember ?? false;
  const communityVipInviteUrl = summary?.community?.vip?.inviteUrl ?? "/dashboard/whatsapp";
  const whatsappLinked = summary?.whatsapp?.linked ?? false;
  const whatsappTrialActive = summary?.whatsapp?.trial?.active ?? false;
  const whatsappTrialEligible = summary?.whatsapp?.trial?.eligible ?? false;
  const whatsappTrialStarted = summary?.whatsapp?.trial?.started ?? false;
  const whatsappTrialExpiresAtIso = summary?.whatsapp?.trial?.expiresAt ?? null;
  const whatsappStartUrl = summary?.whatsapp?.startUrl ?? "/dashboard/whatsapp";
  const planIsPro = summary?.plan?.isPro ?? false;
  const trialExpired =
    !whatsappTrialActive && whatsappTrialStarted && !whatsappTrialEligible && !planIsPro;

  type HeroStage = "join_free" | "start_trial" | "use_trial" | "upgrade" | "join_vip" | "pro_engaged";

  React.useEffect(() => {
    if (!whatsappTrialActive || !whatsappTrialExpiresAtIso) {
      setTrialCountdown("");
      return;
    }
    const expiresAt = new Date(whatsappTrialExpiresAtIso).getTime();
    if (!Number.isFinite(expiresAt)) {
      setTrialCountdown("");
      return;
    }
    const updateCountdown = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) {
        setTrialCountdown("encerrado");
        return;
      }
      const hours = Math.floor(diff / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1000);
      const segments = [];
      if (hours > 0) segments.push(`${hours}h`);
      segments.push(`${minutes.toString().padStart(2, "0")}m`);
      segments.push(`${seconds.toString().padStart(2, "0")}s`);
      setTrialCountdown(segments.join(" "));
    };
    updateCountdown();
    const id = window.setInterval(updateCountdown, 1_000);
    return () => window.clearInterval(id);
  }, [whatsappTrialActive, whatsappTrialExpiresAtIso]);

  const plannerActionKey = isInstagramConnected ? "generate_script" : "connect_instagram";
  const plannerButtonLabel = isInstagramConnected ? "Abrir planner da semana" : "Conectar Instagram";

  const heroStage = React.useMemo<HeroStage>(() => {
    if (!communityFreeMember) return "join_free";
    if (!whatsappTrialStarted && whatsappTrialEligible) return "start_trial";
    if (whatsappTrialActive && !planIsPro) return "use_trial";
    if (!planIsPro) return "upgrade";
    if (planIsPro && !communityVipMember) return "join_vip";
    return "pro_engaged";
  }, [communityFreeMember, communityVipMember, planIsPro, whatsappTrialActive, whatsappTrialEligible, whatsappTrialStarted]);

  const heroMessage = React.useMemo(() => {
    switch (heroStage) {
      case "join_free":
        return "Entre no grupo gratuito da comunidade e acione seu estrategista personalizado.";
      case "start_trial":
        return "Conecte seu WhatsApp e teste a IA por 48h.";
      case "use_trial":
        return whatsappLinked
          ? "Aproveite o teste de 48h: peça roteiros, alertas e horários ideais direto no WhatsApp."
          : "Finalize a conexão com o WhatsApp para começar a falar com a estrategista.";
      case "upgrade":
        return "Seu teste acabou — Assine PRO e ganhe +7 dias grátis.";
      case "join_vip":
        return "Você já é PRO: entre no VIP e participe das mentorias semanais.";
      case "pro_engaged":
      default:
        return "Use o planner e os alertas para manter o ritmo da sua estratégia PRO.";
    }
  }, [heroStage, whatsappLinked]);

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

  const openSubscribeModal = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("open-subscribe-modal"));
    }
  }, []);

  const handleJoinFreeCommunity = React.useCallback(() => {
    handleNavigate(communityFreeInviteUrl);
  }, [communityFreeInviteUrl, handleNavigate]);

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

  const handleViewWhatsAppResources = React.useCallback(() => {
    handleNavigate(whatsappStartUrl);
  }, [handleNavigate, whatsappStartUrl]);

  const handleJoinVip = React.useCallback(() => {
    handleNavigate(communityVipInviteUrl);
  }, [communityVipInviteUrl, handleNavigate]);

  const handleOpenPlanner = React.useCallback(() => {
    handleNextPostAction(plannerActionKey);
  }, [handleNextPostAction, plannerActionKey]);

  const handleConfigureReminder = React.useCallback(() => {
    handleMentorshipAction("whatsapp_reminder");
  }, [handleMentorshipAction]);

  const handleJoinCommunityCta = React.useCallback(() => {
    if (communityVipHasAccess) {
      handleMentorshipAction("join_community");
    } else {
      handleJoinFreeCommunity();
    }
  }, [communityVipHasAccess, handleJoinFreeCommunity, handleMentorshipAction]);

  const baseHeroActions = React.useMemo(
    () => ({
      joinFree: {
        key: "join-free-community",
        label: "Entrar na comunidade gratuita",
        icon: <FaUsers />,
        onClick: handleJoinFreeCommunity,
      },
      startTrial: {
        key: "start-whatsapp-trial",
        label: "Ativar 48h grátis",
        icon: <FaBolt />,
        onClick: handleOpenWhatsApp,
      },
      openWhatsapp: {
        key: "open-whatsapp",
        label: whatsappLinked ? "Abrir WhatsApp IA" : "Conectar WhatsApp IA",
        icon: <FaWhatsapp />,
        onClick: handleOpenWhatsApp,
      },
      upgradePro: {
        key: "upgrade-pro",
        label: "Ativar PRO (+7 dias grátis)",
        icon: <FaGem />,
        onClick: openSubscribeModal,
      },
      joinVip: {
        key: "join-vip",
        label: "Entrar no Grupo VIP",
        icon: <FaChalkboardTeacher />,
        onClick: handleJoinVip,
      },
      openPlanner: {
        key: "open-planner",
        label: plannerButtonLabel,
        icon: <FaRocket />,
        onClick: handleOpenPlanner,
      },
      reminder: {
        key: "reminder",
        label: "Configurar lembrete",
        icon: <FaChalkboardTeacher />,
        onClick: handleConfigureReminder,
      },
    }),
    [
      handleConfigureReminder,
      handleJoinFreeCommunity,
      handleJoinVip,
      handleOpenPlanner,
      handleOpenWhatsApp,
      openSubscribeModal,
      plannerButtonLabel,
      whatsappLinked,
    ]
  );

  const heroCtas = React.useMemo(() => {
    const resolveVariant = (
      actionKey: keyof typeof baseHeroActions,
      fallback: HeroAction["variant"]
    ): HeroAction["variant"] => {
      switch (actionKey) {
        case "startTrial":
        case "openWhatsapp":
          return "whatsapp";
        case "upgradePro":
          return "pro";
        case "joinVip":
          return "vip";
        default:
          return fallback;
      }
    };

    const build = (
      actionKey: keyof typeof baseHeroActions,
      fallback: HeroAction["variant"],
      overrides?: Partial<Omit<HeroAction, "variant">>
    ): HeroAction => ({
      ...baseHeroActions[actionKey],
      ...overrides,
      variant: resolveVariant(actionKey, fallback),
    });

    let primary: HeroAction = build("openPlanner", "primary");
    let secondary: HeroAction | null = null;

    switch (heroStage) {
      case "join_free": {
        primary = build("joinFree", "primary");
        secondary = build("startTrial", "whatsapp");
        break;
      }
      case "start_trial": {
        primary = build("joinFree", "primary");
        secondary = build("startTrial", "whatsapp");
        break;
      }
      case "use_trial": {
        primary = build("joinFree", "primary");
        secondary = build("openWhatsapp", "whatsapp");
        break;
      }
      case "upgrade": {
        primary = build("upgradePro", "pro");
        secondary = build("openPlanner", "secondary");
        break;
      }
      case "join_vip": {
        primary = build("joinVip", "vip");
        secondary = build("openPlanner", "secondary");
        break;
      }
      case "pro_engaged":
      default: {
        primary = build("openPlanner", "primary");
        secondary = build("openWhatsapp", "whatsapp");
        break;
      }
    }

    const resolvedSecondary = secondary && secondary.key !== primary.key ? secondary : null;
    return { primary, secondary: resolvedSecondary };
  }, [baseHeroActions, heroStage]);

  const heroButtons = heroCtas.secondary ? [heroCtas.primary, heroCtas.secondary] : [heroCtas.primary];

  React.useEffect(() => {
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
    hasHydratedSummary,
    heroStage,
    planIsPro,
    trackSurfaceView,
    whatsappLinked,
  ]);

  const previousWhatsappLinked = React.useRef(whatsappLinked);

  React.useEffect(() => {
    if (whatsappLinked && !previousWhatsappLinked.current) {
      trackWhatsappEvent("success", { origin: "home" });
      setShowWhatsAppConnect(false);
    }
    previousWhatsappLinked.current = whatsappLinked;
  }, [trackWhatsappEvent, whatsappLinked]);

  const isCommunityMember = communityVipHasAccess ? communityVipMember : communityFreeMember;

  const steps = React.useMemo<JourneyStep[]>(() => {
    const plannerStatus: StepStatus = isInitialLoading
      ? "loading"
      : isInstagramConnected
      ? "done"
      : "todo";

    const consistencyStatus: StepStatus = isInitialLoading
      ? "loading"
      : summary?.consistency
      ? weeklyProgressPercent >= 100
        ? "done"
        : weeklyProgressPercent > 0
        ? "in-progress"
        : "todo"
      : "todo";

    const mediaKitStatus: StepStatus = isInitialLoading ? "loading" : hasMediaKit ? "done" : "todo";
    const mentorshipStatus: StepStatus = isInitialLoading
      ? "loading"
      : communityVipHasAccess
      ? communityVipMember
        ? "done"
        : "todo"
      : communityFreeMember
      ? "in-progress"
      : "todo";

    return [
      {
        id: "planner",
        title: "Destrave ideias com o Planner",
        description: "Conecte o Instagram e deixe a IA sugerir seu roteiro do dia.",
        icon: <FaRocket />,
        status: plannerStatus,
        actionLabel: isInstagramConnected ? "Abrir planner" : "Conectar Instagram",
        action: () => handleNextPostAction(isInstagramConnected ? "generate_script" : "connect_instagram"),
        variant: isInstagramConnected ? "ghost" : "secondary",
        disabled: isInitialLoading,
        metric: isInstagramConnected && summary?.nextPost?.slotLabel ? `Próximo slot: ${summary.nextPost.slotLabel}` : undefined,
        helper: "Use ganchos curtos e convites claros.",
      },
      {
        id: "consistency",
        title: "Planeje sua semana",
        description: "Escolha slots quentes e distribua o volume com estratégia.",
        icon: <FaCalendarAlt />,
        status: consistencyStatus,
        actionLabel: "Planejar semana",
        action: () => handleConsistencyAction("plan_week"),
        variant: consistencyStatus === "done" ? "ghost" : "secondary",
        disabled: isInitialLoading,
        metric:
          hasHydratedSummary && summary?.consistency
            ? `${postsSoFar}/${weeklyGoal} posts (${Math.max(0, Math.min(weeklyProgressPercent, 999))}%)`
            : undefined,
        helper: "Meta saudável: 3 a 5 posts distribuídos.",
      },
      {
        id: "media-kit",
        title: "Atualize o media kit vivo",
        description: "Garanta provas atualizadas para negociar com marcas.",
        icon: <FaBullhorn />,
        status: mediaKitStatus,
        actionLabel: hasMediaKit ? "Abrir media kit" : "Criar media kit",
        action: () => handleMediaKitAction(hasMediaKit ? "open_brand_view" : "create_media_kit"),
        variant: hasMediaKit ? "ghost" : "secondary",
        disabled: isInitialLoading,
        metric: hasMediaKit
          ? summary?.mediaKit?.lastUpdatedLabel
            ? `Atualizado ${summary.mediaKit.lastUpdatedLabel}`
            : "Pronto para compartilhar"
          : undefined,
        helper: "Inclua resultados recentes e depoimentos.",
      },
      {
        id: "mentorship",
        title: "Participe da mentoria ao vivo",
        description: "Troque com a comunidade e leve dúvidas para especialistas.",
        icon: <FaChalkboardTeacher />,
        status: mentorshipStatus,
        actionLabel: communityVipHasAccess
          ? communityVipMember
            ? "Agendar lembrete"
            : "Entrar no Grupo VIP"
          : communityFreeMember
          ? "Abrir comunidade gratuita"
          : "Entrar na comunidade gratuita",
        action: () => {
          if (communityVipHasAccess) {
            if (communityVipMember) {
              handleMentorshipAction("whatsapp_reminder");
            } else {
              handleJoinVip();
            }
          } else {
            handleJoinFreeCommunity();
          }
        },
        variant: communityVipHasAccess ? (communityVipMember ? "ghost" : "vip") : communityFreeMember ? "ghost" : "secondary",
        disabled: isInitialLoading,
        metric: summary?.mentorship?.nextSessionLabel,
        helper: summary?.mentorship?.topic ?? undefined,
      },
    ];
  }, [
    hasMediaKit,
    hasHydratedSummary,
    handleConsistencyAction,
    handleJoinFreeCommunity,
    handleJoinVip,
    handleMediaKitAction,
    handleMentorshipAction,
    handleNextPostAction,
    isInstagramConnected,
    communityFreeMember,
    communityVipHasAccess,
    communityVipMember,
    isInitialLoading,
    postsSoFar,
    summary,
    weeklyGoal,
    weeklyProgressPercent,
  ]);

  const shouldShowActiveTrialBanner = !planIsPro && whatsappTrialActive;
  const shouldShowEligibleTrialBanner = !whatsappLinked && whatsappTrialEligible;
  const shouldShowExpiredTrialBanner = trialExpired;

  const trialBanner = React.useMemo(() => {
    if (shouldShowActiveTrialBanner) {
      return (
        <div className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-4 shadow-sm sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 text-sm text-emerald-800">
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                Teste ativo – 48h
              </p>
              <p>Aproveite os roteiros prontos, alertas e horários ideais direto no WhatsApp.</p>
              {trialCountdown ? (
                <p className="text-xs font-semibold text-emerald-700">
                  Tempo restante: <span className="font-bold">{trialCountdown}</span>
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                Abrir WhatsApp
              </button>
              <button
                type="button"
                onClick={handleViewWhatsAppResources}
                className="rounded-full border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-600/10"
              >
                Ver recursos PRO
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (shouldShowEligibleTrialBanner) {
      return (
        <div className="mb-6 rounded-3xl border border-blue-200 bg-blue-50 px-4 py-4 shadow-sm sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 text-sm text-blue-900">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                Teste gratuito de 48h
              </p>
              <p>Conecte seu WhatsApp e fale com a estrategista IA em tempo real.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowWhatsAppConnect(true);
                  trackWhatsappEvent("start", { origin: "home_banner" });
                }}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Ativar 48h grátis
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (shouldShowExpiredTrialBanner) {
      return (
        <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 text-sm text-amber-900">
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
                Seu teste acabou
              </p>
              <p>Ative PRO e ganhe +7 dias grátis para seguir com a estrategista no WhatsApp.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openSubscribeModal}
                className="rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
              >
                Ativar PRO (+7 dias)
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  }, [
    handleOpenWhatsApp,
    handleViewWhatsAppResources,
    openSubscribeModal,
    setShowWhatsAppConnect,
    shouldShowActiveTrialBanner,
    shouldShowEligibleTrialBanner,
    shouldShowExpiredTrialBanner,
    trackWhatsappEvent,
    trialCountdown,
  ]);

  const shouldDisplayConnectBanner = showWhatsAppConnect && !whatsappLinked;
  const connectBanner = shouldDisplayConnectBanner ? (
    <div className="mb-6 rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Conecte seu WhatsApp</p>
          <p className="text-sm text-slate-600">
            Copie o código, abra o WhatsApp e confirme para liberar o teste de 48h.
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

  React.useEffect(() => {
    if (shouldDisplayConnectBanner) {
      trackSurfaceView("home_whatsapp_connect", { origin: "home" });
    }
  }, [shouldDisplayConnectBanner, trackSurfaceView]);
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      {trialBanner}
      {connectBanner}
      <section className="rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-4">
            <span className="inline-flex w-max items-center gap-2 rounded-full border border-brand-purple/20 bg-brand-purple/5 px-3 py-1 text-xs font-medium uppercase tracking-wide text-brand-purple">
              Dashboard
            </span>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">Oi, {firstName}!</h1>
              <p className="text-sm text-slate-600 sm:text-base">{heroMessage}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {heroButtons.map((action) => (
                <ActionButton
                  key={action.key}
                  label={action.label}
                  onClick={() => {
                    trackHeroAction(action.key, {
                      stage: heroStage,
                      whatsapp_linked: whatsappLinked,
                      plan_is_pro: planIsPro,
                      community_free_member: communityFreeMember,
                      community_vip_member: communityVipMember,
                    });
                    action.onClick();
                  }}
                  icon={action.icon}
                  variant={action.variant}
                  disabled={isInitialLoading}
                />
              ))}
            </div>
          </div>

          <div className="w-full md:max-w-xs">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:grid-cols-1">
              {displayedHeroStats.map((stat) => (
                <div key={stat.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
                  <p
                    className={`mt-1 text-lg font-semibold ${
                      stat.accent === "up"
                        ? "text-emerald-600"
                        : stat.accent === "down"
                        ? "text-rose-600"
                        : "text-slate-900"
                    }`}
                  >
                    {stat.value}
                  </p>
                  {stat.hint ? <p className="text-xs text-slate-500">{stat.hint}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <header className="mb-5 space-y-1.5">
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Ações rápidas de hoje</h2>
          <p className="text-sm text-slate-600 sm:text-base">
            Priorize o próximo post, revise constância, aqueça a comunidade e monitore números coletivos.
          </p>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </header>

        <div className="relative">
          {trialExpired ? (
            <div className="pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-3xl border border-amber-200 bg-white/85 px-6 py-6 text-center shadow-sm backdrop-blur-sm">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                PRO
              </span>
              <p className="max-w-md text-sm text-amber-900">
                Recursos exclusivos PRO. Ative a assinatura e ganhe +7 dias grátis para continuar usando a IA.
              </p>
              <button
                type="button"
                onClick={openSubscribeModal}
                className="rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
              >
                Ativar PRO (+7 dias)
              </button>
            </div>
          ) : null}

          <HomeGrid className={`gap-y-5 ${trialExpired ? "pointer-events-none opacity-30" : ""}`}>
            <NextPostCard
              data={summary?.nextPost}
              loading={loading}
              onGenerateScript={() => handleNextPostAction("generate_script")}
              onShowVariations={() => handleNextPostAction("show_variations")}
              onTestIdea={() => handleNextPostAction("test_idea")}
              onConnectInstagram={() => handleNextPostAction("connect_instagram")}
            />

            <ConsistencyCard
              data={summary?.consistency}
              loading={loading}
              onPlanWeek={() => handleConsistencyAction("plan_week")}
              onViewHotSlots={() => handleConsistencyAction("view_hot_slots")}
            />

            <MentorshipCard
              data={summary?.mentorship}
              loading={loading}
              onJoinCommunity={handleJoinCommunityCta}
              onAddToCalendar={() => handleMentorshipAction("add_to_calendar")}
              onAskReminder={() => handleMentorshipAction("whatsapp_reminder")}
            />

            <MediaKitCard
              data={summary?.mediaKit}
              loading={loading}
              onCopyLink={() => handleMediaKitAction("copy_link")}
              onRefreshHighlights={() => handleMediaKitAction("refresh_highlights")}
              onOpenForBrands={() => handleMediaKitAction("open_brand_view")}
              onCreateMediaKit={() => handleMediaKitAction("create_media_kit")}
            />

            <CommunityMetricsCard
              data={summary?.communityMetrics}
              loading={loading || metricsLoading}
              onChangePeriod={handleChangePeriod}
              onViewInsights={handleViewCommunityInsights}
            />
          </HomeGrid>
        </div>
      </section>

      <section className="mt-10 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <button
          type="button"
          onClick={() => setIsChecklistOpen((prev) => !prev)}
          className="flex w-full items-center justify-between gap-4 text-left"
          aria-expanded={isChecklistOpen}
          aria-controls={checklistId}
        >
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Checklist da semana</h2>
            <p className="text-sm text-slate-600 sm:text-base">
              Quatro pilares para manter ritmo, provas e comunidade alinhados.
            </p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500">
            <FaChevronDown
              className={`transition-transform duration-200 ${isChecklistOpen ? "rotate-180" : ""}`}
            />
          </span>
        </button>

        <ol
          id={checklistId}
          className={`mt-5 space-y-3 ${isChecklistOpen ? "" : "hidden"}`}
          aria-hidden={!isChecklistOpen}
        >
          {steps.map((step) => (
            <li key={step.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-brand-purple">
                    {step.icon}
                  </span>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STEP_STATUS_CLASSES[step.status]}`}
                      >
                        {STEP_STATUS_LABELS[step.status]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{step.description}</p>
                    {step.metric ? <p className="text-xs font-semibold text-slate-600">{step.metric}</p> : null}
                    {step.helper ? <p className="text-xs text-slate-500">{step.helper}</p> : null}
                  </div>
                </div>
                <ActionButton
                  label={step.actionLabel}
                  onClick={step.action}
                  variant={step.variant}
                  className="w-full justify-center md:w-auto"
                  disabled={step.disabled}
                />
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
