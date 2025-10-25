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
  FaChevronDown,
  FaGem,
  FaLink,
  FaMagic,
  FaRocket,
  FaRobot,
  FaShieldAlt,
  FaUsers,
  FaWhatsapp,
  FaTimes,
} from "react-icons/fa";
import { INSTAGRAM_READ_ONLY_COPY } from "@/app/constants/trustCopy";

import ActionButton from "./components/ActionButton";
import type { CommunityMetricsCardData, HomeSummaryResponse } from "./types";
import { useHomeTelemetry } from "./useHomeTelemetry";
import WhatsAppConnectInline from "../WhatsAppConnectInline";
import { useHeaderSetup } from "../context/HeaderContext";

type Period = CommunityMetricsCardData["period"];
const DEFAULT_PERIOD: Period = "30d";
const TRIAL_CTA_LABEL = "⚡ Ativar IA no WhatsApp (48h grátis)";

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
  const { data: session, status } = useSession();
  const { trackCardAction, trackHeroAction, trackSurfaceView, trackWhatsappEvent } =
    useHomeTelemetry();

  const [summary, setSummary] = React.useState<HomeSummaryResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [initialFetch, setInitialFetch] = React.useState(false);
  const [showWhatsAppConnect, setShowWhatsAppConnect] = React.useState(false);
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

  const handleNextPostAction = React.useCallback(
    (action: string, origin?: string) => {
      trackCardAction("next_post", action, origin ? { origin } : undefined);
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
    [appendQueryParam, handleNavigate, summary?.nextPost?.plannerSlotId, summary?.nextPost?.plannerUrl, trackCardAction]
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
  const iaEngaged = whatsappLinked || whatsappTrialActive || whatsappTrialStarted || planIsPro;
  const hasPremiumAccessPlan = summary?.plan?.hasPremiumAccess ?? false;
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
  const isNewUserForOnboarding =
    Boolean((session?.user as any)?.isNewUserForOnboarding);
  const [welcomeDismissed, setWelcomeDismissed] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("d2c_welcome_modal_dismissed");
    if (stored === "1") {
      setWelcomeDismissed(true);
    }
  }, []);

  type HeroStage = "join_free" | "start_trial" | "use_trial" | "upgrade" | "join_vip" | "pro_engaged";


  const heroStage = React.useMemo<HeroStage>(() => {
    if (!communityFreeMember) return "join_free";
    if (!whatsappTrialStarted && whatsappTrialEligible) return "start_trial";
    if (whatsappTrialActive && !planIsPro) return "use_trial";
    if (!planIsPro) return "upgrade";
    if (planIsPro && !communityVipMember) return "join_vip";
    return "pro_engaged";
  }, [communityFreeMember, communityVipMember, planIsPro, whatsappTrialActive, whatsappTrialEligible, whatsappTrialStarted]);

  const shouldShowWelcomeModal =
    isNewUserForOnboarding && !isInstagramConnected && !welcomeDismissed;

  const dismissWelcomeModal = React.useCallback(() => {
    setWelcomeDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("d2c_welcome_modal_dismissed", "1");
    }
  }, []);

  React.useEffect(() => {
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
  }, [planTrialActive, planTrialExpiresAt]);

  const openSubscribeModal = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("open-subscribe-modal"));
    }
  }, []);

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
    openSubscribeModal();
  }, [heroStage, openSubscribeModal, trackHeroAction]);

  const handleOpenDiscover = React.useCallback(
    (origin?: string) => {
      trackCardAction("connect_prompt", "open_discover", origin ? { origin } : undefined);
      handleNavigate("/dashboard/discover");
    },
    [handleNavigate, trackCardAction]
  );

  const handleWelcomeConnect = React.useCallback(() => {
    trackHeroAction("welcome_modal_connect_instagram", { stage: heroStage });
    dismissWelcomeModal();
    handleHeaderConnectInstagram();
  }, [dismissWelcomeModal, handleHeaderConnectInstagram, heroStage, trackHeroAction]);

  const handleWelcomeExplore = React.useCallback(() => {
    trackHeroAction("welcome_modal_open_discover", { stage: heroStage });
    dismissWelcomeModal();
    handleOpenDiscover("welcome_modal");
  }, [dismissWelcomeModal, handleOpenDiscover, heroStage, trackHeroAction]);

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

  const handleJoinFreeCommunity = React.useCallback(
    (origin?: unknown) => {
      const originLabel = typeof origin === "string" ? origin : "default";
      trackCardAction("connect_prompt", "explore_community", { origin: originLabel });
      handleNavigate(communityFreeInviteUrl);
    },
    [communityFreeInviteUrl, handleNavigate, trackCardAction]
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
          text: planTrialCountdownLabel ? `Termina em ${planTrialCountdownLabel}` : "Modo PRO ativo",
        };
      }

      if (planTrialEligible && !planTrialStarted) {
        return {
          icon: "✨",
          className: "border-emerald-200 bg-emerald-50 text-emerald-700",
          text: "48h grátis • sem cartão",
        };
      }

      if (planTrialStarted && !planTrialActive) {
        return {
          icon: "💡",
          className: "border-amber-200 bg-amber-50 text-amber-700",
          text: "Trial terminou — mantenha o Mobi ativo",
        };
      }

      return null;
    }

    return {
      icon: "✅",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      text: "PRO ativo",
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

  useHeaderSetup(
    React.useMemo(
      () => ({
        cta: headerCta ?? null,
        extraContent: headerExtraContent ?? null,
      }),
      [headerCta, headerExtraContent]
    ),
    [headerCta, headerExtraContent]
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
        ? "48h grátis • Sem cartão • Cancele quando quiser."
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
    handleNavigate(communityVipInviteUrl);
  }, [communityVipInviteUrl, handleNavigate]);

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
          "Assine PRO para seguir recebendo categorias vencedoras, horário ideal e lembretes direto no WhatsApp.",
        primary: {
          label: "Assinar plano PRO",
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
        footnote: "🔒 Você já é PRO — conecte e receba os alertas no WhatsApp.",
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
      toast.success("✅ Conexão com WhatsApp concluída.");
    }
    previousWhatsappLinked.current = whatsappLinked;
  }, [trackWhatsappEvent, whatsappLinked]);

  const isCommunityMember = communityVipHasAccess ? communityVipMember : communityFreeMember;

  const progressItems = React.useMemo<JourneyStep[]>(() => {
    const instagramStatus: StepStatus = isInstagramConnected ? "done" : "todo";
    const iaActive = whatsappLinked || whatsappTrialActive;
    const iaStatus: StepStatus = iaActive ? "done" : "todo";
    const proStatus: StepStatus = planIsPro ? "done" : trialExpired ? "todo" : whatsappTrialActive ? "in-progress" : "todo";
    const mentorshipStatus: StepStatus =
      communityVipMember ? "done" : communityVipHasAccess || communityFreeMember ? "in-progress" : "todo";

    return [
      {
        id: "progress-instagram",
        title: "Instagram conectado",
        description: isInstagramConnected
          ? "Relatório gratuito gerado a cada semana."
          : "Conecte em segundos e libere seu relatório.",
        icon: <FaLink />,
        status: instagramStatus,
        actionLabel: isInstagramConnected ? "Conectado" : "Conectar Instagram",
        action: handleHeaderConnectInstagram,
        variant: "secondary",
        disabled: isInstagramConnected,
      },
      {
        id: "progress-ai",
        title: "IA no WhatsApp",
        description: iaActive
          ? "Receba ideias e alertas direto no WhatsApp."
          : "Ative a IA no WhatsApp por 48h e confirme seus melhores horários.",
        icon: <FaWhatsapp />,
        status: iaStatus,
        actionLabel: iaActive ? "Ver alertas da IA" : "Ativar IA no WhatsApp (48h grátis)",
        action: iaActive ? handleOpenWhatsApp : handleHeaderStartTrial,
        variant: "whatsapp",
        disabled: false,
      },
      {
        id: "progress-pro",
        title: "Plano PRO",
        description: planIsPro
          ? "IA ilimitada e relatórios automáticos ativos."
          : "Continue com IA ilimitada e suporte direto.",
        icon: <FaGem />,
        status: proStatus,
        actionLabel: planIsPro ? "Ver painel PRO" : "Assinar PRO",
        action: planIsPro ? () => handleNavigate("/dashboard") : handleHeaderSubscribe,
        variant: "pro",
        disabled: planIsPro,
      },
      {
        id: "progress-community",
        title: "Mentorias e comunidade",
        description: communityVipMember
          ? "Participando das mentorias semanais."
          : "Entre para trocar resultados com outros criadores.",
        icon: <FaUsers />,
        status: mentorshipStatus,
        actionLabel: communityVipMember
          ? "Mentoria ativa"
          : communityVipHasAccess
          ? "Entrar no grupo VIP"
          : "Abrir comunidade",
        action: () => {
          if (communityVipMember) {
            handleMentorshipAction("whatsapp_reminder");
            return;
          }
          if (communityVipHasAccess) {
            handleJoinVip();
            return;
          }
          handleJoinFreeCommunity("progress");
        },
        variant: "secondary",
        disabled: false,
      },
    ];
  }, [
    communityFreeMember,
    communityVipHasAccess,
    communityVipMember,
    handleHeaderConnectInstagram,
    handleHeaderStartTrial,
    handleHeaderSubscribe,
    handleJoinFreeCommunity,
    handleJoinVip,
    handleMentorshipAction,
    handleOpenWhatsApp,
    isInstagramConnected,
    planIsPro,
    trialExpired,
    whatsappLinked,
    whatsappTrialActive,
  ]);


  const showTrialMessageCard =
    !planIsPro &&
    (whatsappTrialActive || (!trialExpired && whatsappTrialStarted && whatsappTrialEligible));
  const showProUpsellCard = !planIsPro && trialExpired;


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
        subtitle: "Sua IA está quase pronta — ative no WhatsApp (48h grátis).",
        helper: "Conexão segura, leva menos de 30s.",
        ctaLabel: TRIAL_CTA_LABEL,
        onClick: handleHeaderStartTrial,
      };
    }

    if (!planIsPro) {
      return {
        subtitle: "Ative o modo PRO para manter a IA ligada sem limites.",
        helper: null,
        ctaLabel: "🚀 Assinar plano PRO",
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
        subtitle: "Conecte o WhatsApp para seguir recebendo alertas inteligentes.",
        helper: "Conexão segura em segundos.",
        ctaLabel: "🤖 Conectar WhatsApp IA",
        onClick: handleHeaderStartTrial,
      };
    }

    if (planIsPro) {
      return {
        subtitle: "Continue acompanhando seus alertas e relatórios no painel PRO.",
        helper: null,
        ctaLabel: "📊 Abrir painel PRO",
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
  const toolCards = React.useMemo(
    () => {
      const plannerMetric = !isInstagramConnected
        ? "Conexão somente leitura em segundos."
        : nextSlotLabel
        ? `Próximo horário sugerido: ${nextSlotLabel}`
        : weeklyGoal > 0
        ? `Progresso da semana: ${Math.min(postsSoFar, weeklyGoal)}/${weeklyGoal} posts`
        : "Defina uma meta semanal e eu gero os horários ideais.";
      const plannerActionLabel = isInstagramConnected ? "Gerar horários com IA" : "Conectar Instagram";

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

      return [
        {
          key: "planner",
          icon: <FaCalendarAlt aria-hidden="true" />,
          title: "Planejar com IA",
          description: isInstagramConnected
            ? "Gere horários personalizados e receba roteiros prontos."
            : "Conecte o Instagram e destrave horários com IA.",
          status: plannerMetric,
          actionLabel: plannerActionLabel,
          onAction: () => {
            if (!isInstagramConnected) {
              handleNextPostAction("connect_instagram", "tool_card");
              return;
            }
            handleConsistencyAction("plan_week");
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
          onAction: () =>
            handleMediaKitAction(hasMediaKit ? "open_brand_view" : "create_media_kit"),
        },
        {
          key: "community",
          icon: <FaUsers aria-hidden="true" />,
          title: "Comunidade",
          description: communityFreeMember
            ? "Participe dos desafios e mentorias semanais."
            : "Entre para trocar bastidores com criadores Data2Content.",
          status: communityStatus,
          actionLabel: communityVipHasAccess && !communityVipMember ? "Entrar no grupo VIP" : communityFreeMember ? "Abrir comunidade" : "Entrar na comunidade",
          onAction: () => {
            if (communityVipHasAccess && !communityVipMember) {
              handleJoinVip();
              return;
            }
            handleJoinFreeCommunity("tool_card");
          },
        },
      ];
    },
    [
      communityFreeMember,
      communityVipHasAccess,
      communityVipMember,
      handleConsistencyAction,
      handleJoinFreeCommunity,
      handleJoinVip,
      handleMediaKitAction,
      handleNextPostAction,
      hasMediaKit,
      isInstagramConnected,
      nextSlotLabel,
      postsSoFar,
      summary?.mediaKit?.lastUpdatedLabel,
      weeklyGoal,
    ]
  );
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
              <p className="font-semibold">Seu teste de 48h chegou ao fim.</p>
              <p className="text-xs text-amber-700">
                Ative o plano PRO e continue recebendo roteiros e alertas ilimitados no WhatsApp.
              </p>
            </div>
            <ActionButton
              label="Assinar plano PRO"
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

  const welcomeModal = shouldShowWelcomeModal ? (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={dismissWelcomeModal}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100"
          aria-label="Fechar"
        >
          <FaTimes aria-hidden="true" />
        </button>
        <div className="space-y-4">
          <div className="space-y-2 pr-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              Primeiro acesso confirmado
            </p>
            <h2 className="text-2xl font-semibold text-slate-900">
              Bem-vindo(a) à sua base na Data2Content
            </h2>
            <p className="text-sm text-slate-600">
              Você já pode explorar a Comunidade e o Planner demo. Conectar o Instagram libera o
              relatório estratégico gratuito e os alertas automáticos.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleWelcomeExplore}
              className="inline-flex w-full items-center justify-center rounded-lg bg-brand-red px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 sm:w-auto"
            >
              Entrar na Comunidade
            </button>
            <button
              type="button"
              onClick={handleWelcomeConnect}
              className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 sm:w-auto"
            >
              Conectar Instagram agora
            </button>
          </div>
          <button
            type="button"
            onClick={dismissWelcomeModal}
            className="text-xs font-semibold text-slate-400 underline-offset-2 hover:underline"
          >
            Depois eu vejo
          </button>
        </div>
      </div>
    </div>
  ) : null;
  return (
    <>
      {welcomeModal}
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      {connectBanner}
      <section className="rounded-3xl border border-slate-200 bg-white/95 px-6 py-8 shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-4 text-center lg:text-left">
            <div className="space-y-2">
              <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500 lg:justify-start">
                {`Etapa ${journeyStageInfo.step} de ${journeyStageInfo.total} · ${journeyStageInfo.label}`}
              </span>
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                <span aria-hidden="true">👋</span> Oi,{" "}
                <span className="text-[#F6007B]">{firstName}</span>!{" "}
                <span className="text-slate-900">Sua carreira de criador com IA começa aqui.</span>
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
                  className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-4 text-left shadow-sm"
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



      <section className="mt-6 rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
              Etapa {journeyStageInfo.step} de {journeyStageInfo.total}
            </p>
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
              Seu progresso na Data2Content
            </h2>
          </div>
          <p className="text-sm font-semibold text-slate-500">{journeyStageInfo.label}</p>
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
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {progressItems.map((item) => {
            const statusEmoji = STEP_STATUS_ICONS[item.status];
            const statusLabel = STEP_STATUS_LABELS[item.status];
            const disabled = item.disabled || item.status === "loading";
            return (
              <button
                key={`${item.id}-summary`}
                type="button"
                onClick={() => {
                  if (disabled) return;
                  item.action();
                }}
                disabled={disabled}
                className={`flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/30 focus-visible:ring-offset-2 ${
                  disabled ? "cursor-not-allowed opacity-60" : "hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(15,23,42,0.08)]"
                }`}
              >
                <span className="text-xl" aria-hidden="true">
                  {statusEmoji}
                </span>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {statusLabel}
                  </p>
                  <p className="text-xs text-slate-500">{item.description}</p>
                  <span
                    className={`mt-1 inline-flex items-center gap-1 text-[11px] font-semibold ${
                      disabled ? "text-slate-400" : "text-[#F6007B]"
                    }`}
                  >
                    {item.actionLabel}
                    {!disabled ? (
                      <FaChevronDown className="-rotate-90" aria-hidden="true" />
                    ) : null}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>


      <section className="mt-6 rounded-3xl border border-[#FCD6EA] bg-gradient-to-br from-[#FFF6FB] via-white to-white px-6 py-6 shadow-sm">
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
                      className={`max-w-[240px] rounded-2xl px-4 py-2 text-[13px] leading-relaxed shadow-sm ${
                        index % 2 === 0 ? "bg-white text-slate-700" : "bg-slate-50 text-slate-700"
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
            <div
              key={card.key}
              className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F6007B]/10 text-[#F6007B]">
                  {card.icon}
                </span>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-slate-900">{card.title}</h3>
                  <p className="text-sm text-slate-600">{card.description}</p>
                </div>
              </div>
              <p className="text-xs font-semibold text-slate-500">{card.status}</p>
              <button
                type="button"
                onClick={card.onAction}
                className="inline-flex items-center justify-center rounded-full bg-[#F6007B] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e2006f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/40 focus-visible:ring-offset-2"
              >
                {card.actionLabel}
              </button>
            </div>
          ))}
        </div>
      </section>
      {microInsightCard ? (
        <section className="mt-8">
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
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
                    className={`rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-800 shadow-sm ${
                      microInsightCard.teaser.blurred ? "filter blur-[2px]" : ""
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
                    className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                      microInsightCard.variant === "primary"
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
        <section className="mt-10 rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
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
        <section className="mt-10 rounded-3xl border border-[#FCD6EA] bg-gradient-to-br from-[#FFF1F8] via-white to-white px-6 py-6 shadow-sm">
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
                Assinar plano PRO
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
