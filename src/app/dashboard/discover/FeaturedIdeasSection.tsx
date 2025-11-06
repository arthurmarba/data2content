"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { UserAvatar } from "@/app/components/UserAvatar";
import { idsToLabels } from "@/app/lib/classification";

type PostCard = {
  id: string;
  coverUrl?: string | null;
  caption?: string;
  creatorName?: string;
  creatorAvatarUrl?: string | null;
  postLink?: string;
  postDate?: string;
  stats?: {
    views?: number;
    total_interactions?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
  categories?: {
    format?: string[];
    proposal?: string[];
    context?: string[];
    tone?: string[];
    references?: string[];
  };
};

type CreatorHighlight = {
  key: string;
  name: string;
  avatarUrl?: string | null;
  topPost: PostCard;
  highLabel: string;
  contextLabel: string;
};

type FeaturedIdeasSectionProps = {
  items: PostCard[];
  totalItems: number;
};

function formatCompact(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  try {
    return value.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
  } catch {
    return String(value);
  }
}

function getPriorityMetric(item: PostCard): number {
  const stats = item.stats || {};
  return stats.views ?? stats.total_interactions ?? stats.likes ?? stats.comments ?? stats.shares ?? 0;
}

function buildHighlightLabel(item: PostCard): string {
  const stats = item.stats || {};
  if (typeof stats.views === "number" && stats.views > 0) {
    const views = formatCompact(stats.views);
    return views ? `${views} views` : "Engajamento em alta";
  }
  if (typeof stats.total_interactions === "number" && stats.total_interactions > 0) {
    const total = formatCompact(stats.total_interactions);
    return total ? `${total} interações` : "Interações acima da média";
  }
  if (typeof stats.shares === "number" && stats.shares > 0) {
    const total = formatCompact(stats.shares);
    return total ? `${total} compartilhamentos` : "Compartilhado pela comunidade";
  }
  return "Destaque da comunidade";
}

function extractContextLabel(item: PostCard): string {
  const context = idsToLabels(item.categories?.context, "context");
  if (context[0]) return context[0];
  const proposal = idsToLabels(item.categories?.proposal, "proposal");
  if (proposal[0]) return proposal[0];
  const tone = idsToLabels(item.categories?.tone, "tone");
  if (tone[0]) return tone[0];
  return "Geral";
}

export default function FeaturedIdeasSection({ items, totalItems }: FeaturedIdeasSectionProps) {
  const ranking = useMemo<CreatorHighlight[]>(() => {
    const map = new Map<string, CreatorHighlight>();

    items.forEach((item) => {
      const baseKey = (item.creatorName || "").trim() || item.id;
      const key = baseKey.toLowerCase();
      const metric = getPriorityMetric(item);

      const current = map.get(key);
      if (!current || metric > getPriorityMetric(current.topPost)) {
        map.set(key, {
          key,
          name: item.creatorName || "Criador",
          avatarUrl: item.creatorAvatarUrl,
          topPost: item,
          highLabel: buildHighlightLabel(item),
          contextLabel: extractContextLabel(item),
        });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => getPriorityMetric(b.topPost) - getPriorityMetric(a.topPost))
      .slice(0, 6);
  }, [items]);

  if (!ranking.length) return null;

  return (
    <section aria-label="Ranking de criadores do seu nicho" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ranking do seu nicho</p>
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Top criadores analisados pela IA</h2>
          </div>
          <Link
            href="/dashboard/instagram/faq"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            Ver todos
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <p className="text-xs text-slate-500">
          {ranking.length} criadores com maior desempenho entre os {totalItems} conteúdos analisados nas últimas 48h.
        </p>

        <div className="relative -mx-2 overflow-x-auto pb-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white via-white to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white via-white to-transparent" />
          <div className="flex snap-x snap-mandatory gap-3 px-2">
            {ranking.map((highlight, index) => {
              const { topPost } = highlight;
              const caption = (topPost.caption || "").split("\n")[0]?.trim() || "Conteúdo em destaque do nicho.";

              return (
                <article
                  key={highlight.key}
                  className="min-w-[180px] max-w-[200px] snap-center rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-left shadow-sm transition hover:-translate-y-1 hover:border-brand-magenta/40 hover:shadow-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-brand-magenta px-2 py-0.5 text-[10px] font-semibold text-white">
                      #{index + 1}
                    </span>
                    <div className="flex min-w-0 items-center gap-2">
                      <UserAvatar name={highlight.name} src={highlight.avatarUrl || undefined} size={28} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 line-clamp-1">{highlight.name}</p>
                        <p className="text-[10px] text-brand-magenta line-clamp-1">{highlight.contextLabel}</p>
                      </div>
                    </div>
                  </div>
                  <div className="relative mt-2 h-20 overflow-hidden rounded-lg bg-slate-200">
                    {topPost.coverUrl ? (
                      <Image
                        src={topPost.coverUrl}
                        alt={caption}
                        fill
                        className="object-cover"
                        sizes="200px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                        Sem imagem
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-slate-600 line-clamp-2">{caption}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-slate-700">
                    <span>{highlight.highLabel}</span>
                    {topPost.postLink ? (
                      <a
                        href={topPost.postLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-magenta hover:text-brand-red"
                      >
                        ver
                        <ArrowUpRight className="h-3 w-3" aria-hidden />
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>Dados atualizados em tempo real com sinais da IA.</span>
          <Link
            href="/planning/demo"
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-magenta hover:text-brand-red"
          >
            Ver benchmarking completo
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
