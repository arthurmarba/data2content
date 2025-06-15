'use client';

import React, { useState, useEffect } from 'react';
import { XMarkIcon, InformationCircleIcon, ChartBarIcon, CalendarDaysIcon, LinkIcon, TagIcon, ChatBubbleBottomCenterTextIcon, EyeIcon, HeartIcon, ChatBubbleOvalLeftEllipsisIcon, ShareIcon, ArrowTrendingUpIcon, PresentationChartLineIcon } from '@heroicons/react/24/outline';
import SkeletonBlock from '../components/SkeletonBlock';

// --- Interfaces (aligning with service layer IPostDetailsData) ---
// It's assumed that the actual IMetricStats and IDailyMetricSnapshot would be imported
// from a central types definition in a real application.
interface ISimplifiedMetricStats {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  reach?: number;
  engagement_rate_on_reach?: number;
  total_interactions?: number;
  saves?: number;
  video_avg_watch_time?: number;
  impressions?: number;
}

interface ISimplifiedDailySnapshot {
  date: Date;
  dayNumber?: number;
  dailyViews?: number;
  dailyLikes?: number;
  dailyComments?: number;
  dailyShares?: number;
  cumulativeViews?: number;
  cumulativeLikes?: number;
}

export interface IPostDetailsData { // Renamed from IPostDetail to match service conceptual name
  _id: string; // Assuming it will be string after fetch, or Types.ObjectId if handled
  user?: any;
  postLink?: string;
  description?: string;
  postDate?: Date;
  type?: string;
  format?: string;
  proposal?: string;
  context?: string;
  theme?: string;
  collab?: boolean;
  collabCreator?: string; // Assuming string ID
  coverUrl?: string;
  instagramMediaId?: string;
  source?: string;
  classificationStatus?: string;
  stats?: ISimplifiedMetricStats;
  dailySnapshots: ISimplifiedDailySnapshot[];
}

interface PostDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string | null;
}

