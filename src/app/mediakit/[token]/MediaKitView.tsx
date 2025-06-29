'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Script from 'next/script';
import { motion } from 'framer-motion';
import { FaChartLine, FaTrophy, FaEnvelope, FaArrowUp, FaArrowDown, FaEye, FaComments, FaShare, FaBookmark, FaSpinner, FaUsers, FaHeart, FaCalendarAlt } from 'react-icons/fa';

// Componentes
import VideosTable from '@/app/admin/creator-dashboard/components/VideosTable';
import { UserAvatar } from '@/app/components/UserAvatar';
import AverageMetricRow from '@/app/dashboard/components/AverageMetricRow';
import PostDetailModal from '@/app/admin/creator-dashboard/PostDetailModal';

// Tipos
import { MediaKitViewProps, KpiComparison } from '@/types/mediakit';

// --- Micro-Componentes Internos ---

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
    const Icon = isPositive ? FaArrowUp : FaArrowDown;
    return (
        <span className={`inline-flex items-center gap-1 ml-2 text-xs font-semibold`} title={`Variação de ${value.toFixed(1)}% em relação ao período anterior`}>
            <Icon className={`w-2.5 h-2.5 ${colorClass}`} />
            <span className={colorClass}>{Math.abs(value).toFixed(1)}%</span>
        </span>
    );
};

const KpiValue: React.FC<{ value: number | null | undefined, type: 'number' | 'percent' }> = ({ value, type }) => {
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

// --- Componente Principal da View ---

export default function MediaKitView({ user, summary, videos, kpis: initialKpis }: MediaKitViewProps) {
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

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      {process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN && (
        <Script
          src="https://plausible.io/js/script.js"
          data-domain={process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN}
          strategy="lazyOnload"
        />
      )}
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
            
            <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={1} className={cardStyle}>
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
                    <KeyMetric icon={<FaUsers className="w-5 h-5"/>} value={compactNumberFormat(kpiData?.avgReachPerPost?.currentValue ?? null)} label="Alcance Médio" />
                    <KeyMetric icon={<FaHeart className="w-5 h-5"/>} value={`${kpiData?.engagementRate?.currentValue?.toFixed(2) ?? '0'}%`} label="Taxa de Engaj." />
                    <KeyMetric icon={<FaCalendarAlt className="w-5 h-5"/>} value={`${kpiData?.postingFrequency?.currentValue?.toFixed(1) ?? '0'}`} label="Posts/Semana" />
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Médias Detalhadas por Post</h3>
                  <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                    {isLoading ? <FaSpinner className="animate-spin text-pink-500 mx-auto my-10 h-6 w-6" /> : (
                      <div className="space-y-1">
                        <AverageMetricRow icon={<FaEye className="w-4 h-4"/>} label="Visualizações" value={kpiData?.avgViewsPerPost?.currentValue} />
                        <AverageMetricRow icon={<FaComments className="w-4 h-4"/>} label="Comentários" value={kpiData?.avgCommentsPerPost?.currentValue} />
                        <AverageMetricRow icon={<FaShare className="w-4 h-4"/>} label="Compartilhamentos" value={kpiData?.avgSharesPerPost?.currentValue} />
                        <AverageMetricRow icon={<FaBookmark className="w-4 h-4"/>} label="Salvos" value={kpiData?.avgSavesPerPost?.currentValue} />
                      </div>
                    )}
                  </div>
                </div>

                {kpiData && !isLoading && (
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Crescimento de Seguidores</h3>
                    <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                      <p className="text-2xl font-bold text-gray-900 mt-1 flex items-center">
                        <KpiValue value={kpiData.followerGrowth?.currentValue} type="number" />
                        <TrendIndicator value={kpiData.followerGrowth?.percentageChange} />
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Novos seguidores no período selecionado.</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </aside>

          <main className="lg:col-span-2 space-y-8">
            <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={0.5} className={cardStyle}>
              <div className="flex items-center gap-3 mb-6">
                <FaTrophy className="w-6 h-6 text-pink-500" />
                <h2 className="text-2xl font-bold text-gray-800">Top Posts em Performance</h2>
              </div>
              <p className="text-gray-600 mb-6 font-light">Uma amostra do conteúdo de maior impacto. <span className="font-medium text-gray-700">Clique em um post para ver a análise detalhada.</span></p>
              
              {/* CORREÇÃO: Removidas as props 'sortConfig' e 'primaryMetric' que não são mais usadas */}
              <VideosTable 
                videos={videos} 
                readOnly 
                onRowClick={handleVideoClick}
              />
            </motion.div>
          </main>
        </div>
        
        <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={2}>
          <div className="mt-12 bg-gray-800 text-white text-center p-8 lg:p-12 rounded-xl shadow-2xl">
            <FaEnvelope className="w-10 h-10 mx-auto mb-4 text-pink-500"/>
            <h3 className="text-3xl lg:text-4xl font-bold mb-3">Pronto para Criar um Impacto Juntos?</h3>
            <p className="mb-8 text-gray-300 max-w-2xl mx-auto font-light">Disponível para parcerias e projetos de publicidade. Entre em contato para discutirmos como podemos colaborar.</p>
            <a href={`mailto:${user.email}`} className="inline-block bg-pink-500 text-white px-10 py-4 rounded-lg font-semibold text-lg hover:bg-pink-600 transform hover:scale-105 transition-all duration-300 shadow-lg">
              Enviar Proposta por E-mail
            </a>
          </div>
        </motion.div>
      </div>

      <PostDetailModal
        isOpen={selectedPostId !== null}
        onClose={handleCloseModal}
        postId={selectedPostId}
      />
    </div>
  );
}