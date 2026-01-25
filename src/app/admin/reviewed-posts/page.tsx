'use client';

import Image from 'next/image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowTopRightOnSquareIcon, DocumentMagnifyingGlassIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import PostDetailModal from '@/app/admin/creator-dashboard/PostDetailModal';
import { Category, contextCategories, idsToLabels } from '@/app/lib/classification';

type ReviewStatus = 'do' | 'dont' | 'almost';

const STATUS_LABELS: Record<ReviewStatus, string> = {
  do: 'Fazer',
  dont: 'Não fazer',
  almost: 'Quase lá',
};

const STATUS_STYLES: Record<ReviewStatus, string> = {
  do: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  dont: 'bg-rose-100 text-rose-800 ring-rose-200',
  almost: 'bg-amber-100 text-amber-900 ring-amber-200',
};

const STATUS_PANEL_STYLES: Record<ReviewStatus, string> = {
  do: 'border-emerald-200 bg-emerald-50/60',
  dont: 'border-rose-200 bg-rose-50/60',
  almost: 'border-amber-200 bg-amber-50/60',
};

const STATUS_NOTE_STYLES: Record<ReviewStatus, string> = {
  do: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  dont: 'border-rose-200 bg-rose-50 text-rose-900',
  almost: 'border-amber-200 bg-amber-50 text-amber-900',
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
  postLink?: string;
  instagramMediaId?: string;
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

const normalizeLabels = (values?: string[] | string, type?: 'proposal' | 'context') => {
  if (!values || !type) return [];
  const raw = Array.isArray(values) ? values : values.split(',').map((v) => v.trim()).filter(Boolean);
  return idsToLabels(raw, type);
};

const statusOrder: ReviewStatus[] = ['dont', 'do', 'almost'];
const boardBgStyle = {
  backgroundImage: 'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)',
  backgroundSize: '28px 28px',
};

export default function ReviewedPostsPage() {
  const searchParams = useSearchParams();
  const contextOptions = useMemo(() => buildContextOptions(contextCategories), []);
  const contextLabelMap = useMemo(() => buildContextLabelMap(contextCategories), []);

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

    filteredItems.forEach((item) => {
      const post = item.post;
      const contextId = post?.creatorContextId || 'sem-contexto';
      const label = contextLabelMap.get(contextId)
        || idsToLabels([contextId], 'context')[0]
        || 'Sem categoria dominante';
      const creatorId = post?.creatorId || post?.creatorName || 'sem-criador';
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
  }, [items, statusFilter, contextLabelMap, creatorSearch]);

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

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8" style={boardBgStyle}>
      <div className="max-w-full mx-auto space-y-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className={`font-black text-slate-900 ${presentationMode ? 'text-4xl' : 'text-3xl'}`}>Conteudos revisados</h1>
              <p className="text-sm text-slate-600">Organize por categoria dominante do criador e veja os conteudos marcados.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setPresentationMode((value) => !value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${presentationMode ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
              >
                {presentationMode ? 'Modo reuniao ativo' : 'Modo reuniao'}
              </button>
              <button
                onClick={() => setNotesOnly((value) => !value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${notesOnly ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
              >
                {notesOnly ? 'So notas' : 'Mostrar notas'}
              </button>
              <button
                onClick={() => setHideMetrics((value) => !value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${hideMetrics ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
              >
                {hideMetrics ? 'Ocultar metricas' : 'Mostrar metricas'}
              </button>
            </div>
          </div>
        </div>

        {!presentationMode && (
          <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-2xl p-4 shadow-sm">
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {grouped.length > 0 && (
          <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700">Agenda por categoria</h2>
              <span className="text-xs text-slate-500">Clique para pular</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {grouped.map((contextGroup) => {
                const totalContextItems = contextGroup.creators.reduce(
                  (acc, creator) => acc + statusOrder.reduce((sum, status) => sum + creator.itemsByStatus[status].length, 0),
                  0
                );
                return (
                  <a
                    key={contextGroup.id}
                    href={`#${getContextAnchorId(contextGroup.id)}`}
                    className="px-3 py-1.5 text-xs font-semibold rounded-full border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    {contextGroup.label} · {totalContextItems}
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
            const contextStatusTotals = statusOrder.reduce<Record<ReviewStatus, number>>((acc, status) => {
              acc[status] = contextGroup.creators.reduce((sum, creator) => sum + creator.itemsByStatus[status].length, 0);
              return acc;
            }, { do: 0, dont: 0, almost: 0 });
            return (
              <section id={getContextAnchorId(contextGroup.id)} key={contextGroup.id} className="space-y-4 scroll-mt-24">
                <div className="sticky top-4 z-10 -mx-2 px-2 py-2 rounded-xl bg-slate-50/95 backdrop-blur">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xl font-black text-slate-900 bg-yellow-300 px-3 py-1 rounded-md shadow-sm">
                      {contextGroup.label}
                    </span>
                    <span className="text-xs text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded-full">
                      {contextGroup.creators.length} criadores · {totalContextItems} conteudos
                    </span>
                    <div className="flex items-center gap-2">
                      {statusOrder.map((status) => (
                        <span key={status} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ring-inset ${STATUS_STYLES[status]}`}>
                          {STATUS_LABELS[status]} {contextStatusTotals[status]}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => handleCopySummary(contextGroup)}
                      className="ml-auto px-3 py-1.5 text-xs font-semibold rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    >
                      {copiedContextId === contextGroup.id ? 'Copiado!' : 'Copiar resumo'}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto pb-4">
                  <div className="flex gap-6 min-w-max">
                    {contextGroup.creators.map((creator) => {
                      const totalItems = statusOrder.reduce((acc, status) => acc + creator.itemsByStatus[status].length, 0);
                      const creatorStatusTotals = statusOrder.reduce<Record<ReviewStatus, number>>((acc, status) => {
                        acc[status] = creator.itemsByStatus[status].length;
                        return acc;
                      }, { do: 0, dont: 0, almost: 0 });
                      return (
                        <div key={creator.id} className="w-[320px] shrink-0">
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              {creator.avatarUrl ? (
                                <Image src={creator.avatarUrl} alt={creator.name} width={36} height={36} className="w-9 h-9 rounded-full object-cover border" />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-500">N/A</div>
                              )}
                              <span className="bg-yellow-200 text-slate-900 font-semibold text-sm px-2 py-1 rounded-md shadow-sm">
                                {creator.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-600">
                              <span>{totalItems} itens</span>
                              <span className="text-slate-300">•</span>
                              {statusOrder.map((status) => (
                                <span key={status} title={STATUS_LABELS[status]} className={`px-1.5 py-0.5 rounded-full ring-1 ring-inset ${STATUS_STYLES[status]}`}>
                                  {creatorStatusTotals[status]}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            {statusOrder.map((status) => (
                              <div key={status} className={`rounded-xl border ${STATUS_PANEL_STYLES[status]} shadow-sm`}>
                                <div className="flex items-center justify-between px-3 py-2 border-b border-white/60">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${STATUS_STYLES[status]}`}>
                                    {STATUS_LABELS[status]}
                                  </span>
                                  <span className="text-xs text-slate-600">{creator.itemsByStatus[status].length}</span>
                                </div>
                                <div className="p-3 space-y-3">
                                  {creator.itemsByStatus[status].length === 0 ? (
                                    <p className="text-xs text-slate-500">Sem conteudos.</p>
                                  ) : (
                                    creator.itemsByStatus[status].map((item) => {
                                      const post = item.post;
                                      const link = post?.postLink || (post?.instagramMediaId ? `https://www.instagram.com/p/${post.instagramMediaId}` : '');
                                      const contextLabels = normalizeLabels(post?.context, 'context');
                                      const proposalLabels = normalizeLabels(post?.proposal, 'proposal');
                                      return (
                                        <div key={item._id} className="bg-white border border-slate-200 rounded-lg shadow-sm">
                                        <div className={`p-3 flex items-start gap-2 ${notesOnly ? 'hidden' : ''}`}>
                                            {post?.coverUrl ? (
                                              <Image src={post.coverUrl} alt="capa" width={56} height={56} className="w-14 h-14 rounded object-cover border" />
                                            ) : (
                                              <div className="w-14 h-14 bg-slate-100 rounded flex items-center justify-center text-[10px] text-slate-400">Sem img</div>
                                            )}
                                            <div className="min-w-0">
                                              <p className="text-[11px] text-slate-500">{formatDate(post?.postDate)}</p>
                                              <p className="text-sm text-slate-900 line-clamp-2">{post?.text_content || post?.description || 'Sem legenda...'}</p>
                                              {!hideMetrics && (
                                                <p className="text-[11px] text-slate-500">Interacoes: {formatNumber(post?.stats?.total_interactions)}</p>
                                              )}
                                              <div className="flex flex-wrap gap-1 mt-1">
                                                {contextLabels.slice(0, 1).map((label) => (
                                                  <span key={`ctx-${label}`} className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200">
                                                    {label}
                                                  </span>
                                                ))}
                                                {proposalLabels.slice(0, 1).map((label) => (
                                                  <span key={`prop-${label}`} className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                                                    {label}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="px-3 pb-3 space-y-2">
                                            <div className={`text-[11px] border rounded-md px-2 py-1 ${STATUS_NOTE_STYLES[status]}`}>
                                              <span className="font-semibold">Nota:</span> {item.note || '—'}
                                            </div>
                                            <div className={`flex items-center gap-2 ${notesOnly ? 'hidden' : ''}`}>
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
