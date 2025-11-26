"use client";
import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { getPortugueseWeekdayName } from '@/utils/weekdays';
import { idsToLabels } from '@/app/lib/classification';

interface TimeSlotTopPostsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayOfWeek: number;
  hour: number; // hora exata selecionada
  filters: { timePeriod: string; format?: string; proposal?: string; context?: string; metric: string; onlyActiveSubscribers?: boolean };
  userId?: string;
}

interface PostItem {
  _id: string;
  description?: string;
  postLink?: string;
  coverUrl?: string;
  metricValue: number;
  format?: string | string[];
  proposal?: string | string[];
  context?: string | string[];
  tone?: string | string[];
  references?: string | string[];
  creatorName?: string | null;
  creatorPhotoUrl?: string | null;
}

const TimeSlotTopPostsModal: React.FC<TimeSlotTopPostsModalProps> = ({ isOpen, onClose, dayOfWeek, hour, filters, userId }) => {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metricInfo = useMemo(() => {
    const key = filters.metric || 'stats.total_interactions';
    if (key.includes('engagement_rate')) return { label: 'Taxa de Engajamento', suffix: '%', asPercent: true };
    if (key.includes('reach')) return { label: 'Alcance', suffix: '', asPercent: false };
    if (key.includes('views') || key.includes('impressions')) return { label: 'Visualizações', suffix: '', asPercent: false };
    if (key.includes('likes')) return { label: 'Likes', suffix: '', asPercent: false };
    if (key.includes('comments')) return { label: 'Comentários', suffix: '', asPercent: false };
    if (key.includes('shares')) return { label: 'Compartilhamentos', suffix: '', asPercent: false };
    return { label: 'Interações', suffix: '', asPercent: false };
  }, [filters.metric]);

  const formatMetricValue = (v: number) => {
    if (metricInfo.asPercent) return `${(v * 100).toFixed(1)}%`;
    return v.toLocaleString('pt-BR');
  };

  const toArray = (v?: string | string[]) => (Array.isArray(v) ? v : (v ? [v] : []));
  const renderChips = (p: PostItem) => {
    const fmt = idsToLabels(toArray(p.format), 'format');
    const prop = idsToLabels(toArray(p.proposal), 'proposal');
    const ctx = idsToLabels(toArray(p.context), 'context');
    const tone = idsToLabels(toArray(p.tone), 'tone');
    const refs = idsToLabels(toArray(p.references), 'reference');
    const Chip = ({ label, color }: { label: string; color: 'indigo'|'green'|'gray'|'orange'|'blue' }) => (
      <span className={
        `inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border ` +
        (color === 'indigo' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
         color === 'green' ? 'bg-green-50 text-green-700 border-green-200' :
         color === 'gray' ? 'bg-gray-50 text-gray-700 border-gray-200' :
         color === 'orange' ? 'bg-orange-50 text-orange-700 border-orange-200' :
         'bg-blue-50 text-blue-700 border-blue-200')
      }>
        {label}
      </span>
    );
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {fmt.slice(0, 2).map((l, i) => <Chip key={`f-${i}`} label={l} color="indigo" />)}
        {prop.slice(0, 2).map((l, i) => <Chip key={`p-${i}`} label={l} color="green" />)}
        {ctx.slice(0, 2).map((l, i) => <Chip key={`c-${i}`} label={l} color="gray" />)}
        {tone.slice(0, 2).map((l, i) => <Chip key={`t-${i}`} label={l} color="orange" />)}
        {refs.slice(0, 2).map((l, i) => <Chip key={`r-${i}`} label={l} color="blue" />)}
      </div>
    );
  };

  useEffect(() => {
    if (!isOpen) return;
    const fetchPosts = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          dayOfWeek: String(dayOfWeek),
          hour: String(hour),
          timePeriod: filters.timePeriod,
          metric: filters.metric,
        });
        if (filters.format) params.append('format', filters.format);
        if (filters.proposal) params.append('proposal', filters.proposal);
        if (filters.context) params.append('context', filters.context);
        if (filters.onlyActiveSubscribers) params.append('onlyActiveSubscribers', 'true');
        const base = userId
          ? `/api/v1/users/${userId}/performance/time-distribution/posts`
          : '/api/v1/platform/performance/time-distribution/posts';
        const res = await fetch(`${base}?${params.toString()}`);
        if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
        const json = await res.json();
        setPosts(json.posts || []);
      } catch (e: any) {
        setError(e.message || 'Erro ao carregar posts');
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, [isOpen, dayOfWeek, hour, filters, userId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative mx-auto max-w-3xl p-4 sm:p-6">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b">
            <div>
              <h4 className="text-base sm:text-lg font-semibold text-gray-900">
                Top Posts • {getPortugueseWeekdayName(dayOfWeek)} {String(hour).padStart(2,'0')}:00
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">Métrica: {metricInfo.label}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-500" aria-label="Fechar">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 11-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <div className="px-4 sm:px-6 py-4 max-h-[70vh] overflow-y-auto">
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-gray-200 p-3">
                    <div className="h-36 bg-gray-100 rounded-md animate-pulse" />
                    <div className="h-3 w-2/3 bg-gray-100 rounded mt-3 animate-pulse" />
                    <div className="h-3 w-24 bg-gray-100 rounded mt-2 animate-pulse" />
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-sm text-red-600">Erro: {error}</p>}
            {!loading && !error && posts.length === 0 && (
              <p className="text-sm text-gray-600">Nenhum post encontrado para esse horário com os filtros atuais.</p>
            )}

            {!loading && !error && posts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {posts.map((p) => (
                  <div key={p._id} className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="relative">
                      {p.coverUrl ? (
                        <Image
                          src={`/api/proxy/thumbnail/${encodeURIComponent(p.coverUrl)}`}
                          alt="capa do conteúdo"
                          width={300}
                          height={160}
                          className="w-full h-40 object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-40 bg-gray-100 grid place-items-center text-gray-400 text-xs">Sem imagem</div>
                      )}
                      <span className="absolute top-2 left-2 px-2 py-1 rounded-md text-[10px] font-semibold bg-white/90 border border-gray-200 text-gray-700">
                        {metricInfo.label}: {formatMetricValue(p.metricValue)}
                      </span>
                    </div>
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        {p.creatorPhotoUrl ? (
                          <Image
                            width={24}
                            height={24}
                            src={`/api/proxy/thumbnail/${encodeURIComponent(p.creatorPhotoUrl)}`}
                            alt={p.creatorName || 'Criador'}
                            className="w-6 h-6 rounded-full object-cover border border-gray-200"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-200 grid place-items-center text-[10px] text-gray-500">
                            {(p.creatorName?.[0] || '?').toUpperCase()}
                          </div>
                        )}
                        <span className="text-[11px] text-gray-700 font-medium truncate" title={p.creatorName || undefined}>
                          {p.creatorName || 'Criador' }
                        </span>
                      </div>
                      <a
                        href={p.postLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs font-semibold text-indigo-700 hover:text-indigo-800 hover:underline line-clamp-2"
                        title={p.description || p.postLink || 'Abrir post'}
                      >
                        {p.description || p.postLink || 'Abrir post'}
                      </a>
                      {renderChips(p)}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-[11px] text-gray-500">{getPortugueseWeekdayName(dayOfWeek)} {String(hour).padStart(2,'0')}:00</div>
                        <a
                          href={p.postLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-700 hover:text-indigo-800"
                        >
                          Ver no Instagram
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5H21m0 0v7.5M21 4.5 12 13.5" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeSlotTopPostsModal;
