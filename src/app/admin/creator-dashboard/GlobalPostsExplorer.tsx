'use client';

import Image from 'next/image';
import React, { useState, useEffect, useCallback, useMemo, useRef, memo, type CSSProperties } from 'react';
import { useInView } from 'react-intersection-observer';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import {
  MagnifyingGlassIcon,
  DocumentMagnifyingGlassIcon,
  XMarkIcon,
  ArrowRightIcon,
  ChartBarIcon, // Added
} from '@heroicons/react/24/outline';
import {
  Category,
  formatCategories,
  proposalCategories,
  contextCategories,
  toneCategories,
  referenceCategories,
  idsToLabels,
} from '../../lib/classification';
import { ArrowTopRightOnSquareIcon, ClipboardIcon } from '@heroicons/react/24/outline';


// --- Componentes de Apoio (Definidos localmente para autonomia) ---

const SkeletonBlock = ({ width = 'w-full', height = 'h-4', className = '', variant = 'rectangle' }: { width?: string; height?: string; className?: string; variant?: 'rectangle' | 'circle' }) => {
  const baseClasses = "bg-gray-200 animate-pulse";
  const shapeClass = variant === 'circle' ? 'rounded-full' : 'rounded';
  return <div data-testid="skeleton-block" className={`${baseClasses} ${width} ${height} ${shapeClass} ${className}`}></div>;
};

const POSTS_CACHE_TTL = 60 * 1000;
const MAX_POSTS_CACHE = 20;

const EmptyState = ({ icon, title, message }: { icon: React.ReactNode; title: string; message: string; }) => (
  <div className="text-center py-8">
    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100">{icon}</div>
    <h3 className="mt-2 text-sm font-semibold text-gray-900">{title}</h3>
    <p className="mt-1 text-sm text-gray-500">{message}</p>
  </div>
);

