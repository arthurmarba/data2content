'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowPathIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  DevicePhoneMobileIcon,
  ExclamationTriangleIcon,
  PresentationChartBarIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { percentage, relativeGrowth } from './platformUsageUtils';

interface PlanItem { _id: string; total: number }
interface MauPoint { month: string; mau: number; avgDau: number }
interface DayPoint { date: string; users: number; events: number }
interface WeekPoint { _id: { year: number; week: number }; total: number; uniqueUsers: number }
interface MkMonth { _id: { year: number; month: number }; acessos: number; visitantesUnicos: number }
interface Creator {
  name: string;
  username: string | null;
  planStatus: string;
  followers: number | null;
  visitantesUnicos: number;
  acessosTotais: number;
}
interface ToolStat {
  eventName: string;
  total: number;
  uniqueUsers: number;
  mobileTotal: number;
  mobileUniqueUsers: number;
}
interface Data {
  generatedAt: string;
  users: {
    total: number;
    planDist: PlanItem[];
    new7d: number;
    new30d: number;
    previous30d: number;
  };
  activity: {
    avgDau30: number;
    peakDau: number;
    mau30: number;
    mauByMonth: MauPoint[];
    dauLogin: number;
    mauLogin30d: number;
    actionUsers30d: number;
    events30d: number;
    dauByDay: DayPoint[];
  };
  features: {
    pautas: { total30d: number; users30d: number; byWeek: WeekPoint[] };
    publi: { total: number; total30d: number; users30d: number };
    video: { total30d: number };
    mapa: { total: number; confirmations30d: number };
    byTool: ToolStat[];
  };
  mediakit: {
    humanTotal: number;
    human30d: number;
    humanPrevious30d: number;
    uniqueVisitors30d: number;
    creators30d: number;
    byMonth: MkMonth[];
    ranking: Creator[];
  };
}

type Tab = 'geral' | 'features' | 'midia-kit';

const TOOL_LABELS: Record<string, string> = {
  publi_calculated: 'Calculadora de publi',
  media_kit_opened: 'Mídia Kit',
  pauta_created: 'Pautas',
  map_dimension_confirmed: 'Mapa estratégico',
  video_upload_started: 'Upload de vídeo',
  video_diagnosis_created: 'Diagnóstico de vídeo',
  collab_swiped: 'Collabs · descoberta',
  collab_matched: 'Collabs · match',
  chat_session_started: 'Chat AI',
  session_start: 'Login',
};

const PLAN_LABELS: Record<string, string> = {
  active: 'Ativo',
  canceled: 'Cancelado',
  inactive: 'Inativo',
  non_renewing: 'Não renovará',
  past_due: 'Pagamento pendente',
};

const PLAN_BADGES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  canceled: 'bg-orange-50 text-orange-700',
  inactive: 'bg-zinc-100 text-zinc-600',
  non_renewing: 'bg-amber-50 text-amber-700',
  past_due: 'bg-red-50 text-red-700',
};

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const TOOLTIP_STYLE = {
  borderRadius: 14,
  border: '1px solid #e4e4e7',
  boxShadow: '0 12px 32px rgba(24,24,27,.10)',
  fontSize: 12,
};

function num(value: number, maximumFractionDigits = 0) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits });
}

function toolLabel(eventName: string) {
  return TOOL_LABELS[eventName] ?? eventName.replaceAll('_', ' ');
}

function fmtMonth(item: MkMonth) {
  return `${MONTHS_PT[item._id.month - 1]}/${String(item._id.year).slice(2)}`;
}

function fmtWeek(item: WeekPoint) {
  return `S${String(item._id.week).padStart(2, '0')}`;
}

function Trend({ value, suffix = ' vs. período anterior' }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="text-zinc-400">Sem base de comparação</span>;
  const positive = value >= 0;
  const Icon = positive ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;
  return (
    <span className={positive ? 'text-emerald-700' : 'text-red-700'}>
      <Icon className="mr-1 inline h-3.5 w-3.5" aria-hidden />
      {positive ? '+' : ''}{num(value, 1)}%{suffix}
    </span>
  );
}

function Metric({
  label,
  value,
  detail,
  trend,
}: {
  label: string;
  value: string;
  detail: string;
  trend?: number | null;
}) {
  return (
    <div className="min-w-0 px-5 py-5 first:pl-0 last:pr-0 sm:px-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-zinc-950">{value}</p>
      <p className="mt-1.5 text-xs leading-5 text-zinc-500">
        {trend === undefined ? detail : <><Trend value={trend} /><span className="block text-zinc-400">{detail}</span></>}
      </p>
    </div>
  );
}

