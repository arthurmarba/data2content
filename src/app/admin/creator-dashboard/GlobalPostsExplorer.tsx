'use client';

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import { MagnifyingGlassIcon, DocumentMagnifyingGlassIcon, ChartBarIcon, XMarkIcon } from '@heroicons/react/24/outline';

// --- (INCLUSÃO) Definições de Categoria para tornar o componente autocontido ---
// Em um projeto real, estas seriam importadas de um arquivo central como `classification.ts`.

export interface Category {
  id: string;
  label: string;
  description:string;
  keywords?: string[];
  subcategories?: Category[];
  examples?: string[];
  conflictsWith?: string[];
}

// Definições completas das 5 dimensões
export const formatCategories: Category[] = [ { id: 'reel', label: 'Reel', description: 'Vídeo curto e vertical.' }, { id: 'photo', label: 'Foto', description: 'Uma única imagem estática.' }, { id: 'carousel', label: 'Carrossel', description: 'Post com múltiplas imagens ou vídeos.' }, { id: 'story', label: 'Story', description: 'Conteúdo efêmero, vertical.' }, { id: 'live', label: 'Live', description: 'Transmissão de vídeo ao vivo.' }, { id: 'long_video', label: 'Vídeo Longo', description: 'Vídeo mais longo que não se encaixa no formato Reel.' }, ];
export const proposalCategories: Category[] = [ { id: 'announcement', label: 'Anúncio', description: 'Comunica uma novidade importante.' }, { id: 'behind_the_scenes', label: 'Bastidores', description: 'Mostra os bastidores de um projeto.' }, { id: 'call_to_action', label: 'Chamada', description: 'Incentiva o usuário a realizar uma ação.' }, { id: 'comparison', label: 'Comparação', description: 'Compara dois ou mais produtos/serviços.' }, { id: 'humor_scene', label: 'Humor/Cena', description: 'Conteúdo cômico, esquete ou cena engraçada.'}, { id: 'tips', label: 'Dicas', description: 'Fornece conselhos práticos ou tutoriais.'}, { id: 'review', label: 'Review', description: 'Análise ou avaliação de um produto.'}, { id: 'trend', label: 'Trend', description: 'Participação em um desafio ou meme viral.'}, ];
export const contextCategories: Category[] = [ { id: 'lifestyle_and_wellbeing', label: 'Estilo de Vida e Bem-Estar', description: 'Tópicos sobre vida pessoal, saúde e aparência.', subcategories: [ { id: 'fashion_style', label: 'Moda/Estilo', description: 'Looks, tendências de moda.' }, { id: 'fitness_sports', label: 'Fitness/Esporte', description: 'Exercícios, treinos, esportes.' }, ] }, { id: 'personal_and_professional', label: 'Pessoal e Profissional', description: 'Tópicos sobre relacionamentos, carreira e desenvolvimento.', subcategories: [ { id: 'relationships_family', label: 'Relacionamentos/Família', description: 'Família, amizades, relacionamentos.' }, { id: 'career_work', label: 'Carreira/Trabalho', description: 'Desenvolvimento profissional.' }, ] }, ];
export const toneCategories: Category[] = [ { id: 'humorous', label: 'Humorístico', description: 'Intenção de ser engraçado.' }, { id: 'inspirational', label: 'Inspirador', description: 'Busca inspirar ou motivar.' }, { id: 'educational', label: 'Educacional', description: 'Objetivo de ensinar ou informar.' }, { id: 'critical', label: 'Crítico', description: 'Faz uma análise crítica ou opina.' }, { id: 'promotional', label: 'Promocional', description: 'Objetivo de vender ou promover.' }, { id: 'neutral', label: 'Neutro', description: 'Descreve fatos sem carga emocional.' }, ];
export const referenceCategories: Category[] = [ { id: 'pop_culture', label: 'Cultura Pop', description: 'Referências a obras de ficção, celebridades ou memes.', subcategories: [ { id: 'pop_culture_movies_series', label: 'Filmes e Séries', description: 'Referências a filmes e séries.' }, { id: 'pop_culture_books', label: 'Livros', description: 'Referências a livros e universos literários.' }, ] }, { id: 'people_and_groups', label: 'Pessoas e Grupos', description: 'Referências a grupos sociais, profissões ou estereótipos.', subcategories: [ { id: 'regional_stereotypes', label: 'Estereótipos Regionais', description: 'Imitações ou referências a sotaques e costumes.' }, ] }, ];


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

// --- Tipos e Interfaces ---

// ATUALIZADO: A interface IGlobalPostResult agora reflete os campos de classificação como arrays.
// Esta é uma suposição de como a API retornará os dados.
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
const ContentTrendChart: React.FC<ContentTrendChartProps> = ({ postId }) => { /* ... Implementação do Gráfico ... */ return <div className="p-4">Gráfico de Tendência para o Post ID: {postId}</div>; };
const PostDetailModal = ({ isOpen, onClose, postId }: { isOpen: boolean; onClose: () => void; postId: string | null }) => { if (!isOpen) return null; return <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><div className="bg-white p-8 rounded-lg">Detalhes do Post ID: {postId} <button onClick={onClose}>Fechar</button></div></div>; };


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

// ATUALIZADO: Filtros ativos agora incluem as 5 dimensões
interface ActiveFilters {
  context?: string;
  proposal?: string;
  format?: string;
  tone?: string;
  references?: string;
  minInteractions?: number;
}


const GlobalPostsExplorer = memo(function GlobalPostsExplorer({ dateRangeFilter }: GlobalPostsExplorerProps) {
  // ATUALIZADO: Estados para os novos filtros de UI
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

  // Helper para criar as opções do dropdown a partir da estrutura de categorias
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

  // As opções agora são derivadas diretamente das definições de categoria
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

    // ATUALIZADO: Adiciona todos os filtros ativos aos parâmetros da API
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
    // ATUALIZADO: Constrói o objeto de filtros ativos com as 5 dimensões
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
  
  // ATUALIZADO: Colunas incluem `tone` e `references` e lidam com arrays
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
      
      {/* ATUALIZADO: Painel de Filtros com 5 dimensões */}
      <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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

      {/* Tabela de Resultados */}
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

export default GlobalPostsExplorer;
