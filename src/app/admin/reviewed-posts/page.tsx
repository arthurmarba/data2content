'use client';

import Image from 'next/image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowTopRightOnSquareIcon,
  BookmarkIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  DocumentMagnifyingGlassIcon,
  HeartIcon,
  PencilSquareIcon,
  PlayCircleIcon,
  ShareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import PostDetailModal from '@/app/admin/creator-dashboard/PostDetailModal';
import DiscoverVideoModal from '@/app/discover/components/DiscoverVideoModal';
import { UserAvatar } from '@/app/components/UserAvatar';
import { Category, contextCategories, idsToLabels } from '@/app/lib/classification';

type ReviewStatus = 'do' | 'dont' | 'almost';

const STATUS_LABELS: Record<ReviewStatus, string> = {
  do: 'Fazer',
  dont: 'Não fazer',
  almost: 'Quase lá',
};

const STATUS_STYLES: Record<ReviewStatus, string> = {
  do: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  dont: 'bg-rose-50 text-rose-700 border-rose-200',
  almost: 'bg-amber-50 text-amber-800 border-amber-200',
};

const STATUS_PANEL_STYLES: Record<ReviewStatus, string> = {
  do: 'border-slate-200 bg-white border-t-4 border-t-emerald-300',
  dont: 'border-slate-200 bg-white border-t-4 border-t-rose-300',
  almost: 'border-slate-200 bg-white border-t-4 border-t-amber-300',
};

const STATUS_NOTE_STYLES: Record<ReviewStatus, string> = {
  do: 'border-slate-200 bg-slate-50 text-slate-700 border-l-4 border-l-emerald-300',
  dont: 'border-slate-200 bg-slate-50 text-slate-700 border-l-4 border-l-rose-300',
  almost: 'border-slate-200 bg-slate-50 text-slate-700 border-l-4 border-l-amber-300',
};

interface ReviewPost {
  _id: string;
  creatorId?: string;
  creatorContextId?: string;
  text_content?: string;
  description?: string;
  creatorName?: string;
  creatorAvatarUrl?: string;
  postDate?: string | Date;
  coverUrl?: string;
  thumbnailUrl?: string;
  thumbnail_url?: string;
  mediaUrl?: string;
  media_url?: string;
  postLink?: string;
  instagramMediaId?: string;
  type?: string;
  format?: string[] | string;
  proposal?: string[] | string;
  context?: string[] | string;
  tone?: string[] | string;
  references?: string[] | string;
  stats?: {
    total_interactions?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saved?: number;
    reach?: number;
    views?: number;
  };
}

interface ReviewItem {
  _id: string;
  postId: string;
  status: ReviewStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
  post?: ReviewPost;
}

interface CreatorGroup {
  id: string;
  name: string;
  avatarUrl?: string;
  itemsByStatus: Record<ReviewStatus, ReviewItem[]>;
}

interface ContextGroup {
  id: string;
  label: string;
  creators: CreatorGroup[];
}

const formatDate = (date?: string | Date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('pt-BR');
};

const formatNumber = (value?: number) => {
  if (typeof value !== 'number') return 'N/A';
  return value.toLocaleString('pt-BR');
};

const normalizeCategoryValues = (values?: string[] | string) => {
  if (!values) return [];
  if (Array.isArray(values)) return values.map((value) => value.trim()).filter(Boolean);
  return values.split(',').map((value) => value.trim()).filter(Boolean);
};

const buildContextOptions = (categories: Category[]) => {
  const options: { id: string; label: string }[] = [];
  const traverse = (cats: Category[], prefix = '') => {
    cats.forEach((cat) => {
      const label = prefix ? `${prefix} > ${cat.label}` : cat.label;
      options.push({ id: cat.id, label });
      if (cat.subcategories?.length) {
        traverse(cat.subcategories, label);
      }
    });
  };
  traverse(categories);
  return options;
};

const buildContextLabelToIdMap = (categories: Category[]) => {
  const map = new Map<string, string>();
  const traverse = (cats: Category[], prefix = '') => {
    cats.forEach((cat) => {
      const label = prefix ? `${prefix} > ${cat.label}` : cat.label;
      map.set(label, cat.id);
      if (cat.subcategories?.length) {
        traverse(cat.subcategories, label);
      }
    });
  };
  traverse(categories);
  return map;
};

