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
import { AdminCreatorSurveyDetail } from '@/types/admin/creatorSurvey';

interface CreatorHistoryChartProps {
    history: AdminCreatorSurveyDetail['insightsHistory'];
}

export default function CreatorHistoryChart({ history }: CreatorHistoryChartProps) {
    if (!history || history.length <= 1) return null;

    const data = [...history].reverse().map((d) => ({
        date: d.recordedAt ? new Date(d.recordedAt).toLocaleDateString('pt-BR') : '',
        reach: d.reach ?? 0,
        engaged: d.engaged ?? 0,
        followers: d.followers ?? 0,
    }));

    const hasValues = data.some((d) => (d.reach || d.engaged || d.followers));
    if (!hasValues) return null;

    const leftMax = Math.max(...data.map((d) => Math.max(d.reach, d.engaged)));
    const rightMax = Math.max(...data.map((d) => d.followers));
    const formatTick = (val: number) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : `${val}`);

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
            <p className="text-sm font-semibold text-gray-900 mb-2">Evolução recente</p>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ left: 8, right: 24, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />

                        {/* Primary Axis (Reach & Engaged) */}
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={formatTick} domain={[0, leftMax ? leftMax * 1.1 : 1]} />

                        {/* Secondary Axis (Followers) */}
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={formatTick} domain={[0, rightMax ? rightMax * 1.1 : 1]} />

                        <RechartsTooltip formatter={(value: number) => value.toLocaleString('pt-BR')} />

                        <Line yAxisId="left" type="monotone" dataKey="reach" name="Alcance" stroke="#4F46E5" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        <Line yAxisId="left" type="monotone" dataKey="engaged" name="Engajamento" stroke="#22C55E" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        <Line yAxisId="right" type="monotone" dataKey="followers" name="Seguidores" stroke="#0EA5E9" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <div className="flex gap-4 justify-center mt-2 text-xs">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-600"></span> Alcance</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Engajamento</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500"></span> Seguidores</span>
            </div>
        </div>
    );
}
