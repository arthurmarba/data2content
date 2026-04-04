"use client";

import React from "react";
import Image from "next/image";
import NextDynamic from "next/dynamic";
import { ArrowUpRight, Sparkles } from "lucide-react";
import type { DiscoverPostCard, DiscoverSection } from "./discoverFeedUtils";
import DiscoverExplorerSection from "./DiscoverExplorerSection";

const DiscoverActionBar = NextDynamic(() => import("./DiscoverActionBar"), { ssr: false });

type DiscoverBoardContentProps = {
  allowedPersonalized: boolean;
  featuredSection?: DiscoverSection | null;
  sections: DiscoverSection[];
  primaryKey?: string | null;
  showFloatingActionBar?: boolean;
  compactView?: boolean;
  desktopCompactPreview?: boolean;
};

const compactFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCompactValue(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  try {
    return compactFormatter.format(value);
  } catch {
    return String(value);
  }
}

function formatSectionLabel(key?: string | null, fallback?: string | null) {
  const normalized = (key || "").trim();
  if (normalized === "rising_72h") return "Em ascensao";
  if (normalized === "trending") return "Virais agora";
  if (normalized === "top_saved") return "Muito salvos";
  if (normalized === "top_comments") return "Gera conversa";
  if (normalized === "top_shares") return "Muito compartilhados";
  if (normalized === "user_suggested" || normalized === "personalized") return "Curadoria do seu nicho";
  return fallback || "Curadoria da comunidade";
}

