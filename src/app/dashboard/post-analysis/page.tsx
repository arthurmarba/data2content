"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, Play, CheckCircle2, MessageSquare, ExternalLink, Heart, Share2, Bookmark, BarChart2 } from 'lucide-react';
import Image from 'next/image';
import useSWR from 'swr';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { idsToLabels } from '@/app/lib/classification';
import DiscoverVideoModal from '@/app/discover/components/DiscoverVideoModal';

/**
 * TYPES
 */
type ReviewStatus = 'do' | 'dont' | 'almost';

interface PostReviewItem {
    _id: string;
    postId: string;
    status: ReviewStatus;
    note?: string;
    updatedAt: string;
    post: {
        coverUrl?: string;
        thumbnailUrl?: string;
        thumbnail_url?: string;
        mediaUrl?: string;
        media_url?: string;
        type?: string;
        postLink?: string;
        instagramMediaId?: string;
        context?: string[] | string;
        postContext?: string[] | string;
        stats?: {
            likes?: number;
            comments?: number;
            shares?: number;
            saved?: number;
            reach?: number;
            total_interactions?: number;
        };
    };
}

const STATUS_CONFIG: Record<ReviewStatus, { label: string; bg: string; text: string; border: string; icon: any }> = {
    do: { label: 'Keep Doing', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
    dont: { label: 'Stop Doing', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: AlertCircle },
    almost: { label: 'Pivot / Adjust', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: MessageSquare },
};

export default function PostAnalysisPage() {
    const { data: session } = useSession();
    const [lastViewedAt, setLastViewedAt] = useLocalStorage<string>('d2c_last_viewed_reviews_at', '');

    // Video Modal State
    const [videoOpen, setVideoOpen] = useState(false);
    const [activeVideo, setActiveVideo] = useState<{ url?: string; link?: string; poster?: string } | null>(null);

    const openPlayer = (videoUrl?: string, postLink?: string, posterUrl?: string) => {
        setActiveVideo({ url: videoUrl, link: postLink, poster: posterUrl });
        setVideoOpen(true);
    };

    // Fetch Reviews
    const { data, error, isLoading } = useSWR<{ items: PostReviewItem[] }>(
        '/api/dashboard/post-reviews?limit=50',
        async (url: string) => {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Falha ao carregar reviews');
            return res.json();
        },
        {
            revalidateOnFocus: true,
            revalidateOnMount: true,
        }
    );

    // Update read status on mount if data is present
    useEffect(() => {
        if (data?.items?.length) {
            setLastViewedAt(new Date().toISOString());
        }
    }, [data, setLastViewedAt]);

    const reviews = useMemo(() => data?.items || [], [data?.items]);

    // Grouping Logic
    const groupedReviews = useMemo(() => {
        const groups: Record<string, PostReviewItem[]> = {};

        reviews.forEach(review => {
            // Get context - usually an array, we take the primary one or use fallback
            const contexts = review.post.postContext || review.post.context || [];
            const contextList = Array.isArray(contexts) ? contexts : (typeof contexts === 'string' ? contexts.split(',') : [contexts]);
            const primaryContext = contextList[0]?.trim() || 'Geral';

            // Resolve label
            const label = idsToLabels([primaryContext], 'context')[0] || primaryContext;

            if (!groups[label]) groups[label] = [];
            groups[label].push(review);
        });

        // Sort groups by name (optional)
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    }, [reviews]);



    if (isLoading) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-[#6E1F93]" />
                <p className="mt-4 text-sm font-medium">Carregando seus reviews...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-[40vh] flex-col items-center justify-center p-8 text-slate-500">
                <AlertCircle className="mb-2 h-10 w-10 text-rose-500/50" />
                <p>Não foi possível carregar os reviews.</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-4 text-sm font-semibold text-[#6E1F93] hover:underline"
                >
                    Tentar novamente
                </button>
            </div>
        );
    }

    if (reviews.length === 0) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
                <div className="group relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-50 shadow-inner">
                    <MessageSquare className="h-10 w-10 text-slate-300 transition group-hover:scale-110 group-hover:text-[#6E1F93]" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Nenhum review encontrado</h2>
                <p className="mt-2 max-w-sm text-sm text-slate-500">
                    Seus conteúdos ainda não foram revisados pelo time. Assim que houver feedbacks, eles aparecerão aqui.
                </p>
            </div>
        );
    }

    return (
        <div className="dashboard-page-shell mx-auto w-full max-w-5xl py-8">
            <header className="mb-10 text-center">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Review de Post</h1>
                <p className="mt-2 text-lg text-slate-600">
                    Feedbacks diretos do nosso time sobre seus conteúdos recentes.
                </p>
            </header>

            <div className="space-y-12">
                {groupedReviews.map(([label, items]) => (
                    <section key={label} className="space-y-6">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold text-slate-900">{label}</h2>
                            <div className="h-px flex-1 bg-slate-100" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                {items.length} {items.length === 1 ? 'review' : 'reviews'}
                            </span>
                        </div>
                        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                            {items.map((review, i) => (
                                <ReviewCard
                                    key={review._id}
                                    review={review}
                                    index={i}
                                    onPlay={() => {
                                        const videoUrl = review.post.media_url || review.post.mediaUrl;
                                        const posterUrl = review.post.thumbnail_url || review.post.thumbnailUrl || review.post.coverUrl;
                                        openPlayer(videoUrl, review.post.postLink, posterUrl);
                                    }}
                                />
                            ))}
                        </div>
                    </section>
                ))}
            </div>

            <DiscoverVideoModal
                open={videoOpen}
                onClose={() => setVideoOpen(false)}
                videoUrl={activeVideo?.url}
                postLink={activeVideo?.link}
                posterUrl={activeVideo?.poster}
            />
        </div>
    );
}

