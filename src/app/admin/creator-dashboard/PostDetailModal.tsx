'use client';

import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChartBarIcon,
  XMarkIcon,
  InformationCircleIcon,
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

function copyText(value?: string | null) {
  if (!value || typeof navigator === 'undefined') return;
  void navigator.clipboard?.writeText(value);
}

const PostDetailModal: React.FC<PostDetailModalProps> = ({ isOpen, onClose, postId, publicMode = false, apiPrefix = '/api/admin' }) => {
  const [postData, setPostData] = useState<IPostDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const surfaceClassName = publicMode
    ? 'rounded-[1.5rem] border border-zinc-200/80 bg-white shadow-[0_20px_52px_rgba(24,24,27,0.18)]'
    : 'rounded-xl bg-white shadow-2xl';
  const sectionShellClassName = publicMode
    ? 'rounded-[1.2rem] border border-zinc-100 bg-zinc-50/64 p-4'
    : '';
  const sectionTitleClassName = publicMode
    ? 'text-sm font-semibold text-zinc-900 mb-3 flex items-center'
    : 'text-md font-semibold text-gray-700 mb-3 flex items-center';
  const metricItemClassName = publicMode
    ? 'rounded-[1rem] border border-zinc-100 bg-white p-3'
    : 'bg-gray-50 p-3 rounded-md';
  const isPublicMinimalTable = publicMode;

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
        <div className={`text-xs font-semibold mb-1 ${publicMode ? 'text-zinc-500' : 'text-gray-600'}`}>{label}</div>
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

    if (publicMode) {
      const headline = postData?.description?.trim() || 'Conteúdo usado como referência';
      const primaryStats = [
        {
          label: 'Interações',
          value: compactNumber(postData?.stats?.total_interactions),
        },
        {
          label: 'Views',
          value: compactNumber(postData?.stats?.views),
        },
        {
          label: 'Alcance',
          value: compactNumber(postData?.stats?.reach),
        },
      ];
      const strategicGroups = postData
        ? [
            { label: 'Formato', labels: idsToLabels(postData.format, 'format'), color: COLOR_BY_TYPE.format },
            { label: 'Proposta', labels: idsToLabels(postData.proposal, 'proposal'), color: COLOR_BY_TYPE.proposal },
            { label: 'Contexto', labels: idsToLabels(postData.context, 'context'), color: COLOR_BY_TYPE.context },
            {
              label: 'Tom',
              labels: idsToLabels(Array.isArray(postData.tone) ? postData.tone : postData.tone ? [postData.tone as any] : [], 'tone'),
              color: COLOR_BY_TYPE.tone,
            },
            { label: 'Referências', labels: idsToLabels(postData.references, 'reference'), color: COLOR_BY_TYPE.reference },
            { label: 'Tema', labels: postData.theme ? [postData.theme] : [], color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
          ].filter((group) => group.labels.length > 0)
        : [];
      const strategicSignals = strategicGroups
        .flatMap((group) => group.labels.slice(0, 2).map((label) => ({ group: group.label, value: label })))
        .slice(0, 6);

      return (
        <section>
          {isLoading ? (
            <div className="space-y-3 p-3">
              <SkeletonBlock width="w-full" height="h-52" />
              <SkeletonBlock width="w-3/4" height="h-4" />
              <SkeletonBlock width="w-full" height="h-12" />
            </div>
          ) : postData && (
            <>
              <div className="grid grid-cols-[6.85rem_minmax(0,1fr)] gap-3.5 px-4 pb-3 pt-4">
                <div className="relative aspect-[9/16] overflow-hidden rounded-[1rem] bg-zinc-100">
                  {postData.coverUrl ? (
                    <Image
                      src={postData.coverUrl}
                      alt="Capa do post"
                      fill
                      sizes="128px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs font-semibold text-zinc-400">
                      Sem capa
                    </div>
                  )}
                </div>

                <div className="min-w-0 pr-9">
                  <h4 className="line-clamp-4 text-[1rem] font-semibold leading-5 tracking-[-0.02em] text-zinc-950">
                    {headline}
                  </h4>

                  <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] text-zinc-500">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDaysIcon className="h-3.5 w-3.5" />
                      {dateStr}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <TagIcon className="h-3.5 w-3.5" />
                      {postData.type || '—'}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {postData.postLink ? (
                      <a
                        href={postData.postLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-zinc-950 px-3 text-xs font-semibold text-white transition hover:bg-zinc-800"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                        Abrir post
                      </a>
                    ) : null}
                    {postData.postLink ? (
                      <button
                        type="button"
                        onClick={() => copyText(postData.postLink)}
                        className="inline-flex h-8 items-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50"
                      >
                        Copiar
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 border-y border-zinc-100">
                {primaryStats.map((stat, index) => (
                  <div key={stat.label} className="px-3 py-2.5 text-center">
                    <p className={index === 0 ? "text-[1.18rem] font-semibold leading-none tracking-[-0.045em] text-zinc-950" : "text-[1rem] font-semibold leading-none tracking-[-0.035em] text-zinc-950"}>
                      {stat.value}
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-zinc-400">{stat.label}</p>
                  </div>
                ))}
              </div>

              {renderPublicTrend()}

              {strategicSignals.length > 0 ? (
                <div className="border-b border-zinc-100 px-4 py-3.5">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                    Sinais usados
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {strategicSignals.map((signal) => (
                      <div key={`${signal.group}-${signal.value}`} className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-400">
                          {signal.group}
                        </p>
                        <p className="mt-0.5 truncate text-xs font-medium text-zinc-700">
                          {signal.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      );
    }

    return (
      <section className={sectionShellClassName}>
        <h4 className={sectionTitleClassName}><InformationCircleIcon className={`w-5 h-5 mr-2 ${publicMode ? 'text-zinc-500' : 'text-indigo-500'}`} />Informações Gerais</h4>
        {isLoading ? (
          <div className="space-y-2">
            <SkeletonBlock width="w-full" height="h-4" />
            <SkeletonBlock width="w-3/4" height="h-4" />
            <SkeletonBlock width="w-full" height="h-10" />
            <SkeletonBlock width="w-1/2" height="h-4" />
          </div>
        ) : postData && (
          <div className={`text-sm space-y-4 ${publicMode ? 'text-zinc-600' : 'text-gray-600'}`}>
            {/* Capa + Ações */}
            {postData.coverUrl && (
              <div className="flex items-start gap-3"> 
                <Image 
                  src={postData.coverUrl} 
                  alt="Capa do post" 
                  width={96} height={96} 
                  className={`w-24 h-24 object-cover ${publicMode ? 'rounded-[1rem] border border-zinc-100/90' : 'rounded-md border'}`} 
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={postData.coverUrl} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 ${publicMode ? 'text-zinc-700 hover:text-zinc-900' : 'text-indigo-600 hover:underline'}`}>
                      <LinkIcon className="w-4 h-4" /> Abrir capa
                    </a>
                    <button
                      className={`text-xs px-2 py-0.5 rounded ${publicMode ? 'border border-zinc-100/90 bg-white/80 text-zinc-600 hover:bg-zinc-50' : 'border text-gray-700 hover:bg-gray-50'}`}
                      onClick={() => copyText(postData.coverUrl)}
                    >Copiar link</button>
                  </div>
                  <div className={`text-xs mt-1 break-all ${publicMode ? 'text-zinc-400' : 'text-gray-500'}`}>{shortCover.display}</div>
                </div>
              </div>
            )}

            {/* Link do post */}
            <div className="flex items-center gap-2">
              <span className={`font-medium ${publicMode ? 'text-zinc-700' : 'text-gray-700'}`}>Link:</span>
              {postData.postLink ? (
                <a href={postData.postLink} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 ${publicMode ? 'text-zinc-700 hover:text-zinc-900' : 'text-indigo-600 hover:underline'}`}>
                  <LinkIcon className="w-4 h-4" /> {shortPost.display}
                </a>
              ) : (
                <span>—</span>
              )}
              {postData.postLink && (
                <button
                  className={`ml-1 text-xs px-2 py-0.5 rounded ${publicMode ? 'border border-zinc-100/90 bg-white/80 text-zinc-600 hover:bg-zinc-50' : 'border text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => copyText(postData.postLink)}
                >Copiar</button>
              )}
            </div>

            <div className={`flex flex-wrap items-center gap-4 ${publicMode ? 'text-zinc-600' : 'text-gray-700'}`}>
              <div className="flex items-center gap-1"><CalendarDaysIcon className="w-4 h-4" /> {dateStr}</div>
              <div className="flex items-center gap-1"><TagIcon className="w-4 h-4" /> {postData.type || '—'}</div>
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
              <div className={`text-xs font-semibold mb-1 ${publicMode ? 'text-zinc-500' : 'text-gray-600'}`}>Tema</div>
                  <TagPill color="bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200">{postData.theme}</TagPill>
                </div>
              )}
            </div>

            {/* Descrição */}
            <div>
              <div className={`font-medium mb-1 ${publicMode ? 'text-zinc-700' : 'text-gray-700'}`}>Descrição</div>
              <p className={`${publicMode ? 'text-zinc-700' : 'text-gray-700'} whitespace-pre-line leading-relaxed`}>{postData.description || '—'}</p>
            </div>
          </div>
        )}
      </section>
    );
  };

  const MetricItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | number }) => (
    <div className={metricItemClassName}>
      <div className={`flex items-center mb-1 ${publicMode ? 'text-zinc-500' : 'text-gray-500'}`}>
        <Icon className="w-4 h-4 mr-1.5" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`${publicMode ? 'text-zinc-900' : 'text-gray-800'} font-semibold text-base`}>{value}</p>
    </div>
  );

  const renderMainMetrics = () => (
    <section className={sectionShellClassName}>
      <h4 className={sectionTitleClassName}><ArrowTrendingUpIcon className={`w-5 h-5 mr-2 ${publicMode ? 'text-zinc-500' : 'text-indigo-500'}`} />{publicMode ? 'Performance' : 'Métricas Principais'}</h4>
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonBlock key={i} width="w-full" height="h-12" />)}
        </div>
      ) : postData && postData.stats && (
        <div className={`${publicMode ? 'grid grid-cols-2 gap-2.5 text-sm' : 'grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm'}`}>
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
    <section className={sectionShellClassName}>
      <h4 className={sectionTitleClassName}><ChartBarIcon className={`w-5 h-5 mr-2 ${publicMode ? 'text-zinc-500' : 'text-indigo-500'}`} />Desempenho Diário</h4>
      {isLoading ? (
        <SkeletonBlock width="w-full" height="h-24" />
      ) : postData && postData.dailySnapshots && (
        <>
          {postData.dailySnapshots.length >= 2 ? (
            <div style={{ width: '100%', height: publicMode ? 240 : 300 }} className="my-3">
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
                  <Line type="monotone" dataKey="dailyViews" name="Visualizações Diárias" stroke={publicMode ? "#18181B" : "#8884d8"} strokeWidth={2} activeDot={{ r: 6 }} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="dailyLikes" name="Curtidas Diárias" stroke={publicMode ? "#14B8A6" : "#82ca9d"} strokeWidth={2} activeDot={{ r: 6 }} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className={`text-center py-6 px-4 my-3 ${publicMode ? 'bg-zinc-50/80 rounded-[1rem]' : 'bg-gray-50 rounded-md'}`}>
              <p className={publicMode ? 'text-zinc-500' : 'text-gray-500'}>Dados diários insuficientes para exibir o gráfico.</p>
            </div>
          )}
          {postData.dailySnapshots.length > 0 && !isPublicMinimalTable && (
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

  const renderPublicTrend = () => {
    if (!postData?.dailySnapshots || postData.dailySnapshots.length < 2) return null;

    return (
      <div className="border-b border-zinc-100 px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
            Evolução diária
          </p>
          <div className="flex items-center gap-3 text-[10px] font-medium text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-950" />
              Views
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              Curtidas
            </span>
          </div>
        </div>
        <div className="mt-2 h-[6.75rem]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={postData.dailySnapshots} margin={{ top: 8, right: 4, left: 4, bottom: 2 }}>
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip
                cursor={{ stroke: '#e4e4e7', strokeWidth: 1 }}
                labelFormatter={(label: Date | string) => new Date(label).toLocaleDateString('pt-BR')}
                formatter={(value: number, name: string) => [value.toLocaleString('pt-BR'), name]}
                contentStyle={{
                  backgroundColor: 'rgba(255,255,255,0.96)',
                  border: '1px solid #e4e4e7',
                  borderRadius: '12px',
                  boxShadow: '0 10px 30px rgba(24,24,27,0.12)',
                  fontSize: '12px',
                }}
              />
              <Line type="monotone" dataKey="dailyViews" name="Views" stroke="#18181B" strokeWidth={2.25} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="dailyLikes" name="Curtidas" stroke="#14B8A6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const modalContent = (
    <div
      className={`fixed inset-0 z-[2147483647] flex items-center justify-center overflow-hidden transition-opacity duration-300 ${publicMode ? 'bg-black/45 p-4 pb-7 backdrop-blur-[2px] sm:p-6' : 'bg-black/50 p-3 backdrop-blur-sm sm:p-5'} ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={publicMode ? 'Referência usada na pauta' : undefined}
      aria-labelledby={publicMode ? undefined : 'post-detail-title'}
    >
      <div
        className={`${surfaceClassName} relative w-full ${publicMode ? 'max-w-[24.5rem] max-h-[72dvh] sm:max-h-[76dvh]' : 'max-w-2xl max-h-[90vh]'} flex flex-col overflow-hidden transform transition-all duration-300 ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {publicMode ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 z-30 flex h-8 w-8 items-center justify-center rounded-full border border-white/65 bg-white/92 text-zinc-500 shadow-[0_10px_24px_rgba(15,23,42,0.18)] backdrop-blur transition hover:bg-white hover:text-zinc-950"
            aria-label="Fechar"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        ) : (
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/90 px-6 py-3.5 backdrop-blur">
            <div className="min-w-0">
              <h3 id="post-detail-title" className="truncate text-base font-semibold text-gray-800">
                Detalhes do Post
              </h3>
            </div>
            <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700" aria-label="Fechar">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </header>
        )}

        {/* CONTENT */}
        <main className={`min-h-0 flex-grow overflow-y-auto overscroll-contain ${publicMode ? 'pb-7 sm:pb-8' : 'px-6 py-6 space-y-6'}`}>
          {error && (
            <div className={`text-center py-10 text-red-600 bg-red-50 p-4 ${publicMode ? 'rounded-[1rem]' : 'rounded-md'}`}>
              <ExclamationCircleIcon className="w-8 h-8 mx-auto mb-2" />
              <p>{error}</p>
            </div>
          )}
          {!error && (
            publicMode ? (
              renderGeneralInfo()
            ) : (
              <>
                {renderGeneralInfo()}
                {renderMainMetrics()}
                {renderDailyPerformance()}
              </>
            )
          )}
        </main>

        {/* FOOTER */}
        <footer className={`sticky bottom-0 backdrop-blur text-right ${publicMode ? 'hidden' : 'bg-white/90 border-t border-gray-200 px-6 py-4'}`}>
          <button onClick={onClose} className={`px-4 py-2 text-sm font-medium transition-colors ${publicMode ? 'text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-full' : 'text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md'}`}>
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default PostDetailModal;
