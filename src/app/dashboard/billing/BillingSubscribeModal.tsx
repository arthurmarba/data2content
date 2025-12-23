// src/app/dashboard/billing/BillingSubscribeModal.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Crown, Check, ArrowRight, ArrowUpRight, Loader2, Lock } from "lucide-react";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import type { PaywallContext } from "@/types/paywall";
import { track } from "@/lib/track";
import { buildCheckoutUrl } from "@/app/lib/checkoutRedirect";
import { mapSubscribeError } from "@/app/lib/billing/errors";

interface BillingSubscribeModalProps {
  open: boolean;
  onClose: () => void;
  context?: PaywallContext;
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

// 🎯 Narrativa focada: alertas no WhatsApp + Chat AI na plataforma
const FEATURES: string[] = [
  "Alertas no WhatsApp conectados ao seu Instagram (dúvidas vão para o Chat AI)",
  "Planejamento automático por dia/horário com base na sua performance",
  "Alertas diários com táticas e prioridades do que postar",
  "Receba oportunidades de campanha como um agenciado (sem exclusividade)",
  "Relatório Avançado: categorias, formatos, dias/horas e narrativas de maior engajamento",
  "Cresça engajamento, seguidores e receita com decisões guiadas por dados",
  "Assinatura fixa: agências cobram 10%–30% de comissão, aqui você mantém 100% das publis e continua independente.",
];

type PaywallCopy = {
  title: string;
  subtitle: string;
  bullets: string[];
  ctaLabel: string;
};

const PAYWALL_COPY: Record<PaywallContext | "default", PaywallCopy> = {
  default: {
    title: "Receba alertas e oportunidades diárias no seu WhatsApp",
    subtitle:
      "Ative o Plano Agência para manter alertas no WhatsApp e tirar dúvidas com IA direto no Chat AI da plataforma.",
    bullets: FEATURES,
    ctaLabel: "Ativar Plano Agência",
  },
  reply_email: {
    title: "Responder e receber campanhas faz parte do Plano Agência.",
    subtitle:
      "Receba propostas direto pela plataforma e responda com IA em 1 clique usando a faixa justa automática.",
    bullets: [
      "Campanhas enviadas pela D2C (sem exclusividade)",
      "Diagnóstico do Mobi + faixa justa automática",
      "Templates de resposta com IA e envio direto pela plataforma",
    ],
    ctaLabel: "Desbloquear IA",
  },
  ai_analysis: {
    title: "Análise com IA é Plano Agência.",
    subtitle: "Descubra a faixa justa ideal e receba a recomendação do Mobi em segundos.",
    bullets: ["Faixa justa baseada nas suas métricas", "Sugestão objetiva (aceitar/ajustar/extra)"],
    ctaLabel: "Ativar Plano Agência",
  },
  calculator: {
    title: "Calculadora de Publi faz parte do Plano Agência.",
    subtitle: "Receba faixas de preço estratégicas, justas e premium geradas a partir das suas métricas reais.",
    bullets: ["Faixa estratégica, justa e premium automáticas", "Multiplicadores calibrados pelo seu desempenho"],
    ctaLabel: "Ativar Plano Agência",
  },
  planning: {
    title: "Planejamento com IA é exclusivo do Plano Agência.",
    subtitle: "Descubra o que postar com o planner da IA, libere a área de descobertas da comunidade e receba alertas diários no WhatsApp (dúvidas no Chat AI).",
    bullets: [
      "Planner com horários, formatos e previsões otimizadas",
      "Descoberta da Comunidade com referências e benchmarks do Plano Agência",
      "Mentorias semanais do Grupo VIP para ajustar sua estratégia",
      "Receba oportunidades de campanha e trate como um agenciado sem exclusividade",
      "Alertas no WhatsApp com redirect para o Chat AI",
    ],
    ctaLabel: "Desbloquear Planejamento Plano Agência",
  },
  whatsapp: {
    title: "Conecte os alertas no WhatsApp.",
    subtitle: "WhatsApp = notificações. Para conversar com a IA, use o Chat AI dentro do app.",
    bullets: [
      "Alertas com horários, campanhas e oportunidades",
      "Diagnóstico automático do Instagram",
      "Link rápido para abrir o Chat AI e tirar dúvidas",
    ],
    ctaLabel: "Ativar Plano Agência",
  },
};

const FREE_VS_PRO_ROWS = [
  {
    feature: "Slots inteligentes + alertas personalizados",
    free: false,
    pro: true,
  },
  {
    feature: "Biblioteca de referências (Descoberta)",
    free: false,
    pro: true,
  },
  {
    feature: "Mentorias semanais e alertas no WhatsApp",
    free: false,
    pro: true,
  },
  {
    feature: "Responder propostas com IA + faixa justa",
    free: false,
    pro: true,
  },
];

export default function BillingSubscribeModal({ open, onClose, context }: BillingSubscribeModalProps) {
  const router = useRouter();
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
  const billingStatus = useBillingStatus();
  const billingStatusLoading = Boolean(billingStatus.isLoading);
  const billingStatusError = billingStatus.error;
  const hasPremiumAccess = Boolean(billingStatus.hasPremiumAccess);
  const isTrialActive = Boolean(billingStatus.isTrialActive);
  const needsPaymentAction = Boolean(billingStatus.needsPaymentAction);
  const needsCheckout = Boolean(billingStatus.needsCheckout);
  const needsAbort = Boolean(billingStatus.needsAbort);
  const needsPaymentUpdate = Boolean(billingStatus.needsPaymentUpdate);
  const billingNormalizedStatus = billingStatus.normalizedStatus ?? null;
  const refetchBillingStatus = billingStatus.refetch;
  const effectiveContext = context ?? "default";
  const paywallCopy = PAYWALL_COPY[effectiveContext] ?? PAYWALL_COPY.default;
  const bulletItems = paywallCopy.bullets && paywallCopy.bullets.length > 0 ? paywallCopy.bullets : FEATURES;
  const primaryCtaLabel = paywallCopy.ctaLabel || "Ativar Plano Agência";
  const isDefaultContext = effectiveContext === "default";
  const shouldBlockSubscribe =
    !billingStatusError && (hasPremiumAccess || isTrialActive || needsPaymentAction);
  const didRefetchRef = useRef(false);

  // Fecha com ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Trava o scroll da página quando o modal está aberto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Ajusta moeda padrão pelo locale do usuário
  useEffect(() => {
    if (!open) return;
    try {
      const lang = (typeof navigator !== "undefined" && navigator.language) || "";
      if (/^pt(-|$)/i.test(lang)) setCurrency("brl");
      else setCurrency("usd");
    } catch {
      /* no-op */
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
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
  }, [open, effectiveContext, billingNormalizedStatus]);

  useEffect(() => {
    if (!open) {
      didRefetchRef.current = false;
      return;
    }
    if (didRefetchRef.current) return;
    didRefetchRef.current = true;
    refetchBillingStatus?.();
  }, [open, refetchBillingStatus]);

  useEffect(() => {
    if (!open) return;

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
  }, [open]);

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
    if (!open) return;

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
  }, [open, loadPrices]);

