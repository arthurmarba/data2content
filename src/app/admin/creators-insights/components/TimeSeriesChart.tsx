import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
} from 'recharts';
import { ClockIcon } from '@heroicons/react/24/outline';

interface TimeSeriesChartProps {
    data: { date: string; count: number }[];
    isLoading?: boolean;
}

export default function TimeSeriesChart({ data }: TimeSeriesChartProps) {
    return (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
                <ClockIcon className="w-4 h-4 text-gray-500" />
                <h4 className="text-sm font-semibold text-gray-800">Respostas por dia</h4>
            </div>
            {data.length === 0 ? (
                <div className="text-sm text-gray-500">Sem dados suficientes.</div>
            ) : (
                <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                            <YAxis allowDecimals={false} />
                            <RechartsTooltip />
                            <Line type="monotone" dataKey="count" stroke="#4F46E5" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
