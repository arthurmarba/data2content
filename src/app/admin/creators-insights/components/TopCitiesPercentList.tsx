import React from 'react';
import { CityMetric } from '@/types/admin/creatorSurvey';

interface TopCitiesPercentListProps {
    data?: CityMetric[];
    total?: number;
    onSelect?: (value: string) => void;
}

export default function TopCitiesPercentList({
    data,
    total,
    onSelect,
}: TopCitiesPercentListProps) {
    if (!data || !data.length || !total) return null;
    const top = data.slice(0, 5);
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900">Top 5 cidades (%)</h4>
                {onSelect && <span className="text-xs text-gray-400">Clique aplica filtro</span>}
            </div>
            <div className="space-y-2">
                {top.map((row) => {
                    const pct = Math.round((row.count / total) * 100);
                    return (
                        <button
                            key={row.value}
                            onClick={onSelect ? () => onSelect(row.value) : undefined}
                            className="w-full text-left"
                        >
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold text-gray-900">{row.value}</span>
                                <span className="text-xs text-gray-600">{pct}% ({row.count})</span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 rounded">
                                <div
                                    className="h-2 bg-indigo-500 rounded"
                                    style={{ width: `${Math.min(100, pct)}%` }}
                                />
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
