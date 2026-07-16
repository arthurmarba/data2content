// src/app/dashboard/billing/BillingSubscribeModal.tsx
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Check, ArrowRight, Loader2 } from "lucide-react";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import type { PaywallContext } from "@/types/paywall";
import { track } from "@/lib/track";
import { redirectToGoogleConsentLogin } from "@/lib/auth/googleLogin";
import { buildCheckoutUrl } from "@/app/lib/checkoutRedirect";
import { mapSubscribeError } from "@/app/lib/billing/errors";
import { useBodyScrollLock } from "@/lib/a11y";
import { d2cFontVariables } from "@/app/fonts/d2cFonts";
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

// 🎯 Proposta de valor central do Pro — usada pelo contexto "default"
const FEATURES: string[] = [
  "Clareza sobre o que funciona — com dados reais do Instagram",
  "Pautas prontas na sua voz, no WhatsApp",
  "Criadores indicados pra collab com a sua narrativa",
  "Reunião semanal da comunidade, ao vivo",
  "Mídia Kit com vitrine no Marketplace",
];

type PaywallCopy = {
  title: string;
  subtitle: string;
  bullets: string[];
  ctaLabel: string;
  steps?: string[];
  /** Frase curta de ancoragem mostrada logo abaixo do preço — traduz o custo em
   *  algo concreto pro criador (ex.: "uma publi paga meses"). Opcional. */
  priceAnchor?: string;
};

