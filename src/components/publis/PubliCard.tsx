import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EyeIcon, ChatBubbleLeftIcon, BookmarkIcon, ArrowTopRightOnSquareIcon, ChartBarIcon, ShareIcon } from '@heroicons/react/24/outline';
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
}

const PubliCard: React.FC<PubliCardProps> = ({ publi, onShare, onAnalyze }) => {
    const { description, postDate, coverUrl, theme, classificationStatus, stats } = publi;

    const formattedDate = postDate ? format(new Date(postDate), "d 'de' MMMM, yyyy", { locale: ptBR }) : 'Data desconhecida';

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

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
            {/* Header / Cover */}
            <div className="relative w-full aspect-[4/5] bg-gray-100">
                {imgSrc && !imgError ? (
                    <Image
                        src={imgSrc}
                        alt="Post cover"
                        fill
                        className="object-cover"
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
                    <div className="flex items-center justify-center h-full text-gray-400 bg-gray-50">
                        <span className="text-sm">Sem imagem</span>
                    </div>
                )}
                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium text-gray-700 uppercase">
                    {theme || 'Geral'}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${classificationStatus === 'completed' ? 'bg-green-100 text-green-700' :
                        classificationStatus === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                        }`}>
                        {classificationStatus === 'completed' ? 'Classificado' : classificationStatus === 'failed' ? 'Erro IA' : 'Pendente'}
                    </span>
                    <span className="text-xs text-gray-500">{formattedDate}</span>
                </div>

                <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-3 min-h-[40px]">
                    {description || 'Sem descrição'}
                </h3>

                {/* Mini Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                    <div className="bg-gray-50 p-2 rounded">
                        <EyeIcon className="w-4 h-4 mx-auto text-gray-500 mb-1" />
                        <span className="text-xs font-bold text-gray-900">{formatNumber(stats?.views || stats?.reach)}</span>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                        <ChatBubbleLeftIcon className="w-4 h-4 mx-auto text-gray-500 mb-1" />
                        <span className="text-xs font-bold text-gray-900">{formatNumber(stats?.comments)}</span>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                        <BookmarkIcon className="w-4 h-4 mx-auto text-gray-500 mb-1" />
                        <span className="text-xs font-bold text-gray-900">{formatNumber(stats?.saved)}</span>
                    </div>
                </div>

                <div className="mt-auto flex gap-2">
                    <button
                        onClick={() => onAnalyze(publi.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <ChartBarIcon className="w-4 h-4" />
                        Analisar
                    </button>
                    <button
                        onClick={() => onShare(publi.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <ShareIcon className="w-4 h-4" />
                        Share
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PubliCard;

