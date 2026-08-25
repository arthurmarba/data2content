"use client";

import { useState } from "react";

import { ProfileSectionHeader } from "./ProfileSectionHeader";

/**
 * Inspiração no assunto do criador.
 *
 * O que mais rendeu no território dele — "Maternidade", "Culinária" — entre os
 * criadores da D2C nos últimos 30 dias. Não é o viral genérico do Instagram: é
 * repertório de quem fala do mesmo assunto, que é o que dá ideia de pauta.
 *
 * A origem aparece escrita na tela ("entre criadores da D2C"), porque uma lista
 * de "mais vistos" sem dizer entre quem sugere um universo que não é o nosso.
 */

export interface TerritoryTrendPost {
  id: string;
  description: string;
  creatorName: string | null;
  coverUrl: string | null;
  postLink: string | null;
  views: number | null;
  interactions: number | null;
}

function formatCount(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function metricLine(post: TerritoryTrendPost) {
  const views = formatCount(post.views);
  if (views) return { value: views, label: "visualizações" };
  const interactions = formatCount(post.interactions);
  if (interactions) return { value: interactions, label: "interações" };
  return null;
}

function Cover({ url, className }: { url: string | null; className: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`${className} object-cover`} />;
  }
  return <span className={`${className} bg-[var(--ds-color-neutral)]`} aria-hidden="true" />;
}

export function ProfileTerritoryTrends({
  territory,
  posts,
  onOpenPost,
}: {
  territory: string;
  posts: TerritoryTrendPost[];
  onOpenPost?: (post: TerritoryTrendPost) => void;
}) {
  const [open, setOpen] = useState(false);
  if (posts.length === 0) return null;

  const [lead, ...rest] = posts;
  if (!lead) return null;
  const leadMetric = metricLine(lead);

  const openPost = (post: TerritoryTrendPost) => {
    onOpenPost?.(post);
    if (post.postLink) window.open(post.postLink, "_blank", "noreferrer");
  };

  return (
    <section aria-labelledby="territory-trends-title">
      {/* "Trends do seu território": o assunto da seção é o TERRITÓRIO, e o nome
          dele aparece na linha de cada post — repeti-lo no cabeçalho gastava a
          largura do título com a palavra que já está três vezes abaixo. */}
      <ProfileSectionHeader id="territory-trends-title" title="Trends do seu território" />

      <div className="ds-card-stamp mt-4 rounded-[16px] border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)] p-4">
        <button type="button" onClick={() => openPost(lead)} className="flex w-full gap-3 text-left">
          <Cover url={lead.coverUrl} className="min-h-[104px] w-[76px] shrink-0 rounded-[10px]" />
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold leading-[1.28] tracking-[-0.005em] text-[var(--ds-color-ink)]">
              {lead.description}
            </span>
            {/* Quem postou E em que assunto: sem o segundo, a lista parece um
                ranking geral do Instagram em vez do recorte do território. */}
            {lead.creatorName || territory ? (
              <span className="mt-1.5 block text-[12px] leading-[1.3] text-[var(--ds-color-text-muted)]">
                {[lead.creatorName, territory.toLocaleLowerCase("pt-BR")].filter(Boolean).join(" · ")}
              </span>
            ) : null}
            {leadMetric ? (
              <span className="mt-2 flex items-baseline gap-[7px]">
                <b className="text-[24px] font-bold leading-none tracking-[-0.035em] tabular-nums text-[var(--ds-color-ink)]">
                  {leadMetric.value}
                </b>
                <span className="text-[12px] font-medium text-[var(--ds-color-text-muted)]">{leadMetric.label}</span>
              </span>
            ) : null}
          </span>
        </button>

        {open && rest.length > 0 ? (
          <div className="mt-3.5 border-t border-dashed border-[var(--ds-color-line)] pt-3">
            {rest.map((post) => {
              const metric = metricLine(post);
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => openPost(post)}
                  className="flex w-full items-center gap-2.5 py-[7px] text-left"
                >
                  <Cover url={post.coverUrl} className="h-[44px] w-[32px] shrink-0 rounded-[6px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium leading-[1.3] text-[var(--ds-color-ink)]">
                      {post.description}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-[1.2] text-[var(--ds-color-text-muted)]">
                      {[post.creatorName, metric ? `${metric.value} ${metric.label}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {rest.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="mt-3.5 flex w-full items-center justify-between text-[12.5px] font-semibold text-[var(--ds-color-text-secondary)]"
          >
            <span>{open ? "Fechar a lista" : `Ver os ${posts.length} mais vistos do mês`}</span>
            <span aria-hidden="true" className="text-[var(--ds-color-text-muted)]">{open ? "–" : "+"}</span>
          </button>
        ) : null}

        <p className="ds-caption mt-2">Entre criadores da D2C que falam do mesmo assunto, nos últimos 30 dias.</p>
      </div>
    </section>
  );
}
