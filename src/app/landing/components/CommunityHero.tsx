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
      style={{
        paddingTop: "calc(var(--landing-header-h, 4.5rem) + var(--landing-header-extra, 0px))",
      }}
    >
      <div className="absolute inset-0 opacity-70">
        <div className="absolute -top-40 -left-24 h-72 w-72 rounded-full bg-white/20 blur-[140px]" />
        <div className="absolute bottom-[-120px] right-[-80px] h-80 w-80 rounded-full bg-[#F862CE]/30 blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12)_0%,_rgba(255,255,255,0)_55%)]" />
      </div>

      <div className="relative container mx-auto px-6 pt-0 pb-24 sm:pt-2 sm:pb-28 md:pt-6 md:pb-28 lg:pt-6 lg:pb-32 xl:pt-8 xl:pb-36">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[32px] border border-white/20 bg-white/10 p-8 shadow-[0_40px_140px_rgba(74,37,153,0.35)] backdrop-blur-md md:p-12 lg:mt-6 lg:p-16 xl:p-20">
            <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
              <div className="max-w-3xl lg:max-w-4xl xl:max-w-5xl">
                <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl lg:text-[3.6rem] lg:leading-[1.05] xl:text-[3.9rem]">
                  A comunidade de criadores apoiada por IA.
                </h1>
                <p className="mt-6 text-lg text-white/85 md:text-xl lg:text-[1.35rem] lg:leading-8 xl:text-[1.45rem]">
                  Planner inteligente, referências filtradas e trocas diárias com quem também está crescendo — tudo grátis ao entrar.
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

            <div className="mt-8 flex flex-col gap-4 sm:mt-10 sm:flex-row sm:items-center lg:mt-12 lg:gap-6 xl:gap-8">
              <button
                onClick={onPrimaryCta}
                className="group w-full rounded-xl bg-white px-8 py-4 text-base font-semibold text-brand-purple shadow-lg transition-all hover:-translate-y-0.5 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto lg:text-lg"
              >
                Entrar na comunidade (via Google)
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

            <p className="mt-3 text-sm text-white/80 sm:mt-4">
              Ao ativar o PRO você libera o Grupo VIP — mentorias semanais, salas reservadas e acompanhamento estratégico.
            </p>

            <div className="mt-10 grid gap-4 sm:mt-12 md:grid-cols-2 lg:grid-cols-4 lg:gap-7 xl:gap-8">
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

            <div className="mt-10 grid gap-6 sm:mt-12 lg:grid-cols-2 lg:gap-8 xl:mt-14" id={CTA_SECONDARY_ID}>
              <div className="rounded-3xl border border-white/15 bg-[#140835]/90 p-7 text-white shadow-lg md:p-8 lg:p-9 supports-[backdrop-filter]:backdrop-blur-2xl supports-[backdrop-filter]:bg-white/12">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70 md:text-sm md:tracking-[0.24em]">
                  Comunidade Aberta (Grátis)
                </div>
                <p className="mt-3 text-xl font-semibold text-white md:text-[1.6rem] lg:text-[1.75rem] lg:leading-tight">
                  Entre agora e comece a usar tudo que a IA entrega para a base.
                </p>
                <ul className="mt-5 space-y-3 text-sm text-white/85 md:text-base">
                  <li className="flex items-start gap-3">
                    <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-white/80" />
                    Planner IA pronto para sugerir seus próximos posts.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-white/80" />
                    Biblioteca inteligente com referências filtradas.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-white/80" />
                    Network aberta com criadores crescendo juntos.
                  </li>
                </ul>
              </div>
              <div className="rounded-3xl border border-white/25 bg-gradient-to-br from-[#F862CE]/30 via-white/20 to-[#5B2ADE]/30 p-[1px] shadow-xl">
                <div className="h-full rounded-[28px] bg-[#180633]/80 p-7 backdrop-blur-xl md:p-8 lg:p-9">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80 md:text-sm md:tracking-[0.24em]">
                    Grupo VIP (Plano PRO)
                  </div>
                  <p className="mt-3 text-xl font-semibold text-white md:text-[1.6rem] lg:text-[1.75rem] lg:leading-tight">
                    Upgrade para ser acompanhado pela IA e pelo time a cada semana.
                  </p>
                  <ul className="mt-5 space-y-3 text-sm text-white/85 md:text-base">
                    <li className="flex items-start gap-3">
                      <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-[#FDF2FF]" />
                      Mentorias semanais ao vivo com especialistas.
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-[#FDF2FF]" />
                      Acompanhamento conjunto IA + time para destravar métricas.
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-[#FDF2FF]" />
                      Alertas premium e calendário exclusivo de campanhas.
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-[#FDF2FF]" />
                      Salas reservadas para feedbacks e networking avançado.
                    </li>
                  </ul>
                  <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-white/60">
                    Incluído no PRO e no trial de 48h
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CommunityHero;
