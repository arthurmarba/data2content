import React from 'react';
import { CityPricingBySize } from '@/types/admin/creatorSurvey';

interface CityPricingMatrixProps {
    data?: CityPricingBySize[];
    onSelect?: (city: string) => void;
}

export default function CityPricingMatrix({
    data,
    onSelect,
}: CityPricingMatrixProps) {
    if (!data || data.length === 0) return null;
    const sizes: Array<CityPricingBySize['size']> = ['micro', 'mid', 'macro'];
    const grouped = data.reduce<Record<string, CityPricingBySize[]>>((acc, row) => {
        const key = row.city || 'Sem dado';
        acc[key] = acc[key] || [];
        acc[key].push(row);
        return acc;
    }, {});
    const topCities = Object.entries(grouped)
        .sort((a, b) => (b[1].reduce((s, r) => s + r.count, 0)) - (a[1].reduce((s, r) => s + r.count, 0)))
        .slice(0, 8);

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900">Ticket médio por cidade x porte</h4>
                {onSelect && <span className="text-xs text-gray-400">Clique filtra cidade</span>}
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="text-left text-gray-600">
                            <th className="py-2 pr-3 font-semibold">Cidade</th>
                            {sizes.map((s) => (
                                <th key={s} className="py-2 pr-3 font-semibold capitalize">{s}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {topCities.map(([city, rows]) => (
                            <tr key={city} className="hover:bg-gray-50">
                                <td className="py-2 pr-3">
                                    <button
                                        onClick={onSelect ? () => onSelect(city) : undefined}
                                        className="text-gray-900 font-semibold hover:text-indigo-700"
                                    >
                                        {city}
                                    </button>
                                </td>
                                {sizes.map((s) => {
                                    const match = rows.find((r) => r.size === s);
                                    return (
                                        <td key={`${city}-${s}`} className="py-2 pr-3">
                                            {match?.avgTicket != null ? `R$ ${Math.round(match.avgTicket).toLocaleString('pt-BR')}` : '—'}
                                            {match?.count ? <span className="text-[11px] text-gray-500"> ({match.count})</span> : null}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
