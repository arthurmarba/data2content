import React from 'react';
import { CategoryMetricBreakdown } from '@/types/admin/creatorSurvey';

interface CorrelationTableProps {
    title: string;
    data?: CategoryMetricBreakdown[];
    onSelect?: (value: string) => void;
}

export default function CorrelationTable({
    title,
    data,
    onSelect,
}: CorrelationTableProps) {
    if (!data || data.length === 0) return null;
    const maxEngagement = Math.max(...data.map((d) => d.avgEngagement || 0), 1);
    const maxReach = Math.max(...data.map((d) => d.avgReach || 0), 1);
    const maxGrowth = Math.max(...data.map((d) => d.avgGrowth || 0), 1);
    const maxFollowers = Math.max(...data.map((d) => d.avgFollowers || 0), 1);
    const formatPct = (v?: number | null) => (v != null ? `${v.toFixed(2)}%` : '—');
    const formatNum = (v?: number | null) => (v != null ? Math.round(v).toLocaleString('pt-BR') : '—');

    const Bar = ({ value, max, className }: { value?: number | null; max: number; className: string }) => {
        if (value == null) return <div className="h-2 bg-gray-100 rounded" />;
        const pct = Math.min(100, (value / max) * 100);
        return (
            <div className="h-2 bg-gray-100 rounded">
                <div className={`h-2 rounded ${className}`} style={{ width: `${pct}%` }} />
            </div>
        );
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
                {onSelect && <span className="text-xs text-gray-400">Clique para filtrar</span>}
            </div>
            <div className="space-y-3">
                {data.slice(0, 8).map((row) => (
                    <button
                        key={row.value}
                        onClick={onSelect ? () => onSelect(row.value) : undefined}
                        className="w-full text-left group"
                    >
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-gray-800 group-hover:text-indigo-700">{row.value}</span>
                            <span className="text-xs text-gray-500">{row.count} resp.</span>
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-gray-600">
                            <div>
                                <div className="flex items-center justify-between">
                                    <span>Engaj.</span>
                                    <span className="text-gray-700">{formatPct(row.avgEngagement)}</span>
                                </div>
                                <Bar value={row.avgEngagement ?? undefined} max={maxEngagement} className="bg-indigo-500" />
                            </div>
                            <div>
                                <div className="flex items-center justify-between">
                                    <span>Cresc.</span>
                                    <span className="text-gray-700">{formatPct(row.avgGrowth)}</span>
                                </div>
                                <Bar value={row.avgGrowth ?? undefined} max={maxGrowth} className="bg-emerald-500" />
                            </div>
                            <div>
                                <div className="flex items-center justify-between">
                                    <span>Alcance</span>
                                    <span className="text-gray-700">{formatNum(row.avgReach)}</span>
                                </div>
                                <Bar value={row.avgReach ?? undefined} max={maxReach} className="bg-blue-500" />
                            </div>
                            <div>
                                <div className="flex items-center justify-between">
                                    <span>Seguidores</span>
                                    <span className="text-gray-700">{formatNum(row.avgFollowers)}</span>
                                </div>
                                <Bar value={row.avgFollowers ?? undefined} max={maxFollowers} className="bg-slate-500" />
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
