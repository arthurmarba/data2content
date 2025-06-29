// src/app/mediakit/[token]/MediaKitView.tsx (CORRIGIDO)
'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FaChartLine, FaTrophy, FaStar, FaChartBar, FaEnvelope, FaArrowUp, FaArrowDown } from 'react-icons/fa';

import VideosTable from '@/app/admin/creator-dashboard/components/VideosTable';
import IndicatorCard from '@/app/dashboard/components/IndicatorCard';
import MetricCardWithTrend from '@/app/dashboard/components/MetricCardWithTrend';
import { UserAvatar } from '@/app/components/UserAvatar';
import { MediaKitViewProps } from '@/types/mediakit';

const TrendIndicator: React.FC<{ value: number | null }> = ({ value }) => {
    if (value === null || value === undefined) return null;
    const isPositive = value >= 0;
    const colorClass = isPositive ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100';
    const Icon = isPositive ? FaArrowUp : FaArrowDown;
    return (
        <span className={`inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>
            <Icon className="w-3 h-3" />
            {value.toFixed(1)}%
        </span>
    );
};

export default function MediaKitView({ user, summary, videos, kpis }: MediaKitViewProps) {
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" }
    })
  };

  const PERIOD_OPTIONS = [
    { value: 'month_vs_previous', label: 'Mês vs. Anterior' },
    { value: 'last_7d_vs_previous_7d', label: '7d vs. 7d Anteriores' },
    { value: 'last_30d_vs_previous_30d', label: '30d vs. 30d Anteriores' }
  ];
  const [comparisonPeriod, setComparisonPeriod] = useState<string>(PERIOD_OPTIONS[2].value);
  const [kpiData, setKpiData] = useState<typeof kpis>(kpis);

  const METRIC_OPTIONS = [
    { key: 'followerGrowth', label: 'Pulso do Crescimento' },
    { key: 'engagementRate', label: 'Conexão com a Audiência' },
    { key: 'postingFrequency', label: 'Consistência e Alcance' },
    { key: 'avgViewsPerPost', label: 'Média de Visualizações' },
    { key: 'avgCommentsPerPost', label: 'Média de Comentários' },
    { key: 'avgSharesPerPost', label: 'Média de Compartilhamentos' },
    { key: 'avgSavesPerPost', label: 'Média de Salvamentos' },
  ] as const;
  const [visibleMetrics, setVisibleMetrics] = useState<Record<string, boolean>>(
    METRIC_OPTIONS.reduce((acc, opt) => ({ ...acc, [opt.key]: true }), {} as Record<string, boolean>)
  );

  function toggleMetric(key: string) {
    setVisibleMetrics((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  useEffect(() => {
    async function fetchData() {
      if (!user?._id) return;
      try {
        const res = await fetch(`/api/v1/users/${user._id}/kpis/periodic-comparison?comparisonPeriod=${comparisonPeriod}`);
        if (res.ok) {
          const data = await res.json();
          setKpiData(data);
        }
      } catch (err) {
        console.error('Erro ao buscar KPIs', err);
      }
    }
    fetchData();
  }, [comparisonPeriod, user?._id]);

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
          <aside className="lg:col-span-1 space-y-8 lg:sticky lg:top-8 self-start">
            <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={0}>
              <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg border-t-4 border-pink-500">
                <div className="flex flex-col items-center text-center gap-4">
                  <UserAvatar name={user.name || 'Criador'} src={user.profile_picture_url} size={96} />
                  <div>
                    <h1 className="text-3xl font-bold text-gray-800">{user.name}</h1>
                    {user.username && <p className="text-gray-500 text-lg">@{user.username}</p>}
                  </div>
                </div>
                {user.biography && <p className="text-gray-600 mt-5 text-center whitespace-pre-line font-light">{user.biography}</p>}
              </div>
            </motion.div>
            {(summary || kpiData) && (
              <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={1}>
                <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg border-t-4 border-pink-500 space-y-6">
                  <div className="flex items-center gap-3">
                    <FaChartLine className="w-6 h-6 text-pink-500" />
                    <h2 className="text-xl font-bold text-gray-800 flex-grow">Performance e Destaques</h2>
                    <select
                      className="text-sm border-gray-300 rounded-md"
                      value={comparisonPeriod}
                      onChange={(e) => setComparisonPeriod(e.target.value)}
                    >
                      {PERIOD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <details className="ml-2 text-sm">
                      <summary className="cursor-pointer select-none">Métricas</summary>
                      <div className="mt-2 bg-white p-2 border rounded shadow-md absolute z-10">
                        {METRIC_OPTIONS.map((opt) => (
                          <label key={opt.key} className="block whitespace-nowrap">
                            <input
                              type="checkbox"
                              className="mr-1"
                              checked={visibleMetrics[opt.key]}
                              onChange={() => toggleMetric(opt.key)}
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    </details>
                  </div>
                  {kpiData && (
                    <div className="space-y-4">
                      {visibleMetrics.followerGrowth && (
                        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                          <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                            Pulso do Crescimento
                            <TrendIndicator value={kpiData.followerGrowth?.percentageChange} />
                          </h3>
                          <p className="text-3xl font-bold text-gray-900 mt-1">{kpiData.followerGrowth?.currentValue?.toLocaleString() ?? 'N/A'}</p>
                          <p className="text-xs text-gray-500 mt-1">{kpiData.insightSummary?.followerGrowth}</p>
                        </div>
                      )}
                      {visibleMetrics.engagementRate && (
                        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                          <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                            Conexão com a Audiência
                            <TrendIndicator value={kpiData.engagementRate?.percentageChange} />
                          </h3>
                          <p className="text-3xl font-bold text-gray-900 mt-1">{kpiData.engagementRate?.currentValue?.toFixed(2) ?? 'N/A'}%</p>
                          <p className="text-xs text-gray-500 mt-1">{kpiData.insightSummary?.engagementRate}</p>
                        </div>
                      )}
                      {visibleMetrics.postingFrequency && (
                        <MetricCardWithTrend
                          label="Consistência e Alcance"
                          value={kpiData.postingFrequency?.currentValue?.toFixed(1)}
                          trendData={kpiData.postingFrequency?.chartData?.map((c) => c.value)}
                          recommendation={kpiData.insightSummary?.postingFrequency || ''}
                        />
                      )}
                      {visibleMetrics.avgViewsPerPost && (
                        <MetricCardWithTrend
                          label="Média de Visualizações"
                          value={kpiData.avgViewsPerPost?.currentValue?.toFixed(0)}
                          trendData={kpiData.avgViewsPerPost?.chartData?.map((c) => c.value)}
                          recommendation=""
                        />
                      )}
                      {visibleMetrics.avgCommentsPerPost && (
                        <MetricCardWithTrend
                          label="Média de Comentários"
                          value={kpiData.avgCommentsPerPost?.currentValue?.toFixed(0)}
                          trendData={kpiData.avgCommentsPerPost?.chartData?.map((c) => c.value)}
                          recommendation=""
                        />
                      )}
                      {visibleMetrics.avgSharesPerPost && (
                        <MetricCardWithTrend
                          label="Média de Compartilhamentos"
                          value={kpiData.avgSharesPerPost?.currentValue?.toFixed(0)}
                          trendData={kpiData.avgSharesPerPost?.chartData?.map((c) => c.value)}
                          recommendation=""
                        />
                      )}
                      {visibleMetrics.avgSavesPerPost && (
                        <MetricCardWithTrend
                          label="Média de Salvamentos"
                          value={kpiData.avgSavesPerPost?.currentValue?.toFixed(0)}
                          trendData={kpiData.avgSavesPerPost?.chartData?.map((c) => c.value)}
                          recommendation=""
                        />
                      )}
                    </div>
                  )}
                  {summary && (
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                      {summary.topPerformingFormat && <IndicatorCard title="Formato em Destaque" value={summary.topPerformingFormat.name} description={`Gera em média ${summary.topPerformingFormat.valueFormatted} de ${summary.topPerformingFormat.metricName}`} icon={<FaStar className="text-yellow-400"/>} />}
                      {summary.topPerformingContext && <IndicatorCard title="Contexto de Sucesso" value={summary.topPerformingContext.name} description={`Gera em média ${summary.topPerformingContext.valueFormatted} de ${summary.topPerformingContext.metricName}`} icon={<FaChartBar className="text-blue-400"/>} />}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </aside>
          <main className="lg:col-span-2 space-y-8">
            <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={0.5}>
              <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg border-t-4 border-pink-500">
                <div className="flex items-center gap-3 mb-6">
                  <FaTrophy className="w-6 h-6 text-pink-500" />
                  <h2 className="text-2xl font-bold text-gray-800">Top Posts em Performance</h2>
                </div>
                <p className="text-gray-600 mb-6 font-light">Uma amostra do conteúdo de maior impacto, selecionada pelas métricas de maior relevância para o seu negócio.</p>
                <VideosTable videos={videos} sortConfig={{ sortBy: 'stats.views', sortOrder: 'desc' }} primaryMetric="stats.views" readOnly />
              </div>
            </motion.div>
          </main>
        </div>
        <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={2}>
          <div className="mt-12 bg-gray-800 text-white text-center p-8 lg:p-12 rounded-xl shadow-2xl">
            <FaEnvelope className="w-10 h-10 mx-auto mb-4 text-pink-500"/>
            <h3 className="text-3xl lg:text-4xl font-bold mb-3">Pronto para Criar um Impacto Juntos?</h3>
            <p className="mb-8 text-gray-300 max-w-2xl mx-auto font-light">Estou disponível para parcerias e projetos de publicidade. Entre em contato para discutirmos como podemos colaborar.</p>
            <a href={`mailto:${user.email}`} className="inline-block bg-pink-500 text-white px-10 py-4 rounded-lg font-semibold text-lg hover:bg-pink-600 transform hover:scale-105 transition-all duration-300 shadow-lg">
              Enviar uma Proposta por E-mail
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}