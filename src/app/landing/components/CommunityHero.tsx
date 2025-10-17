"use client";

import React from "react";

import { formatCompactNumber, formatPlainNumber } from "@/app/landing/utils/format";
import type { LandingCommunityMetrics, LandingNextMentorship } from "@/types/landing";

type HeroProps = {
  onPrimaryCta: () => void;
  metrics?: LandingCommunityMetrics | null;
  nextMentorship?: LandingNextMentorship | null;
};

const CTA_SECONDARY_ID = "como-funciona";

export const CommunityHero: React.FC<HeroProps> = ({ onPrimaryCta, metrics, nextMentorship }) => {
  const postsSample = metrics?.postsLast30Days ? formatPlainNumber(metrics.postsLast30Days) : null;

  const quickStats = [
    {
      label: "Seguidores conquistados (30 dias)",
      value: metrics ? `+${formatCompactNumber(metrics.followersGainedLast30Days)}` : "—",
      description: "Crescimento somado de quem está na comunidade.",
    },
    {
      label: "Visualizações geradas (30 dias)",
      value: metrics ? formatCompactNumber(metrics.viewsLast30Days) : "—",
      description: "Base para o planner orientado pela IA.",
    },
    {
      label: "Alcance somado (30 dias)",
      value: metrics ? formatCompactNumber(metrics.reachLast30Days) : "—",
      description: "Conteúdos vivos chegando cada vez mais longe.",
    },
    {
      label: "Interações (30 dias)",
      value: metrics ? formatCompactNumber(metrics.interactionsLast30Days) : "—",
      description: postsSample
        ? `${postsSample} conteúdos analisados para gerar referências.`
        : "Conteúdos analisados para gerar referências práticas.",
    },
  ];

  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-gradient-to-br from-brand-purple via-[#5B2ADE] to-brand-magenta text-white"
    >
      <div className="absolute inset-0 opacity-70">
        <div className="absolute -top-40 -left-24 h-72 w-72 rounded-full bg-white/20 blur-[140px]" />
        <div className="absolute bottom-[-120px] right-[-80px] h-80 w-80 rounded-full bg-[#F862CE]/30 blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12)_0%,_rgba(255,255,255,0)_55%)]" />
      </div>

      <div className="relative container mx-auto px-6 pt-18 pb-32 md:pt-26 md:pb-40 lg:pt-32 lg:pb-48">
        <div className="mx-auto max-w-6xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-5 py-1 text-xs font-semibold tracking-[0.2em] uppercase text-white/80 backdrop-blur">
            Comunidade + IA
          </div>

          <div className="mt-8 rounded-[32px] border border-white/20 bg-white/10 p-8 shadow-[0_40px_140px_rgba(74,37,153,0.35)] backdrop-blur-md md:p-12 lg:p-16">
            <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl lg:max-w-4xl">
                <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl lg:text-[3.5rem] lg:leading-[1.05]">
                  A comunidade transforma dados em clareza para criar.
                </h1>
                <p className="mt-6 text-lg text-white/85 md:text-xl lg:text-[1.35rem] lg:leading-8">
                  Mentorias semanais, network e um planner alimentado por IA que aprende com o coletivo para você postar com
                  confiança. Entre agora e receba o convite pro WhatsApp assim que logar.
                </p>
              </div>
              <div className="hidden shrink-0 lg:block">
                <div className="rounded-xl border border-white/20 bg-white/10 px-6 py-5 text-sm text-white/85 shadow-lg backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">Próxima mentoria</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {nextMentorship?.display ?? "Seg • 19h (BRT)"}
                  </p>
                  <p className="mt-3 text-xs text-white/70">
                    Hotseats ao vivo para dissecar estratégias que estão funcionando agora.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center lg:gap-6">
              <button
                onClick={onPrimaryCta}
                className="group w-full rounded-xl bg-white px-8 py-4 text-base font-semibold text-brand-purple shadow-lg transition-all hover:-translate-y-0.5 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto lg:text-lg"
              >
                Entrar na Comunidade (via Google)
                <span className="ml-2 inline-flex translate-x-0 items-center transition-transform group-hover:translate-x-1">
                  →
                </span>
              </button>
              <a
                href={`#${CTA_SECONDARY_ID}`}
                className="w-full rounded-xl border border-white/30 bg-white/10 px-8 py-4 text-base font-semibold text-white/85 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto lg:text-lg"
              >
                Ver como funciona
              </a>
            </div>

            <p className="mt-4 text-sm text-white/70">
              Login gratuito. Link do WhatsApp e planner destravados imediatamente após o acesso.
            </p>

            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {quickStats.map((stat) => (
                <div
                  key={stat.label}
                  className="group relative flex min-h-[148px] flex-col overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-5 shadow-inner transition hover:bg-white/15 lg:min-h-[180px] lg:p-6"
                >
                  <div className="absolute -right-10 top-4 h-20 w-20 rounded-full bg-white/10 blur-2xl transition group-hover:scale-110" />
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/60 lg:text-sm">{stat.label}</p>
                  <p className="mt-3 text-3xl font-extrabold tracking-tight text-white lg:text-[2.4rem]">
                    {stat.value}
                  </p>
                  <p className="mt-3 text-xs text-white/65 lg:mt-auto lg:text-sm">{stat.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CommunityHero;