  // Fecha ao clicar no overlay
  const handleOverlay = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
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

  /** Dispara o fluxo de assinatura (Checkout hospedado ou Payment Element). */
  const handleSubscribe = async () => {
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
        successUrl: `${window.location.origin}/dashboard/billing/success`,
        cancelUrl: `${window.location.origin}/dashboard/billing`,
        source: "modal",
      };

      const response = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));

      if (response.status === 401) {
        // Redireciona para login se não estiver autenticado
        const callbackUrl = encodeURIComponent(window.location.href);
        window.location.href = `/login?callbackUrl=${callbackUrl}`;
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
      onClose();

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
      setLoadingRedirect(false); // Só para o loading se der erro, se der sucesso vai navegar
    }
  };

  // -------------------- RENDER --------------------

  if (!open) return null;

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
          className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 overflow-hidden animate-[fadeIn_160ms_ease-out] flex flex-col max-h-[92vh] sm:max-h-[90vh]"
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
                onClick={onClose}
                aria-label="Fechar"
                data-autofocus="true"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-4">
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
                onClick={onClose}
                aria-label="Fechar"
                data-autofocus="true"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => void loadPrices()}
                className="inline-flex items-center justify-center rounded-md bg-gray-900 hover:bg-gray-800 px-5 py-2.5 text-sm font-semibold text-white"
              >
                Tentar novamente
              </button>
              <button
                onClick={onClose}
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
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm px-3 sm:px-4 py-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="subscribe-modal-title"
        onClick={handleOverlay}
      >
        <div
          ref={dialogRef}
          className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 overflow-hidden animate-[fadeIn_160ms_ease-out] flex flex-col max-h-[92vh] sm:max-h-[90vh]"
          tabIndex={-1}
        >
          {/* Header sticky: X sempre visível */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur">
            <div className="relative border-b border-gray-200">
              <div className="absolute inset-0 opacity-15 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-indigo-500" />
              <div className="relative flex items-start gap-3 p-5 sm:p-6">
                <div className="shrink-0 rounded-lg bg-pink-100 p-2">
                  <Crown className="w-5 h-5 text-pink-600" />
                </div>
                <div className="flex-1">
                  <h2 id="subscribe-modal-title" className="text-lg sm:text-xl font-bold text-gray-900">
                    {paywallCopy.title}
                  </h2>
                  <p className="mt-1 text-sm text-gray-700">{paywallCopy.subtitle}</p>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Fechar"
                  className="rounded-full p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  data-autofocus="true"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Conteúdo rolável */}
          <div className="flex-1 overflow-y-auto">
            {/* Seletores */}
            <div className="px-5 sm:px-6 pt-4 sm:pt-5 border-t border-gray-100">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
                <div className="inline-flex rounded-md p-1 bg-gray-100">
                  <button
                    onClick={() => setPeriod("monthly")}
                    className={`px-3 py-1.5 text-sm font-medium rounded ${period === "monthly" ? "bg-white shadow text-gray-900" : "text-gray-600"}`}
                    disabled={loadingRedirect}
                  >
                    Mensal
                  </button>
                  <button
                    onClick={() => setPeriod("annual")}
                    className={`px-3 py-1.5 text-sm font-medium rounded ${period === "annual" ? "bg-white shadow text-gray-900" : "text-gray-600"}`}
                    disabled={loadingRedirect}
                  >
                    Anual {savingsPct > 0 && <span className="ml-1 text-emerald-600 font-semibold">- {savingsPct}%</span>}
                  </button>
                </div>

                <div className="inline-flex rounded-md p-1 bg-gray-100">
                  <button
                    onClick={() => setCurrency("brl")}
                    className={`px-3 py-1.5 text-sm font-medium rounded ${currency === "brl" ? "bg-white shadow text-gray-900" : "text-gray-600"}`}
                    disabled={loadingRedirect}
                  >
                    BRL
                  </button>
                  <button
                    onClick={() => setCurrency("usd")}
                    className={`px-3 py-1.5 text-sm font-medium rounded ${currency === "usd" ? "bg-white shadow text-gray-900" : "text-gray-600"}`}
                    disabled={loadingRedirect}
                  >
                    USD
                  </button>
                </div>
              </div>
            </div>

            {/* Preço */}
            <div className="px-5 sm:px-6 pt-3">
              <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                <div className="flex items-end gap-2">
                  <div className="text-3xl font-extrabold text-gray-900 leading-none">
                    {formatMoney(activePrice)}
                  </div>
                  <span className="text-sm text-gray-600 mb-1">
                    /{period === "monthly" ? "mês" : "ano"}
                  </span>
                </div>

                {period === "annual" && (
                  <div className="mt-1 text-xs text-gray-700">
                    Equivale a <span className="font-semibold">{formatMoney(monthlyEquivalent)}</span> por mês
                  </div>
                )}

                {period === "annual" && savingsPct > 0 && (
                  <div className="mt-1 text-xs text-emerald-700">
                    Economize ~{savingsPct}% comparado ao plano mensal
                  </div>
                )}

                <div className="mt-1 text-xs text-gray-600">
                  Pagamento seguro via Stripe. Sem fidelidade — cancele quando quiser.
                </div>
              </div>
            </div>

            {/* Benefícios */}
            <div className="px-5 sm:px-6 py-4">
              {!!error && (
                <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <p>{error}</p>
                  {errorAction && (
                    <Link href={errorAction.href} className="mt-1 inline-flex text-xs font-semibold text-pink-600">
                      {errorAction.label}
                    </Link>
                  )}
                </div>
              )}

              <ul
                className={`grid grid-cols-1 ${bulletItems.length > 2 ? "sm:grid-cols-2" : ""} gap-2.5`}
              >
                {bulletItems.map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    </span>
                    <span className="text-gray-700">{feat}</span>
                  </li>
                ))}
              </ul>

            </div>
          </div>

          {/* Rodapé sticky (CTA sempre visível) */}
          <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur border-t border-gray-200">
            <div className="px-5 sm:px-6 pb-4 pt-3">
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={loadingRedirect || billingStatusLoading || shouldBlockSubscribe}
                className="w-full inline-flex items-center justify-center rounded-md bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-pink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loadingRedirect ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redirecionando…
                  </>
                ) : (
                  <>
                    {primaryCtaLabel}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  track("dashboard_cta_clicked", {
                    creator_id: null,
                    target: "activate_pro",
                    surface: "upsell_block",
                    context: "learn_more",
                  });
                  window.open("/pro", "_blank", "noopener,noreferrer");
                }}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                Conhecer o Plano Agência
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>

              <p className="mt-3 text-center text-[11px] text-gray-500">
                Dúvidas? Fale com a gente em{" "}
                <a
                  href="mailto:arthur@data2content.ai"
                  className="font-medium text-gray-700 underline decoration-gray-300 underline-offset-2 hover:text-gray-900"
                >
                  arthur@data2content.ai
                </a>
              </p>
              <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-gray-500">
                <Lock className="h-3 w-3" aria-hidden />
                Só leitura: conectamos para analisar, não publicamos por você e você pode revogar quando quiser.
              </p>
              {(hasPremiumAccess || isTrialActive) && !billingStatusLoading && (
                <p className="mt-2 text-center text-xs text-gray-600">
                  Você já possui um plano ativo ou em período de teste.
                </p>
              )}
              {needsPaymentUpdate && !billingStatusLoading && (
                <p className="mt-2 text-center text-xs text-amber-700">
                  Existe um pagamento pendente. Atualize o método de pagamento em Billing.
                </p>
              )}
              {needsCheckout && !billingStatusLoading && (
                <p className="mt-2 text-center text-xs text-amber-700">
                  Existe um checkout pendente. Retome ou aborte a tentativa em Billing.
                </p>
              )}
              {needsAbort && !billingStatusLoading && (
                <p className="mt-2 text-center text-xs text-amber-700">
                  Tentativa expirada. Voce pode iniciar um novo checkout agora.
                </p>
              )}
              {billingStatusError && !billingStatusLoading && (
                <p className="mt-2 text-center text-xs text-amber-700">
                  Nao foi possivel validar seu status.{" "}
                  <button
                    type="button"
                    onClick={() => billingStatus.refetch?.()}
                    className="underline underline-offset-2"
                  >
                    Atualizar status
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>

        <style jsx global>{`
          @keyframes fadeIn { from{opacity:0;transform:translateY(8px) scale(.98)} to{opacity:1;transform:translateY(0) scale(1)} }
        `}</style>
      </div>
    );
  }

  // fallback defensivo
  return null;
}
