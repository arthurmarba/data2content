"use client";

import React, { useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";

interface OnboardingPaywallModalProps {
  open: boolean;
  onSubscribeNow: () => Promise<void>;
  onExploreFree: () => void;
}

/**
 * Paywall modal shown after first reading in onboarding.
 * Two clear entry profiles:
 * 1. "Assinar agora" — direct subscription path
 * 2. "Explorar grátis primeiro" — continue with free tier
 *
 * No close button; only these two options exist.
 * Matches the calm, guided onboarding UX.
 */
export function OnboardingPaywallModal({
  open,
  onSubscribeNow,
  onExploreFree,
}: OnboardingPaywallModalProps) {
  const [isSubscribing, setIsSubscribing] = useState(false);

  if (!open) return null;

  const handleSubscribeClick = async () => {
    setIsSubscribing(true);
    try {
      await onSubscribeNow();
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[280] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-full bg-orange-50">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="#f97316" strokeWidth="1.8" />
            <circle cx="12" cy="12" r="4" fill="#f97316" />
          </svg>
        </div>

        {/* Title and description */}
        <h2 className="mb-2 text-[22px] font-bold leading-tight tracking-tight text-zinc-950">
          Aprofunde seu mapa
        </h2>
        <p className="mb-8 text-[15px] leading-relaxed text-zinc-500">
          Acesso ilimitado a análises, pautas geradas por IA e recomendações de collab — tudo a partir do seu mapa confirmado.
        </p>

        {/* Features list */}
        <div className="mb-8 space-y-3">
          <FeatureItem text="Análise completa de narrativa e territórios" />
          <FeatureItem text="Pautas semanais geradas por IA" />
          <FeatureItem text="Recomendações de collab narrativo" />
          <FeatureItem text="Suporte e mentoria pelo WhatsApp" />
        </div>

        {/* Profile 1: Subscribe Now */}
        <button
          type="button"
          onClick={handleSubscribeClick}
          disabled={isSubscribing}
          className="mb-3 flex w-full items-center justify-between rounded-2xl bg-zinc-950 px-6 py-4 text-white transition-all disabled:opacity-50 active:bg-zinc-900"
        >
          <div className="text-left">
            <p className="text-[15px] font-semibold">Assinar agora</p>
            <p className="text-[13px] text-zinc-300">Acesso Pro ilimitado</p>
          </div>
          {isSubscribing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowRight className="h-5 w-5" />
          )}
        </button>

        {/* Profile 2: Explore Free */}
        <button
          type="button"
          onClick={onExploreFree}
          disabled={isSubscribing}
          className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 px-6 py-4 text-zinc-800 transition-colors disabled:opacity-50 active:bg-zinc-50"
        >
          <div className="text-left">
            <p className="text-[15px] font-semibold">Explorar grátis primeiro</p>
            <p className="text-[13px] text-zinc-500">1 análise por mês</p>
          </div>
          <ArrowRight className="h-5 w-5 text-zinc-400" />
        </button>

        {/* Footer note */}
        <p className="mt-6 text-center text-[12px] text-zinc-400">
          A assinatura não pula etapas — só aprofunda o que você descobre.
        </p>
      </div>
    </div>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <svg
        className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-400"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="text-[14px] leading-relaxed text-zinc-700">{text}</p>
    </div>
  );
}
