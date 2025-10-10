// src/app/dashboard/billing/BillingSubscribeModal.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Crown, Check, Sparkles, Shield, ArrowRight, Loader2 } from "lucide-react";
import useBillingStatus from "@/app/hooks/useBillingStatus";

interface BillingSubscribeModalProps {
  open: boolean;
  onClose: () => void;
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

// 🎯 Narrativa focada: IA no WhatsApp + Relatório Avançado
const FEATURES: string[] = [
  "IA no WhatsApp conectada ao seu Instagram",
  "Planejamento automático por dia/horário com base na sua performance",
  "Alertas diários com táticas e prioridades do que postar",
  "Relatório Avançado: categorias, formatos, dias/horas e narrativas de maior engajamento",
  "Cresça engajamento, seguidores e receita com decisões guiadas por dados",
];

export default function BillingSubscribeModal({ open, onClose }: BillingSubscribeModalProps) {
  const [prices, setPrices] = useState<PricesShape | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingRedirect, setLoadingRedirect] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  // UI state
  const [period, setPeriod] = useState<"monthly" | "annual">("annual"); // ✅ anual como padrão
  const [currency, setCurrency] = useState<"brl" | "usd">("brl");
  const dialogRef = useRef<HTMLDivElement>(null);
  const { isLoading: billingStatusLoading, hasPremiumAccess } = useBillingStatus();

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

  /**
   * REDIRECIONA PARA STRIPE CHECKOUT
   * 1) tenta /api/billing/checkout/trial  -> { url }
   * 2) fallback /api/billing/subscribe    -> { checkoutUrl } ou { url }
   */
  const handleSubscribe = async () => {
    setError(null);
    setLoadingRedirect(true);
    try {
      if (hasPremiumAccess) {
        throw new Error("Você já possui um plano ativo ou em teste.");
      }
      const payload = {
        plan: period,              // "monthly" | "annual"
        currency,                  // "brl" | "usd"
        mode: "subscription",
        successUrl: `${window.location.origin}/dashboard/billing/success`,
        cancelUrl: `${window.location.origin}/dashboard/billing`,
        source: "modal",
      };

      // 1) checkout com trial (principal)
      let url: string | null = null;
      let r1: Response | null = null;
      try {
        r1 = await fetch("/api/billing/checkout/trial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch { /* segue pro fallback */ }

      if (r1) {
        const b1 = await r1.json().catch(() => ({}));
        if (r1.status === 409) {
          throw new Error(b1?.message || "Você já possui um plano ativo ou em teste.");
        }
        if (r1.ok) {
          url = b1?.url || null;
        }
      }

      // 2) fallback: rota de subscribe (também pode devolver uma checkout session)
      if (!url) {
        const r2 = await fetch("/api/billing/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (r2.ok) {
          const b2 = await r2.json().catch(() => ({}));
          url = b2?.checkoutUrl || b2?.url || null;
        }
      }

      if (!url) {
        throw new Error("Não foi possível iniciar o checkout. Tente novamente em instantes.");
      }

      window.location.href = url; // redireciona para o Stripe
    } catch (e: any) {
      setError(e?.message || "Erro ao redirecionar para o checkout.");
      setLoadingRedirect(false);
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
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 overflow-hidden animate-[fadeIn_160ms_ease-out] flex flex-col max-h-[92vh] sm:max-h-[90vh]">
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
                    Tenha seu estrategista de conteúdo no WhatsApp
                  </h2>
                  <p className="mt-1 text-sm text-gray-700">
                    A IA conectada ao seu Instagram interpreta sua performance, planeja conteúdos e envia
                    <strong> alertas diários no WhatsApp</strong> com o que postar e por quê.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Fechar"
                  className="rounded-full p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
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
                  7 dias grátis no começo. Cancele quando quiser.
                </div>
              </div>
            </div>

            {/* Benefícios */}
            <div className="px-5 sm:px-6 py-4">
              {!!error && (
                <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {FEATURES.map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    </span>
                    <span className="text-gray-700">{feat}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 rounded-lg border border-gray-200 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <Sparkles className="w-4 h-4 text-pink-500" />
                  Para vender e para crescer
                </div>
                <p className="mt-1.5 text-xs text-gray-600">
                  Com o <strong>relatório gratuito</strong> você se apresenta melhor às marcas. Com o{" "}
                  <strong>Relatório Avançado + IA estrategista</strong>, você aumenta engajamento, ganha mais seguidores e
                  fatura mais.
                </p>
              </div>

              <div className="mt-3 mb-2 rounded-lg border border-gray-200 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <Shield className="w-4 h-4 text-indigo-500" />
                  Assine sem risco
                </div>
                <p className="mt-1.5 text-xs text-gray-600">
                  7 dias grátis. Cancelamento simples quando quiser.
                </p>
              </div>
            </div>
          </div>

          {/* Rodapé sticky (CTA sempre visível) */}
          <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur border-t border-gray-200">
            <div className="px-5 sm:px-6 pb-4 pt-3">
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={loadingRedirect || hasPremiumAccess || billingStatusLoading}
                className="w-full inline-flex items-center justify-center rounded-md bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-pink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loadingRedirect ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redirecionando…
                  </>
                ) : (
                  <>
                    Começar 7 dias grátis
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </>
                )}
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
              {hasPremiumAccess && !billingStatusLoading && (
                <p className="mt-2 text-center text-xs text-gray-600">
                  Você já possui um plano ativo ou em período de teste.
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
