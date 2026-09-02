"use client";

import Link from "next/link";

import type { LandingCreatorHighlight } from "@/types/landing";

/* A faixa é prova social clicável, não decoração: cada chip abre o Media Kit
   público do creator, então precisa de alvo grande, @ e seguidores à vista, e
   pausa no hover — sem pausa ninguém consegue clicar num alvo em movimento. */

function formatFollowers(followers?: number | null) {
  if (!followers || followers <= 0) return null;
  if (followers >= 1_000_000) {
    const millions = followers / 1_000_000;
    return `${millions.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi seguidores`;
  }
  if (followers >= 1_000) {
    return `${Math.round(followers / 1_000)} mil seguidores`;
  }
  return `${followers} seguidores`;
}

/* Mesma origem absoluta que o showcase antigo já usava: em desenvolvimento a
   rota local não tem os avatares, e o caminho relativo devolvia imagem quebrada
   em toda a faixa. */
function avatarUrl(mediaKitSlug: string) {
  return `https://data2content.ai/api/mediakit/${encodeURIComponent(mediaKitSlug)}/avatar?v=20260723-community-v3`;
}

type CreatorMarqueeProps = {
  creators: LandingCreatorHighlight[];
};

export function CreatorMarquee({ creators }: CreatorMarqueeProps) {
  const usable = creators.filter((creator) => Boolean(creator.mediaKitSlug));

  if (usable.length === 0) return null;

  /* A faixa roda até -50%: o conteúdo precisa estar duplicado para o laço
     fechar sem salto. */
  const loop = [...usable, ...usable];

  return (
    <div className="d2c-v6-marquee d2c-v6-marquee--creators">
      <div className="d2c-v6-marquee__track">
        {loop.map((creator, position) => {
          const duplicate = position >= usable.length;
          const followers = formatFollowers(creator.followers);
          const handle = creator.username ? `@${creator.username.replace(/^@/, "")}` : creator.name;

          return (
            <Link
              key={`${creator.id}-${position}`}
              className="d2c-v6-chip"
              href={`/mediakit/${creator.mediaKitSlug}`}
              target="_blank"
              rel="noreferrer"
              tabIndex={duplicate ? -1 : undefined}
              aria-hidden={duplicate || undefined}
              aria-label={`Abrir o Media Kit de ${creator.name}`}
            >
              <span className="d2c-v6-chip__avatar">
                {/* next/image não ajuda aqui: a URL é uma rota dinâmica de
                    avatar e o tamanho é fixo e pequeno. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarUrl(creator.mediaKitSlug!)} alt="" loading="lazy" decoding="async" />
              </span>
              <span className="d2c-v6-chip__text">
                <b>{handle}</b>
                {followers && <small>{followers}</small>}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
