// src/app/dashboard/billing/BillingSubscribeModal.tsx
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Crown, Check, ArrowRight, Loader2 } from "lucide-react";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import type { PaywallContext } from "@/types/paywall";
import { track } from "@/lib/track";
import { redirectToGoogleConsentLogin } from "@/lib/auth/googleLogin";
import { buildCheckoutUrl } from "@/app/lib/checkoutRedirect";
import { mapSubscribeError } from "@/app/lib/billing/errors";
import { useBodyScrollLock } from "@/lib/a11y";
import {
  PAYWALL_AUTOSTART_PARAM,
  PAYWALL_CONTEXT_PARAM,
  PAYWALL_CURRENCY_PARAM,
  PAYWALL_PERIOD_PARAM,
  PAYWALL_RETURN_STORAGE_KEY,
  PAYWALL_URL_PARAM,
} from "@/types/paywall";

interface BillingSubscribeModalProps {
  open: boolean;
  onClose: () => void;
  context?: PaywallContext;
  resumeCheckoutDirect?: boolean;
}

type PricesShape = {
  monthly: { brl: number; usd: number };
  annual: { brl: number; usd: number };
};

type APIRawPrice = {
  plan?: string | null;
  currency?: string | null;
  unitAmount?: number | null;
};

// cache simples em escopo de módulo para reabrir o modal sem re-buscar sempre
let pricesCache: PricesShape | null = null;

// 🎯 Narrativa focada: ferramentas de execução (roteiros/review) + alertas no WhatsApp
const FEATURES: string[] = [
  "Análise de Perfil avançada (Audiência, Timing e Formatos Ideais)",
  "Roteiros gerados por IA e vinculados aos seus conteúdos publicados",
  "Negociação assistida por IA e CRM para gerenciar suas campanhas",
  "Mídia Kit auditado com vitrine exclusiva no Marketplace Destaque",
  "Mentorias semanais ao vivo e suporte diagnóstico pelo WhatsApp",
  "Modelo transparente: Você paga apenas a assinatura, com 0% de comissão",
];

type PaywallCopy = {
  title: string;
  subtitle: string;
  bullets: string[];
  ctaLabel: string;
  steps?: string[];
};

