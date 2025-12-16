import React, { useMemo } from 'react';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import { DistributionEntry } from '@/types/admin/creatorSurvey';

interface PieDistributionProps {
    title: string;
    data: DistributionEntry[];
    isLoading?: boolean;
}

const COLORS = [
    '#4F46E5', // Indigo
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EC4899', // Pink
    '#0EA5E9', // Sky
    '#8B5CF6', // Violet
];

const CustomTooltip = ({ active, payload, total }: any) => {
    if (active && payload && payload.length) {
        const item = payload[0].payload;
        const percent = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0';

        return (
            <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-xs z-50 min-w-[120px]">
                <p className="font-bold text-gray-900 mb-1">{item.value}</p>
                <div className="flex justify-between items-center gap-4">
                    <span className="text-gray-600">Quantidade:</span>
                    <span className="font-mono font-medium text-gray-900">{item.count}</span>
                </div>
                <div className="flex justify-between items-center gap-4 mt-1">
                    <span className="text-gray-600">Proporção:</span>
                    <span className="font-mono font-medium text-indigo-600">{percent}%</span>
                </div>
            </div>
        );
    }
    return null;
};

export default function PieDistribution({ title, data, isLoading }: PieDistributionProps) {
    const total = useMemo(() => data.reduce((acc, curr) => acc + curr.count, 0), [data]);

    return (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">{title}</h4>
            {isLoading ? (
                <div className="animate-pulse bg-gray-200 rounded h-60 w-full" />
            ) : data.length === 0 ? (
                <div className="text-sm text-gray-500">Sem dados.</div>
            ) : (
                <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                dataKey="count"
                                nameKey="value"
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={80}
                                paddingAngle={2}
                            >
                                {data.map((_, idx) => (
                                    <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} stroke="none" />
                                ))}
                            </Pie>
                            <RechartsTooltip content={<CustomTooltip total={total} />} />
                            <Legend
                                layout="vertical"
                                align="right"
                                verticalAlign="middle"
                                iconType="circle"
                                wrapperStyle={{ fontSize: '11px' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
