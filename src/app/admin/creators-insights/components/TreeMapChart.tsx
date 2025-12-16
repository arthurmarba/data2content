import React, { useMemo } from 'react';
import { ResponsiveContainer, Treemap, Tooltip as RechartsTooltip } from 'recharts';

interface TreeMapData {
    name: string;
    size: number;
    children?: TreeMapData[];
}

interface TreeMapChartProps {
    title: string;
    data: { name: string; value: number }[];
    height?: number;
    onClick?: (value: string) => void;
    isLoading?: boolean;
}

// A more professional, data-centric palette
const COLORS = [
    '#4F46E5', // Indigo 600
    '#0EA5E9', // Sky 500
    '#10B981', // Emerald 500
    '#F59E0B', // Amber 500
    '#EC4899', // Pink 500
    '#8B5CF6', // Violet 500
    '#6366F1', // Indigo 500
    '#3B82F6', // Blue 500
    '#14B8A6', // Teal 500
    '#F97316', // Orange 500
];

const CustomizeTreeMapContent = (props: any) => {
    const { root, depth, x, y, width, height, index, name, value, onClick } = props;

    return (
        <g onClick={() => onClick && depth === 1 && onClick(name)} style={{ cursor: onClick && depth === 1 ? 'pointer' : 'default' }}>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: depth < 2 ? COLORS[index % COLORS.length] : 'none',
                    stroke: '#fff',
                    strokeWidth: 2 / (depth + 1e-10),
                    strokeOpacity: 1 / (depth + 1e-10),
                }}
            />
            {depth === 1 ? (
                <text
                    x={x + width / 2}
                    y={y + height / 2 + 7}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={12}
                    fontWeight="bold"
                    style={{ pointerEvents: 'none' }}
                >
                    {width > 40 && height > 20 ? (name.length > 8 ? name.slice(0, 8) + '..' : name) : ''}
                </text>
            ) : null}
            {depth === 1 ? (
                <text
                    x={x + 4}
                    y={y + 14}
                    fill="#fff"
                    fontSize={10}
                    fillOpacity={0.8}
                />
            ) : null}
        </g>
    );
};

const CustomTooltip = ({ active, payload, total }: any) => {
    if (active && payload && payload.length) {
        const item = payload[0].payload;
        const percent = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';

        return (
            <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-xs z-50 min-w-[120px]">
                <p className="font-bold text-gray-900 mb-1">{item.name}</p>
                <div className="flex justify-between items-center gap-4">
                    <span className="text-gray-600">Quantidade:</span>
                    <span className="font-mono font-medium text-gray-900">{item.value}</span>
                </div>
                <div className="flex justify-between items-center gap-4 mt-1">
                    <span className="text-gray-600">Representatividade:</span>
                    <span className="font-mono font-medium text-indigo-600">{percent}%</span>
                </div>
            </div>
        );
    }

    return null;
};

export default function TreeMapChart({ title, data, height = 300, onClick, isLoading }: TreeMapChartProps) {
    // Convert flat data to hierarchy for Recharts TreeMap
    const treeData: TreeMapData[] = [
        {
            name: 'Root',
            size: 0,
            children: data.map((d) => ({ name: d.name, size: d.value })),
        },
    ];

    const totalValue = useMemo(() => data.reduce((acc, curr) => acc + curr.value, 0), [data]);

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
                        <Treemap
                            data={treeData}
                            dataKey="size"
                            stroke="#fff"
                            fill="#8884d8"
                            content={<CustomizeTreeMapContent onClick={onClick} />}
                        >
                            <RechartsTooltip content={<CustomTooltip total={totalValue} />} />
                        </Treemap>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
