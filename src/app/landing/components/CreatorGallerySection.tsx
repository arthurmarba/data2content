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

function getInitials(name?: string | null, username?: string | null) {
  const source = (name || username || "D2C").trim();
  if (!source) return "D2C";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const clean = (parts[0] ?? "").replace(/^@/, "");
    return clean.slice(0, 2).toUpperCase() || "D2C";
  }
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  const initials = (first + second).trim();
  return initials ? initials.toUpperCase() : "D2C";
}

function pickFallbackBg(seed?: string | null) {
  const text = seed ?? "";
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[index];
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
      <div className={`landing-section__inner landing-section__inner--wide ${containerClassName}`.trim()}>
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
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-[36px] bg-[radial-gradient(70%_120%_at_15%_0%,rgba(255,44,126,0.15),transparent_55%),radial-gradient(80%_120%_at_85%_10%,rgba(36,107,253,0.18),transparent_60%)]" />
          <div className={`grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5 ${gridClassName}`.trim()}>
            {loading
              ? skeletonCards.map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                >
                  <div className="aspect-square w-full rounded-lg bg-neutral-200" />
                  <div className="h-3 w-3/4 rounded bg-neutral-200" />
                  <div className="h-3 w-1/2 rounded bg-neutral-200" />
                  <div className="h-3 w-4/5 rounded bg-neutral-200" />
                </div>
              ))
              : visibleCreators.map((creator) => {
                const followers = creator.followers ?? 0;
                const averageInteractions = creator.avgInteractionsPerPost ?? 0;
                const engagementRate =
                  followers > 0 ? Math.max((averageInteractions / followers) * 100, 0) : undefined;
                const paletteStyles = {
                  text: creator.rank <= 3 ? "text-brand-primary" : "text-brand-dark/80",
                  divider: creator.rank <= 3 ? "bg-brand-primary/20" : "bg-brand-dark/10",
                } as const;
                const initials = getInitials(creator.name, creator.username);
                const fallbackBg = pickFallbackBg(creator.id || creator.username || creator.name);

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
                      {creator.avatarUrl ? (
                        <Image
                          src={creator.avatarUrl}
                          alt={creator.name}
                          width={360}
                          height={360}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className={`flex h-full w-full items-center justify-center text-lg font-bold text-white ${fallbackBg}`}
                          aria-label={`Avatar de ${creator.name}`}
                        >
                          {initials}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 text-left">
                      <h3 className="text-sm font-semibold text-brand-dark">{creator.name}</h3>
                      <p className="text-xs text-brand-text-secondary">Media kit ativo</p>
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-brand-text-secondary">
                      {followers ? (
                        <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-2 py-1">
                          <span>Alcance</span>
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
