// src/app/dashboard/billing/BillingSubscribeModal.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Crown, Check, ArrowRight, ArrowUpRight, Loader2, Lock } from "lucide-react";
import { FaLock } from "react-icons/fa";
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

// 🎯 Narrativa focada: ferramentas de execução (roteiros/review) + alertas no WhatsApp
const FEATURES: string[] = [
  "Mídia kit auditado + vitrine no marketplace",
  "Review de posts com vereditos antes de publicar",
  "Meus Roteiros com IA para planejar e publicar",
  "Negociação assistida por IA + precificação inteligente",
  "Mentorias semanais e alertas no WhatsApp",
  "Assinatura fixa: 0% de comissão nas publis",
];

type PaywallCopy = {
  title: string;
  subtitle: string;
  bullets: string[];
  ctaLabel: string;
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
    title: "Negociação Assistida (IA)",
    subtitle:
      "Use a inteligência da agência para responder marcas com o tom de voz e precificação certa.",
    bullets: [
      "Inbox estratégico (foco em conversão)",
      "Resposta assistida por IA (Narrativa D2C)",
      "Faixa justa auditada pela agência",
    ],
    ctaLabel: "Ativar Acesso VIP",
  },
  ai_analysis: {
    title: "Mapeamento IA + Agência",
    subtitle: "Descubra seu valor real de mercado e como atrair marcas de alto ticket.",
    bullets: [
      "Faixa justa baseada em performance real",
      "Recomendação tática (Narrativa vs Mercado)",
    ],
    ctaLabel: "Ativar Acesso VIP",
  },
  calculator: {
    title: "Precificação Inteligente (Radar Destaque)",
    subtitle: "Valores calibrados para atrair as marcas que você realmente quer.",
    bullets: [
      "Faixas estratégicas (Justo, Influencer e Premium)",
      "Multiplicadores auditados pelo time D2C",
    ],
    ctaLabel: "Ativar Acesso VIP",
  },
  planning: {
    title: "Planejamento Estratégico & Narrative",
    subtitle:
      "Mantenha a pauta alinhada com as revisões semanais e atraia marcas organicamente.",
    bullets: [
      "Planner com horários e pautas estratégicas",
      "Alertas de timing no WhatsApp",
      "Sincronização com revisões de Terça/Quinta",
    ],
    ctaLabel: "Ativar Acesso VIP",
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
  const primaryCtaLabel = paywallCopy.ctaLabel || "Ativar Plano Pro";
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
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md px-3 sm:px-4 py-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="subscribe-modal-title"
        onClick={handleOverlay}
      >
        <div
          ref={dialogRef}
          className="w-full max-w-lg rounded-[2.5rem] bg-[#0A0F1A] text-white shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5 overflow-hidden animate-[fadeIn_160ms_ease-out] flex flex-col max-h-[92vh] sm:max-h-[90vh]"
          tabIndex={-1}
        >
          {/* Header sticky */}
          <div className="sticky top-0 z-10 bg-[#0A0F1A]/95 backdrop-blur-xl">
            <div className="relative border-b border-white/5">
              <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-[#6E1F93] via-[#F6007B] to-[#6E1F93] blur-3xl -z-10" />
              <div className="relative flex items-start gap-4 p-6 sm:p-8">
                <div className="shrink-0 rounded-2xl bg-brand-primary/10 p-3 border border-brand-primary/20">
                  <Crown className="w-6 h-6 text-brand-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center rounded-full bg-brand-primary/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-brand-primary">
                      Acesso Consultivo
                    </span>
                    <span className="bg-emerald-500/10 text-emerald-500 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/20">
                      ÚLTIMAS VAGAS
                    </span>
                  </div>
                  <h2 id="subscribe-modal-title" className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
                    {paywallCopy.title}
                  </h2>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed font-medium">
                    {paywallCopy.subtitle}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Fechar"
                  className="rounded-full p-2 text-slate-500 hover:text-white hover:bg-white/5 transition-all"
                  data-autofocus="true"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Seletores */}
            <div className="px-6 sm:px-8 pt-6">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="inline-flex rounded-2xl p-1 bg-white/5 border border-white/5">
                  <button
                    onClick={() => setPeriod("monthly")}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${period === "monthly" ? "bg-white text-slate-900 shadow-xl" : "text-slate-500 hover:text-slate-300"}`}
                    disabled={loadingRedirect}
                  >
                    Mensal
                  </button>
                  <button
                    onClick={() => setPeriod("annual")}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${period === "annual" ? "bg-white text-slate-900 shadow-xl" : "text-slate-500 hover:text-slate-300"}`}
                    disabled={loadingRedirect}
                  >
                    Anual {savingsPct > 0 && <span className="ml-1 text-emerald-400">-{savingsPct}%</span>}
                  </button>
                </div>

                <div className="inline-flex rounded-2xl p-1 bg-white/5 border border-white/5">
                  <button
                    onClick={() => setCurrency("brl")}
                    className={`px-3 py-2 text-[10px] font-black rounded-xl transition-all ${currency === "brl" ? "bg-white/10 text-white" : "text-slate-500"}`}
                    disabled={loadingRedirect}
                  >
                    BRL
                  </button>
                  <button
                    onClick={() => setCurrency("usd")}
                    className={`px-3 py-2 text-[10px] font-black rounded-xl transition-all ${currency === "usd" ? "bg-white/10 text-white" : "text-slate-500"}`}
                    disabled={loadingRedirect}
                  >
                    USD
                  </button>
                </div>
              </div>
            </div>

            {/* Preço */}
            <div className="px-6 sm:px-8 pt-5 text-center sm:text-left">
              <div className="rounded-[2rem] border border-white/5 p-6 bg-gradient-to-br from-white/[0.03] to-transparent shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <FaLock className="w-12 h-12 text-white" />
                </div>
                <div className="flex items-end gap-2 justify-center sm:justify-start">
                  <div className="text-4xl font-black text-white leading-none tracking-tighter">
                    {formatMoney(activePrice)}
                  </div>
                  <span className="text-sm text-slate-500 mb-1 font-bold">
                    /{period === "monthly" ? "mês" : "ano"}
                  </span>
                </div>

                {period === "annual" && (
                  <div className="mt-2 text-xs text-slate-400 font-medium">
                    Investimento de <span className="text-white font-bold">{formatMoney(monthlyEquivalent)}</span>/mês para sua imagem.
                  </div>
                )}

                <div className="mt-2 text-[10px] text-slate-500 uppercase font-black tracking-widest flex items-center justify-center sm:justify-start gap-2">
                  <Check className="w-3 h-3 text-emerald-500" />
                  Cancelamento instantâneo via Stripe
                </div>
              </div>
            </div>

            {/* Benefícios */}
            <div className="px-6 sm:px-8 py-6">
              {!!error && (
                <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-400">
                  <p>{error}</p>
                  {errorAction && (
                    <Link href={errorAction.href} className="mt-2 inline-flex border-b border-red-400">
                      {errorAction.label}
                    </Link>
                  )}
                </div>
              )}

              <ul className="grid grid-cols-1 gap-3">
                {bulletItems.map((feat) => (
                  <li key={feat} className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm group hover:border-brand-primary/20 transition-all">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-brand-primary/10 border border-brand-primary/20 group-hover:scale-110 transition-transform">
                      <Check className="h-4 w-4 text-brand-primary" />
                    </span>
                    <span className="text-slate-300 font-medium">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Rodapé sticky */}
          <div className="sticky bottom-0 z-10 bg-[#0A0F1A]/95 backdrop-blur-xl border-t border-white/5">
            <div className="px-6 sm:px-8 pb-8 pt-5">
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={loadingRedirect || billingStatusLoading || shouldBlockSubscribe}
                className="w-full relative overflow-hidden group/btn inline-flex items-center justify-center rounded-2xl bg-white text-[#0A0F1A] px-6 py-4 text-sm font-black uppercase tracking-widest shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent -translate-x-full group-hover/btn:animate-shimmer" />
                {loadingRedirect ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Estabelecendo Conexão...
                  </>
                ) : (
                  <>
                    {primaryCtaLabel}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </button>

              <div className="mt-4 flex flex-col items-center gap-2">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                  <Lock className="w-3 h-3" />
                  Ambiente Seguro SSL-Criptografado
                </p>
                <div className="flex items-center gap-3 opacity-30 grayscale contrast-125">
                  {/* Simplified representation of payment logos */}
                  <div className="w-8 h-5 bg-slate-500 rounded-sm" />
                  <div className="w-8 h-5 bg-slate-500 rounded-sm" />
                  <div className="w-8 h-5 bg-slate-500 rounded-sm" />
                </div>
              </div>

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
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/5 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-400 transition hover:text-white"
              >
                Conhecer a Narrativa D2C
                <ArrowUpRight className="h-4 w-4" />
              </button>

              <p className="mt-4 text-center text-[10px] text-slate-600 font-medium">
                © 2024 Data2Content & Destaque Imagem. Todos os direitos reservados.
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
