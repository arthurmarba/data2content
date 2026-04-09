"use client";

import React from "react";
import Image from "next/image";
import { ArrowUpRight, Compass, Users } from "lucide-react";
import { UserAvatar } from "@/app/components/UserAvatar";
import type { LandingCreatorHighlight } from "@/types/landing";
import { buildCuratedCreatorRails } from "./discoverCreatorMarketplace";

const compactFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCompactValue(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "—";
  try {
    return compactFormatter.format(value);
  } catch {
    return String(value);
  }
}

function CreatorMediaKitCard({
  creator,
  compactView = false,
  priority = false,
}: {
  creator: LandingCreatorHighlight;
  compactView?: boolean;
  priority?: boolean;
}) {
  const mediaKitHref = creator.mediaKitSlug ? `/mediakit/${creator.mediaKitSlug}` : null;
  const followersLabel = formatCompactValue(creator.followers ?? null);
  const hasMediaKit = Boolean(mediaKitHref);

  const cardBody = (
    <article
      className={`group flex h-full flex-col rounded-[1.45rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,250,250,0.94))] transition-colors hover:border-zinc-300/90 ${
        compactView ? "w-[118px] min-w-[118px] p-1.5" : "w-[154px] min-w-[154px] p-2"
      }`}
    >
      <div
        className={`relative overflow-hidden rounded-[1.1rem] border border-zinc-200/70 bg-zinc-100 ${
          compactView ? "aspect-[1/1.08]" : "aspect-[1/1.05]"
        }`}
      >
        {creator.avatarUrl ? (
          <Image
            src={creator.avatarUrl}
            alt={creator.name || creator.username || "Criador"}
            fill
            sizes={compactView ? "118px" : "154px"}
            quality={compactView ? 58 : 64}
            className="object-cover"
            loading={priority ? "eager" : "lazy"}
            priority={priority}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,rgba(244,244,245,1),rgba(228,228,231,1))]">
            <UserAvatar
              name={creator.name || creator.username || "Criador"}
              src={undefined}
              size={compactView ? 52 : 60}
              className="ring-2 ring-white/80"
            />
          </div>
        )}
      </div>

      <div className="mt-1.5 text-center">
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Seguidores
        </p>
        <p className={`mt-0.5 font-semibold tracking-[-0.03em] text-zinc-950 ${compactView ? "text-[0.95rem]" : "text-[1.02rem]"}`}>
          {followersLabel}
        </p>
      </div>

      <div className="mt-1.5">
        {hasMediaKit ? (
          <span className="inline-flex w-full items-center justify-center gap-1 rounded-full bg-zinc-950 px-2.5 py-1.5 text-[9.5px] font-semibold text-white">
            <ArrowUpRight className="h-3 w-3" />
            Ver mídia kit
          </span>
        ) : (
          <span className="inline-flex w-full items-center justify-center rounded-full border border-zinc-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-zinc-600">
            Sem mídia kit
          </span>
        )}
      </div>
    </article>
  );

  if (!mediaKitHref) return cardBody;

  return (
    <a href={mediaKitHref} className="block" target="_blank" rel="noreferrer" aria-label={`Abrir mídia kit de ${creator.name || creator.username || "criador"}`}>
      {cardBody}
    </a>
  );
}

export default function DiscoverCreatorsBoardContent({
  creators,
  loading = false,
  error = null,
  compactView = false,
}: {
  creators: LandingCreatorHighlight[];
  loading?: boolean;
  error?: string | null;
  compactView?: boolean;
}) {
  const rails = React.useMemo(() => buildCuratedCreatorRails(creators), [creators]);

  const renderRailTitle = React.useCallback((title: string, isFallback?: boolean) => {
    const Icon = isFallback ? Compass : Users;

    return (
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-200/80 bg-white text-zinc-700">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span>{title}</span>
      </span>
    );
  }, []);

  if (loading && creators.length === 0) {
    return (
      <div className={compactView ? "space-y-4 p-4" : "space-y-5 p-4 sm:p-5"}>
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <div className="h-4 w-40 animate-pulse rounded-full bg-zinc-200" />
            <div className="flex gap-2 overflow-hidden">
              {Array.from({ length: 3 }).map((__, cardIndex) => (
                <div key={cardIndex} className={`${compactView ? "h-[214px] w-[172px]" : "h-[250px] w-[220px]"} animate-pulse rounded-[1.35rem] bg-zinc-100`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={compactView ? "p-4" : "p-4 sm:p-5"}>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          {error}
        </div>
      </div>
    );
  }

  if (!rails.length) {
    return (
      <div className={compactView ? "p-4" : "p-4 sm:p-5"}>
        <div className="rounded-[1.35rem] border border-dashed border-zinc-200/80 bg-white/70 px-4 py-6 text-sm text-zinc-500">
          Nenhum criador disponível para exibir agora.
        </div>
      </div>
    );
  }

  return (
    <div className={compactView ? "space-y-5 px-2 pb-6 pt-2" : "space-y-5 p-4 sm:p-5"}>
      <div className="space-y-4">
        {rails.map((rail, sectionIndex) => (
          <section
            key={rail.key}
            className={`${sectionIndex > 0 ? "border-t border-zinc-200/70 pt-5" : ""}`}
            style={
              sectionIndex === 0
                ? undefined
                : ({ contentVisibility: "auto", containIntrinsicSize: compactView ? "280px" : "340px" } as React.CSSProperties)
            }
          >
            <div className="mb-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-[1rem] font-semibold tracking-[-0.02em] text-zinc-950">
                  {renderRailTitle(rail.title, rail.isFallback)}
                </h4>
              </div>
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                {rail.creators.length} criador{rail.creators.length === 1 ? "" : "es"}
              </span>
            </div>

            <div className={compactView ? "-mx-2 overflow-x-auto hide-scrollbar" : "overflow-x-auto hide-scrollbar"}>
              <div className={`flex ${compactView ? "gap-1.5 pl-2 pr-0.5 pb-1" : "gap-3 pb-1"}`}>
                {rail.creators.map((creator, creatorIndex) => (
                  <CreatorMediaKitCard
                    key={creator.id}
                    creator={creator}
                    compactView={compactView}
                    priority={compactView && sectionIndex === 0 && creatorIndex < 2}
                  />
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
