'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  XMarkIcon,
  InformationCircleIcon,
  ChartBarIcon,
  LinkIcon,
  EyeIcon,
  HeartIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ShareIcon,
  ArrowTrendingUpIcon,
  PresentationChartLineIcon,
  UsersIcon,
  ExclamationCircleIcon,
  CalendarDaysIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { idsToLabels } from '../../lib/classification';

// --- Helper Component for Loading State ---
const SkeletonBlock = ({ width = 'w-full', height = 'h-4' }: { width?: string; height?: string }) => (
  <div className={`${width} ${height} bg-gray-200 rounded-md animate-pulse`}></div>
);

const isHexObjectId = (id: string) => /^[a-fA-F0-9]{24}$/.test(id);

// --- Interfaces ---
interface ISimplifiedMetricStats {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  reach?: number;
  engagement_rate_on_reach?: number;
  total_interactions?: number;
  saved?: number;
  video_avg_watch_time?: number;
  impressions?: number;
}

interface ISimplifiedDailySnapshot {
  date: Date | string;
  dayNumber?: number;
  dailyViews?: number;
  dailyLikes?: number;
  dailyComments?: number;
  dailyShares?: number;
  cumulativeViews?: number;
  cumulativeLikes?: number;
}

export interface IPostDetailsData {
  _id: string;
  user?: any;
  postLink?: string;
  description?: string;
  postDate?: Date | string;
  type?: string;
  format?: string[];
  proposal?: string[];
  context?: string[];
  tone?: string[]; // pode vir string[] ou string em algumas APIs — tratamos abaixo
  references?: string[];
  theme?: string;
  collab?: boolean;
  collabCreator?: string;
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
  publicMode?: boolean;
  apiPrefix?: string;
}

// --- UI helpers ---
const TagPill: React.FC<{ children: React.ReactNode; color: string; title?: string }> = ({ children, color, title }) => (
  <span title={title} className={`text-[11px] px-2 py-0.5 rounded-full ${color} border bg-opacity-60`}>{children}</span>
);

const COLOR_BY_TYPE: Record<'format'|'proposal'|'context'|'tone'|'reference', string> = {
  format: 'bg-rose-50 text-rose-700 border-rose-200',
  proposal: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  context: 'bg-sky-50 text-sky-700 border-sky-200',
  tone: 'bg-purple-50 text-purple-700 border-purple-200',
  reference: 'bg-amber-50 text-amber-700 border-amber-200',
};

function formatShortUrl(url?: string): { display: string; href?: string } {
  if (!url) return { display: '—' };
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '');
    const shortPath = path.length > 24 ? path.slice(0, 24) + '…' : path;
    return { display: `${u.hostname}${shortPath}`, href: url };
  } catch {
    // fallback para strings que não são URLs válidas
    const trimmed = url.length > 28 ? url.slice(0, 28) + '…' : url;
    return { display: trimmed, href: url };
  }
}

function compactNumber(n?: number) {
  if (typeof n !== 'number') return 'N/A';
  try { return n.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }); } catch { return n.toString(); }
}

