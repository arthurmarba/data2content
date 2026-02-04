'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PlusIcon, TrashIcon, ExclamationTriangleIcon, TableCellsIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';

// --- (CORREÇÃO) Definições de Categoria ---
// O import foi removido e as definições foram movidas para cá para resolver o erro de compilação.
// Isso torna o componente autocontido.

const FallbackIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
const SafePlusIcon = PlusIcon || FallbackIcon;
const SafeTrashIcon = TrashIcon || FallbackIcon;
const SafeExclamationTriangleIcon = ExclamationTriangleIcon || FallbackIcon;
const SafeTableCellsIcon = TableCellsIcon || FallbackIcon;
const SafeArrowsRightLeftIcon = ArrowsRightLeftIcon || FallbackIcon;

export interface Category {
  id: string;
  label: string;
  description:string;
  keywords?: string[];
  subcategories?: Category[];
  examples?: string[];
  conflictsWith?: string[];
}

export const formatCategories: Category[] = [
  { id: 'reel', label: 'Reel', description: 'Vídeo curto e vertical.' },
  { id: 'photo', label: 'Foto', description: 'Uma única imagem estática.' },
  { id: 'carousel', label: 'Carrossel', description: 'Post com múltiplas imagens ou vídeos.' },
  { id: 'story', label: 'Story', description: 'Conteúdo efêmero, vertical.' },
  { id: 'live', label: 'Live', description: 'Transmissão de vídeo ao vivo.' },
  { id: 'long_video', label: 'Vídeo Longo', description: 'Vídeo mais longo que não se encaixa no formato Reel.' },
];
export const proposalCategories: Category[] = [
    { id: 'announcement', label: 'Anúncio', description: 'Comunica uma novidade importante.' },
    { id: 'behind_the_scenes', label: 'Bastidores', description: 'Mostra os bastidores de um projeto.' },
    { id: 'call_to_action', label: 'Chamada', description: 'Incentiva o usuário a realizar uma ação.' },
    { id: 'comparison', label: 'Comparação', description: 'Compara dois ou mais produtos/serviços.' },
    { id: 'humor_scene', label: 'Humor/Cena', description: 'Conteúdo cômico, esquete ou cena engraçada.'},
    { id: 'tips', label: 'Dicas', description: 'Fornece conselhos práticos ou tutoriais.'},
];
export const contextCategories: Category[] = [
  {
    id: 'lifestyle_and_wellbeing', label: 'Estilo de Vida e Bem-Estar', description: 'Tópicos sobre vida pessoal, saúde e aparência.',
    subcategories: [
      { id: 'fashion_style', label: 'Moda/Estilo', description: 'Looks, tendências de moda, dicas de estilo.' },
      { id: 'fitness_sports', label: 'Fitness/Esporte', description: 'Exercícios, treinos, esportes, vida saudável.' },
    ]
  },
  {
    id: 'personal_and_professional', label: 'Pessoal e Profissional', description: 'Tópicos sobre relacionamentos, carreira e desenvolvimento.',
    subcategories: [
      { id: 'relationships_family', label: 'Relacionamentos/Família', description: 'Família, amizades, relacionamentos amorosos.' },
      { id: 'career_work', label: 'Carreira/Trabalho', description: 'Desenvolvimento profissional, vida corporativa.' },
    ]
  },
];
export const toneCategories: Category[] = [
  { id: 'humorous', label: 'Humorístico', description: 'Intenção de ser engraçado.' },
  { id: 'inspirational', label: 'Inspirador', description: 'Busca inspirar ou motivar.' },
  { id: 'educational', label: 'Educacional', description: 'Objetivo de ensinar ou informar.' },
  { id: 'critical', label: 'Crítico', description: 'Faz uma análise crítica ou opina.' },
  { id: 'promotional', label: 'Promocional', description: 'Objetivo de vender ou promover.' },
  { id: 'neutral', label: 'Neutro', description: 'Descreve fatos sem carga emocional.' },
];
export const referenceCategories: Category[] = [
  {
    id: 'pop_culture', label: 'Cultura Pop', description: 'Referências a obras de ficção, celebridades ou memes.',
    subcategories: [
      { id: 'pop_culture_movies_series', label: 'Filmes e Séries', description: 'Referências a filmes e séries.' },
      { id: 'pop_culture_books', label: 'Livros', description: 'Referências a livros e universos literários.' },
    ]
  },
  {
    id: 'people_and_groups', label: 'Pessoas e Grupos', description: 'Referências a grupos sociais, profissões ou estereótipos.',
    subcategories: [
      { id: 'regional_stereotypes', label: 'Estereótipos Regionais', description: 'Imitações ou referências a sotaques e costumes.' },
    ]
  },
];

