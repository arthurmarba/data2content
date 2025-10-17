"use client";

import React from "react";

import {
  formatCompactNumber,
  formatPercentage,
  formatPlainNumber,
} from "@/app/landing/utils/format";
import type { LandingCategoryInsight } from "@/types/landing";

type Props = {
  categories?: LandingCategoryInsight[] | null;
};

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="rounded-full bg-brand-purple/10 px-3 py-1 text-xs font-medium text-brand-purple">
    {children}
  </span>
);

const CategoryCard: React.FC<{ category: LandingCategoryInsight }> = ({ category }) => (
  <div className="flex flex-col rounded-3xl border border-black/10 bg-white p-6 shadow-sm transition hover:shadow-lg">
    <div>
      <div className="text-sm font-semibold uppercase tracking-wide text-brand-purple/90">Categoria</div>
      <h3 className="mt-2 text-2xl font-bold text-gray-900">{category.label}</h3>
      {category.description ? (
        <p className="mt-2 text-sm text-gray-600">{category.description}</p>
      ) : null}
    </div>

    <dl className="mt-6 space-y-3 text-sm text-gray-600">
      <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
        <dt>Conteúdos analisados</dt>
        <dd className="font-medium text-gray-900">{formatPlainNumber(category.postCount)}</dd>
      </div>
      <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
        <dt>Média de interações</dt>
        <dd className="font-medium text-gray-900">
          {formatCompactNumber(category.avgInteractionsPerPost)}
        </dd>
      </div>
      <div className="flex justify-between">
        <dt>Engajamento médio</dt>
        <dd className="font-medium text-gray-900">{formatPercentage(category.engagementRate)}</dd>
      </div>
      {typeof category.avgSaves === "number" && category.avgSaves > 0 ? (
        <div className="flex justify-between">
          <dt>Salvos por conteúdo</dt>
          <dd className="font-medium text-gray-900">
            {formatCompactNumber(category.avgSaves)}
          </dd>
        </div>
      ) : null}
    </dl>

    <div className="mt-6">
      <div className="text-xs font-semibold uppercase tracking-wider text-brand-purple/80">
        Formatos que mais performam
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {(category.topFormats.length ? category.topFormats : [{ id: "na", label: "Diversos formatos" }]).map((format) => (
          <Chip key={format.id}>{format.label}</Chip>
        ))}
      </div>
    </div>

    <div className="mt-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-brand-purple/80">
        Ângulos vencedores
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {(category.topProposals.length ? category.topProposals : [{ id: "na", label: "Variações" }]).map((proposal) => (
          <Chip key={proposal.id}>{proposal.label}</Chip>
        ))}
      </div>
    </div>
  </div>
);

export const CategoryInsightsSection: React.FC<Props> = ({ categories }) => {
  const items = categories?.slice(0, 4) ?? [];

  return (
    <section id="categorias" className="bg-gray-50 py-20 text-gray-900">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Inteligência por categoria</h2>
          <p className="mt-3 text-lg text-gray-600">
            Dados reais da comunidade para você entender o que está crescendo agora — por nicho, formato e proposta.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-brand-purple/30 bg-brand-purple/5 p-10 text-center text-sm text-brand-purple">
            As estatísticas estão sendo carregadas. Atualize a página em alguns segundos.
          </div>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {items.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default CategoryInsightsSection;
