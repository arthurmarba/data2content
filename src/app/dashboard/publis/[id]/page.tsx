"use client";

import React, { useMemo } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
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
    ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { idsToLabels } from '@/app/lib/classification';

const PubliDailyPerformanceChart = dynamic(
    () => import('./components/PubliDailyPerformanceChart'),
    { ssr: false, loading: () => null }
);

// --- Helpers & Constants (Copied from Public Page for consistency) ---
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

// --- Page Component ---

const fetcher = (url: string) => fetch(url).then(async (res) => {
    if (!res.ok) throw new Error('Erro ao carregar dados');
    return res.json();
});

export default function InternalPubliPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const { data: metric, error, isLoading } = useSWR(
        `/api/publis/${params.id}`,
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 60 * 1000,
        }
    );

    const stats = metric?.stats || {};

    const sanitizedSnapshots = useMemo(() => {
        if (!metric?.dailySnapshots) return [];
        type SnapshotLike = {
            date?: string | Date;
            dayNumber?: number | null;
            dailyViews?: number;
            dailyReach?: number;
            dailyImpressions?: number;
            dailyLikes?: number;
        };
        const raw = Array.isArray(metric.dailySnapshots) ? (metric.dailySnapshots as SnapshotLike[]) : [];
        const normalized = raw
            .map((item: SnapshotLike) => {
                const date = item?.date ? new Date(item.date) : null;
                if (!date || Number.isNaN(date.getTime())) return null;

                const dailyViews = item.dailyViews ?? item.dailyReach ?? item.dailyImpressions ?? 0;
                const dailyLikes = item.dailyLikes ?? 0;

                return {
                    date: date.toISOString(),
                    dayNumber: item.dayNumber ?? null,
                    dailyViews: Number.isFinite(dailyViews) ? dailyViews : 0,
                    dailyLikes: Number.isFinite(dailyLikes) ? dailyLikes : 0,
                };
            })
            .filter((item): item is { date: string; dayNumber: number | null; dailyViews: number; dailyLikes: number } => Boolean(item));

        return normalized.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [metric?.dailySnapshots]);

    const hasHistoricalSeries = sanitizedSnapshots.length >= 2;

    const fallbackDate = new Date(metric?.updatedAt || metric?.postDate || Date.now());
    const fallbackSnapshot = {
        date: Number.isNaN(fallbackDate.getTime()) ? new Date().toISOString() : fallbackDate.toISOString(),
        dailyViews: stats.views || stats.video_views || stats.reach || 0,
        dailyLikes: stats.likes || 0,
    };

    const chartData = sanitizedSnapshots.length > 0 ? sanitizedSnapshots : [fallbackSnapshot];

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (error || !metric) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-8">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Erro ao carregar</h1>
                    <p className="text-gray-500 mb-4">{error?.message || 'Publi não encontrada.'}</p>
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Voltar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-poppins text-gray-900 pb-20 py-6">

            {/* Navigation Header */}
            <div className="dashboard-page-shell mb-8 flex items-center justify-between">
                <button
                    onClick={() => router.back()}
                    className="flex items-center text-gray-500 hover:text-gray-900 transition-colors px-4 py-2 bg-white/50 hover:bg-white rounded-lg border border-transparent hover:border-gray-200"
                >
                    <ArrowLeftIcon className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">Voltar para Minhas Publis</span>
                </button>

                <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide
                        ${metric.classificationStatus === 'completed' ? 'bg-green-100 text-green-700' :
                            metric.classificationStatus === 'failed' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'}`}>
                        {metric.classificationStatus === 'completed' ? 'Análise Concluída' : 'Em Análise'}
                    </span>
                </div>
            </div>

            <main className="dashboard-page-shell space-y-8">

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

                            {hasHistoricalSeries ? (
                                <div className="flex-1 w-full min-h-0">
                                    <PubliDailyPerformanceChart data={chartData} />
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 text-center px-6">
                                    <ChartBarIcon className="w-10 h-10 mb-2 opacity-50" />
                                    <p className="text-sm font-medium">Dados diários insuficientes</p>
                                    <p className="text-xs text-gray-400">Coletamos pelo menos 2 dias para exibir o gráfico. Ainda assim, você pode ver o último registro:</p>
                                    {chartData[0] && (
                                        <div className="mt-3 text-xs bg-white rounded-lg border border-gray-200 px-3 py-2 shadow-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Data</span>
                                                <span className="font-semibold text-gray-800">{new Date(chartData[0].date).toLocaleDateString('pt-BR')}</span>
                                            </div>
                                            <div className="flex justify-between mt-1">
                                                <span className="text-gray-500">Visualizações</span>
                                                <span className="font-semibold text-indigo-600">{(chartData[0].dailyViews || 0).toLocaleString('pt-BR')}</span>
                                            </div>
                                            <div className="flex justify-between mt-1">
                                                <span className="text-gray-500">Curtidas</span>
                                                <span className="font-semibold text-rose-600">{(chartData[0].dailyLikes || 0).toLocaleString('pt-BR')}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}