const buildContextLabelMap = (categories: Category[]) => {
  const map = new Map<string, string>();
  const traverse = (cats: Category[], prefix = '') => {
    cats.forEach((cat) => {
      const label = prefix ? `${prefix} > ${cat.label}` : cat.label;
      map.set(cat.id, label);
      if (cat.subcategories?.length) {
        traverse(cat.subcategories, label);
      }
    });
  };
  traverse(categories);
  return map;
};

const toThumbnailProxyUrl = (raw?: string | null) => {
  if (!raw) return '';
  if (raw.startsWith('/api/proxy/thumbnail/')) return raw;
  if (/^https?:\/\//i.test(raw)) return `/api/proxy/thumbnail/${encodeURIComponent(raw)}`;
  return raw;
};

const toVideoProxyUrl = (raw?: string | null) => {
  if (!raw) return undefined;
  if (raw.startsWith('/api/proxy/video/')) return raw;
  if (/^https?:\/\//i.test(raw)) return `/api/proxy/video/${encodeURIComponent(raw)}`;
  return raw;
};

const statusOrder: ReviewStatus[] = ['dont', 'do', 'almost'];
const cardBase = 'rounded-2xl border border-slate-200 bg-white shadow-sm';

export default function ReviewedPostsPage() {
  const searchParams = useSearchParams();
  const contextOptions = useMemo(() => buildContextOptions(contextCategories), []);
  const contextLabelMap = useMemo(() => buildContextLabelMap(contextCategories), []);
  const contextIdByLabel = useMemo(() => buildContextLabelToIdMap(contextCategories), []);

  const [statusFilter, setStatusFilter] = useState<ReviewStatus | ''>('');
  const [creatorContextFilter, setCreatorContextFilter] = useState('');
  const [creatorSearch, setCreatorSearch] = useState('');
  const [presentationMode, setPresentationMode] = useState(false);
  const [notesOnly, setNotesOnly] = useState(false);
  const [hideMetrics, setHideMetrics] = useState(false);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<ReviewItem | null>(null);
  const [editStatus, setEditStatus] = useState<ReviewStatus>('do');
  const [editNote, setEditNote] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [copiedContextId, setCopiedContextId] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState<{
    videoUrl?: string;
    postLink?: string;
    posterUrl?: string;
  } | null>(null);

  useEffect(() => {
    const status = searchParams.get('status') as ReviewStatus | null;
    const creatorContext = searchParams.get('creatorContext');
    if (status && STATUS_LABELS[status]) setStatusFilter(status);
    if (creatorContext) setCreatorContextFilter(creatorContext);
  }, [searchParams]);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });
      if (statusFilter) params.append('status', statusFilter);
      if (creatorContextFilter) params.append('creatorContext', creatorContextFilter);

      const res = await fetch(`/api/admin/dashboard/post-reviews?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao carregar revisados.');
      }
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar revisados.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, creatorContextFilter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const openDetail = (postId?: string) => {
    if (!postId) return;
    setSelectedPostId(postId);
    setIsDetailOpen(true);
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    setSelectedPostId(null);
  };

  const openEdit = (item: ReviewItem) => {
    setEditItem(item);
    setEditStatus(item.status);
    setEditNote(item.note || '');
    setEditError(null);
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    setIsEditOpen(false);
    setEditItem(null);
    setEditStatus('do');
    setEditNote('');
    setEditError(null);
  };

  const handleEditSave = async () => {
    if (!editItem?.postId) return;
    const trimmed = editNote.trim();
    if (!trimmed) {
      setEditError('A anotação é obrigatória.');
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch('/api/admin/dashboard/post-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: editItem.postId,
          status: editStatus,
          note: trimmed,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao salvar revisão.');
      }
      closeEdit();
      void fetchReviews();
    } catch (err: any) {
      setEditError(err.message || 'Falha ao salvar revisão.');
    } finally {
      setSavingEdit(false);
    }
  };

  const grouped = useMemo<ContextGroup[]>(() => {
    const filteredItems = statusFilter ? items.filter((item) => item.status === statusFilter) : items;
    const contextMap = new Map<string, { id: string; label: string; creators: Map<string, CreatorGroup> }>();
    const creatorContextScores = new Map<string, Map<string, number>>();

    const resolveContextId = (value: string) => {
      if (contextLabelMap.has(value)) return value;
      return contextIdByLabel.get(value) || value;
    };

    filteredItems.forEach((item) => {
      const post = item.post;
      const creatorId = post?.creatorId || post?.creatorName || 'sem-criador';
      if (post?.creatorContextId) return;
      const values = normalizeCategoryValues(post?.context);
      if (!values.length) return;
      const weight = typeof post?.stats?.total_interactions === 'number' ? post.stats.total_interactions : 1;
      const scoreMap = creatorContextScores.get(creatorId) || new Map<string, number>();
      values.forEach((value) => {
        const contextId = resolveContextId(value);
        if (!contextId) return;
        scoreMap.set(contextId, (scoreMap.get(contextId) || 0) + weight);
      });
      creatorContextScores.set(creatorId, scoreMap);
    });

    const derivedCreatorContext = new Map<string, string>();
    creatorContextScores.forEach((scoreMap, creatorId) => {
      let topId = '';
      let topScore = -1;
      scoreMap.forEach((score, contextId) => {
        if (score > topScore) {
          topScore = score;
          topId = contextId;
        }
      });
      if (topId) derivedCreatorContext.set(creatorId, topId);
    });

    filteredItems.forEach((item) => {
      const post = item.post;
      const creatorId = post?.creatorId || post?.creatorName || 'sem-criador';
      const fallbackContextId = derivedCreatorContext.get(creatorId);
      const contextId = post?.creatorContextId || fallbackContextId || 'sem-contexto';
      const label = contextLabelMap.get(contextId)
        || idsToLabels([contextId], 'context')[0]
        || contextId
        || 'Sem categoria dominante';
      const creatorName = post?.creatorName || 'Criador';

      if (!contextMap.has(contextId)) {
        contextMap.set(contextId, { id: contextId, label, creators: new Map() });
      }
      const contextGroup = contextMap.get(contextId)!;

      if (!contextGroup.creators.has(creatorId)) {
        contextGroup.creators.set(creatorId, {
          id: creatorId,
          name: creatorName,
          avatarUrl: post?.creatorAvatarUrl,
          itemsByStatus: { do: [], dont: [], almost: [] },
        });
      }

      const creatorGroup = contextGroup.creators.get(creatorId)!;
      creatorGroup.itemsByStatus[item.status].push(item);
    });

    const sortByUpdatedAtDesc = (a: ReviewItem, b: ReviewItem) => (
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    const normalizedSearch = creatorSearch.trim().toLowerCase();
    return Array.from(contextMap.values())
      .map((context) => {
        const creators = Array.from(context.creators.values())
          .filter((creator) => {
            if (!normalizedSearch) return true;
            return creator.name.toLowerCase().includes(normalizedSearch);
          })
          .map((creator) => ({
            ...creator,
            itemsByStatus: {
              do: creator.itemsByStatus.do.sort(sortByUpdatedAtDesc),
              dont: creator.itemsByStatus.dont.sort(sortByUpdatedAtDesc),
              almost: creator.itemsByStatus.almost.sort(sortByUpdatedAtDesc),
            },
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        return { id: context.id, label: context.label, creators };
      })
      .filter((context) => context.creators.length > 0)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [items, statusFilter, contextLabelMap, contextIdByLabel, creatorSearch]);

  const getContextAnchorId = useCallback((contextId: string) => {
    const safe = contextId.replace(/[^a-zA-Z0-9_-]/g, '-');
    return `context-${safe || 'sem-contexto'}`;
  }, []);

  const buildSummaryText = useCallback((contextGroup: ContextGroup) => {
    const lines: string[] = [`Categoria: ${contextGroup.label}`];
    contextGroup.creators.forEach((creator) => {
      lines.push(`\n${creator.name}`);
      statusOrder.forEach((status) => {
        const itemsByStatus = creator.itemsByStatus[status];
        lines.push(`${STATUS_LABELS[status]} (${itemsByStatus.length}):`);
        itemsByStatus.forEach((item) => {
          const post = item.post;
          const raw = post?.text_content || post?.description || 'Sem legenda';
          const snippet = raw.replace(/\s+/g, ' ').trim().slice(0, 120);
          lines.push(`- ${snippet}${raw.length > 120 ? '…' : ''} | Nota: ${item.note || '-'}`);
        });
      });
    });
    return lines.join('\n');
  }, []);

  const handleCopySummary = useCallback(async (contextGroup: ContextGroup) => {
    const summary = buildSummaryText(contextGroup);
    try {
      if (!navigator?.clipboard) return;
      await navigator.clipboard.writeText(summary);
      setCopiedContextId(contextGroup.id);
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedContextId(null);
      }, 1800);
    } catch {
      /* no-op */
    }
  }, [buildSummaryText]);

  const openVideo = useCallback((payload: { videoUrl?: string; postLink?: string; posterUrl?: string }) => {
    if (!payload.videoUrl && !payload.postLink) return;
    setActiveVideo(payload);
    setIsVideoOpen(true);
  }, []);

  const closeVideo = useCallback(() => {
    setIsVideoOpen(false);
    setActiveVideo(null);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-full mx-auto space-y-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Reuniao e alinhamento</p>
            <h1 className={`font-bold text-slate-900 ${presentationMode ? 'text-3xl' : 'text-2xl'}`}>Conteudos revisados</h1>
            <p className="text-sm text-slate-600">Organize por categoria dominante do criador e apresente as notas com clareza.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPresentationMode((value) => !value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${presentationMode ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
            >
              {presentationMode ? 'Modo reuniao ativo' : 'Modo reuniao'}
            </button>
            <button
              onClick={() => setNotesOnly((value) => !value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${notesOnly ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
            >
              {notesOnly ? 'Somente notas' : 'Mostrar detalhes'}
            </button>
            <button
              onClick={() => setHideMetrics((value) => !value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${hideMetrics ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
            >
              {hideMetrics ? 'Ocultar metricas' : 'Mostrar metricas'}
            </button>
          </div>
        </header>

        {!presentationMode && (
          <div className={`${cardBase} p-4 space-y-3`}>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Filtros</p>
              <h2 className="text-sm font-semibold text-slate-900">Refine o recorte da reuniao</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="statusFilter" className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                <select
                  id="statusFilter"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as ReviewStatus | '');
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
                >
                  <option value="">Todos</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="creatorContextFilter" className="block text-xs font-semibold text-slate-600 mb-1">Categoria dominante (criador)</label>
                <select
                  id="creatorContextFilter"
                  value={creatorContextFilter}
                  onChange={(e) => {
                    setCreatorContextFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
                >
                  <option value="">Todas</option>
                  {contextOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="creatorSearch" className="block text-xs font-semibold text-slate-600 mb-1">Buscar criador</label>
                <input
                  id="creatorSearch"
                  type="text"
                  value={creatorSearch}
                  onChange={(e) => {
                    setCreatorSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Digite o nome..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {grouped.length > 0 && (
          <div className={`${cardBase} p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Agenda</p>
                <h2 className="text-sm font-semibold text-slate-900">Pular por categoria</h2>
              </div>
              <span className="text-xs text-slate-500">Clique para pular</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {grouped.map((contextGroup) => {
                return (
                  <a
                    key={contextGroup.id}
                    href={`#${getContextAnchorId(contextGroup.id)}`}
                    className="px-3 py-1.5 text-xs font-semibold rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  >
                    {contextGroup.label}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center text-sm text-slate-500 py-10">Carregando revisados...</div>
        ) : error ? (
          <div className="text-center text-sm text-rose-600 py-10">{error}</div>
        ) : grouped.length === 0 ? (
          <div className="text-center text-sm text-slate-500 py-10">Nenhum conteudo revisado encontrado.</div>
        ) : (
          grouped.map((contextGroup) => {
            const totalContextItems = contextGroup.creators.reduce(
              (acc, creator) => acc + statusOrder.reduce((sum, status) => sum + creator.itemsByStatus[status].length, 0),
              0
            );
            return (
              <section
                id={getContextAnchorId(contextGroup.id)}
                key={contextGroup.id}
                className="space-y-4 scroll-mt-24 pb-8 border-b border-slate-200/60 last:border-b-0 last:pb-0"
              >
                <div className={`${cardBase} p-4`}>
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="min-w-[200px]">
                      <h3 className="text-lg font-semibold text-slate-900">{contextGroup.label}</h3>
                      <p className="text-xs text-slate-500">
                        {contextGroup.creators.length} criadores · {totalContextItems} conteudos
                      </p>
                    </div>
                    <button
                      onClick={() => handleCopySummary(contextGroup)}
                      className="ml-auto px-3 py-1.5 text-xs font-semibold rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    >
                      {copiedContextId === contextGroup.id ? 'Copiado!' : 'Copiar resumo'}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto pb-4">
                  <div className="flex gap-6 min-w-max">
                    {contextGroup.creators.map((creator) => {
                      const totalItems = statusOrder.reduce((acc, status) => acc + creator.itemsByStatus[status].length, 0);
                      return (
                        <div key={creator.id} className="w-[720px] shrink-0">
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                name={creator.name}
                                src={creator.avatarUrl ? toThumbnailProxyUrl(creator.avatarUrl) : undefined}
                                size={48}
                                className="border border-slate-200"
                              />
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{creator.name}</p>
                                <p className="text-xs text-slate-500">{totalItems} conteudos</p>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            {statusOrder.map((status) => (
                              <div key={status} className={`rounded-xl border ${STATUS_PANEL_STYLES[status]} bg-white`}>
                                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${STATUS_STYLES[status]}`}>
                                    {STATUS_LABELS[status]}
                                  </span>
                                  <span className="text-xs text-slate-500">{creator.itemsByStatus[status].length}</span>
                                </div>
                                <div className="p-3 space-y-3">
                                  {creator.itemsByStatus[status].length === 0 ? (
                                    <p className="text-[11px] text-slate-400">Sem itens.</p>
                                  ) : (
                                    creator.itemsByStatus[status].map((item) => {
                                      const post = item.post;
                                      const link = post?.postLink || (post?.instagramMediaId ? `https://www.instagram.com/p/${post.instagramMediaId}` : '');
                                      const coverSrc = toThumbnailProxyUrl(
                                        post?.coverUrl || post?.thumbnailUrl || post?.thumbnail_url || null
                                      );
                                      const videoUrl = toVideoProxyUrl(post?.mediaUrl || post?.media_url || null);
                                      const canPlay = Boolean(videoUrl || link);
                                      const totalInteractions = post?.stats?.total_interactions;
                                      const likes = post?.stats?.likes;
                                      const comments = post?.stats?.comments;
                                      const shares = post?.stats?.shares;
                                      const saved = post?.stats?.saved;
                                      return (
                                        <div key={item._id} className="bg-white border border-slate-200 rounded-lg">
                                          {notesOnly ? (
                                            <div className="px-3 pt-3">
                                              <p className="text-[11px] text-slate-500">{formatDate(post?.postDate)}</p>
                                            </div>
                                          ) : (
                                            <div className="p-3 space-y-3">
                                              {coverSrc ? (
                                                <Image
                                                  src={coverSrc}
                                                  alt="capa"
                                                  width={160}
                                                  height={160}
                                                  className="w-full h-40 rounded-xl object-cover border"
                                                  unoptimized
                                                  referrerPolicy="no-referrer"
                                                />
                                              ) : (
                                                <div className="w-full h-40 bg-slate-100 rounded-xl flex items-center justify-center text-[10px] text-slate-400">Sem img</div>
                                              )}
                                              <div className="min-w-0">
                                                <p className="text-[11px] text-slate-500">{formatDate(post?.postDate)}</p>
                                                {!hideMetrics && (
                                                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
                                                    {typeof totalInteractions === 'number' && (
                                                      <span className="font-medium text-slate-600">
                                                        Interacoes {formatNumber(totalInteractions)}
                                                      </span>
                                                    )}
                                                    {typeof likes === 'number' && (
                                                      <span className="inline-flex items-center gap-1">
                                                        <HeartIcon className="w-3.5 h-3.5 text-slate-400" />
                                                        {formatNumber(likes)}
                                                      </span>
                                                    )}
                                                    {typeof comments === 'number' && (
                                                      <span className="inline-flex items-center gap-1">
                                                        <ChatBubbleOvalLeftEllipsisIcon className="w-3.5 h-3.5 text-slate-400" />
                                                        {formatNumber(comments)}
                                                      </span>
                                                    )}
                                                    {typeof shares === 'number' && (
                                                      <span className="inline-flex items-center gap-1">
                                                        <ShareIcon className="w-3.5 h-3.5 text-slate-400" />
                                                        {formatNumber(shares)}
                                                      </span>
                                                    )}
                                                    {typeof saved === 'number' && (
                                                      <span className="inline-flex items-center gap-1">
                                                        <BookmarkIcon className="w-3.5 h-3.5 text-slate-400" />
                                                        {formatNumber(saved)}
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                          <div className="px-3 pb-3 space-y-2">
                                            <div className={`text-[12px] border rounded-md px-2 py-2 ${STATUS_NOTE_STYLES[status]}`}>
                                              {item.note || 'Sem anotacao.'}
                                            </div>
                                            {!notesOnly && (
                                              <div className="flex items-center gap-2">
                                                <button
                                                  onClick={() => openVideo({ videoUrl, postLink: link, posterUrl: coverSrc || undefined })}
                                                  className={`text-slate-400 transition-colors ${canPlay ? 'hover:text-rose-600' : 'opacity-40 cursor-not-allowed'}`}
                                                  title={canPlay ? 'Assistir conteudo' : 'Video indisponivel'}
                                                  disabled={!canPlay}
                                                >
                                                  <PlayCircleIcon className="w-5 h-5" />
                                                </button>
                                                <button
                                                  onClick={() => openDetail(post?._id)}
                                                  className="text-slate-400 hover:text-indigo-600 transition-colors"
                                                  title="Ver analise"
                                                >
                                                  <DocumentMagnifyingGlassIcon className="w-5 h-5" />
                                                </button>
                                                <button
                                                  onClick={() => openEdit(item)}
                                                  className="text-slate-400 hover:text-amber-600 transition-colors"
                                                  title="Editar revisão"
                                                >
                                                  <PencilSquareIcon className="w-5 h-5" />
                                                </button>
                                                <button
                                                  onClick={() => link && window.open(link, '_blank', 'noopener,noreferrer')}
                                                  className={`text-slate-400 transition-colors ${link ? 'hover:text-blue-600' : 'opacity-40 cursor-not-allowed'}`}
                                                  title={link ? 'Abrir post original' : 'Link indisponivel'}
                                                  disabled={!link}
                                                >
                                                  <ArrowTopRightOnSquareIcon className="w-5 h-5" />
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })
        )}

        {grouped.length > 0 && (
          <div className="flex items-center justify-between text-sm text-slate-600">
            <p>Pagina <span className="font-semibold">{page}</span> de <span className="font-semibold">{totalPages}</span> ({total} posts)</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 border border-slate-300 rounded-md bg-white text-slate-700 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 border border-slate-300 rounded-md bg-white text-slate-700 disabled:opacity-50"
              >
                Proxima
              </button>
            </div>
          </div>
        )}

        <DiscoverVideoModal
          open={isVideoOpen}
          onClose={closeVideo}
          videoUrl={activeVideo?.videoUrl}
          postLink={activeVideo?.postLink}
          posterUrl={activeVideo?.posterUrl}
        />
        <PostDetailModal
          isOpen={isDetailOpen}
          onClose={closeDetail}
          postId={selectedPostId}
          apiPrefix="/api/admin"
        />
        {isEditOpen && editItem && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-lg shadow-xl relative p-6 space-y-4">
              <button onClick={closeEdit} className="absolute top-2 right-2 text-slate-500" aria-label="Fechar">
                <XMarkIcon className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Editar revisão</h3>
                <p className="text-sm text-slate-500">Atualize o status e a anotação do conteúdo.</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label htmlFor="edit-status" className="block text-xs font-semibold text-slate-600 mb-1">Categoria</label>
                  <select
                    id="edit-status"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as ReviewStatus)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-note" className="block text-xs font-semibold text-slate-600 mb-1">Anotação</label>
                  <textarea
                    id="edit-note"
                    rows={4}
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Escreva observações para a reunião..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                  />
                </div>
                {editError && <p className="text-sm text-rose-600">{editError}</p>}
                <div className="flex justify-end gap-2">
                  <button onClick={closeEdit} className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50">
                    Cancelar
                  </button>
                  <button
                    onClick={handleEditSave}
                    disabled={savingEdit || !editNote.trim()}
                    className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-400"
                  >
                    {savingEdit ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
