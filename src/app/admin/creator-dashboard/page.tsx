'use client';

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import { MagnifyingGlassIcon, DocumentMagnifyingGlassIcon, ChartBarIcon, XMarkIcon } from '@heroicons/react/24/outline';

// --- Definições de Categoria para consistência ---
export interface Category {
  id: string;
  label: string;
  description: string;
  subcategories?: Category[];
}

export const formatCategories: Category[] = [ { id: 'reel', label: 'Reel', description: 'Vídeo curto e vertical.' }, { id: 'photo', label: 'Foto', description: 'Uma única imagem estática.' }, { id: 'carousel', label: 'Carrossel', description: 'Post com múltiplas imagens ou vídeos.' }, { id: 'story', label: 'Story', description: 'Conteúdo efêmero, vertical.' }, { id: 'live', label: 'Live', description: 'Transmissão de vídeo ao vivo.' }, { id: 'long_video', label: 'Vídeo Longo', description: 'Vídeo mais longo que não se encaixa no formato Reel.' }, ];
export const proposalCategories: Category[] = [ { id: 'educational', label: 'Educativo', description: 'Conteúdo que visa ensinar algo.' }, { id: 'humor_scene', label: 'Humor', description: 'Conteúdo cômico, esquete ou cena engraçada.'}, { id: 'news', label: 'Notícia', description: 'Informa sobre um acontecimento relevante.' }, { id: 'review', label: 'Review', description: 'Análise ou avaliação de um produto.'}, { id: 'tips', label: 'Tutorial', description: 'Fornece conselhos práticos ou tutoriais.'}, ];
export const contextCategories: Category[] = [ { id: 'lifestyle_and_wellbeing', label: 'Estilo de Vida e Bem-Estar', description: 'Tópicos sobre vida pessoal, saúde e aparência.', subcategories: [ { id: 'fashion_style', label: 'Moda/Estilo', description: 'Looks, tendências de moda.' }, { id: 'fitness_sports', label: 'Fitness/Esporte', description: 'Exercícios, treinos, esportes.' }, ] }, { id: 'personal_and_professional', label: 'Pessoal e Profissional', description: 'Tópicos sobre relacionamentos, carreira e desenvolvimento.', subcategories: [ { id: 'relationships_family', label: 'Relacionamentos/Família', description: 'Família, amizades, relacionamentos.' }, { id: 'career_work', label: 'Carreira/Trabalho', description: 'Desenvolvimento profissional.' }, ] }, ];
export const toneCategories: Category[] = [ { id: 'humorous', label: 'Humorístico', description: 'Intenção de ser engraçado.' }, { id: 'inspirational', label: 'Inspirador', description: 'Busca inspirar ou motivar.' }, { id: 'educational', label: 'Educacional', description: 'Objetivo de ensinar ou informar.' }, { id: 'critical', label: 'Crítico', description: 'Faz uma análise crítica ou opina.' }, { id: 'promotional', label: 'Promocional', description: 'Objetivo de vender ou promover.' }, { id: 'neutral', label: 'Neutro', description: 'Descreve fatos sem carga emocional.' }, ];
export const referenceCategories: Category[] = [ { id: 'pop_culture', label: 'Cultura Pop', description: 'Referências a obras de ficção, celebridades ou memes.', subcategories: [ { id: 'pop_culture_movies_series', label: 'Filmes e Séries', description: 'Referências a filmes e séries.' }, { id: 'pop_culture_books', label: 'Livros', description: 'Referências a livros e universos literários.' }, ] }, { id: 'people_and_groups', label: 'Pessoas e Grupos', description: 'Referências a grupos sociais, profissões ou estereótipos.', subcategories: [ { id: 'regional_stereotypes', label: 'Estereótipos Regionais', description: 'Imitações ou referências a sotaques e costumes.' }, ] }, ];


// --- Contexto, Provider e Hook para o Filtro de Tempo Global ---
type TimePeriod = "last_7_days" | "last_30_days" | "last_90_days" | "last_6_months" | "last_12_months" | "all_time";

interface GlobalTimePeriodContextType {
  timePeriod: TimePeriod;
  setTimePeriod: (period: TimePeriod) => void;
}

const GlobalTimePeriodContext = React.createContext<GlobalTimePeriodContextType | undefined>(undefined);

const GlobalTimePeriodProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('last_30_days');
  const value = { timePeriod, setTimePeriod };
  return (
    <GlobalTimePeriodContext.Provider value={value}>
      {children}
    </GlobalTimePeriodContext.Provider>
  );
};

