"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { AlertCircle, HelpCircle, Instagram, Sparkles } from "lucide-react";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { useDiscoverCtaConfig } from "./useDiscoverCtaConfig";

type DiscoverHeaderProps = {
  allowedPersonalized: boolean;
  featuredCount?: number;
};

const PROOF_TEXT = "Use como referência para seus próximos conteúdos. Isso valoriza seu Mídia Kit.";

export default function DiscoverHeader({ allowedPersonalized, featuredCount }: DiscoverHeaderProps) {
  const { instagram, hasPremiumAccess, isTrialActive, trialRemainingMs, trial } = useBillingStatus();
  const [infoOpen, setInfoOpen] = useState(false);
  const ctaConfig = useDiscoverCtaConfig(allowedPersonalized);

  const instagramConnected = Boolean(allowedPersonalized || instagram?.connected);
  const needsReconnect = Boolean(instagram?.needsReconnect);
  const trialCountdown = useMemo(() => {
    if (!trialRemainingMs || trialRemainingMs <= 0) return null;
    const totalMinutes = Math.floor(trialRemainingMs / 60000);
    if (totalMinutes <= 0) return null;
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const totalHours = Math.floor(totalMinutes / 60);
    if (totalHours < 48) return `${totalHours} h`;
    const totalDays = Math.floor(totalHours / 24);
    return `${totalDays} d`;
  }, [trialRemainingMs]);

  const headline = instagramConnected
    ? "Discover personalizado com IA"
    : "Conecte seu Instagram para personalizar a curadoria";

  const subHeadline = instagramConnected
    ? `Última atualização: ${featuredCount ?? 0} ideias quentes do seu segmento.`
    : "Veja as tendências gerais agora e conecte-se para destravar recomendações do seu nicho.";

  const chips = useMemo(() => {
    const items: ReactNode[] = [];

    if (needsReconnect) {
      items.push(
        <span
          key="instagram-reconnect"
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
        >
          <AlertCircle className="h-4 w-4" aria-hidden />
          Reconecte o Instagram
        </span>
      );
    } else if (instagramConnected) {
      items.push(
        <span
          key="instagram-connected"
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
        >
          <Instagram className="h-4 w-4" aria-hidden />
          {instagram?.username ? `@${instagram.username}` : "Instagram conectado"}
        </span>
      );
    } else {
      items.push(
        <span
          key="instagram-disconnected"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
        >
          <Instagram className="h-4 w-4" aria-hidden />
          Instagram desconectado
        </span>
      );
    }

    if (isTrialActive) {
      items.push(
        <span
          key="trial-active"
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Trial ativo{trialCountdown ? ` • ${trialCountdown}` : ""}
        </span>
      );
    } else if (hasPremiumAccess) {
      items.push(
        <span
          key="pro-active"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
        >
          <Sparkles className="h-4 w-4 text-slate-500" aria-hidden />
          Plano PRO ativo
        </span>
      );
    } else if (trial?.state === "eligible") {
      items.push(
        <span
          key="trial-available"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
        >
          <Sparkles className="h-4 w-4 text-slate-500" aria-hidden />
          Trial 48h disponível
        </span>
      );
    }

    return items;
  }, [instagramConnected, instagram?.username, needsReconnect, isTrialActive, trialCountdown, hasPremiumAccess, trial?.state]);

  const toggleInfo = () => setInfoOpen((prev) => !prev);
  const handleInfoBlur = () => {
    window.setTimeout(() => setInfoOpen(false), 120);
  };

  const renderCta = () => {
    if (ctaConfig.kind === "status") {
      return (
        <span className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
          <Sparkles className="h-3.5 w-3.5 text-slate-500" aria-hidden />
          {ctaConfig.statusLabel}
        </span>
      );
    }

    const baseClass =
      "inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-magenta px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta disabled:cursor-not-allowed disabled:opacity-70";
    const leadingIcon =
      ctaConfig.state === "instagram_connect" || ctaConfig.state === "instagram_reconnect" ? (
        <Instagram className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
      );

    if (ctaConfig.href) {
      return (
        <Link href={ctaConfig.href} className={baseClass}>
          {leadingIcon}
          {ctaConfig.label}
        </Link>
      );
    }

    return (
      <button type="button" onClick={ctaConfig.onPress} disabled={ctaConfig.disabled} className={baseClass}>
        {leadingIcon}
        {ctaConfig.label}
      </button>
    );
  };

  return (
    <section className="mt-2 sm:mt-3">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex-1 space-y-2 text-left">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles className="h-4 w-4 text-brand-magenta" aria-hidden />
            {headline}
          </div>
          <p className="text-xs text-slate-500">{subHeadline}</p>
          <p className="text-xs text-slate-500">{PROOF_TEXT}</p>
          <div className="flex flex-wrap items-center gap-2">
            {chips}
            <div className="relative">
              <button
                type="button"
                onClick={toggleInfo}
                onBlur={handleInfoBlur}
                aria-expanded={infoOpen}
                className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 text-xs font-medium text-slate-500 transition hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
              >
                <HelpCircle className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Saiba por quê</span>
                <span className="sm:hidden">Info</span>
              </button>
              {infoOpen && (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-64 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg">
                  Conectar o Instagram libera horários recomendados, formatos vencedores e métricas comparativas para o seu nicho.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:max-w-[240px]">
          {renderCta()}
          {ctaConfig.kind === "action" && ctaConfig.description ? (
            <p className="text-[10px] text-slate-500 text-center sm:text-left">{ctaConfig.description}</p>
          ) : null}
          <Link
            href="/dashboard"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            Ver status completo
          </Link>
        </div>
      </div>
    </section>
  );
}