// --- Tipos e Componentes ---

export interface ISegmentDefinition {
  format?: string;
  proposal?: string;
  context?: string;
  tone?: string;
  references?: string;
}

export interface ISegmentPerformanceResult {
  postCount?: number;
  avgEngagementRate?: number;
  avgLikes?: number;
  avgShares?: number;
  avgComments?: number;
}

interface SegmentComparisonResultItem {
  name: string;
  criteria: ISegmentDefinition;
  performance: ISegmentPerformanceResult;
}

const EmptyState = ({ icon, title, message }: { icon: React.ReactNode; title: string; message: string; }) => {
  return (
    <div className="text-center py-8">
      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400">
        {icon}
      </div>
      <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
};

const MAX_SEGMENTS = 5;
const MIN_SEGMENTS = 1;

interface SegmentToCompare {
  id: string;
  name?: string;
  criteria: ISegmentDefinition;
}

interface ContentSegmentComparisonProps {
  dateRangeFilter?: {
    startDate?: string;
    endDate?: string;
  };
}

const formatDisplayNumber = (num?: number): string => {
  if (num === null || typeof num === 'undefined') return 'N/A';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2});
};

const formatDisplayPercentage = (num?: number): string => {
  if (num === null || typeof num === 'undefined') return 'N/A';
  return `${(num * 100).toFixed(1)}%`;
};

function generateSegmentNameFromCriteria(criteria: ISegmentDefinition): string {
    const parts: string[] = [];
    if (criteria.format) parts.push(criteria.format);
    if (criteria.proposal) parts.push(criteria.proposal);
    if (criteria.context) parts.push(criteria.context);
    if (criteria.tone) parts.push(criteria.tone);
    if (criteria.references) parts.push(criteria.references);
    if (parts.length === 0) return 'Geral';
    return parts.join(' / ');
}

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


