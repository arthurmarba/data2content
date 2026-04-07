"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import type { HomeSummaryResponse } from "@/app/dashboard/home/types";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { ACTIVATION_JOURNEY_STORAGE_KEY } from "@/types/paywall";
import { isPlanActiveLike } from "@/utils/planStatus";

type ActivationIntent = {
  context?: string | null;
  source?: string | null;
  returnTo?: string | null;
  ts?: number | null;
};

type ActivationFlowConfig = {
  order: ActivationStep["id"][];
  title: string;
};

export type ActivationStep = {
  id: "instagram" | "survey";
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  external?: boolean;
};

type CommunityCta = {
  visible: boolean;
  href: string | null;
  label: string;
  description: string;
  external: boolean;
};

type UseActivationChecklistResult = {
  loading: boolean;
  error: string | null;
  isVisible: boolean;
  title: string;
  subtitle: string;
  progressLabel: string;
  progressPercent: number;
  primaryStep: ActivationStep | null;
  secondarySteps: ActivationStep[];
  communityCta: CommunityCta;
  completionState: {
    visible: boolean;
    title: string;
    subtitle: string;
  };
  dismissCompletion: () => void;
};

const DEFAULT_RESULT: UseActivationChecklistResult = {
  loading: false,
  error: null,
  isVisible: false,
  title: "Etapas pendentes",
  subtitle: "",
  progressLabel: "0/0",
  progressPercent: 0,
  primaryStep: null,
  secondarySteps: [],
  communityCta: {
    visible: false,
    href: null,
    label: "Entrar no grupo VIP",
    description: "",
    external: true,
  },
  completionState: {
    visible: false,
    title: "",
    subtitle: "",
  },
  dismissCompletion: () => {},
};

const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;

