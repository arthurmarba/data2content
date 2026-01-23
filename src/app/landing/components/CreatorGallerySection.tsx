"use client";

import Image from "next/image";
import React from "react";
import { track } from "@/lib/track";
import type { LandingCreatorHighlight } from "@/types/landing";
import { UserAvatar } from "../../components/UserAvatar";

type CreatorGallerySectionProps = {
  creators: LandingCreatorHighlight[];
  loading?: boolean;
  onRequestMediaKit?: () => void;
  maxVisible?: number;
  maxVisibleDesktop?: number;
  sectionId?: string;
  headingEyebrow?: string;
  headingTitle?: string;
  headingDescription?: string;
  showAll?: boolean;
  topContent?: React.ReactNode;
  bottomContent?: React.ReactNode;
  showHeader?: boolean;
  containerClassName?: string;
  gridClassName?: string;
  containerRef?: React.Ref<HTMLDivElement>;
  variant?: "default" | "rank";
};

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const FALLBACK_COLORS = [
  "bg-gradient-to-br from-brand-primary to-brand-accent",
  "bg-gradient-to-br from-brand-accent to-brand-sun",
  "bg-gradient-to-br from-brand-sun to-brand-primary",
  "bg-gradient-to-br from-brand-dark/90 to-brand-primary",
  "bg-gradient-to-br from-brand-dark/80 to-brand-accent",
];



function computeEngagementRate(creator: LandingCreatorHighlight): number | null {
  const followers = creator.followers ?? 0;
  if (!followers) return null;
  const avg = creator.avgInteractionsPerPost ?? 0;
  if (!avg) return null;
  const rate = (avg / followers) * 100;
  return Number.isFinite(rate) ? Number(rate) : null;
}

const DEFAULT_MAX_VISIBLE_CREATORS = 12;

