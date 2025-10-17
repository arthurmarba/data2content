"use client";

import React from "react";
import Image from "next/image";

import { formatCompactNumber, formatPlainNumber } from "@/app/landing/utils/format";
import type { LandingCreatorHighlight } from "@/types/landing";

type Props = {
  creators?: LandingCreatorHighlight[] | null;
};

const getInitials = (name?: string | null) => {
  if (!name) return "C";
  const parts = name.trim().split(/\s+/);
  const [first, second] = [parts[0]?.[0], parts[1]?.[0]];
  return (first ?? "C") + (second ?? "");
};

const CreatorCard: React.FC<{ creator: LandingCreatorHighlight }> = ({ creator }) => {
  const displayFollowers =
    typeof creator.followers === "number" ? `${formatCompactNumber(creator.followers)} seguidores` : "Seguidores em atualização";

  return (
    <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm transition hover:shadow-lg">
      <div className="mb-4 flex items-center gap-4">
        {creator.avatarUrl ? (
          <div className="relative h-14 w-14 overflow-hidden rounded-full bg-brand-purple/10">
            <Image
              src={creator.avatarUrl}
              alt={`Avatar de ${creator.name}`}
              fill
              sizes="56px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-purple/10 text-lg font-bold text-brand-purple">
            {getInitials(creator.name)}
          </div>
        )}
        <div>
          <div className="text-sm font-semibold text-brand-purple/80">#{creator.rank}</div>
          <div className="text-lg font-semibold text-gray-900">{creator.name}</div>
          {creator.username ? (
            <div className="text-sm text-gray-500">@{creator.username}</div>
          ) : null}
        </div>
      </div>
      <dl className="space-y-2 text-sm text-gray-600">
        <div className="flex justify-between">
          <dt>Seguidores</dt>
          <dd className="font-medium text-gray-900">{displayFollowers}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Conteúdos na janela</dt>
          <dd className="font-medium text-gray-900">{formatPlainNumber(creator.postCount)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Interações totais</dt>
          <dd className="font-medium text-gray-900">{formatCompactNumber(creator.totalInteractions)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Média por conteúdo</dt>
          <dd className="font-medium text-gray-900">{formatCompactNumber(creator.avgInteractionsPerPost)}</dd>
        </div>
      </dl>
      {typeof creator.consistencyScore === "number" ? (
        <p className="mt-4 text-xs text-gray-500">
          Consistência: {creator.consistencyScore.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} posts/dia na janela.
        </p>
      ) : null}
    </div>
  );
};

export const TopCreatorsSection: React.FC<Props> = ({ creators }) => {
  const items = creators?.slice(0, 6) ?? [];
  return (
    <section id="ranking" className="bg-white py-20 text-gray-900">
      <div className="container mx-auto px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Quem tá brilhando esta semana</h2>
            <p className="mt-3 text-lg text-gray-600">
              Baseado em consistência e alcance recente dos criadores que compartilham seus dados com a comunidade.
            </p>
          </div>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 font-semibold text-brand-purple hover:text-brand-magenta"
          >
            Ver ranking completo (requer login)
            <span aria-hidden>→</span>
          </a>
        </div>

        {items.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-brand-purple/30 bg-brand-purple/5 p-10 text-center text-sm text-brand-purple">
            Estamos atualizando o ranking desta semana. Volte em instantes.
          </div>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default TopCreatorsSection;