function SectionHeading({ title, description, aside }: { title: string; description: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-zinc-950">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
      {aside}
    </div>
  );
}

function Insight({
  tone,
  title,
  body,
}: {
  tone: 'positive' | 'attention' | 'neutral';
  title: string;
  body: string;
}) {
  const Icon = tone === 'positive' ? CheckCircleIcon : tone === 'attention' ? ExclamationTriangleIcon : SparklesIcon;
  const iconClass = tone === 'positive' ? 'text-emerald-600' : tone === 'attention' ? 'text-amber-600' : 'text-indigo-600';
  return (
    <div className="flex gap-3 border-b border-zinc-100 py-4 last:border-0">
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} aria-hidden />
      <div>
        <p className="text-sm font-semibold text-zinc-900">{title}</p>
        <p className="mt-1 text-xs leading-5 text-zinc-500">{body}</p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-7 animate-pulse">
      <div className="h-9 w-64 rounded bg-zinc-200" />
      <div className="h-28 rounded-2xl bg-white ring-1 ring-zinc-200" />
      <div className="grid gap-6 lg:grid-cols-[1.65fr_1fr]">
        <div className="h-96 rounded-2xl bg-white ring-1 ring-zinc-200" />
        <div className="h-96 rounded-2xl bg-white ring-1 ring-zinc-200" />
      </div>
    </div>
  );
}