// MultiSelect com checkboxes e busca simples
function MultiSelectBox({
  id,
  label,
  options,
  selected,
  onChange,
}: {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const filtered = React.useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, query]);

  const isSelected = (v: string) => selected.includes(v);
  const toggleValue = (v: string) => {
    if (isSelected(v)) onChange(selected.filter(s => s !== v));
    else onChange([...selected, v]);
  };

  return (
    <div className="relative">
      <label htmlFor={id} className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <button type="button" id={id} onClick={() => setOpen(o => !o)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm bg-white text-left">
        {selected.length ? `${selected.length} selecionado(s)` : 'Selecione...'}
        <span className="float-right text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-[min(22rem,90vw)] max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-xl p-2">
          <div className="mb-2 flex items-center gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar..." className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
            <button onClick={() => onChange(filtered.map(o => o.value))} className="px-2 py-1 text-xs bg-gray-100 rounded border border-gray-200">Todos</button>
            <button onClick={() => onChange([])} className="px-2 py-1 text-xs bg-gray-100 rounded border border-gray-200">Limpar</button>
          </div>
          <ul className="space-y-1">
            {filtered.map(opt => (
              <li key={opt.value} className="flex items-center gap-2 text-sm">
                <input id={`${id}-${opt.value}`} type="checkbox" className="h-4 w-4" checked={isSelected(opt.value)} onChange={() => toggleValue(opt.value)} />
                <label htmlFor={`${id}-${opt.value}`} className="cursor-pointer truncate" title={opt.label}>{opt.label}</label>
              </li>
            ))}
            {filtered.length === 0 && <li className="text-xs text-gray-500">Nenhuma opção</li>}
          </ul>
          <div className="mt-2 text-right">
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Tipos e Interfaces ---

interface IGlobalPostResult {
  _id?: string;
  text_content?: string;
  description?: string;
  coverUrl?: string;
  creatorName?: string;
  creatorAvatarUrl?: string; // Added
  postDate?: Date | string;
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
    shares?: number;
  };
}

interface TagItem {
  label: string;
  color: string;
  title: string;
}

interface ColumnDef {
  key: string;
  label: string;
  sortable: boolean;
  getVal: (post: IGlobalPostResult) => unknown;
  headerClassName?: string;
}

const formatDate = (dateString?: Date | string) => !dateString ? 'N/A' : new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const getNestedValue = (obj: any, path: string, defaultValue: any = 'N/A') => path.split('.').reduce((acc, part) => acc && acc[part], obj) ?? defaultValue;
const formatNumberStd = (val: any) => !isNaN(parseFloat(String(val))) ? parseFloat(String(val)).toLocaleString('pt-BR') : 'N/A';
const toDisplayValue = (value: unknown): React.ReactNode => {
  if (React.isValidElement(value)) return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
};

const getTagLabels = (post: IGlobalPostResult): TagItem[] => {
  const items: TagItem[] = [];
  const push = (labels: string[] | string | undefined, color: string, titlePrefix: string, type: 'format' | 'proposal' | 'context' | 'tone' | 'reference') => {
    if (!labels) return;
    const arr = Array.isArray(labels) ? labels : (labels ? String(labels).split(',') : []);
    const resolved = idsToLabels(arr, type).filter(Boolean);
    resolved.forEach(l => items.push({ label: l, color, title: `${titlePrefix}: ${l}` }));
  };
  push(post.format as any, 'bg-blue-50 text-blue-700 ring-blue-200', 'Formato', 'format');
  push(post.proposal as any, 'bg-violet-50 text-violet-700 ring-violet-200', 'Proposta', 'proposal');
  push(post.context as any, 'bg-amber-50 text-amber-700 ring-amber-200', 'Contexto', 'context');
  push(post.tone as any, 'bg-teal-50 text-teal-700 ring-teal-200', 'Tom', 'tone');
  push(post.references as any, 'bg-rose-50 text-rose-700 ring-rose-200', 'Referência', 'reference');
  return items;
};

const TagChip = ({ label, color, title }: TagItem) => (
  <span title={title} className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium ring-1 ring-inset ${color} mr-1 mb-1 max-w-[120px] truncate`}>
    {label}
  </span>
);

const rowStyle = { contentVisibility: 'auto', containIntrinsicSize: '120px 1px' } as CSSProperties;

interface PostsTableRowProps {
  post: IGlobalPostResult;
  columns: ColumnDef[];
  onOpenPostDetailModal: (postId: string) => void;
  onOpenTrendChart: (postId: string) => void;
  onOpenExternalLink: (post: IGlobalPostResult) => void;
  onCopyLink: (post: IGlobalPostResult) => void;
}

const PostsTableRow = memo(function PostsTableRow({
  post,
  columns,
  onOpenPostDetailModal,
  onOpenTrendChart,
  onOpenExternalLink,
  onCopyLink,
}: PostsTableRowProps) {
  return (
    <tr className="hover:bg-gray-50 transition-colors" style={rowStyle}>
      {columns.map(col => {
        const rawValue = col.getVal(post);
        let displayValue: React.ReactNode = toDisplayValue(rawValue);
        if (col.key.startsWith('stats.')) {
          displayValue = (
            <span title={String(rawValue)} className="tabular-nums font-medium text-gray-700">{formatNumberStd(rawValue)}</span>
          );
        }
        if (col.key === 'cover') {
          return (
            <td key={col.key} className="px-3 py-2 whitespace-nowrap w-24">
              {rawValue ? (
                <Image
                  src={String(rawValue)}
                  alt="capa"
                  width={96}
                  height={96}
                  className="w-24 h-24 object-cover rounded border border-gray-100"
                  onError={(e) => {
                    const t = e.currentTarget as HTMLImageElement;
                    t.onerror = null;
                    t.src = 'https://placehold.co/96x96?text=%3F';
                  }}
                />
              ) : (
                <div className="w-24 h-24 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">Sem img</div>
              )}
            </td>
          );
        }
        if (col.key === 'tags') {
          const chips = (rawValue as TagItem[]) || [];
          const MAX = 3;
          const shown = chips.slice(0, MAX);
          const extra = chips.length - shown.length;
          return (
            <td key={col.key} className="px-4 py-3 text-left max-w-xs">
              <div className="flex flex-wrap gap-1">
                {shown.map((c, i) => <TagChip key={`${c.label}_${i}`} label={c.label} color={c.color} title={c.title} />)}
                {extra > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200">+{extra}</span>
                )}
              </div>
            </td>
          );
        }
        if (col.key === 'actions') {
          const externalLink = post.postLink || (post.instagramMediaId ? `https://www.instagram.com/p/${post.instagramMediaId}` : '');
          return (
            <td key={col.key} className="px-4 py-3 whitespace-nowrap text-center">
              <div className="flex items-center justify-center space-x-2">
                <button onClick={() => onOpenPostDetailModal(post._id!.toString())} className="text-gray-400 hover:text-indigo-600 transition-colors" title="Ver detalhes">
                  <DocumentMagnifyingGlassIcon className="w-5 h-5" />
                </button>
                <button onClick={() => onOpenTrendChart(post._id!.toString())} className="text-gray-400 hover:text-green-600 transition-colors" title="Ver tendência">
                  <ChartBarIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => externalLink && onOpenExternalLink(post)}
                  className={`text-gray-400 transition-colors ${externalLink ? 'hover:text-blue-600' : 'opacity-40 cursor-not-allowed'}`}
                  title={externalLink ? 'Abrir post original' : 'Link indisponível'}
                  disabled={!externalLink}
                >
                  <ArrowTopRightOnSquareIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => externalLink && onCopyLink(post)}
                  className={`text-gray-400 transition-colors ${externalLink ? 'hover:text-amber-600' : 'opacity-40 cursor-not-allowed'}`}
                  title={externalLink ? 'Copiar link' : 'Link indisponível'}
                  disabled={!externalLink}
                >
                  <ClipboardIcon className="w-5 h-5" />
                </button>
              </div>
            </td>
          );
        }
        return (
          <td key={col.key} className={`px-4 py-3 whitespace-nowrap text-gray-600 ${col.key.startsWith('stats.') ? 'text-center' : 'text-left'}`}>
            <span title={String(rawValue)} className="block max-w-[200px] truncate">{displayValue}</span>
          </td>
        );
      })}
    </tr>
  );
});

