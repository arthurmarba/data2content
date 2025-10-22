// src/app/dashboard/home/HomeClientPage.tsx
// Container client-side da Home com dados placeholders (MVP scaffolding).

"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  FaBullhorn,
  FaCalendarAlt,
  FaChalkboardTeacher,
  FaChevronDown,
  FaGem,
  FaLink,
  FaMagic,
  FaPenFancy,
  FaRegCalendarCheck,
  FaRocket,
  FaRobot,
  FaUsers,
  FaWhatsapp,
  FaTimes,
} from "react-icons/fa";

import MediaKitCard from "./components/cards/MediaKitCard";
import CommunityMetricsCard from "./components/cards/CommunityMetricsCard";
import ActionButton from "./components/ActionButton";
import QuickActionCard from "./components/QuickActionCard";
import type { CommunityMetricsCardData, HomeSummaryResponse } from "./types";
import { useHomeTelemetry } from "./useHomeTelemetry";
import WhatsAppConnectInline from "../WhatsAppConnectInline";

type Period = CommunityMetricsCardData["period"];
const DEFAULT_PERIOD: Period = "30d";

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

const STEP_STATUS_ICONS: Record<StepStatus, string> = {
  done: "✅",
  "in-progress": "🟡",
  todo: "⚪",
  loading: "⏳",
};

