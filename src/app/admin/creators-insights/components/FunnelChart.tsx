import React, { useMemo } from 'react';
import { ResponsiveContainer, FunnelChart as RechartsFunnelChart, Funnel, LabelList, Tooltip } from 'recharts';

interface FunnelChartProps {
    title: string;
    data: { name: string; value: number; fill?: string }[];
    height?: number;
    onClick?: (value: string) => void;
    isLoading?: boolean;
}

// Consistent palette with TreeMap
const BASE_COLORS = [
    '#4F46E5', // Indigo 600
    '#6366F1', // Indigo 500
    '#818CF8', // Indigo 400
    '#A5B4FC', // Indigo 300
    '#C7D2FE', // Indigo 200
];

const CustomTooltip = ({ active, payload, maxValue }: any) => {
    if (active && payload && payload.length) {
        const item = payload[0].payload;
        const percentOfMax = maxValue > 0 ? ((item.value / maxValue) * 100).toFixed(1) : '0';

        return (
            <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-xs z-50 min-w-[120px]">
                <p className="font-bold text-gray-900 mb-1">{item.name}</p>
                <div className="flex justify-between items-center gap-4">
                    <span className="text-gray-600">Quantidade:</span>
                    <span className="font-mono font-medium text-gray-900">{item.value}</span>
                </div>
                <div className="flex justify-between items-center gap-4 mt-1">
                    <span className="text-gray-600">Conversão (vs Topo):</span>
                    <span className="font-mono font-medium text-indigo-600">{percentOfMax}%</span>
                </div>
            </div>
        );
    }
    return null;
};

export default function FunnelChart({ title, data, height = 300, onClick, isLoading }: FunnelChartProps) {
    const coloredData = data.map((d, i) => ({
        ...d,
        fill: d.fill || BASE_COLORS[i % BASE_COLORS.length],
    })).sort((a, b) => b.value - a.value);

    // Assuming the first item (largest) is the "100%" base for the funnel
    const maxValue = useMemo(() => coloredData.length > 0 ? coloredData[0]?.value ?? 0 : 0, [coloredData]);

    return (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">{title}</h4>
            {isLoading ? (
                <div className="animate-pulse bg-gray-200 rounded h-[300px] w-full" style={{ height }} />
            ) : data.length === 0 ? (
                <div className="text-sm text-gray-500">Sem dados.</div>
            ) : (
                <div style={{ height }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <RechartsFunnelChart>
                            <Tooltip content={<CustomTooltip maxValue={maxValue} />} />
                            <Funnel
                                dataKey="value"
                                data={coloredData}
                                isAnimationActive
                                onClick={(entry) => onClick && entry && onClick(entry.name)}
                                cursor={onClick ? 'pointer' : 'default'}
                            >
                                <LabelList position="right" fill="#000" stroke="none" dataKey="name" />
                            </Funnel>
                        </RechartsFunnelChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