const PAYWALL_COPY: Record<PaywallContext | "default", PaywallCopy> = {
  default: {
    title: "Ativar Consultoria Estratégica (D2C)",
    subtitle:
      "Acesso ao Motor IA para narrativa, revisões semanais em grupo e radar de talentos Destaque.",
    bullets: FEATURES,
    ctaLabel: "Ativar Acesso VIP",
  },
  reply_email: {
    title: "IA de Negociação (CRM)",
    subtitle: "Analise propostas em segundos e receba recomendações estratégicas para fechar mais contratos.",
    bullets: [
      "Playbook de resposta baseada em métricas reais",
      "Rascunhos automáticos de email otimizados para conversão",
      "Identificação de riscos e oportunidades no briefing",
    ],
    ctaLabel: "Ativar IA de Negociação",
    steps: [
      "Ative sua assinatura",
      "Conecte seu Instagram",
      "Volte para liberar sua IA",
    ],
  },
  ai_analysis: {
    title: "IA de Negociação (CRM)",
    subtitle: "Analise propostas em segundos e receba recomendações estratégicas para fechar mais contratos.",
    bullets: [
      "Playbook de resposta baseada em métricas reais",
      "Rascunhos automáticos de email otimizados para conversão",
      "Identificação de riscos e oportunidades no briefing",
    ],
    ctaLabel: "Ativar IA de Negociação",
    steps: [
      "Ative sua assinatura",
      "Conecte seu Instagram",
      "Volte para liberar sua IA",
    ],
  },
  calculator: {
    title: "Precificação Inteligente (Radar Destaque)",
    subtitle: "Valores calibrados para atrair as marcas que você realmente quer.",
    bullets: [
      "Faixas estratégicas (Justo, Influencer e Premium)",
      "Multiplicadores auditados pelo time D2C",
    ],
    ctaLabel: "Ativar Acesso VIP",
    steps: [
      "Ative sua assinatura",
      "Conecte seu Instagram",
      "Volte para liberar sua precificação",
    ],
  },
  media_kit: {
    title: "Mídia Kit Profissional (IA)",
    subtitle: "Gere seu link único com métricas auditadas e sincronizadas automaticamente.",
    bullets: [
      "Dados reais do Instagram (Alcance, Engajamento, etc)",
      "Sugestões de faixas de preço baseadas em performance",
      "Vitrine exclusiva no Marketplace Destaque",
    ],
    ctaLabel: "Ativar Acesso VIP",
    steps: [
      "Ative sua assinatura",
      "Conecte seu Instagram",
      "Volte para liberar seu Mídia Kit",
    ],
  },
  publis: {
    title: "Biblioteca de Publis (IA)",
    subtitle: "Organize suas parcerias e compartilhe métricas ao vivo com marcas.",
    bullets: [
      "Histórico completo de conteúdos publicitários",
      "Compartilhamento de resultados via link",
      "Filtros inteligentes por desempenho e data",
    ],
    ctaLabel: "Ativar Acesso VIP",
    steps: [
      "Ative sua assinatura",
      "Conecte seu Instagram",
      "Volte para liberar suas publis",
    ],
  },
  narrative_map: {
    title: "Desbloqueie seu Perfil vivo",
    subtitle: "A leitura gratuita mostra o que a D2C percebeu neste vídeo.",
    bullets: [
      "Até 10 leituras estratégicas por mês",
      "Perfil vivo com padrões e hipóteses",
      "Conexão com Instagram",
      "Consultorias em grupo",
    ],
    ctaLabel: "Assinar Pro e conectar Instagram",
    steps: [
      "Ative sua assinatura",
      "Conecte seu Instagram",
      "Volte para o Perfil",
    ],
  },
  mentoria: {
    title: "Entre na consultoria da D2C",
    subtitle:
      "No Plano Pro, você entra no Grupo VIP e participa das consultorias em grupo, além de liberar o Perfil vivo com 10 leituras por mês e Instagram conectado.",
    bullets: [
      "Grupo VIP da D2C",
      "Consultorias em grupo",
      "Perfil vivo com 10 leituras por mês",
      "Instagram conectado",
    ],
    ctaLabel: "Assinar Pro e entrar",
    steps: [
      "Ative sua assinatura",
      "Entre no grupo VIP",
      "Acesse a agenda de mentorias",
    ],
  },
  planning: {
    title: "Criação Inteligente & Análise de Perfil",
    subtitle:
      "Desbloqueie o poder da Inteligência Artificial para gerar roteiros avançados e acesse dados reais da sua audiência conectando seu Instagram.",
    bullets: [
      "Roteiros criados por IA com base em tendências do seu nicho",
      "Sincronização imediata com os conteúdos já publicados",
      "Análise do seu timing ideal e audiência exclusiva",
    ],
    ctaLabel: "Ativar Acesso VIP",
    steps: [
      "Ative sua assinatura",
      "Conecte seu Instagram",
      "Volte para acessar Planner Inteligente",
    ],
  },
  whatsapp: {
    title: "Execução Assistida (WhatsApp)",
    subtitle: "Alertas táticos para você nunca perder o timing da sua narrativa.",
    bullets: [
      "Alertas de pautas, reuniões e oportunidades",
      "Diagnóstico contínuo do Instagram pela IA",
      "Acesso rápido às notas de revisão",
    ],
    ctaLabel: "Ativar Acesso VIP",
    steps: [
      "Ative sua assinatura",
      "Conecte seu Instagram",
      "Volte para liberar seus Alertas",
    ],
  },
};

const FREE_VS_PRO_ROWS = [
  {
    feature: "Dados Reais e Análise Profunda via Instagram",
    free: false,
    pro: true,
  },
  {
    feature: "Criação Flexível e Roteiros Inteligentes (Com IA)",
    free: false,
    pro: true,
  },
  {
    feature: "Mídia Kit Auditado e Calculadora de Preços Justa",
    free: false,
    pro: true,
  },
  {
    feature: "Mentorias Semanais e Acesso VIP à Comunidade",
    free: false,
    pro: true,
  },
];

