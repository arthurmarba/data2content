'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tab } from '@headlessui/react';
import {
  ArrowDownTrayIcon,
  UsersIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import KpiCard from '../components/KpiCard';
import SkeletonBlock from '../components/SkeletonBlock';
import TreeMapChart from './components/TreeMapChart';
import StackedBarChart from './components/StackedBarChart';
import FunnelChart from './components/FunnelChart';
import HeatmapTable from './components/HeatmapTable';
import PieDistribution from './components/PieDistribution';
import TimeSeriesChart from './components/TimeSeriesChart';
import Section from './components/Section';
import CreatorFilters from './components/CreatorFilters';
import CreatorTable from './components/CreatorTable';
import UserDetailModal from './components/UserDetailModal';
import OpenResponsesTab from './components/OpenResponsesTab';
import QuickInsights from './components/QuickInsights';
import CityRanking from './components/CityRanking';
import ExportModal from './components/ExportModal';
import {
  AdminCreatorSurveyAnalytics,
  AdminCreatorSurveyDetail,
  AdminCreatorSurveyListItem,
  AdminCreatorSurveyListParams,
  AdminCreatorSurveyOpenResponse,
} from '@/types/admin/creatorSurvey';
import {
  CreatorStage,
  HardestStage,
  MonetizationStatus,
  NextPlatform,
} from '@/types/landing';
import { classNames, formatDate, buildParams, isAllNoData } from './utils';
import { fetchCreatorSurveyDetailAction } from '@/app/actions/adminCreatorSurvey';

const defaultFilters: AdminCreatorSurveyListParams = {
  page: 1,
  pageSize: 25,
  sortBy: 'updatedAt',
  sortOrder: 'desc',
};

const stageOptions: { value: CreatorStage; label: string }[] = [
  { value: 'iniciante', label: 'Estou começando' },
  { value: 'hobby', label: 'Crio por hobby' },
  { value: 'renda-extra', label: 'Tenho renda extra' },
  { value: 'full-time', label: 'Full-time' },
  { value: 'empresa', label: 'Empresa/Time' },
];

const painsOptions = [
  { value: 'ideias', label: 'Falta de ideias' },
  { value: 'consistencia', label: 'Falta de consistência' },
  { value: 'metricas', label: 'Entender métricas' },
  { value: 'camera', label: 'Insegurança p/ aparecer' },
  { value: 'negociar', label: 'Negociar/comunicar valor' },
  { value: 'organizacao', label: 'Organização/rotina' },
  { value: 'outro', label: 'Outro' },
];

const hardestStageOptions: { value: HardestStage; label: string }[] = [
  { value: 'planejar', label: 'Planejar' },
  { value: 'produzir', label: 'Produzir' },
  { value: 'postar', label: 'Postar' },
  { value: 'analisar', label: 'Analisar' },
  { value: 'negociar', label: 'Negociar' },
];

const monetizationOptions: { value: MonetizationStatus; label: string }[] = [
  { value: 'varias', label: 'Sim, várias' },
  { value: 'poucas', label: 'Já fiz, poucas' },
  { value: 'nunca-quero', label: 'Nunca fiz, quero começar' },
  { value: 'nunca-sem-interesse', label: 'Nunca fiz, sem interesse' },
];

const nextPlatformOptions: { value: NextPlatform; label: string }[] = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'outra', label: 'Outra' },
  { value: 'nenhuma', label: 'Nenhuma' },
];

const platformReasonsOptions = [
  { value: 'metricas', label: 'Entender métricas' },
  { value: 'media-kit', label: 'Criar/atualizar mídia kit' },
  { value: 'planejar', label: 'Planejar conteúdo' },
  { value: 'negociar', label: 'Negociação com marcas' },
  { value: 'oportunidades', label: 'Receber oportunidades' },
  { value: 'mentorias', label: 'Mentorias/suporte' },
  { value: 'posicionamento-marcas', label: 'Posicionar para marcas' },
  { value: 'outro', label: 'Outro' },
];

const openQuestionMeta: Record<
  string,
  { label: string; section: 'Narrativa' | 'Rotina' | 'Objetivos' | 'Dores' | 'Monetização' | 'Motivação' | 'Posicionamento' | 'Suporte' | 'Outro' }
> = {
  success12m: { label: 'História de sucesso (12m)', section: 'Narrativa' },
  dailyExpectation: { label: 'Expectativa diária', section: 'Rotina' },
  mainGoalOther: { label: 'Objetivo (outro)', section: 'Objetivos' },
  otherPain: { label: 'Dor principal (outro)', section: 'Dores' },
  pricingFearOther: { label: 'Medo de precificar (outro)', section: 'Monetização' },
  reasonOther: { label: 'Motivo para usar (outro)', section: 'Motivação' },
  dreamBrands: { label: 'Marcas dos sonhos', section: 'Posicionamento' },
  brandTerritories: { label: 'Territórios de marca', section: 'Posicionamento' },
  niches: { label: 'Niches/temas', section: 'Posicionamento' },
  hasHelp: { label: 'Tem ajuda', section: 'Suporte' },
};

// Helper constants
const questionToType: Record<string, 'dores' | 'objetivos' | 'plataforma' | 'rotina' | 'aprendizado'> = {
  'Qual sua maior dificuldade hoje?': 'dores',
  'Outra dificuldade (descreva)': 'dores',
  'Qual seu maior objetivo p/ os pŕoximos 3 meses?': 'objetivos',
  'O que seria sucesso p/ você daqui a 1 ano?': 'objetivos',
  'Maior desafio na criação de conteúdo?': 'dores',
  'O que te faz ficar no Instagram?': 'plataforma',
  'Outro motivo p/ ficar (descreva)': 'plataforma',
  'Quantas horas por dia vc dedica ao Instagram?': 'rotina',
  'Como você prefere aprender?': 'aprendizado'
};

const openQuestionOptions = Object.keys(questionToType).map((q) => ({ label: q, value: q }));

const openResponseTypeOptions = [
  { label: 'Dores/Dificuldades', value: 'dores' },
  { label: 'Objetivos/Sonhos', value: 'objetivos' },
  { label: 'Sobre a Plataforma', value: 'plataforma' },
  { label: 'Rotina', value: 'rotina' },
  { label: 'Aprendizado', value: 'aprendizado' },
  { label: 'Outros', value: 'outros' },
];

