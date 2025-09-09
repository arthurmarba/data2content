"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getCategoryById } from "@/app/lib/classification";
import { BarChart3 } from "lucide-react";

type CategoryKey = 'format' | 'proposal' | 'context';
type MetricKey = 'posts' | 'avg_total_interactions';

interface RankItem { category: string; value: number; }

async function fetchCategoryRanking(params: {
  userId: string;
  category: CategoryKey;
  metric: MetricKey;
  startDate: string;
  endDate: string;
  limit?: number;
}): Promise<RankItem[]> {
  const { userId, category, metric, startDate, endDate, limit = 5 } = params;
  const qs = new URLSearchParams({ category, metric, startDate, endDate, limit: String(limit), userId });
  const url = `/api/admin/dashboard/rankings/categories?${qs.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
    <h4 className="text-sm font-semibold text-gray-800 mb-2">{title}</h4>
    {children}
  </div>
);

const MetricList: React.FC<{ items: RankItem[]; type: CategoryKey }>= ({ items, type }) => (
  <ul className="space-y-1 text-sm">
    {items.map((it, idx) => {
      const label = getCategoryById(it.category, type === 'context' ? 'context' : (type as any))?.label || it.category;
      return (
        <li key={`${it.category}-${idx}`} className="flex justify-between">
          <span className="truncate pr-2" title={label}>{label}</span>
          <span className="tabular-nums text-gray-700">{new Intl.NumberFormat('pt-BR').format(it.value)}</span>
        </li>
      );
    })}
  </ul>
);

interface Props { userId: string; }

const UserCategoryRankingsCompact: React.FC<Props> = ({ userId }) => {
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date(end); start.setDate(start.getDate() - 90);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formatPosts, setFormatPosts] = useState<RankItem[]>([]);
  const [formatAvg, setFormatAvg] = useState<RankItem[]>([]);
  const [proposalPosts, setProposalPosts] = useState<RankItem[]>([]);
  const [proposalAvg, setProposalAvg] = useState<RankItem[]>([]);
  const [contextPosts, setContextPosts] = useState<RankItem[]>([]);
  const [contextAvg, setContextAvg] = useState<RankItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true); setError(null);
        const [fp, fa, pp, pa, cp, ca] = await Promise.all([
          fetchCategoryRanking({ userId, category: 'format', metric: 'posts', startDate, endDate }),
          fetchCategoryRanking({ userId, category: 'format', metric: 'avg_total_interactions', startDate, endDate }),
          fetchCategoryRanking({ userId, category: 'proposal', metric: 'posts', startDate, endDate }),
          fetchCategoryRanking({ userId, category: 'proposal', metric: 'avg_total_interactions', startDate, endDate }),
          fetchCategoryRanking({ userId, category: 'context', metric: 'posts', startDate, endDate }),
          fetchCategoryRanking({ userId, category: 'context', metric: 'avg_total_interactions', startDate, endDate }),
        ]);
        if (cancelled) return;
        setFormatPosts(fp); setFormatAvg(fa);
        setProposalPosts(pp); setProposalAvg(pa);
        setContextPosts(cp); setContextAvg(ca);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Falha ao carregar rankings.');
      } finally { if (!cancelled) setLoading(false); }
    };
    run();
    return () => { cancelled = true; };
  }, [userId, startDate, endDate]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <BarChart3 size={20} className="text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-800">Rankings por Categorias</h3>
      </div>
      {loading && <div className="text-sm text-gray-500 py-4">Carregando rankings…</div>}
      {error && <div className="text-sm text-red-600 py-4">{error}</div>}
      {!loading && !error && (
        <div className="space-y-4">
          {/* Formato */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-600">Formato</h4>
            <div className="grid grid-cols-1 gap-3">
              <SectionCard title="Mais Publicados">
                <MetricList items={formatPosts} type="format" />
              </SectionCard>
              <SectionCard title="Maior Média de Interações">
                <MetricList items={formatAvg} type="format" />
              </SectionCard>
            </div>
          </div>
          {/* Proposta */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-600">Proposta</h4>
            <div className="grid grid-cols-1 gap-3">
              <SectionCard title="Mais Publicados">
                <MetricList items={proposalPosts} type="proposal" />
              </SectionCard>
              <SectionCard title="Maior Média de Interações">
                <MetricList items={proposalAvg} type="proposal" />
              </SectionCard>
            </div>
          </div>
          {/* Contexto */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-600">Contexto</h4>
            <div className="grid grid-cols-1 gap-3">
              <SectionCard title="Mais Publicados">
                <MetricList items={contextPosts} type="context" />
              </SectionCard>
              <SectionCard title="Maior Média de Interações">
                <MetricList items={contextAvg} type="context" />
              </SectionCard>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserCategoryRankingsCompact;

