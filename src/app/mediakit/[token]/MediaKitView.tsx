'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { LightBulbIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import VideosTable from '@/app/admin/creator-dashboard/components/VideosTable';
import { UserAvatar } from '@/app/components/UserAvatar';
import AverageMetricRow from '@/app/dashboard/components/AverageMetricRow';
import PostDetailModal from '@/app/admin/creator-dashboard/PostDetailModal';
import { MediaKitViewProps, VideoListItem, KpiComparison, DemographicsData } from '@/types/mediakit';

// Placeholder para Ícones (sem alterações)
const FaIcon = ({ path, className = "w-5 h-5" }: { path: string, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className={className} fill="currentColor">
    <path d={path} />
  </svg>
);

const ICONS = {
  trophy: "M512 32H0v320c0 35.3 28.7 64 64 64h128v32H96c-17.7 0-32 14.3-32 32s14.3 32 32 32h320c17.7 0 32-14.3 32-32s-14.3-32-32-32h-96v-32h128c35.3 0 64-28.7 64-64V32zM384 224c0 26.5-21.5 48-48 48s-48-21.5-48-48s21.5-48 48-48s48 21.5 48 48zM128 176c-26.5 0-48 21.5-48 48s21.5 48 48 48s48-21.5 48-48s-21.5-48-48-48z",
  envelope: "M48 64C21.5 64 0 85.5 0 112v288c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zM64 112h384c8.8 0 16 7.2 16 16v31.2L294.1 294.1c-20.2 18.2-50.6 18.2-70.8 0L48 159.2V128c0-8.8 7.2-16 16-16zm384 288H64c-8.8 0-16-7.2-16-16V190.8l152.1 136.9c31.6 28.3 78.2 28.3 109.8 0L464 190.8V384c0 8.8-7.2 16-16 16z",
  arrowUp: "M233.4 105.4c12.5-12.5 32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L256 173.3 86.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l192-192z",
  arrowDown: "M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z",
  eye: "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-144c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32z",
  comments: "M512 240c0 114.9-114.6 208-256 208S0 354.9 0 240C0 125.1 114.6 32 256 32s256 93.1 256 208zM406.5 224h-61.2c-6.7 0-12.6 4.2-15.1 10.4s-1.6 13.5 2.2 18.7l34.6 46.1c6.1 8.1 17.5 9.4 25.6 3.3s9.4-17.5 3.3-25.6l-21.4-28.5c1.1-1.6 2.6-3 4.3-4.1l21.4-14.2c8.3-5.5 10.8-16.5 5.3-24.8s-16.5-10.8-24.8-5.3l-21.4 14.2zM105.5 224h61.2c6.7 0 12.6 4.2 15.1 10.4s1.6 13.5-2.2 18.7l-34.6 46.1c-6.1 8.1-17.5 9.4-25.6 3.3s-9.4-17.5-3.3-25.6l21.4-28.5c-1.1-1.6-2.6-3-4.3-4.1l-21.4-14.2c-8.3-5.5-10.8-16.5-5.3-24.8s16.5-10.8 24.8-5.3l21.4 14.2z",
  share: "M448 248L288 96v80c-141.2 0-256 114.8-256 256 0 44.2 35.8 80 80 80 8.8 0 16-7.2 16-16s-7.2-16-16-16c-26.5 0-48-21.5-48-48 0-88.2 71.8-160 160-160v80l160-152z",
  bookmark: "M0 48C0 21.5 21.5 0 48 0h288c26.5 0 48 21.5 48 48v416l-192-96L48 464V48z",
  spinner: "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-144c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32z",
  users: "M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z",
  heart: "M47.6 300.4L228.3 469.1c7.5 7 17.4 10.9 27.7 10.9s20.2-3.9 27.7-10.9L464.4 300.4c30.4-28.3 47.6-68 47.6-109.5v-5.8c0-69.9-50.5-129.5-119.4-141C347 36.5 300.6 51.4 268 84L256 96 244 84c-32.6-32.6-79-47.5-124.6-39.9C50.5 55.6 0 115.2 0 185.1v5.8c0 41.5 17.2 81.2 47.6 109.5z",
  calendar: "M448 64H352V32c0-17.7-14.3-32-32-32s-32 14.3-32 32v32H160V32c0-17.7-14.3-32-32-32s-32 14.3-32 32v32H48C21.5 64 0 85.5 0 112v352c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48zm-64 352H128V224h256v192z",
  gender: "M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z",
  cake: "M512 32H0v320c0 35.3 28.7 64 64 64h128v32H96c-17.7 0-32 14.3-32 32s14.3 32 32 32h320c17.7 0 32-14.3 32-32s-14.3-32-32-32h-96v-32h128c35.3 0 64-28.7 64-64V32zM256 224c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32z",
  mapPin: "M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 256c-35.3 0-64-28.7-64-64s28.7-64 64-64s64 28.7 64 64s-28.7 64-64 64z"
};

// --- Micro-Componentes Internos (sem alterações) ---

const KeyMetric: React.FC<{ icon: React.ReactNode; value: string; label: string }> = ({ icon, value, label }) => (
  <div className="flex flex-col items-center text-center p-2">
    <div className="text-pink-500">{icon}</div>
    <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
    <p className="text-xs text-gray-500 mt-1">{label}</p>
  </div>
);

const TrendIndicator: React.FC<{ value: number | null }> = ({ value }) => {
  if (value === null || value === undefined) return null;
  const isPositive = value >= 0;
  const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
  const Icon = isPositive ? <FaIcon path={ICONS.arrowUp} /> : <FaIcon path={ICONS.arrowDown} />;
  return (
    <span
      className={`inline-flex items-center gap-1 ml-2 text-xs font-semibold`}
      title={`Variação de ${value.toFixed(1)}% em relação ao período anterior`}
    >
      <span className={`w-2.5 h-2.5 ${colorClass}`}>{Icon}</span>
      <span className={colorClass}>{Math.abs(value).toFixed(1)}%</span>
    </span>
  );
};

const KpiValue: React.FC<{ value: number | null | undefined; type: 'number' | 'percent' }> = ({ value, type }) => {
  const [formattedValue, setFormattedValue] = useState<string>('...');
  useEffect(() => {
    if (value === null || value === undefined) {
      setFormattedValue('N/A');
      return;
    }
    if (type === 'percent') {
      setFormattedValue(`${value.toFixed(2)}%`);
    } else {
      setFormattedValue(`+${value.toLocaleString('pt-BR')}`);
    }
  }, [value, type]);
  return <>{formattedValue}</>;
};

// --- Funções Auxiliares de Demografia (sem alterações) ---

const genderLabelMap: Record<string, string> = {
  f: 'Feminino',
  m: 'Masculino',
  u: 'Desconhecido',
};

const genderSummaryMap: Record<string, string> = {
  f: 'feminino',
  m: 'masculino',
  u: 'desconhecido',
};

const getTopEntry = (data: Record<string, number> | undefined): [string, number] | null => {
  if (!data || Object.keys(data).length === 0) return null;
  return Object.entries(data).reduce((a, b) => (a[1] > b[1] ? a : b));
};

const generateDemographicSummary = (demographics: DemographicsData | null): string => {
  if (!demographics?.follower_demographics) return "Dados demográficos não disponíveis.";
  
  const { gender, age, city, country } = demographics.follower_demographics;

  const topGenderEntry = getTopEntry(gender);
  const topAgeEntry = getTopEntry(age);
  const topCityEntry = getTopEntry(city);
  const topCountryEntry = getTopEntry(country);

  const topLocation = topCityEntry?.[0] || topCountryEntry?.[0];

  if (!topGenderEntry || !topAgeEntry || !topLocation) {
    return "Perfil de público diversificado.";
  }
  
  const dominantGender =
    genderSummaryMap[topGenderEntry[0].toLowerCase()] || topGenderEntry[0];

  return `Mais popular entre o público ${dominantGender}, ${topAgeEntry[0]} anos, em ${topLocation}.`;
};

// --- Componentes de UI para Demografia (sem alterações) ---

const DemographicRow: React.FC<{ label: string; percentage: number; compact?: boolean }> = ({ label, percentage, compact }) => {
  const displayLabel = compact ? label.split(',')[0] : label;
  const containerClasses = compact ? 'flex items-center justify-between text-xs py-0.5' : 'flex items-center justify-between text-sm py-1';
  return (
    <div className={containerClasses}>
      <span className="text-gray-600">{displayLabel}</span>
      <div className="flex items-center gap-2 w-2/3">
        <div className="w-full bg-gray-200/70 rounded-full h-2 overflow-hidden">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-brand-pink to-pink-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="font-semibold text-gray-800">{percentage.toFixed(1)}%</span>
      </div>
    </div>
  );
};


// --- Componente Principal da View ---

export default function MediaKitView({ user, summary, videos, kpis: initialKpis, demographics }: MediaKitViewProps) {
  const cardVariants = { hidden: { opacity: 0, y: 20 }, visible: (i: number = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" } }) };

  const PERIOD_OPTIONS = useMemo(() => [
    { value: 'last_7d_vs_previous_7d', label: 'Últimos 7 dias' },
    { value: 'last_30d_vs_previous_30d', label: 'Últimos 30 dias' },
  ], []);

  const [comparisonPeriod, setComparisonPeriod] = useState<string>(initialKpis?.comparisonPeriod || 'last_30d_vs_previous_30d');
  const [kpiData, setKpiData] = useState<KpiComparison | null>(initialKpis);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    async function fetchData() {
      if (!user?._id) return;
      setIsLoading(true);
      try {
        const res = await fetch(`/api/v1/users/${user._id}/kpis/periodic-comparison?comparisonPeriod=${comparisonPeriod}`);
        setKpiData(res.ok ? await res.json() : null);
      } catch (err) {
        console.error('Erro ao buscar KPIs', err);
        setKpiData(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [comparisonPeriod, user?._id]);

  const handleVideoClick = (postId: string) => { setSelectedPostId(postId); };
  const handleCloseModal = () => { setSelectedPostId(null); };

  const cardStyle = "bg-white p-6 sm:p-8 rounded-xl shadow-lg border-t-4 border-pink-500";
  const compactNumberFormat = (num: number | null | undefined) => num?.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }) ?? '...';

  const demographicSummary = useMemo(() => generateDemographicSummary(demographics), [demographics]);

  const demographicBreakdowns = useMemo(() => {
    if (!demographics?.follower_demographics) return null;
    
    const { gender, age, city } = demographics.follower_demographics;

    const calculatePercentages = (data: Record<string, number> | undefined) => {
      if (!data) return [];
      const total = Object.values(data).reduce((sum, count) => sum + count, 0);
      if (total === 0) return [];
      return Object.entries(data)
        .map(([label, count]) => ({ label, percentage: (count / total) * 100 }))
        .sort((a, b) => b.percentage - a.percentage);
    };

    return {
      gender: calculatePercentages(gender),
      age: calculatePercentages(age).slice(0, 5), // Top 5
      location: calculatePercentages(city).slice(0, 3), // Top 3
    };
  }, [demographics]);

  // *** INÍCIO DA CORREÇÃO DEFINITIVA ***
  // Esta função corrige os dados dos vídeos antes de passá-los para a tabela.
  // Ela garante que 'stats.views' sempre tenha um valor, usando 'stats.reach' como fallback.
  // Isso resolve a inconsistência de dados da API e garante que a tabela e os cálculos
  // de engajamento funcionem como esperado.
  const videosWithCorrectStats = useMemo(() => {
    if (!Array.isArray(videos)) {
        return [];
    }
    return videos.map(video => {
        // Clona o objeto para evitar mutação direta da prop
        const newVideo = JSON.parse(JSON.stringify(video));

        // Garante que o objeto de stats exista
        if (!newVideo.stats) {
            newVideo.stats = {};
        }

        // Se 'views' não estiver definido, usa 'reach' como valor.
        // Esta é a correção principal para os dados que alimentam a VideosTable.
        if (newVideo.stats.views === undefined || newVideo.stats.views === null) {
            newVideo.stats.views = newVideo.stats.reach;
        }
        
        return newVideo;
    });
  }, [videos]);
  // *** FIM DA CORREÇÃO DEFINITIVA ***

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
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
              {user.biography && <p className="text-gray-600 mt-5 text-center whitespace-pre-line font-light">{user.biography}</p>}
            </motion.div>
            
            {demographics && demographicBreakdowns && (
              <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={1} className={cardStyle}>
                <h2 className="text-xl font-bold text-gray-800 mb-4">Demografia do Público</h2>
                <div className="mb-6 p-3 text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                  <LightBulbIcon className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                  <span>{demographicSummary}</span>
                </div>
                <div className="space-y-5">
                  {demographicBreakdowns.gender.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Gênero</h3>
                      <div className="space-y-1">
                        {demographicBreakdowns.gender.map(item => (
                          <DemographicRow
                            key={item.label}
                            label={genderLabelMap[item.label.toLowerCase()] || item.label}
                            percentage={item.percentage}
                            compact
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {demographicBreakdowns.age.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Faixas Etárias</h3>
                      <div className="space-y-1">
                        {demographicBreakdowns.age.map(item => (
                          <DemographicRow
                            key={item.label}
                            label={item.label}
                            percentage={item.percentage}
                            compact
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {demographicBreakdowns.location.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Cidades</h3>
                      <div className="space-y-1">
                        {demographicBreakdowns.location.map(item => (
                          <DemographicRow key={item.label} label={item.label} percentage={item.percentage} compact />
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
                <select className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-pink-500 focus:border-pink-500" value={comparisonPeriod} onChange={(e) => setComparisonPeriod(e.target.value)} disabled={isLoading}>
                  {PERIOD_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div className={`transition-opacity duration-300 ${isLoading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Números-Chave</h3>
                  <div className="grid grid-cols-3 divide-x divide-gray-200 bg-gray-50 p-2 rounded-lg">
                    <KeyMetric icon={<FaIcon path={ICONS.users}/>} value={compactNumberFormat(kpiData?.avgReachPerPost?.currentValue ?? null)} label="Alcance Médio" />
                    <KeyMetric icon={<FaIcon path={ICONS.heart}/>} value={`${kpiData?.engagementRate?.currentValue?.toFixed(2) ?? '0'}%`} label="Taxa de Engaj." />
                    <KeyMetric icon={<FaIcon path={ICONS.calendar}/>} value={`${kpiData?.postingFrequency?.currentValue?.toFixed(1) ?? '0'}`} label="Posts/Semana" />
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Médias Detalhadas por Post</h3>
                  <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                    {isLoading ? <FaIcon path={ICONS.spinner} className="animate-spin text-pink-500 mx-auto my-10 h-6 w-6" /> : (
                      <div className="space-y-1">
                        {/* *** APLICANDO A CORREÇÃO AQUI *** */}
                        <AverageMetricRow icon={<FaIcon path={ICONS.eye} className="w-4 h-4"/>} label="Visualizações" value={kpiData?.avgReachPerPost?.currentValue} />
                        <AverageMetricRow icon={<FaIcon path={ICONS.heart} className="w-4 h-4"/>} label="Curtidas" value={kpiData?.avgLikesPerPost?.currentValue} />
                        <AverageMetricRow icon={<FaIcon path={ICONS.comments} className="w-4 h-4"/>} label="Comentários" value={kpiData?.avgCommentsPerPost?.currentValue} />
                        <AverageMetricRow icon={<FaIcon path={ICONS.share} className="w-4 h-4"/>} label="Compartilhamentos" value={kpiData?.avgSharesPerPost?.currentValue} />
                        <AverageMetricRow icon={<FaIcon path={ICONS.bookmark} className="w-4 h-4"/>} label="Salvos" value={kpiData?.avgSavesPerPost?.currentValue} />
                      </div>
                    )}
                  </div>
                </div>

                {kpiData && !isLoading && (
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Crescimento de Seguidores</h3>
                    <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                      {user.followers_count !== undefined && (
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          {user.followers_count.toLocaleString('pt-BR')}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">Seguidores totais</p>
                      <p className="text-sm text-gray-700 mt-3 flex items-center">
                        <KpiValue value={kpiData.followerGrowth?.currentValue} type="number" />
                        <TrendIndicator value={kpiData.followerGrowth?.percentageChange ?? null} />
                        <span className="ml-1 text-gray-500">no período selecionado</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </aside>

          <main className="lg:col-span-2 space-y-8">
            <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={0.5} className={cardStyle}>
              <div className="flex items-center gap-3 mb-6">
                <FaIcon path={ICONS.trophy} className="w-6 h-6 text-pink-500" />
                <h2 className="text-2xl font-bold text-gray-800">Top Posts em Performance</h2>
              </div>
              <p className="text-gray-600 mb-6 font-light">Uma amostra do conteúdo de maior impacto, agora com a classificação completa. <span className="font-medium text-gray-700">Clique em um post para ver a análise detalhada.</span></p>

              {/* *** APLICANDO A CORREÇÃO AQUI *** */}
              <VideosTable
                videos={videosWithCorrectStats}
                readOnly
                onRowClick={handleVideoClick}
              />
            </motion.div>
          </main>
        </div>

        <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={2}>
          <div className="mt-12 bg-gray-800 text-white text-center p-8 lg:p-12 rounded-xl shadow-2xl">
            <FaIcon path={ICONS.envelope} className="w-10 h-10 mx-auto mb-4 text-pink-500"/>

            <h3 className="text-3xl lg:text-4xl font-bold mb-3">
              Inteligência Criativa: A Fórmula da Alta Performance.
            </h3>

            <p className="mb-8 text-gray-300 max-w-2xl mx-auto font-light">
              Nós decodificamos o DNA da audiência de cada criador. Com dados exclusivos, guiamos a narrativa da sua campanha, definindo o formato, contexto e horário ideais para gerar o máximo de engajamento e compartilhamentos.
            </p>

            <a
              href="mailto:arthur@data2content.ai?subject=Desenho de Campanha Inteligente para [Nome da Marca]"
              className="inline-block bg-pink-500 text-white px-10 py-4 rounded-lg font-semibold text-lg hover:bg-pink-600 transform hover:scale-105 transition-all duration-300 shadow-lg"
            >
              Desenhar Campanha Inteligente
            </a>
          </div>
        </motion.div>
      </div>

      <PostDetailModal
        isOpen={selectedPostId !== null}
        onClose={handleCloseModal}
        postId={selectedPostId}
        publicMode
      />
    </div>
  );
}