// CORRIGIDO: Adicionado apiPrefix para futuras chamadas de API
interface ContentTrendChartProps {
  postId: string;
  apiPrefix: string;
}
const ContentTrendChart: React.FC<ContentTrendChartProps> = ({ postId, apiPrefix }) => {
  /* ... Implementação do Gráfico usaria apiPrefix aqui ... */
  return <div className="p-4">Gráfico de Tendência para o Post ID: {postId}</div>;
};

interface PostDetailResponse {
  text_content?: string;
  description?: string;
  creatorName?: string;
  coverUrl?: string;
  stats?: { total_interactions?: number; likes?: number; shares?: number };
  dailySnapshots: any[];
}

// CORRIGIDO: Componente agora aceita e usa a prop 'apiPrefix'
const PostDetailModal = ({ isOpen, onClose, postId, apiPrefix }: {
  isOpen: boolean;
  onClose: () => void;
  postId: string | null;
  apiPrefix: string;
}) => {
  const [data, setData] = useState<PostDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !postId) return;
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiPrefix}/dashboard/posts/${postId}/details`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [isOpen, postId, apiPrefix]); // CORRIGIDO: Adicionado apiPrefix ao array de dependências

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-lg shadow-xl relative overflow-y-auto max-h-full p-6 space-y-4">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500" aria-label="Fechar">
          <XMarkIcon className="w-5 h-5" />
        </button>
        {loading ? (
          <div className="text-center">Carregando...</div>
        ) : data ? (
          <>
            <div className="flex space-x-4">
              {data.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.coverUrl}
                  alt="capa"
                  className="w-40 h-40 object-cover rounded"
                  onError={(e) => {
                    const t = e.currentTarget as HTMLImageElement;
                    t.onerror = null;
                    t.src = 'https://placehold.co/160x160?text=%3F';
                  }}
                />
              )}
              <div className="flex-1 text-sm space-y-1">
                <p><strong>Criador:</strong> {data.creatorName || 'N/A'}</p>
                <p><strong>Texto:</strong> {data.text_content || data.description || 'N/A'}</p>
                <p><strong>Interações:</strong> {data.stats?.total_interactions?.toLocaleString('pt-BR') || '0'}</p>
              </div>
            </div>
            {/* CORRIGIDO: Passando apiPrefix para o componente filho */}
            {postId && <ContentTrendChart postId={postId} apiPrefix={apiPrefix} />}
          </>
        ) : (
          <div className="text-center text-sm">Falha ao carregar detalhes.</div>
        )}
      </div>
    </div>
  );
};


interface GlobalPostsExplorerProps {
  apiPrefix?: string;
  dateRangeFilter?: {
    startDate: string;
    endDate: string;
  };
  forceOnlyActiveSubscribers?: boolean;
  forceContext?: string[];
  creatorContextFilter?: string;
}

interface SortConfig {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface ActiveFilters {
  context?: string[];
  proposal?: string[];
  format?: string[];
  tone?: string[];
  references?: string[];
  searchText?: string;
  minInteractions?: number;
  onlyActiveSubscribers?: boolean; // NEW
}


const GlobalPostsExplorer = memo(function GlobalPostsExplorer({
  apiPrefix = '/api/admin',
  dateRangeFilter,
  forceOnlyActiveSubscribers = false,
  forceContext,
  creatorContextFilter,
}: GlobalPostsExplorerProps) {
  const [selectedContext, setSelectedContext] = useState<string[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<string[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<string[]>([]);
  const [selectedTone, setSelectedTone] = useState<string[]>([]);
  const [selectedReferences, setSelectedReferences] = useState<string[]>([]);
  const [minInteractionsValue, setMinInteractionsValue] = useState<string>('');
  const [textSearch, setTextSearch] = useState('');

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'explorer' | 'analysis'>('explorer'); // NEW: View mode state

  // Explorer State
  const [posts, setPosts] = useState<IGlobalPostResult[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ sortBy: 'postDate', sortOrder: 'desc' });

  // Analysis State
  const [bestPosts, setBestPosts] = useState<IGlobalPostResult[]>([]);
  const [worstPosts, setWorstPosts] = useState<IGlobalPostResult[]>([]);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [onlyActiveSubscribers, setOnlyActiveSubscribers] = useState(false); // Controlled by props

  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});

  const postsAbortRef = useRef<AbortController | null>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const postsCacheRef = useRef(new Map<string, { posts: IGlobalPostResult[]; totalPosts: number; ts: number }>());

  const [isPostDetailModalOpen, setIsPostDetailModalOpen] = useState(false);
  const [selectedPostIdForModal, setSelectedPostIdForModal] = useState<string | null>(null);
  const [isTrendChartOpen, setIsTrendChartOpen] = useState(false);
  const [selectedPostIdForTrend, setSelectedPostIdForTrend] = useState<string | null>(null);
  const { ref: postsTableRef, inView: postsTableInView } = useInView({ triggerOnce: true, rootMargin: '200px' });
  const shouldFetchPosts = viewMode === 'explorer' || postsTableInView;

  useEffect(() => {
    return () => {
      postsAbortRef.current?.abort();
      analysisAbortRef.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (forceOnlyActiveSubscribers) {
      setOnlyActiveSubscribers(true);
      setActiveFilters(prev => ({ ...prev, onlyActiveSubscribers: true }));
      setCurrentPage(1);
    } else {
      setOnlyActiveSubscribers(false);
      setActiveFilters(prev => {
        const next = { ...prev };
        if (next.onlyActiveSubscribers) delete next.onlyActiveSubscribers;
        return next;
      });
    }
  }, [forceOnlyActiveSubscribers]);

  useEffect(() => {
    if (forceContext && forceContext.length) {
      setSelectedContext(forceContext);
      setActiveFilters(prev => ({ ...prev, context: forceContext }));
      setCurrentPage(1);
    } else if (!forceContext) {
      setSelectedContext([]);
      setActiveFilters(prev => {
        const next = { ...prev };
        delete next.context;
        return next;
      });
    }
  }, [forceContext]);

  const createOptionsFromCategories = (categories: Category[]) => {
    const options: { value: string; label: string }[] = [];
    const traverse = (cats: Category[], prefix = '') => {
      cats.forEach(cat => {
        const label = prefix ? `${prefix} > ${cat.label}` : cat.label;
        options.push({ value: cat.id, label });
        if (cat.subcategories && cat.subcategories.length > 0) {
          traverse(cat.subcategories, label);
        }
      });
    };
    traverse(categories);
    return options;
  };

  const formatOptions = useMemo(() => createOptionsFromCategories(formatCategories), []);
  const proposalOptions = useMemo(() => createOptionsFromCategories(proposalCategories), []);
  const contextOptions = useMemo(() => createOptionsFromCategories(contextCategories), []);
  const toneOptions = useMemo(() => createOptionsFromCategories(toneCategories), []);
  const referenceOptions = useMemo(() => createOptionsFromCategories(referenceCategories), []);

  const handleOpenPostDetailModal = useCallback((postId: string) => { setSelectedPostIdForModal(postId); setIsPostDetailModalOpen(true); }, []);
  const handleClosePostDetailModal = useCallback(() => { setIsPostDetailModalOpen(false); setSelectedPostIdForModal(null); }, []);
  const handleOpenTrendChart = useCallback((postId: string) => { setSelectedPostIdForTrend(postId); setIsTrendChartOpen(true); }, []);
  const handleCloseTrendChart = useCallback(() => { setIsTrendChartOpen(false); setSelectedPostIdForTrend(null); }, []);
  const handleOpenExternalLink = useCallback((post: IGlobalPostResult) => {
    const link = post.postLink || (post.instagramMediaId ? `https://www.instagram.com/p/${post.instagramMediaId}` : '');
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  }, []);

  const handleCopyLink = useCallback(async (post: IGlobalPostResult) => {
    const link = post.postLink || (post.instagramMediaId ? `https://www.instagram.com/p/${post.instagramMediaId}` : '');
    if (!link || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* no-op */
    }
  }, []);

  const buildQueryParams = useCallback((filters: ActiveFilters, sort: SortConfig, pageLimit: { page: number, limit: number }) => {
    const mergedContext = forceContext && forceContext.length ? forceContext : filters.context;
    const mergedOnlyActive = forceOnlyActiveSubscribers || filters.onlyActiveSubscribers;

    const params = new URLSearchParams({
      page: String(pageLimit.page),
      limit: String(pageLimit.limit),
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
    });

    if (mergedContext && mergedContext.length) params.append('context', mergedContext.join(','));
    if (filters.proposal && filters.proposal.length) params.append('proposal', filters.proposal.join(','));
    if (filters.format && filters.format.length) params.append('format', filters.format.join(','));
    if (filters.tone && filters.tone.length) params.append('tone', filters.tone.join(','));
    if (filters.references && filters.references.length) params.append('references', filters.references.join(','));
    if (filters.minInteractions) params.append('minInteractions', String(filters.minInteractions));
    if (filters.searchText) params.append('searchText', filters.searchText);
    if (mergedOnlyActive) params.append('onlyActiveSubscribers', 'true');
    if (creatorContextFilter) params.append('creatorContext', creatorContextFilter);

    if (dateRangeFilter?.startDate) params.append('startDate', new Date(dateRangeFilter.startDate).toISOString());
    if (dateRangeFilter?.endDate) params.append('endDate', new Date(dateRangeFilter.endDate).toISOString());

    return params;
  }, [dateRangeFilter, creatorContextFilter, forceContext, forceOnlyActiveSubscribers]);

  const fetchPosts = useCallback(async () => {
    postsAbortRef.current?.abort();
    const controller = new AbortController();
    postsAbortRef.current = controller;
    setError(null);

    const params = buildQueryParams(activeFilters, sortConfig, { page: currentPage, limit });
    const cacheKey = params.toString();
    const cached = postsCacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.ts < POSTS_CACHE_TTL) {
      setPosts(cached.posts);
      setTotalPosts(cached.totalPosts);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const postsUrl = `${apiPrefix}/dashboard/posts?${params.toString()}`;
      const response = await fetch(postsUrl, { signal: controller.signal });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch posts: ${response.statusText}`);
      }
      const data = await response.json();
      const nextPosts = data.posts || [];
      const nextTotal = data.totalPosts || 0;
      setPosts(nextPosts);
      setTotalPosts(nextTotal);
      if (postsCacheRef.current.size >= MAX_POSTS_CACHE) {
        const oldestKey = postsCacheRef.current.keys().next().value;
        if (oldestKey) postsCacheRef.current.delete(oldestKey);
      }
      postsCacheRef.current.set(cacheKey, { posts: nextPosts, totalPosts: nextTotal, ts: Date.now() });

      const totalPages = Math.ceil(nextTotal / limit);
      const nextPage = currentPage + 1;
      if (nextPage <= totalPages) {
        const nextParams = buildQueryParams(activeFilters, sortConfig, { page: nextPage, limit });
        const nextKey = nextParams.toString();
        if (!postsCacheRef.current.has(nextKey)) {
          void (async () => {
            try {
              const res = await fetch(`${apiPrefix}/dashboard/posts?${nextParams.toString()}`);
              if (!res.ok) return;
              const prefetchData = await res.json();
              const prefetchPosts = prefetchData.posts || [];
              const prefetchTotal = prefetchData.totalPosts || 0;
              if (postsCacheRef.current.size >= MAX_POSTS_CACHE) {
                const oldestKey = postsCacheRef.current.keys().next().value;
                if (oldestKey) postsCacheRef.current.delete(oldestKey);
              }
              postsCacheRef.current.set(nextKey, { posts: prefetchPosts, totalPosts: prefetchTotal, ts: Date.now() });
            } catch {
              /* no-op */
            }
          })();
        }
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e.message);
    } finally {
      if (postsAbortRef.current === controller && !controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [currentPage, limit, sortConfig, activeFilters, apiPrefix, buildQueryParams]); // Removed viewMode dependency

  const fetchAnalysis = useCallback(async () => {
    if (viewMode !== 'analysis') return;
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    setIsAnalysisLoading(true);
    setError(null);

    try {
      // Fetch Best
      const bestParams = buildQueryParams(activeFilters, { sortBy: 'stats.total_interactions', sortOrder: 'desc' }, { page: 1, limit: 3 });
      const worstParams = buildQueryParams(activeFilters, { sortBy: 'stats.total_interactions', sortOrder: 'asc' }, { page: 1, limit: 3 });
      const [bestRes, worstRes] = await Promise.all([
        fetch(`${apiPrefix}/dashboard/posts?${bestParams.toString()}`, { signal: controller.signal }),
        fetch(`${apiPrefix}/dashboard/posts?${worstParams.toString()}`, { signal: controller.signal }),
      ]);
      if (!bestRes.ok || !worstRes.ok) {
        const errorData = await (bestRes.ok ? worstRes : bestRes).json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch analysis data');
      }
      const [bestData, worstData] = await Promise.all([bestRes.json(), worstRes.json()]);
      setBestPosts(bestData.posts || []);
      setWorstPosts(worstData.posts || []);

    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e.message);
    } finally {
      if (analysisAbortRef.current === controller && !controller.signal.aborted) {
        setIsAnalysisLoading(false);
      }
    }
  }, [activeFilters, apiPrefix, viewMode, buildQueryParams]);

  useEffect(() => {
    if (shouldFetchPosts) fetchPosts();
    if (viewMode === 'analysis') fetchAnalysis();
  }, [fetchPosts, fetchAnalysis, viewMode, shouldFetchPosts]);

  const handleApplyLocalFilters = useCallback(() => {
    setCurrentPage(1);
    setActiveFilters({
      context: selectedContext.length ? selectedContext : undefined,
      proposal: selectedProposal.length ? selectedProposal : undefined,
      format: selectedFormat.length ? selectedFormat : undefined,
      tone: selectedTone.length ? selectedTone : undefined,
      references: selectedReferences.length ? selectedReferences : undefined,
      searchText: textSearch || undefined,
      minInteractions: minInteractionsValue ? parseInt(minInteractionsValue) : undefined,
      onlyActiveSubscribers: onlyActiveSubscribers, // NEW
    });
  }, [selectedContext, selectedProposal, selectedFormat, selectedTone, selectedReferences, minInteractionsValue, textSearch, onlyActiveSubscribers]);

  const handleSort = useCallback((columnKey: string) => {
    setSortConfig(prev => ({ sortBy: columnKey, sortOrder: prev.sortBy === columnKey && prev.sortOrder === 'asc' ? 'desc' : 'asc' }));
    setCurrentPage(1);
  }, []);

  const renderSortIcon = useCallback((columnKey: string) => {
    if (sortConfig.sortBy !== columnKey) return <ChevronDownIcon className="w-3 h-3 inline text-gray-400 ml-1" />;
    return sortConfig.sortOrder === 'asc' ? <ChevronUpIcon className="w-3 h-3 inline text-indigo-500 ml-1" /> : <ChevronDownIcon className="w-3 h-3 inline text-indigo-500 ml-1" />;
  }, [sortConfig]);

  const totalPages = Math.ceil(totalPosts / limit);
  const handlePageChange = useCallback((newPage: number) => { if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage); }, [totalPages]);

  const columns = useMemo<ColumnDef[]>(() => [
    { key: 'cover', label: 'Imagem', sortable: false, getVal: (p: IGlobalPostResult) => p.coverUrl || '' },
    { key: 'text_content', label: 'Conteúdo', sortable: false, getVal: (p: IGlobalPostResult) => p.text_content || p.description || 'N/A' },
    { key: 'creatorName', label: 'Criador', sortable: true, getVal: (p: IGlobalPostResult) => p.creatorName || 'N/A' },
    { key: 'postDate', label: 'Data', sortable: true, getVal: (p: IGlobalPostResult) => formatDate(p.postDate) },
    { key: 'tags', label: 'Etiquetas', sortable: false, getVal: (p: IGlobalPostResult) => getTagLabels(p) },
    { key: 'stats.total_interactions', label: 'Interações', sortable: true, getVal: (p: IGlobalPostResult) => getNestedValue(p, 'stats.total_interactions', 0) },
    { key: 'stats.likes', label: 'Likes', sortable: true, getVal: (p: IGlobalPostResult) => getNestedValue(p, 'stats.likes', 0) },
    { key: 'stats.comments', label: 'Comentários', sortable: true, getVal: (p: IGlobalPostResult) => getNestedValue(p, 'stats.comments', 0) },
    { key: 'stats.shares', label: 'Compart.', sortable: true, getVal: (p: IGlobalPostResult) => getNestedValue(p, 'stats.shares', 0) },
    { key: 'stats.saved', label: 'Salvos', sortable: true, getVal: (p: IGlobalPostResult) => getNestedValue(p, 'stats.saved', 0) },
    { key: 'stats.reach', label: 'Alcance', sortable: true, getVal: (p: IGlobalPostResult) => getNestedValue(p, 'stats.reach', 0) },
    { key: 'stats.views', label: 'Views', sortable: true, getVal: (p: IGlobalPostResult) => getNestedValue(p, 'stats.views', 0) },
    { key: 'stats.impressions', label: 'Impressões', sortable: true, getVal: (p: IGlobalPostResult) => getNestedValue(p, 'stats.impressions', 0) },
    { key: 'actions', label: 'Ações', sortable: false, headerClassName: 'text-center', getVal: () => null },
  ], []);

  const AnalysisCard = ({ post, type }: { post: IGlobalPostResult, type: 'best' | 'worst' }) => (
    <div className={`group relative flex flex-col bg-white rounded-2xl shadow-sm border transition-all duration-300 hover:shadow-md ${type === 'best' ? 'border-green-100 hover:border-green-300' : 'border-red-100 hover:border-red-300'}`}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-50">
        <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden ring-2 ring-white shadow-sm shrink-0">
          {post.creatorAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.creatorAvatarUrl} alt={post.creatorName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400 bg-gray-50">{post.creatorName?.charAt(0)}</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{post.creatorName}</p>
          <p className="text-[10px] text-gray-500">{formatDate(post.postDate)}</p>
        </div>
      </div>

      {/* Large Image */}
      <div className="relative w-full aspect-[4/5] bg-gray-100 overflow-hidden cursor-pointer" onClick={() => handleOpenPostDetailModal(post._id!.toString())}>
        {post.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverUrl}
            alt="capa"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/400x500?text=Sem+Imagem'; }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
            <DocumentMagnifyingGlassIcon className="w-12 h-12 opacity-50" />
            <span className="text-xs font-medium">Sem visualização</span>
          </div>
        )}
        {/* Badges */}
        <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
          {post.format && <span className="px-2 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded-lg shadow-sm uppercase tracking-wider">{post.format}</span>}
        </div>
      </div>

      {/* Metrics Strip */}
      <div className={`grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 ${type === 'best' ? 'bg-green-50/50' : 'bg-red-50/50'}`}>
        <div className="p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-0.5">Interações</p>
          <p className={`text-lg font-bold ${type === 'best' ? 'text-green-700' : 'text-red-700'}`}>{formatNumberStd(post.stats?.total_interactions)}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-0.5">Likes</p>
          <p className="text-base font-semibold text-gray-700">{formatNumberStd(post.stats?.likes)}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-0.5">Shares</p>
          <p className="text-base font-semibold text-gray-700">{formatNumberStd(post.stats?.shares)}</p>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed min-h-[4.5em]">
          {post.text_content || post.description || <span className="italic text-gray-400">Sem legenda...</span>}
        </p>

        <div className="mt-auto pt-2 flex flex-wrap gap-1.5">
          {getTagLabels(post).slice(0, 4).map((t, i) => <TagChip key={i} label={t.label} color={t.color} title={t.title} />)}
        </div>

        <button
          onClick={() => handleOpenPostDetailModal(post._id!.toString())}
          className="mt-2 w-full py-2.5 text-xs font-semibold text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-gray-200 hover:border-indigo-200 transition-all flex items-center justify-center gap-2 group-hover:shadow-sm"
        >
          Ver Análise Completa
          <ArrowRightIcon className="w-3 h-3" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Explorador de Posts Globais</h3>
          <p className="text-sm text-gray-500 mt-1">
            {viewMode === 'explorer'
              ? 'Filtre e explore todos os posts da plataforma.'
              : 'Analise os melhores e piores desempenhos para o nicho selecionado.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-gray-100 p-1 rounded-lg flex text-sm font-medium">
            <button
              onClick={() => setViewMode('explorer')}
              className={`px-3 py-1.5 rounded-md transition-all ${viewMode === 'explorer' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Explorador
            </button>
            <button
              onClick={() => setViewMode('analysis')}
              className={`px-3 py-1.5 rounded-md transition-all ${viewMode === 'analysis' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Análise Estratégica
            </button>
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-md shadow-sm hover:bg-gray-50 ml-2"
          >
            {isCollapsed ? 'Expandir' : 'Recolher'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setFiltersOpen(!filtersOpen)} className="text-sm font-medium text-indigo-600 flex items-center gap-1">
                {filtersOpen ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                {filtersOpen ? 'Esconder filtros' : 'Mostrar filtros'}
              </button>
              {Object.values(activeFilters).some(v => v !== undefined) && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Filtros ativos</span>
              )}
            </div>

            {filtersOpen && (
      <div className="p-5 border border-gray-200 rounded-lg bg-gray-50/50">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {forceContext ? null : (
                    <MultiSelectBox id="gpe-context" label="Nicho / Contexto" options={contextOptions} selected={selectedContext} onChange={setSelectedContext} />
                  )}
                  <MultiSelectBox id="gpe-format" label="Formato" options={formatOptions} selected={selectedFormat} onChange={setSelectedFormat} />
                  <MultiSelectBox id="gpe-proposal" label="Proposta" options={proposalOptions} selected={selectedProposal} onChange={setSelectedProposal} />
                  <MultiSelectBox id="gpe-tone" label="Tom" options={toneOptions} selected={selectedTone} onChange={setSelectedTone} />
                  <MultiSelectBox id="gpe-references" label="Referências" options={referenceOptions} selected={selectedReferences} onChange={setSelectedReferences} />
                  <div><label htmlFor="gpe-minInteractions" className="block text-xs font-medium text-gray-600 mb-1">Min. Interações</label><input type="number" id="gpe-minInteractions" value={minInteractionsValue} onChange={(e) => setMinInteractionsValue(e.target.value)} placeholder="Ex: 100" min="0" className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm bg-white h-[38px]" /></div>
                  <div className="md:col-span-2"><label htmlFor="gpe-textSearch" className="block text-xs font-medium text-gray-600 mb-1">Buscar texto</label><input id="gpe-textSearch" type="text" value={textSearch} onChange={(e) => setTextSearch(e.target.value)} placeholder="Palavras-chave no conteúdo..." className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm bg-white h-[38px]" /></div>
                  {/* Filtro de assinantes agora controlado globalmente; seletor removido */}
                </div>
                <div className="mt-4 flex justify-end pt-4 border-t border-gray-200">
                  <button onClick={handleApplyLocalFilters} className="h-[38px] flex items-center justify-center px-6 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 text-sm disabled:bg-indigo-400 transition-colors" disabled={isLoading || isAnalysisLoading}>
                    <MagnifyingGlassIcon className="w-5 h-5 mr-2" />
                    {isLoading || isAnalysisLoading ? 'Buscando...' : 'Aplicar Filtros'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ANALYSIS HIGHLIGHTS SECTION */}
          {viewMode === 'analysis' && (
            <div className="mt-8 mb-12 space-y-10">
              {isAnalysisLoading ? (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <SkeletonBlock height="h-96" />
                    <SkeletonBlock height="h-96" />
                    <SkeletonBlock height="h-96" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <SkeletonBlock height="h-96" />
                    <SkeletonBlock height="h-96" />
                    <SkeletonBlock height="h-96" />
                  </div>
                </div>
              ) : error ? (
                <div className="text-center py-10"><p className="text-red-500">Erro ao carregar análise: {error}</p></div>
              ) : (bestPosts.length === 0 && worstPosts.length === 0) ? (
                <div className="py-10 bg-gray-50 rounded-lg border border-gray-100"><EmptyState icon={<ChartBarIcon className="w-12 h-12" />} title="Sem dados para análise" message="Tente ajustar os filtros para encontrar posts." /></div>
              ) : (
                <>
                  {/* BEST PERFORMING */}
                  <div className="bg-green-50/30 rounded-2xl p-6 border border-green-100">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2.5 bg-green-100 rounded-xl text-green-700 shadow-sm">
                        <ChevronUpIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-gray-900">Melhores Conteúdos</h4>
                        <p className="text-sm text-gray-500">Top 3 por interações totais</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {bestPosts.map(post => <AnalysisCard key={post._id?.toString()} post={post} type="best" />)}
                      {bestPosts.length === 0 && <p className="text-sm text-gray-500 italic col-span-full py-8 text-center">Nenhum post encontrado.</p>}
                    </div>
                  </div>

                  {/* WORST PERFORMING */}
                  <div className="bg-red-50/30 rounded-2xl p-6 border border-red-100">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2.5 bg-red-100 rounded-xl text-red-700 shadow-sm">
                        <ChevronDownIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-gray-900">Piores Conteúdos</h4>
                        <p className="text-sm text-gray-500">Bottom 3 por interações totais</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {worstPosts.map(post => <AnalysisCard key={post._id?.toString()} post={post} type="worst" />)}
                      {worstPosts.length === 0 && <p className="text-sm text-gray-500 italic col-span-full py-8 text-center">Nenhum post encontrado.</p>}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* MAIN POSTS TABLE (Visible in both modes) */}
          <div className="mt-6" ref={postsTableRef}>
            {viewMode === 'analysis' && <h4 className="text-lg font-semibold text-gray-800 mb-4">Todos os Posts</h4>}
            {viewMode === 'analysis' && !postsTableInView ? (
              <div className="py-10 text-center text-gray-500">
                Role para carregar os posts.
              </div>
            ) : isLoading ? (
              <div className="text-center py-10"><SkeletonBlock width="w-48" height="h-6" className="mx-auto" /></div>
            ) : error ? (
              <div className="text-center py-10"><p className="text-red-500">Erro ao carregar posts: {error}</p></div>
            ) : posts.length === 0 ? (
              <div className="py-10"><EmptyState icon={<DocumentMagnifyingGlassIcon className="w-12 h-12" />} title="Nenhum Post Encontrado" message="Experimente alterar os filtros para encontrar resultados." /></div>
            ) : (
              <>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>{columns.map((col) => (<th key={col.key} scope="col" className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${col.key.startsWith('stats.') ? 'text-center' : 'text-left'} ${col.sortable ? 'cursor-pointer hover:bg-gray-100 select-none' : ''}`} onClick={() => col.sortable && handleSort(col.key)}>{col.label} {col.sortable && renderSortIcon(col.key)}</th>))}</tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {posts.map((post) => (
                        <PostsTableRow
                          key={post._id?.toString()}
                          post={post}
                          columns={columns}
                          onOpenPostDetailModal={handleOpenPostDetailModal}
                          onOpenTrendChart={handleOpenTrendChart}
                          onOpenExternalLink={handleOpenExternalLink}
                          onCopyLink={handleCopyLink}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="py-3 flex items-center justify-between border-t border-gray-200 mt-4 text-sm">
                  <p className="text-gray-700">Página <span className="font-medium">{currentPage}</span> de <span className="font-medium">{totalPages}</span> ({totalPosts} posts)</p>
                  <div className="flex-1 flex justify-end space-x-2"><button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1.5 border border-gray-300 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 text-xs">Anterior</button><button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1.5 border border-gray-300 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 text-xs">Próxima</button></div>
                </div>
              </>
            )}
          </div>

          <PostDetailModal
            isOpen={isPostDetailModalOpen}
            onClose={handleClosePostDetailModal}
            postId={selectedPostIdForModal}
            apiPrefix={apiPrefix}
          />

          {isTrendChartOpen && selectedPostIdForTrend && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl relative">
                <button onClick={handleCloseTrendChart} aria-label="Fechar" className="absolute top-2 right-2 p-1.5 text-gray-500 hover:bg-gray-100 rounded-full"><XMarkIcon className="w-5 h-5" /></button>
                <ContentTrendChart postId={selectedPostIdForTrend} apiPrefix={apiPrefix} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});

export default GlobalPostsExplorer;
