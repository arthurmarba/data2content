"use client";

import Image from "next/image";
import React from "react";
import { track } from "@/lib/track";
import type { LandingCreatorHighlight } from "@/types/landing";

type CreatorGallerySectionProps = {
  creators: LandingCreatorHighlight[];
  loading?: boolean;
  onRequestMediaKit?: () => void;
  maxVisible?: number;
};

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const DEFAULT_MAX_VISIBLE_CREATORS = 15;

const CreatorGallerySection: React.FC<CreatorGallerySectionProps> = ({
  creators,
  loading = false,
  onRequestMediaKit,
  maxVisible = DEFAULT_MAX_VISIBLE_CREATORS,
}) => {
  const skeletonCards = React.useMemo(
    () => Array.from({ length: maxVisible }),
    [maxVisible],
  );

  const visibleCreators = React.useMemo(
    () => creators.slice(0, maxVisible),
    [creators, maxVisible],
  );

  const handleMediaKitClick = React.useCallback(
    (creator: LandingCreatorHighlight) => {
      try {
        track("landing_creator_gallery_media_kit_click", {
          creatorId: creator.id,
          creatorRank: creator.rank,
          mediaKitSlug: creator.mediaKitSlug ?? null,
        });
      } catch {}

      if (creator.mediaKitSlug) {
        const targetUrl = `/mediakit/${creator.mediaKitSlug}`;
        if (typeof window !== "undefined") {
          window.location.assign(targetUrl);
        }
        return;
      }

      onRequestMediaKit?.();
    },
    [onRequestMediaKit]
  );

  return (
    <section id="galeria" className="bg-[#F9F9FB] py-[clamp(3.5rem,9vw,6rem)]">
      <div className="container mx-auto max-w-6xl px-6">
        <header className="mb-8 max-w-3xl space-y-3 md:mb-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#D8E1F5] bg-white px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#2F3B5C]">
            Comunidade em movimento
          </span>
          <h2 className="text-xl font-semibold text-brand-dark md:text-2xl">
            Conheça criadores que compartilham resultados e bastidores.
          </h2>
          <p className="text-sm text-brand-text-secondary md:text-[0.95rem]">
            Essa galeria destaca quem abriu os dashboards da Data2Content, publicou mídia kit e usa a plataforma
            para provar valor em negociações com marcas.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-5 lg:gap-6">
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
                    className="group flex cursor-pointer flex-col gap-2 rounded-xl border border-white/60 bg-white/90 p-3 shadow-[0_14px_32px_rgba(15,23,42,0.07)] transition-all duration-200 hover:-translate-y-1 hover:border-brand-magenta/25 hover:shadow-[0_22px_40px_rgba(15,23,42,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleMediaKitClick(creator)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleMediaKitClick(creator);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF5E4] px-3 py-1 text-xs font-semibold text-[#C47A00]">
                        Ranking #{creator.rank}
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
                        onClick={(event) => {
                          event.stopPropagation();
                          handleMediaKitClick(creator);
                        }}
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
