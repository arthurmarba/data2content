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

const MedalIcon: React.FC<{ stroke: string }> = ({ stroke }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke={stroke}
    strokeWidth={1.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M8.5 13L7 20" />
    <path d="M15.5 13L17 20" />
    <path d="M9 16H15" />
  </svg>
);

interface CreatorCardProps {
  creator: LandingCreatorHighlight;
  className?: string;
  badge?: React.ReactNode;
  onClick?: () => void;
  avatarWrapperClassName?: string;
  borderClasses?: string;
}

const CreatorCard: React.FC<CreatorCardProps> = ({
  creator,
  className = "",
  badge,
  onClick,
  avatarWrapperClassName,
  borderClasses,
}) => {
  const displayFollowers =
    typeof creator.followers === "number" ? `${formatCompactNumber(creator.followers)} seguidores` : "Seguidores em atualização";
  const displayRank = `${creator.rank}º`;

  return (
    <div
      className={`rounded-3xl border bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition hover:-translate-y-1 hover:shadow-[0_8px_18px_rgba(0,0,0,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/25 ${onClick ? "cursor-pointer" : ""} ${borderClasses ?? ""} ${className}`}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? "button" : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {badge ? <div className="mb-5 flex justify-start">{badge}</div> : null}
      <div className="mb-4 flex items-center gap-4">
        {creator.avatarUrl ? (
          <div
            className={`relative h-14 w-14 overflow-hidden rounded-full bg-[#F4F4F4] ${avatarWrapperClassName ?? ""}`}
          >
            <Image
              src={creator.avatarUrl}
              alt={`Avatar de ${creator.name}`}
              fill
              sizes="56px"
              className="object-cover"
            />
          </div>
        ) : (
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-magenta/15 via-white to-brand-purple/10 text-lg font-semibold text-brand-magenta ${avatarWrapperClassName ?? ""}`}
          >
            D2C
          </div>
        )}
        <div>
          <div className="text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-brand-text-secondary md:text-sm">
            {displayRank}
          </div>
          <div className="text-xl font-semibold leading-snug text-brand-dark md:text-2xl">{creator.name}</div>
          {creator.username ? (
            <div className="text-sm text-brand-text-secondary md:text-base">@{creator.username}</div>
          ) : null}
        </div>
      </div>
      <dl className="space-y-3 text-sm text-brand-text-secondary md:text-base">
        <div className="flex justify-between">
          <dt className="font-semibold text-brand-dark">Seguidores</dt>
          <dd className="font-semibold text-brand-dark">{displayFollowers}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-semibold text-brand-dark">Conteúdos na janela</dt>
          <dd className="font-semibold text-brand-dark">{formatPlainNumber(creator.postCount)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-semibold text-brand-dark">Interações totais</dt>
          <dd className="font-semibold text-brand-dark">{formatCompactNumber(creator.totalInteractions)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-semibold text-brand-dark">Média por conteúdo</dt>
          <dd className="font-semibold text-brand-dark">{formatCompactNumber(creator.avgInteractionsPerPost)}</dd>
        </div>
      </dl>
      {typeof creator.consistencyScore === "number" ? (
        <p className="mt-4 text-sm text-brand-text-secondary">
          <strong className="font-semibold text-brand-dark">Consistência:</strong>{" "}
          {creator.consistencyScore.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} posts/dia na janela.
        </p>
      ) : null}
    </div>
  );
};

export const TopCreatorsSection: React.FC<Props> = ({ creators }) => {
  const items = creators?.slice(0, 6) ?? [];
  const topThree = items.slice(0, 3);
  const others = items.slice(3);

  const medalThemes: Array<{
    label: string;
    cardBorders: string;
    ringClasses: string;
    icon: React.ReactElement;
    badgeClasses: string;
  }> = [
    {
      label: "Top 1 • Inspirador da semana",
      cardBorders: "border-[#EAD9A0]",
      ringClasses: "ring-2 ring-[#EAD9A0] ring-offset-2",
      icon: <MedalIcon stroke="#8B7738" />,
      badgeClasses: "border border-[#EAD9A0] text-[#8B7738]",
    },
    {
      label: "Top 2",
      cardBorders: "border-[#D8D8D8]",
      ringClasses: "ring-2 ring-[#D8D8D8] ring-offset-2",
      icon: <MedalIcon stroke="#666666" />,
      badgeClasses: "border border-[#D8D8D8] text-[#585858]",
    },
    {
      label: "Top 3",
      cardBorders: "border-[#E0E0E0]",
      ringClasses: "ring-2 ring-[#E0E0E0] ring-offset-2",
      icon: <MedalIcon stroke="#8B5A32" />,
      badgeClasses: "border border-[#E0E0E0] text-[#7A4A2A]",
    },
  ];

  return (
    <section id="ranking" className="border-t border-[#E6EAFB] bg-[#FBFBFD] py-16 text-brand-dark md:py-20">
      <div className="container mx-auto px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between lg:gap-10">
          <div className="max-w-2xl space-y-2 lg:max-w-3xl">
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brand-text-secondary md:text-sm">
              📈 Crescimento consistente. Resultados compartilhados.
            </p>
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brand-text-secondary md:text-sm">
              Destaques da semana
            </p>
            <h2 className="mt-3 text-[2rem] font-semibold leading-tight md:text-[2.5rem]">
              Quem está puxando o ritmo nesta semana
            </h2>
            <p className="mt-3 text-base leading-relaxed text-brand-text-secondary md:text-lg">
              A curadoria de resultados mais consistentes da comunidade. Cada destaque aqui abre bastidores e indicadores para o próximo criador evoluir.
            </p>
          </div>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-base font-semibold text-[#F6007B] transition hover:text-[#d40068] md:text-lg"
          >
            Ver ranking completo (requer login)
            <span aria-hidden="true">→</span>
          </a>
        </div>

        {items.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-[#EAEAEA] bg-white p-12 text-center text-sm text-[#777777] shadow-[0_10px_32px_rgba(0,0,0,0.04)] sm:mt-12 lg:mt-14">
            Estamos atualizando o ranking desta semana. Volte em instantes.
          </div>
        ) : (
          <>
            <div className="mt-10 grid gap-5 sm:gap-6 md:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-7 xl:gap-9">
            {topThree.map((creator, index) => {
              const theme = medalThemes[index];
              const topCardClass = index === 0 ? "hover:[&_img]:brightness-110" : "hover:[&_img]:brightness-105";
                return (
                  <CreatorCard
                    key={creator.id}
                    creator={creator}
                    borderClasses={`${theme?.cardBorders ?? ""} ${topCardClass}`}
                    avatarWrapperClassName={theme ? `${theme.ringClasses} bg-white` : undefined}
                    badge={
                      theme ? (
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${theme.badgeClasses}`}
                        >
                          {theme.icon}
                          {theme.label}
                        </span>
                      ) : null
                    }
                    onClick={() => {
                      if (typeof window !== "undefined") window.location.href = "/dashboard";
                    }}
                  />
                );
              })}
            </div>
            {others.length ? (
              <div className="mt-10 flex gap-4 overflow-x-auto pb-2">
                {others.map((creator) => (
                  <CreatorCard
                    key={creator.id}
                    creator={creator}
                    className="min-w-[220px] flex-1 border-[#EAEAEA]"
                    avatarWrapperClassName="h-12 w-12"
                    onClick={() => {
                      if (typeof window !== "undefined") window.location.href = "/dashboard";
                    }}
                  />
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
};

export default TopCreatorsSection;
