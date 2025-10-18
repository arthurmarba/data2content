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
  FaRocket,
  FaWhatsapp,
  FaUsers,
  FaTimes,
  FaCheckCircle,
  FaInfoCircle,
} from "react-icons/fa";

import NextPostCard from "./components/cards/NextPostCard";
import ConsistencyCard from "./components/cards/ConsistencyCard";
import MediaKitCard from "./components/cards/MediaKitCard";
import CommunityMetricsCard from "./components/cards/CommunityMetricsCard";
import ActionButton from "./components/ActionButton";
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
  const [showHowItWorks, setShowHowItWorks] = React.useState(false);
  const [showTrialDetails, setShowTrialDetails] = React.useState(false);
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
      "IA: Hoje, 19h segue sendo o horário com maior alcance pelos seus últimos Reels.",
      "IA: LifeStyle, fitness e maternidade tem engajado mais. Vamos repetir esse mix?",
      "IA: Já são 4 dias sem publicar. Preparo um roteiro dessas categorias e te lembro 30 min antes?",
    ];
    const base = {
      previewMessages,
      secondaryLabel: "Como funciona?",
      secondaryTrackingKey: "hero_trial_moreinfo" as const,
      bullets: [
        "Conteúdos diários das categorias campeãs",
        "Melhor dia e horário pelos seus posts",
        "Lembrete + roteiro pronto pra constância",
      ],
      detailText:
        "A estrategista analisa seus posts recentes, entende quais categorias (ex.: bastidores, prova social, tutorial curto) puxaram alcance e, quando percebe queda ou risco de constância, entrega conteúdo, horário e roteiro direto no WhatsApp.",
    };

    if (trialExpired) {
      return {
        ...base,
        title: "Continue com a estrategista no WhatsApp.",
        subtitle: "Continue recebendo conteúdos nas categorias que mais engajam, com horário ideal e lembrete no WhatsApp.",
        primary: {
          label: "Assinar PRO (+7 dias)",
          variant: "pro" as const,
          icon: <FaGem />,
          onClick: openSubscribeModal,
          trackingKey: "hero_trial_upgrade",
        },
      };
    }

    if (whatsappTrialActive || whatsappLinked) {
      return {
        ...base,
        title: "Sua estrategista está ativa no WhatsApp.",
        subtitle: "Peça conteúdos por categoria e horários certeiros sempre que precisar pelo WhatsApp.",
        primary: {
          label: "Abrir WhatsApp IA",
          variant: "whatsapp" as const,
          icon: <FaWhatsapp />,
          onClick: handleOpenWhatsApp,
          trackingKey: "hero_trial_open",
        },
      };
    }

    if (!whatsappTrialStarted && whatsappTrialEligible) {
      return {
        ...base,
        title: "Ideias e horários no seu WhatsApp (48h grátis).",
        subtitle: "A IA interpreta seus posts, identifica a próxima categoria vencedora e agenda o horário ideal.",
        primary: {
          label: "Ativar WhatsApp IA – 48h grátis",
          variant: "whatsapp" as const,
          icon: <FaWhatsapp />,
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
        title: "Conecte seu WhatsApp e mantenha a estratégia no ritmo.",
        subtitle: "Ative alertas personalizados por categoria, com horário ideal e roteiro pronto.",
        primary: {
          label: "Conectar WhatsApp IA",
          variant: "whatsapp" as const,
          icon: <FaWhatsapp />,
          onClick: handleOpenWhatsApp,
          trackingKey: "hero_trial_connect",
        },
      };
    }

    return {
      ...base,
      title: "Ideias e horários no seu WhatsApp (48h grátis).",
      subtitle: "A IA interpreta seus posts, identifica a próxima categoria vencedora e agenda o horário ideal.",
      primary: {
        label: "Ativar WhatsApp IA – 48h grátis",
        variant: "whatsapp" as const,
        icon: <FaWhatsapp />,
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

  const communityFreeAction = React.useMemo(
    () => ({
      key: communityFreeMember ? "community_free_open" : "community_free_join",
      label: communityFreeMember ? "Abrir comunidade gratuita" : "Entrar na comunidade gratuita",
      description: communityVipHasAccess
        ? "Avisos, desafios e materiais liberados para todos."
        : "Grupo gratuito com avisos e temas da semana.",
      icon: <FaUsers />,
      variant: "secondary" as const,
      onClick: handleJoinFreeCommunity,
    }),
    [communityFreeMember, communityVipHasAccess, handleJoinFreeCommunity]
  );

  const communityVipAction = React.useMemo(() => {
    if (!communityVipHasAccess) return null;
    return {
      key: communityVipMember ? "community_vip_open" : "community_vip_join",
      label: communityVipMember ? "Abrir comunidade VIP" : "Entrar na comunidade VIP",
      description: "Mentorias exclusivas e bastidores PRO.",
      icon: <FaGem />,
      variant: "vip" as const,
      onClick: handleJoinVip,
    };
  }, [communityVipHasAccess, communityVipMember, handleJoinVip]);

  const communityMetricsItems = summary?.communityMetrics?.metrics ?? [];
  const communitySpotlightHighlights = communityMetricsItems.slice(0, 2);

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

  React.useEffect(() => {
    setShowHowItWorks(false);
  }, [heroStage]);

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
        title: "Use o planner de posts",
        description: "Conecte o Instagram para receber sugestões automáticas.",
        icon: <FaRocket />,
        status: plannerStatus,
        actionLabel: isInstagramConnected ? "Abrir planner" : "Conectar Instagram",
        action: () => handleNextPostAction(isInstagramConnected ? "generate_script" : "connect_instagram"),
        variant: isInstagramConnected ? "ghost" : "secondary",
        disabled: isInitialLoading,
        metric: isInstagramConnected && summary?.nextPost?.slotLabel ? `Próximo horário: ${summary.nextPost.slotLabel}` : undefined,
        helper: "Frases de abertura aparecem após conectar sua conta.",
      },
      {
        id: "consistency",
        title: "Escolha horários de maior engajamento",
        description: "Distribua os posts ao longo da semana.",
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
        helper: "Meta saudável: 3 a 5 posts distribuídos.",
      },
      {
        id: "media-kit",
        title: "Atualize seu kit de mídia",
        description: "Garanta estatísticas recentes para negociar.",
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
        helper: "Inclua resultados recentes e depoimentos.",
      },
      {
        id: "mentorship",
        title: "Participe da sessão ao vivo",
        description: "Troque com especialistas e com a comunidade.",
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
      <section className="rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm">
        <div className="flex flex-col gap-8">
          <div className="space-y-2 max-w-3xl">
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">Oi, {firstName}!</h1>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,620px)_1fr] lg:items-start">
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="space-y-5">
                  <div className="space-y-3">
                    <div className="space-y-2 max-w-[38rem]">
                      <h2 className="text-2xl font-semibold text-slate-900">{whatsappBanner.title}</h2>
                      <p className="text-sm text-slate-600">{whatsappBanner.subtitle}</p>
                    </div>
                    <ul className="space-y-2 text-sm text-slate-600 max-w-[38rem]">
                      {whatsappBanner.bullets.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <FaCheckCircle className="mt-0.5 h-4 w-4 text-emerald-500" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
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
                      className="w-full px-6 py-3 text-base sm:w-auto"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nextState = !showHowItWorks;
                        setShowHowItWorks(nextState);
                        trackHeroAction(whatsappBanner.secondaryTrackingKey, {
                          stage: heroStage,
                          whatsapp_linked: whatsappLinked,
                          plan_is_pro: planIsPro,
                          community_free_member: communityFreeMember,
                          community_vip_member: communityVipMember,
                          show_details: nextState,
                        });
                      }}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-brand-purple hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30 focus-visible:ring-offset-1"
                    >
                      <FaInfoCircle aria-hidden="true" />
                      {whatsappBanner.secondaryLabel}
                    </button>
                  </div>
                  {showHowItWorks ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      {whatsappBanner.detailText}
                    </div>
                  ) : null}
                  <p className="text-xs font-medium text-slate-500">
                    Conexão em 30 s · sem cartão · 51 criadores usando agora
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-brand-purple">
                      <FaUsers className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="space-y-1">
                      <h2 className="text-2xl font-semibold text-slate-900">Comunidade D2C</h2>
                      {communityFreeAction.description ? (
                        <p className="text-sm text-slate-600">{communityFreeAction.description}</p>
                      ) : null}
                    </div>
                  </div>
                  {communitySpotlightHighlights.length ? (
                    <div className="flex flex-wrap gap-2">
                      {communitySpotlightHighlights.map((item) => (
                        <span
                          key={item.id}
                          className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                        >
                          <span className="text-base font-semibold text-slate-900">{item.value}</span>
                          <span className="text-slate-400">•</span>
                          <span>{item.label}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Agenda da semana liberada para membros.
                    </p>
                  )}
                  <div className="space-y-3">
                    <ActionButton
                      label={communityFreeAction.label}
                      icon={communityFreeAction.icon}
                      variant={communityFreeAction.variant}
                      onClick={() => {
                        trackHeroAction(communityFreeAction.key, {
                          stage: heroStage,
                          whatsapp_linked: whatsappLinked,
                          plan_is_pro: planIsPro,
                          community_free_member: communityFreeMember,
                          community_vip_member: communityVipMember,
                        });
                        communityFreeAction.onClick();
                      }}
                      disabled={isInitialLoading}
                      className="w-full justify-center px-5 py-3 text-base sm:w-auto"
                    />
                    {communityVipAction ? (
                      <div className="space-y-2">
                        <ActionButton
                          label={communityVipAction.label}
                          icon={communityVipAction.icon}
                          variant={communityVipAction.variant}
                          onClick={() => {
                            trackHeroAction(communityVipAction.key, {
                              stage: heroStage,
                              whatsapp_linked: whatsappLinked,
                              plan_is_pro: planIsPro,
                              community_free_member: communityFreeMember,
                              community_vip_member: communityVipMember,
                            });
                            communityVipAction.onClick();
                          }}
                          disabled={isInitialLoading}
                          className="w-full justify-center px-5 py-3 text-base sm:w-auto"
                        />
                        {communityVipAction.description ? (
                          <p className="text-sm text-amber-700">{communityVipAction.description}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:mt-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="space-y-3">
                  {whatsappBanner.previewMessages.map((message, index) => (
                    <div
                      key={message}
                      className={`max-w-xs rounded-2xl border px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                        index % 2 === 0
                          ? "bg-white text-slate-700 border-slate-100"
                          : "bg-emerald-50 text-emerald-900 border-emerald-100"
                      }`}
                    >
                      {message}
                    </div>
                  ))}
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
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Ações rápidas</h2>
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

          <div className={`grid gap-6 md:grid-cols-2 ${trialExpired ? "pointer-events-none opacity-30" : ""}`}>
            <NextPostCard
              className="h-full"
              data={summary?.nextPost}
              loading={loading}
              onGenerateScript={() => handleNextPostAction("generate_script")}
              onShowVariations={() => handleNextPostAction("show_variations")}
              onConnectInstagram={() => handleNextPostAction("connect_instagram")}
            />

            <ConsistencyCard
              className="h-full"
              data={summary?.consistency}
              loading={loading}
              onPlanWeek={() => handleConsistencyAction("plan_week")}
              onViewHotSlots={() => handleConsistencyAction("view_hot_slots")}
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <MediaKitCard
              className="h-full"
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
              className="h-full"
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