export default function PlatformUsagePage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('geral');

  const loadData = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/platform-usage', { cache: 'no-store' });
      if (!response.ok) throw new Error('Não foi possível carregar os dados de uso.');
      setData(await response.json());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const derived = useMemo(() => {
    if (!data) return null;
    const activeCount = data.users.planDist.find(plan => plan._id === 'active')?.total ?? 0;
    const paidConversion = percentage(activeCount, data.users.total);
    const loginReach = percentage(data.activity.mauLogin30d, data.users.total);
    const actionReach = percentage(data.activity.actionUsers30d, data.activity.mauLogin30d);
    const stickiness = percentage(data.activity.avgDau30, data.activity.actionUsers30d);
    const userGrowth = relativeGrowth(data.users.new30d, data.users.previous30d);
    const mediaKitGrowth = relativeGrowth(data.mediakit.human30d, data.mediakit.humanPrevious30d);
    const visitsPerVisitor = data.mediakit.uniqueVisitors30d
      ? data.mediakit.human30d / data.mediakit.uniqueVisitors30d
      : 0;
    const topThreeMediaKitShare = percentage(
      data.mediakit.ranking.slice(0, 3).reduce((sum, creator) => sum + creator.visitantesUnicos, 0),
      data.mediakit.ranking.reduce((sum, creator) => sum + creator.visitantesUnicos, 0),
    );
    return {
      activeCount,
      paidConversion,
      loginReach,
      actionReach,
      stickiness,
      userGrowth,
      mediaKitGrowth,
      visitsPerVisitor,
      topThreeMediaKitShare,
    };
  }, [data]);

  if (loading) return <LoadingState />;

  if (error || !data || !derived) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl bg-white p-8 text-center ring-1 ring-zinc-200">
        <ExclamationTriangleIcon className="h-8 w-8 text-amber-500" />
        <p className="mt-3 font-semibold text-zinc-900">Dados indisponíveis</p>
        <p className="mt-1 text-sm text-zinc-500">{error || 'Nenhum dado retornado.'}</p>
        <button onClick={() => void loadData()} className="mt-5 rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white">
          Tentar novamente
        </button>
      </div>
    );
  }

  const updatedAt = new Date(data.generatedAt).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
  const featureRows = [...data.features.byTool].sort((a, b) => b.uniqueUsers - a.uniqueUsers);
  const topFeatureRows = featureRows.slice(0, 7).map(item => ({
    name: toolLabel(item.eventName),
    usuários: item.uniqueUsers,
  }));
  const monthChart = data.mediakit.byMonth.slice(-12).map(item => ({
    month: fmtMonth(item),
    acessos: item.acessos,
    visitantes: item.visitantesUnicos,
  }));
  const weeklyIdeas = data.features.pautas.byWeek.slice(-8).map(item => ({
    week: fmtWeek(item),
    pautas: item.total,
    criadores: item.uniqueUsers,
  }));

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'geral', label: 'Saúde' },
    { key: 'features', label: 'Adoção' },
    { key: 'midia-kit', label: 'Mídia Kit' },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-7 pb-12">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
            <PresentationChartBarIcon className="h-4 w-4" aria-hidden />
            Operação
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-zinc-950">Uso da plataforma</h1>
          <p className="mt-2 text-sm text-zinc-500">Atividade, adoção e sinais de valor em uma única leitura.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-zinc-400 sm:inline">Atualizado {updatedAt}</span>
          <button
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-60"
          >
            <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
            {refreshing ? 'Atualizando' : 'Atualizar'}
          </button>
        </div>
      </header>

      <nav className="flex w-fit gap-1 rounded-full bg-zinc-100 p-1" aria-label="Seções do painel">
        {tabs.map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              tab === item.key ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        {tab === 'geral' && (
          <div className="space-y-8">
            <section>
              <SectionHeading title="Saúde da plataforma" description="Aquisição, receita e uso real nos últimos 30 dias." />
              <div className="grid divide-y divide-zinc-100 rounded-2xl bg-white px-5 ring-1 ring-zinc-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
                <Metric label="Usuários" value={num(data.users.total)} detail={`${num(data.users.new7d)} novos nos últimos 7 dias`} trend={derived.userGrowth} />
                <Metric label="Pagantes ativos" value={num(derived.activeCount)} detail={`${num(derived.paidConversion, 1)}% da base cadastrada`} />
                <Metric label="MAU por login" value={num(data.activity.mauLogin30d)} detail={`${num(derived.loginReach, 1)}% da base entrou em 30 dias`} />
                <Metric label="MAU por ação" value={num(data.activity.actionUsers30d)} detail={`${num(derived.actionReach, 1)}% de quem entrou realizou uma ação`} />
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
              <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200 sm:p-6">
                <SectionHeading
                  title="Ritmo de uso"
                  description="Usuários únicos e eventos registrados por dia."
                  aside={<span className="text-xs text-zinc-400">Pico de {num(data.activity.peakDau)} usuários/dia</span>}
                />
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.activity.dauByDay} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                      <defs>
                        <linearGradient id="usersFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                      <XAxis dataKey="date" tickFormatter={value => value.slice(8)} tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} interval={4} />
                      <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={value => new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR')} />
                      <Area type="monotone" dataKey="users" name="Usuários" stroke="#4f46e5" strokeWidth={2.5} fill="url(#usersFill)" animationDuration={650} />
                      <Area type="monotone" dataKey="events" name="Eventos" stroke="#a1a1aa" strokeWidth={1.5} fill="transparent" animationDuration={700} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-100 pt-4 text-xs text-zinc-500">
                  <span><strong className="text-zinc-900">{num(data.activity.events30d)}</strong> eventos em 30 dias</span>
                  <span><strong className="text-zinc-900">{num(data.activity.avgDau30, 1)}</strong> DAU médio</span>
                  <span><strong className="text-zinc-900">{num(derived.stickiness, 1)}%</strong> aderência diária</span>
                </div>
              </div>

              <aside className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200 sm:p-6">
                <SectionHeading title="Leitura operacional" description="Sinais calculados a partir do período atual." />
                <Insight
                  tone={derived.userGrowth !== null && derived.userGrowth >= 0 ? 'positive' : 'attention'}
                  title={derived.userGrowth === null ? 'Crescimento sem histórico' : `${derived.userGrowth >= 0 ? 'Crescimento' : 'Queda'} de ${num(Math.abs(derived.userGrowth), 1)}%`}
                  body={`${num(data.users.new30d)} novos cadastros agora, contra ${num(data.users.previous30d)} nos 30 dias anteriores.`}
                />
                <Insight
                  tone={derived.actionReach >= 50 ? 'positive' : 'attention'}
                  title={`${num(derived.actionReach, 1)}% dos usuários que entram geram ação`}
                  body="A diferença entre login e ação indica o espaço para melhorar ativação e descoberta de valor."
                />
                <Insight
                  tone={derived.stickiness >= 20 ? 'positive' : 'neutral'}
                  title={`Aderência diária de ${num(derived.stickiness, 1)}%`}
                  body="Relação entre DAU médio e usuários únicos que realizaram ações no período."
                />
                <Insight
                  tone={derived.paidConversion >= 5 ? 'positive' : 'neutral'}
                  title={`${num(derived.paidConversion, 1)}% da base está ativa no plano`}
                  body="Conversão calculada sobre todos os usuários cadastrados."
                />
              </aside>
            </section>

            <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
              <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200 sm:p-6">
                <SectionHeading title="Atividade mensal" description="MAU por ação e média diária por mês instrumentado." />
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.activity.mauByMonth.slice(-8)} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                      <XAxis dataKey="month" tickFormatter={value => value.slice(5)} tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="mau" name="MAU" fill="#4f46e5" radius={[6, 6, 0, 0]} animationDuration={650} />
                      <Bar dataKey="avgDau" name="DAU médio" fill="#c7d2fe" radius={[6, 6, 0, 0]} animationDuration={700} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200 sm:p-6">
                <SectionHeading title="Situação dos planos" description="Composição atual da base cadastrada." />
                <div className="space-y-4">
                  {data.users.planDist.map(plan => {
                    const share = percentage(plan.total, data.users.total);
                    return (
                      <div key={plan._id || 'sem-status'}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="font-medium text-zinc-700">{PLAN_LABELS[plan._id] ?? plan._id ?? 'Sem status'}</span>
                          <span className="text-zinc-400">{num(plan.total)} · {num(share, 1)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${share}%` }} transition={{ duration: 0.55 }} className="h-full rounded-full bg-indigo-500" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <p className="border-t border-zinc-200 pt-4 text-xs leading-5 text-zinc-400">
              “Ação” usa eventos reais do log de uso. “Login” usa a última sessão autenticada registrada por usuário e não reconstrói períodos anteriores à instrumentação.
            </p>
          </div>
        )}

        {tab === 'features' && (
          <div className="space-y-8">
            <section>
              <SectionHeading title="Adoção de recursos" description="Volume e alcance das principais jornadas nos últimos 30 dias." />
              <div className="grid divide-y divide-zinc-100 rounded-2xl bg-white px-5 ring-1 ring-zinc-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
                <Metric label="Pautas geradas" value={num(data.features.pautas.total30d)} detail={`${num(data.features.pautas.users30d)} criadores únicos`} />
                <Metric label="Cálculos de publi" value={num(data.features.publi.total30d)} detail={`${num(data.features.publi.users30d)} criadores · ${num(data.features.publi.total)} histórico`} />
                <Metric label="Diagnósticos de vídeo" value={num(data.features.video.total30d)} detail="processados nos últimos 30 dias" />
                <Metric label="Criadores no mapa" value={num(data.features.mapa.total)} detail={`${num(data.features.mapa.confirmations30d)} confirmações em 30 dias`} />
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200 sm:p-6">
                <SectionHeading title="Alcance por recurso" description="Criadores únicos que usaram cada ferramenta." />
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topFeatureRows} layout="vertical" margin={{ top: 4, right: 16, left: 18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f4f4f5" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={126} tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="usuários" fill="#4f46e5" radius={[0, 6, 6, 0]} animationDuration={650} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200 sm:p-6">
                <SectionHeading title="Ritmo de pautas" description="Produção e criadores únicos nas últimas oito semanas." />
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyIdeas} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="pautas" fill="#4f46e5" radius={[5, 5, 0, 0]} />
                      <Bar dataKey="criadores" fill="#c7d2fe" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
              <div className="border-b border-zinc-100 px-5 py-5 sm:px-6">
                <SectionHeading title="Eficiência por ferramenta" description="Alcance, recorrência e participação mobile por evento instrumentado." />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/70 text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-400">
                      <th className="px-6 py-3 text-left">Ferramenta</th>
                      <th className="px-4 py-3 text-right">Usuários</th>
                      <th className="px-4 py-3 text-right">Adoção</th>
                      <th className="px-4 py-3 text-right">Eventos</th>
                      <th className="px-4 py-3 text-right">Eventos/usuário</th>
                      <th className="px-6 py-3 text-right">Mobile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {featureRows.map(item => {
                      const adoption = percentage(item.uniqueUsers, data.activity.actionUsers30d);
                      const intensity = item.uniqueUsers ? item.total / item.uniqueUsers : 0;
                      const mobileShare = percentage(item.mobileTotal, item.total);
                      return (
                        <tr key={item.eventName} className="border-b border-zinc-100 transition hover:bg-indigo-50/30 last:border-0">
                          <td className="px-6 py-3.5 font-medium text-zinc-900">{toolLabel(item.eventName)}</td>
                          <td className="px-4 py-3.5 text-right font-semibold text-zinc-900">{num(item.uniqueUsers)}</td>
                          <td className="px-4 py-3.5 text-right text-zinc-500">{num(adoption, 1)}%</td>
                          <td className="px-4 py-3.5 text-right text-zinc-500">{num(item.total)}</td>
                          <td className="px-4 py-3.5 text-right text-zinc-500">{num(intensity, 1)}×</td>
                          <td className="px-6 py-3.5 text-right">
                            <span className="inline-flex items-center gap-1.5 text-zinc-500"><DevicePhoneMobileIcon className="h-4 w-4" />{num(mobileShare)}%</span>
                          </td>
                        </tr>
                      );
                    })}
                    {featureRows.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-zinc-400">Sem eventos instrumentados no período.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {tab === 'midia-kit' && (
          <div className="space-y-8">
            <section>
              <SectionHeading title="Distribuição do Mídia Kit" description="Audiência humana, recorrência e alcance dos kits públicos." />
              <div className="grid divide-y divide-zinc-100 rounded-2xl bg-white px-5 ring-1 ring-zinc-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
                <Metric label="Acessos em 30 dias" value={num(data.mediakit.human30d)} detail={`${num(data.mediakit.humanTotal)} no histórico`} trend={derived.mediaKitGrowth} />
                <Metric label="Visitantes únicos" value={num(data.mediakit.uniqueVisitors30d)} detail={`${num(derived.visitsPerVisitor, 1)} acessos por visitante`} />
                <Metric label="Criadores alcançados" value={num(data.mediakit.creators30d)} detail="kits com ao menos um acesso no período" />
                <Metric label="Concentração Top 3" value={`${num(derived.topThreeMediaKitShare, 1)}%`} detail="dos visitantes únicos do ranking" />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200 sm:p-6">
              <SectionHeading title="Audiência mensal" description="Acessos humanos e visitantes únicos nos últimos 12 meses." />
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthChart} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="acessos" name="Acessos" fill="#4f46e5" radius={[6, 6, 0, 0]} animationDuration={650} />
                    <Bar dataKey="visitantes" name="Visitantes únicos" fill="#c7d2fe" radius={[6, 6, 0, 0]} animationDuration={700} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
              <div className="border-b border-zinc-100 px-5 py-5 sm:px-6">
                <SectionHeading title="Kits com maior audiência" description="Ranking histórico sem tráfego identificado como bot ou crawler." />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/70 text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-400">
                      <th className="px-6 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">Criador</th>
                      <th className="px-4 py-3 text-right">Visitantes</th>
                      <th className="px-4 py-3 text-right">Acessos</th>
                      <th className="px-4 py-3 text-right">Recorrência</th>
                      <th className="px-4 py-3 text-right">Seguidores</th>
                      <th className="px-6 py-3 text-left">Plano</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.mediakit.ranking.map((creator, index) => {
                      const frequency = creator.visitantesUnicos ? creator.acessosTotais / creator.visitantesUnicos : 0;
                      return (
                        <tr key={`${creator.username ?? creator.name}-${index}`} className="border-b border-zinc-100 transition hover:bg-indigo-50/30 last:border-0">
                          <td className="px-6 py-3.5 text-xs text-zinc-400">{String(index + 1).padStart(2, '0')}</td>
                          <td className="px-4 py-3.5">
                            <p className="font-medium text-zinc-900">{creator.name}</p>
                            <p className="mt-0.5 text-xs text-zinc-400">{creator.username ? `@${creator.username}` : 'Sem handle'}</p>
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold text-zinc-900">{num(creator.visitantesUnicos)}</td>
                          <td className="px-4 py-3.5 text-right text-zinc-500">{num(creator.acessosTotais)}</td>
                          <td className="px-4 py-3.5 text-right text-zinc-500">{num(frequency, 1)}×</td>
                          <td className="px-4 py-3.5 text-right text-zinc-500">{creator.followers ? num(creator.followers) : '—'}</td>
                          <td className="px-6 py-3.5">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PLAN_BADGES[creator.planStatus] ?? 'bg-zinc-100 text-zinc-600'}`}>
                              {PLAN_LABELS[creator.planStatus] ?? creator.planStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </motion.div>
    </div>
  );
}
