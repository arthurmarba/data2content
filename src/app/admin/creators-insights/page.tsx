'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tab } from '@headlessui/react';
import {
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  UsersIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentListIcon,
  AdjustmentsHorizontalIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import TableHeader from '../components/TableHeader';
import KpiCard from '../components/KpiCard';
import SkeletonBlock from '../components/SkeletonBlock';
import {
  AdminCreatorSurveyAnalytics,
  AdminCreatorSurveyDetail,
  AdminCreatorSurveyListItem,
  AdminCreatorSurveyListParams,
  DistributionEntry,
} from '@/types/admin/creatorSurvey';
import {
  CreatorStage,
  HardestStage,
  MonetizationStatus,
  NextPlatform,
} from '@/types/landing';

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

const chartColors = ['#4F46E5', '#22C55E', '#F59E0B', '#EF4444', '#0EA5E9', '#8B5CF6'];

function classNames(...args: Array<string | false | null | undefined>) {
  return args.filter(Boolean).join(' ');
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR');
}

function buildParams(filters: AdminCreatorSurveyListParams) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.userId) params.set('userId', filters.userId);
  if (filters.username) params.set('username', filters.username);
  if (filters.stage?.length) params.set('stage', filters.stage.join(','));
  if (filters.pains?.length) params.set('pains', filters.pains.join(','));
  if (filters.hardestStage?.length) params.set('hardestStage', filters.hardestStage.join(','));
  if (filters.monetizationStatus?.length) params.set('monetizationStatus', filters.monetizationStatus.join(','));
  if (filters.nextPlatform?.length) params.set('nextPlatform', filters.nextPlatform.join(','));
  if (filters.niches?.length) params.set('niches', filters.niches.join(','));
  if (filters.brandTerritories?.length) params.set('brandTerritories', filters.brandTerritories.join(','));
  if (filters.accountReasons?.length) params.set('accountReasons', filters.accountReasons.join(','));
  if (filters.country?.length) params.set('country', filters.country.join(','));
  if (filters.city?.length) params.set('city', filters.city.join(','));
  if (filters.gender?.length) params.set('gender', filters.gender.join(','));
  if (filters.followersMin !== undefined) params.set('followersMin', String(filters.followersMin));
  if (filters.followersMax !== undefined) params.set('followersMax', String(filters.followersMax));
  if (filters.mediaMin !== undefined) params.set('mediaMin', String(filters.mediaMin));
  if (filters.mediaMax !== undefined) params.set('mediaMax', String(filters.mediaMax));
  if (filters.engagementMin !== undefined) params.set('engagementMin', String(filters.engagementMin));
  if (filters.engagementMax !== undefined) params.set('engagementMax', String(filters.engagementMax));
  if (filters.reachMin !== undefined) params.set('reachMin', String(filters.reachMin));
  if (filters.reachMax !== undefined) params.set('reachMax', String(filters.reachMax));
  if (filters.growthMin !== undefined) params.set('growthMin', String(filters.growthMin));
  if (filters.growthMax !== undefined) params.set('growthMax', String(filters.growthMax));
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  return params;
}

