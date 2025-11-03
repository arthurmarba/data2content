"use client";

import Image from "next/image";
import React from "react";
import { track } from "@/lib/track";
import type { LandingCreatorHighlight } from "@/types/landing";

type CreatorGallerySectionProps = {
  creators: LandingCreatorHighlight[];
  loading?: boolean;
  lastUpdatedIso?: string;
  onRequestMediaKit?: () => void;
};

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

const skeletonCards = new Array(4).fill(null);

const CreatorGallerySection: React.FC<CreatorGallerySectionProps> = ({
  creators,
  loading = false,
  lastUpdatedIso,
  onRequestMediaKit,
}) => {
  const formattedDate = React.useMemo(() => formatDate(lastUpdatedIso), [lastUpdatedIso]);
  const visibleCreators = React.useMemo(() => creators.slice(0, 4), [creators]);

  const handleMediaKitClick = React.useCallback(
    (creator: LandingCreatorHighlight) => {
      try {
        track("landing_creator_gallery_media_kit_click", {
          creatorId: creator.id,
          creatorRank: creator.rank,
        });
      } catch {}
      onRequestMediaKit?.();
    },
    [onRequestMediaKit]
  );

  return (
    <section id="galeria" className="bg-[#F9F9FB] py-14 md:py-20">
      <div className="container mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-end md:justify-between md:text-left">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-dark shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              Criadores em destaque
            </div>
            <h2 className="text-3xl font-bold text-brand-dark md:text-4xl">
              Conheça alguns dos criadores da Data2Content.
            </h2>
            <p className="max-w-2xl text-sm text-brand-text-secondary md:text-base">
              Todos analisados, acompanhados e potencializados por IA.
            </p>
          </div>
          {formattedDate ? (
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-brand-text-secondary">
              Atualizado em {formattedDate}
            </span>
          ) : null}
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading
            ? skeletonCards.map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="flex flex-col gap-2 rounded-xl border border-white/60 bg-white/80 p-3 shadow-[0_12px_26px_rgba(15,23,42,0.06)] backdrop-blur-sm"
                >
                  <div className="aspect-square w-full overflow-hidden rounded-xl bg-gradient-to-br from-[#F9A8D4] via-[#FDF2F8] to-[#E879F9] opacity-50" />
                  <div className="h-3 w-3/5 rounded-full bg-[#F3F3F5]" />
                  <div className="h-3 w-2/5 rounded-full bg-[#F3F3F5]" />
                  <div className="mt-auto h-7 rounded-full bg-[#F5F5F7]" />
                </div>
              ))
            : visibleCreators.map((creator) => {
                const followers = creator.followers ?? 0;
                const averageInteractions = creator.avgInteractionsPerPost ?? 0;
                const engagementRate =
                  followers > 0 ? Math.max((averageInteractions / followers) * 100, 0) : undefined;

                return (
                  <article
                    key={creator.id}
                    className="group flex flex-col gap-2 rounded-xl border border-white/60 bg-white/90 p-3 shadow-[0_14px_32px_rgba(15,23,42,0.07)] transition-all duration-200 hover:-translate-y-1 hover:border-brand-magenta/25 hover:shadow-[0_22px_40px_rgba(15,23,42,0.1)]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold text-brand-dark/80">
                        Creator
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF5E4] px-3 py-1 text-xs font-semibold text-[#C47A00]">
                        Destaque
                      </span>
                    </div>
                    <div className="mt-3 aspect-square w-full overflow-hidden rounded-2xl bg-[#FDF2F8]">
                      {creator.avatarUrl ? (
                        <Image
                          src={creator.avatarUrl}
                          alt={creator.name}
                          width={360}
                          height={360}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-brand-magenta">
                          D2C
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 text-left">
                      <h3 className="text-sm font-semibold text-brand-dark">{creator.name}</h3>
                      {creator.username ? (
                        <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-brand-text-secondary">
                          {creator.username}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 text-[0.65rem] text-brand-text-secondary">
                      {engagementRate ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F7F8FB] px-2.5 py-1 font-medium text-brand-dark/85">
                          Engajamento {engagementRate.toFixed(1)}%
                        </span>
                      ) : null}
                      {followers ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F7F8FB] px-2.5 py-1 font-medium text-brand-dark/85">
                          Alcance {numberFormatter.format(followers)}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#F7F8FB] px-2.5 py-1 font-medium text-brand-dark/85">
                        Top #{creator.rank}
                      </span>
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex flex-col text-xs text-brand-text-secondary">
                        <span className="font-semibold text-brand-dark/80">Interações</span>
                        <span className="font-medium">
                          {numberFormatter.format(averageInteractions)} por post
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleMediaKitClick(creator)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#0B57D0] text-sm text-white shadow-[0_10px_24px_rgba(11,87,208,0.18)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#094ab4]"
                        aria-label={`Ver mídia kit de ${creator.name}`}
                      >
                        →
                      </button>
                    </div>
                  </article>
                );
              })}
        </div>

      </div>
    </section>
  );
};

export default CreatorGallerySection;
