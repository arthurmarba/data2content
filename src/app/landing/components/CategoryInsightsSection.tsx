"use client";

import React from "react";

import { formatPercentage } from "@/app/landing/utils/format";
import type { LandingCategoryInsight } from "@/types/landing";

type Props = {
  categories?: LandingCategoryInsight[] | null;
};

const CATEGORY_EMOJIS = ["👤", "🎓", "🎨", "❤️‍🔥"];

const clampPercentage = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.min(100, Math.max(0, value * 100));
};

const CategoryCard: React.FC<{ category: LandingCategoryInsight; href: string; index: number }> = ({
  category,
  href,
  index,
}) => {
  const emoji = CATEGORY_EMOJIS[index % CATEGORY_EMOJIS.length];
  const engagementPct = clampPercentage(category.engagementRate);
  const engagementLabel =
    typeof category.engagementRate === "number" ? formatPercentage(category.engagementRate) : "—";
  const progressWidth =
    engagementPct === null ? "14%" : `${Math.max(12, Math.round(engagementPct))}%`;

  const topFormat = category.topFormats[0]?.label ?? "Diversos formatos";
  const topProposal = category.topProposals[0]?.label ?? "Ângulos variados";

  const backgroundColor = index % 2 === 0 ? "#FFFFFF" : "#FAFAFA";

  return (
    <article
      tabIndex={0}
      role="button"
      onClick={() => {
        if (typeof window !== "undefined") window.location.href = href;
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (typeof window !== "undefined") window.location.href = href;
        }
      }}
      className="flex flex-col gap-6 rounded-3xl border border-[#EAEAEA] p-6 text-left shadow-[0_6px_20px_rgba(0,0,0,0.05)] transition hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(0,0,0,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/25 md:flex-row md:items-center md:gap-8 lg:p-8"
      style={{ backgroundColor }}
    >
      <div className="flex-1 space-y-6">
        <header className="space-y-2">
          <h3 className="flex items-center gap-3 text-2xl font-semibold text-[#1A1A1A]">
            <span aria-hidden="true" className="text-[1.9rem] leading-none" style={{ opacity: 0.85 }}>
              {emoji}
            </span>
            {category.label}
          </h3>
          {category.description ? (
            <p className="text-sm text-[#555555] md:text-base">{category.description}</p>
          ) : null}
        </header>

        <section>
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-[#777777]">
            <span className="font-semibold text-[#1A1A1A]">Engajamento médio</span>
            <span className="text-[#F6007B]">{engagementLabel}</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-[#F2F2F2]">
            <div
              className="h-full rounded-full transition-[width]"
              style={{ width: progressWidth, backgroundColor: "#F6007B" }}
            />
          </div>
          <div className="mt-4 space-y-2 text-sm text-[#555555]">
            <p>
              <strong className="text-base font-semibold text-[#F6007B]">{engagementLabel}</strong>
              {" "}engajamento — Formato: <strong className="font-semibold text-[#1A1A1A]">{topFormat}</strong> | Ângulo: <strong className="font-semibold text-[#1A1A1A]">{topProposal}</strong>
            </p>
            <p>
              <strong className="font-semibold text-[#1A1A1A]">{category.totalInteractions.toLocaleString("pt-BR")}</strong> interações na janela.
            </p>
          </div>
        </section>
      </div>
    </article>
  );
};

export const CategoryInsightsSection: React.FC<Props> = ({ categories }) => {
  const items = categories?.slice(0, 4) ?? [];
  const insightsHref =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
      : "/login";

  return (
    <section id="categorias" className="bg-[#FAFAFA] py-14 text-[#1A1A1A] md:py-20 lg:py-24 xl:py-28">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl lg:max-w-4xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-[#1A1A1A] md:text-4xl lg:text-[2.6rem]">
            O que está bombando agora com base nos dados reais da comunidade.
          </h2>
          <p className="mt-3 text-lg text-[#555555] lg:text-xl">
            Painel vivo para orientar seu próximo conteúdo. Tudo alimentado pelos resultados dos criadores que já estão dentro da Data2Content.
          </p>
          <a
            href={insightsHref}
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#F6007B] transition hover:text-[#d40068]"
          >
            Ver mais insights da comunidade
            <span aria-hidden="true">→</span>
          </a>
        </div>

        {items.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-[#EAEAEA] bg-white p-12 text-center text-sm text-[#777777] shadow-[0_8px_28px_rgba(0,0,0,0.04)] sm:mt-12 lg:mt-14">
            As estatísticas estão sendo atualizadas. Tente novamente em instantes.
          </div>
        ) : (
          <div className="mt-12 grid gap-6 lg:gap-8">
            {items.map((category, index) => (
              <CategoryCard key={category.id} category={category} href={insightsHref} index={index} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default CategoryInsightsSection;