const useGlobalTimePeriod = () => {
  const context = React.useContext(GlobalTimePeriodContext);
  if (context === undefined) {
    throw new Error('useGlobalTimePeriod must be used within a GlobalTimePeriodProvider');
  }
  return context;
};

// --- Função auxiliar de data ---
const getStartDateFromTimePeriod = (endDate: Date, timePeriod: TimePeriod): Date => {
    const startDate = new Date(endDate);
    switch (timePeriod) {
        case 'last_7_days':
            startDate.setDate(startDate.getDate() - 7);
            break;
        case 'last_30_days':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
        case 'last_90_days':
            startDate.setMonth(startDate.getMonth() - 3);
            break;
        case 'last_6_months':
            startDate.setMonth(startDate.getMonth() - 6);
            break;
        case 'last_12_months':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
        case 'all_time':
            return new Date(0); // Início da Época Unix
    }
    return startDate;
};

// --- Placeholders para componentes não definidos ---
const GlobalTimePeriodFilter: React.FC<any> = ({ selectedTimePeriod, onTimePeriodChange, options }) => (
    <div className="p-2 border rounded-md bg-gray-50">
        <label htmlFor="time-period-filter" className="text-sm font-medium text-gray-700 mr-2">Período:</label>
        <select id="time-period-filter" value={selectedTimePeriod} onChange={(e) => onTimePeriodChange(e.target.value)} className="rounded-md border-gray-300">
            {options.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    </div>
);
const PlatformSummaryKpis: React.FC<any> = ({ startDate, endDate }) => <div className="p-4 bg-blue-50 rounded-lg">PlatformSummaryKpis ({new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()})</div>;
const PlatformOverviewSection: React.FC<any> = (props) => <div className="p-4 bg-green-50 rounded-lg">PlatformOverviewSection</div>;
const PlatformContentAnalysisSection: React.FC<any> = (props) => <div className="p-4 bg-yellow-50 rounded-lg">PlatformContentAnalysisSection</div>;
const ProposalRankingSection: React.FC<any> = (props) => <div className="p-4 bg-purple-50 rounded-lg">ProposalRankingSection</div>;
const CreatorRankingSection: React.FC<any> = (props) => <div className="p-4 bg-pink-50 rounded-lg">CreatorRankingSection</div>;
const TopMoversSection: React.FC<any> = (props) => <div className="p-4 bg-red-50 rounded-lg">TopMoversSection</div>;
const CohortComparisonSection: React.FC<any> = (props) => <div className="p-4 bg-indigo-50 rounded-lg">CohortComparisonSection</div>;
const MarketPerformanceSection: React.FC<any> = (props) => <div className="p-4 bg-teal-50 rounded-lg">MarketPerformanceSection</div>;
const AdvancedAnalysisSection: React.FC<any> = (props) => <div className="p-4 bg-gray-200 rounded-lg">AdvancedAnalysisSection</div>;
const CreatorHighlightsSection: React.FC<any> = (props) => <div className="p-4 bg-orange-50 rounded-lg">CreatorHighlightsSection</div>;
const UserDetailView: React.FC<any> = ({ userId, userName }) => <div className="p-4 bg-cyan-50 rounded-lg mt-4">UserDetailView for {userName} ({userId})</div>;
const CreatorSelector: React.FC<any> = ({ isOpen, onClose, onSelect }) => { if (!isOpen) return null; return <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><div className="bg-white p-8 rounded-lg">Creator Selector <button onClick={onClose}>Fechar</button></div></div>; };
const ScrollToTopButton: React.FC = () => <button className="fixed bottom-4 right-4 bg-indigo-600 text-white p-2 rounded-full shadow-lg">^</button>;


// --- Componentes de Apoio ---

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

// --- Tipos e Interfaces ---
interface IGlobalPostResult {
  _id?: string;
  text_content?: string;
  description?: string;
  creatorName?: string;
  postDate?: Date | string;
  format?: string[];
  proposal?: string[];
  context?: string[];
  tone?: string[];
  references?: string[];
  stats?: {
    total_interactions?: number;
    likes?: number;
    shares?: number;
  };
}

interface ContentTrendChartProps { postId: string; }
const ContentTrendChart: React.FC<ContentTrendChartProps> = ({ postId }) => { return <div className="p-4">Gráfico de Tendência para o Post ID: {postId}</div>; };
const PostDetailModal = ({ isOpen, onClose, postId }: { isOpen: boolean; onClose: () => void; postId: string | null }) => { if (!isOpen) return null; return <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><div className="bg-white p-8 rounded-lg">Detalhes do Post ID: {postId} <button onClick={onClose}>Fechar</button></div></div>; };


// --- Componente GlobalPostsExplorer ---
interface GlobalPostsExplorerProps {
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
  context?: string;
  proposal?: string;
  format?: string;
  tone?: string;
  references?: string;
  minInteractions?: number;
}

const GlobalPostsExplorer = memo(function GlobalPostsExplorer({ dateRangeFilter }: GlobalPostsExplorerProps) {
  // ATUALIZAÇÃO: Adicionados estados para os novos filtros de Tom e Referências
  const [selectedContext, setSelectedContext] = useState<string>('all');
  const [selectedProposal, setSelectedProposal] = useState<string>('all');
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  const [selectedTone, setSelectedTone] = useState<string>('all');
  const [selectedReferences, setSelectedReferences] = useState<string>('all');
  const [minInteractionsValue, setMinInteractionsValue] = useState<string>('');

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

  const formatOptions = createOptionsFromCategories(formatCategories);
  const proposalOptions = createOptionsFromCategories(proposalCategories);
  const contextOptions = createOptionsFromCategories(contextCategories);
  const toneOptions = createOptionsFromCategories(toneCategories);
  const referenceOptions = createOptionsFromCategories(referenceCategories);

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

    // ATUALIZAÇÃO: Novos filtros são adicionados aos parâmetros da requisição
    if (activeFilters.context && activeFilters.context !== 'all') params.append('context', activeFilters.context);
    if (activeFilters.proposal && activeFilters.proposal !== 'all') params.append('proposal', activeFilters.proposal);
    if (activeFilters.format && activeFilters.format !== 'all') params.append('format', activeFilters.format);
    if (activeFilters.tone && activeFilters.tone !== 'all') params.append('tone', activeFilters.tone);
    if (activeFilters.references && activeFilters.references !== 'all') params.append('references', activeFilters.references);
    if (activeFilters.minInteractions) params.append('minInteractions', String(activeFilters.minInteractions));

    if (dateRangeFilter?.startDate) params.append('startDate', new Date(dateRangeFilter.startDate).toISOString());
    if (dateRangeFilter?.endDate) params.append('endDate', new Date(dateRangeFilter.endDate).toISOString());

    try {
      const response = await fetch(`/api/admin/dashboard/posts?${params.toString()}`);
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
  }, [currentPage, limit, sortConfig, activeFilters, dateRangeFilter]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleApplyLocalFilters = useCallback(() => {
    setCurrentPage(1);
    // ATUALIZAÇÃO: Novos filtros são incluídos no objeto de filtros ativos
    setActiveFilters({
      context: selectedContext === 'all' ? undefined : selectedContext,
      proposal: selectedProposal === 'all' ? undefined : selectedProposal,
      format: selectedFormat === 'all' ? undefined : selectedFormat,
      tone: selectedTone === 'all' ? undefined : selectedTone,
      references: selectedReferences === 'all' ? undefined : selectedReferences,
      minInteractions: minInteractionsValue ? parseInt(minInteractionsValue) : undefined,
    });
  }, [selectedContext, selectedProposal, selectedFormat, selectedTone, selectedReferences, minInteractionsValue]);

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
  
  // ATUALIZAÇÃO: Adicionadas colunas para Tom e Referências na tabela
  const columns = [
    { key: 'text_content', label: 'Conteúdo', sortable: false, getVal: (p: IGlobalPostResult) => p.text_content || p.description || 'N/A' },
    { key: 'creatorName', label: 'Criador', sortable: true, getVal: (p: IGlobalPostResult) => p.creatorName || 'N/A' },
    { key: 'postDate', label: 'Data', sortable: true, getVal: (p: IGlobalPostResult) => formatDate(p.postDate) },
    { key: 'format', label: 'Formato', sortable: true, getVal: (p: IGlobalPostResult) => p.format?.join(', ') || 'N/A' },
    { key: 'proposal', label: 'Proposta', sortable: true, getVal: (p: IGlobalPostResult) => p.proposal?.join(', ') || 'N/A' },
    { key: 'context', label: 'Contexto', sortable: true, getVal: (p: IGlobalPostResult) => p.context?.join(', ') || 'N/A' },
    { key: 'tone', label: 'Tom', sortable: true, getVal: (p: IGlobalPostResult) => p.tone?.join(', ') || 'N/A' },
    { key: 'references', label: 'Referências', sortable: true, getVal: (p: IGlobalPostResult) => p.references?.join(', ') || 'N/A' },
    { key: 'stats.total_interactions', label: 'Interações', sortable: true, getVal: (p: IGlobalPostResult) => getNestedValue(p, 'stats.total_interactions', 0) },
    { key: 'actions', label: 'Ações', sortable: false, headerClassName: 'text-center', getVal: () => null },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800">Explorador de Posts Globais</h3>
      <p className="text-sm text-gray-500 mt-1 mb-4">Filtre e explore todos os posts da plataforma com base em diversos critérios.</p>
      
      <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
        {/* ATUALIZAÇÃO: Adicionados dropdowns para os novos filtros de Tom e Referências */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div><label htmlFor="gpe-format" className="block text-xs font-medium text-gray-600 mb-1">Formato</label><select id="gpe-format" value={selectedFormat} onChange={(e) => setSelectedFormat(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm bg-white h-[38px]"><option value="all">Todos os Formatos</option>{formatOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
          <div><label htmlFor="gpe-proposal" className="block text-xs font-medium text-gray-600 mb-1">Proposta</label><select id="gpe-proposal" value={selectedProposal} onChange={(e) => setSelectedProposal(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm bg-white h-[38px]"><option value="all">Todas as Propostas</option>{proposalOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
          <div><label htmlFor="gpe-context" className="block text-xs font-medium text-gray-600 mb-1">Contexto</label><select id="gpe-context" value={selectedContext} onChange={(e) => setSelectedContext(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm bg-white h-[38px]"><option value="all">Todos os Contextos</option>{contextOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
          <div><label htmlFor="gpe-tone" className="block text-xs font-medium text-gray-600 mb-1">Tom</label><select id="gpe-tone" value={selectedTone} onChange={(e) => setSelectedTone(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm bg-white h-[38px]"><option value="all">Todos os Tons</option>{toneOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
          <div><label htmlFor="gpe-references" className="block text-xs font-medium text-gray-600 mb-1">Referências</label><select id="gpe-references" value={selectedReferences} onChange={(e) => setSelectedReferences(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm bg-white h-[38px]"><option value="all">Todas as Referências</option>{referenceOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
          <div><label htmlFor="gpe-minInteractions" className="block text-xs font-medium text-gray-600 mb-1">Min. Interações</label><input type="number" id="gpe-minInteractions" value={minInteractionsValue} onChange={(e) => setMinInteractionsValue(e.target.value)} placeholder="Ex: 100" min="0" className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm bg-white h-[38px]"/></div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={handleApplyLocalFilters} className="h-[38px] flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 text-sm disabled:bg-gray-300" disabled={isLoading}><MagnifyingGlassIcon className="w-5 h-5 mr-2" />{isLoading ? 'Buscando...' : 'Filtrar Posts'}</button>
        </div>
      </div>

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
                          if (col.key.startsWith('stats.')) displayValue = formatNumberStd(rawValue);
                          if (col.key === 'actions') {
                            return (<td key={col.key} className="px-4 py-3 whitespace-nowrap text-center flex items-center justify-center space-x-1"><button onClick={() => handleOpenPostDetailModal(post._id!.toString())} className="text-indigo-600 hover:text-indigo-800 p-1" title="Ver detalhes"><DocumentMagnifyingGlassIcon className="w-5 h-5" /></button><button onClick={() => handleOpenTrendChart(post._id!.toString())} className="text-green-600 hover:text-green-800 p-1" title="Ver tendência"><ChartBarIcon className="w-5 h-5" /></button></td>);
                          }
                          return (<td key={col.key} className={`px-4 py-3 whitespace-nowrap text-gray-600 ${col.key.startsWith('stats.') ? 'text-center' : 'text-left'}`}><span title={String(rawValue)} className="block max-w-[150px] truncate">{displayValue}</span></td>);
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

      <PostDetailModal isOpen={isPostDetailModalOpen} onClose={handleClosePostDetailModal} postId={selectedPostIdForModal} />
      {isTrendChartOpen && selectedPostIdForTrend && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl relative">
            <button onClick={handleCloseTrendChart} aria-label="Fechar" className="absolute top-2 right-2 p-1.5 text-gray-500 hover:bg-gray-100 rounded-full"><XMarkIcon className="w-5 h-5" /></button>
            <ContentTrendChart postId={selectedPostIdForTrend} />
          </div>
        </div>
      )}
    </div>
  );
});


// --- Componente da Página Principal ---

const AdminCreatorDashboardContent: React.FC = () => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);
  const { timePeriod: globalTimePeriod, setTimePeriod: setGlobalTimePeriod } = useGlobalTimePeriod();

  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  const formatOptions = formatCategories.map(c => c.label);
  const proposalOptions = proposalCategories.map(c => c.label);

  const [marketFormat, setMarketFormat] = useState<string>(formatOptions[0]!);
  const [marketProposal, setMarketProposal] = useState<string>(proposalOptions[0]!);

  const today = new Date();
  const startDateObj = getStartDateFromTimePeriod(today, globalTimePeriod);
  const startDate = startDateObj.toISOString();
  const endDate = today.toISOString();
  const rankingDateRange = { startDate, endDate };
  const startDateLabel = startDateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const endDateLabel = today.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const rankingDateLabel = `${startDateLabel} - ${endDateLabel}`;

  const handleUserSelect = (userId: string, userName: string) => {
    setSelectedUserId(userId);
    setSelectedUserName(userName);
    const userDetailSection = document.getElementById("user-detail-view-container");
    if (userDetailSection) {
      userDetailSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gray-100 min-h-screen">
      <header className="mb-8 sticky top-0 z-20 bg-gray-100 pb-4 border-b border-gray-200">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          Dashboard Administrativo de Criadores
        </h1>

        <div className="mt-4 p-4 bg-white rounded-md shadow">
          <GlobalTimePeriodFilter
            selectedTimePeriod={globalTimePeriod}
            onTimePeriodChange={setGlobalTimePeriod}
            options={[
              { value: "last_7_days", label: "Últimos 7 dias" },
              { value: "last_30_days", label: "Últimos 30 dias" },
              { value: "last_90_days", label: "Últimos 90 dias" },
              { value: "last_6_months", label: "Últimos 6 meses" },
              { value: "last_12_months", label: "Últimos 12 meses" },
              { value: "all_time", label: "Todo o período" },
            ]}
          />
        </div>
      </header>

      <section id="platform-summary" className="mb-8">
        <PlatformSummaryKpis startDate={startDate} endDate={endDate} />
      </section>

      <section
        id="creator-selection"
        className="mb-8 p-4 bg-white rounded-lg shadow"
      >
        <h2 className="text-lg font-semibold text-gray-700 mb-3">
          Selecionar Criador para Detalhar
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => setIsSelectorOpen(true)}
            className="p-2 rounded-md text-sm bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
          >
            Buscar Criador
          </button>
          {selectedUserName && (
            <span className="px-2 py-1 text-sm bg-indigo-50 text-indigo-700 rounded">
              {selectedUserName}
            </span>
          )}
          {selectedUserId && (
            <button
              onClick={() => {
                setSelectedUserId(null);
                setSelectedUserName(null);
              }}
              className="p-2 rounded-md text-sm bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
              Limpar seleção e voltar à visão geral
            </button>
          )}
        </div>
      </section>

      {!selectedUserId && (
        <>
          <PlatformOverviewSection
            comparisonPeriod={"month_vs_previous"}
          />
          <PlatformContentAnalysisSection
            startDate={startDate}
            endDate={endDate}
          />
          <ProposalRankingSection
            rankingDateRange={rankingDateRange}
            rankingDateLabel={rankingDateLabel}
          />
          <CreatorRankingSection
            rankingDateRange={rankingDateRange}
            rankingDateLabel={rankingDateLabel}
          />
          <TopMoversSection />
          <CohortComparisonSection startDate={startDate} endDate={endDate} />
          <MarketPerformanceSection
            formatOptions={formatOptions}
            proposalOptions={proposalOptions}
            marketFormat={marketFormat}
            marketProposal={marketProposal}
            setMarketFormat={setMarketFormat}
            setMarketProposal={setMarketProposal}
          />
          <AdvancedAnalysisSection />
          <CreatorHighlightsSection />

          <section id="global-posts-explorer" className="mt-8">
            <GlobalPostsExplorer dateRangeFilter={{ startDate, endDate }} />
          </section>
        </>
      )}

      <div id="user-detail-view-container">
        {selectedUserId && (
          <UserDetailView
            userId={selectedUserId}
            userName={selectedUserName ?? undefined}
          />
        )}
      </div>

      <CreatorSelector
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        onSelect={(creator: {id: string, name: string}) => handleUserSelect(creator.id, creator.name)}
      />
      <ScrollToTopButton />
    </div>
  );
};

const AdminCreatorDashboardPage: React.FC = () => (
  <GlobalTimePeriodProvider>
    <AdminCreatorDashboardContent />
  </GlobalTimePeriodProvider>
);

export default AdminCreatorDashboardPage;