export default function BillingSubscribeModal({
  open,
  onClose,
  context,
  resumeCheckoutDirect = false,
}: BillingSubscribeModalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: sessionStatus } = useSession();
  const [prices, setPrices] = useState<PricesShape | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<{ label: string; href: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingRedirect, setLoadingRedirect] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  // UI state
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly"); // padrão mensal para destacar valor inicial
  const [currency, setCurrency] = useState<"brl" | "usd">("brl");
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const trackedOpenRef = useRef(false);
  const autoStartHandledRef = useRef(false);
  const billingStatus = useBillingStatus();
  const billingStatusLoading = Boolean(billingStatus.isLoading);
  const billingStatusError = billingStatus.error;
  const hasPremiumAccess = Boolean(billingStatus.hasPremiumAccess);
  const needsPaymentAction = Boolean(billingStatus.needsPaymentAction);
  const needsCheckout = Boolean(billingStatus.needsCheckout);
  const needsAbort = Boolean(billingStatus.needsAbort);
  const needsPaymentUpdate = Boolean(billingStatus.needsPaymentUpdate);
  const billingNormalizedStatus = billingStatus.normalizedStatus ?? null;
  const refetchBillingStatus = billingStatus.refetch;
  const effectiveContext = context ?? "default";
  
  // O modal deve ser uniforme mostrando todo o valor do plano Pro (D2C)
  // mas mantendo os "steps" específicos para guiar o usuário no funil atual.
  const contextCopy = PAYWALL_COPY[effectiveContext] ?? PAYWALL_COPY.default;
  const paywallCopy = contextCopy;
  const bulletItems = contextCopy.bullets;
  const stepItems = useMemo(() => {
    let items = Array.isArray(contextCopy.steps) ? [...contextCopy.steps] : [];
    if (sessionStatus === "unauthenticated" && items.length > 0) {
      items = ["Faça Login com Google", ...items];
    }
    return items;
  }, [contextCopy.steps, sessionStatus]);
  const primaryCtaLabel = contextCopy.ctaLabel || "Assinar e continuar";
  const isDefaultContext = effectiveContext === "default";
  const shouldBlockSubscribe =
    !billingStatusError && (hasPremiumAccess || needsPaymentAction);
  const didRefetchRef = useRef(false);
  const [resumeFallbackVisible, setResumeFallbackVisible] = useState(false);
  const modalVisible = open || resumeFallbackVisible;

  useBodyScrollLock(modalVisible);

  const closeModal = useCallback(() => {
    setResumeFallbackVisible(false);
    onClose();
  }, [onClose]);

  const clearPaywallUrlParams = useCallback(() => {
    if (typeof window === "undefined") return;
    const next = new URL(window.location.href);
    next.searchParams.delete(PAYWALL_URL_PARAM);
    next.searchParams.delete(PAYWALL_CONTEXT_PARAM);
    next.searchParams.delete(PAYWALL_AUTOSTART_PARAM);
    next.searchParams.delete(PAYWALL_PERIOD_PARAM);
    next.searchParams.delete(PAYWALL_CURRENCY_PARAM);
    const target =
      next.pathname +
      (next.search ? next.search : "") +
      (next.hash ? next.hash : "");
    router.replace(target, { scroll: false });
  }, [router]);

  const startGoogleCheckoutFlow = useCallback(() => {
    if (typeof window === "undefined") return;
    const callbackUrl = new URL(window.location.href);
    callbackUrl.searchParams.set(PAYWALL_URL_PARAM, "1");
    callbackUrl.searchParams.set(PAYWALL_CONTEXT_PARAM, effectiveContext);
    callbackUrl.searchParams.set(PAYWALL_AUTOSTART_PARAM, "1");
    callbackUrl.searchParams.set(PAYWALL_PERIOD_PARAM, period);
    callbackUrl.searchParams.set(PAYWALL_CURRENCY_PARAM, currency);
    redirectToGoogleConsentLogin(callbackUrl.toString());
  }, [currency, effectiveContext, period]);

  const resolveCheckoutCancelUrl = useCallback(() => {
    if (typeof window === "undefined") return "/dashboard/billing";

    let returnToPath: string | null = null;
    try {
      const stored = window.sessionStorage.getItem(PAYWALL_RETURN_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { returnTo?: string | null } | null;
        if (
          typeof parsed?.returnTo === "string" &&
          parsed.returnTo.startsWith("/") &&
          !parsed.returnTo.startsWith("//")
        ) {
          returnToPath = parsed.returnTo;
        }
      }
    } catch {
      /* ignore storage errors */
    }

    const fallback = new URL(window.location.href);
    fallback.searchParams.delete(PAYWALL_URL_PARAM);
    fallback.searchParams.delete(PAYWALL_CONTEXT_PARAM);
    fallback.searchParams.delete(PAYWALL_AUTOSTART_PARAM);
    fallback.searchParams.delete(PAYWALL_PERIOD_PARAM);
    fallback.searchParams.delete(PAYWALL_CURRENCY_PARAM);
    const fallbackPath =
      fallback.pathname +
      (fallback.search ? fallback.search : "") +
      (fallback.hash ? fallback.hash : "");

    return `${window.location.origin}${returnToPath ?? fallbackPath}`;
  }, []);

  // Fecha com ESC
  useEffect(() => {
    if (!modalVisible) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeModal();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeModal, modalVisible]);

  // Ajusta moeda padrão pelo locale do usuário
  useEffect(() => {
    if (!modalVisible) return;
    try {
      const lang = (typeof navigator !== "undefined" && navigator.language) || "";
      if (/^pt(-|$)/i.test(lang)) setCurrency("brl");
      else setCurrency("usd");
    } catch {
      /* no-op */
    }
  }, [modalVisible]);

  useEffect(() => {
    if (!modalVisible) {
      trackedOpenRef.current = false;
      return;
    }

    if (!trackedOpenRef.current) {
      trackedOpenRef.current = true;
      const normalizedPlan = billingNormalizedStatus ?? null;
      const telemetryContext: "other" | "planner" | "planning" | "discover" | "whatsapp_ai" | "reply_email" | "ai_analysis" | "calculator" | null = (() => {
        switch (effectiveContext) {
          case "planning":
            return "planning";
          case "calculator":
            return "calculator";
          case "narrative_map":
            return "other";
          case "mentoria":
            return "discover";
          case "whatsapp":
            return "whatsapp_ai";
          case "reply_email":
            return "reply_email";
          case "ai_analysis":
            return "ai_analysis";
          default:
            return "other";
        }
      })();
      track("paywall_viewed", {
        creator_id: null,
        context: telemetryContext,
        plan: normalizedPlan,
      });
    }
  }, [modalVisible, effectiveContext, billingNormalizedStatus]);

  useEffect(() => {
    if (!modalVisible && !resumeCheckoutDirect) {
      didRefetchRef.current = false;
      autoStartHandledRef.current = false;
      setResumeFallbackVisible(false);
      return;
    }
    if (didRefetchRef.current) return;
    didRefetchRef.current = true;
    refetchBillingStatus?.();
  }, [modalVisible, refetchBillingStatus, resumeCheckoutDirect]);

  useEffect(() => {
    if (!modalVisible) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusableSelectors = [
      'button:not([disabled]):not([tabindex="-1"])',
      'a[href]:not([tabindex="-1"])',
      'input:not([disabled]):not([tabindex="-1"])',
      'select:not([disabled]):not([tabindex="-1"])',
      'textarea:not([disabled]):not([tabindex="-1"])',
      '[tabindex]:not([tabindex="-1"])',
    ];

    const isElementVisible = (element: HTMLElement) => {
      const style = window.getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none") return false;
      if (style.position === "fixed") return true;
      return element.offsetParent !== null;
    };

    const getFocusable = () =>
      dialogRef.current
        ? Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelectors.join(","))).filter((el) => {
          if (el.hasAttribute("disabled") || el.getAttribute("aria-hidden") === "true") return false;
          return isElementVisible(el);
        })
        : [];

    const focusInitial = () => {
      const autoElement =
        dialogRef.current?.querySelector<HTMLElement>("[data-autofocus='true']") ?? getFocusable()[0] ?? dialogRef.current;
      autoElement?.focus({ preventScroll: true });
    };

    const raf = window.requestAnimationFrame(focusInitial);

    const handleTabTrap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current?.focus({ preventScroll: true });
        return;
      }
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey) {
        const prevIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
        focusable[prevIndex]?.focus({ preventScroll: true });
      } else {
        const nextIndex = currentIndex === focusable.length - 1 ? 0 : currentIndex + 1;
        focusable[nextIndex]?.focus({ preventScroll: true });
      }
      event.preventDefault();
    };

    document.addEventListener("keydown", handleTabTrap, true);

    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleTabTrap, true);
      const previous = previousFocusRef.current;
      if (previous && typeof previous.focus === "function") {
        previous.focus({ preventScroll: true });
      }
      previousFocusRef.current = null;
    };
  }, [modalVisible]);

  useEffect(() => {
    if ((!modalVisible && !resumeCheckoutDirect) || !searchParams) return;
    const periodParam = searchParams.get(PAYWALL_PERIOD_PARAM);
    const currencyParam = searchParams.get(PAYWALL_CURRENCY_PARAM);

    if (periodParam === "monthly" || periodParam === "annual") {
      setPeriod(periodParam);
    }
    if (currencyParam === "brl" || currencyParam === "usd") {
      setCurrency(currencyParam);
    }
  }, [modalVisible, resumeCheckoutDirect, searchParams]);

  const parsePrices = (items: APIRawPrice[] | undefined | null): PricesShape => {
    const byKey: PricesShape = {
      monthly: { brl: 0, usd: 0 },
      annual: { brl: 0, usd: 0 },
    };
    const list = Array.isArray(items) ? items : [];
    for (const it of list) {
      const plan = String(it?.plan ?? "").toLowerCase();
      const curr = String(it?.currency ?? "").toUpperCase();
      const val = typeof it?.unitAmount === "number" ? it!.unitAmount / 100 : 0;
      if (plan === "monthly" && (curr === "BRL" || curr === "USD")) {
        (byKey.monthly as any)[curr.toLowerCase()] = val;
      }
      if (plan === "annual" && (curr === "BRL" || curr === "USD")) {
        (byKey.annual as any)[curr.toLowerCase()] = val;
      }
    }
    return byKey;
  };

  const loadPrices = useCallback(async () => {
    controllerRef.current?.abort();
    const ctrl = new AbortController();
    controllerRef.current = ctrl;

    setLoading(true);
    setError(null);
    setErrorAction(null);
    try {
      const res = await fetch("/api/billing/prices", {
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) {
        let message = "Falha ao carregar preços.";
        try {
          const data = await res.json();
          message = data?.error || data?.message || message;
        } catch { /* ignore */ }
        throw new Error(message);
      }
      const data = await res.json();
      const parsed = parsePrices(data?.prices as APIRawPrice[]);
      pricesCache = parsed;
      setPrices(parsed);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e?.message || "Erro inesperado ao buscar preços.");
      setPrices(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // carrega quando abrir; usa cache se disponível
  useEffect(() => {
    if (!modalVisible) return;

    if (pricesCache) {
      setPrices(pricesCache);
      setError(null);
      setErrorAction(null);
      return;
    }
    void loadPrices();

    return () => {
      controllerRef.current?.abort();
    };
  }, [loadPrices, modalVisible]);

  // Fecha ao clicar no overlay
  const handleOverlay = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) closeModal();
  };

  // ✅ 2 casas decimais sempre
  const formatMoney = (value: number) =>
    new Intl.NumberFormat(currency === "brl" ? "pt-BR" : "en-US", {
      style: "currency",
      currency: currency === "brl" ? "BRL" : "USD",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(value || 0);

  const activePrice = useMemo(() => {
    if (!prices) return 0;
    return prices[period][currency];
  }, [prices, period, currency]);

  const monthlyEquivalent = useMemo(() => {
    if (!prices) return 0;
    const a = prices.annual[currency];
    return a ? a / 12 : 0;
  }, [prices, currency]);

  const savingsPct = useMemo(() => {
    if (!prices) return 0;
    const m = prices.monthly[currency];
    const a = prices.annual[currency];
    if (!m || !a) return 0;
    const monthlyEq = a / 12;
    const pct = 1 - monthlyEq / m;
    return Math.max(0, Math.round(pct * 100));
  }, [prices, currency]);
  const resolvedPrimaryCtaLabel =
    sessionStatus === "authenticated" ? primaryCtaLabel : "Continuar com Google";

  /** Dispara o fluxo de assinatura (Checkout hospedado ou Payment Element). */
  const handleSubscribe = useCallback(async (options?: { hiddenResume?: boolean }) => {
    const hiddenResume = Boolean(options?.hiddenResume);
    track("dashboard_cta_clicked", {
      creator_id: null,
      target: "activate_pro",
      surface: "upsell_block",
      context: effectiveContext === "default" ? "paywall" : effectiveContext,
    });
    setError(null);
    setErrorAction(null);
    setLoadingRedirect(true);
    try {
      if (sessionStatus === "unauthenticated") {
        await startGoogleCheckoutFlow();
        return;
      }
      if (hasPremiumAccess) {
        setErrorAction({ label: "Trocar plano", href: "/dashboard/billing" });
        throw new Error("Você já possui um plano ativo ou em teste.");
      }
      if (needsPaymentUpdate) {
        setErrorAction({ label: "Atualizar pagamento", href: "/dashboard/billing" });
        throw new Error("Existe um pagamento pendente. Atualize o método de pagamento em Billing.");
      }
      if (needsCheckout) {
        setErrorAction({ label: "Resolver pendência", href: "/dashboard/billing" });
        throw new Error("Existe um checkout pendente. Retome ou aborte a tentativa em Billing.");
      }
      const payload = {
        plan: period,              // "monthly" | "annual"
        currency,                  // "brl" | "usd"
        mode: "subscription",
        successUrl: `${window.location.origin}/billing/success`,
        cancelUrl: resolveCheckoutCancelUrl(),
        source: "modal",
      };

      const response = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));

      if (response.status === 401) {
        await startGoogleCheckoutFlow();
        return;
      }

      if (!response.ok) {
        const mapped = mapSubscribeError(body?.code, body?.message);
        if (mapped) {
          setErrorAction(
            mapped.actionLabel && mapped.actionHref
              ? { label: mapped.actionLabel, href: mapped.actionHref }
              : null
          );
          throw new Error(mapped.message);
        }
        throw new Error(body?.error || body?.message || "Não foi possível iniciar o checkout.");
      }

      // Fecha o modal antes de redirecionar para garantir que não bloqueie a tela
      closeModal();

      if (body?.clientSecret) {
        router.push(buildCheckoutUrl(body.clientSecret, body.subscriptionId));
        return;
      }

      const url = body?.checkoutUrl || body?.url || null;
      if (url) {
        window.location.href = url;
        return;
      }

      throw new Error("Não foi possível iniciar o checkout. Tente novamente em instantes.");
    } catch (e: any) {
      setError(e?.message || "Erro ao redirecionar para o checkout.");
      if (hiddenResume) {
        setResumeFallbackVisible(true);
      }
      setLoadingRedirect(false); // Só para o loading se der erro, se der sucesso vai navegar
    }
  }, [
    closeModal,
    currency,
    effectiveContext,
    hasPremiumAccess,
    needsCheckout,
    needsPaymentUpdate,
    period,
    resolveCheckoutCancelUrl,
    router,
    sessionStatus,
    startGoogleCheckoutFlow,
  ]);

  useEffect(() => {
    if ((!modalVisible && !resumeCheckoutDirect) || !searchParams) return;
    if (sessionStatus !== "authenticated") return;
    if (billingStatusLoading) return;
    if (searchParams.get(PAYWALL_AUTOSTART_PARAM) !== "1") return;
    if (autoStartHandledRef.current) return;

    autoStartHandledRef.current = true;
    clearPaywallUrlParams();
    void handleSubscribe({ hiddenResume: !modalVisible && resumeCheckoutDirect });
  }, [
    billingStatusLoading,
    clearPaywallUrlParams,
    handleSubscribe,
    modalVisible,
    resumeCheckoutDirect,
    searchParams,
    sessionStatus,
  ]);

  // -------------------- RENDER --------------------

  if (!modalVisible) return null;

  // Loading (skeleton)
  if (loading && !prices && !error) {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm px-3 sm:px-4 py-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Carregando preços"
        onClick={handleOverlay}
      >
        <div
          ref={dialogRef}
          className="w-full max-w-lg rounded-3xl bg-white shadow-2xl ring-1 ring-gray-200/80 overflow-hidden animate-[fadeIn_160ms_ease-out] flex flex-col max-h-[92vh] sm:max-h-[90vh]"
          tabIndex={-1}
        >
          {/* Header sticky */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-pink-100 p-2">
                  <Crown className="w-5 h-5 text-pink-600" />
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Assinar Data2Content</h2>
              </div>
              <button
                className="rounded-full p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                onClick={closeModal}
                aria-label="Fechar"
                data-autofocus="true"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="dashboard-scrollbar flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-4">
            <div className="h-8 w-40 rounded-lg bg-gray-100 relative overflow-hidden">
              <span className="absolute inset-0 animate-[shimmer_1.2s_infinite] bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            </div>
            <div className="h-10 w-full rounded-xl bg-gray-100 relative overflow-hidden" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="h-12 rounded-xl bg-gray-100 relative overflow-hidden" />
              <div className="h-12 rounded-xl bg-gray-100 relative overflow-hidden" />
            </div>
          </div>
        </div>

        <style jsx global>{`
          @keyframes fadeIn { from{opacity:0;transform:translateY(8px) scale(.98)} to{opacity:1;transform:translateY(0) scale(1)} }
          @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        `}</style>
      </div>
    );
  }

  // Erro (retry)
  if (error && !prices) {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm px-3 sm:px-4 py-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-error-title"
        onClick={handleOverlay}
      >
        <div
          ref={dialogRef}
          className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 overflow-hidden animate-[fadeIn_160ms_ease-out] flex flex-col max-h-[92vh] sm:max-h-[90vh]"
          tabIndex={-1}
        >
          {/* Header sticky com X sempre visível */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4">
              <h2 id="billing-error-title" className="text-lg sm:text-xl font-bold text-gray-900">
                Assinar Data2Content
              </h2>
              <button
                className="rounded-full p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                onClick={closeModal}
                aria-label="Fechar"
                data-autofocus="true"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="dashboard-scrollbar flex-1 overflow-y-auto px-5 sm:px-6 py-5">
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => void loadPrices()}
                className="inline-flex items-center justify-center rounded-md bg-gray-900 hover:bg-gray-800 px-5 py-2.5 text-sm font-semibold text-white"
              >
                Tentar novamente
              </button>
              <button
                onClick={closeModal}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>

        <style jsx global>{`
          @keyframes fadeIn { from{opacity:0;transform:translateY(8px) scale(.98)} to{opacity:1;transform:translateY(0) scale(1)} }
        `}</style>
      </div>
    );
  }

  // UI principal (preços prontos)
  if (prices) {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm px-3 sm:px-4 py-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="subscribe-modal-title"
        onClick={handleOverlay}
      >
        <div
          ref={dialogRef}
          className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] text-zinc-950 shadow-[0_24px_70px_rgba(15,23,42,0.16)] animate-[fadeIn_160ms_ease-out] flex flex-col max-h-[92vh] sm:max-h-[90vh]"
          tabIndex={-1}
        >
          {/* Header sticky */}
          <div className="sticky top-0 z-10 bg-white">
            <div className="border-b border-zinc-200/80">
              <div className="flex items-start gap-4 p-6 sm:p-7">
                <div className="shrink-0 rounded-[1.1rem] bg-brand-primary/8 p-3 ring-1 ring-inset ring-brand-primary/12">
                  <Crown className="w-5 h-5 text-brand-primary" />
                </div>
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-brand-primary/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-primary ring-1 ring-inset ring-brand-primary/10">
                      Plano Pro
                    </span>
                  </div>
                  <h2 id="subscribe-modal-title" className="text-[1.55rem] sm:text-[1.75rem] font-black tracking-tight leading-[1.02] text-zinc-950">
                    {paywallCopy.title}
                  </h2>
                  <p className="mt-2 max-w-[25rem] text-sm leading-6 text-zinc-500">
                    {paywallCopy.subtitle}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  aria-label="Fechar"
                  className="rounded-full p-2 text-zinc-400 transition-all hover:bg-zinc-100 hover:text-zinc-900"
                  data-autofocus="true"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="dashboard-scrollbar flex-1 overflow-y-auto">
            {/* Seletores */}
            <div className="px-6 sm:px-8 pt-6">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="inline-flex rounded-[1.1rem] border border-zinc-200 bg-zinc-50 p-1">
                  <button
                    onClick={() => setPeriod("monthly")}
                    className={`rounded-[0.9rem] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-all ${period === "monthly" ? "bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-200/80" : "text-zinc-500 hover:text-zinc-900"}`}
                    disabled={loadingRedirect}
                  >
                    Mensal
                  </button>
                  <button
                    onClick={() => setPeriod("annual")}
                    className={`rounded-[0.9rem] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-all ${period === "annual" ? "bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-200/80" : "text-zinc-500 hover:text-zinc-900"}`}
                    disabled={loadingRedirect}
                  >
                    Anual {savingsPct > 0 && <span className="ml-1 text-brand-primary">-{savingsPct}%</span>}
                  </button>
                </div>

                <div className="inline-flex rounded-[1.1rem] border border-zinc-200 bg-zinc-50 p-1">
                  <button
                    onClick={() => setCurrency("brl")}
                    className={`rounded-[0.9rem] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-all ${currency === "brl" ? "bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-200/80" : "text-zinc-500 hover:text-zinc-900"}`}
                    disabled={loadingRedirect}
                  >
                    BRL
                  </button>
                  <button
                    onClick={() => setCurrency("usd")}
                    className={`rounded-[0.9rem] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-all ${currency === "usd" ? "bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-200/80" : "text-zinc-500 hover:text-zinc-900"}`}
                    disabled={loadingRedirect}
                  >
                    USD
                  </button>
                </div>
              </div>
            </div>

            {/* Preço */}
            <div className="px-6 sm:px-8 pt-5 text-center sm:text-left">
              <div className="border-t border-zinc-100 pt-5">
                <div className="flex items-end gap-2 justify-center sm:justify-start">
                  <div className="text-4xl font-black leading-none tracking-tighter text-zinc-950">
                    {formatMoney(activePrice)}
                  </div>
                  <span className="mb-1 text-sm font-semibold text-zinc-500">
                    /{period === "monthly" ? "mês" : "ano"}
                  </span>
                </div>

                {period === "annual" && (
                  <div className="mt-2 text-xs font-medium text-zinc-500">
                    Equivale a <span className="font-semibold text-zinc-900">{formatMoney(monthlyEquivalent)}</span>/mês no plano anual.
                  </div>
                )}

                <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 sm:justify-start">
                  <Check className="h-3 w-3 text-brand-primary" />
                  Cancele quando quiser
                </div>
              </div>
            </div>

            {stepItems.length ? (
              <div className="px-6 sm:px-8 pt-5">
                <div className="border-t border-zinc-100 pt-5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary/8">
                      <ArrowRight className="h-3.5 w-3.5 text-brand-primary" aria-hidden />
                    </span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-primary">
                        Como funciona
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Você continua do ponto em que parou.
                      </p>
                    </div>
                  </div>

                  <ol className={`mt-4 grid gap-2.5 ${stepItems.length === 4 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
                    {stepItems.map((step, index) => (
                      <li
                        key={step}
                        className="rounded-[1rem] bg-zinc-50 px-3.5 py-3"
                      >
                        <div className="flex items-start gap-3">
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-[11px] font-bold text-white">
                            {index + 1}
                          </span>
                          <p className="text-sm font-medium leading-5 text-zinc-700">{step}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : null}

            {/* Benefícios */}
            <div className="px-6 sm:px-8 py-6">
              {!!error && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
                  <p>{error}</p>
                  {errorAction && (
                    <Link href={errorAction.href} className="mt-2 inline-flex border-b border-red-400">
                      {errorAction.label}
                    </Link>
                  )}
                </div>
              )}

              <ul className="grid grid-cols-1 gap-0 border-t border-zinc-100">
                {bulletItems.map((feat) => (
                  <li key={feat} className="flex items-start gap-3 border-b border-zinc-100 px-0 py-3 text-sm transition-all">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-brand-primary/8">
                      <Check className="h-4 w-4 text-brand-primary" />
                    </span>
                    <span className="font-medium text-zinc-700">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Rodapé sticky */}
          <div className="sticky bottom-0 z-10 border-t border-zinc-200/80 bg-white">
            <div className="px-6 sm:px-8 pb-6 pt-5">
              <button
                type="button"
                onClick={() => handleSubscribe()}
                disabled={loadingRedirect || billingStatusLoading || sessionStatus === "loading" || shouldBlockSubscribe}
                className="group/btn inline-flex w-full items-center justify-center rounded-[1.15rem] bg-zinc-950 px-6 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingRedirect ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {sessionStatus === "authenticated" ? "Estabelecendo Conexão..." : "Abrindo Google..."}
                  </>
                ) : (
                  <>
                    {resolvedPrimaryCtaLabel}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </button>

              <p className="mt-3 text-center text-[11px] text-zinc-400">
                Pagamento seguro. Cancele quando quiser.
              </p>
            </div>
          </div>
        </div>

        <style jsx global>{`
          @keyframes fadeIn { from{opacity:0;transform:translateY(15px) scale(.95)} to{opacity:1;transform:translateY(0) scale(1)} }
          @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        `}</style>
      </div>
    );
  }

  return null;
}