export default function ContentSegmentComparison({ dateRangeFilter }: ContentSegmentComparisonProps) {
  const [segmentsToCompare, setSegmentsToCompare] = useState<SegmentToCompare[]>([
    { id: uuidv4(), criteria: {} },
  ]);
  const [comparisonResults, setComparisonResults] = useState<SegmentComparisonResultItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatOptions = createOptionsFromCategories(formatCategories);
  const proposalOptions = createOptionsFromCategories(proposalCategories);
  const contextOptions = createOptionsFromCategories(contextCategories);
  const toneOptions = createOptionsFromCategories(toneCategories);
  const referenceOptions = createOptionsFromCategories(referenceCategories);

  const handleSegmentChange = (id: string, field: 'name' | keyof ISegmentDefinition, value: string) => {
    setSegmentsToCompare(prevSegments =>
      prevSegments.map(segment => {
        if (segment.id === id) {
          if (field === 'name') {
            return { ...segment, name: value || undefined };
          }
          return {
            ...segment,
            criteria: {
              ...segment.criteria,
              [field]: value || undefined,
            },
          };
        }
        return segment;
      })
    );
  };

  const addSegment = () => {
    if (segmentsToCompare.length < MAX_SEGMENTS) {
      setSegmentsToCompare(prev => [...prev, { id: uuidv4(), criteria: {} }]);
    }
  };

  const removeSegment = (id: string) => {
    if (segmentsToCompare.length > MIN_SEGMENTS) {
      setSegmentsToCompare(prev => prev.filter(segment => segment.id !== id));
    }
  };

  const isSegmentCriteriaEmpty = (criteria: ISegmentDefinition): boolean => {
    return !criteria.format && !criteria.proposal && !criteria.context && !criteria.tone && !criteria.references;
  };

  const canCompare =
    segmentsToCompare.length >= MIN_SEGMENTS &&
    segmentsToCompare.every(seg => !isSegmentCriteriaEmpty(seg.criteria)) &&
    !!dateRangeFilter?.startDate && !!dateRangeFilter?.endDate;

  const handleFetchComparisonData = useCallback(async () => {
    if (!canCompare) {
        setError("Defina critérios para todos os segmentos e selecione um período de datas.");
        return;
    }
    setIsLoading(true);
    setError(null);
    setComparisonResults(null);

    const segmentsPayload = segmentsToCompare.map(s => ({
      name: s.name,
      criteria: s.criteria,
    }));

    try {
      const response = await fetch('/api/admin/dashboard/content-segments/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRange: dateRangeFilter,
          segments: segmentsPayload,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Falha ao buscar dados.`);
      }
      const data: SegmentComparisonResultItem[] = await response.json();
      setComparisonResults(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [segmentsToCompare, dateRangeFilter, canCompare]);

  useEffect(() => {
    if (!dateRangeFilter?.startDate || !dateRangeFilter?.endDate) {
        setComparisonResults(null);
    }
  }, [dateRangeFilter]);

  const metricsForDisplay: { label: string; key: keyof ISegmentPerformanceResult; format: (val: any) => string, isNumeric?: boolean }[] = [
    { label: 'Nº de Posts', key: 'postCount', format: formatDisplayNumber, isNumeric: true },
    { label: 'Taxa de Engaj. Média', key: 'avgEngagementRate', format: formatDisplayPercentage, isNumeric: true },
    { label: 'Likes Médios', key: 'avgLikes', format: formatDisplayNumber, isNumeric: true },
    { label: 'Compart. Médios', key: 'avgShares', format: formatDisplayNumber, isNumeric: true },
    { label: 'Comentários Médios', key: 'avgComments', format: formatDisplayNumber, isNumeric: true },
  ];

  const findBestSegmentValue = (metricKey: keyof ISegmentPerformanceResult, results: SegmentComparisonResultItem[]): number | undefined => {
    if (!results || results.length === 0) return undefined;
    const values = results.map(r => r.performance[metricKey] as number).filter(v => typeof v === 'number' && !isNaN(v));
    if (values.length === 0) return undefined;
    return Math.max(...values);
  };

  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Comparador de Performance de Segmentos de Conteúdo</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Defina e compare métricas de diferentes segmentos de conteúdo com base em 5 dimensões.</p>
      </div>

      <div className="space-y-3">
        {segmentsToCompare.map((segment, index) => (
          <div key={segment.id} className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg space-y-3 bg-white dark:bg-gray-700/30 shadow">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Segmento {index + 1}</h4>
              <button 
                onClick={() => removeSegment(segment.id)} 
                disabled={segmentsToCompare.length <= MIN_SEGMENTS}
                className="p-1.5 rounded-md text-red-500 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed" 
                title="Remover Segmento"
              >
                  <SafeTrashIcon className="w-4 h-4" />
              </button>
            </div>
            <div>
                <label htmlFor={`segmentName-${segment.id}`} className="block text-xs font-medium text-gray-500 dark:text-gray-400">Nome do Segmento (Opcional)</label>
                <input
                type="text"
                id={`segmentName-${segment.id}`}
                value={segment.name || ''}
                onChange={(e) => handleSegmentChange(segment.id, 'name', e.target.value)}
                placeholder={`Ex: Reels de Humor sobre Finanças`}
                className="mt-0.5 w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                <div>
                <label htmlFor={`format-${segment.id}`} className="block text-xs font-medium text-gray-500 dark:text-gray-400">Formato</label>
                <select id={`format-${segment.id}`} value={segment.criteria.format || ""} onChange={(e) => handleSegmentChange(segment.id, 'format', e.target.value)} className="mt-0.5 w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                    <option value="">Qualquer Formato</option>
                    {formatOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                </div>
                <div>
                <label htmlFor={`proposal-${segment.id}`} className="block text-xs font-medium text-gray-500 dark:text-gray-400">Proposta</label>
                <select id={`proposal-${segment.id}`} value={segment.criteria.proposal || ""} onChange={(e) => handleSegmentChange(segment.id, 'proposal', e.target.value)} className="mt-0.5 w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                    <option value="">Qualquer Proposta</option>
                    {proposalOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                </div>
                <div>
                <label htmlFor={`context-${segment.id}`} className="block text-xs font-medium text-gray-500 dark:text-gray-400">Contexto</label>
                <select id={`context-${segment.id}`} value={segment.criteria.context || ""} onChange={(e) => handleSegmentChange(segment.id, 'context', e.target.value)} className="mt-0.5 w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                    <option value="">Qualquer Contexto</option>
                    {contextOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                </div>
                <div>
                <label htmlFor={`tone-${segment.id}`} className="block text-xs font-medium text-gray-500 dark:text-gray-400">Tom</label>
                <select id={`tone-${segment.id}`} value={segment.criteria.tone || ""} onChange={(e) => handleSegmentChange(segment.id, 'tone', e.target.value)} className="mt-0.5 w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                    <option value="">Qualquer Tom</option>
                    {toneOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                </div>
                <div>
                <label htmlFor={`references-${segment.id}`} className="block text-xs font-medium text-gray-500 dark:text-gray-400">Referências</label>
                <select id={`references-${segment.id}`} value={segment.criteria.references || ""} onChange={(e) => handleSegmentChange(segment.id, 'references', e.target.value)} className="mt-0.5 w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                    <option value="">Qualquer Referência</option>
                    {referenceOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                </div>
            </div>
            {isSegmentCriteriaEmpty(segment.criteria) && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center mt-1">
                <SafeExclamationTriangleIcon className="w-3 h-3 mr-1 inline-block" />
                Defina ao menos um critério para este segmento.
                </p>
            )}
          </div>
        ))}
      </div>
      
      <div className="flex items-center space-x-3">
        <button onClick={addSegment} disabled={segmentsToCompare.length >= MAX_SEGMENTS} className="flex items-center bg-white dark:bg-gray-700 text-indigo-600 border border-indigo-300 font-medium py-1.5 px-3 rounded-md text-sm hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed">
          <SafePlusIcon className="w-5 h-5 mr-1.5" /> Adicionar Segmento
        </button>
        <button onClick={handleFetchComparisonData} disabled={!canCompare || isLoading} className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 disabled:opacity-50">
          <SafeArrowsRightLeftIcon className="w-5 h-5 mr-2" /> {isLoading ? 'A comparar...' : 'Comparar Segmentos'}
        </button>
      </div>
       {!canCompare && !isLoading && (
          <div className="p-3 bg-yellow-50 border border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-700/50 rounded-md text-yellow-700 dark:text-yellow-300 text-sm flex items-center">
            <SafeExclamationTriangleIcon className="w-5 h-5 mr-2" />
            {!dateRangeFilter?.startDate || !dateRangeFilter?.endDate
              ? 'Por favor, selecione um período de datas nos filtros globais para poder comparar.'
              : 'Por favor, defina ao menos um critério para cada segmento que deseja comparar.'}
          </div>
        )}
      
      {/* Zona de Resultados */}
      <div className="mt-6">
        {isLoading && <EmptyState icon={<SafeArrowsRightLeftIcon className="animate-spin" />} title="Carregando resultados da comparação..." message="Isto pode levar alguns segundos."/>}
        {error && <EmptyState icon={<SafeExclamationTriangleIcon/>} title="Erro ao comparar segmentos" message={error} />}
        {comparisonResults && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-100 dark:bg-gray-700 z-10">Métrica</th>
                  {comparisonResults.map(result => (
                    <th key={result.name} className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex flex-col items-center">
                        <span className='font-semibold text-gray-700 dark:text-gray-200'>{result.name || generateSegmentNameFromCriteria(result.criteria)}</span>
                        <span className='font-normal normal-case text-gray-500 dark:text-gray-400'>({generateSegmentNameFromCriteria(result.criteria)})</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {metricsForDisplay.map(metric => {
                  const bestVal = metric.isNumeric ? findBestSegmentValue(metric.key, comparisonResults) : undefined;
                  return (
                    <tr key={metric.key}>
                      <td className="px-3 py-2.5 text-sm font-medium text-gray-800 dark:text-gray-200 sticky left-0 bg-white dark:bg-gray-800 z-0">{metric.label}</td>
                      {comparisonResults.map(result => {
                        const rawVal = result.performance[metric.key];
                        const isBest = metric.isNumeric && typeof rawVal === 'number' && rawVal === bestVal && bestVal !== 0;
                        return (
                          <td key={`${result.name}-${metric.key}`} className={`px-3 py-2.5 text-sm text-center tabular-nums ${isBest ? 'font-bold text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'}`}>
                            {metric.format(rawVal)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && !error && !comparisonResults && (
             <EmptyState icon={<SafeTableCellsIcon/>} title="Nenhuma comparação realizada" message="Defina seus segmentos e clique em 'Comparar Segmentos' para ver os resultados aqui."/>
        )}
      </div>
    </div>
  );
}
