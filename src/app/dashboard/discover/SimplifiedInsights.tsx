"use client";

import GlassCard from "@/components/GlassCard";
import { Flame, Sparkles, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

type SimplifiedInsightsProps = {
    heatmap?: { blockStartHour: number; score: number }[];
    tips?: string[];
    className?: string;
};

export default function SimplifiedInsights({
    heatmap = [],
    tips = [],
    className,
}: SimplifiedInsightsProps) {
    const hasTips = tips.length > 0;

    // Process heatmap for chart
    const chartData = (heatmap || [])
        .sort((a, b) => a.blockStartHour - b.blockStartHour)
        .map(h => ({
            hour: `${h.blockStartHour}h`,
            score: h.score,
            fullHour: h.blockStartHour
        }));

    const topHour = chartData.length > 0
        ? chartData.reduce((prev, current) => (prev.score > current.score ? prev : current))
        : null;

    return (
        <div className={["grid gap-6 md:grid-cols-2", className].filter(Boolean).join(" ")}>
            {/* Horário Mais Quente */}
            <div className="relative overflow-hidden rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-6 shadow-[0_20px_40px_-12px_rgba(251,146,60,0.15)] transition-all hover:shadow-[0_25px_50px_-12px_rgba(251,146,60,0.25)]">
                <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-orange-200/20 blur-3xl" />
                <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-amber-200/20 blur-3xl" />

                <div className="relative flex h-full flex-col">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                                <Flame size={16} className="fill-orange-600" />
                            </div>
                            <p className="text-xs font-bold uppercase tracking-wider text-orange-900/60">
                                Horário Nobre
                            </p>
                        </div>
                        {topHour && (
                            <div className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-1 text-[10px] font-bold text-orange-700">
                                <span>🔥 Pico às {topHour.hour}</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 h-32 w-full">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        itemStyle={{ color: '#ea580c', fontWeight: 'bold', fontSize: '12px' }}
                                        labelStyle={{ display: 'none' }}
                                        formatter={(value: number) => [`${Math.round(value)} pts`, 'Engajamento']}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="score"
                                        stroke="#f97316"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorScore)"
                                    />
                                    <XAxis
                                        dataKey="hour"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        interval="preserveStartEnd"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-xs text-slate-400">
                                Sem dados suficientes
                            </div>
                        )}
                    </div>

                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/60 px-3 py-2 text-xs font-medium text-slate-600 backdrop-blur-sm">
                        <TrendingUp size={14} className="text-emerald-500" />
                        <span>Baseado no histórico de performance</span>
                    </div>
                </div>
            </div>

            {/* Movimentos Sugeridos */}
            <div className="relative overflow-hidden rounded-3xl bg-[#0F172A] p-6 text-white shadow-[0_20px_40px_-12px_rgba(15,23,42,0.3)] transition-all hover:shadow-[0_25px_50px_-12px_rgba(15,23,42,0.4)]">
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-purple-500/20 blur-[50px]" />
                <div className="absolute bottom-0 right-0 h-32 w-32 bg-[url('/noise.png')] opacity-20 mix-blend-overlay" />

                <div className="relative h-full">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-purple-300">
                            <Sparkles size={16} />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-wider text-white/60">
                            Estratégia da Semana
                        </p>
                    </div>

                    {hasTips ? (
                        <div className="space-y-4">
                            {tips.map((tip, index) => (
                                <div key={index} className="group flex items-start gap-3">
                                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.6)] transition-all group-hover:scale-125 group-hover:bg-purple-300" />
                                    <p className="text-sm leading-relaxed text-slate-300 group-hover:text-white transition-colors">
                                        {tip}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex h-32 flex-col items-center justify-center text-center text-white/40">
                            <p className="text-sm">Aguardando dados para gerar insights...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
