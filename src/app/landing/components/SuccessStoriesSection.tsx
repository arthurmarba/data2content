"use client";

import Image from "next/image";
import React from "react";
import type { LandingCreatorHighlight } from "@/types/landing";

type SuccessStoriesSectionProps = {
  onCta: () => void;
  creators: LandingCreatorHighlight[];
};

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const formatMetric = (value?: number | null, fallback = "—") => {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return numberFormatter.format(value);
};

const defaultCreators: Array<LandingCreatorHighlight & { summary?: string }> = [
  {
    id: "fallback-1",
    name: "Myllena Costa",
    username: "@myllenacriadora",
    avatarUrl: "/images/IMG_8634.PNG",
    followers: 158_000,
    totalInteractions: 420_000,
    postCount: 12,
    avgInteractionsPerPost: 35_000,
    rank: 1,
    consistencyScore: 92,
    summary: "+420 mil interações no trimestre e presença constante nas mentorias do Plano Agência.",
  },
  {
    id: "fallback-2",
    name: "Rafa Belli",
    username: "@rafabelli",
    avatarUrl: "/images/Rafa Belli Foto D2C.png",
    followers: 210_000,
    totalInteractions: 315_000,
    postCount: 9,
    avgInteractionsPerPost: 35_000,
    rank: 2,
    consistencyScore: 88,
    summary: "Fechou 4 campanhas nos últimos 60 dias após liberar diagnósticos do Plano Agência.",
  },
  {
    id: "fallback-3",
    name: "Lívia Marbá",
    username: "@liviamarba",
    avatarUrl: "/images/Livia Foto D2C.png",
    followers: 320_000,
    totalInteractions: 510_000,
    postCount: 14,
    avgInteractionsPerPost: 36_000,
    rank: 3,
    consistencyScore: 95,
    summary: "Triplicou alcance com trilhas orientadas pela Mobi e hoje lidera mentorias.",
  },
];

const SuccessStoriesSection: React.FC<SuccessStoriesSectionProps> = ({ onCta, creators }) => {
  const topCreators = React.useMemo(() => {
    if (!creators?.length) {
      return defaultCreators;
    }
    return creators
      .filter((creator) => creator)
      .slice(0, 3)
      .map((creator, index) => ({ ...creator, fallbackRank: index + 1 }));
  }, [creators]);

  return (
    <section className="bg-white py-10 md:py-16">
      <div className="container mx-auto max-w-5xl px-6">
        <div className="mb-12 text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-[#FFE9EE] px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-magenta">
            Histórias que inspiram
          </p>
          <h2 className="mt-4 text-2xl font-extrabold text-[#161616] md:text-[2.2rem]">
            Criadores reais, números que dão confiança.
          </h2>
          <p className="mt-3 text-base text-brand-text-secondary md:text-lg">
            Cada vitória da comunidade vira referência para os próximos creators.
          </p>
        </div>
        <div className="-mx-4 flex snap-x snap-mandatory overflow-x-auto px-4 pb-6 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0 md:snap-none">
          {topCreators.map((creator, index) => {
            const interactions = formatMetric(creator.totalInteractions, "—");
            const avgInteractions = formatMetric(creator.avgInteractionsPerPost, "—");
            const followers = formatMetric(creator.followers ?? undefined, "—");
            const postCount = creator.postCount ?? "—";
            const rank = creator.rank ?? (creator as { fallbackRank?: number }).fallbackRank ?? index + 1;

            const summary = (creator as { summary?: string }).summary;

            return (
            <article
              key={creator.id ?? `creator-${index}`}
              className="mr-4 flex h-full min-w-[78%] snap-center flex-col justify-between rounded-3xl border border-[#EFEFEF] bg-white p-8 shadow-[0_18px_42px_rgba(28,28,30,0.08)] transition hover:-translate-y-1 last:mr-0 md:mr-0 md:min-w-0 md:snap-none"
            >
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="relative h-12 w-12 overflow-hidden rounded-full border border-[#F1F5F9] bg-[#F9FAFB]">
                    {creator.avatarUrl ? (
                      <Image src={creator.avatarUrl} alt={creator.name} fill className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-[#111827]">
                        {creator.name
                          .split(" ")
                          .map((part) => part?.[0] ?? "")
                          .join("")
                          .slice(0, 2)}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-brand-dark px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                      {creator.name}
                    </span>
                    {creator.username ? (
                      <p className="mt-1 text-sm text-brand-text-secondary">{creator.username}</p>
                    ) : null}
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand-magenta">
                      #{rank} no Ranking da comunidade
                    </p>
                  </div>
                </div>
                <div className="space-y-3 rounded-2xl bg-brand-light px-4 py-3 text-sm font-semibold text-brand-dark">
                  <div className="flex items-center justify-between text-brand-text-secondary">
                    <span>Interações totais</span>
                    <span>{interactions}</span>
                  </div>
                  <div className="flex items-center justify-between text-brand-text-secondary">
                    <span>Média por post</span>
                    <span>{avgInteractions}</span>
                  </div>
                  <div className="flex items-center justify-between text-brand-text-secondary">
                    <span>Followers atuais</span>
                    <span>{followers}</span>
                  </div>
                  <div className="flex items-center justify-between text-brand-text-secondary">
                    <span>Posts analisados</span>
                    <span>{postCount}</span>
                  </div>
                </div>
                {summary ? (
                  <p className="text-sm leading-relaxed text-brand-text-secondary">{summary}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onCta}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-magenta px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(231,75,111,0.25)] transition-colors duration-200 hover:bg-brand-magenta-hover"
              >
                Quero o mesmo resultado →
              </button>
            </article>
          );
          })}
        </div>
      </div>
    </section>
  );
};

export default SuccessStoriesSection;
