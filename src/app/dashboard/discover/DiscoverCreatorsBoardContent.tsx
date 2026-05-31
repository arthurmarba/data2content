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

function pickCreatorTag(creator: LandingCreatorHighlight) {
  return (
    creator.niches?.find(Boolean) ||
    creator.brandTerritories?.find(Boolean) ||
    creator.contexts?.find(Boolean) ||
    creator.topPerformingContext ||
    null
  );
}

function getCreatorHandle(creator: LandingCreatorHighlight) {
  const username = creator.username?.trim();
  if (!username) return null;
  return username.startsWith("@") ? username : `@${username}`;
}

function getInitials(name?: string | null) {
  const parts = (name || "D2C").trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return initials || "D2C";
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
  const creatorName = creator.name || creator.username || "Criador";
  const creatorHandle = getCreatorHandle(creator);
  const creatorTag = pickCreatorTag(creator);
  const hasMediaKit = Boolean(mediaKitHref);
  const canRenderAvatarImage = Boolean(creator.avatarUrl && creator.hasAvatarImage !== false);

  const cardBody = (
    <article
      className={`group flex h-full flex-col overflow-hidden transition-all duration-200 ${
        compactView
          ? "w-[124px] min-w-[124px] rounded-[20px] bg-white shadow-[0_4px_14px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] active:scale-[0.97]"
          : "rounded-[1.2rem] border border-zinc-200/80 bg-white hover:border-zinc-300 hover:shadow-[0_14px_34px_rgba(24,24,27,0.08)] min-h-[214px]"
      } ${hasMediaKit ? "cursor-pointer" : "opacity-85"}`}
    >
      <div className="relative aspect-[1/1.08] overflow-hidden bg-zinc-100">
        {canRenderAvatarImage ? (
          <Image
            src={creator.avatarUrl!}
            alt={creatorName}
            fill
            sizes={compactView ? "124px" : "(min-width: 1024px) 180px, 154px"}
            quality={compactView ? 58 : 64}
            className="object-cover"
            loading={priority ? "eager" : "lazy"}
            priority={priority}
          />
        ) : compactView ? (
          <div className="flex h-full w-full items-center justify-center bg-indigo-50/60">
            <div className="flex items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-white/80" style={{ width: 44, height: 44 }}>
              <span className="text-[14px] font-bold text-indigo-500">{getInitials(creatorName)}</span>
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,rgba(244,244,245,1),rgba(228,228,231,1))]">
            <UserAvatar
              name={creatorName}
              src={undefined}
              size={60}
              className="ring-2 ring-white/80"
            />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col px-2.5 pb-2.5 pt-2.5">
        <p className="truncate text-[0.72rem] font-semibold leading-tight tracking-[-0.02em] text-zinc-950">
          {creatorHandle ?? creatorTag ?? "Criador"}
        </p>
        <p className="mt-1 truncate text-[10px] font-medium text-zinc-500">
          {followersLabel} seguidores
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className={`truncate text-[9px] font-semibold uppercase tracking-[0.14em] ${hasMediaKit ? "text-zinc-400" : "text-zinc-300"}`}>
            {hasMediaKit ? "Mídia kit" : "Indisponível"}
          </span>
          {hasMediaKit ? (
            <span className="inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white transition group-hover:scale-105">
              <ArrowUpRight className="h-3 w-3" />
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );

  if (!mediaKitHref) return cardBody;

  return (
    <a href={mediaKitHref} className="block h-full" target="_blank" rel="noreferrer" aria-label={`Abrir mídia kit de ${creatorName}`}>
      {cardBody}
    </a>
  );
}

export default function DiscoverCreatorsBoardContent({
  creators,
  loading = false,
  error = null,
  compactView = false,
  includeCreatorsWithoutAvatar = false,
}: {
  creators: LandingCreatorHighlight[];
  loading?: boolean;
  error?: string | null;
  compactView?: boolean;
  includeCreatorsWithoutAvatar?: boolean;
}) {
  const displayCreators = React.useMemo(
    () => includeCreatorsWithoutAvatar ? creators : creators.filter((creator) => creator.hasAvatarImage !== false),
    [creators, includeCreatorsWithoutAvatar],
  );
  const rails = React.useMemo(() => buildCuratedCreatorRails(displayCreators), [displayCreators]);

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
                <div key={cardIndex} className={`${compactView ? "h-[202px] w-[124px]" : "h-[214px] w-[158px]"} animate-pulse rounded-[1.2rem] bg-zinc-100`} />
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

            <div className={compactView ? "-mx-2 overflow-x-auto hide-scrollbar" : ""}>
              <div className={compactView ? "flex gap-2 pl-2 pr-0.5 pb-1" : "grid grid-cols-3 gap-3 xl:grid-cols-5"}>
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
