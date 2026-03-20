"use client";

import React, { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import GlobalPeriodIndicator from "./GlobalPeriodIndicator";
import { getCategoryById } from "@/app/lib/classification";
import { v2IdsToLabels } from "@/app/lib/classificationV2";
import { v25IdsToLabels } from "@/app/lib/classificationV2_5";

type CategoryKey =
  | 'format'
  | 'proposal'
  | 'context'
  | 'tone'
  | 'references'
  | 'contentIntent'
  | 'narrativeForm'
  | 'contentSignals'
  | 'stance'
  | 'proofStyle'
  | 'commercialMode';
type MetricKey = 'posts' | 'avg_total_interactions';

interface Props {
  startDate: string;
  endDate: string;
  apiPrefix?: string;
  limit?: number;
  selectedUserId?: string | null;
  onlyActiveSubscribers?: boolean;
  contextFilter?: string;
  creatorContextFilter?: string;
}

interface RankItem { category: string; value: number; }
type CategoryRankingsBatch = Record<CategoryKey, Record<MetricKey, RankItem[]>>;

interface CategorySection {
  key: CategoryKey;
  title: string;
  description: string;
}

const EDITORIAL_SECTIONS: CategorySection[] = [
  { key: 'format', title: 'Formato', description: 'Como o conteúdo se apresenta em mídia e estrutura visual.' },
  { key: 'context', title: 'Contexto', description: 'Tema central e território editorial do conteúdo.' },
  { key: 'proposal', title: 'Proposta (legado)', description: 'Leitura histórica do ângulo editorial antes da V2.' },
  { key: 'tone', title: 'Tom', description: 'Clima emocional ou atitudinal predominante.' },
  { key: 'references', title: 'Referências', description: 'Âncoras culturais, sociais ou geográficas evocadas no conteúdo.' },
];

const STRATEGIC_SECTIONS: CategorySection[] = [
  { key: 'contentIntent', title: 'Intenção de Conteúdo', description: 'Objetivo principal do post na estratégia editorial.' },
  { key: 'narrativeForm', title: 'Forma Narrativa', description: 'Estrutura usada para executar a ideia do conteúdo.' },
  { key: 'contentSignals', title: 'Sinais de Conteúdo', description: 'CTAs, publis e sinais acessórios extraídos do post.' },
  { key: 'stance', title: 'Postura', description: 'Posicionamento do conteúdo diante do tema ou objeto analisado.' },
  { key: 'proofStyle', title: 'Estilo de Prova', description: 'Tipo de evidência usada para sustentar a mensagem.' },
  { key: 'commercialMode', title: 'Modo Comercial', description: 'Mecânica comercial predominante quando o post busca conversão.' },
];

function resolveCategoryLabel(category: CategoryKey, value: string): string {
  if (!value) return value;

  switch (category) {
    case 'format':
    case 'proposal':
    case 'context':
    case 'tone':
      return getCategoryById(value, category)?.label || value;
    case 'references':
      return getCategoryById(value, 'reference')?.label || value;
    case 'contentIntent':
      return v2IdsToLabels([value], 'contentIntent')[0] || value;
    case 'narrativeForm':
      return v2IdsToLabels([value], 'narrativeForm')[0] || value;
    case 'contentSignals':
      return v2IdsToLabels([value], 'contentSignal')[0] || value;
    case 'stance':
      return v25IdsToLabels([value], 'stance')[0] || value;
    case 'proofStyle':
      return v25IdsToLabels([value], 'proofStyle')[0] || value;
    case 'commercialMode':
      return v25IdsToLabels([value], 'commercialMode')[0] || value;
    default:
      return value;
  }
}

const MetricCard: React.FC<{
  title: string;
  category: CategoryKey;
  metric: MetricKey;
  startDate: string;
  endDate: string;
  apiPrefix: string;
  limit: number;
  userId?: string | null;
  onlyActiveSubscribers?: boolean;
  contextFilter?: string;
  creatorContextFilter?: string;
  dataOverride?: RankItem[] | null;
  loadingOverride?: boolean;
  errorOverride?: string | null;
  disableFetch?: boolean;
}> = ({
  title,
  category,
  metric,
  startDate,
  endDate,
  apiPrefix,
  limit,
  userId,
  onlyActiveSubscribers = false,
  contextFilter,
  creatorContextFilter,
  dataOverride,
  loadingOverride,
  errorOverride,
  disableFetch = false,
}) => {
  const hasOverride = Boolean(disableFetch)
    || typeof dataOverride !== 'undefined'
    || typeof loadingOverride !== 'undefined'
    || typeof errorOverride !== 'undefined';
  const requestUrl = useMemo(() => {
    if (!startDate || !endDate) return null;
    const params = new URLSearchParams({
      category,
      metric,
      limit: String(limit),
    });
    const localStartDate = new Date(startDate);
    const utcStartDate = new Date(Date.UTC(localStartDate.getFullYear(), localStartDate.getMonth(), localStartDate.getDate(), 0, 0, 0, 0));
    const localEndDate = new Date(endDate);
    const utcEndDate = new Date(Date.UTC(localEndDate.getFullYear(), localEndDate.getMonth(), localEndDate.getDate(), 23, 59, 59, 999));
    params.append('startDate', utcStartDate.toISOString());
    params.append('endDate', utcEndDate.toISOString());
    if (userId) params.append('userId', userId);
    if (onlyActiveSubscribers) params.append('onlyActiveSubscribers', 'true');
    if (contextFilter) params.append('context', contextFilter);
    if (creatorContextFilter) params.append('creatorContext', creatorContextFilter);
    return `${apiPrefix}/dashboard/rankings/categories?${params.toString()}`;
  }, [category, metric, startDate, endDate, apiPrefix, limit, userId, onlyActiveSubscribers, contextFilter, creatorContextFilter]);

  const fetcher = useCallback(async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Falha ao carregar ranking');
    }
    return res.json() as Promise<RankItem[]>;
  }, []);

  const shouldFetch = !disableFetch && Boolean(requestUrl);
  const { data, error, isLoading } = useSWR<RankItem[]>(
    shouldFetch ? requestUrl : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60 * 1000 },
  );
  const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : null;
  const items = hasOverride ? (dataOverride ?? null) : (data ?? null);
  const finalLoading = hasOverride ? (loadingOverride ?? false) : isLoading;
  const finalError = hasOverride ? (errorOverride ?? null) : errorMessage;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <h4 className="text-sm font-semibold text-gray-800 mb-2">{title}</h4>
      {finalLoading ? (
        <p className="text-xs text-gray-400 py-6">Carregando...</p>
      ) : finalError ? (
        <p className="text-xs text-red-500 py-6">{finalError}</p>
      ) : !items || items.length === 0 ? (
        <p className="text-xs text-gray-400 py-6">Sem dados.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((it, idx) => {
            const label = resolveCategoryLabel(category, it.category);
            return (
              <li key={`${it.category}-${idx}`} className="flex justify-between">
                <span className="truncate pr-2" title={label}>{label}</span>
                <span className="tabular-nums text-gray-700">{new Intl.NumberFormat('pt-BR').format(it.value)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const CategoryRankingsSection: React.FC<Props> = ({
  startDate,
  endDate,
  apiPrefix = '/api/admin',
  limit = 5,
  selectedUserId,
  onlyActiveSubscribers = false,
  contextFilter,
  creatorContextFilter,
}) => {
  const [scope, setScope] = useState<'global' | 'creator'>('global');
  const effectiveUserId = scope === 'creator' ? (selectedUserId ?? undefined) : undefined;
  const dateRangeParams = useMemo(() => {
    if (!startDate || !endDate) return null;
    const localStartDate = new Date(startDate);
    const localEndDate = new Date(endDate);
    const utcStartDate = new Date(Date.UTC(localStartDate.getFullYear(), localStartDate.getMonth(), localStartDate.getDate(), 0, 0, 0, 0));
    const utcEndDate = new Date(Date.UTC(localEndDate.getFullYear(), localEndDate.getMonth(), localEndDate.getDate(), 23, 59, 59, 999));
    return {
      startDate: utcStartDate.toISOString(),
      endDate: utcEndDate.toISOString(),
    };
  }, [startDate, endDate]);

  const batchUrl = useMemo(() => {
    if (!dateRangeParams) return null;
    const params = new URLSearchParams({
      startDate: dateRangeParams.startDate,
      endDate: dateRangeParams.endDate,
      limit: String(limit),
    });
    if (effectiveUserId) params.append('userId', effectiveUserId);
    if (onlyActiveSubscribers) params.append('onlyActiveSubscribers', 'true');
    if (contextFilter) params.append('context', contextFilter);
    if (creatorContextFilter) params.append('creatorContext', creatorContextFilter);
    return `${apiPrefix}/dashboard/rankings/categories/batch?${params.toString()}`;
  }, [apiPrefix, dateRangeParams, limit, effectiveUserId, onlyActiveSubscribers, contextFilter, creatorContextFilter]);

  const fetcher = useCallback(async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Falha ao carregar rankings');
    }
    return res.json() as Promise<CategoryRankingsBatch>;
  }, []);

  const { data, error, isLoading } = useSWR<CategoryRankingsBatch>(
    batchUrl,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60 * 1000 },
  );
  const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : null;
  const batchData = data ?? null;
  const sharedCardProps = { loadingOverride: isLoading, errorOverride: errorMessage, disableFetch: true };

  const renderSection = (section: CategorySection) => (
    <div key={section.key} className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-700">{section.title}</h3>
        <p className="mt-1 text-xs text-gray-500">{section.description}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetricCard
          title="Mais Publicados"
          category={section.key}
          metric="posts"
          startDate={startDate}
          endDate={endDate}
          apiPrefix={apiPrefix}
          limit={limit}
          userId={effectiveUserId}
          onlyActiveSubscribers={onlyActiveSubscribers}
          contextFilter={contextFilter}
          creatorContextFilter={creatorContextFilter}
          dataOverride={batchData?.[section.key]?.posts ?? null}
          {...sharedCardProps}
        />
        <MetricCard
          title="Maior Média de Interações"
          category={section.key}
          metric="avg_total_interactions"
          startDate={startDate}
          endDate={endDate}
          apiPrefix={apiPrefix}
          limit={limit}
          userId={effectiveUserId}
          onlyActiveSubscribers={onlyActiveSubscribers}
          contextFilter={contextFilter}
          creatorContextFilter={creatorContextFilter}
          dataOverride={batchData?.[section.key]?.avg_total_interactions ?? null}
          {...sharedCardProps}
        />
      </div>
    </div>
  );

  return (
    <section id="category-rankings" className="mb-10">
      <div className="flex items-end justify-between mb-6">
        <div className="flex flex-col gap-1">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <GlobalPeriodIndicator />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Rankings por Categorias
          </h2>
        </div>
        <div className="inline-flex rounded-md border border-gray-300 overflow-hidden text-xs">
          <button onClick={() => setScope('global')} className={`px-3 py-1.5 ${scope === 'global' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}>Global</button>
          <button onClick={() => setScope('creator')} className={`px-3 py-1.5 ${scope === 'creator' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}>Por Criador</button>
        </div>
      </div>
      {scope === 'creator' && !selectedUserId && (
        <p className="text-xs text-amber-600 mb-3">Selecione um criador no topo para ver rankings por criador.</p>
      )}
      <div className="space-y-8">
        <div>
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-800">Leitura Editorial</h3>
            <p className="mt-1 text-sm text-slate-500">
              Dimensões clássicas para entender formato, tema, proposta e referências dominantes.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {EDITORIAL_SECTIONS.map(renderSection)}
          </div>
        </div>
        <div className="border-t border-slate-200 pt-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-800">Leitura Estratégica</h3>
            <p className="mt-1 text-sm text-slate-500">
              Camadas V2.5 para ler intenção, narrativa, sinais, postura, prova e modo comercial com mais precisão.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {STRATEGIC_SECTIONS.map(renderSection)}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CategoryRankingsSection;
