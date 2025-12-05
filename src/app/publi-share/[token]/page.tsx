'use client';

import React from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import {
    CalendarDaysIcon,
    TagIcon,
    EyeIcon,
    HeartIcon,
    ChatBubbleOvalLeftEllipsisIcon,
    ShareIcon,
    ArrowTrendingUpIcon,
    PresentationChartLineIcon,
    UsersIcon,
    LinkIcon,
    InformationCircleIcon,
    ChartBarIcon,
    ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';
import { idsToLabels } from '@/app/lib/classification';
import { UserAvatar } from '@/app/components/UserAvatar';

// --- Interfaces (Locais para evitar imports de server-side models) ---
interface ISnapshot {
    date: string | Date;
    dailyViews?: number;
    dailyLikes?: number;
    dailyComments?: number;
    dailyShares?: number;
}

interface IPublicMetric {
    description: string;
    postDate: string;
    type: string;
    theme?: string;
    coverUrl?: string;
    postLink?: string;
    updatedAt: string;
    stats: {
        views?: number;
        likes?: number;
        comments?: number;
        shares?: number;
        reach?: number;
        impresions?: number;
        engagement_rate_on_reach?: number;
        total_interactions?: number;
        video_views?: number;
        saved?: number;
        [key: string]: any;
    };
    // Rich data
    format?: string[];
    proposal?: string[];
    context?: string[];
    tone?: string[];
    references?: string[];
    dailySnapshots?: ISnapshot[];
}

interface PublicShareResponse {
    data: IPublicMetric;
    creator: {
        name: string;
        email?: string;
        avatarUrl?: string;
    };
    error?: string;
    meta: {
        lastUpdate: string;
        isLive: boolean;
    }
}

// --- Constants & Helpers ---
const fetcher = (url: string) => fetch(url).then((res) => {
    if (!res.ok) throw new Error('Erro ao carregar dados');
    return res.json();
});

const glassClass = "backdrop-blur-xl bg-white/70 border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-2xl";
const cardHoverClass = "transition-all duration-300 hover:shadow-[0_12px_48px_rgba(0,0,0,0.08)] hover:-translate-y-1";

const COLOR_BY_TYPE: Record<'format' | 'proposal' | 'context' | 'tone' | 'reference', string> = {
    format: 'bg-rose-50 text-rose-700 border-rose-200',
    proposal: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    context: 'bg-sky-50 text-sky-700 border-sky-200',
    tone: 'bg-purple-50 text-purple-700 border-purple-200',
    reference: 'bg-amber-50 text-amber-700 border-amber-200',
};

const TagPill: React.FC<{ children: React.ReactNode; color: string }> = ({ children, color }) => (
    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${color} bg-opacity-60`}>
        {children}
    </span>
);

const ChipRow = ({ label, items, type }: { label: string; items?: string[]; type: 'format' | 'proposal' | 'context' | 'tone' | 'reference' }) => {
    const labels = idsToLabels(items, type);
    if (!labels.length) return null;

    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">{label}</span>
            <div className="flex flex-wrap gap-2">
                {labels.map((t, i) => (
                    <TagPill key={`${type}-${i}`} color={COLOR_BY_TYPE[type]}>{t}</TagPill>
                ))}
            </div>
        </div>
    );
};

const MetricItem = ({ icon: Icon, label, value, subLabel }: { icon: React.ElementType, label: string, value: string | number, subLabel?: string }) => (
    <div className="flex flex-col p-4 bg-white/50 rounded-xl border border-white/60 shadow-sm transition-all hover:bg-white/80">
        <div className="flex items-center gap-2 mb-2 text-gray-500">
            <Icon className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        </div>
        <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</span>
            {subLabel && <span className="text-xs text-gray-400">{subLabel}</span>}
        </div>
    </div>
);

export default function PublicSharePage({ params }: { params: { token: string } }) {
    const { data: response, error, isLoading } = useSWR<PublicShareResponse>(
        `/api/public/publis/${params.token}`,
        fetcher,
        { revalidateOnFocus: false }
    );

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (error || response?.error || !response?.data) {
        if (response?.error?.includes('404')) notFound();
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <ExclamationCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Link Indisponível</h1>
                    <p className="text-gray-500">{response?.error || 'Não foi possível carregar os dados.'}</p>
                </div>
            </div>
        );
    }

    const { data: metric, creator } = response;
    const stats = metric.stats || {};

    // Ensure we have at least one data point for the chart (Current State) if snapshots are empty
    const snapshots = (metric.dailySnapshots || []).length > 0
        ? metric.dailySnapshots
        : [{
            date: metric.updatedAt || new Date().toISOString(),
            dailyViews: stats.views || stats.video_views || 0,
            dailyLikes: stats.likes || 0
        }];

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-poppins text-gray-900 pb-20">
            {/* --- Header / Brand --- */}
            <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
                            <span className="text-white font-bold text-sm">D2C</span>
                        </div>
                        <span className="font-semibold text-gray-700 text-sm tracking-tight hidden sm:inline">Data2Content Analytics</span>
                    </div>
                    <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                        {creator.avatarUrl ? (
                            <Image src={creator.avatarUrl} alt={creator.name} width={24} height={24} className="rounded-full" />
                        ) : (
                            <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-[10px] font-bold text-indigo-700">
                                {creator.name.charAt(0)}
                            </div>
                        )}
                        <span className="text-sm font-medium text-gray-700 line-clamp-1 max-w-[150px]">{creator.name}</span>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

                {/* --- Top Section: Cover & Key Stats --- */}
                <div className="grid lg:grid-cols-12 gap-6 w-full">

                    {/* Left Column: Visual & Context (4 cols) */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Cover Card */}
                        <div className={`${glassClass} p-2 overflow-hidden ${cardHoverClass}`}>
                            <div className="relative aspect-[4/5] w-full rounded-xl overflow-hidden bg-gray-100 group">
                                {metric.coverUrl ? (
                                    <>
                                        <Image
                                            src={metric.coverUrl}
                                            alt="Capa da Publi"
                                            fill
                                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                                    </>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-300">
                                        <TagIcon className="w-16 h-16" />
                                    </div>
                                )}

                                {/* Floating Info on Cover */}
                                <div className="absolute bottom-4 left-4 right-4 text-white">
                                    <div className="flex items-center gap-2 text-xs font-medium bg-black/40 backdrop-blur-sm w-fit px-2 py-1 rounded-md mb-2">
                                        <CalendarDaysIcon className="w-3.5 h-3.5" />
                                        {new Date(metric.postDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </div>
                                    <h2 className="text-lg font-bold leading-tight line-clamp-2 drop-shadow-sm">
                                        {metric.theme || 'Sem tema definido'}
                                    </h2>
                                </div>

                                {metric.postLink && (
                                    <a
                                        href={metric.postLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="absolute top-4 right-4 bg-white/90 hover:bg-white text-gray-900 p-2 rounded-full shadow-lg transition-all hover:scale-110"
                                        title="Ver post original"
                                    >
                                        <LinkIcon className="w-4 h-4" />
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Context Chips Card */}
                        <div className={`${glassClass} p-6 space-y-5`}>
                            <div className="flex items-center gap-2 mb-2">
                                <TagIcon className="w-5 h-5 text-indigo-500" />
                                <h3 className="font-semibold text-gray-800">Contexto & Classificação</h3>
                            </div>

                            <div className="space-y-4">
                                <ChipRow label="Formato" items={metric.format} type="format" />
                                <ChipRow label="Proposta" items={metric.proposal} type="proposal" />
                                <ChipRow label="Contexto" items={metric.context} type="context" />
                                <ChipRow label="Tom" items={metric.tone} type="tone" />
                            </div>

                            {metric.description && (
                                <div className="pt-4 mt-4 border-t border-gray-100">
                                    <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 block mb-2">Legenda / Briefing</span>
                                    <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                        {metric.description}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Performance Data (8 cols) */}
                    <div className="lg:col-span-8 flex flex-col gap-6 w-full">

                        {/* KPI Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                            <MetricItem
                                icon={UsersIcon}
                                label="Alcance"
                                value={stats.reach || 0}
                                subLabel="contas únicas"
                            />
                            <MetricItem
                                icon={ArrowTrendingUpIcon}
                                label="Interações Totais"
                                value={stats.total_interactions || 0}
                                subLabel="ações"
                            />
                            <MetricItem
                                icon={PresentationChartLineIcon}
                                label="Taxa de Engajamento"
                                value={stats.engagement_rate_on_reach ? `${(stats.engagement_rate_on_reach * 100).toFixed(2)}%` : '—'}
                                subLabel="sobre alcance"
                            />

                            <MetricItem icon={EyeIcon} label="Visualizações" value={stats.views || stats.video_views || 0} />
                            <MetricItem icon={HeartIcon} label="Curtidas" value={stats.likes || 0} />
                            <MetricItem icon={ChatBubbleOvalLeftEllipsisIcon} label="Comentários" value={stats.comments || 0} />
                            <MetricItem icon={ShareIcon} label="Compartilhamentos" value={stats.shares || 0} />
                            {stats.saved !== undefined && <MetricItem icon={InformationCircleIcon} label="Salvos" value={stats.saved || 0} />}
                        </div>

                        {/* Daily Performance Chart */}
                        <div className={`${glassClass} p-6 h-[400px] flex flex-col w-full`}>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <ChartBarIcon className="w-5 h-5 text-indigo-500" />
                                    <h3 className="font-semibold text-gray-800">Desempenho Diário</h3>
                                </div>
                            </div>

                            {snapshots && snapshots.length > 0 ? (
                                <div className="flex-1 w-full min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={snapshots} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis
                                                dataKey="date"
                                                tickFormatter={(str) => new Date(str).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                                stroke="#94A3B8"
                                                dy={10}
                                            />
                                            <YAxis
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                                stroke="#94A3B8"
                                                tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                                            />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                                                labelFormatter={(label) => new Date(label).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                                            <Line
                                                type="monotone"
                                                dataKey="dailyViews"
                                                name="Visualizações"
                                                stroke="#6366f1"
                                                strokeWidth={3}
                                                dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                                                activeDot={{ r: 6, strokeWidth: 0 }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="dailyLikes"
                                                name="Curtidas"
                                                stroke="#ec4899"
                                                strokeWidth={3}
                                                dot={{ r: 4, fill: '#ec4899', strokeWidth: 2, stroke: '#fff' }}
                                                activeDot={{ r: 6, strokeWidth: 0 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                                    <ChartBarIcon className="w-10 h-10 mb-2 opacity-50" />
                                    <p className="text-sm">Gráfico disponível após 2 dias de coleta de dados.</p>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </main>

            <footer className="max-w-7xl mx-auto px-4 py-8 text-center">
                <p className="text-xs text-gray-400 font-medium tracking-wide">
                    POWERED BY <span className="font-bold text-gray-500">DATA2CONTENT</span>
                </p>
            </footer>
        </div>
    );
}
