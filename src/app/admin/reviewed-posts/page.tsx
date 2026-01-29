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
import { motion } from 'framer-motion';
import {
  Heart,
  MessageSquare,
  Share2,
  Bookmark,
  BarChart2,
  Play,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
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

const STATUS_CONFIG: Record<ReviewStatus, { label: string; bg: string; text: string; border: string; icon: any }> = {
  do: { label: 'Keep Doing', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
  dont: { label: 'Stop Doing', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: AlertCircle },
  almost: { label: 'Pivot / Adjust', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: MessageSquare },
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
  const [deletingReview, setDeletingReview] = useState(false);
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

  const handleDeleteReview = async () => {
    if (!editItem?.postId) return;
    if (!window.confirm('Tem certeza que deseja excluir esta revisão? O post deixará de aparecer nesta lista.')) return;

    setDeletingReview(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/admin/dashboard/post-reviews?postId=${editItem.postId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao excluir revisão.');
      }
      closeEdit();
      void fetchReviews();
    } catch (err: any) {
      setEditError(err.message || 'Falha ao excluir revisão.');
    } finally {
      setDeletingReview(false);
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Administração</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Review de Post</h1>
            <p className="text-lg text-slate-600">Feedbacks consolidados de todos os criadores.</p>
          </div>
        </header>

        <div className={`${cardBase} p-4 space-y-3`}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Filtros</p>
            <h2 className="text-sm font-semibold text-slate-900">Refine o recorte da reunião</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="statusFilter" className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Status</label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as ReviewStatus | '');
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none shadow-sm"
              >
                <option value="">Todos</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="creatorContextFilter" className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Categoria dominante (criador)</label>
              <select
                id="creatorContextFilter"
                value={creatorContextFilter}
                onChange={(e) => {
                  setCreatorContextFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none shadow-sm"
              >
                <option value="">Todas</option>
                {contextOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="creatorSearch" className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Buscar criador</label>
              <input
                id="creatorSearch"
                type="text"
                value={creatorSearch}
                onChange={(e) => {
                  setCreatorSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Nome do criador..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none shadow-sm"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-[#6E1F93]" />
            <p className="mt-4 text-sm font-medium">Carregando conteúdos...</p>
          </div>
        ) : error ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center p-8 text-slate-500 text-center">
            <AlertCircle className="mb-2 h-10 w-10 text-rose-500/50" />
            <p>{error}</p>
            <button
              onClick={() => fetchReviews()}
              className="mt-4 text-sm font-semibold text-[#6E1F93] hover:underline"
            >
              Tentar novamente
            </button>
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
            <div className="group relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-50 shadow-inner">
              <MessageSquare className="h-10 w-10 text-slate-300 transition group-hover:scale-110 group-hover:text-[#6E1F93]" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Nenhum conteúdo encontrado</h2>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              Não há conteúdos revisados com os filtros atuais.
            </p>
          </div>
        ) : (
          <div className="space-y-16">
            {grouped.map((contextGroup) => {
              const totalContextItems = contextGroup.creators.reduce(
                (acc, creator) => acc + creator.itemsByStatus.do.length + creator.itemsByStatus.dont.length + creator.itemsByStatus.almost.length, 0
              );

              return (
                <section key={contextGroup.id} className="space-y-10">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-slate-900">{contextGroup.label}</h2>
                    <div className="h-px flex-1 bg-slate-100" />
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {totalContextItems} {totalContextItems === 1 ? 'review' : 'reviews'}
                      </span>
                      <button
                        onClick={() => handleCopySummary(contextGroup)}
                        className="text-xs font-bold uppercase tracking-wider text-[#6E1F93] hover:underline"
                      >
                        {copiedContextId === contextGroup.id ? 'Copiado!' : 'Copiar resumo'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-12">
                    {contextGroup.creators.map((creator) => {
                      const allItems = [
                        ...creator.itemsByStatus.do,
                        ...creator.itemsByStatus.dont,
                        ...creator.itemsByStatus.almost
                      ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

                      return (
                        <div key={creator.id} className="space-y-6">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              name={creator.name}
                              src={creator.avatarUrl ? toThumbnailProxyUrl(creator.avatarUrl) : undefined}
                              size={44}
                              className="border-2 border-slate-100 shadow-sm"
                            />
                            <div>
                              <h3 className="text-lg font-bold text-slate-800 leading-none">{creator.name}</h3>
                              <p className="mt-1 text-xs font-medium text-slate-500">
                                {allItems.length} {allItems.length === 1 ? 'conteúdo individual' : 'conteúdos individuais'}
                              </p>
                            </div>
                          </div>

                          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                            {allItems.map((item, i) => (
                              <AdminReviewCard
                                key={item._id}
                                item={item}
                                index={i}
                                onPlay={() => {
                                  const p = item.post;
                                  const videoUrl = toVideoProxyUrl(p?.mediaUrl || p?.media_url || null);
                                  const coverSrc = toThumbnailProxyUrl(p?.coverUrl || p?.thumbnailUrl || p?.thumbnail_url || null);
                                  const link = p?.postLink || (p?.instagramMediaId ? `https://www.instagram.com/p/${p.instagramMediaId}` : '');
                                  openVideo({ videoUrl, postLink: link, posterUrl: coverSrc || undefined });
                                }}
                                onEdit={openEdit}
                                onDetail={openDetail}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
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
                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={handleDeleteReview}
                    disabled={deletingReview || savingEdit}
                    className="px-4 py-2 text-sm font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-50"
                  >
                    {deletingReview ? 'Excluindo...' : 'Excluir revisão'}
                  </button>
                  <div className="flex gap-2">
                    <button onClick={closeEdit} className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50">
                      Cancelar
                    </button>
                    <button
                      onClick={handleEditSave}
                      disabled={savingEdit || deletingReview}
                      className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-400"
                    >
                      {savingEdit ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminReviewCard({
  item,
  index,
  onPlay,
  onEdit,
  onDetail,
}: {
  item: ReviewItem;
  index: number;
  onPlay: () => void;
  onEdit: (item: ReviewItem) => void;
  onDetail: (postId?: string) => void;
}) {
  const post = item.post;
  const config = STATUS_CONFIG[item.status];
  const Icon = config.icon;
  const coverUrl = toThumbnailProxyUrl(post?.thumbnail_url || post?.thumbnailUrl || post?.coverUrl || post?.media_url || post?.mediaUrl || null);
  const stats = post?.stats || {};

  const formatNum = (num?: number) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  };

  const link = post?.postLink || (post?.instagramMediaId ? `https://www.instagram.com/p/${post.instagramMediaId}` : '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="group relative flex flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
    >
      {/* Status Header */}
      <div className={`flex items-center justify-between border-b px-5 py-3 ${config.bg} ${config.border}`}>
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${config.text}`} />
          <span className={`text-xs font-bold uppercase tracking-wider ${config.text}`}>
            {config.label}
          </span>
        </div>

        {/* Admin Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
            className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-black/5 ${config.text}`}
            title="Editar Anotação"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDetail(post?._id); }}
            className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-black/5 ${config.text}`}
            title="Ver Detalhes do Post"
          >
            <DocumentMagnifyingGlassIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div className="flex flex-1 flex-col p-6">
        {/* Note */}
        <div className="mb-6 flex-1">
          <p className="whitespace-pre-wrap text-lg font-medium leading-relaxed text-slate-800">
            {item.note || <span className="italic text-slate-400">Sem anotações.</span>}
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
                unoptimized={coverUrl.includes('/api/proxy')}
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
            {link ? (
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
            Feedback de {new Date(item.updatedAt).toLocaleDateString('pt-BR')}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