const PostDetailModal: React.FC<PostDetailModalProps> = ({ isOpen, onClose, postId }) => {
  const [postData, setPostData] = useState<IPostDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPostData = async () => {
      if (!postId) return;

      setIsLoading(true);
      setError(null);
      setPostData(null); // Clear previous data

      const apiUrl = `/api/admin/dashboard/posts/${postId}/details`;

      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: `Erro HTTP: ${response.status}` }));
          let errorMessage = errorData.message || errorData.error || `Erro HTTP: ${response.status}`;
          if (response.status === 404) {
            errorMessage = 'Post não encontrado.';
          }
          throw new Error(errorMessage);
        }
        const fetchedData: IPostDetailsData = await response.json();

        // API sends dates as strings, so we need to convert them back to Date objects
        // for postDate and dates within dailySnapshots
        if (fetchedData.postDate) {
            fetchedData.postDate = new Date(fetchedData.postDate);
        }
        if (fetchedData.dailySnapshots) {
            fetchedData.dailySnapshots = fetchedData.dailySnapshots.map(snapshot => ({
                ...snapshot,
                date: new Date(snapshot.date),
            }));
        }
        setPostData(fetchedData);

      } catch (e: any) {
        console.error(`Falha ao buscar detalhes do post ${postId}:`, e);
        setError(e.message || 'Falha ao carregar os detalhes do post.');
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen && postId) {
      fetchPostData();
    } else if (!isOpen) {
      // Optionally reset states when modal is closed, though initial check in effect handles it
      setPostData(null);
      setIsLoading(false);
      setError(null);
    }
  }, [isOpen, postId]);

  if (!isOpen || !postId) {
    return null;
  }

  const renderGeneralInfo = () => (
    <div>
      <h4 className="text-md font-semibold text-gray-700 mb-2 flex items-center"><InformationCircleIcon className="w-5 h-5 mr-2 text-indigo-500" />Informações Gerais</h4>
      {isLoading ? (
        <div className="space-y-2">
          <SkeletonBlock width="w-full" height="h-4" />
          <SkeletonBlock width="w-3/4" height="h-4" />
          <SkeletonBlock width="w-full" height="h-10" />
          <SkeletonBlock width="w-1/2" height="h-4" />
        </div>
      ) : postData && (
        <div className="text-sm space-y-1 text-gray-600">
          <p><strong className="font-medium text-gray-700">Link:</strong> <a href={postData.postLink} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">{postData.postLink}</a></p>
          <p><strong className="font-medium text-gray-700">Data:</strong> {postData.postDate ? new Date(postData.postDate).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</p>
          <p><strong className="font-medium text-gray-700">Tipo:</strong> {postData.type || 'N/A'}</p>
          <p><strong className="font-medium text-gray-700">Formato:</strong> {postData.format || 'N/A'}</p>
          <p><strong className="font-medium text-gray-700">Proposta:</strong> {postData.proposal || 'N/A'}</p>
          <p><strong className="font-medium text-gray-700">Contexto:</strong> {postData.context || 'N/A'}</p>
          {postData.theme && <p><strong className="font-medium text-gray-700">Tema:</strong> {postData.theme}</p>}
          {postData.coverUrl && <p><strong className="font-medium text-gray-700">Capa:</strong> <a href={postData.coverUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">{postData.coverUrl}</a></p>}
          <p className="mt-2 pt-2 border-t border-gray-200"><strong className="font-medium text-gray-700">Descrição:</strong> {postData.description || 'N/A'}</p>
        </div>
      )}
    </div>
  );

  const renderMainMetrics = () => (
    <div>
      <h4 className="text-md font-semibold text-gray-700 mb-3 flex items-center"><ArrowTrendingUpIcon className="w-5 h-5 mr-2 text-indigo-500" />Métricas Principais</h4>
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonBlock key={i} width="w-full" height="h-12" />)}
        </div>
      ) : postData && postData.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <MetricItem icon={EyeIcon} label="Visualizações" value={postData.stats.views?.toLocaleString('pt-BR') ?? 'N/A'} />
          <MetricItem icon={HeartIcon} label="Curtidas" value={postData.stats.likes?.toLocaleString('pt-BR') ?? 'N/A'} />
          <MetricItem icon={ChatBubbleOvalLeftEllipsisIcon} label="Comentários" value={postData.stats.comments?.toLocaleString('pt-BR') ?? 'N/A'} />
          <MetricItem icon={ShareIcon} label="Compart." value={postData.stats.shares?.toLocaleString('pt-BR') ?? 'N/A'} />
          <MetricItem icon={UsersIcon} label="Alcance" value={postData.stats.reach?.toLocaleString('pt-BR') ?? 'N/A'} />
          <MetricItem
            icon={PresentationChartLineIcon}
            label="Engaj./Alcance"
            value={typeof postData.stats.engagement_rate_on_reach === 'number' ? `${(postData.stats.engagement_rate_on_reach * 100).toFixed(2)}%` : 'N/A'}
          />
          {typeof postData.stats.total_interactions === 'number' && <MetricItem icon={ArrowTrendingUpIcon} label="Interações Totais" value={postData.stats.total_interactions.toLocaleString('pt-BR')} />}
          {/* Add other stats as needed, e.g., saves, video_avg_watch_time */}
        </div>
      )}
    </div>
  );

  // Helper for individual metric items
  const MetricItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | number }) => (
    <div className="bg-gray-50 p-3 rounded-md">
      <div className="flex items-center text-gray-500 mb-1">
        <Icon className="w-4 h-4 mr-1.5" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-gray-800 font-semibold text-base">{value}</p>
    </div>
  );

  const renderDailyPerformance = () => (
    <div>
      <h4 className="text-md font-semibold text-gray-700 mb-2 flex items-center"><ChartBarIcon className="w-5 h-5 mr-2 text-indigo-500" />Desempenho Diário</h4>
      {isLoading ? (
        <SkeletonBlock width="w-full" height="h-24" />
      ) : postData && (
        <>
          <div className="text-center py-6 px-4 bg-gray-50 rounded-md my-3">
            <p className="text-gray-600 font-medium">[Daily Performance Chart Placeholder]</p>
            <p className="text-sm text-gray-500 mt-1">Um gráfico de linha mostrando visualizações/curtidas diárias seria exibido aqui.</p>
          </div>
          <div className="max-h-48 overflow-y-auto text-sm border border-gray-200 rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Visualizações</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Curtidas</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {postData.dailySnapshots.map((snapshot, index) => (
                  // Using index in key as a fallback if date isn't unique enough or string conversion is an issue
                  <tr key={snapshot.date ? snapshot.date.toISOString() : index}>
                    <td className="px-3 py-2 whitespace-nowrap">{snapshot.date ? new Date(snapshot.date).toLocaleDateString('pt-BR') : 'N/A'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{snapshot.dailyViews?.toLocaleString('pt-BR') ?? 'N/A'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{snapshot.dailyLikes?.toLocaleString('pt-BR') ?? 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className={`bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
        <header className="flex justify-between items-center pb-4 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-800 flex items-center">
            <TagIcon className="w-6 h-6 mr-2 text-indigo-600" />
            Detalhes do Post <span className="text-sm text-gray-500 ml-2"> (ID: {postId})</span>
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>

        <main className="flex-grow overflow-y-auto py-6 space-y-6">
          {error && (
            <div className="text-center py-10 text-red-500 bg-red-50 p-4 rounded-md">
              <ExclamationCircleIcon className="w-8 h-8 mx-auto mb-2"/>
              <p>{error}</p>
            </div>
          )}
          {!error && (
            <>
              {renderGeneralInfo()}
              {renderMainMetrics()}
              {renderDailyPerformance()}
            </>
          )}
        </main>

        <footer className="pt-4 border-t border-gray-200 text-right">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
};

export default PostDetailModal;

// Re-imported UsersIcon as it was used in MetricItem, but not directly imported.
// This can happen if copying blocks of code. Let's ensure all icons are listed at the top.
// Actually, UsersIcon was not used in MetricItem, it was EyeIcon, HeartIcon etc.
// Ah, I see UsersIcon in renderMainMetrics -> MetricItem for Alcance. So it should be imported.
// Added: LinkIcon, TagIcon, ChatBubbleBottomCenterTextIcon, EyeIcon, HeartIcon, ChatBubbleOvalLeftEllipsisIcon, ShareIcon, ArrowTrendingUpIcon, PresentationChartLineIcon, UsersIcon (re-check if needed)
// Added CalendarDaysIcon to the import list, though not used yet, it's common for dates.
// Corrected: UsersIcon is indeed used for Alcance.
