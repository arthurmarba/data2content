'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Sparkles,
  CalendarDays,
  Clock,
  ChevronRight,
  TestTube2,
  Users,
  Heart,
  Eye,
  MessageSquare,
  Share2,
  Bookmark,
  Calendar,
  Trophy,
  Mail,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import VideosTable from '@/app/admin/creator-dashboard/components/VideosTable';
import { UserAvatar } from '@/app/components/UserAvatar';
import AverageMetricRow from '@/app/dashboard/components/AverageMetricRow';
import PostDetailModal from '@/app/admin/creator-dashboard/PostDetailModal';
import { MediaKitViewProps, VideoListItem } from '@/types/mediakit';
import { useGlobalTimePeriod, GlobalTimePeriodProvider } from '@/app/admin/creator-dashboard/components/filters/GlobalTimePeriodContext';
import { getCategoryById, commaSeparatedIdsToLabels } from '@/app/lib/classification';
import { usePlannerData, PlannerUISlot } from '@/hooks/usePlannerData';
import PlannerSlotModal, { PlannerSlotData as PlannerSlotDataModal } from '@/app/mediakit/components/PlannerSlotModal';
import SubscribeCtaBanner from '@/app/mediakit/components/SubscribeCtaBanner';
import AffiliateCard from '@/components/affiliate/AffiliateCard';
import { useSession } from 'next-auth/react';

/**
 * UTILS & CONSTANTS
 */

type PlannerCategoryKey = 'format' | 'proposal' | 'context' | 'tone' | 'reference';
const PLANNER_CATEGORY_KEYS = ['format', 'proposal', 'context', 'tone', 'reference'] as const;
const CATEGORY_STYLES: Record<PlannerCategoryKey, string> = {
  format: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  proposal: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  context: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  tone: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  reference: 'bg-pink-50 text-pink-700 ring-1 ring-pink-200',
};

/**
 * MultiItemCarousel — carrossel horizontal com drag (mobile-first)
 */
const MultiItemCarousel = ({ children }: { children: React.ReactNode }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [constraint, setConstraint] = useState(0);

  const calculateConstraints = useCallback(() => {
    const wrapW = wrapRef.current?.getBoundingClientRect().width ?? 0;
    const innerW = innerRef.current?.scrollWidth ?? 0;
    const max = Math.max(0, innerW - wrapW);
    setConstraint(max);
  }, []);

  useEffect(() => {
    calculateConstraints();
  }, [children, calculateConstraints]);

  useEffect(() => {
    const handle = () => calculateConstraints();
    window.addEventListener('resize', handle);
    const timer = setTimeout(handle, 150);
    return () => {
      window.removeEventListener('resize', handle);
      clearTimeout(timer);
    };
  }, [calculateConstraints]);

  return (
    <div className="relative -mx-6 sm:-mx-8 px-6 sm:px-8" ref={wrapRef}>
      <motion.div className="overflow-hidden cursor-grab" whileTap={{ cursor: 'grabbing' }}>
        <motion.div
          ref={innerRef}
          className="flex gap-4"
          drag="x"
          dragConstraints={{ right: 0, left: -constraint }}
          dragElastic={0.05}
        >
          {React.Children.map(children, (child, i) => (
            <div key={i} className="flex-shrink-0 w-[60%] sm:w-[45%] md:w-[33%] lg:w-1/4">
              {child}
            </div>
          ))}
        </motion.div>
      </motion.div>
      <div className="absolute top-0 right-0 bottom-0 w-16 bg-gradient-to-l from-white pointer-events-none" />
    </div>
  );
};

/** Converte PlannerUISlot -> contrato do modal */
function toPlannerSlotData(slot: PlannerUISlot | null): PlannerSlotDataModal | null {
  if (!slot) return null;
  return {
    dayOfWeek: slot.dayOfWeek,
    blockStartHour: slot.blockStartHour,
    format: (slot as any).format || 'reel',
    categories: slot.categories,
    status: slot.status as any,
    isExperiment: (slot as any).isExperiment,
    expectedMetrics: slot.expectedMetrics as any,
    title: (slot as any).title,
    scriptShort: (slot as any).scriptShort,
    themes: (slot as any).themes,
    themeKeyword: (slot as any).themeKeyword,
  };
}

