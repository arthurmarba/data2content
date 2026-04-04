import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EyeIcon, ChatBubbleLeftIcon, BookmarkIcon, ChartBarIcon, ShareIcon } from '@heroicons/react/24/outline';
import { getProxiedImageUrl } from '@/utils/imageUtils';

interface PubliCardProps {
    publi: {
        id: string;
        description: string;
        postDate: string;
        coverUrl?: string;
        theme?: string;
        classificationStatus: string;
        stats: any;
        postLink?: string;
    };
    onShare: (publiId: string) => void;
    onAnalyze: (publiId: string) => void;
    onLinkCampaign: (publiId: string) => void;
    onOpenCampaign?: () => void;
    linkDisabled?: boolean;
    isLinking?: boolean;
    isLinkedToCampaign?: boolean;
    compactView?: boolean;
}

const PubliCard: React.FC<PubliCardProps> = ({
    publi,
    onShare,
    onAnalyze,
    onLinkCampaign,
    onOpenCampaign,
    linkDisabled = false,
    isLinking = false,
    isLinkedToCampaign = false,
    compactView = false,
}) => {
    const { description, postDate, coverUrl, theme, classificationStatus, stats } = publi;

    const formattedDate = postDate ? format(new Date(postDate), "d 'de' MMMM, yyyy", { locale: ptBR }) : 'Data desconhecida';
    const compactDateLabel = postDate ? format(new Date(postDate), "d MMM yyyy", { locale: ptBR }) : 'Sem data';
    const themeLabel = theme || 'Geral';

    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        if (coverUrl) {
            // Tenta usar a URL proxied desde o início se for um host bloqueado
            // ou apenas a URL original se não for.
            const urlToUse = getProxiedImageUrl(coverUrl);
            setImgSrc(urlToUse);
            setImgError(false);
        } else {
            setImgSrc(null);
        }
    }, [coverUrl]);

    // Format numbers
    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(num || 0);
    };

    const handleImageError = () => {
        // Se falhar e ainda não estivermos usando o proxy (ex: host não bloqueado mas que falhou),
        // ou se estavamos usando proxy strict=1 e falhou (imagem 1x1),
        // podemos tentar uma estratégia de fallback se necessário.
        // Por enquanto, marcamos como erro para mostrar o placeholder.
        setImgError(true);
    };

    const publiCardBase =
        'min-w-0 overflow-hidden rounded-[1.5rem] border border-zinc-100/90 bg-zinc-50/68 flex flex-col';
    const showStatusPill = !compactView || classificationStatus !== 'completed';
    const statusLabel =
        classificationStatus === 'completed' ? 'Classificado' : classificationStatus === 'failed' ? 'Erro IA' : 'Pendente';
    const compactPrimaryMetric = formatNumber(stats?.views || stats?.reach);
    const compactCommentMetric = formatNumber(stats?.comments);
    const compactSaveMetric = formatNumber(stats?.saved);
    const compactViewsValue = Number(stats?.views ?? stats?.reach ?? 0);
    const compactInteractionsValue =
        Number(stats?.likes ?? stats?.like_count ?? 0) +
        Number(stats?.comments ?? stats?.comment_count ?? 0) +
        Number(stats?.shares ?? stats?.share_count ?? 0) +
        Number(stats?.saved ?? stats?.saves ?? 0);
    const compactEngagementRate =
        compactViewsValue > 0 && Number.isFinite(compactInteractionsValue)
            ? (compactInteractionsValue / compactViewsValue) * 100
            : null;
    const compactErLabel =
        typeof compactEngagementRate === 'number' && Number.isFinite(compactEngagementRate)
            ? `${compactEngagementRate >= 10 ? compactEngagementRate.toFixed(1) : compactEngagementRate.toFixed(2)}% ER`
            : null;

    if (compactView) {
        return (
            <article className="rounded-[1.05rem] border border-zinc-100/80 bg-zinc-50/58 px-2.5 py-2.5 transition hover:border-zinc-200 hover:bg-white/82">
                <div className="flex items-start gap-3.5">
                    <div className="relative h-[88px] w-[68px] shrink-0 overflow-hidden rounded-[0.95rem] border border-zinc-100/90 bg-white">
                        {imgSrc && !imgError ? (
                            <Image
                                src={imgSrc}
                                alt="Post cover"
                                fill
                                className="object-cover object-top"
                                onError={handleImageError}
                                onLoad={(e) => {
                                    const el = e.currentTarget as HTMLImageElement;
                                    if (el.naturalWidth <= 2 && el.naturalHeight <= 2) {
                                        handleImageError();
                                    }
                                }}
                                unoptimized={imgSrc.includes('/api/proxy')}
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,rgba(250,250,250,0.92),rgba(244,244,245,0.82))] text-center text-[9px] font-medium uppercase tracking-[0.16em] text-zinc-400">
                                Sem capa
                            </div>
                        )}
                    </div>

                    <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-start justify-between gap-3">
                            <p className="line-clamp-2 text-[13px] font-semibold leading-[1.38] text-zinc-900">
                                {description || 'Sem descrição'}
                            </p>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-[11px] text-zinc-400">{compactDateLabel}</span>
                            {compactViewsValue > 0 ? (
                                <span className="inline-flex items-center rounded-full bg-zinc-100/90 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                                    {compactPrimaryMetric} views
                                </span>
                            ) : null}
                            {compactErLabel ? (
                                <span className="text-[11px] text-zinc-500">{compactErLabel}</span>
                            ) : (
                                <span className="text-[11px] text-zinc-500">{themeLabel}</span>
                            )}
                            <span className="text-[11px] text-zinc-400">Clique para ver a análise</span>
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => onShare(publi.id)}
                                className="inline-flex items-center gap-1 rounded-full bg-zinc-950 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-zinc-800"
                            >
                                <ShareIcon className="h-3 w-3" />
                                Copiar link
                            </button>
                            <button
                                type="button"
                                onClick={() => onAnalyze(publi.id)}
                                className="inline-flex items-center gap-1 rounded-full border border-zinc-100/90 bg-white/88 px-2.5 py-1 text-[11px] font-medium text-zinc-600 transition hover:bg-white"
                            >
                                <ChartBarIcon className="h-3 w-3" />
                                Ver
                            </button>
                            {(!linkDisabled || isLinkedToCampaign) ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (isLinkedToCampaign) {
                                            onOpenCampaign?.();
                                            return;
                                        }
                                        onLinkCampaign(publi.id);
                                    }}
                                    disabled={isLinkedToCampaign ? false : (linkDisabled || isLinking)}
                                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                                        isLinkedToCampaign
                                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                                            : 'border border-zinc-100/90 bg-white/88 text-zinc-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50'
                                    }`}
                                >
                                    {isLinkedToCampaign ? "Campanha" : isLinking ? "Vinculando..." : "Vincular"}
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>
            </article>
        );
    }

    return (
        <div className={`${publiCardBase} ${compactView ? "rounded-[1.5rem]" : "rounded-[1.75rem]"}`}>
            {/* Header / Cover */}
            <div className={`relative w-full bg-zinc-100 ${compactView ? "h-48" : "aspect-[4/5]"}`}>
                {imgSrc && !imgError ? (
                    <Image
                        src={imgSrc}
                        alt="Post cover"
                        fill
                        className={compactView ? "object-cover object-top" : "object-cover"}
                        onError={handleImageError}
                        onLoad={(e) => {
                            const el = e.currentTarget as HTMLImageElement;
                            // Check for 1x1 pixel error images even if loaded successfully
                            if (el.naturalWidth <= 2 && el.naturalHeight <= 2) {
                                handleImageError();
                            }
                        }}
                        unoptimized={imgSrc.includes('/api/proxy')} // Disable optimization for proxied images to avoid double processing
                    />
                ) : (
                    <div className="flex h-full items-center justify-center bg-[linear-gradient(180deg,rgba(250,250,250,0.92),rgba(244,244,245,0.82))] text-zinc-400">
                        <div className="rounded-full border border-zinc-100/90 bg-white/72 px-3 py-1">
                            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400">Capa indisponível</span>
                        </div>
                    </div>
                )}
                {!compactView ? (
                    <div className="absolute right-3 top-3 rounded-full border border-white/80 bg-white/88 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600 backdrop-blur-sm">
                        {themeLabel}
                    </div>
                ) : null}
            </div>

            {/* Content */}
            <div className={`${compactView ? "p-3" : "p-4"} flex-1 flex flex-col`}>
                <div className={`flex items-center justify-between ${compactView ? "mb-2" : "mb-2"} gap-2`}>
                    {!compactView && showStatusPill ? (
                        <span className={`${compactView ? "text-[9px] px-2 py-1" : "text-[10px] px-2.5 py-1"} rounded-full font-bold uppercase tracking-[0.14em] ${classificationStatus === 'completed' ? 'bg-green-100 text-green-700' :
                            classificationStatus === 'failed' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                            }`}>
                            {statusLabel}
                        </span>
                    ) : (
                        <span className={`${compactView ? "rounded-full border border-zinc-100 bg-white/85 px-2 py-1 text-[9px] uppercase tracking-[0.16em]" : "text-[10px]"} font-medium text-zinc-400`}>
                            {compactView ? themeLabel : 'Publi'}
                        </span>
                    )}
                    <span className={`${compactView ? "text-[10px]" : "text-[11px]"} font-medium text-zinc-400`}>
                        {compactView ? compactDateLabel : formattedDate}
                    </span>
                </div>
                {!compactView && isLinkedToCampaign ? (
                    <p className={`inline-flex w-fit rounded-full bg-emerald-50 font-semibold text-emerald-700 ${compactView ? "mb-1.5 px-2 py-1 text-[10px]" : "mb-2 px-2.5 py-1 text-[11px]"}`}>
                        {compactView ? "Na campanha" : "Vinculada na campanha"}
                    </p>
                ) : null}

                <h3 className={`${compactView ? "mb-2 text-[13px] leading-[1.38]" : "mb-3 min-h-[40px] text-sm"} line-clamp-2 font-semibold text-zinc-900`}>
                    {description || 'Sem descrição'}
                </h3>

                {/* Mini Stats */}
                {compactView ? (
                    <div className="mb-3 flex items-center gap-3 border-t border-zinc-100 pt-2.5 text-[10px] text-zinc-500">
                        <span className="inline-flex items-center gap-1">
                            <EyeIcon className="h-3 w-3 text-zinc-500" />
                            <strong className="font-semibold text-zinc-900">{compactPrimaryMetric}</strong>
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <ChatBubbleLeftIcon className="h-3 w-3 text-zinc-500" />
                            <strong className="font-semibold text-zinc-900">{compactCommentMetric}</strong>
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <BookmarkIcon className="h-3 w-3 text-zinc-500" />
                            <strong className="font-semibold text-zinc-900">{compactSaveMetric}</strong>
                        </span>
                    </div>
                ) : (
                    <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                        <div className="dashboard-stat-card p-2">
                            <EyeIcon className="mx-auto mb-1 h-4 w-4 text-zinc-500" />
                            <span className="text-xs font-bold text-zinc-900">{compactPrimaryMetric}</span>
                        </div>
                        <div className="dashboard-stat-card p-2">
                            <ChatBubbleLeftIcon className="mx-auto mb-1 h-4 w-4 text-zinc-500" />
                            <span className="text-xs font-bold text-zinc-900">{compactCommentMetric}</span>
                        </div>
                        <div className="dashboard-stat-card p-2">
                            <BookmarkIcon className="mx-auto mb-1 h-4 w-4 text-zinc-500" />
                            <span className="text-xs font-bold text-zinc-900">{compactSaveMetric}</span>
                        </div>
                    </div>
                )}

                <div className={`mt-auto ${compactView ? "space-y-2" : "space-y-2"}`}>
                    <div className={`flex ${compactView ? "gap-1.5" : "gap-2"}`}>
                        <button
                            onClick={() => onAnalyze(publi.id)}
                            className={`dashboard-primary-button flex flex-1 items-center justify-center gap-1.5 ${compactView ? "rounded-[1rem] px-3 py-2 text-[11px] font-semibold" : "px-3 py-2.5 text-sm font-medium"}`}
                        >
                            <ChartBarIcon className={compactView ? "h-3.5 w-3.5" : "w-4 h-4"} />
                            {compactView ? "Ver" : "Analisar"}
                        </button>
                        <button
                            onClick={() => onShare(publi.id)}
                            className={`dashboard-secondary-button flex flex-1 items-center justify-center gap-1.5 text-zinc-700 ${compactView ? "rounded-[1rem] px-3 py-2 text-[11px] font-semibold" : "px-3 py-2.5 text-sm font-medium"}`}
                        >
                            <ShareIcon className={compactView ? "h-3.5 w-3.5" : "w-4 h-4"} />
                            {compactView ? "Link" : "Compartilhar"}
                        </button>
                    </div>
                    {(!compactView || isLinkedToCampaign || !linkDisabled) ? (
                        <button
                            onClick={() => {
                                if (isLinkedToCampaign) {
                                    onOpenCampaign?.();
                                    return;
                                }
                                onLinkCampaign(publi.id);
                            }}
                            disabled={isLinkedToCampaign ? false : (linkDisabled || isLinking)}
                            className={`w-full flex items-center justify-center gap-1.5 rounded-[1rem] transition-colors ${
                                isLinkedToCampaign
                                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    : 'border border-zinc-200 bg-white/85 text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50'
                            } ${compactView ? "px-2 py-1.5 text-[11px] font-semibold" : "px-3 py-2.5 text-sm font-medium"}`}
                        >
                            {isLinkedToCampaign ? "Abrir campanha" : isLinking ? "Vinculando..." : (compactView ? "Campanha" : "Vincular à campanha")}
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default PubliCard;