const STEP_NUMBER_ICONS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"];

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
  const planIsPro = summary?.plan?.isPro ?? false;
  const trialExpired =
    !whatsappTrialActive && whatsappTrialStarted && !whatsappTrialEligible && !planIsPro;

  type HeroStage = "join_free" | "start_trial" | "use_trial" | "upgrade" | "join_vip" | "pro_engaged";


  const heroStage = React.useMemo<HeroStage>(() => {
    if (!communityFreeMember) return "join_free";
    if (!whatsappTrialStarted && whatsappTrialEligible) return "start_trial";
    if (whatsappTrialActive && !planIsPro) return "use_trial";
    if (!planIsPro) return "upgrade";
    if (planIsPro && !communityVipMember) return "join_vip";
    return "pro_engaged";
  }, [communityFreeMember, communityVipMember, planIsPro, whatsappTrialActive, whatsappTrialEligible, whatsappTrialStarted]);

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

  const handleJoinVip = React.useCallback(() => {
    handleNavigate(communityVipInviteUrl);
  }, [communityVipInviteUrl, handleNavigate]);

  const whatsappBanner = React.useMemo(() => {
    const previewMessages = [
      "IA: Seu melhor horário ainda é às 19h.",
      "IA: As categorias Lifestyle, Fitness e Maternidade continuam puxando engajamento.",
      "IA: Já são 4 dias sem publicar. Quer que eu monte 3 ideias e te lembre 30 min antes?",
    ];
    const base = {
      previewMessages,
      heading: "Mobi no WhatsApp",
      subheading: "Seu assistente de carreira com IA.",
      description:
        "Eu analiso seus posts, encontro oportunidades e envio alertas com os melhores horários.",
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
          "Assine PRO para seguir recebendo categorias vencedoras, horário ideal e lembretes direto no WhatsApp.",
        primary: {
          label: "Assinar PRO (+7 dias)",
          variant: "pro" as const,
          icon: <FaGem />,
          onClick: openSubscribeModal,
          trackingKey: "hero_trial_upgrade",
        },
        footnote: "🔒 Assine PRO e mantenha os alertas diários no WhatsApp.",
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
          label: "Ativar IA no WhatsApp",
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
        footnote: "🔒 Você já é PRO — conecte e receba os alertas no WhatsApp.",
      };
    }

      return {
        ...base,
        calloutTitle: "Ative a IA no WhatsApp.",
        calloutSubtitle:
          "Eu analiso seus posts, identifico oportunidades e te lembro dos horários certos.",
        primary: {
          label: "Ativar IA no WhatsApp",
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

  const communityMetricsItems = summary?.communityMetrics?.metrics ?? [];
  const communitySpotlightHighlights = communityMetricsItems.slice(0, 2);
  const nextSlotLabel = summary?.nextPost?.slotLabel?.trim() ?? null;
  const nextPostHooks = React.useMemo(() => {
    const data = summary?.nextPost;
    if (!data) return [] as string[];
    return [data.primaryHook, ...(data.secondaryHooks ?? [])].filter(Boolean) as string[];
  }, [summary?.nextPost]);

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
        title: "Conecte o Instagram com o Mobi",
        description: "Assim eu leio seus posts recentes e já libero horários quentes pra você.",
        icon: <FaRocket />,
        status: plannerStatus,
        actionLabel: isInstagramConnected ? "Abrir planner" : "Conectar agora",
        action: () => handleNextPostAction(isInstagramConnected ? "generate_script" : "connect_instagram"),
        variant: isInstagramConnected ? "ghost" : "secondary",
        disabled: isInitialLoading,
        metric: isInstagramConnected && summary?.nextPost?.slotLabel ? `Próximo horário: ${summary.nextPost.slotLabel}` : undefined,
        helper: isInstagramConnected ? "Horários e ganchos já estão alinhados com seus últimos posts." : "Conexão segura em segundos — eu te guio no passo a passo.",
      },
      {
        id: "consistency",
        title: "Planeje seus horários com a IA",
        description: "Eu seguro a constância pra você: bloqueio os slots quentes e aviso antes de publicar.",
        icon: <FaCalendarAlt />,
        status: consistencyStatus,
        actionLabel: "Planejar agora",
        action: () => handleConsistencyAction("plan_week"),
        variant: consistencyStatus === "done" ? "ghost" : "secondary",
        disabled: isInitialLoading,
        metric:
          hasHydratedSummary && summary?.consistency
            ? `${postsSoFar}/${weeklyGoal} posts (${Math.max(0, Math.min(weeklyProgressPercent, 999))}%)`
            : undefined,
        helper: "Meta ideal: 3 a 5 posts distribuídos ao longo da semana.",
      },
      {
        id: "media-kit",
        title: "Atualize o kit de mídia",
        description: "Deixe os números vivos — marcas confiam em dados frescos e consistentes.",
        icon: <FaBullhorn />,
        status: mediaKitStatus,
        actionLabel: hasMediaKit ? "Ver kit online" : "Criar kit",
        action: () => handleMediaKitAction(hasMediaKit ? "open_brand_view" : "create_media_kit"),
        variant: hasMediaKit ? "ghost" : "secondary",
        disabled: isInitialLoading,
        metric: hasMediaKit
          ? summary?.mediaKit?.lastUpdatedLabel
            ? `Atualizado ${summary.mediaKit.lastUpdatedLabel}`
            : "Pronto para compartilhar"
          : undefined,
        helper: hasMediaKit
          ? "Atualize se tiver mais de 30 dias. Eu aviso marcas com link novo."
          : "Eu preparo seus principais destaques automaticamente.",
      },
      {
        id: "mentorship",
        title: "Participe da mentoria comigo",
        description: "Levo suas dúvidas pra sala ao vivo e te lembro quando estamos começando.",
        icon: <FaChalkboardTeacher />,
        status: mentorshipStatus,
        actionLabel: communityVipHasAccess
          ? communityVipMember
            ? "Quero lembrete"
            : "Entrar no Grupo VIP"
          : communityFreeMember
          ? "Abrir comunidade"
          : "Entrar na comunidade",
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
        helper: summary?.mentorship?.topic ?? "Mentorias semanais com especialistas e criadores PRO.",
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

  const totalSteps = steps.length;
  const completedSteps = steps.filter((step) => step.status === "done").length;
  const checklistProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const quickActions = React.useMemo(() => {
    const bestSlot = isInstagramConnected ? nextSlotLabel || "Calculando..." : null;
    const primaryHook = nextPostHooks[0] ?? null;

    const hasGoal = weeklyGoal > 0;
    const remainingPosts = Math.max(0, weeklyGoal - postsSoFar);
    const shareUrl = summary?.mediaKit?.shareUrl ?? "";
    const lastUpdatedLabel = summary?.mediaKit?.lastUpdatedLabel ?? null;
    const shareUrlDisplay = shareUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

    const communityStatLabel = communitySpotlightHighlights.length
      ? communitySpotlightHighlights
          .map((item) => `${item.value} ${item.label.toLowerCase()}`)
          .join(" · ")
      : "Entre para acompanhar os desafios da semana.";

    return [
      {
        key: "next_post",
        icon: <FaPenFancy />,
        title: "Próximo Post",
        highlight: isInstagramConnected
          ? (
              <>
                Melhor horário: <span className="font-mono">{bestSlot}</span>
              </>
            )
          : "Conecte para destravar horários",
        description: isInstagramConnected
          ? primaryHook
            ? `Gatilho do dia: ${primaryHook}`
            : "Peça um roteiro e eu gero agora mesmo."
          : "Integre o Instagram e eu monitoro seus horários fortes.",
        footnote: isInstagramConnected
          ? "Posso gerar o roteiro agora mesmo."
          : "Conexão segura em 30 segundos.",
        primaryAction: {
          label: isInstagramConnected ? "Abrir planner" : "Conectar Instagram",
          onClick: () =>
            handleNextPostAction(isInstagramConnected ? "generate_script" : "connect_instagram"),
          icon: isInstagramConnected ? <FaMagic /> : <FaLink />,
        },
        tone: "default" as const,
      },
      {
        key: "consistency",
        icon: <FaRegCalendarCheck />,
        title: "Ritmo da Semana",
        highlight: hasGoal
          ? (
              <>
                Posts na semana:{" "}
                <span className="font-mono">{`${postsSoFar}/${weeklyGoal}`}</span>
              </>
            )
          : "Defina a meta semanal",
        description: hasGoal
          ? remainingPosts > 0
            ? `Faltam ${remainingPosts} ${remainingPosts === 1 ? "post" : "posts"} para bater a meta.`
            : "Meta da semana batida!"
          : "Escolha quantos posts quer fazer nesta semana.",
        footnote: "Ritmo ideal: 3 a 5 posts por semana.",
        primaryAction: {
          label: "Planejar horários",
          onClick: () => handleConsistencyAction("plan_week"),
          icon: <FaCalendarAlt />,
        },
        tone: "muted" as const,
      },
      {
        key: "media_kit",
        icon: <FaBullhorn />,
        title: "Kit de Mídia",
        highlight: shareUrl ? (
          <span className="font-mono text-sm">{shareUrlDisplay}</span>
        ) : (
          "Crie seu link em minutos"
        ),
        description: hasMediaKit
          ? `Última atualização: ${lastUpdatedLabel ?? "atualize agora"}`
          : "Transforme seus dados vivos em prova social.",
        footnote: hasMediaKit
          ? "Atualize com dados frescos antes de enviar para marcas."
          : "Eu preparo os destaques automaticamente pra você.",
        primaryAction: {
          label: hasMediaKit ? "Abrir kit" : "Criar kit",
          onClick: () =>
            handleMediaKitAction(hasMediaKit ? "open_brand_view" : "create_media_kit"),
          icon: <FaBullhorn />,
        },
        tone: "default" as const,
      },
      {
        key: "community",
        icon: <FaUsers />,
        title: "Comunidade D2C",
        highlight: communityStatLabel,
        description: communityFreeMember
          ? "Você já está dentro. Vamos aos desafios da semana?"
          : "Entre pra trocar bastidores, ideias e resultados com outros criadores.",
        footnote: communityVipHasAccess
          ? "Mentorias VIP com lembrete direto no WhatsApp."
          : "Acesso gratuito e leve, sem cartão.",
        primaryAction: {
          label: communityFreeMember ? "Abrir comunidade" : "Entrar na comunidade",
          onClick: handleJoinFreeCommunity,
          icon: <FaUsers />,
        },
        tone: "muted" as const,
      },
    ];
  }, [
    communityFreeMember,
    communitySpotlightHighlights,
    communityVipHasAccess,
    handleConsistencyAction,
    handleJoinFreeCommunity,
    handleMediaKitAction,
    handleNextPostAction,
    hasMediaKit,
    isInstagramConnected,
    nextPostHooks,
    nextSlotLabel,
    postsSoFar,
    summary?.mediaKit?.lastUpdatedLabel,
    summary?.mediaKit?.shareUrl,
    weeklyGoal,
  ]);

  const headerStats = React.useMemo(
    () => [
      {
        key: "posts",
        label: "Posts planejados",
        value: weeklyGoal > 0 ? `${postsSoFar}/${weeklyGoal}` : `${postsSoFar}`,
        helper: weeklyGoal > 0 ? "Meta da semana" : "Defina sua meta semanal",
      },
      {
        key: "best_slot",
        label: "Melhor horário hoje",
        value: isInstagramConnected
          ? nextSlotLabel || "Calculando..."
          : "Conecte o Instagram",
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
    ],
    [isInstagramConnected, nextSlotLabel, postsSoFar, weeklyGoal, whatsappLinked]
  );


  const shouldDisplayConnectBanner = showWhatsAppConnect && !whatsappLinked;
  const connectBanner = shouldDisplayConnectBanner ? (
    <div className="mb-6 rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
      {trialExpired ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-semibold">Seu teste de 48h chegou ao fim.</p>
              <p className="text-xs text-amber-700">
                Assine PRO, ganhe +7 dias grátis e continue recebendo roteiros e alertas no WhatsApp.
              </p>
            </div>
            <ActionButton
              label="Assinar PRO (+7 dias)"
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
      {connectBanner}
      <section className="rounded-3xl border border-[#E1DAFF] bg-[#F4F1FF] px-6 py-8 shadow-[0_24px_60px_rgba(92,61,196,0.18)]">
        <div className="flex flex-col gap-8">
          <div className="max-w-3xl">
            <div className="space-y-5 rounded-3xl bg-gradient-to-br from-[#F9F7FF] to-white px-6 py-6 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                  <span aria-hidden="true">👋</span> Oi,{" "}
                  <span className="text-[#F6007B]">{firstName}</span>!
                </h1>
                <p className="flex items-center gap-2 text-sm text-slate-600 sm:text-base">
                  <span>Mobi está acompanhando sua semana.</span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-purple/10 text-brand-purple">
                    <FaRobot className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {headerStats.map((stat) => (
                  <div
                    key={stat.key}
                    className="rounded-2xl border border-white/60 bg-white/90 px-4 py-3 shadow-sm"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {stat.label}
                    </p>
                    <p className="text-lg font-semibold text-slate-900">{stat.value}</p>
                    {stat.helper ? (
                      <p className="text-xs text-slate-500">{stat.helper}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,620px)_1fr] lg:items-start">
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/60 bg-gradient-to-br from-[#FFF7FB] to-[#F9F9FF] p-8 sm:p-10 shadow-[0_18px_50px_rgba(92,61,196,0.22)] backdrop-blur-sm">
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)] lg:gap-12">
                  <div className="mx-auto w-full space-y-6 text-left lg:mx-0 lg:max-w-none">
                    <div className="flex items-center gap-3 justify-center lg:justify-start">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-purple/10 text-brand-purple">
                        <FaRobot className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Mobi no WhatsApp
                        </p>
                        <p className="text-lg font-semibold text-slate-900">{whatsappBanner.subheading}</p>
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed text-slate-600">
                      {whatsappBanner.description}
                    </p>

                    <div className="flex flex-wrap justify-center gap-3 text-sm text-slate-700 lg:justify-start">
                      {whatsappBanner.bullets.map((item) => (
                        <span
                          key={item.text}
                          className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 shadow-sm shadow-slate-900/5"
                        >
                          <span>{item.icon}</span>
                          <span>{item.text}</span>
                        </span>
                      ))}
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-xl font-semibold text-slate-900">{whatsappBanner.calloutTitle}</h3>
                        <p className="text-sm text-slate-600 leading-relaxed">{whatsappBanner.calloutSubtitle}</p>
                      </div>
                      <div className="flex flex-col items-center gap-2 lg:items-start">
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
                            "w-full px-6 py-3 text-base sm:w-auto",
                            whatsappBanner.primary.className ?? null,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        />
                        {whatsappBanner.footnote ? (
                          <p className="text-xs font-medium text-slate-500">{whatsappBanner.footnote}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <div className="lg:mt-2">
              <div className="rounded-3xl border border-white/70 bg-white/95 p-5 shadow-[0_20px_55px_rgba(15,23,42,0.15)] backdrop-blur-sm">
                <div className="flex flex-col gap-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-purple/10 text-brand-purple">
                      <FaRobot className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Mobi · IA da D2C</p>
                      <p className="text-xs text-slate-500">Prévia do chat no WhatsApp</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {whatsappBanner.previewMessages.map((message, index) => (
                      <div key={message} className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-purple/10 text-brand-purple">
                          <FaRobot className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div
                          className={`max-w-[240px] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                            index % 2 === 0 ? "bg-white text-slate-700" : "bg-[#F7F7F7] text-slate-700"
                          }`}
                        >
                          {message}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-purple/10 text-brand-purple">
                        <FaRobot className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="flex items-center gap-1 rounded-2xl bg-[#F7F7F7] px-4 py-2 text-[13px] text-slate-500">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-brand-purple" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-brand-purple [animation-delay:150ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-brand-purple [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-brand-purple" />
                    <span>IA conectada aos seus posts recentes.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-12 space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 sm:text-xl">
              <span aria-hidden="true">⚡</span>
              Ações rápidas
            </h2>
            <p className="text-sm text-slate-500">
              Escolha o próximo passo pra manter seu plano com a IA no ritmo certo.
            </p>
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </header>

        <div className="relative">
          {trialExpired ? (
            <div className="pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-3xl border border-amber-200 bg-white/90 px-6 py-6 text-center shadow-sm backdrop-blur-sm">
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

          <div className={`grid gap-5 md:grid-cols-2 ${trialExpired ? "pointer-events-none opacity-30" : ""}`}>
            {quickActions.map((action) => (
              <QuickActionCard
                key={action.key}
                icon={action.icon}
                title={action.title}
                description={action.description}
                highlight={action.highlight}
                footnote={action.footnote}
                primaryAction={action.primaryAction}
                tone={action.tone}
                disabled={isInitialLoading}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <MediaKitCard
              className="h-full border-[rgba(246,0,123,0.15)] bg-white shadow-[0_18px_48px_rgba(246,0,123,0.18)]"
              data={summary?.mediaKit}
              loading={loading}
              onCopyLink={() => handleMediaKitAction("copy_link")}
              onRefreshHighlights={() => handleMediaKitAction("refresh_highlights")}
              onOpenForBrands={() => handleMediaKitAction("open_brand_view")}
              onCreateMediaKit={() => handleMediaKitAction("create_media_kit")}
            />
          </div>
          <div className="lg:col-span-4">
            <CommunityMetricsCard
              className="h-full border-transparent bg-[#FAFAFA] shadow-[0_18px_36px_rgba(15,23,42,0.1)]"
              data={summary?.communityMetrics}
              loading={loading || metricsLoading}
              onChangePeriod={handleChangePeriod}
              onViewInsights={handleViewCommunityInsights}
            />
          </div>
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

        {totalSteps ? (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>{completedSteps}/{totalSteps} concluídos</span>
              <span>{checklistProgress}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-brand-purple transition-[width]"
                style={{ width: `${checklistProgress}%` }}
              />
            </div>
          </div>
        ) : null}

        <ol
          id={checklistId}
          className={`mt-5 space-y-3 ${isChecklistOpen ? "" : "hidden"}`}
          aria-hidden={!isChecklistOpen}
        >
          {steps.map((step, index) => {
            const isDisabled = step.disabled || step.status === "loading";
            const numberIcon = STEP_NUMBER_ICONS[index] ?? `${index + 1}.`;
            const statusEmoji = STEP_STATUS_ICONS[step.status];
            return (
              <li
                key={step.id}
                role="button"
                tabIndex={isDisabled ? -1 : 0}
                aria-disabled={isDisabled}
                onClick={() => {
                  if (isDisabled) return;
                  step.action();
                }}
                onKeyDown={(event) => {
                  if (isDisabled) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    step.action();
                  }
                }}
                className={`group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30 focus-visible:ring-offset-2 md:flex-row md:items-center md:justify-between ${
                  isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{numberIcon}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-purple/10 text-brand-purple">
                    {step.icon}
                  </span>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs font-semibold ${STEP_STATUS_CLASSES[step.status]}`}
                      >
                        <span aria-hidden="true">{statusEmoji}</span>
                        {STEP_STATUS_LABELS[step.status]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{step.description}</p>
                    {step.metric ? <p className="text-xs font-semibold text-slate-600">{step.metric}</p> : null}
                    {step.helper ? <p className="text-xs text-slate-500">{step.helper}</p> : null}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm font-semibold text-brand-purple">
                  <span>{step.actionLabel}</span>
                  <FaChevronDown
                    className="rotate-[-90deg] text-brand-purple transition group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