/** Retorna início da semana (Domingo) em YYYY-MM-DD */
function getWeekStartISO(date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0..6 (0=Dom)
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

// Extrai bio de vários caminhos comuns
function extractIgBio(obj: any): string | null {
  if (!obj) return null;
  const tryPaths = [
    'biography', 'bio',
    'instagram.biography', 'instagram.bio',
    'ig.biography', 'ig.bio',
    'profile.biography', 'profile.bio',
    'social.instagram.biography', 'social.instagram.bio',
    'accountData.biography', 'account.biography',
    'instagram_user.biography', 'instagram_user.bio',
  ];
  for (const path of tryPaths) {
    const val = path.split('.').reduce((acc: any, key: string) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
    if (typeof val === 'string' && val.trim().length) return val.trim();
  }
  return null;
}

/**
 * COMPONENTES: Destaques / Rankings
 */
interface HighlightItem {
  name: string;
  metricName: string;
  valueFormatted: string;
  postsCount?: number;
}
interface HighlightCardProps {
  title: string;
  highlight: HighlightItem | null;
  icon: React.ReactNode;
  bgColorClass: string;
  textColorClass: string;
}

const HighlightCard = ({ title, highlight, icon, bgColorClass, textColorClass }: HighlightCardProps) => {
  if (!highlight) return null;
  return (
    <div className={`p-4 rounded-lg h-full flex flex-col ${bgColorClass}`}>
      <h4 className={`text-sm font-semibold mb-2 flex items-center ${textColorClass}`}>
        {icon}
        <span className="ml-2">{title}</span>
      </h4>
      <div className="flex-grow">
        <p className="text-lg sm:text-xl font-bold text-gray-800 break-words">{highlight.name}</p>
        <p className="text-xs text-gray-500 mt-1">
          {highlight.metricName}: {highlight.valueFormatted}
        </p>
      </div>
      {highlight.postsCount && (
        <p className="text-xs text-gray-500 mt-2">{highlight.postsCount} posts na amostra</p>
      )}
    </div>
  );
};

const PerformanceHighlightsCarousel = ({ userId }: { userId: string }) => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { timePeriod } = useGlobalTimePeriod();

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const response = await fetch(
          `/api/v1/users/${userId}/highlights/performance-summary?timePeriod=${timePeriod}`
        );
        const result = await response.json();
        setSummary(result);
      } catch (error) {
        console.error('Failed to fetch performance highlights', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId, timePeriod]);

  if (loading) {
    return (
      <MultiItemCarousel>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-full h-48 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </MultiItemCarousel>
    );
  }
  if (!summary) return <p className="text-gray-500">Não foi possível carregar os destaques.</p>;

  const getPortugueseWeekdayName = (dow0to6: number): string =>
    ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][((dow0to6 % 7) + 7) % 7] || '';

  const cards = [
    <HighlightCard
      key="best-format"
      title="Melhor Formato"
      highlight={summary.topPerformingFormat}
      icon={<TrendingUp size={18} />}
      bgColorClass="bg-green-50"
      textColorClass="text-green-600"
    />,
    <HighlightCard
      key="main-context"
      title="Contexto Principal"
      highlight={summary.topPerformingContext}
      icon={<Sparkles size={18} />}
      bgColorClass="bg-blue-50"
      textColorClass="text-blue-600"
    />,
    <HighlightCard
      key="worst-format"
      title="Menor Performance (Formato)"
      highlight={summary.lowPerformingFormat}
      icon={<TrendingDown size={18} />}
      bgColorClass="bg-red-50"
      textColorClass="text-red-600"
    />,
    <HighlightCard
      key="best-proposal"
      title="Melhor Proposta"
      highlight={summary.topPerformingProposal}
      icon={<Sparkles size={18} />}
      bgColorClass="bg-purple-50"
      textColorClass="text-purple-600"
    />,
    <HighlightCard
      key="best-tone"
      title="Melhor Tom"
      highlight={summary.topPerformingTone}
      icon={<Sparkles size={18} />}
      bgColorClass="bg-amber-50"
      textColorClass="text-amber-600"
    />,
    <HighlightCard
      key="best-ref"
      title="Melhor Referência"
      highlight={summary.topPerformingReference}
      icon={<Sparkles size={18} />}
      bgColorClass="bg-teal-50"
      textColorClass="text-teal-600"
    />,
    <HighlightCard
      key="best-day"
      title="Melhor Dia"
      highlight={
        summary.bestDay
          ? {
              name: `🗓️ ${getPortugueseWeekdayName(summary.bestDay.dayOfWeek)}`,
              metricName: 'Interações (média)',
              valueFormatted: summary.bestDay.average?.toFixed?.(1) ?? '—',
            }
          : null
      }
      icon={<CalendarDays size={18} />}
      bgColorClass="bg-indigo-50"
      textColorClass="text-indigo-600"
    />,
  ].filter(Boolean) as React.ReactNode[];

  return <MultiItemCarousel>{cards}</MultiItemCarousel>;
};

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
}
const SectionCard = ({ title, children }: SectionCardProps) => (
  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 h-full">
    <h4 className="text-sm font-semibold text-gray-800 mb-2">{title}</h4>
    {children}
  </div>
);

