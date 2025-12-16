import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
} from 'recharts';
import { DistributionEntry } from '@/types/admin/creatorSurvey';

interface DistributionChartProps {
    title: string;
    data: DistributionEntry[];
    onClick?: (value: string) => void;
    isLoading?: boolean;
}

export default function DistributionChart({ title, data, onClick, isLoading }: DistributionChartProps) {
    return (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
                {onClick && !isLoading && <span className="text-xs text-gray-400">Clique para filtrar</span>}
            </div>
            {isLoading ? (
                <div className="animate-pulse bg-gray-200 rounded h-60 w-full" />
            ) : data.length === 0 ? (
                <div className="text-sm text-gray-500">Sem dados.</div>
            ) : (
                <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="value" tick={{ fontSize: 12 }} />
                            <YAxis allowDecimals={false} />
                            <RechartsTooltip />
                            <Bar
                                dataKey="count"
                                fill="#4F46E5"
                                radius={[4, 4, 0, 0]}
                                onClick={onClick ? (entry) => onClick(entry.value) : undefined}
                                cursor={onClick ? 'pointer' : 'default'}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
