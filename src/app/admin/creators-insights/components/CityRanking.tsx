import React from 'react';
import { CityMetric } from '@/types/admin/creatorSurvey';

interface CityRankingProps {
    data?: CityMetric[];
    onSelect?: (value: string) => void;
    isLoading?: boolean;
}

export default function CityRanking({
    data,
    onSelect,
}: CityRankingProps) {
    if (!data || data.length === 0) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900">Ranking de cidades</h4>
                {onSelect && <span className="text-xs text-gray-400">Clique aplica filtro</span>}
            </div>
            <div className="divide-y divide-gray-100">
                {data.slice(0, 10).map((row) => (
                    <button
                        key={row.value}
                        onClick={onSelect ? () => onSelect(row.value) : undefined}
                        className="w-full text-left py-2 group"
                    >
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-gray-800 group-hover:text-indigo-700">{row.value}</span>
                            <span className="text-xs text-gray-500">{row.count} criadores</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 mt-1">
                            <div>
                                <p>Engaj.</p>
                                <p className="font-semibold text-gray-800">{row.avgEngagement != null ? `${row.avgEngagement.toFixed(2)}%` : '—'}</p>
                            </div>
                            <div>
                                <p>Alcance</p>
                                <p className="font-semibold text-gray-800">{row.avgReach != null ? Math.round(row.avgReach).toLocaleString('pt-BR') : '—'}</p>
                            </div>
                            <div>
                                <p>Seguidores</p>
                                <p className="font-semibold text-gray-800">{row.avgFollowers != null ? Math.round(row.avgFollowers).toLocaleString('pt-BR') : '—'}</p>
                            </div>
                            <div>
                                <p>Ticket</p>
                                <p className="font-semibold text-gray-800">
                                    {row.avgTicket != null ? `R$ ${Math.round(row.avgTicket).toLocaleString('pt-BR')}` : '—'}
                                </p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