function ReviewCard({ review, index, onPlay }: { review: PostReviewItem; index: number; onPlay: () => void }) {

    const config = STATUS_CONFIG[review.status];
    const Icon = config.icon;
    const coverUrl = review.post.thumbnail_url || review.post.thumbnailUrl || review.post.coverUrl || review.post.media_url || review.post.mediaUrl;
    const isVideo = review.post.type === 'VIDEO' || review.post.type === 'video';
    const stats = review.post.stats || {};

    const formatNum = (num?: number) => {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num.toString();
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.4 }}
            className="group relative flex flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
        >
            {/* Status Header */}
            <div className={`flex items-center gap-2 border-b px-5 py-3 ${config.bg} ${config.border} border-b`}>
                <Icon className={`h-4 w-4 ${config.text}`} />
                <span className={`text-xs font-bold uppercase tracking-wider ${config.text}`}>
                    {config.label}
                </span>
            </div>

            {/* Content Body */}
            <div className="flex flex-1 flex-col p-6">
                {/* Note */}
                <div className="mb-6 flex-1">
                    <p className="whitespace-pre-wrap text-lg font-medium leading-relaxed text-slate-800">
                        {review.note || <span className="italic text-slate-400">Sem anotações.</span>}
                    </p>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-5 gap-2 rounded-2xl bg-slate-50 p-3">
                    <div className="flex flex-col items-center justify-center gap-1">
                        <Heart className="h-3.5 w-3.5 text-rose-500" />
                        <span className="text-[10px] font-bold text-slate-600">{formatNum(stats.likes)}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-1 border-l border-slate-200">
                        <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-[10px] font-bold text-slate-600">{formatNum(stats.comments)}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-1 border-l border-slate-200">
                        <Share2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-[10px] font-bold text-slate-600">{formatNum(stats.shares)}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-1 border-l border-slate-200">
                        <Bookmark className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-[10px] font-bold text-slate-600">{formatNum(stats.saved)}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-1 border-l border-slate-200">
                        <BarChart2 className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-600">{formatNum(stats.reach)}</span>
                    </div>
                </div>
            </div>

            {/* Footer: Post Preview context */}
            <div className="mt-auto border-t border-slate-100 bg-slate-50/50 p-3">
                <div
                    onClick={onPlay}
                    className="flex cursor-pointer items-center gap-3 overflow-hidden rounded-xl bg-white p-2 shadow-sm ring-1 ring-slate-900/5 transition hover:ring-[#6E1F93]/30 hover:shadow-md active:scale-[0.98]"
                >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {coverUrl && (
                            <Image
                                src={coverUrl}
                                alt="Post thumbnail"
                                fill
                                className="object-cover"
                                unoptimized
                            />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/20">
                            <Play className="h-4 w-4 fill-white text-white drop-shadow-md" />
                        </div>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <span className="truncate text-[10px] font-medium text-slate-400 uppercase tracking-tight">
                            Clique para reproduzir
                        </span>
                        {review.post.postLink ? (
                            <span className="inline-flex max-w-fit items-center gap-1.5 truncate text-xs font-semibold text-[#6E1F93]">
                                Ver conteúdo original
                                <ExternalLink className="h-3 w-3" />
                            </span>
                        ) : (
                            <span className="text-xs text-slate-400">Preview indisponível</span>
                        )}
                    </div>
                </div>

                <div className="mt-2 text-right">
                    <span className="text-[9px] font-medium text-slate-300">
                        Feedback de {new Date(review.updatedAt).toLocaleDateString('pt-BR')}
                    </span>
                </div>
            </div>
        </motion.div>
    );
}