function FeaturedStory({
  section,
  compactView,
}: {
  section?: DiscoverSection | null;
  compactView?: boolean;
}) {
  const featuredItem = section?.items?.[0] as DiscoverPostCard | undefined;

  if (!section || !featuredItem?.coverUrl) {
    return null;
  }

  const title = formatSectionLabel(section.key, section.title);
  const views = formatCompactValue(
    featuredItem.stats?.views ?? featuredItem.stats?.total_interactions ?? null,
  );
  const saves = formatCompactValue(featuredItem.stats?.saved ?? null);
  const creatorName = featuredItem.creatorName?.trim() || "Criador da comunidade";
  const caption = (featuredItem.caption || "").trim();
  const summary =
    caption.length > 140 ? `${caption.slice(0, 137)}...` : caption || "Referencia recente para repertorio, angulo e execucao visual.";
  const details = [
    views ? { label: "Views", value: views } : null,
    saves ? { label: "Salvos", value: saves } : null,
    section.items?.length ? { label: "Posts", value: String(section.items.length) } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const content = (
    compactView ? (
      <div className="dashboard-dark-spotlight relative overflow-hidden rounded-[24px] p-5 shadow-[0_12px_24px_rgba(15,23,42,0.1)]">
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-pink-500/20 blur-[50px]" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <span className="dashboard-muted-label inline-flex items-center gap-1.5 rounded-full border border-pink-500/20 bg-pink-500/10 px-2.5 py-1 text-pink-200">
              <Sparkles className="h-3 w-3" />
              CURADORIA
            </span>
            {details[0] ? (
              <span className="dashboard-type-meta text-zinc-400">
                {details[0].value} {details[0].label.toLowerCase()}
              </span>
            ) : null}
          </div>

          <div className="mt-6">
            <h3 className="dashboard-type-section-title text-white">
              {creatorName}
            </h3>
            <p className="dashboard-type-body mt-2 line-clamp-3 text-zinc-300">
              {summary}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {details.slice(1).map((item) => (
              <span
                key={`${item.label}-${item.value}`}
                className="dashboard-type-control inline-flex items-center rounded-full bg-white/6 px-3 py-1.5 text-zinc-200"
              >
                {item.value} {item.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    ) : (
      <div className="dashboard-dark-spotlight relative overflow-hidden rounded-[28px] shadow-[0_20px_48px_rgba(15,23,42,0.16)]">
        <div className="absolute inset-0">
          <Image
            src={featuredItem.coverUrl}
            alt={caption || section.title || "Conteudo em destaque da comunidade"}
            fill
            sizes="(min-width: 1280px) 560px, 100vw"
            className="object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.12),rgba(15,23,42,0.28)_35%,rgba(15,23,42,0.82)_100%)]" />

        <div className="relative flex h-full min-h-[300px] flex-col justify-between p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="max-w-[75%]">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/88 backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5" />
                {title}
              </span>
            </div>
            {details[0] ? (
              <div className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[11px] font-semibold text-white/88 backdrop-blur-sm">
                {details[0].value} {details[0].label}
              </div>
            ) : null}
          </div>

          <div>
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60">
                Criador em destaque
              </p>
              <h2 className="mt-2 text-[clamp(1.6rem,3vw,2.3rem)] font-bold tracking-tight text-white">
                {creatorName}
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-white/82 sm:text-[15px]">
                {summary}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {details.slice(1).map((item) => (
                <span
                  key={`${item.label}-${item.value}`}
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/7 px-3 py-1.5 text-xs font-semibold text-white/84 backdrop-blur-sm"
                >
                  {item.label}: {item.value}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  );

  if (featuredItem.postLink) {
    return (
      <a
        href={featuredItem.postLink}
        target="_blank"
        rel="noreferrer"
        className="group block"
        aria-label={`Abrir conteudo em destaque de ${creatorName}`}
      >
        {content}
        <span className="sr-only">Abrir no Instagram</span>
      </a>
    );
  }

  return content;
}

export default function DiscoverBoardContent({
  allowedPersonalized,
  featuredSection,
  sections,
  primaryKey,
  showFloatingActionBar = false,
  compactView = false,
  desktopCompactPreview = false,
}: DiscoverBoardContentProps) {
  const sectionCount = sections.length + (featuredSection ? 1 : 0);
  const totalItems = (featuredSection?.items?.length || 0) + sections.reduce((sum, section) => sum + (section.items?.length || 0), 0);

  if (!featuredSection && sections.length === 0) {
    return (
      <div className={desktopCompactPreview ? "px-5 pb-5 pt-1" : compactView ? "p-4" : "p-4 sm:p-5"}>
        <div className="dashboard-empty-state rounded-[1.35rem] border border-dashed border-zinc-200/80 px-4 py-6 text-sm text-zinc-500">
          Nenhuma coleção disponível para exibir agora. Tente novamente em instantes ou ajuste os filtros.
        </div>
      </div>
    );
  }

  return (
    <div className={desktopCompactPreview ? "space-y-5 px-5 pb-5 pt-1" : compactView ? "space-y-5 px-2 pb-6 pt-2" : "space-y-4.5 p-4 sm:p-5"}>
      {featuredSection ? (
        <section className="space-y-2.5">
          <div className={`flex ${compactView ? "items-start gap-3.5" : "flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"}`}>
            <div className="min-w-0 flex-1">
              <h2 className={`dashboard-type-board-title text-zinc-950 ${compactView ? "max-w-[13rem] leading-tight text-[1.05rem]" : "text-[clamp(1.45rem,2.5vw,2rem)]"}`}>
                Referencias vivas para repertorio, angulo e execucao
              </h2>
            </div>
            <div className={`flex ${compactView ? "shrink-0 flex-col gap-2" : "flex-wrap gap-2"}`}>
              <span className="dashboard-type-control inline-flex items-center rounded-full border border-zinc-200/70 bg-white/78 px-3 py-1.5 text-zinc-600">
                {sectionCount} coleções
              </span>
              <span className="dashboard-type-control inline-flex items-center rounded-full border border-zinc-200/70 bg-white/78 px-3 py-1.5 text-zinc-600">
                {totalItems} posts
              </span>
              {!compactView && allowedPersonalized ? (
                <span className="dashboard-type-control inline-flex items-center rounded-full border border-rose-200/80 bg-rose-50/90 px-3 py-1.5 text-rose-700">
                  Curadoria personalizada
                </span>
              ) : null}
            </div>
          </div>

          <FeaturedStory section={featuredSection} compactView={compactView} />
        </section>
      ) : null}

      {showFloatingActionBar ? (
        <DiscoverActionBar allowedPersonalized={allowedPersonalized} />
      ) : null}

      <DiscoverExplorerSection
        sections={sections}
        primaryKey={primaryKey}
        compactView={compactView}
        desktopCompactPreview={desktopCompactPreview}
      />

      {!compactView && featuredSection?.items?.[0]?.postLink ? (
        <div className="pt-0.5 flex justify-end">
          <a
            href={featuredSection.items[0].postLink}
            target="_blank"
            rel="noreferrer"
            className="dashboard-type-control inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-white/72 px-4 py-2 text-zinc-700 transition hover:border-zinc-300 hover:bg-white hover:text-zinc-900"
          >
            Abrir destaque
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      ) : null}
    </div>
  );
}