interface RankItem {
  category: string;
  value: number;
}
type CategoryKey = 'format' | 'proposal' | 'context';

interface MetricListProps {
  items: RankItem[];
  type: CategoryKey;
}

// Fallback robusto: tenta classification -> commaSeparatedIdsToLabels -> Title Case do id
const idToLabel = (id: string | number, type: CategoryKey) => {
  const rawId = String(id ?? '').trim();
  if (!rawId) return '—';
  try {
    const found = (getCategoryById as any)?.(rawId, type);
    if (found?.label) return String(found.label);
  } catch {}
  try {
    const viaComma = (commaSeparatedIdsToLabels as any)?.(rawId, type);
    if (viaComma && String(viaComma).length > 0) return String(viaComma);
  } catch {}
  return rawId
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

const MetricList = ({ items, type }: MetricListProps) => (
  <ul className="space-y-1 text-sm">
    {items.map((it, idx) => (
      <li key={`${it.category}-${idx}`} className="flex justify-between">
        <span className="truncate pr-2" title={String(it.category)}>{idToLabel(it.category, type)}</span>
        <span className="tabular-nums text-gray-700">{new Intl.NumberFormat('pt-BR').format(it.value)}</span>
      </li>
    ))}
  </ul>
);

const CategoryRankingsCarousel = ({ userId }: { userId: string }) => {
  const [rankings, setRankings] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllRankings = async () => {
      if (!userId) return;
      setLoading(true);

      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const fetchCategoryRanking = async (category: CategoryKey, metric: string) => {
        const qs = new URLSearchParams({ category, metric, startDate, endDate, limit: '5', userId });
        const res = await fetch(`/api/admin/dashboard/rankings/categories?${qs.toString()}`);
        return res.ok ? res.json() : [];
      };

      try {
        const [fp, fa, pp, pa, cp, ca] = await Promise.all([
          fetchCategoryRanking('format', 'posts'),
          fetchCategoryRanking('format', 'avg_total_interactions'),
          fetchCategoryRanking('proposal', 'posts'),
          fetchCategoryRanking('proposal', 'avg_total_interactions'),
          fetchCategoryRanking('context', 'posts'),
          fetchCategoryRanking('context', 'avg_total_interactions'),
        ]);
        setRankings({ fp, fa, pp, pa, cp, ca });
      } catch (error) {
        console.error('Failed to fetch rankings', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllRankings();
  }, [userId]);

  if (loading) {
    return (
      <MultiItemCarousel>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="w-full h-64 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </MultiItemCarousel>
    );
  }
  if (!Object.keys(rankings).length)
    return <p className="text-gray-500">Não foi possível carregar os rankings.</p>;

  const cards = [
    <SectionCard key="format-posts" title="Formato: Mais Publicados">
      <MetricList items={rankings.fp} type="format" />
    </SectionCard>,
    <SectionCard key="format-avg" title="Formato: Maior Média de Interações">
      <MetricList items={rankings.fa} type="format" />
    </SectionCard>,
    <SectionCard key="proposal-posts" title="Proposta: Mais Publicados">
      <MetricList items={rankings.pp} type="proposal" />
    </SectionCard>,
    <SectionCard key="proposal-avg" title="Proposta: Maior Média de Interações">
      <MetricList items={rankings.pa} type="proposal" />
    </SectionCard>,
    <SectionCard key="context-posts" title="Contexto: Mais Publicados">
      <MetricList items={rankings.cp} type="context" />
    </SectionCard>,
    <SectionCard key="context-avg" title="Contexto: Maior Média de Interações">
      <MetricList items={rankings.ca} type="context" />
    </SectionCard>,
  ];
  return <MultiItemCarousel>{cards}</MultiItemCarousel>;
};

/**
 * Planner (lista) + Modal conectado
 */
const PlannerRowCard = ({
  slot,
  onOpen,
}: {
  slot: PlannerUISlot;
  onOpen: (slot: PlannerUISlot) => void;
}) => {
  const { dayOfWeek, blockStartHour, title, categories, expectedMetrics, status } = slot;

  const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const norm = ((dayOfWeek % 7) + 7) % 7;
  const dayLabel = DAYS_PT[norm];
  const end = (blockStartHour + 3) % 24;
  const blockLabel = `${String(blockStartHour).padStart(2, '0')}h - ${String(end).padStart(2, '0')}h`;

  const expectedViewsNum =
    typeof expectedMetrics?.viewsP50 === 'number' ? (expectedMetrics!.viewsP50 as number) : null;
  const expectedViewsLabel =
    expectedViewsNum && expectedViewsNum > 0 ? `${(expectedViewsNum / 1000).toFixed(1)}k` : null;

  const isTest = status === 'test';

  const categoryItems: React.ReactNode[] = Object.entries(categories ?? {}).reduce<React.ReactNode[]>(
    (acc, [key, value]) => {
      if (!(PLANNER_CATEGORY_KEYS as readonly string[]).includes(key)) return acc;
      const typedKey = key as PlannerCategoryKey;
      const valueAsString = Array.isArray(value) ? value.join(',') : value ?? '';
      const raw = commaSeparatedIdsToLabels(String(valueAsString), typedKey as any);
      const labels = String(raw)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/_/g, ' ').toLowerCase())
        .map((s) =>
          s
            .split(' ')
            .filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')
        );
      if (!labels.length) return acc;
      const style = CATEGORY_STYLES[typedKey] ?? 'bg-gray-100 text-gray-700 ring-1 ring-gray-200';
      labels.forEach((label) => {
        acc.push(
          <span
            key={`${typedKey}:${label}`}
            className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full ${style} whitespace-nowrap leading-5`}
            title={`${typedKey}: ${label}`}
          >
            {label}
          </span>
        );
      });
      return acc;
    },
    []
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 w-full hover:shadow-md transition-shadow duration-200">
      <div className="grid grid-cols-12 gap-3 sm:gap-4 items-center">
        {/* Col A — Dia/Hora/Título */}
        <div className="col-span-12 sm:col-span-3 flex sm:block items-center gap-3 min-w-0">
          <div className="shrink-0 text-left">
            <div className="text-lg sm:text-xl font-extrabold tracking-tight text-gray-900">{dayLabel}</div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs sm:text-sm">
              <Clock size={12} /> {blockLabel}
            </div>
          </div>

          <div
            className="min-w-0 sm:mt-2 text-[11px] sm:text-xs text-pink-600 font-semibold truncate"
            title={String(title ?? '')}
          >
            {String(title ?? '')}
          </div>
        </div>

        {/* Col B — Categorias */}
        <div className="col-span-12 sm:col-span-6 min-w-0">
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {categoryItems.length > 0 ? (
              categoryItems
            ) : (
              <span className="text-sm text-gray-400">Sem categorias definidas</span>
            )}
          </div>
        </div>

        {/* Col C — Métricas/Ação */}
        <div className="col-span-12 sm:col-span-3 flex items-center justify-between gap-2">
          {isTest ? (
            <div className="flex items-center sm:flex-col sm:items-end text-yellow-600">
              <TestTube2 size={18} className="mr-2 sm:mr-0" />
              <span className="text-xs sm:text-sm font-bold">TESTE</span>
            </div>
          ) : expectedViewsLabel ? (
            <div className="text-left">
              <div className="text-xl sm:text-2xl font-bold text-green-600 leading-none">{expectedViewsLabel}</div>
              <div className="text-[11px] sm:text-xs text-gray-500">views esperadas</div>
            </div>
          ) : (
            <div className="text-[11px] sm:text-xs text-gray-500">Sem estimativa</div>
          )}

          <button
            className="ml-auto sm:ml-0 text-pink-600 hover:text-pink-700 mt-0 sm:mt-2 inline-flex items-center text-sm font-semibold"
            onClick={() => onOpen(slot)}
          >
            Ver mais <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

const ContentPlannerList = ({ userId, publicMode }: { userId: string; publicMode?: boolean }) => {
  const { slots, loading, error } = usePlannerData({ userId, publicMode, targetSlotsPerWeek: 7 });

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<PlannerUISlot | null>(null);
  const weekStartISO = useMemo(() => getWeekStartISO(), []);

  const openModal = useCallback((slot: PlannerUISlot) => {
    setSelectedSlot(slot);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedSlot(null);
  }, []);

  // onSave (stub)
  const handleSave = useCallback(async (_updated: PlannerSlotDataModal) => {
    return;
  }, []);

  const sortedSlots = useMemo(() => {
    if (!slots) return [] as PlannerUISlot[];
    return [...slots].sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return a.blockStartHour - b.blockStartHour;
    });
  }, [slots]);

  if (loading)
    return (
      <div className="text-center p-8">
        <span className="text-gray-500">Carregando planejamento...</span>
      </div>
    );
  if (error)
    return (
      <div className="text-center p-8">
        <span className="text-red-500">{error}</span>
      </div>
    );
  if (!slots || slots.length === 0)
    return (
      <div className="text-center p-8">
        <span className="text-gray-500">Nenhuma sugestão de conteúdo encontrada.</span>
      </div>
    );

  return (
    <>
      <div className="space-y-3">
        {sortedSlots.map((slot, index) => (
          <PlannerRowCard key={`${slot.dayOfWeek}-${slot.blockStartHour}-${index}`} slot={slot} onOpen={openModal} />
        ))}
      </div>

      <PlannerSlotModal
        open={isModalOpen}
        onClose={closeModal}
        userId={userId}
        weekStartISO={weekStartISO}
        slot={toPlannerSlotData(selectedSlot)}
        onSave={handleSave}
        readOnly={publicMode}
      />
    </>
  );
};

/**
 * MISC UI
 */
interface KeyMetricProps {
  icon: React.ReactNode;
  value: string | number | null | undefined;
  label: string;
}
const KeyMetric = ({ icon, value, label }: KeyMetricProps) => (
  <div className="flex flex-col items-center text-center p-2">
    <div className="text-pink-500">{icon}</div>
    <p className="mt-1 text-xl font-bold text-gray-900">{String(value ?? '—')}</p>
    <p className="text-xs text-gray-500 mt-1">{label}</p>
  </div>
);

interface TrendIndicatorProps {
  value: number | null | undefined;
}
const TrendIndicator = ({ value }: TrendIndicatorProps) => {
  if (value === null || value === undefined) return null;
  const isPositive = value >= 0;
  const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  const titleText = Number.isFinite(value)
    ? `Variação de ${value.toFixed(1)}% em relação ao período anterior`
    : 'Variação muito alta';
  const shown = Number.isFinite(value) ? `${Math.abs(value).toFixed(1)}%` : '∞';
  return (
    <span className="inline-flex items-center gap-1 ml-2 text-xs font-semibold" title={titleText}>
      <Icon className={colorClass} size={14} />
      <span className={colorClass}>{shown}</span>
    </span>
  );
};

interface KpiValueProps {
  value: number | null | undefined;
  type: 'number' | 'percent';
}
const KpiValue = ({ value, type }: KpiValueProps) => {
  if (value === null || value === undefined) return <>N/A</>;
  if (type === 'percent') return <>{value.toFixed(2)}%</>;
  return <>{value > 0 ? `+${value.toLocaleString('pt-BR')}` : value.toLocaleString('pt-BR')}</>;
};

const genderLabelMap: { [key: string]: string } = { f: 'Feminino', m: 'Masculino', u: 'Desconhecido' };
const getTopEntry = (data: { [key: string]: number } | undefined) =>
  !data || Object.keys(data).length === 0 ? null : Object.entries(data).reduce((a, b) => (a[1] > b[1] ? a : b));
const generateDemographicSummary = (demographics: any) => {
  if (!demographics?.follower_demographics) return 'Dados demográficos não disponíveis.';
  const { gender, age, city, country } = demographics.follower_demographics;
  const topGenderEntry = getTopEntry(gender);
  const topAgeEntry = getTopEntry(age);
  const topCityEntry = getTopEntry(city);
  const topCountryEntry = getTopEntry(country);
  const topLocation = topCityEntry?.[0] || topCountryEntry?.[0];
  if (!topGenderEntry || !topAgeEntry || !topLocation) return 'Perfil de público diversificado.';
  const dominantGender = (
    { f: 'feminino', m: 'masculino', u: 'desconhecido' } as { [key: string]: string }
  )[topGenderEntry[0].toLowerCase()] || topGenderEntry[0];
  return `Mais popular entre o público ${dominantGender}, ${topAgeEntry[0]} anos, em ${topLocation}.`;
};

const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);
const MetricSkeletonRow = () => (
  <div className="grid grid-cols-3 divide-x divide-gray-200 bg-gray-50 p-2 rounded-lg">
    <div className="flex flex-col items-center">
      <Skeleton className="h-4 w-4 mb-2" />
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-3 w-20 mt-1" />
    </div>
    <div className="flex flex-col items-center">
      <Skeleton className="h-4 w-4 mb-2" />
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-3 w-20 mt-1" />
    </div>
    <div className="flex flex-col items-center">
      <Skeleton className="h-4 w-4 mb-2" />
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-3 w-20 mt-1" />
    </div>
  </div>
);

/**
 * MAIN COMPONENT
 */
export default function MediaKitView({
  user,
  summary,
  videos,
  kpis: initialKpis,
  demographics,
  showSharedBanner = false,
  showOwnerCtas = false,
}: MediaKitViewProps) {
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' } }),
  } as const;
  const PERIOD_OPTIONS = useMemo(
    () => [
      { value: 'last_7d_vs_previous_7d', label: 'Últimos 7 dias' },
      { value: 'last_30d_vs_previous_30d', label: 'Últimos 30 dias' },
    ],
    []
  );
  const [comparisonPeriod, setComparisonPeriod] = useState(
    initialKpis?.comparisonPeriod || 'last_30d_vs_previous_30d'
  );
  const [kpiData, setKpiData] = useState(initialKpis as any);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!initialKpis);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const { data: session } = useSession();

  useEffect(() => {
    async function fetchData() {
      if (!user?._id) return;
      setIsLoading(true);
      setKpiError(null);
      try {
        const res = await fetch(
          `/api/v1/users/${user._id}/kpis/periodic-comparison?comparisonPeriod=${comparisonPeriod}`,
          { cache: 'no-store' }
        );
        if (res.ok) {
          const data = await res.json();
          setKpiData(data);
        } else {
          setKpiError('Não foi possível atualizar os KPIs agora.');
        }
      } catch {
        setKpiError('Não foi possível atualizar os KPIs agora.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [comparisonPeriod, user?._id]);

  const cardStyle = 'bg-white p-6 sm:p-8 rounded-xl shadow-lg border-t-4 border-pink-500';
  const compactNumberFormat = (num: number | null | undefined) =>
    num?.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }) ?? '...';
  const demographicSummary = useMemo(() => generateDemographicSummary(demographics), [demographics]);

  // ✅ Bio com a mesma regra do componente antigo + fallbacks
  const bioText = useMemo(() => {
    const directUser = typeof (user as any)?.biography === 'string' ? (user as any).biography.trim() : '';
    const directSummary = typeof (summary as any)?.biography === 'string' ? (summary as any).biography.trim() : '';
    return directUser || directSummary || extractIgBio(user) || extractIgBio(summary) || '';
  }, [user, summary]);

  const demographicBreakdowns = useMemo(() => {
    if (!demographics?.follower_demographics) return null as any;
    const { gender, age, city } = demographics.follower_demographics;
    const calculatePercentages = (data: Record<string, number> | undefined) => {
      if (!data) return [] as { label: string; percentage: number }[];
      const total = Object.values(data).reduce((sum: number, count: number) => sum + count, 0);
      return Object.entries(data)
        .map(([label, count]) => ({ label, percentage: ((count as number) / total) * 100 }))
        .sort((a, b) => b.percentage - a.percentage);
    };
    return {
      gender: calculatePercentages(gender),
      age: calculatePercentages(age).slice(0, 5),
      location: calculatePercentages(city).slice(0, 3),
    };
  }, [demographics]);

  const videosWithCorrectStats = useMemo(() => {
    if (!Array.isArray(videos)) return [] as VideoListItem[];
    return videos.map((video) => {
      const newVideo: VideoListItem = JSON.parse(JSON.stringify(video));
      type StatsType = NonNullable<typeof newVideo.stats> & { reach?: number | null | undefined } & Record<string, any>;
      const stats = (newVideo.stats ?? (newVideo.stats = {} as any)) as StatsType;
      if (stats.views == null || stats.views === 0) {
        const reachVal = (stats as any).reach;
        if (typeof reachVal === 'number' && isFinite(reachVal) && reachVal > 0) {
          (stats as any).views = reachVal;
        } else if (stats.views == null) {
          delete (stats as any).views;
        }
      }
      return newVideo;
    });
  }, [videos]);

  const displayKpis = kpiData as any;

  const isSubscribed = Boolean(
    (user as any)?.isSubscriber ||
    (user as any)?.subscription?.status === 'active' ||
    (user as any)?.billing?.status === 'active' ||
    String((user as any)?.plan || '').toLowerCase() === 'pro'
  );

  const isOwner = useMemo(() => {
    const su = (session?.user as any) || {};
    const uid = String((user as any)?._id || (user as any)?.id || '');
    const sid = String(su?._id || su?.id || '');
    return !!uid && !!sid && uid === sid;
  }, [session?.user, user]);

  return (
    <GlobalTimePeriodProvider>
      <div className="bg-slate-50 min-h-screen font-sans">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">

          {isOwner && showOwnerCtas && (
            <>
              <SubscribeCtaBanner isSubscribed={isSubscribed} />

              <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={0.15}>
                <div className="mb-6 sm:mb-8">
                  <AffiliateCard variant="mediakit" />
                </div>
              </motion.div>
            </>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
            <aside className="lg:col-span-1 space-y-8 lg:sticky lg:top-8 self-start">
              <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={0} className={cardStyle}>
                <div className="flex flex-col items-center text-center gap-4">
                  <UserAvatar name={user.name || 'Criador'} src={user.profile_picture_url} size={96} />
                  <div>
                    <h1 className="text-3xl font-bold text-gray-800">{user.name}</h1>
                    {user.username && <p className="text-gray-500 text-lg">@{user.username}</p>}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-3">
                  {user?.email && (
                    <a href={`mailto:${user.email}`} className="bg-black text-white text-sm px-3 py-2 rounded-md">
                      Fale comigo
                    </a>
                  )}
                  <button
                    className="border text-sm px-3 py-2 rounded-md"
                    onClick={() => navigator.clipboard.writeText(window.location.href)}
                  >
                    Copiar link
                  </button>
                </div>

                {/* ✅ BIO DO INSTAGRAM — mesma lógica do arquivo antigo + fallbacks */}
                {bioText && (
                  <p className="text-gray-600 mt-5 text-center whitespace-pre-line font-light max-w-[60ch] mx-auto leading-relaxed">
                    {bioText}
                  </p>
                )}
              </motion.div>

              {demographics && demographicBreakdowns && (
                <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={1} className={cardStyle}>
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Demografia do Público</h2>
                  <div className="mb-6 p-3 text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                    <Lightbulb className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                    <span>{demographicSummary}</span>
                  </div>
                  <div className="space-y-5">
                    {demographicBreakdowns.gender.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Gênero</h3>
                        <div className="space-y-1">
                          {demographicBreakdowns.gender.map((item: any) => (
                            <div key={item.label} className="flex items-center justify-between text-xs py-0.5">
                              <span className="text-gray-600">{genderLabelMap[item.label.toLowerCase()] || item.label}</span>
                              <div className="flex items-center gap-2 w-2/3">
                                <div className="w-full bg-gray-200/70 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="h-2 rounded-full bg-gradient-to-r from-brand-pink to-pink-500"
                                    style={{ width: `${item.percentage}%` }}
                                  />
                                </div>
                                <span className="font-semibold text-gray-800">{item.percentage.toFixed(1)}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {demographicBreakdowns.age.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Faixas Etárias</h3>
                        <div className="space-y-1">
                          {demographicBreakdowns.age.map((item: any) => (
                            <div key={item.label} className="flex items-center justify-between text-xs py-0.5">
                              <span className="text-gray-600">{item.label}</span>
                              <div className="flex items-center gap-2 w-2/3">
                                <div className="w-full bg-gray-200/70 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="h-2 rounded-full bg-gradient-to-r from-brand-pink to-pink-500"
                                    style={{ width: `${item.percentage}%` }}
                                  />
                                </div>
                                <span className="font-semibold text-gray-800">{item.percentage.toFixed(1)}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {demographicBreakdowns.location.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Cidades</h3>
                        <div className="space-y-1">
                          {demographicBreakdowns.location.map((item: any) => (
                            <div key={item.label} className="flex items-center justify-between text-xs py-0.5">
                              <span className="text-gray-600">{item.label}</span>
                              <div className="flex items-center gap-2 w-2/3">
                                <div className="w-full bg-gray-200/70 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="h-2 rounded-full bg-gradient-to-r from-brand-pink to-pink-500"
                                    style={{ width: `${item.percentage}%` }}
                                  />
                                </div>
                                <span className="font-semibold text-gray-800">{item.percentage.toFixed(1)}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={2} className={cardStyle}>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="text-xl font-bold text-gray-800">Performance</h2>
                  <select
                    className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-pink-500 focus:border-pink-500"
                    value={comparisonPeriod}
                    onChange={(e) => setComparisonPeriod(e.target.value)}
                    disabled={isLoading}
                  >
                    {PERIOD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {kpiError && (
                  <div className="mb-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2">
                    {kpiData ? 'Mostrando últimos dados válidos. ' : ''}
                    {kpiError}
                  </div>
                )}
                {isLoading ? (
                  <div className="space-y-4">
                    <MetricSkeletonRow />
                    <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-11/12" />
                      <Skeleton className="h-4 w-10/12" />
                      <Skeleton className="h-4 w-9/12" />
                    </div>
                  </div>
                ) : !displayKpis ? (
                  <div className="flex flex-col justify-center items-center h-64 text-center text-gray-600">
                    <p className="text-sm">Conecte seu Instagram para ver seus KPIs aqui.</p>
                    <div className="mt-5 w-full max-w-md">
                      <MetricSkeletonRow />
                    </div>
                  </div>
                ) : (
                  <div className="transition-opacity duration-300">
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Números-Chave</h3>
                      <div className="grid grid-cols-3 divide-x divide-gray-200 bg-gray-50 p-2 rounded-lg">
                        <KeyMetric icon={<Users size={18} />} value={compactNumberFormat(displayKpis?.avgReachPerPost?.currentValue)} label="Alcance Médio" />
                        <KeyMetric icon={<Heart size={18} />} value={`${displayKpis?.engagementRate?.currentValue?.toFixed?.(2) ?? '0'}%`} label="Taxa de Engaj." />
                        <KeyMetric icon={<Calendar size={18} />} value={`${displayKpis?.postingFrequency?.currentValue?.toFixed?.(1) ?? '0'}`} label="Posts/Semana" />
                      </div>
                    </div>

                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Médias Detalhadas por Post</h3>
                      <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="space-y-1">
                          <AverageMetricRow icon={<Eye className="w-4 h-4" />} label="Visualizações" value={displayKpis?.avgViewsPerPost?.currentValue} />
                          <AverageMetricRow icon={<Heart className="w-4 h-4" />} label="Curtidas" value={displayKpis?.avgLikesPerPost?.currentValue} />
                          <AverageMetricRow icon={<MessageSquare className="w-4 h-4" />} label="Comentários" value={displayKpis?.avgCommentsPerPost?.currentValue} />
                          <AverageMetricRow icon={<Share2 className="w-4 h-4" />} label="Compartilhamentos" value={displayKpis?.avgSharesPerPost?.currentValue} />
                          <AverageMetricRow icon={<Bookmark className="w-4 h-4" />} label="Salvos" value={displayKpis?.avgSavesPerPost?.currentValue} />
                        </div>
                      </div>
                    </div>

                    {displayKpis?.followerGrowth && (
                      <div className="space-y-4 pt-4 border-t border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Crescimento de Seguidores</h3>
                        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                          {user.followers_count !== undefined && (
                            <p className="text-2xl font-bold text-gray-900 mt-1">{user.followers_count.toLocaleString('pt-BR')}</p>
                          )}
                          <p className="text-xs text-gray-500">Seguidores totais</p>
                          <p className="text-sm text-gray-700 mt-3 flex items-center">
                            <KpiValue value={displayKpis.followerGrowth?.currentValue} type="number" />
                            <TrendIndicator value={displayKpis.followerGrowth?.percentageChange} />
                            <span className="ml-1 text-gray-500">no período</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </aside>

            <main className="lg:col-span-2 space-y-8">
              <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={0.5} className={cardStyle}>
                <div className="flex items-center gap-3 mb-6">
                  <Trophy className="w-6 h-6 text-pink-500" />
                  <h2 className="text-2xl font-bold text-gray-800">Top Posts em Performance</h2>
                </div>

                {videosWithCorrectStats.length === 0 ? (
                  <div>
                    <p className="text-gray-600 mb-6 font-light">
                      Conecte seu Instagram para ver seus posts com melhor desempenho aqui.
                    </p>
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-gray-600 mb-6 font-light">
                      Uma amostra do conteúdo de maior impacto{' '}
                      <span className="font-medium text-gray-700">— clique em um post para ver a análise detalhada.</span>
                    </p>
                    <VideosTable videos={videosWithCorrectStats} readOnly onRowClick={setSelectedPostId} />
                  </>
                )}
              </motion.div>
            </main>
          </div>

          <div className="mt-8 space-y-8 lg:mt-10 lg:space-y-10">
            {user?._id && (
              <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={0.7} className={cardStyle}>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Destaques de Performance</h2>
                <p className="text-gray-500 text-sm mb-6">Arraste para ver os principais insights e conquistas.</p>
                <PerformanceHighlightsCarousel userId={String(user._id)} />
              </motion.div>
            )}

            {user?._id && (
              <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={0.8} className={cardStyle}>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Rankings por Categorias</h2>
                <p className="text-gray-500 text-sm mb-6">Veja a posição do criador em diferentes nichos.</p>
                <CategoryRankingsCarousel userId={String(user._id)} />
              </motion.div>
            )}

            {user?._id && (
              <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={0.9} className={cardStyle}>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Planejamento de Conteúdo</h2>
                <ContentPlannerList userId={String(user._id)} publicMode />
              </motion.div>
            )}
          </div>

          {showSharedBanner && (
            <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={2}>
              <div className="mt-12 bg-gray-800 text-white text-center p-8 lg:p-12 rounded-xl shadow-2xl">
                <Mail className="w-10 h-10 mx-auto mb-4 text-pink-500" />
                <h3 className="text-3xl lg:text-4xl font-bold mb-3">
                  Inteligência Criativa: A Fórmula da Alta Performance.
                </h3>
                <p className="mb-8 text-gray-300 max-w-2xl mx-auto font-light">
                  Nós decodificamos o DNA da audiência de cada criador...
                </p>
                <a
                  href="mailto:arthur@data2content.ai?subject=Desenho de Campanha Inteligente"
                  className="inline-block bg-pink-500 text-white px-10 py-4 rounded-lg font-semibold text-lg hover:bg-pink-600"
                >
                  Desenhar Campanha Inteligente
                </a>
              </div>
            </motion.div>
          )}
        </div>

        <PostDetailModal
          isOpen={selectedPostId !== null}
          onClose={() => setSelectedPostId(null)}
          postId={selectedPostId}
          publicMode
        />
      </div>
    </GlobalTimePeriodProvider>
  );
}
