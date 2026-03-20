"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { formatStrategicGroupingValue } from '@/app/lib/strategicReportPresentation';

type CategoryKey = 'format' | 'contentIntent' | 'narrativeForm' | 'context';

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
  const [topIds, setTopIds] = useState<{ format?: string; contentIntent?: string; narrativeForm?: string; context?: string }>({});

  const { format: topFormat, contentIntent: topContentIntent, narrativeForm: topNarrativeForm, context: topContext } = topIds;

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
        const [f, i, n, c] = await Promise.all([
          fetch(`${base}?${params('format')}`).then(r => r.ok ? r.json() : []),
          fetch(`${base}?${params('contentIntent')}`).then(r => r.ok ? r.json() : []),
          fetch(`${base}?${params('narrativeForm')}`).then(r => r.ok ? r.json() : []),
          fetch(`${base}?${params('context')}`).then(r => r.ok ? r.json() : []),
        ]);
        if (cancelled) return;
        setTopIds({
          format: f?.[0]?.category,
          contentIntent: i?.[0]?.category,
          narrativeForm: n?.[0]?.category,
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
      if (!topFormat && !topContentIntent && !topNarrativeForm && !topContext) return;
      try {
        setLoading(true); setError(null);
        const base = `/api/v1/users/${userId}/rankings/by-category`;
        const qs = (cat: CategoryKey, value: string) => new URLSearchParams({ category: cat, value, metric: 'avg_total_interactions', timePeriod }).toString();
        const requests: Array<Promise<[CategoryKey, RankResponse | null]>> = [];
        (['format','contentIntent','narrativeForm','context'] as CategoryKey[]).forEach((cat) => {
          const val = (
            cat === 'format'
              ? topFormat
              : cat === 'contentIntent'
                ? topContentIntent
                : cat === 'narrativeForm'
                  ? topNarrativeForm
                  : topContext
          ) as string | undefined;
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
  }, [userId, timePeriod, topFormat, topContentIntent, topNarrativeForm, topContext]);

  const labels = useMemo(() => ({
    format: topFormat ? formatStrategicGroupingValue('format', topFormat) : null,
    contentIntent: topContentIntent ? formatStrategicGroupingValue('contentIntent', topContentIntent) : null,
    narrativeForm: topNarrativeForm ? formatStrategicGroupingValue('narrativeForm', topNarrativeForm) : null,
    context: topContext ? formatStrategicGroupingValue('context', topContext) : null,
  }), [topFormat, topContentIntent, topNarrativeForm, topContext]);

  if (loading && !labels.format && !labels.contentIntent && !labels.narrativeForm && !labels.context) {
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
      {labels.contentIntent && (
        <RankBadge label={`Intenção: ${labels.contentIntent}`} rank={ranks.contentIntent?.rank ?? null} total={ranks.contentIntent?.totalCreators ?? 0} />
      )}
      {labels.narrativeForm && (
        <RankBadge label={`Narrativa: ${labels.narrativeForm}`} rank={ranks.narrativeForm?.rank ?? null} total={ranks.narrativeForm?.totalCreators ?? 0} />
      )}
      {labels.context && (
        <RankBadge label={`Contexto: ${labels.context}`} rank={ranks.context?.rank ?? null} total={ranks.context?.totalCreators ?? 0} />
      )}
    </div>
  );
};

export default UserCategoryPositionBadges;
