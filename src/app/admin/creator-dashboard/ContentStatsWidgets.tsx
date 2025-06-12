'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { IDashboardOverallStats, IFetchDashboardOverallContentStatsFilters } from '@/app/lib/dataService/marketAnalysisService'; // Assuming this path

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82Ca9D'];

// Helper to format large numbers for KPIs
const formatKpiValue = (value?: number | string): string => {
  if (value === null || typeof value === 'undefined') return 'N/A';
  if (typeof value === 'string') return value; // Already formatted or a string value
  return value.toLocaleString('pt-BR');
};

const formatPercentage = (value?: number): string => {
    if (value === null || typeof value === 'undefined') return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
}

interface ContentStatsWidgetsProps {
  dateRangeFilter?: {
    startDate: string;
    endDate: string;
  };
  // key prop (refreshKey from parent) will implicitly handle refresh
}

export default function ContentStatsWidgets({ dateRangeFilter }: ContentStatsWidgetsProps) {
  const [stats, setStats] = useState<IDashboardOverallStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params: IFetchDashboardOverallContentStatsFilters = {};
    if (dateRangeFilter?.startDate && dateRangeFilter?.endDate) {
        params.dateRange = {
            startDate: new Date(dateRangeFilter.startDate), // API might expect Date objects
            endDate: new Date(dateRangeFilter.endDate),
        };
    }

    let url = '/api/admin/dashboard/content-stats';
    const queryParams = new URLSearchParams();

    if (params.dateRange?.startDate) {
        queryParams.append('startDate', params.dateRange.startDate.toISOString());
    }
    if (params.dateRange?.endDate) {
        queryParams.append('endDate', params.dateRange.endDate.toISOString());
    }

    const queryString = queryParams.toString();
    if (queryString) {
        url += `?${queryString}`;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch content stats: ${response.statusText}`);
      }
      const data: IDashboardOverallStats = await response.json();
      setStats(data);
    } catch (e: any) {
      setError(e.message);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRangeFilter]); // Dependency: re-fetch if dateRangeFilter changes

  useEffect(() => {
    fetchData();
  }, [fetchData]); // fetchData itself is memoized with dateRangeFilter as dependency

  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 min-h-[400px] flex justify-center items-center">
        <p className="text-gray-500 dark:text-gray-400">Carregando estatísticas...</p>
        {/* TODO: Add a spinner component */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 min-h-[400px] flex flex-col justify-center items-center">
        <p className="text-red-500 dark:text-red-400 text-center mb-4">Erro ao carregar dados: {error}</p>
        <button
            onClick={fetchData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
            Tentar Novamente
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 min-h-[400px] flex justify-center items-center">
        <p className="text-gray-500 dark:text-gray-400">Nenhuma estatística de conteúdo disponível.</p>
      </div>
    );
  }

  const kpis = [
      { title: 'Total de Posts na Plataforma', value: formatKpiValue(stats.totalPlatformPosts) },
      { title: 'Média de Engajamento', value: formatPercentage(stats.averagePlatformEngagementRate) },
      { title: 'Total de Criadores de Conteúdo', value: formatKpiValue(stats.totalContentCreators) },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map(kpi => (
             <div key={kpi.title} className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm text-gray-500 dark:text-gray-400 font-medium">{kpi.title}</h4>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{kpi.value}</p>
            </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Breakdown by Format */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 min-h-[300px]">
          <h4 className="text-md font-semibold text-gray-800 dark:text-white mb-3">Posts por Formato</h4>
          {stats.breakdownByFormat && stats.breakdownByFormat.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.breakdownByFormat} layout="vertical" margin={{ top: 5, right: 25, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                <XAxis type="number" fontSize={10} tickFormatter={(value) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(value as number)} />
                <YAxis dataKey="format" type="category" fontSize={10} width={80} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number) => [value.toLocaleString('pt-BR'), "Posts"]} cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }} />
                <Bar dataKey="count" fill="#8884d8" radius={[0, 4, 4, 0]} barSize={15} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 dark:text-gray-500 text-center pt-10">Dados não disponíveis.</p>}
        </div>

        {/* Breakdown by Proposal - Pie Chart */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 min-h-[300px]">
          <h4 className="text-md font-semibold text-gray-800 dark:text-white mb-3">Posts por Proposta</h4>
           {stats.breakdownByProposal && stats.breakdownByProposal.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={stats.breakdownByProposal}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="proposal"
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return (
                          <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10}>
                              {`${name} (${(percent * 100).toFixed(0)}%)`}
                          </text>
                      );
                  }}
                >
                  {stats.breakdownByProposal.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [value.toLocaleString('pt-BR'), name]} />
                <Legend formatter={(value) => <span className="text-gray-600 dark:text-gray-300 text-xs">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 dark:text-gray-500 text-center pt-10">Dados não disponíveis.</p>}
        </div>
      </div>

      {/* Breakdown by Context - Could be another Bar Chart or different visualization */}
       <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 min-h-[300px]">
          <h4 className="text-md font-semibold text-gray-800 dark:text-white mb-3">Posts por Contexto</h4>
          {stats.breakdownByContext && stats.breakdownByContext.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.breakdownByContext} margin={{ top: 5, right: 25, left: 20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                <XAxis dataKey="context" angle={-30} textAnchor="end" interval={0} fontSize={10} height={50} />
                <YAxis fontSize={10} tickFormatter={(value) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(value as number)} />
                <Tooltip formatter={(value: number) => [value.toLocaleString('pt-BR'), "Posts"]} cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }} />
                <Bar dataKey="count" fill="#00C49F" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 dark:text-gray-500 text-center pt-10">Dados não disponíveis.</p>}
        </div>
    </div>
  );
}
