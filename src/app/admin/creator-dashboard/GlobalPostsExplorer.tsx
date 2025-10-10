'use client';

import Image from 'next/image';
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import { MagnifyingGlassIcon, DocumentMagnifyingGlassIcon, ChartBarIcon, XMarkIcon } from '@heroicons/react/24/outline';
import {
  Category,
  formatCategories,
  proposalCategories,
  contextCategories,
  toneCategories,
  referenceCategories,
  idsToLabels,
  commaSeparatedIdsToLabels,
} from '../../lib/classification';


// --- Componentes de Apoio (Definidos localmente para autonomia) ---

const SkeletonBlock = ({ width = 'w-full', height = 'h-4', className = '', variant = 'rectangle' }: { width?: string; height?: string; className?: string; variant?: 'rectangle' | 'circle' }) => {
  const baseClasses = "bg-gray-200 animate-pulse";
  const shapeClass = variant === 'circle' ? 'rounded-full' : 'rounded';
  return <div className={`${baseClasses} ${width} ${height} ${shapeClass} ${className}`}></div>;
};

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
  postDate?: Date | string;
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
}


const GlobalPostsExplorer = memo(function GlobalPostsExplorer({ apiPrefix = '/api/admin', dateRangeFilter }: GlobalPostsExplorerProps) {
  const [selectedContext, setSelectedContext] = useState<string[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<string[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<string[]>([]);
  const [selectedTone, setSelectedTone] = useState<string[]>([]);
  const [selectedReferences, setSelectedReferences] = useState<string[]>([]);
  const [minInteractionsValue, setMinInteractionsValue] = useState<string>('');
  const [textSearch, setTextSearch] = useState('');

  const [isCollapsed, setIsCollapsed] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [posts, setPosts] = useState<IGlobalPostResult[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ sortBy: 'postDate', sortOrder: 'desc' });
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});

  const [isPostDetailModalOpen, setIsPostDetailModalOpen] = useState(false);
  const [selectedPostIdForModal, setSelectedPostIdForModal] = useState<string | null>(null);
  const [isTrendChartOpen, setIsTrendChartOpen] = useState(false);
  const [selectedPostIdForTrend, setSelectedPostIdForTrend] = useState<string | null>(null);

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

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(limit),
      sortBy: sortConfig.sortBy,
      sortOrder: sortConfig.sortOrder,
    });

    if (activeFilters.context && activeFilters.context.length) params.append('context', activeFilters.context.join(','));
    if (activeFilters.proposal && activeFilters.proposal.length) params.append('proposal', activeFilters.proposal.join(','));
    if (activeFilters.format && activeFilters.format.length) params.append('format', activeFilters.format.join(','));
    if (activeFilters.tone && activeFilters.tone.length) params.append('tone', activeFilters.tone.join(','));
    if (activeFilters.references && activeFilters.references.length) params.append('references', activeFilters.references.join(','));
    if (activeFilters.minInteractions) params.append('minInteractions', String(activeFilters.minInteractions));
    if (activeFilters.searchText) params.append('searchText', activeFilters.searchText);

    if (dateRangeFilter?.startDate) params.append('startDate', new Date(dateRangeFilter.startDate).toISOString());
    if (dateRangeFilter?.endDate) params.append('endDate', new Date(dateRangeFilter.endDate).toISOString());

    try {
      const postsUrl = `${apiPrefix}/dashboard/posts?${params.toString()}`;
      const response = await fetch(postsUrl);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch posts: ${response.statusText}`);
      }
      const data = await response.json();
      setPosts(data.posts || []);
      setTotalPosts(data.totalPosts || 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, limit, sortConfig, activeFilters, dateRangeFilter, apiPrefix]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

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
    });
  }, [selectedContext, selectedProposal, selectedFormat, selectedTone, selectedReferences, minInteractionsValue, textSearch]);

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
  const formatDate = (dateString?: Date | string) => !dateString ? 'N/A' : new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const getNestedValue = (obj: any, path: string, defaultValue: any = 'N/A') => path.split('.').reduce((acc, part) => acc && acc[part], obj) ?? defaultValue;
  const formatNumberStd = (val: any) => !isNaN(parseFloat(String(val))) ? parseFloat(String(val)).toLocaleString('pt-BR') : 'N/A';

  const formatClassValue = (val: string[] | string | undefined, type: 'format'|'proposal'|'context'|'tone'|'reference') => {
    if (!val) return 'N/A';
    if (Array.isArray(val)) {
      const labels = idsToLabels(val, type);
      return labels.length > 0 ? labels.join(', ') : 'N/A';
    }
    const labels = commaSeparatedIdsToLabels(val, type);
    return labels || 'N/A';
  };
  
  // Etiquetas (chips) combinadas para otimizar espaço
  const getTagLabels = (post: IGlobalPostResult) => {
    const items: { label: string; color: string; title: string }[] = [];
    const push = (labels: string[] | string | undefined, color: string, titlePrefix: string, type: 'format'|'proposal'|'context'|'tone'|'reference') => {
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

  const TagChip = ({ label, color, title }: { label: string; color: string; title: string }) => (
    <span title={title} className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium ring-1 ring-inset ${color} mr-1 mb-1 max-w-[120px] truncate`}>
      {label}
    </span>
  );

  const columns = useMemo(() => [
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Explorador de Posts Globais</h3>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-indigo-700"
        >
          {isCollapsed ? 'Expandir' : 'Recolher'}
        </button>
      </div>
      {!isCollapsed && (
        <>
          <p className="text-sm text-gray-500 mt-1 mb-4">Filtre e explore todos os posts da plataforma com base em diversos critérios.</p>
      
      <div className="mb-2 sm:mb-4">
        <button onClick={() => setFiltersOpen(!filtersOpen)} className="text-sm text-indigo-600 sm:hidden">
          {filtersOpen ? 'Esconder filtros' : 'Mostrar filtros'}
        </button>
      </div>
      {filtersOpen && (
      <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <MultiSelectBox id="gpe-format" label="Formato" options={formatOptions} selected={selectedFormat} onChange={setSelectedFormat} />
          <MultiSelectBox id="gpe-proposal" label="Proposta" options={proposalOptions} selected={selectedProposal} onChange={setSelectedProposal} />
          <MultiSelectBox id="gpe-context" label="Contexto" options={contextOptions} selected={selectedContext} onChange={setSelectedContext} />
          <MultiSelectBox id="gpe-tone" label="Tom" options={toneOptions} selected={selectedTone} onChange={setSelectedTone} />
          <MultiSelectBox id="gpe-references" label="Referências" options={referenceOptions} selected={selectedReferences} onChange={setSelectedReferences} />
          <div><label htmlFor="gpe-minInteractions" className="block text-xs font-medium text-gray-600 mb-1">Min. Interações</label><input type="number" id="gpe-minInteractions" value={minInteractionsValue} onChange={(e) => setMinInteractionsValue(e.target.value)} placeholder="Ex: 100" min="0" className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm bg-white h-[38px]"/></div>
          <div><label htmlFor="gpe-textSearch" className="block text-xs font-medium text-gray-600 mb-1">Buscar texto</label><input id="gpe-textSearch" type="text" value={textSearch} onChange={(e) => setTextSearch(e.target.value)} placeholder="Buscar texto..." className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm bg-white h-[38px]" /></div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={handleApplyLocalFilters} className="h-[38px] flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 text-sm disabled:bg-gray-300" disabled={isLoading}><MagnifyingGlassIcon className="w-5 h-5 mr-2" />{isLoading ? 'Buscando...' : 'Filtrar Posts'}</button>
        </div>
      </div>
      )}

      <div className="mt-6">
        {isLoading ? (
          <div className="text-center py-10"><SkeletonBlock width="w-48" height="h-6" className="mx-auto" /></div>
        ) : error ? (
          <div className="text-center py-10"><p className="text-red-500">Erro ao carregar posts: {error}</p></div>
        ) : posts.length === 0 ? (
          <div className="py-10"><EmptyState icon={<DocumentMagnifyingGlassIcon className="w-12 h-12"/>} title="Nenhum Post Encontrado" message="Experimente alterar os filtros."/></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-100">
                  <tr>{columns.map((col) => (<th key={col.key} scope="col" className={`px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap ${col.key.startsWith('stats.') ? 'text-center' : 'text-left'} ${col.sortable ? 'cursor-pointer hover:bg-gray-200' : ''}`} onClick={() => col.sortable && handleSort(col.key)}>{col.label} {col.sortable && renderSortIcon(col.key)}</th>))}</tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {posts.map((post) => (
                    <tr key={post._id?.toString()} className="hover:bg-gray-50">
                      {columns.map(col => {
                          const rawValue = col.getVal(post);
                          let displayValue: React.ReactNode = rawValue;
                          if (col.key.startsWith('stats.')) displayValue = (
                            <span title={String(rawValue)} className="tabular-nums">{formatNumberStd(rawValue)}</span>
                          );
                          if (col.key === 'cover') {
                            return (
                              <td key="cover" className="px-3 py-2 whitespace-nowrap">
                                {rawValue ? ( // eslint-disable-next-line @next/next/no-img-element
                                  <Image
                                    src={rawValue}
                                    alt="capa"
                                    width={160}
                                    height={160}
                                    className="w-40 h-40 object-cover rounded" // eslint-disable-line @next/next/no-img-element
                                    onError={(e) => {
                                      const t = e.currentTarget as HTMLImageElement;
                                      t.onerror = null;
                                      t.src = 'https://placehold.co/160x160?text=%3F';
                                    }} 
                                  />
                                ) : (
                                  '–'
                                )}
                              </td>
                            );
                          }
                          if (col.key === 'tags') {
                            const chips = rawValue as ReturnType<typeof getTagLabels>;
                            const MAX = 6;
                            const shown = chips.slice(0, MAX);
                            const extra = chips.length - shown.length;
                            return (
                              <td key="tags" className="px-4 py-3 whitespace-nowrap text-left">
                                <div className="max-w-[300px] flex flex-wrap">
                                  {shown.map((c, i) => <TagChip key={`${c.label}_${i}`} label={c.label} color={c.color} title={c.title} />)}
                                  {extra > 0 && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200">+{extra}</span>
                                  )}
                                </div>
                              </td>
                            );
                          }
                          if (col.key === 'actions') {
                            return (
                              <td key={col.key} className="px-4 py-3 whitespace-nowrap text-center flex items-center justify-center space-x-1">
                                <button onClick={() => handleOpenPostDetailModal(post._id!.toString())} className="text-indigo-600 hover:text-indigo-800 p-1 flex items-center" title="Ver detalhes">
                                  <DocumentMagnifyingGlassIcon className="w-5 h-5" />
                                  <span className="sr-only lg:not-sr-only lg:ml-1">Detalhes</span>
                                </button>
                                <button onClick={() => handleOpenTrendChart(post._id!.toString())} className="text-green-600 hover:text-green-800 p-1 flex items-center" title="Ver tendência">
                                  <ChartBarIcon className="w-5 h-5" />
                                  <span className="sr-only lg:not-sr-only lg:ml-1">Tendência</span>
                                </button>
                              </td>
                            );
                          }
                          return (
                            <td key={col.key} className={`px-4 py-3 whitespace-nowrap text-gray-600 ${col.key.startsWith('stats.') ? 'text-center' : 'text-left'}`}> 
                              <span title={String(rawValue)} className="block max-w-[150px] truncate">{displayValue}</span>
                            </td>
                          );
                      })}
                    </tr>
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

      {/* CORRIGIDO: Passando apiPrefix para o componente */}
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
            {/* CORRIGIDO: Passando apiPrefix para o componente */}
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
