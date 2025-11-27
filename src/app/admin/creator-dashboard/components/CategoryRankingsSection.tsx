"use client";

import React, { useEffect, useMemo, useState } from "react";
import GlobalPeriodIndicator from "./GlobalPeriodIndicator";
import { getCategoryById } from "@/app/lib/classification";

type CategoryKey = 'format' | 'proposal' | 'context' | 'tone' | 'references';

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

const MetricCard: React.FC<{
  title: string;
  category: CategoryKey;
  metric: 'posts' | 'avg_total_interactions';
  startDate: string;
  endDate: string;
  apiPrefix: string;
  limit: number;
  userId?: string | null;
  onlyActiveSubscribers?: boolean;
  contextFilter?: string;
  creatorContextFilter?: string;
}> = ({ title, category, metric, startDate, endDate, apiPrefix, limit, userId, onlyActiveSubscribers = false, contextFilter, creatorContextFilter }) => {
  const [items, setItems] = useState<RankItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true); setError(null);
      try {
        const params = new URLSearchParams({
          category,
          metric,
          startDate,
          endDate,
          limit: String(limit),
        });
        if (userId) params.append('userId', userId);
        if (onlyActiveSubscribers) params.append('onlyActiveSubscribers', 'true');
        if (contextFilter) params.append('context', contextFilter);
        if (creatorContextFilter) params.append('creatorContext', creatorContextFilter);
        const url = `${apiPrefix}/dashboard/rankings/categories?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error((await res.json()).error || 'Falha ao carregar ranking');
        const data: RankItem[] = await res.json();
        setItems(data);
      } catch (e: any) {
        setError(e.message);
        setItems(null);
      } finally { setLoading(false); }
    };
    run();
  }, [category, metric, startDate, endDate, apiPrefix, limit, userId, onlyActiveSubscribers, contextFilter, creatorContextFilter]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <h4 className="text-sm font-semibold text-gray-800 mb-2">{title}</h4>
      {loading ? (
        <p className="text-xs text-gray-400 py-6">Carregando...</p>
      ) : error ? (
        <p className="text-xs text-red-500 py-6">{error}</p>
      ) : !items || items.length === 0 ? (
        <p className="text-xs text-gray-400 py-6">Sem dados.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((it, idx) => {
            const typeForLookup = (category === 'references' ? 'reference' : category) as any;
            const label = getCategoryById(it.category, typeForLookup)?.label || it.category;
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formato */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-600">Formato</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MetricCard title="Mais Publicados" category="format" metric="posts" startDate={startDate} endDate={endDate} apiPrefix={apiPrefix} limit={limit} userId={effectiveUserId} onlyActiveSubscribers={onlyActiveSubscribers} contextFilter={contextFilter} creatorContextFilter={creatorContextFilter} />
            <MetricCard title="Maior Média de Interações" category="format" metric="avg_total_interactions" startDate={startDate} endDate={endDate} apiPrefix={apiPrefix} limit={limit} userId={effectiveUserId} onlyActiveSubscribers={onlyActiveSubscribers} contextFilter={contextFilter} creatorContextFilter={creatorContextFilter} />
          </div>
        </div>
        {/* Proposta */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-600">Proposta</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MetricCard title="Mais Publicados" category="proposal" metric="posts" startDate={startDate} endDate={endDate} apiPrefix={apiPrefix} limit={limit} userId={effectiveUserId} onlyActiveSubscribers={onlyActiveSubscribers} contextFilter={contextFilter} creatorContextFilter={creatorContextFilter} />
            <MetricCard title="Maior Média de Interações" category="proposal" metric="avg_total_interactions" startDate={startDate} endDate={endDate} apiPrefix={apiPrefix} limit={limit} userId={effectiveUserId} onlyActiveSubscribers={onlyActiveSubscribers} contextFilter={contextFilter} creatorContextFilter={creatorContextFilter} />
          </div>
        </div>
        {/* Contexto */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-600">Contexto</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MetricCard title="Mais Publicados" category="context" metric="posts" startDate={startDate} endDate={endDate} apiPrefix={apiPrefix} limit={limit} userId={effectiveUserId} onlyActiveSubscribers={onlyActiveSubscribers} contextFilter={contextFilter} creatorContextFilter={creatorContextFilter} />
            <MetricCard title="Maior Média de Interações" category="context" metric="avg_total_interactions" startDate={startDate} endDate={endDate} apiPrefix={apiPrefix} limit={limit} userId={effectiveUserId} onlyActiveSubscribers={onlyActiveSubscribers} contextFilter={contextFilter} creatorContextFilter={creatorContextFilter} />
          </div>
        </div>
        {/* Tom */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-600">Tom</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MetricCard title="Mais Publicados" category="tone" metric="posts" startDate={startDate} endDate={endDate} apiPrefix={apiPrefix} limit={limit} userId={effectiveUserId} onlyActiveSubscribers={onlyActiveSubscribers} contextFilter={contextFilter} creatorContextFilter={creatorContextFilter} />
            <MetricCard title="Maior Média de Interações" category="tone" metric="avg_total_interactions" startDate={startDate} endDate={endDate} apiPrefix={apiPrefix} limit={limit} userId={effectiveUserId} onlyActiveSubscribers={onlyActiveSubscribers} contextFilter={contextFilter} creatorContextFilter={creatorContextFilter} />
          </div>
        </div>
        {/* Referências */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-600">Referências</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MetricCard title="Mais Publicados" category="references" metric="posts" startDate={startDate} endDate={endDate} apiPrefix={apiPrefix} limit={limit} userId={effectiveUserId} onlyActiveSubscribers={onlyActiveSubscribers} contextFilter={contextFilter} creatorContextFilter={creatorContextFilter} />
            <MetricCard title="Maior Média de Interações" category="references" metric="avg_total_interactions" startDate={startDate} endDate={endDate} apiPrefix={apiPrefix} limit={limit} userId={effectiveUserId} onlyActiveSubscribers={onlyActiveSubscribers} contextFilter={contextFilter} creatorContextFilter={creatorContextFilter} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default CategoryRankingsSection;
