"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { getCategoryById } from '@/app/lib/classification';

type CategoryKey = 'format' | 'proposal' | 'context';

interface RankResponse {
  category: CategoryKey;
  value: string;
  metric: string;
  timePeriod: string;
  rank: number | null;
  totalCreators: number;
  metricValue: number | null;
}

interface RankBadgeProps {
  label: string;
  rank: number | null;
  total: number;
}

const RankBadge: React.FC<RankBadgeProps> = ({ label, rank, total }) => {
  return (
    <div className="inline-flex items-center gap-2 border rounded-full px-3 py-1 bg-white shadow-sm">
      <span className="text-xs text-gray-600">{label}</span>
      {typeof rank === 'number' && total > 0 ? (
        <span className="text-xs font-semibold text-gray-800">#{rank} / {total}</span>
      ) : (
        <span className="text-xs text-gray-400">Sem posição</span>
      )}
    </div>
  );
};

interface Props {
  userId: string;
  timePeriod?: string; // default last_90_days
}

const UserCategoryPositionBadges: React.FC<Props> = ({ userId, timePeriod = 'last_90_days' }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ranks, setRanks] = useState<Record<string, RankResponse | null>>({});

  // Determina as categorias principais do usuário por USO (posts)
  const [topIds, setTopIds] = useState<{ format?: string; proposal?: string; context?: string }>({});

  const { format: topFormat, proposal: topProposal, context: topContext } = topIds;

  useEffect(() => {
    let cancelled = false;
    const fetchTop = async () => {
      try {
        setLoading(true); setError(null);
        const base = '/api/admin/dashboard/rankings/categories';
        const end = new Date();
        const start = new Date(end); start.setDate(start.getDate() - 90);
        const params = (cat: string) => new URLSearchParams({
          category: cat,
          metric: 'posts',
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          limit: '1',
          userId,
        }).toString();
        const [f, p, c] = await Promise.all([
          fetch(`${base}?${params('format')}`).then(r => r.ok ? r.json() : []),
          fetch(`${base}?${params('proposal')}`).then(r => r.ok ? r.json() : []),
          fetch(`${base}?${params('context')}`).then(r => r.ok ? r.json() : []),
        ]);
        if (cancelled) return;
        setTopIds({
          format: f?.[0]?.category,
          proposal: p?.[0]?.category,
          context: c?.[0]?.category,
        });
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Falha ao obter categorias principais.');
      } finally { if (!cancelled) setLoading(false); }
    };
    fetchTop();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const fetchRanks = async () => {
      if (!topFormat && !topProposal && !topContext) return;
      try {
        setLoading(true); setError(null);
        const base = `/api/v1/users/${userId}/rankings/by-category`;
        const qs = (cat: CategoryKey, value: string) => new URLSearchParams({ category: cat, value, metric: 'avg_total_interactions', timePeriod }).toString();
        const requests: Array<Promise<[CategoryKey, RankResponse | null]>> = [];
        (['format','proposal','context'] as CategoryKey[]).forEach((cat) => {
          const val = (cat === 'format' ? topFormat : cat === 'proposal' ? topProposal : topContext) as string | undefined;
          if (val) {
            requests.push(
              fetch(`${base}?${qs(cat, val)}`).then(async (r) => [cat, r.ok ? await r.json() : null])
            );
          }
        });
        const results = await Promise.all(requests);
        if (cancelled) return;
        const map: Record<string, RankResponse | null> = {};
        results.forEach(([cat, doc]) => { map[cat] = doc; });
        setRanks(map);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Falha ao calcular posições.');
      } finally { if (!cancelled) setLoading(false); }
    };
    fetchRanks();
    return () => { cancelled = true; };
  }, [userId, timePeriod, topFormat, topProposal, topContext]);

  const labels = useMemo(() => ({
    format: topFormat ? (getCategoryById(topFormat, 'format')?.label || topFormat) : null,
    proposal: topProposal ? (getCategoryById(topProposal, 'proposal')?.label || topProposal) : null,
    context: topContext ? (getCategoryById(topContext, 'context')?.label || topContext) : null,
  }), [topFormat, topProposal, topContext]);

  if (loading && !labels.format && !labels.proposal && !labels.context) {
    return <div className="text-xs text-gray-500">Calculando posições…</div>;
  }
  if (error) {
    return <div className="text-xs text-red-600">{error}</div>;
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {labels.format && (
        <RankBadge label={`Formato: ${labels.format}`} rank={ranks.format?.rank ?? null} total={ranks.format?.totalCreators ?? 0} />
      )}
      {labels.proposal && (
        <RankBadge label={`Proposta: ${labels.proposal}`} rank={ranks.proposal?.rank ?? null} total={ranks.proposal?.totalCreators ?? 0} />
      )}
      {labels.context && (
        <RankBadge label={`Contexto: ${labels.context}`} rank={ranks.context?.rank ?? null} total={ranks.context?.totalCreators ?? 0} />
      )}
    </div>
  );
};

export default UserCategoryPositionBadges;