const PostDetailModal: React.FC<PostDetailModalProps> = ({ isOpen, onClose, postId, publicMode = false, apiPrefix = '/api/admin' }) => {
  const [postData, setPostData] = useState<IPostDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPostData = async () => {
      if (!postId) return;

      setIsLoading(true);
      setError(null);
      setPostData(null);

      const apiUrl = publicMode
        ? `/api/v1/posts/${postId}/details`
        : `${apiPrefix}/dashboard/posts/${postId}/details`;

      try {
        if (publicMode && !isHexObjectId(postId)) {
          throw new Error('Exemplo demonstrativo: conecte seu Instagram para ver a análise completa.');
        }
        const response = await fetch(apiUrl);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: `Erro HTTP: ${response.status}` }));
          let errorMessage = errorData.message || errorData.error || `Erro HTTP: ${response.status}`;
          if (response.status === 404) errorMessage = 'Post não encontrado.';
          throw new Error(errorMessage);
        }
        const fetchedData: IPostDetailsData = await response.json();
        if (fetchedData.postDate) fetchedData.postDate = new Date(fetchedData.postDate);
        if (fetchedData.dailySnapshots) {
          fetchedData.dailySnapshots = fetchedData.dailySnapshots.map((s: any) => ({ ...s, date: new Date(s.date) }));
        }
        setPostData(fetchedData);
      } catch (e: any) {
        console.error(`Falha ao buscar detalhes do post ${postId}:`, e);
        setError(e.message || 'Falha ao carregar os detalhes do post.');
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen && postId) fetchPostData();
    else if (!isOpen) { setPostData(null); setIsLoading(false); setError(null); }
  }, [isOpen, postId, publicMode, apiPrefix]);

  // Fecha com ESC
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !postId) return null;

  // --- TAGS (chips) ---
  const ChipRow = ({ label, items, type }: { label: string; items?: string[]; type: 'format'|'proposal'|'context'|'tone'|'reference' }) => {
    const labels = idsToLabels(items, type);
    return (
      <div>
        <div className="text-xs font-semibold text-gray-600 mb-1">{label}</div>
        <div className="flex flex-wrap gap-1.5">
          {labels.length > 0 ? (
            labels.slice(0, 8).map((t, i) => (
              <TagPill key={`${type}-${i}`} color={COLOR_BY_TYPE[type]}>{t}</TagPill>
            ))
          ) : (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">—</span>
          )}
        </div>
      </div>
    );
  };

  // --- Blocks ---
  const renderGeneralInfo = () => {
    const shortPost = formatShortUrl(postData?.postLink);
    const shortCover = formatShortUrl(postData?.coverUrl);
    const dateStr = postData?.postDate ? new Date(postData.postDate).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

    return (
      <section>
        <h4 className="text-md font-semibold text-gray-700 mb-3 flex items-center"><InformationCircleIcon className="w-5 h-5 mr-2 text-indigo-500" />Informações Gerais</h4>
        {isLoading ? (
          <div className="space-y-2">
            <SkeletonBlock width="w-full" height="h-4" />
            <SkeletonBlock width="w-3/4" height="h-4" />
            <SkeletonBlock width="w-full" height="h-10" />
            <SkeletonBlock width="w-1/2" height="h-4" />
          </div>
        ) : postData && (
          <div className="text-sm text-gray-600 space-y-4">
            {/* Capa + Ações */}
            {postData.coverUrl && (
              <div className="flex items-start gap-3">
                <img src={postData.coverUrl} alt="Capa do post" className="w-24 h-24 object-cover rounded-md border" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={postData.coverUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                      <LinkIcon className="w-4 h-4" /> Abrir capa
                    </a>
                    <button
                      className="text-xs px-2 py-0.5 rounded border text-gray-700 hover:bg-gray-50"
                      onClick={() => navigator.clipboard.writeText(postData.coverUrl || '')}
                    >Copiar link</button>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 break-all">{shortCover.display}</div>
                </div>
              </div>
            )}

            {/* Link do post */}
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-700">Link:</span>
              {postData.postLink ? (
                <a href={postData.postLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                  <LinkIcon className="w-4 h-4" /> {shortPost.display}
                </a>
              ) : (
                <span>—</span>
              )}
              {postData.postLink && (
                <button
                  className="ml-1 text-xs px-2 py-0.5 rounded border text-gray-700 hover:bg-gray-50"
                  onClick={() => navigator.clipboard.writeText(postData.postLink || '')}
                >Copiar</button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1 text-gray-700"><CalendarDaysIcon className="w-4 h-4" /> {dateStr}</div>
              <div className="flex items-center gap-1 text-gray-700"><TagIcon className="w-4 h-4" /> {postData.type || '—'}</div>
            </div>

            {/* Tags das categorias */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <ChipRow label="Formato" items={postData.format} type="format" />
              <ChipRow label="Proposta" items={postData.proposal} type="proposal" />
              <ChipRow label="Contexto" items={postData.context} type="context" />
              <ChipRow label="Tom" items={Array.isArray(postData.tone) ? postData.tone : postData.tone ? [postData.tone as any] : []} type="tone" />
              <ChipRow label="Referências" items={postData.references} type="reference" />
              {postData.theme && (
                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-1">Tema</div>
                  <TagPill color="bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200">{postData.theme}</TagPill>
                </div>
              )}
            </div>

            {/* Descrição */}
            <div>
              <div className="font-medium text-gray-700 mb-1">Descrição</div>
              <p className="text-gray-700 whitespace-pre-line leading-relaxed">{postData.description || '—'}</p>
            </div>
          </div>
        )}
      </section>
    );
  };

  const MetricItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | number }) => (
    <div className="bg-gray-50 p-3 rounded-md">
      <div className="flex items-center text-gray-500 mb-1">
        <Icon className="w-4 h-4 mr-1.5" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-gray-800 font-semibold text-base">{value}</p>
    </div>
  );

  const renderMainMetrics = () => (
    <section>
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
        </div>
      )}
    </section>
  );

  const renderDailyPerformance = () => (
    <section>
      <h4 className="text-md font-semibold text-gray-700 mb-2 flex items-center"><ChartBarIcon className="w-5 h-5 mr-2 text-indigo-500" />Desempenho Diário</h4>
      {isLoading ? (
        <SkeletonBlock width="w-full" height="h-24" />
      ) : postData && postData.dailySnapshots && (
        <>
          {postData.dailySnapshots.length >= 2 ? (
            <div style={{ width: '100%', height: 300 }} className="my-3">
              <ResponsiveContainer>
                <LineChart data={postData.dailySnapshots} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(tickItem) => new Date(tickItem).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}
                    fontSize={12}
                    stroke="#666"
                  />
                  <YAxis fontSize={12} stroke="#666" allowDecimals={false} />
                  <Tooltip
                    labelFormatter={(label: Date) => new Date(label).toLocaleDateString('pt-BR')}
                    formatter={(value: number, name: string) => [value.toLocaleString('pt-BR'), name]}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '14px' }} />
                  <Line type="monotone" dataKey="dailyViews" name="Visualizações Diárias" stroke="#8884d8" strokeWidth={2} activeDot={{ r: 6 }} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="dailyLikes" name="Curtidas Diárias" stroke="#82ca9d" strokeWidth={2} activeDot={{ r: 6 }} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-6 px-4 bg-gray-50 rounded-md my-3">
              <p className="text-gray-500">Dados diários insuficientes para exibir o gráfico.</p>
            </div>
          )}
          {postData.dailySnapshots.length > 0 && (
            <div className="max-h-48 overflow-y-auto text-sm border border-gray-200 rounded-md mt-4">
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
                    <tr key={(snapshot.date as Date)?.toString() + index}>
                      <td className="px-3 py-2 whitespace-nowrap">{snapshot.date ? new Date(snapshot.date).toLocaleDateString('pt-BR') : 'N/A'}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{snapshot.dailyViews?.toLocaleString('pt-BR') ?? 'N/A'}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{snapshot.dailyLikes?.toLocaleString('pt-BR') ?? 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );

  return (
    <div
      className={`fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-detail-title"
    >
      <div
        className={`bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <header className="sticky top-0 bg-white/90 backdrop-blur border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 id="post-detail-title" className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <TagIcon className="w-5 h-5 text-indigo-600" /> Detalhes do Post
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors" aria-label="Fechar">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>

        {/* CONTENT */}
        <main className="flex-grow overflow-y-auto px-6 py-6 space-y-6">
          {error && (
            <div className="text-center py-10 text-red-600 bg-red-50 p-4 rounded-md">
              <ExclamationCircleIcon className="w-8 h-8 mx-auto mb-2" />
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

        {/* FOOTER */}
        <footer className="sticky bottom-0 bg-white/90 backdrop-blur border-t border-gray-200 px-6 py-4 text-right">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
};

export default PostDetailModal;