function readActivationIntent(): ActivationIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVATION_JOURNEY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActivationIntent;
    if (parsed?.ts && Date.now() - parsed.ts > MAX_AGE_MS) {
      window.localStorage.removeItem(ACTIVATION_JOURNEY_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function resolveFlowConfig(intent: ActivationIntent | null): ActivationFlowConfig {
  const source = String(intent?.source ?? "").toLowerCase();
  const context = String(intent?.context ?? "").toLowerCase();

  if (
    source.includes("community_mentoria") ||
    source.includes("mentoria") ||
    context === "whatsapp" ||
    context === "mentoria"
  ) {
    return {
      order: ["instagram", "survey"],
      title: "Finalize sua entrada na Mentoria",
    };
  }

  if (source.includes("calculator") || context === "calculator") {
    return {
      order: ["instagram", "survey"],
      title: "Finalize o acesso da Calculadora",
    };
  }

  if (source.includes("media_kit") || context === "media_kit") {
    return {
      order: ["instagram", "survey"],
      title: "Finalize o acesso do Mídia Kit",
    };
  }

  if (
    source.includes("publis") || 
    context === "publis" || 
    context === "reply_email" || 
    context === "ai_analysis"
  ) {
    return {
      order: ["instagram", "survey"],
      title: context === "publis" ? "Finalize o acesso das Publis" : "Finalize o acesso da IA de CRM",
    };
  }

  if (source.includes("planning") || context === "planning") {
    return {
      order: ["instagram", "survey"],
      title: "Finalize o acesso da Criação de Post",
    };
  }

  return {
    order: ["instagram", "survey"],
    title: "Complete seu acesso",
  };
}

export function useActivationChecklist(): UseActivationChecklistResult {
  const { status: sessionStatus, data: session } = useSession();
  const billingStatus = useBillingStatus();
  const [summary, setSummary] = React.useState<HomeSummaryResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [intent, setIntent] = React.useState<ActivationIntent | null>(null);
  const [showCompletionState, setShowCompletionState] = React.useState(false);

  const dismissCompletion = React.useCallback(() => {
    setShowCompletionState(false);
  }, []);

  React.useEffect(() => {
    setIntent(readActivationIntent());
  }, [session?.user?.id]);

  React.useEffect(() => {
    if (sessionStatus !== "authenticated") {
      setSummary(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/dashboard/home/summary?scope=all", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("Não foi possível carregar as etapas pendentes.");
        }
        const payload = (await res.json()) as { ok?: boolean; data?: HomeSummaryResponse };
        if (!cancelled) {
          setSummary(payload?.data ?? null);
        }
      } catch (err) {
        if (cancelled || (err as Error)?.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Não foi possível carregar as etapas pendentes.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sessionStatus]);

  const isAuthenticated = sessionStatus === "authenticated";

  const sessionRole =
    typeof session?.user?.role === "string" ? session.user.role.trim().toLowerCase() : null;
  const sessionHasPremiumAccess =
    sessionRole === "admin" || isPlanActiveLike(session?.user?.planStatus);
  const hasPremiumAccess = Boolean(summary?.plan?.hasPremiumAccess || sessionHasPremiumAccess);
  const billingInstagramConnected = Boolean(billingStatus.instagram?.connected);
  const instagramConnected = billingStatus.hasResolvedOnce
    ? billingInstagramConnected
    : billingInstagramConnected || Boolean(session?.user?.instagramConnected);
  const surveyCompleted = Boolean(
    summary?.journeyProgress?.steps?.some(
      (step) => step.id === "personalize_support" && step.status === "done"
    )
  );
  const communityHref =
    summary?.community?.vip?.inviteUrl ??
    process.env.NEXT_PUBLIC_COMMUNITY_VIP_URL ??
    process.env.NEXT_PUBLIC_COMMUNITY_URL ??
    null;
  const communityCtaVisible = hasPremiumAccess && typeof communityHref === "string" && communityHref.length > 0;

  const flowConfig = resolveFlowConfig(intent);
  const instagramHref =
    flowConfig.title === "Finalize o acesso da Calculadora"
      ? "/dashboard/instagram/connect?next=calculator"
      : flowConfig.title === "Finalize o acesso do Mídia Kit"
        ? "/dashboard/instagram/connect?next=media-kit"
        : flowConfig.title === "Finalize o acesso da Criação de Post"
          ? "/dashboard/instagram/connect?next=planner"
          : flowConfig.title === "Finalize o acesso das Publis" || flowConfig.title === "Finalize o acesso da IA de CRM"
            ? "/dashboard/instagram/connect?next=campaigns"
            : "/dashboard/instagram/connect";

  const allSteps: Record<ActivationStep["id"], ActivationStep | null> = {
    instagram: !instagramConnected
      ? {
          id: "instagram",
          title: "Conectar Instagram",
          description: "Conecte sua conta para liberar cálculos, análises e contexto real.",
          href: instagramHref,
          actionLabel: "Conectar Instagram",
        }
      : null,
    survey: !surveyCompleted
      ? {
          id: "survey",
          title: "Responder pesquisa",
          description: "Personalize IA e suporte com respostas rápidas sobre seu momento.",
          href: "/?intent=survey",
          actionLabel: "Responder pesquisa",
        }
      : null,
  };

  const sortedSteps = flowConfig.order
    .map((id) => allSteps[id])
    .filter((step): step is ActivationStep => Boolean(step));

  const completionStorageKey = intent?.ts
    ? `${ACTIVATION_JOURNEY_STORAGE_KEY}:completed:${intent.ts}`
    : null;

  React.useEffect(() => {
    if (!isAuthenticated) {
      setShowCompletionState(false);
      return;
    }

    if (!hasPremiumAccess || sortedSteps.length > 0 || communityCtaVisible || !completionStorageKey) {
      setShowCompletionState(false);
      return;
    }

    if (typeof window === "undefined") return;

    try {
      const alreadyShown = window.sessionStorage.getItem(completionStorageKey) === "1";
      if (alreadyShown) return;
      window.sessionStorage.setItem(completionStorageKey, "1");
      setShowCompletionState(true);
    } catch {
      setShowCompletionState(true);
    }
  }, [communityCtaVisible, completionStorageKey, hasPremiumAccess, isAuthenticated, sortedSteps.length]);

  if (!isAuthenticated) {
    return {
      ...DEFAULT_RESULT,
      dismissCompletion,
    };
  }

  if (!hasPremiumAccess || (sortedSteps.length === 0 && !communityCtaVisible)) {
    return {
      ...DEFAULT_RESULT,
      loading,
      error,
      completionState: {
        visible: hasPremiumAccess && showCompletionState,
        title: "Acesso completo liberado",
        subtitle: "Tudo pronto. Seu painel já está com todas as etapas concluídas.",
      },
      dismissCompletion,
    };
  }

  const totalSteps = flowConfig.order.length;
  const pendingCount = sortedSteps.length;
  const completedCount = totalSteps - pendingCount;
  const primaryStep = sortedSteps[0] ?? null;
  const subtitle = primaryStep?.description ?? "Entre no grupo VIP e continue concluindo as etapas rastreáveis.";

  return {
    loading,
    error,
    isVisible: true,
    title: flowConfig.title,
    subtitle,
    progressLabel: `${completedCount}/${totalSteps} etapas concluídas`,
    progressPercent: Math.max(0, Math.min(100, Math.round((completedCount / totalSteps) * 100))),
    primaryStep,
    secondarySteps: sortedSteps.slice(1, 3),
    communityCta: {
      visible: communityCtaVisible,
      href: communityCtaVisible ? communityHref : null,
      label: "Entrar no grupo VIP",
      description: "A comunidade é a porta de entrada da plataforma. O grupo fica sempre disponível para assinantes.",
      external: true,
    },
    completionState: {
      visible: false,
      title: "",
      subtitle: "",
    },
    dismissCompletion,
  };
}