const CreatorGallerySection: React.FC<CreatorGallerySectionProps> = ({
  creators,
  loading = false,
  onRequestMediaKit,
  maxVisible = DEFAULT_MAX_VISIBLE_CREATORS,
  maxVisibleDesktop,
  sectionId = "galeria",
  headingEyebrow = "Comunidade em movimento",
  headingTitle = "Criadores em evolução dentro da agência.",
  headingDescription = "Mostramos aqui os criadores que estão ativos na plataforma, treinando posicionamento, refinando suas narrativas e se preparando para campanhas com suporte estratégico da D2C.",
  showAll = false,
  topContent = null,
  bottomContent = null,
  showHeader = true,
  containerClassName = "",
  gridClassName = "",
  containerRef,
  variant = "default",
}) => {
  const [isDesktop, setIsDesktop] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const applyMatches = (event: MediaQueryList | MediaQueryListEvent) => setIsDesktop(event.matches);

    applyMatches(mediaQuery);

    if (typeof mediaQuery.addEventListener === "function") {
      const listener = (event: MediaQueryListEvent) => applyMatches(event);
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    }

    if (typeof mediaQuery.addListener === "function") {
      const legacyListener = (event: MediaQueryListEvent) => applyMatches(event);
      mediaQuery.addListener(legacyListener);
      return () => mediaQuery.removeListener(legacyListener);
    }

    return undefined;
  }, []);

  const baseMaxVisible = isDesktop ? maxVisibleDesktop ?? maxVisible : maxVisible;
  const resolvedMaxVisible = showAll ? creators.length || baseMaxVisible : baseMaxVisible;
  const skeletonCountBase = resolvedMaxVisible || DEFAULT_MAX_VISIBLE_CREATORS;
  const skeletonCount = loading
    ? Math.max(DEFAULT_MAX_VISIBLE_CREATORS, Math.min(skeletonCountBase, 24))
    : skeletonCountBase;

  const skeletonCards = React.useMemo(
    () => Array.from({ length: skeletonCount }),
    [skeletonCount],
  );

  const visibleCreators = React.useMemo(
    () => (showAll ? creators : creators.slice(0, resolvedMaxVisible)),
    [creators, resolvedMaxVisible, showAll],
  );

  const handleMediaKitClick = React.useCallback(
    (creator: LandingCreatorHighlight) => {
      try {
        track("landing_creator_gallery_media_kit_click", {
          creatorId: creator.id,
          creatorRank: creator.rank,
          mediaKitSlug: creator.mediaKitSlug ?? null,
        });
      } catch { }

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
    <section id={sectionId} className="landing-section landing-section--muted landing-section--compact-top">
      <div
        ref={containerRef}
        className={`landing-section__inner landing-section__inner--wide ${containerClassName}`.trim()}
      >
        {showHeader ? (
          <header className="mb-8 flex flex-col items-center gap-3 text-center md:mb-10">
            <span className="landing-chip">
              {headingEyebrow}
            </span>
            <h2 className="text-display-lg text-brand-dark">
              {headingTitle}
            </h2>
            <p className="text-body-md font-normal text-brand-text-secondary/90">
              {headingDescription}
            </p>
          </header>
        ) : null}

        {topContent}

        <div className="relative mx-auto w-full max-w-5xl">
          <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 md:gap-5 ${gridClassName}`.trim()}>
            {loading
              ? skeletonCards.map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="flex flex-col gap-3 rounded-3xl border border-[#E8ECF5] bg-white p-3 shadow-[0_8px_18px_rgba(20,33,61,0.08)] sm:p-4"
                >
                  <div className="h-3 w-16 rounded bg-[#E8ECF5]" />
                  <div className="h-1 w-8 rounded bg-[#FFD1E5]" />
                  <div className="aspect-square w-full rounded-2xl bg-[#F1F3F8]" />
                  <div className="h-3 w-3/4 rounded bg-[#E8ECF5]" />
                  <div className="h-3 w-1/2 rounded bg-[#E8ECF5]" />
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="h-3 rounded bg-[#E8ECF5]" />
                    ))}
                  </div>
                  <div className="h-4 w-24 rounded bg-[#FFD1E5]" />
                </div>
              ))
              : visibleCreators.map((creator) => {
                if (variant === "rank") {
                  return (
                    <RankCard
                      key={creator.id}
                      creator={creator}
                      onRequestMediaKit={() => handleMediaKitClick(creator)}
                    />
                  );
                }

                const followers = creator.followers ?? 0;
                const averageInteractions = creator.avgInteractionsPerPost ?? 0;
                const engagementRate =
                  followers > 0 ? Math.max((averageInteractions / followers) * 100, 0) : undefined;
                const paletteStyles = {
                  text: creator.rank <= 3 ? "text-brand-primary" : "text-brand-dark/80",
                  divider: creator.rank <= 3 ? "bg-brand-primary/20" : "bg-brand-dark/10",
                } as const;


                return (
                  <article
                    key={creator.id}
                    className="flex flex-col gap-3 rounded-2xl border border-brand-glass bg-white/95 p-4 shadow-[0_4px_12px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <div className="flex items-center justify-between text-xs text-brand-text-secondary">
                      <span className={`font-semibold ${paletteStyles.text}`}>#{creator.rank}</span>
                      {creator.username ? <span>@{creator.username}</span> : null}
                    </div>
                    <div className={`h-1 w-10 rounded-full ${paletteStyles.divider}`} />
                    <div className="aspect-square w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                      <UserAvatar
                        name={creator.name || creator.username || 'Criador'}
                        src={creator.avatarUrl}
                        size={360}
                        className="h-full w-full rounded-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1 text-left">
                      <h3 className="text-sm font-semibold text-brand-dark">{creator.name}</h3>
                      <p className="text-xs text-brand-text-secondary">Media kit ativo</p>
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-brand-text-secondary">
                      {followers ? (
                        <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-2 py-1">
                          <span>Seguidores</span>
                          <span className="font-semibold text-brand-dark">
                            {numberFormatter.format(followers)}
                          </span>
                        </div>
                      ) : null}
                      {engagementRate ? (
                        <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-2 py-1">
                          <span>Engajamento</span>
                          <span className="font-semibold text-brand-dark">
                            {engagementRate.toFixed(1)}%
                          </span>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-2 py-1">
                        <span>Interações/post</span>
                        <span className="font-semibold text-brand-dark">
                          {numberFormatter.format(averageInteractions)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-auto flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => handleMediaKitClick(creator)}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-primary transition-colors hover:text-brand-dark"
                      >
                        Ver mídia kit →
                      </button>
                    </div>
                  </article>
                );
              })}
          </div>
        </div>

        {bottomContent}

      </div>
    </section>
  );
};

export default CreatorGallerySection;

function RankCard({
  creator,
  onRequestMediaKit,
}: {
  creator: LandingCreatorHighlight;
  onRequestMediaKit?: () => void;
}) {
  const followersText = numberFormatter.format(Math.max(creator.followers ?? 0, 0));
  const avgText = creator.avgInteractionsPerPost ? numberFormatter.format(creator.avgInteractionsPerPost) : "–";
  const engagementRate = computeEngagementRate(creator);
  const mediaKitHref = creator.mediaKitSlug ? `/mediakit/${creator.mediaKitSlug}` : null;

  return (
    <article className="flex w-full flex-col rounded-3xl border border-[#E8ECF5] bg-white shadow-[0_8px_18px_rgba(20,33,61,0.08)] transition duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between px-3 pt-3 sm:px-4">
        <div className="text-sm font-bold text-[#FF4080]">#{creator.rank}</div>
        {creator.username ? <div className="truncate text-[11px] font-semibold text-[#727C8F] sm:text-xs">@{creator.username}</div> : null}
      </div>
      <div className="mt-1 h-1 w-10 rounded-full bg-[#FF9FC4] px-3 sm:px-4" />
      <div className="px-3 sm:px-4">
        <div className="mt-3 overflow-hidden rounded-2xl bg-[#F7F8FB]">
          <UserAvatar
            name={creator.name || creator.username || 'Criador'}
            src={creator.avatarUrl}
            size={480}
            className="aspect-square w-full rounded-none"
          />
        </div>
        <div className="mt-4 space-y-0.5">
          <p className="text-sm font-semibold text-[#141C2F] leading-tight sm:text-base">{creator.name}</p>
          <p className="text-xs font-semibold text-[#8A93A6] sm:text-[13px]">
            Mídia kit {creator.mediaKitSlug ? "ativo" : "disponível mediante solicitação"}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-y-2 text-xs text-[#6E778C]">
          <span className="text-[11px] uppercase tracking-wide text-[#A3A9B6]">Seguidores</span>
          <span className="text-right text-sm font-semibold text-[#141C2F]">{followersText}</span>
          <span className="text-[11px] uppercase tracking-wide text-[#A3A9B6]">Engajamento</span>
          <span className="text-right text-sm font-semibold text-[#141C2F]">
            {engagementRate != null ? `${engagementRate.toFixed(1)}%` : "–"}
          </span>
          <span className="text-[11px] uppercase tracking-wide text-[#A3A9B6]">Interações/post</span>
          <span className="text-right text-sm font-semibold text-[#141C2F]">{avgText}</span>
        </div>
      </div>
      <div className="px-4 pb-4 pt-3">
        {mediaKitHref ? (
          <a
            href={mediaKitHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#FF4080] underline-offset-4 hover:underline"
          >
            Ver mídia kit →
          </a>
        ) : (
          <button
            type="button"
            onClick={onRequestMediaKit}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#FF4080] underline-offset-4 hover:underline"
          >
            Solicitar mídia kit →
          </button>
        )}
      </div>
    </article>
  );
}
