import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EyeIcon, ChatBubbleLeftIcon, BookmarkIcon, ArrowTopRightOnSquareIcon, ChartBarIcon, ShareIcon } from '@heroicons/react/24/outline';

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

    // Format numbers
    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(num || 0);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
            {/* Header / Cover */}
            <div className="relative w-full aspect-[4/5] bg-gray-100">
                {coverUrl ? (
                    <Image
                        src={coverUrl}
                        alt="Post cover"
                        fill
                        className="object-cover"
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
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