export default function CreatorsInsightsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabOrder: Array<'individual' | 'overview' | 'openResponses'> = ['individual', 'overview', 'openResponses'];
  const [activeTab, setActiveTab] = useState<'individual' | 'overview' | 'openResponses'>('individual');
  const [filters, setFilters] = useState<AdminCreatorSurveyListParams>(defaultFilters);
  const [datePreset, setDatePreset] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [list, setList] = useState<AdminCreatorSurveyListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminCreatorSurveyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);

  const [analytics, setAnalytics] = useState<AdminCreatorSurveyAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [openResponses, setOpenResponses] = useState<AdminCreatorSurveyOpenResponse[]>([]);
  const [openResponsesLoading, setOpenResponsesLoading] = useState(false);
  const [openResponsesError, setOpenResponsesError] = useState<string | null>(null);
  const [openResponsesPage, setOpenResponsesPage] = useState(1);
  const [openResponsesHasMore, setOpenResponsesHasMore] = useState(false);
  const [openResponsesTotal, setOpenResponsesTotal] = useState(0);
  const [openResponsesSearch, setOpenResponsesSearch] = useState('');
  const [openResponsesQuestion, setOpenResponsesQuestion] = useState<string>('');
  const [openResponsesType, setOpenResponsesType] = useState<string>('all');
  const [openResponsesSort, setOpenResponsesSort] = useState<'recent' | 'oldest' | 'length' | 'relevance'>('recent');
  const [openResponsesExpanded, setOpenResponsesExpanded] = useState<Record<string, boolean>>({});
  const [openResponsesLoaded, setOpenResponsesLoaded] = useState(0);
  const openResponsesSearchTimer = useRef<NodeJS.Timeout | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exportColumns, setExportColumns] = useState<string[]>([]);
  const [exportIncludeHistory, setExportIncludeHistory] = useState(false);
  const [nicheInput, setNicheInput] = useState('');
  const [brandInput, setBrandInput] = useState('');

  const fetchCreatorDetail = useCallback(async (id: string) => {
    try {
      setDetailLoading(true);
      const data = await fetchCreatorSurveyDetailAction(id);
      setDetail(data);
    } catch (error) {
      console.error('Failed to fetch creator detail:', error);
    } finally {
      setDetailLoading(false);
    }
  }, []);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['name', 'email', 'niche', 'stage', 'monetization', 'pain', 'followersCount', 'reach', 'engaged', 'city', 'country', 'gender', 'updatedAt']);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userSuggestions, setUserSuggestions] = useState<AdminCreatorSurveyListItem[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const userSearchTimer = useRef<NodeJS.Timeout | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'visao' | 'diagnostico' | 'acao'>('visao');
  const [openResponsesTheme, setOpenResponsesTheme] = useState<string>('');

  const sortConfig = useMemo(
    () => ({ sortBy: filters.sortBy ?? 'updatedAt', sortOrder: filters.sortOrder ?? 'desc' }),
    [filters.sortBy, filters.sortOrder],
  );

  // Carrega filtros da URL na primeira renderização
  useEffect(() => {
    if (!searchParams || initialized) return;
    const parsed: AdminCreatorSurveyListParams = {
      page: Number(searchParams.get('page') || 1),
      pageSize: Number(searchParams.get('pageSize') || 25),
      sortBy: (searchParams.get('sortBy') as any) || 'updatedAt',
      sortOrder: (searchParams.get('sortOrder') as any) || 'desc',
      search: searchParams.get('search') || undefined,
      userId: searchParams.get('userId') || undefined,
      username: searchParams.get('username') || undefined,
      stage: searchParams.get('stage')?.split(',').filter(Boolean) as CreatorStage[] | undefined,
      pains: searchParams.get('pains')?.split(',').filter(Boolean) || undefined,
      hardestStage: searchParams.get('hardestStage')?.split(',').filter(Boolean) as HardestStage[] | undefined,
      monetizationStatus: searchParams.get('monetizationStatus')?.split(',').filter(Boolean) as MonetizationStatus[] | undefined,
      nextPlatform: searchParams.get('nextPlatform')?.split(',').filter(Boolean) as NextPlatform[] | undefined,
      niches: searchParams.get('niches')?.split(',').filter(Boolean) || undefined,
      brandTerritories: searchParams.get('brandTerritories')?.split(',').filter(Boolean) || undefined,
      accountReasons: searchParams.get('accountReasons')?.split(',').filter(Boolean) || undefined,
      country: searchParams.get('country')?.split(',').filter(Boolean) || undefined,
      city: searchParams.get('city')?.split(',').filter(Boolean) || undefined,
      gender: searchParams.get('gender')?.split(',').filter(Boolean) || undefined,
      followersMin: searchParams.get('followersMin') ? Number(searchParams.get('followersMin')) : undefined,
      followersMax: searchParams.get('followersMax') ? Number(searchParams.get('followersMax')) : undefined,
      mediaMin: searchParams.get('mediaMin') ? Number(searchParams.get('mediaMin')) : undefined,
      mediaMax: searchParams.get('mediaMax') ? Number(searchParams.get('mediaMax')) : undefined,
      engagementMin: searchParams.get('engagementMin') ? Number(searchParams.get('engagementMin')) : undefined,
      engagementMax: searchParams.get('engagementMax') ? Number(searchParams.get('engagementMax')) : undefined,
      reachMin: searchParams.get('reachMin') ? Number(searchParams.get('reachMin')) : undefined,
      reachMax: searchParams.get('reachMax') ? Number(searchParams.get('reachMax')) : undefined,
      growthMin: searchParams.get('growthMin') ? Number(searchParams.get('growthMin')) : undefined,
      growthMax: searchParams.get('growthMax') ? Number(searchParams.get('growthMax')) : undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
    };
    setFilters((prev) => ({ ...prev, ...parsed }));
    if (parsed.userId) {
      setSelectedId(parsed.userId);
      openDetail(parsed.userId);
    }
    if (parsed.dateFrom && parsed.dateTo) setDatePreset('all');
    setInitialized(true);
  }, [searchParams, initialized]);

  // Mantém filtros na URL para deep-link
  useEffect(() => {
    if (!initialized) return;
    const params = buildParams(filters);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [filters, router, initialized]);

  useEffect(() => {
    const fetchList = async () => {
      setListLoading(true);
      setListError(null);
      try {
        const params = buildParams(filters);
        const res = await fetch(`/api/admin/creators-survey?${params.toString()}`);
        if (!res.ok) {
          let message = 'Falha ao carregar criadores';
          try {
            const data = await res.json();
            message = data?.error || data?.message || message;
          } catch {
            /* ignore */
          }
          throw new Error(message);
        }
        const data = await res.json();
        setList(data.items || []);
        setTotal(data.total || 0);
      } catch (e: any) {
        setListError(e.message);
        setList([]);
        setTotal(0);
      } finally {
        setListLoading(false);
      }
    };
    fetchList();
  }, [filters]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        const params = buildParams(filters);
        params.delete('page');
        params.delete('pageSize');
        params.delete('sortBy');
        params.delete('sortOrder');
        const res = await fetch(`/api/admin/creators-survey/analytics?${params.toString()}`);
        if (!res.ok) {
          let message = 'Falha ao carregar analytics';
          try {
            const data = await res.json();
            message = data?.error || data?.message || message;
          } catch {
            /* ignore */
          }
          throw new Error(message);
        }
        const data = await res.json();
        setAnalytics(data);
      } catch (e) {
        setAnalytics(null);
      } finally {
        setAnalyticsLoading(false);
      }
    };
    if (activeTab === 'overview') fetchAnalytics();
  }, [filters, activeTab]);

  const fetchOpenResponses = async (pageToLoad = 1, reset = false) => {
    if (activeTab !== 'openResponses') return;
    setOpenResponsesLoading(true);
    if (reset) {
      setOpenResponsesPage(1);
      setOpenResponsesExpanded({});
    }
    try {
      const params = buildParams(filters);
      params.set('page', String(pageToLoad));
      params.set('pageSize', '30');
      if (openResponsesQuestion) params.set('question', openResponsesQuestion);
      if (openResponsesSearch.trim()) params.set('q', openResponsesSearch.trim());
      const res = await fetch(`/api/admin/creators-survey/open-responses?${params.toString()}`);
      if (!res.ok) {
        let message = 'Falha ao carregar respostas abertas';
        try {
          const data = await res.json();
          message = data?.error || data?.message || message;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }
      const data = await res.json();
      setOpenResponses((prev) => (reset ? data.responses || [] : [...prev, ...(data.responses || [])]));
      setOpenResponsesTotal(data.total || 0);
      setOpenResponsesHasMore(Boolean(data.hasMore));
      setOpenResponsesPage(data.page || pageToLoad);
      setOpenResponsesLoaded((prev) => (reset ? (data.responses?.length || 0) : prev + (data.responses?.length || 0)));
      setOpenResponsesError(null);
    } catch (e: any) {
      if (reset) setOpenResponses([]);
      setOpenResponsesError(e.message || 'Erro ao carregar respostas abertas');
    } finally {
      setOpenResponsesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'openResponses') return;
    fetchOpenResponses(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, activeTab, openResponsesQuestion]);

  useEffect(() => {
    if (activeTab !== 'openResponses') return;
    if (openResponsesSearchTimer.current) clearTimeout(openResponsesSearchTimer.current);
    openResponsesSearchTimer.current = setTimeout(() => {
      setOpenResponsesLoaded(0);
      fetchOpenResponses(1, true);
    }, 400);
    return () => {
      if (openResponsesSearchTimer.current) clearTimeout(openResponsesSearchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openResponsesSearch, activeTab]);

  useEffect(() => {
    if (activeTab !== 'openResponses') return;
    // When switching type, refresh list from page 1 (especially after a question filter)
    fetchOpenResponses(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openResponsesType, activeTab]);

  const handleSort = (columnKey: string) => {
    let sortOrder: 'asc' | 'desc' = 'asc';
    if (filters.sortBy === columnKey && filters.sortOrder === 'asc') sortOrder = 'desc';
    setFilters((prev) => ({ ...prev, sortBy: columnKey as any, sortOrder, page: 1 }));
  };

  const updateCommaInput = (value: string, key: 'niches' | 'brandTerritories') => {
    const arr = value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    setFilters((prev) => ({ ...prev, [key]: arr, page: 1 }));
  };

  const toggleMultiValue = <T,>(key: keyof AdminCreatorSurveyListParams, value: T) => {
    setFilters((prev) => {
      const current = (prev[key] as unknown as T[]) || [];
      const exists = current.includes(value);
      const next = exists ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [key]: next, page: 1 };
    });
  };

  const toggleOpenResponseExpansion = (id: string) => {
    setOpenResponsesExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDatePreset = (preset: 'all' | '7d' | '30d' | '90d') => {
    setDatePreset(preset);
    if (preset === 'all') {
      setFilters((prev) => ({ ...prev, dateFrom: undefined, dateTo: undefined, page: 1 }));
      return;
    }
    const end = new Date();
    const start = new Date();
    if (preset === '7d') start.setDate(end.getDate() - 7);
    if (preset === '30d') start.setDate(end.getDate() - 30);
    if (preset === '90d') start.setDate(end.getDate() - 90);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    setFilters((prev) => ({ ...prev, dateFrom: fmt(start), dateTo: fmt(end), page: 1 }));
  };

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: keyof AdminCreatorSurveyListParams; label: string; value: string }> = [];
    if (filters.userId) chips.push({ key: 'userId', label: 'Usuário', value: userSearch || filters.userId });
    if (filters.search) chips.push({ key: 'search', label: 'Busca', value: filters.search });
    filters.stage?.forEach((val) => chips.push({ key: 'stage', label: 'Estágio', value: val }));
    filters.pains?.forEach((val) => chips.push({ key: 'pains', label: 'Dor', value: val }));
    filters.hardestStage?.forEach((val) => chips.push({ key: 'hardestStage', label: 'Etapa difícil', value: val }));
    filters.monetizationStatus?.forEach((val) => chips.push({ key: 'monetizationStatus', label: 'Monetização', value: val }));
    filters.nextPlatform?.filter(Boolean).forEach((val) => chips.push({ key: 'nextPlatform', label: 'Plataforma', value: val as string }));
    filters.accountReasons?.forEach((val) => chips.push({ key: 'accountReasons', label: 'Motivo', value: val }));
    filters.niches?.forEach((val) => chips.push({ key: 'niches', label: 'Nicho', value: val }));
    filters.brandTerritories?.forEach((val) => chips.push({ key: 'brandTerritories', label: 'Território', value: val }));
    filters.country?.forEach((val) => chips.push({ key: 'country', label: 'País', value: val }));
    filters.city?.forEach((val) => chips.push({ key: 'city', label: 'Cidade', value: val }));
    filters.gender?.forEach((val) => chips.push({ key: 'gender', label: 'Gênero', value: val }));
    if (filters.followersMin !== undefined || filters.followersMax !== undefined) {
      chips.push({
        key: 'followersMin',
        label: 'Seguidores',
        value: `${filters.followersMin ?? '0'} - ${filters.followersMax ?? '∞'}`,
      });
    }
    if (filters.mediaMin !== undefined || filters.mediaMax !== undefined) {
      chips.push({
        key: 'mediaMin',
        label: 'Posts',
        value: `${filters.mediaMin ?? '0'} - ${filters.mediaMax ?? '∞'}`,
      });
    }
    if (filters.engagementMin !== undefined || filters.engagementMax !== undefined) {
      chips.push({
        key: 'engagementMin',
        label: 'Engajamento %',
        value: `${filters.engagementMin ?? '0'} - ${filters.engagementMax ?? '∞'}`,
      });
    }
    if (filters.reachMin !== undefined || filters.reachMax !== undefined) {
      chips.push({
        key: 'reachMin',
        label: 'Alcance',
        value: `${filters.reachMin ?? '0'} - ${filters.reachMax ?? '∞'}`,
      });
    }
    if (filters.growthMin !== undefined || filters.growthMax !== undefined) {
      chips.push({
        key: 'growthMin',
        label: 'Crescimento %',
        value: `${filters.growthMin ?? '0'} - ${filters.growthMax ?? '∞'}`,
      });
    }
    if (filters.dateFrom || filters.dateTo) {
      chips.push({
        key: 'dateFrom',
        label: 'Período',
        value: `${filters.dateFrom || '?'} até ${filters.dateTo || '?'}`,
      });
    }
    return chips;
  }, [filters, userSearch]);

  const removeChip = (chip: { key: keyof AdminCreatorSurveyListParams; value: string }) => {
    setFilters((prev) => {
      const current = prev[chip.key];
      if (Array.isArray(current)) {
        return { ...prev, [chip.key]: current.filter((v) => v !== chip.value), page: 1 };
      }
      if (chip.key === 'followersMin') return { ...prev, followersMin: undefined, followersMax: undefined, page: 1 };
      if (chip.key === 'mediaMin') return { ...prev, mediaMin: undefined, mediaMax: undefined, page: 1 };
      if (chip.key === 'engagementMin') return { ...prev, engagementMin: undefined, engagementMax: undefined, page: 1 };
      if (chip.key === 'reachMin') return { ...prev, reachMin: undefined, reachMax: undefined, page: 1 };
      if (chip.key === 'growthMin') return { ...prev, growthMin: undefined, growthMax: undefined, page: 1 };
      return { ...prev, [chip.key]: undefined, page: 1 };
    });
    if (chip.key === 'userId') {
      setSelectedId(null);
      setDetail(null);
      setUserSearch('');
    }
  };

  const toggleColumn = (col: string) => {
    setVisibleColumns((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]));
  };

  const handleUserSelect = (item: AdminCreatorSurveyListItem) => {
    setFilters((prev) => ({
      ...prev,
      userId: item.id,
      search: undefined,
      page: 1,
    }));
    setUserSearch(item.name || item.email || item.username || '');
    setSelectedId(item.id);
    setActiveTab('individual');
    setSuggestionsOpen(false);
    openDetail(item.id);
  };

  const clearUser = () => {
    setFilters((prev) => ({
      ...prev,
      userId: undefined,
      username: undefined,
      page: 1,
    }));
    setSelectedId(null);
    setDetail(null);
    setUserSearch('');
    setSuggestionsOpen(false);
  };

  // Auto-suggest de usuário
  useEffect(() => {
    if (!userSearch || userSearch.length < 2) {
      setUserSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }
    if (userSearchTimer.current) clearTimeout(userSearchTimer.current);
    userSearchTimer.current = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const params = new URLSearchParams({ search: userSearch, pageSize: '5' });
        const res = await fetch(`/api/admin/creators-survey?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setUserSuggestions(data.items || []);
          setSuggestionsOpen(true);
        }
      } catch {
        setUserSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 300);
  }, [userSearch]);

  async function openDetail(id: string) {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setNotesDraft('');
    setNotesDirty(false);
    try {
      const res = await fetch(`/api/admin/creators-survey/${id}`);
      if (!res.ok) throw new Error('Falha ao carregar detalhes');
      const data = await res.json();
      setDetail(data);
      setNotesDraft(data?.profile?.adminNotes || '');
    } catch (e) {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  const saveNotes = async (adminNotes: string) => {
    if (!selectedId) return;
    setNotesSaving(true);
    await fetch(`/api/admin/creators-survey/${selectedId}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminNotes }),
    });
    setDetail((prev) => (prev ? { ...prev, profile: { ...prev.profile, adminNotes } } : prev));
    setNotesSaving(false);
  };

  useEffect(() => {
    if (!selectedId) return;
    if (!notesDirty) return;
    const timer = setTimeout(() => {
      saveNotes(notesDraft);
      setNotesDirty(false);
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesDraft, notesDirty, selectedId]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = buildParams(filters);
      params.set('format', exportFormat);
      if (exportIncludeHistory) params.set('includeHistory', 'true');
      if (exportColumns.length) params.set('columns', exportColumns.join(','));
      const res = await fetch(`/api/admin/creators-survey/export?${params.toString()}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `creators-survey.${exportFormat === 'csv' ? 'csv' : 'json'}`;
      link.click();
      window.URL.revokeObjectURL(url);
      setExportModal(false);
    } catch (e) {
      /* noop */
    } finally {
      setExporting(false);
    }
  };

  const handleToggleExportColumn = (key: string) => {
    setExportColumns((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key],
    );
  };

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Nome',
        sortable: true,
        render: (item: AdminCreatorSurveyListItem) => (
          <span className="text-sm font-semibold text-gray-900">{item.name}</span>
        ),
      },
      {
        key: 'reach',
        label: 'Alcance',
        sortable: true,
        render: (item: AdminCreatorSurveyListItem) => (
          <span className="text-sm text-gray-700">{item.reach ? item.reach.toLocaleString('pt-BR') : '—'}</span>
        ),
      },
      {
        key: 'engaged',
        label: 'Engajados',
        sortable: true,
        render: (item: AdminCreatorSurveyListItem) => (
          <span className="text-sm text-gray-700">{item.engaged ? item.engaged.toLocaleString('pt-BR') : '—'}</span>
        ),
      },
      {
        key: 'email',
        label: 'Email',
        sortable: false,
        render: (item: AdminCreatorSurveyListItem) => <span className="text-sm text-gray-700">{item.email}</span>,
      },
      {
        key: 'niche',
        label: 'Nicho',
        sortable: false,
        render: (item: AdminCreatorSurveyListItem) => <span className="text-sm text-gray-700 truncate">{item.niches?.[0] || '—'}</span>,
      },
      {
        key: 'stage',
        label: 'Estágio',
        sortable: false,
        render: (item: AdminCreatorSurveyListItem) => <span className="text-sm text-gray-700">{item.stage?.join(', ') || '—'}</span>,
      },
      {
        key: 'monetization',
        label: 'Monetização',
        sortable: true,
        render: (item: AdminCreatorSurveyListItem) => <span className="text-sm text-gray-700">{item.monetizationLabel}</span>,
      },
      {
        key: 'pain',
        label: 'Dor principal',
        sortable: false,
        render: (item: AdminCreatorSurveyListItem) => <span className="text-sm text-gray-700">{item.mainPainLabel}</span>,
      },
      {
        key: 'followers',
        label: 'Seguidores',
        sortable: false,
        render: (item: AdminCreatorSurveyListItem) => (
          <span className="text-sm text-gray-700">{item.followersCount?.toLocaleString('pt-BR') || '—'}</span>
        ),
      },
      {
        key: 'city',
        label: 'Cidade',
        sortable: false,
        render: (item: AdminCreatorSurveyListItem) => (
          <span className="text-sm text-gray-700">
            {item.city || 'Sem dado'}
          </span>
        ),
      },
      {
        key: 'country',
        label: 'Cidade · País',
        sortable: false,
        render: (item: AdminCreatorSurveyListItem) => (
          <span className="text-sm text-gray-700">
            {item.city || 'Sem dado'}
            {item.country ? ` · ${item.country}` : ''}
          </span>
        ),
      },
      {
        key: 'gender',
        label: 'Gênero',
        sortable: false,
        render: (item: AdminCreatorSurveyListItem) => <span className="text-sm text-gray-700">{item.gender || '—'}</span>,
      },
      {
        key: 'updatedAt',
        label: 'Atualização',
        sortable: true,
        render: (item: AdminCreatorSurveyListItem) => (
          <span className="text-sm text-gray-500">{formatDate(item.updatedAt || item.createdAt)}</span>
        ),
      },
      {
        key: 'actions',
        label: 'Ações',
        sortable: false,
        headerClassName: 'text-right',
        render: (item: AdminCreatorSurveyListItem) => (
          <button
            onClick={() => openDetail(item.id)}
            className="text-indigo-600 hover:text-indigo-800 font-semibold"
          >
            Ver detalhes
          </button>
        ),
      },
    ],
    [],
  );

  const activeColumns = useMemo(
    () =>
      columns.filter(
        (col) => col.key === 'actions' || visibleColumns.includes(col.key),
      ),
    [columns, visibleColumns],
  );

  const totalPages = Math.max(1, Math.ceil(total / (filters.pageSize || 25)));

  const applyChartFilter = (key: keyof AdminCreatorSurveyListParams, value: string) => {
    toggleMultiValue(key, value as any);
    setActiveTab('individual');
  };

  const filledCityPct = useMemo(() => {
    const totalResp = analytics?.totalRespondents || 0;
    if (!totalResp || !analytics?.qualitySummary) return 1;
    const filled = totalResp - analytics.qualitySummary.missingCity;
    return filled / totalResp;
  }, [analytics]);


  const themeBuckets = useMemo(() => {
    const themes = [
      { key: 'roteiros', label: 'Roteiros/organização', keywords: ['roteiro', 'ideias', 'organiza', 'calendário', 'planejar', 'pauta', 'briefing', 'cronograma'] },
      { key: 'metricas', label: 'Métricas', keywords: ['métrica', 'metricas', 'analytics', 'alcance', 'engaj', 'dados', 'insight', 'resultado'] },
      { key: 'publis', label: 'Publis/negociação', keywords: ['publi', 'marca', 'negoci', 'proposta', 'preço', 'precificar', 'fee', 'contrato', 'orçamento'] },
      { key: 'posicionamento', label: 'Posicionamento', keywords: ['posicion', 'nicho', 'imagem', 'marca pessoal', 'território', 'branding'] },
    ];
    const counts: Record<string, number> = {};
    openResponses.forEach((resp) => {
      const text = resp.text.toLowerCase();
      themes.forEach((t) => {
        if (t.keywords.some((k) => text.includes(k))) {
          counts[t.key] = (counts[t.key] || 0) + 1;
        }
      });
    });
    return themes.map((t) => ({ ...t, count: counts[t.key] || 0 }));
  }, [openResponses]);

  const getResponseType = useCallback((resp: AdminCreatorSurveyOpenResponse) => questionToType[resp.question] || 'outros', []);

  const filteredResponses = useMemo(() => {
    const filtered = openResponses.filter((resp) => {
      if (openResponsesType !== 'all' && getResponseType(resp) !== openResponsesType) return false;
      if (!openResponsesTheme) return true;
      const text = resp.text.toLowerCase();
      const theme = themeBuckets.find((t) => t.key === openResponsesTheme);
      return theme?.keywords.some((k) => text.includes(k));
    });
    const term = openResponsesSearch.trim().toLowerCase();
    const score = (resp: AdminCreatorSurveyOpenResponse) => {
      if (!term) return 0;
      const matches = resp.text.toLowerCase().split(term).length - 1;
      return matches;
    };
    const sorted = [...filtered].sort((a, b) => {
      if (openResponsesSort === 'recent') {
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      }
      if (openResponsesSort === 'oldest') {
        return new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
      }
      if (openResponsesSort === 'length') {
        return (b.text?.length || 0) - (a.text?.length || 0);
      }
      // relevance
      return score(b) - score(a);
    });
    return sorted;
  }, [openResponses, openResponsesType, openResponsesTheme, themeBuckets, openResponsesSort, openResponsesSearch, getResponseType]);

  const activeOpenResponseChips = useMemo(() => {
    const chips: { label: string; onRemove: () => void }[] = [];
    if (openResponsesSearch.trim()) {
      chips.push({ label: `Termo: “${openResponsesSearch.trim()}”`, onRemove: () => setOpenResponsesSearch('') });
    }
    if (openResponsesQuestion) {
      const label = openQuestionOptions.find((q) => q.value === openResponsesQuestion)?.label || 'Pergunta';
      chips.push({ label, onRemove: () => setOpenResponsesQuestion('') });
    }
    if (openResponsesType && openResponsesType !== 'all') {
      const label = openResponseTypeOptions.find((t) => t.value === openResponsesType)?.label || 'Tipo';
      chips.push({ label, onRemove: () => setOpenResponsesType('all') });
    }
    if (openResponsesTheme) {
      const label = themeBuckets.find((t) => t.key === openResponsesTheme)?.label || 'Tema';
      chips.push({ label, onRemove: () => setOpenResponsesTheme('') });
    }
    return chips;
  }, [openResponsesSearch, openResponsesQuestion, openResponsesType, openResponsesTheme, themeBuckets]);

  const completionRate = useMemo(() => {
    if (!analytics?.qualitySummary) return null;
    if (!analytics?.totalRespondents) return null;
    if (analytics.totalRespondents === 0) return null;
    return (analytics.qualitySummary.completeResponses / analytics.totalRespondents) * 100;
  }, [analytics]);

  const stageDistributionData = useMemo(() => {
    return (analytics?.distributions.stage || []).map((s) => ({
      name: s.value,
      total: s.count,
    }));
  }, [analytics]);

  const stageMonetizationData = useMemo(() => {
    if (!analytics?.stageMonetization || analytics.stageMonetization.length === 0) return [];
    const stages = Array.from(new Set(analytics.stageMonetization.map((s) => s.stage || 'Sem dado')));
    return stages.map((stage) => {
      const rows = analytics.stageMonetization?.filter((r) => r.stage === stage) || [];
      const monetizing = rows.filter((r) => r.monetization === 'varias' || r.monetization === 'poucas').reduce((acc, cur) => acc + (cur.count || 0), 0);
      const aspiring = rows.filter((r) => r.monetization === 'nunca-quero').reduce((acc, cur) => acc + (cur.count || 0), 0);
      const notInterested = rows.filter((r) => r.monetization === 'nunca-sem-interesse').reduce((acc, cur) => acc + (cur.count || 0), 0);
      const noData = rows.filter((r) => !r.monetization || r.monetization === 'sem-dado').reduce((acc, cur) => acc + (cur.count || 0), 0);
      return {
        name: stage,
        monetizando: monetizing,
        iniciando: aspiring,
        semInteresse: notInterested,
        semDado: noData,
      };
    });
  }, [analytics]);

  const painsBarData = useMemo(() => {
    return (analytics?.distributions.pains || []).map((p) => ({
      name: p.value,
      total: p.count,
    }));
  }, [analytics]);

  const treeMapSource = useMemo(() => {
    if (analytics?.distributions.niches?.length) return { data: analytics.distributions.niches, filterKey: 'niches' as keyof AdminCreatorSurveyListParams, title: 'Niches / Territórios' };
    if (analytics?.distributions.brandTerritories?.length) return { data: analytics.distributions.brandTerritories, filterKey: 'brandTerritories' as keyof AdminCreatorSurveyListParams, title: 'Territórios de marca' };
    return { data: [], filterKey: 'niches' as keyof AdminCreatorSurveyListParams, title: 'Niches / Territórios (sem dados)' };
  }, [analytics]);

  const painStageHeatmap = useMemo(() => {
    const rows = (analytics?.distributions.pains || []).map((p) => ({ key: p.value, label: p.value }));
    const columnsSource = analytics?.distributions.stage?.length
      ? analytics.distributions.stage
      : (analytics?.metricByCategory?.stage || []).map((s) => ({ value: s.value, count: s.count || 0 }));
    const columns: Array<{ key: string; label: string }> = Array.isArray(columnsSource)
      ? columnsSource.map((s: any) => ({ key: s.value, label: s.value }))
      : [];
    const dataMap: Record<string, Record<string, number>> = {};
    const columnTotals: Record<string, number> = {};
    rows.forEach((r) => {
      const rowMap: Record<string, number> = {};
      columns.forEach((c) => { rowMap[c.key] = 0; });
      dataMap[r.key] = rowMap;
    });
    (analytics?.correlations?.painByStage || []).forEach((entry) => {
      const rowKey = entry.pain || 'Sem dado';
      const colKey = entry.stage || 'Sem dado';
      if (!dataMap[rowKey]) dataMap[rowKey] = {};
      dataMap[rowKey][colKey] = (dataMap[rowKey]?.[colKey] || 0) + (entry.count || 0);
      columnTotals[colKey] = (columnTotals[colKey] || 0) + (entry.count || 0);
    });
    const percentMap: Record<string, Record<string, number>> = {};
    rows.forEach((r) => {
      const rowMap: Record<string, number> = {};
      columns.forEach((c) => {
        const total = columnTotals[c.key] || 0;
        const val = dataMap[r.key]?.[c.key] || 0;
        rowMap[c.key] = total > 0 ? (val / total) * 100 : 0;
      });
      percentMap[r.key] = rowMap;
    });
    return { rows, columns, dataMap, percentMap, columnTotals };
  }, [analytics]);

  const painMonetizationHeatmap = useMemo(() => {
    const rows = (analytics?.distributions.pains || []).map((p) => ({ key: p.value, label: p.value }));
    const columnsSource = analytics?.distributions.hasDoneSponsoredPosts || [];
    const columns: Array<{ key: string; label: string }> = Array.isArray(columnsSource)
      ? columnsSource.map((m) => ({ key: m.value, label: m.value }))
      : [];
    const dataMap: Record<string, Record<string, number>> = {};
    const columnTotals: Record<string, number> = {};
    rows.forEach((r) => {
      const rowMap: Record<string, number> = {};
      columns.forEach((c) => { rowMap[c.key] = 0; });
      dataMap[r.key] = rowMap;
    });
    (analytics?.correlations?.painByMonetization || []).forEach((entry) => {
      const rowKey = entry.pain || 'Sem dado';
      const colKey = entry.monetization || 'Sem dado';
      if (!dataMap[rowKey]) dataMap[rowKey] = {};
      dataMap[rowKey][colKey] = (dataMap[rowKey]?.[colKey] || 0) + (entry.count || 0);
      columnTotals[colKey] = (columnTotals[colKey] || 0) + (entry.count || 0);
    });
    const percentMap: Record<string, Record<string, number>> = {};
    rows.forEach((r) => {
      const rowMap: Record<string, number> = {};
      columns.forEach((c) => {
        const total = columnTotals[c.key] || 0;
        const val = dataMap[r.key]?.[c.key] || 0;
        rowMap[c.key] = total > 0 ? (val / total) * 100 : 0;
      });
      percentMap[r.key] = rowMap;
    });
    return { rows, columns, dataMap, percentMap, columnTotals };
  }, [analytics]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Pesquisa de Perfil</p>
          <h1 className="text-2xl font-bold text-gray-900">Insights de Criadores</h1>
        </div>
        <button
          onClick={() => setExportModal(true)}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-sm font-medium rounded-md shadow-sm hover:bg-gray-50"
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
          Exportar
        </button>
      </div>

      <Tab.Group
        selectedIndex={tabOrder.indexOf(activeTab)}
        onChange={(idx) => setActiveTab(tabOrder[idx] ?? 'individual')}
      >
        <Tab.List className="flex space-x-2 rounded-lg bg-white p-1 border border-gray-200">
          <Tab
            className={({ selected }) =>
              classNames(
                'flex-1 py-2 text-sm font-semibold rounded-md',
                selected ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100',
              )
            }
          >
            Respostas individuais
          </Tab>
          <Tab
            className={({ selected }) =>
              classNames(
                'flex-1 py-2 text-sm font-semibold rounded-md',
                selected ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100',
              )
            }
          >
            Visão geral
          </Tab>
          <Tab
            className={({ selected }) =>
              classNames(
                'flex-1 py-2 text-sm font-semibold rounded-md',
                selected ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100',
              )
            }
          >
            Respostas abertas
          </Tab>
        </Tab.List>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-gray-600">Modo:</span>
          {(['visao', 'diagnostico', 'acao'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 rounded-md text-xs border ${viewMode === mode ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-gray-200 text-gray-600'}`}
            >
              {mode === 'visao' ? 'Visão geral' : mode === 'diagnostico' ? 'Diagnóstico' : 'Ação'}
            </button>
          ))}
        </div>
        <Tab.Panels className="mt-4">
          <Tab.Panel>
            {/* FILTER COMPONENT */}
            <CreatorFilters
              filters={filters}
              onFilterChange={setFilters}
              onClearFilters={() => {
                setFilters({ ...defaultFilters, pageSize: filters.pageSize, sortBy: filters.sortBy, sortOrder: filters.sortOrder });
                setNicheInput('');
                setBrandInput('');
                setUserSearch('');
              }}
              totalFiltered={total}
              loading={listLoading}
              nicheInput={nicheInput}
              onNicheInputChange={setNicheInput}
              brandInput={brandInput}
              onBrandInputChange={setBrandInput}
            />

            {/* TABLE COMPONENT */}
            <CreatorTable
              list={list}
              total={total}
              loading={listLoading}
              error={listError}
              page={filters.page || 1}
              totalPages={totalPages}
              onPageChange={(p: number) => setFilters(prev => ({ ...prev, page: p }))}
              onViewDetail={(id: string) => { setSelectedId(id); fetchCreatorDetail(id); }}
              onRetry={() => setFilters({ ...filters })}
              sortConfig={{ sortBy: filters.sortBy || 'updatedAt', sortOrder: filters.sortOrder || 'desc' }}
              onSort={(key: string) => setFilters(prev => ({ ...prev, sortBy: key as any, sortOrder: prev.sortBy === key && prev.sortOrder === 'asc' ? 'desc' : 'asc' }))}
              visibleColumns={visibleColumns}
              onToggleColumn={toggleColumn}
            />
          </Tab.Panel>
          <Tab.Panel>
            <style>{`
              @media print {
                @page { margin: 1cm; size: landscape; }
                aside, header, nav, .no-print { display: none !important; }
                main { padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: none !important; }
                body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .bg-gray-50 { background-color: #f9fafb !important; }
                .shadow-sm, .shadow-md, .shadow-lg, .shadow-xl { box-shadow: none !important; border: 1px solid #e5e7eb !important; break-inside: avoid; }
                input, select, button { display: none !important; }
                .recharts-wrapper { break-inside: avoid; }
              }
            `}</style>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
              <div className="xl:col-span-2 space-y-4">
                <Section title="Resumo executivo" subtitle="Principais achados e direção das ações.">
                  <div className="space-y-4">
                    <QuickInsights analytics={analytics} isLoading={analyticsLoading} />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <KpiCard
                        label="Total de criadores"
                        value={analytics?.totalRespondents}
                        icon={UsersIcon}
                        isLoading={analyticsLoading}
                        variant="blue"
                      />
                      <KpiCard
                        label={
                          analytics?.qualitySummary && analytics?.totalRespondents
                            ? `Respostas completas (de ${analytics.totalRespondents})`
                            : 'Respostas completas'
                        }
                        value={analytics?.qualitySummary?.completeResponses ?? (analytics?.totalRespondents ? 0 : undefined)}
                        icon={ClipboardDocumentListIcon}
                        isLoading={analyticsLoading}
                        variant="green"
                      />
                      <KpiCard
                        label="Taxa de completude"
                        value={completionRate ?? undefined}
                        icon={ClipboardDocumentListIcon}
                        isLoading={analyticsLoading}
                        formatAs="percentage"
                        variant="indigo"
                      />
                      <KpiCard
                        label="Dor #1"
                        value={analytics?.topPain?.value || '—'}
                        icon={ExclamationTriangleIcon}
                        isLoading={analyticsLoading}
                        variant="red"
                      />
                    </div>
                    {analytics?.totalRespondents && analytics.totalRespondents > 0 && completionRate === 0 ? (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">
                        Nenhuma resposta completa conectada ainda. Conecte dados ou revise formulários para habilitar KPIs.
                      </p>
                    ) : null}
                  </div>
                </Section>
              </div>

              <Section title="Qualidade da base" subtitle="Cobertura dos dados críticos.">
                {analytics?.qualitySummary ? (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Cidade', value: analytics.qualitySummary.missingCity, tone: 'amber' },
                      { label: 'Seguidores', value: analytics.qualitySummary.missingFollowers, tone: 'amber' },
                      { label: 'Engajamento', value: analytics.qualitySummary.missingEngagement, tone: 'red' },
                      { label: 'Alcance', value: analytics.qualitySummary.missingReach, tone: 'red' },
                    ].map((item) => {
                      const total = analytics.totalRespondents || 0;
                      const pctMissing = total > 0 ? (item.value / total) * 100 : null;
                      const filled = total - item.value;
                      const pctFilled = total > 0 ? (filled / total) * 100 : null;
                      return (
                        <div key={item.label} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 bg-gray-50">
                          <span className="text-sm text-gray-700">{item.label}</span>
                          <div className="text-right">
                            <span
                              className={`text-sm font-semibold ${
                                item.value > 0
                                  ? item.tone === 'red'
                                    ? 'text-red-600'
                                    : 'text-amber-600'
                                  : 'text-green-600'
                              }`}
                            >
                              {item.value}
                            </span>
                            {pctMissing != null && (
                              <div className="text-[11px] text-gray-500">
                                {pctMissing.toFixed(1)}% faltando · {pctFilled?.toFixed(1)}% preenchido
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <SkeletonBlock height="h-16" />
                )}
              </Section>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Section title="Alcance & Crescimento" subtitle="Saúde de topo e evolução recente.">
                <div className="grid grid-cols-1 gap-3">
                  <KpiCard
                    label="Cresc. médio"
                    value={analytics?.metrics?.avgGrowth ?? undefined}
                    icon={UsersIcon}
                    isLoading={analyticsLoading}
                    formatAs="percentage"
                    variant="green"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <KpiCard
                      label="Seguidores médios"
                      value={analytics?.metrics?.avgFollowers ?? undefined}
                      icon={UsersIcon}
                      isLoading={analyticsLoading}
                      variant="blue"
                    />
                    <KpiCard
                      label="Alcance médio"
                      value={analytics?.metrics?.avgReach ?? undefined}
                      icon={UsersIcon}
                      isLoading={analyticsLoading}
                      variant="indigo"
                    />
                  </div>
                </div>
              </Section>

              <Section title="Monetização" subtitle="Quem já vende e quem ainda precisa de suporte.">
                <div className="grid grid-cols-2 gap-3">
                  <KpiCard
                    label="% com publis"
                    value={analytics?.monetizationYesPct}
                    icon={CurrencyDollarIcon}
                    isLoading={analyticsLoading}
                    formatAs="percentage"
                    variant="green"
                  />
                  <KpiCard
                    label="% sem publis"
                    value={analytics?.monetizationNoPct}
                    icon={ExclamationTriangleIcon}
                    isLoading={analyticsLoading}
                    formatAs="percentage"
                    variant="amber"
                  />
                </div>
                <KpiCard
                  label="Ticket médio (estimado)"
                  value={analytics?.metrics?.avgTicket ?? undefined}
                  icon={CurrencyDollarIcon}
                  isLoading={analyticsLoading}
                  formatAs="currency"
                  variant="green"
                />
              </Section>

              <Section title="Performance média" subtitle="Qualidade do conteúdo e da audiência.">
                <div className="grid grid-cols-2 gap-3">
                  <KpiCard
                    label="Engajamento"
                    value={analytics?.metrics?.avgEngagement ?? undefined}
                    icon={ClipboardDocumentListIcon}
                    isLoading={analyticsLoading}
                    formatAs="percentage"
                    variant="indigo"
                  />
                  <KpiCard
                    label="Dor principal"
                    value={analytics?.topPain?.value || '—'}
                    icon={ExclamationTriangleIcon}
                    isLoading={analyticsLoading}
                    variant="red"
                  />
                </div>
              </Section>
            </div>

            <Section title="Perfil e Demografia" subtitle="Onde estão e em que estágio da jornada.">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {treeMapSource.data.length ? (
                  <TreeMapChart
                    title={treeMapSource.title}
                    data={(treeMapSource.data || []).map((d) => ({ name: d.value, value: d.count }))}
                    onClick={(value) => applyChartFilter(treeMapSource.filterKey, value)}
                    isLoading={analyticsLoading}
                  />
                ) : (
                  <div className="bg-white border border-dashed border-gray-300 rounded-lg p-4 text-sm text-gray-500 flex flex-col items-center justify-center text-center">
                    <p className="font-semibold text-gray-700">Sem dados de nicho/território conectados</p>
                    <p className="text-xs text-gray-500 mt-1">Conecte dados ou escolha um filtro de cidade para visualizar distribuição geográfica.</p>
                  </div>
                )}
                <StackedBarChart
                  title="Distribuição por estágio"
                  data={stageDistributionData}
                  xAxisKey="name"
                  keys={[
                    { key: 'total', color: '#4F46E5', label: 'Criadores' },
                  ]}
                  isLoading={analyticsLoading}
                />
              </div>
            </Section>

            <Section title="Desafios & Gargalos" subtitle="Onde os criadores travam e o que dói mais.">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <FunnelChart
                  title="Etapa mais difícil"
                  data={(analytics?.distributions.hardestStage || []).map(d => ({ name: d.value, value: d.count }))}
                  onClick={(value) => applyChartFilter('hardestStage', value)}
                  isLoading={analyticsLoading}
                />
                <StackedBarChart
                  title="Dores mencionadas"
                  data={painsBarData}
                  xAxisKey="name"
                  keys={[
                    { key: 'total', color: '#F97316', label: 'Volume' },
                  ]}
                  isLoading={analyticsLoading}
                />
              </div>
            </Section>

            <Section title="Monetização em profundidade" subtitle="Cruzar estágio com intenção de publis e pricing (tooltip mostra % por estágio).">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {stageMonetizationData.length ? (
                  <StackedBarChart
                    title="Monetização por estágio"
                    data={stageMonetizationData}
                    xAxisKey="name"
                    keys={[
                      { key: 'monetizando', color: '#22C55E', label: 'Já monetiza' },
                      { key: 'iniciando', color: '#0EA5E9', label: 'Quer começar' },
                      { key: 'semInteresse', color: '#EF4444', label: 'Sem interesse' },
                      { key: 'semDado', color: '#94A3B8', label: 'Sem dado' },
                    ]}
                    showPercentOfTotal
                    isLoading={analyticsLoading}
                  />
                ) : (
                  <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-500">
                    Sem dados suficientes de monetização por estágio.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <PieDistribution title="Publis realizadas" data={analytics?.distributions.hasDoneSponsoredPosts || []} />
                  <PieDistribution title="Faixa de preço" data={analytics?.distributions.avgPriceRange || []} />
                </div>
              </div>
            </Section>

            <Section title="Correlação e leitura rápida" subtitle="Entenda onde focar combinando dores com jornada.">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <HeatmapTable
                  title="Dores x Estágio"
                  rows={painStageHeatmap.rows}
                  columns={painStageHeatmap.columns}
                  dataMap={painStageHeatmap.dataMap}
                  percentMap={painStageHeatmap.percentMap}
                  columnTotals={painStageHeatmap.columnTotals}
                  onSelect={(rowKey) => applyChartFilter('pains', rowKey)}
                  isLoading={analyticsLoading}
                />
                <HeatmapTable
                  title="Dores x Monetização"
                  rows={painMonetizationHeatmap.rows}
                  columns={painMonetizationHeatmap.columns}
                  dataMap={painMonetizationHeatmap.dataMap}
                  percentMap={painMonetizationHeatmap.percentMap}
                  columnTotals={painMonetizationHeatmap.columnTotals}
                  onSelect={(rowKey) => applyChartFilter('pains', rowKey)}
                  isLoading={analyticsLoading}
                />
              </div>
            </Section>

            <Section title="Cobertura e evolução" subtitle="Tendência de respostas e praças mais relevantes.">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TimeSeriesChart data={analytics?.timeSeries || []} isLoading={analyticsLoading} />
                <CityRanking data={analytics?.cityMetrics} onSelect={(value) => applyChartFilter('city', value)} isLoading={analyticsLoading} />
              </div>
            </Section>

          </Tab.Panel>
          <Tab.Panel>
            {analytics?.priorityList?.length ? (
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Criadores que precisam de ajuda agora</h3>
                  <span className="text-xs text-gray-600">{analytics.priorityList.length} selecionados</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {analytics.priorityList.map((p) => (
                    <div key={p.id} className="py-2 flex justify-between text-sm">
                      <div>
                        <p className="font-semibold text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.email}</p>
                        <p className="text-xs text-indigo-700">Motivo: {p.reason}</p>
                      </div>
                      <div className="text-xs text-right text-gray-700">
                        <p>Seg: {p.followers?.toLocaleString('pt-BR') ?? '—'}</p>
                        <p>Alcance: {p.reach?.toLocaleString('pt-BR') ?? '—'}</p>
                        <p>Eng: {p.engagementRate != null ? `${p.engagementRate.toFixed(2)}%` : '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Histórias de sucesso (12 meses)</h3>
              {analyticsLoading ? (
                <SkeletonBlock height="h-10" />
              ) : analytics?.topSuccessStories?.length ? (
                <ul className="space-y-2">
                  {analytics.topSuccessStories.map((item) => (
                    <li key={item.value} className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <p className="text-sm text-gray-800">{item.value}</p>
                      <p className="text-xs text-gray-500 mt-1">Citado {item.count}x</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">Sem respostas suficientes.</p>
              )}
            </div>

            <OpenResponsesTab
              responses={openResponses}
              loading={openResponsesLoading}
              hasMore={openResponsesHasMore}
              onLoadMore={() => fetchOpenResponses(openResponsesPage + 1)}
              search={openResponsesSearch}
              onSearchChange={setOpenResponsesSearch}
              question={openResponsesQuestion}
              onQuestionChange={setOpenResponsesQuestion}
              type={openResponsesType}
              onTypeChange={setOpenResponsesType}
              sort={openResponsesSort}
              onSortChange={setOpenResponsesSort}
              expanded={openResponsesExpanded}
              onToggleExpand={toggleOpenResponseExpansion}
              questionOptions={[
                { value: '', label: 'Todas as perguntas abertas' },
                ...Object.entries(openQuestionMeta).map(([value, meta]) => ({
                  value,
                  label: `${meta.section} · ${meta.label}`,
                })),
              ]}
              typeOptions={[
                { value: 'all', label: 'Todos os tipos' },
                { value: 'narrativa', label: 'Histórias de sucesso' },
                { value: 'rotina', label: 'Rotina/expectativas diárias' },
                { value: 'objetivos', label: 'Objetivos' },
                { value: 'dores', label: 'Dores/medos' },
                { value: 'monetizacao', label: 'Monetização/preço' },
                { value: 'motivacao', label: 'Motivação/uso' },
                { value: 'posicionamento', label: 'Posicionamento/territórios' },
                { value: 'suporte', label: 'Ajuda/apoio' },
                { value: 'outros', label: 'Outros' },
              ]}
            />
          </Tab.Panel>
        </Tab.Panels >
      </Tab.Group >

      {selectedId && (
        <UserDetailModal
          detail={detail}
          loading={detailLoading}
          onClose={() => {
            setSelectedId(null);
            setDetail(null);
          }}
          notesDraft={notesDraft}
          onNotesChange={(v) => {
            setNotesDraft(v);
            setNotesDirty(true);
          }}
          notesSaving={notesSaving}
        />
      )}

      <ExportModal
        isOpen={exportModal}
        onClose={() => setExportModal(false)}
        exporting={exporting}
        onExport={handleExport}
        exportFormat={exportFormat}
        onFormatChange={setExportFormat}
        columns={columns}
        exportColumns={exportColumns}
        onToggleColumn={handleToggleExportColumn}
        exportIncludeHistory={exportIncludeHistory}
        onIncludeHistoryChange={setExportIncludeHistory}
        activeFilterChips={activeFilterChips}
      />
    </div >
  );
}