const PAYWALL_COPY: Record<PaywallContext | "default", PaywallCopy> = {
  default: {
    title: "Você não está mais criando conteúdo sozinho.",
    subtitle: "Pautas na sua voz, collabs e uma comunidade toda semana. Seu parceiro de conteúdo, todo dia.",
    bullets: FEATURES,
    ctaLabel: "Assinar Pro",
    priceAnchor: "Menos que o preço de uma publi — por mês inteiro de parceria.",
  },
  reply_email: {
    title: "IA de Negociação",
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
    title: "IA de Negociação",
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
    title: "Precificação Estratégica",
    subtitle: "Valores calibrados para atrair as marcas que você realmente quer.",
    bullets: [
      "Faixas estratégicas (Justo, Influencer e Premium)",
      "Multiplicadores auditados pelo time D2C",
    ],
    ctaLabel: "Assinar Pro",
    priceAnchor: "Uma única publi no preço certo paga meses de assinatura.",
    steps: [
      "Ative sua assinatura",
      "Conecte seu Instagram",
      "Volte para liberar sua precificação",
    ],
  },
  media_kit: {
    title: "Mídia Kit Profissional",
    subtitle: "Gere seu link único com métricas auditadas e sincronizadas automaticamente.",
    bullets: [
      "Dados reais do Instagram (Alcance, Engajamento, etc)",
      "Sugestões de faixas de preço baseadas em performance",
      "Vitrine exclusiva no Marketplace Destaque",
    ],
    ctaLabel: "Assinar Pro",
    steps: [
      "Ative sua assinatura",
      "Conecte seu Instagram",
      "Volte para liberar seu Mídia Kit",
    ],
  },
  publis: {
    title: "Biblioteca de Publis",
    subtitle: "Organize suas parcerias e compartilhe métricas ao vivo com marcas.",
    bullets: [
      "Histórico completo de conteúdos publicitários",
      "Compartilhamento de resultados via link",
      "Filtros inteligentes por desempenho e data",
    ],
    ctaLabel: "Assinar Pro",
    steps: [
      "Ative sua assinatura",
      "Conecte seu Instagram",
      "Volte para liberar suas publis",
    ],
  },
  onboarding: {
    title: "Seu mapa começou.",
    subtitle: "Ideias prontas, criadores para collab e clareza sobre o que funciona.",
    bullets: [
      "Clareza sobre o que funciona — com dados reais do Instagram",
      "Pautas prontas na sua voz, no WhatsApp",
      "Criadores indicados pra collab com a sua narrativa",
      "Reunião semanal da comunidade, ao vivo",
    ],
    ctaLabel: "Assinar agora",
  },
  narrative_map: {
    title: "Seu mapa está tomando forma.",
    subtitle: "Ideias prontas, criadores para collab e clareza sobre o que funciona.",
    bullets: [
      "Clareza sobre o que funciona — com dados reais do Instagram",
      "Pautas prontas na sua voz, no WhatsApp",
      "Criadores indicados pra collab com a sua narrativa",
      "Reunião semanal da comunidade, ao vivo",
    ],
    ctaLabel: "Ativar Pro",
  },
  mentoria: {
    title: "Você não cria sozinho.",
    subtitle:
      "Toda semana a comunidade se reúne ao vivo pra ler conteúdo junto e ajustar a estratégia de imagem de cada um — e as pautas chegam pelo WhatsApp.",
    bullets: [
      "Reunião semanal da comunidade, ao vivo",
      "Criadores indicados pra collab com a sua narrativa",
      "Clareza sobre o que funciona — com dados reais do Instagram",
      "Pautas prontas na sua voz, no WhatsApp",
    ],
    ctaLabel: "Assinar Pro e entrar",
    steps: [
      "Ative sua assinatura",
      "Entre na comunidade",
      "Acesse a agenda da reunião semanal",
    ],
  },
  planning: {
    title: "Nunca mais trave no \"o que eu posto hoje?\"",
    subtitle:
      "Cada pauta nasce do que você já posta, na sua voz. Você abre o app e já tem o próximo conteúdo esperando — sem partir do zero.",
    bullets: [
      "Ideias geradas a partir do que você já posta",
      "Pautas entregues pelo WhatsApp no momento certo",
      "Dados reais do Instagram para calibrar timing e formato",
    ],
    ctaLabel: "Assinar Pro",
    priceAnchor: "Menos que o preço de uma publi — por um mês inteiro de pautas.",
    steps: [
      "Ative sua assinatura",
      "Conecte seu Instagram",
      "Receba suas primeiras pautas pelo WhatsApp",
    ],
  },
  whatsapp: {
    title: "Seu conteúdo chega até você.",
    subtitle:
      "Uma mensagem por semana com pautas prontas na sua voz, criadores para collab e o que está surgindo no seu perfil. Você não precisa lembrar de voltar — a gente te chama.",
    bullets: [
      "Ideias de pauta prontas na sua voz, toda semana",
      "Criador disponível para collab quando fizer sentido",
      "O que está surgindo no seu conteúdo para você validar",
    ],
    ctaLabel: "Assinar Pro",
    priceAnchor: "Menos que o preço de uma publi — por um mês inteiro de parceria.",
    steps: [
      "Ative sua assinatura",
      "Conecte seu Instagram",
      "Receba seu primeiro resumo semanal",
    ],
  },
};

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
  
  // O modal responde ao motivo que o abriu; o stack completo não compete com a decisão.
  const contextCopy = PAYWALL_COPY[effectiveContext] ?? PAYWALL_COPY.default;
  const paywallCopy = contextCopy;
  const valueBullets = (contextCopy.bullets.length > 0 ? contextCopy.bullets : FEATURES).slice(0, 3);
  const priceAnchor = contextCopy.priceAnchor ?? null;
  const primaryCtaLabel = contextCopy.ctaLabel || "Assinar e continuar";
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
        className={`d2c-mobile-app ${d2cFontVariables} fixed inset-0 z-[200] flex items-end justify-center ds-scrim overflow-y-auto px-0 pb-0 sm:items-center sm:px-4 sm:py-4`}
        role="dialog"
        aria-modal="true"
        aria-label="Carregando preços"
        onClick={handleOverlay}
      >
        <div
          ref={dialogRef}
          className="ds-paywall animate-[fadeIn_160ms_ease-out] flex flex-col"
          tabIndex={-1}
        >
          {/* Header sticky */}
          <div className="sticky top-0 z-10 border-b border-[var(--ds-color-line)] bg-[var(--ds-color-surface)]">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4">
              <h2 className="font-display text-xl font-bold tracking-[-0.035em] text-zinc-950">Preparando seu Pro</h2>
              <button
                className="ds-icon-button !h-11 !w-11"
                onClick={closeModal}
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="dashboard-scrollbar flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-4">
            <div className="relative h-8 w-40 overflow-hidden rounded-lg bg-[var(--ds-color-neutral)]">
              <span className="absolute inset-0 animate-[shimmer_1.2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            </div>
            <div className="relative h-10 w-full rounded-xl bg-[var(--ds-color-neutral)]" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="relative h-12 rounded-xl bg-[var(--ds-color-neutral)]" />
              <div className="relative h-12 rounded-xl bg-[var(--ds-color-neutral)]" />
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
        className={`d2c-mobile-app ${d2cFontVariables} fixed inset-0 z-[200] flex items-end justify-center ds-scrim overflow-y-auto px-0 pb-0 sm:items-center sm:px-4 sm:py-4`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-error-title"
        onClick={handleOverlay}
      >
        <div
          ref={dialogRef}
          className="ds-paywall animate-[fadeIn_160ms_ease-out] flex flex-col"
          tabIndex={-1}
        >
          {/* Header sticky com X sempre visível */}
          <div className="sticky top-0 z-10 border-b border-[var(--ds-color-line)] bg-[var(--ds-color-surface)]">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4">
              <h2 id="billing-error-title" className="font-display text-xl font-bold tracking-[-0.035em] text-zinc-950">
                Não foi possível carregar o Pro
              </h2>
              <button
                className="ds-icon-button !h-11 !w-11"
                onClick={closeModal}
                aria-label="Fechar"
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
                className="ds-button ds-button--primary"
              >
                Tentar novamente
              </button>
              <button
                onClick={closeModal}
                className="ds-button ds-button--quiet"
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
        className={`d2c-mobile-app ${d2cFontVariables} fixed inset-0 z-[200] flex items-end justify-center ds-scrim overflow-y-auto px-0 pb-0 sm:items-center sm:px-4 sm:py-4`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="subscribe-modal-title"
        onClick={handleOverlay}
      >
        <div
          ref={dialogRef}
          className="ds-paywall animate-[fadeIn_180ms_ease-out] flex flex-col"
          tabIndex={-1}
        >
          {/* Header sticky */}
          <div className="sticky top-0 z-10 bg-[var(--ds-color-surface)]">
            <div className="px-6 pb-5 pt-5">
              {/* Badge + fechar */}
              <div className="flex items-center justify-between gap-3 mb-4">
                <span className="ds-eyebrow">Data2Content Pro</span>
                <button
                  onClick={closeModal}
                  aria-label="Fechar"
                  className="ds-icon-button !h-11 !w-11"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {/* Título + subtítulo */}
              <h2 id="subscribe-modal-title" className="font-display text-[2.1rem] font-bold tracking-[-0.05em] leading-[0.96] text-zinc-950">
                {paywallCopy.title}
              </h2>
              <p className="mt-2 text-[13px] leading-[1.55] text-zinc-500">
                {paywallCopy.subtitle}
              </p>
            </div>
          </div>

          <div className="dashboard-scrollbar flex-1 overflow-y-auto">
            {/* Zona de preço */}
            <div className="px-6 pb-5 pt-1">
              <div className="flex items-baseline gap-1.5">
                <div className="font-display text-[3rem] font-bold leading-none tracking-[-0.055em] text-zinc-950">
                  {period === "annual" ? formatMoney(monthlyEquivalent) : formatMoney(activePrice)}
                </div>
                <span className="text-sm font-medium text-zinc-400">/mês</span>
              </div>

              {period === "annual" && (
                <div className="mt-1.5 text-[12px] text-zinc-400">
                  cobrado anualmente · <span className="font-semibold text-zinc-500">{formatMoney(activePrice)}/ano</span>
                </div>
              )}

              {/* Âncora de preço — traduz o custo em algo concreto pro criador.
                  Condicionada ao contexto (ex.: na calculadora, "uma publi paga meses"). */}
              {priceAnchor && (
                <p className="mt-2 text-[12.5px] font-medium leading-snug text-zinc-600">
                  {priceAnchor}
                </p>
              )}

              {/* Seletores — período + moeda na mesma linha */}
              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="ds-paywall__toggle">
                  <button
                    type="button"
                    onClick={() => setPeriod("monthly")}
                    className="ds-paywall__toggle-option"
                    aria-pressed={period === "monthly"}
                    disabled={loadingRedirect}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod("annual")}
                    className="ds-paywall__toggle-option"
                    aria-pressed={period === "annual"}
                    disabled={loadingRedirect}
                  >
                    Anual {savingsPct > 0 && <span className="ml-1 text-[var(--ds-color-brand-strong)]">-{savingsPct}%</span>}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrency(currency === "brl" ? "usd" : "brl")}
                  disabled={loadingRedirect}
                  className="min-h-11 text-xs font-semibold text-[var(--ds-color-brand-strong)] underline-offset-2 transition-colors hover:underline disabled:opacity-50"
                >
                  {currency === "brl" ? "Ver em USD" : "Ver em BRL"}
                </button>
              </div>
            </div>

            {/* Três razões contextuais — uma decisão, sem catálogo de features. */}
            <div className="px-6 pb-6 pt-2">
              {hasPremiumAccess && !billingStatusLoading && !billingStatusError && (
                <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
                  Você já tem o Pro ativo. Se algo não está funcionando, tente recarregar a página.
                </div>
              )}
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

              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ds-color-brand-strong)]">Incluído no Pro</p>
              <ul className="grid gap-3">
                {valueBullets.map((feat) => (
                  <li key={feat} className="flex items-start gap-3 border-b border-[var(--ds-color-line)] pb-3 last:border-0 last:pb-0">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--ds-color-brand-soft)]">
                      <Check className="h-3.5 w-3.5 text-[var(--ds-color-brand-strong)]" strokeWidth={2.5} />
                    </span>
                    <span className="text-[13px] font-medium leading-[1.5] text-zinc-800">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Rodapé sticky */}
          <div className="sticky bottom-0 z-10 border-t border-[var(--ds-color-line)] bg-[var(--ds-color-surface)]">
            <div className="px-6 pb-6 pt-4">
              <button
                type="button"
                onClick={() => handleSubscribe()}
                disabled={loadingRedirect || billingStatusLoading || sessionStatus === "loading" || shouldBlockSubscribe}
                className="ds-button ds-button--primary ds-button--block group/btn"
                data-autofocus="true"
                data-analytics-name="activate_subscription"
                data-analytics-section="billing_subscribe_modal"
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

              {/* CTA secundário: apenas no contexto onboarding.
                  Nomeado pelo benefício ("Explorar grátis primeiro"),
                  nunca "Fechar" ou "Pular" — conforme regra do produto. */}
              {effectiveContext === "onboarding" && (
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={loadingRedirect}
                  className="ds-button ds-button--ghost ds-button--block mt-2"
                >
                  <p className="text-[14px] font-semibold">Explorar grátis primeiro</p>
                  <ArrowRight className="h-4 w-4 text-zinc-400" />
                </button>
              )}
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