function DistributionChart({
  title,
  data,
  onClick,
}: {
  title: string;
  data: DistributionEntry[];
  onClick?: (value: string) => void;
}) {
  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
        {onClick && <span className="text-xs text-gray-400">Clique para filtrar</span>}
      </div>
      {data.length === 0 ? (
        <div className="text-sm text-gray-500">Sem dados.</div>
      ) : (
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="value" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <RechartsTooltip />
              <Bar
                dataKey="count"
                fill="#4F46E5"
                radius={[4, 4, 0, 0]}
                onClick={onClick ? (entry) => onClick(entry.value) : undefined}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function PieDistribution({
  title,
  data,
}: {
  title: string;
  data: DistributionEntry[];
}) {
  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-800 mb-3">{title}</h4>
      {data.length === 0 ? (
        <div className="text-sm text-gray-500">Sem dados.</div>
      ) : (
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="value" outerRadius={90} label>
                {data.map((_, idx) => (
                  <Cell key={idx} fill={chartColors[idx % chartColors.length]} />
                ))}
              </Pie>
              <RechartsTooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function TimeSeriesChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <ClockIcon className="w-4 h-4 text-gray-500" />
        <h4 className="text-sm font-semibold text-gray-800">Respostas por dia</h4>
      </div>
      {data.length === 0 ? (
        <div className="text-sm text-gray-500">Sem dados suficientes.</div>
      ) : (
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <RechartsTooltip />
              <Line type="monotone" dataKey="count" stroke="#4F46E5" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function CreatorsInsightsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'individual' | 'overview'>('individual');
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

  const [exporting, setExporting] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exportColumns, setExportColumns] = useState<string[]>([]);
  const [nicheInput, setNicheInput] = useState('');
  const [brandInput, setBrandInput] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['name', 'email', 'niche', 'stage', 'monetization', 'pain', 'followers', 'reach', 'engaged', 'country', 'gender', 'updatedAt']);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userSuggestions, setUserSuggestions] = useState<AdminCreatorSurveyListItem[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const userSearchTimer = useRef<NodeJS.Timeout | null>(null);

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
        if (!res.ok) throw new Error('Falha ao carregar criadores');
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
        if (!res.ok) throw new Error('Falha ao carregar analytics');
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
        sortable: false,
        render: (item: AdminCreatorSurveyListItem) => (
          <span className="text-sm text-gray-700">{item.reach ? item.reach.toLocaleString('pt-BR') : '—'}</span>
        ),
      },
      {
        key: 'engaged',
        label: 'Engajados',
        sortable: false,
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
        key: 'country',
        label: 'País',
        sortable: false,
        render: (item: AdminCreatorSurveyListItem) => <span className="text-sm text-gray-700">{item.country || '—'}</span>,
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

      <Tab.Group selectedIndex={activeTab === 'individual' ? 0 : 1} onChange={(idx) => setActiveTab(idx === 0 ? 'individual' : 'overview')}>
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
        </Tab.List>
        <Tab.Panels className="mt-4">
          <Tab.Panel>
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-600 flex items-center gap-2">
                    <MagnifyingGlassIcon className="w-4 h-4" />
                    Buscar criador específico (nome, email ou @username)
                  </label>
                  <div className="relative mt-1">
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        setSuggestionsOpen(true);
                      }}
                      onFocus={() => setSuggestionsOpen(true)}
                      className="w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Digite para buscar um criador"
                    />
                    {suggestionsOpen && (userSuggestions.length > 0 || suggestionsLoading) && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
                        {suggestionsLoading && <p className="p-3 text-sm text-gray-500">Buscando...</p>}
                        {!suggestionsLoading &&
                          userSuggestions.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => handleUserSelect(item)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm text-gray-800"
                            >
                              <span className="font-semibold">{item.name}</span>
                              <span className="text-gray-500"> · {item.email}</span>
                              {item.username && <span className="text-gray-500"> · @{item.username}</span>}
                            </button>
                          ))}
                        {!suggestionsLoading && userSuggestions.length === 0 && (
                          <p className="p-3 text-sm text-gray-500">Nenhum criador encontrado.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSuggestionsOpen(false)}
                    className="px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Fechar sugestões
                  </button>
                  <button
                    onClick={clearUser}
                    className="px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                    disabled={!filters.userId}
                  >
                    Limpar usuário
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 flex items-center gap-2">
                    <MagnifyingGlassIcon className="w-4 h-4" />
                    Buscar
                  </label>
                  <input
                    type="text"
                    value={filters.search || ''}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                    className="mt-1 w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Nome, email ou @username"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Estágio</label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {stageOptions.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={filters.stage?.includes(opt.value) || false}
                          onChange={() => toggleMultiValue('stage', opt.value)}
                          className="rounded text-indigo-600 border-gray-300"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Dores (P7)</label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {painsOptions.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={filters.pains?.includes(opt.value) || false}
                          onChange={() => toggleMultiValue('pains', opt.value)}
                          className="rounded text-indigo-600 border-gray-300"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Etapa com mais dificuldade (P8)</label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {hardestStageOptions.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={filters.hardestStage?.includes(opt.value) || false}
                          onChange={() => toggleMultiValue('hardestStage', opt.value)}
                          className="rounded text-indigo-600 border-gray-300"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Monetização (P9/P10)</label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {monetizationOptions.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={filters.monetizationStatus?.includes(opt.value) || false}
                          onChange={() => toggleMultiValue('monetizationStatus', opt.value)}
                          className="rounded text-indigo-600 border-gray-300"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Plataforma além do IG (P15)</label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {nextPlatformOptions.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={filters.nextPlatform?.includes(opt.value) || false}
                          onChange={() => toggleMultiValue('nextPlatform', opt.value)}
                          className="rounded text-indigo-600 border-gray-300"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Motivo para usar a plataforma (P13)</label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {platformReasonsOptions.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={filters.accountReasons?.includes(opt.value) || false}
                          onChange={() => toggleMultiValue('accountReasons', opt.value)}
                          className="rounded text-indigo-600 border-gray-300"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Seguidores (min/max)</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="number"
                      min={0}
                      value={filters.followersMin ?? ''}
                      onChange={(e) => setFilters((prev) => ({ ...prev, followersMin: e.target.value ? Number(e.target.value) : undefined, page: 1 }))}
                      className="w-1/2 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      placeholder="0"
                    />
                    <input
                      type="number"
                      min={0}
                      value={filters.followersMax ?? ''}
                      onChange={(e) => setFilters((prev) => ({ ...prev, followersMax: e.target.value ? Number(e.target.value) : undefined, page: 1 }))}
                      className="w-1/2 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      placeholder="50000"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Posts (min/max)</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="number"
                      min={0}
                      value={filters.mediaMin ?? ''}
                      onChange={(e) => setFilters((prev) => ({ ...prev, mediaMin: e.target.value ? Number(e.target.value) : undefined, page: 1 }))}
                      className="w-1/2 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      placeholder="0"
                    />
                    <input
                      type="number"
                      min={0}
                      value={filters.mediaMax ?? ''}
                      onChange={(e) => setFilters((prev) => ({ ...prev, mediaMax: e.target.value ? Number(e.target.value) : undefined, page: 1 }))}
                      className="w-1/2 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      placeholder="1000"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">País</label>
                  <input
                    type="text"
                    value={(filters.country || []).join(', ')}
                    onChange={(e) => setFilters((prev) => ({ ...prev, country: e.target.value.split(',').map((v) => v.trim()).filter(Boolean), page: 1 }))}
                    className="mt-1 w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="BR, US..."
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Cidade</label>
                  <input
                    type="text"
                    value={(filters.city || []).join(', ')}
                    onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value.split(',').map((v) => v.trim()).filter(Boolean), page: 1 }))}
                    className="mt-1 w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="São Paulo, Rio"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Gênero</label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {['male', 'female', 'other'].map((g) => (
                      <label key={g} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={filters.gender?.includes(g) || false}
                          onChange={() => toggleMultiValue('gender', g)}
                          className="rounded text-indigo-600 border-gray-300"
                        />
                        {g}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Nicho/Temas (P2)</label>
                  <input
                    type="text"
                    value={nicheInput}
                    onChange={(e) => setNicheInput(e.target.value)}
                    onBlur={(e) => updateCommaInput(e.target.value, 'niches')}
                    placeholder="Ex: Marketing, Moda"
                    className="mt-1 w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Separe múltiplos por vírgula.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Territórios de marca</label>
                  <input
                    type="text"
                    value={brandInput}
                    onChange={(e) => setBrandInput(e.target.value)}
                    onBlur={(e) => updateCommaInput(e.target.value, 'brandTerritories')}
                    placeholder="Ex: Consistência, Vendas"
                    className="mt-1 w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Separe múltiplos por vírgula.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Data (cadastro/atualização)</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="date"
                      value={filters.dateFrom || ''}
                      onChange={(e) => {
                        setDatePreset('all');
                        setFilters((prev) => ({ ...prev, dateFrom: e.target.value || undefined, page: 1 }));
                      }}
                      className="flex-1 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                    <input
                      type="date"
                      value={filters.dateTo || ''}
                      onChange={(e) => {
                        setDatePreset('all');
                        setFilters((prev) => ({ ...prev, dateTo: e.target.value || undefined, page: 1 }));
                      }}
                      className="flex-1 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    {(['all', '7d', '30d', '90d'] as const).map((preset) => (
                      <button
                        key={preset}
                        onClick={() => handleDatePreset(preset)}
                        className={`px-2 py-1 rounded-md text-xs border ${
                          datePreset === preset ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-gray-200 text-gray-600'
                        }`}
                      >
                        {preset === 'all' ? 'Tudo' : `Últimos ${preset.replace('d', '')}d`}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Engajamento % (min/max)</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={filters.engagementMin ?? ''}
                      onChange={(e) => setFilters((prev) => ({ ...prev, engagementMin: e.target.value ? Number(e.target.value) : undefined, page: 1 }))}
                      className="w-1/2 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      placeholder="0"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={filters.engagementMax ?? ''}
                      onChange={(e) => setFilters((prev) => ({ ...prev, engagementMax: e.target.value ? Number(e.target.value) : undefined, page: 1 }))}
                      className="w-1/2 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      placeholder="10"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Ordenar por</label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value as any, page: 1 }))}
                    className="mt-1 w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  >
                    <option value="updatedAt">Data de atualização</option>
                    <option value="createdAt">Data de cadastro</option>
                    <option value="name">Nome</option>
                    <option value="monetization">Monetização</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Itens por página</label>
                  <select
                    value={filters.pageSize || 25}
                    onChange={(e) => setFilters((prev) => ({ ...prev, pageSize: Number(e.target.value), page: 1 }))}
                    className="mt-1 w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="flex items-end justify-end">
                  <button
                    onClick={() => {
                      setFilters((prev) => ({
                        ...defaultFilters,
                        pageSize: prev.pageSize ?? defaultFilters.pageSize,
                        sortBy: prev.sortBy ?? defaultFilters.sortBy,
                        sortOrder: prev.sortOrder ?? defaultFilters.sortOrder,
                      }));
                      setNicheInput('');
                      setBrandInput('');
                      setDatePreset('all');
                      setSelectedId(null);
                      setDetail(null);
                      setUserSearch('');
                      setSuggestionsOpen(false);
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-300 text-sm rounded-md hover:bg-gray-100"
                  >
                    <XMarkIcon className="w-4 h-4" />
                    Limpar filtros
                  </button>
                </div>
              </div>
            </div>
            {activeFilterChips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {activeFilterChips.map((chip, idx) => (
                  <span
                    key={`${chip.key}-${chip.value}-${idx}`}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs border border-indigo-100"
                  >
                    {chip.label}: {chip.value}
                    <button
                      onClick={() => removeChip(chip)}
                      className="text-indigo-500 hover:text-indigo-700"
                      aria-label={`Remover filtro ${chip.label}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FunnelIcon className="w-4 h-4" />
                  {total} criadores filtrados
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <button
                      onClick={() => setColumnsMenuOpen((prev) => !prev)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <AdjustmentsHorizontalIcon className="w-4 h-4" />
                      Colunas
                    </button>
                    {columnsMenuOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-10 p-3 space-y-2">
                        {columns
                          .filter((c) => c.key !== 'actions')
                          .map((col) => (
                            <label key={col.key} className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={visibleColumns.includes(col.key)}
                                onChange={() => toggleColumn(col.key)}
                                className="rounded text-indigo-600 border-gray-300"
                              />
                              {col.label}
                            </label>
                          ))}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">Ordenação</span>
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' }))}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    {filters.sortOrder === 'asc' ? 'Asc' : 'Desc'}
                  </button>
                </div>
              </div>
              {listLoading ? (
                <div className="p-6">
                  <SkeletonBlock height="h-10" className="mb-2" />
                  <SkeletonBlock height="h-10" className="mb-2" />
                  <SkeletonBlock height="h-10" />
                </div>
              ) : listError ? (
                <div className="p-6 text-red-600">{listError}</div>
              ) : list.length === 0 ? (
                <div className="p-6 text-gray-500">Nenhum criador encontrado.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <TableHeader
                      columns={activeColumns.map((col) => ({
                        key: col.key,
                        label: col.label,
                        sortable: col.sortable,
                        headerClassName: col.headerClassName,
                      }))}
                      sortConfig={sortConfig as any}
                      onSort={handleSort}
                    />
                    <tbody className="divide-y divide-gray-100">
                      {list.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          {activeColumns.map((col) => (
                            <td key={col.key} className={`px-6 py-3 ${col.key === 'actions' ? 'text-right' : ''}`}>
                              {col.render(item)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm">
                <span>
                  Página {filters.page} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, (prev.page || 1) - 1) }))}
                    disabled={(filters.page || 1) === 1}
                    className="px-3 py-1 rounded-md border border-gray-300 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, page: Math.min(totalPages, (prev.page || 1) + 1) }))}
                    disabled={(filters.page || 1) >= totalPages}
                    className="px-3 py-1 rounded-md border border-gray-300 disabled:opacity-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </div>
          </Tab.Panel>
          <Tab.Panel>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <KpiCard
                label="Total de criadores"
                value={analytics?.totalRespondents}
                icon={UsersIcon}
                isLoading={analyticsLoading}
              />
              <KpiCard
                label="% com publis"
                value={analytics?.monetizationYesPct}
                icon={CurrencyDollarIcon}
                isLoading={analyticsLoading}
                formatAs="percentage"
              />
              <KpiCard
                label="% não monetizam"
                value={analytics?.monetizationNoPct}
                icon={ExclamationTriangleIcon}
                isLoading={analyticsLoading}
                formatAs="percentage"
              />
              <KpiCard
                label="Top dor"
                value={analytics?.topPain?.value || '—'}
                icon={ClipboardDocumentListIcon}
                isLoading={analyticsLoading}
              />
              <KpiCard
                label="Engajamento médio"
                value={analytics?.metrics?.avgEngagement ?? undefined}
                icon={ClipboardDocumentListIcon}
                isLoading={analyticsLoading}
                formatAs="percentage"
              />
              <KpiCard
                label="Alcance médio"
                value={analytics?.metrics?.avgReach ?? undefined}
                icon={UsersIcon}
                isLoading={analyticsLoading}
              />
              <KpiCard
                label="Crescimento seguidores"
                value={analytics?.metrics?.avgGrowth ?? undefined}
                icon={UsersIcon}
                isLoading={analyticsLoading}
                formatAs="percentage"
              />
              <KpiCard
                label="Seguidores médios"
                value={analytics?.metrics?.avgFollowers ?? undefined}
                icon={UsersIcon}
                isLoading={analyticsLoading}
              />
              <KpiCard
                label="Ticket médio (estimado)"
                value={analytics?.metrics?.avgTicket ?? undefined}
                icon={CurrencyDollarIcon}
                isLoading={analyticsLoading}
                formatAs="currency"
              />
            </div>

            <QuickInsights
              analytics={analytics}
              isLoading={analyticsLoading}
            />

            <TimeSeriesChart data={analytics?.timeSeries || []} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DistributionChart
                title="Dores (P7)"
                data={analytics?.distributions.pains || []}
                onClick={(value) => applyChartFilter('pains', value)}
              />
              <DistributionChart
                title="Etapa difícil (P8)"
                data={analytics?.distributions.hardestStage || []}
                onClick={(value) => applyChartFilter('hardestStage', value)}
              />
              <PieDistribution title="Publis (P9)" data={analytics?.distributions.hasDoneSponsoredPosts || []} />
              <PieDistribution title="Faixa de preço (P10)" data={analytics?.distributions.avgPriceRange || []} />
              <DistributionChart
                title="Motivos para usar a plataforma (P13)"
                data={analytics?.distributions.mainPlatformReasons || []}
                onClick={(value) => applyChartFilter('accountReasons', value)}
              />
              <DistributionChart
                title="Plataformas além do Instagram (P15)"
                data={analytics?.distributions.nextPlatform || []}
                onClick={(value) => applyChartFilter('nextPlatform', value)}
              />
              <DistributionChart
                title="Como precifica (P12)"
                data={analytics?.distributions.pricingMethod || []}
              />
              <DistributionChart
                title="Formatos de aprendizado (P16)"
                data={analytics?.distributions.learningStyles || []}
              />
              <DistributionChart
                title="Faixa de seguidores"
                data={analytics?.distributions.followers || []}
              />
              <DistributionChart
                title="Gênero"
                data={analytics?.distributions.gender || []}
              />
              <DistributionChart
                title="País"
                data={analytics?.distributions.country || []}
                onClick={(value) => applyChartFilter('country', value)}
              />
              <DistributionChart
                title="Cidade"
                data={analytics?.distributions.city || []}
                onClick={(value) => applyChartFilter('city', value)}
              />
              <DistributionChart
                title="Engajamento %"
                data={analytics?.distributions.engagement || []}
                onClick={(value) => applyChartFilter('engagementMin', value)}
              />
              <DistributionChart
                title="Alcance 30d"
                data={analytics?.distributions.reach || []}
              />
              <DistributionChart
                title="Crescimento seguidores"
                data={analytics?.distributions.growth || []}
              />
              <DistributionChart
                title="Engajamento por estágio"
                data={(analytics?.distributions.stageEngagement || []).map((d) => ({
                  value: `${d.value} (${d.count})`,
                  count: d.avgEngagement || 0,
                }))}
              />
              {analytics?.monetizationByCountry?.length ? (
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-800">Monetização por país</h4>
                    <span className="text-xs text-gray-400">Clique aplica filtro</span>
                  </div>
                  <div className="h-72 overflow-y-auto pr-2">
                    {analytics.monetizationByCountry.map((row) => (
                      <button
                        key={row.value}
                        onClick={() => applyChartFilter('country', row.value)}
                        className="w-full text-left mb-2 last:mb-0 group"
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-800 group-hover:text-indigo-700">{row.value}</span>
                          <span className="text-gray-600">{row.pct}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded">
                          <div
                            className="h-2 bg-indigo-500 rounded"
                            style={{ width: `${Math.min(row.pct, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500">{row.monetizing}/{row.total} monetizam</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-6">
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
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>

      {selectedId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="w-full max-w-xl h-full bg-white shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div>
                <p className="text-xs text-gray-500">Perfil do criador</p>
                <h3 className="text-lg font-semibold text-gray-900">{detail?.name || '...'}</h3>
                <p className="text-sm text-gray-600">{detail?.email}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedId(null);
                  setDetail(null);
                }}
                className="p-2 rounded-md hover:bg-gray-100"
              >
                <XMarkIcon className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {detailLoading ? (
              <div className="p-6 space-y-2">
                <SkeletonBlock height="h-5" />
                <SkeletonBlock height="h-5" />
                <SkeletonBlock height="h-24" />
              </div>
            ) : !detail ? (
              <div className="p-6 text-gray-500">Falha ao carregar detalhes.</div>
            ) : (
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                  <span className="font-semibold">Handle</span>
                  <span>@{detail.username || '—'}</span>
                  <span className="font-semibold">Estágio</span>
                  <span>{detail.profile.stage?.join(', ') || '—'}</span>
                  <span className="font-semibold">Monetização</span>
                  <span>
                    {detail.profile.hasDoneSponsoredPosts || '—'}{' '}
                    {detail.profile.avgPriceRange ? `(${detail.profile.avgPriceRange})` : ''}
                  </span>
                  <span className="font-semibold">Seguidores</span>
                  <span>{detail.followersCount?.toLocaleString('pt-BR') || '—'}</span>
                  <span className="font-semibold">Posts</span>
                  <span>{detail.mediaCount ?? '—'}</span>
                  <span className="font-semibold">Localização</span>
                  <span>{`${detail.country || '—'}${detail.city ? ` · ${detail.city}` : ''}`}</span>
                  <span className="font-semibold">Gênero</span>
                  <span>{detail.gender || '—'}</span>
                  <span className="font-semibold">Última atualização</span>
                  <span>{formatDate(detail.updatedAt || detail.createdAt)}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <MetricCard label="Alcance (últ. período)" value={detail.reach} />
                  <MetricCard label="Contas engajadas" value={detail.engaged} />
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900">Quem é esse criador</h4>
                  <InfoRow label="Nicho/temas" value={detail.profile.niches?.join(', ') || '—'} />
                  <InfoRow label="Territórios de marca" value={detail.profile.brandTerritories?.join(', ') || '—'} />
                  <InfoRow label="Tem ajuda?" value={detail.profile.hasHelp?.join(', ') || '—'} />
                  <InfoRow label="Marcas dos sonhos" value={detail.profile.dreamBrands?.join(', ') || '—'} />
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900">Objetivos</h4>
                  <InfoRow label="Prioridade 3 meses" value={detail.profile.mainGoal3m || '—'} />
                  <InfoRow label="Outro (objetivo)" value={detail.profile.mainGoalOther || '—'} />
                  <InfoRow label="História de sucesso 12 meses" value={detail.profile.success12m || '—'} />
                  <InfoRow label="Expectativa diária" value={detail.profile.dailyExpectation || '—'} />
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900">Dores</h4>
                  <InfoRow label="Dores principais (P7)" value={detail.profile.mainPains?.join(', ') || '—'} />
                  <InfoRow label="Outro (dor)" value={detail.profile.otherPain || '—'} />
                  <InfoRow label="Etapa difícil (P8)" value={detail.profile.hardestStage?.join(', ') || '—'} />
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900">Monetização</h4>
                  <InfoRow label="Publis (P9)" value={detail.profile.hasDoneSponsoredPosts || '—'} />
                  <InfoRow label="Faixa média (P10)" value={detail.profile.avgPriceRange || '—'} />
                  <InfoRow label="Faixa combo (P11)" value={detail.profile.bundlePriceRange || '—'} />
                  <InfoRow label="Como precifica (P12)" value={detail.profile.pricingMethod || '—'} />
                  <InfoRow label="Medo de precificar" value={detail.profile.pricingFear || '—'} />
                  <InfoRow label="Outro (medo)" value={detail.profile.pricingFearOther || '—'} />
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900">Motivo de uso</h4>
                  <InfoRow label="Motivos principais (P13)" value={detail.profile.mainPlatformReasons?.join(', ') || '—'} />
                  <InfoRow label="Outro (motivo)" value={detail.profile.reasonOther || '—'} />
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900">Plataformas e aprendizado</h4>
                  <InfoRow label="Próximas plataformas (P15)" value={detail.profile.nextPlatform?.join(', ') || '—'} />
                  <InfoRow label="Formatos de aprendizado (P16)" value={detail.profile.learningStyles?.join(', ') || '—'} />
                  <InfoRow label="Notificações (P17)" value={detail.profile.notificationPref?.join(', ') || '—'} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900">Notas internas</h4>
                    {notesSaving && <span className="text-xs text-gray-500">Salvando...</span>}
                  </div>
                  <textarea
                    value={notesDraft}
                    onChange={(e) => {
                      setNotesDraft(e.target.value);
                      setNotesDirty(true);
                    }}
                    placeholder="Anotações privadas para o time"
                    className="w-full rounded-md border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm min-h-[120px]"
                  />
                  <p className="text-xs text-gray-500">Notas são salvas automaticamente em segundos.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {exportModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-5 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Exportar dados</h3>
              <button onClick={() => setExportModal(false)} className="p-2 rounded-md hover:bg-gray-100">
                <XMarkIcon className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-gray-700">Formato</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as any)}
                  className="mt-1 w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Colunas (opcional)</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {columns
                    .filter((c) => c.key !== 'actions')
                    .map((col) => (
                      <label key={col.key} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={exportColumns.includes(col.key)}
                          onChange={() =>
                            setExportColumns((prev) =>
                              prev.includes(col.key) ? prev.filter((c) => c !== col.key) : [...prev, col.key],
                            )
                          }
                          className="rounded text-indigo-600 border-gray-300"
                        />
                        {col.label}
                      </label>
                    ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">Deixe em branco para exportar todas as colunas.</p>
              </div>
              <div className="text-sm text-gray-600">
                <p>Serão exportados os criadores de acordo com os filtros aplicados.</p>
                {activeFilterChips.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Filtros ativos: {activeFilterChips.map((c) => `${c.label}=${c.value}`).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setExportModal(false)}
                  className="px-4 py-2 rounded-md border border-gray-300 text-sm"
                  disabled={exporting}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExport}
                  className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
                  disabled={exporting}
                >
                  {exporting ? 'Gerando...' : 'Exportar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-600">{label}</p>
      <p className="text-sm text-gray-800">{value || '—'}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value?: number | null }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500 font-semibold">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{value != null ? value.toLocaleString('pt-BR') : '—'}</p>
    </div>
  );
}

function QuickInsights({ analytics, isLoading }: { analytics: AdminCreatorSurveyAnalytics | null; isLoading: boolean }) {
  if (isLoading) {
    return <SkeletonBlock height="h-20" />;
  }
  if (!analytics) return null;

  const insights: string[] = [];
  if (analytics.metrics?.avgEngagement != null) {
    insights.push(`Engajamento médio de ${analytics.metrics.avgEngagement.toFixed(2)}% entre os filtrados.`);
  }
  if (analytics.metrics?.avgReach != null) {
    insights.push(`Alcance médio de ${Math.round(analytics.metrics.avgReach).toLocaleString('pt-BR')} nas últimas leituras.`);
  }
  if (analytics.metrics?.avgTicket != null) {
    insights.push(`Ticket médio estimado: R$ ${Math.round(analytics.metrics.avgTicket).toLocaleString('pt-BR')}.`);
  }
  const topCountry = analytics.monetizationByCountry?.[0];
  if (topCountry) {
    insights.push(`Em ${topCountry.value}, ${topCountry.pct}% monetizam (${topCountry.monetizing}/${topCountry.total}).`);
  }
  if (analytics.topPain?.value) {
    insights.push(`Dor mais citada: ${analytics.topPain.value}.`);
  }

  if (!insights.length) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-2">
      <h3 className="text-sm font-semibold text-gray-800">Insights rápidos</h3>
      <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
        {insights.map((insight, idx) => (
          <li key={idx}>{insight}</li>
        ))}
      </ul>
    </div>
  );
}
