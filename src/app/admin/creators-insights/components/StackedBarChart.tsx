import React from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, Bar } from 'recharts';

interface StackedBarChartProps {
    title: string;
    data: any[];
    keys: { key: string; color: string; label?: string }[];
    xAxisKey: string;
    height?: number;
    isLoading?: boolean;
    showPercentOfTotal?: boolean;
}

const CustomTooltip = ({ active, payload, label, keys, showPercentOfTotal }: any) => {
    if (active && payload && payload.length) {
        const total = payload.reduce((acc: number, entry: any) => acc + (entry.value || 0), 0);
        return (
            <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-xs z-50 min-w-[150px]">
                <p className="font-bold text-gray-900 mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex justify-between items-center gap-4 mb-1">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-gray-600">{entry.name}:</span>
                        </div>
                        <span className="font-mono font-medium text-gray-900">
                            {entry.value}
                            {showPercentOfTotal && total > 0 ? (
                                <span className="text-[10px] text-gray-500 ml-1">
                                    ({((entry.value / total) * 100).toFixed(1)}%)
                                </span>
                            ) : null}
                        </span>
                    </div>
                ))}
                {showPercentOfTotal && total > 0 ? (
                    <div className="flex justify-between items-center gap-4 border-t border-gray-100 pt-1 mt-1">
                        <span className="text-gray-500">Total</span>
                        <span className="font-mono text-gray-900">{total}</span>
                    </div>
                ) : null}
            </div>
        );
    }
    return null;
};

export default function StackedBarChart({ title, data, keys, xAxisKey, height = 300, isLoading, showPercentOfTotal }: StackedBarChartProps) {
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
                        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey={xAxisKey} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                            <RechartsTooltip content={<CustomTooltip keys={keys} showPercentOfTotal={showPercentOfTotal} />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                            {keys.map((k) => (
                                <Bar
                                    key={k.key}
                                    dataKey={k.key}
                                    stackId="a"
                                    fill={k.color}
                                    name={k.label || k.key}
                                    radius={k.key === keys[keys.length - 1]?.key ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
