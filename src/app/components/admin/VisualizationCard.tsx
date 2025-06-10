/**
 * @fileoverview Componente dinâmico para renderizar diferentes tipos de
 * visualizações de dados na Central de Inteligência.
 * @version 1.0.0
 */
'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- Tipos e Interfaces ---

// Define os tipos de visualização que o componente suporta
type VisualizationType = 'kpi' | 'bar_chart' | 'list';

// Define a estrutura de dados esperada para cada tipo de visualização
interface KpiData {
  value: string | number;
  unit?: string;
  change?: string;
  changeType?: 'positive' | 'negative';
}

interface BarChartData {
  name: string;
  value: number;
}

interface ListData {
  items: string[];
}

// Props do componente principal
export interface Visualization {
  type: VisualizationType;
  title: string;
  data: KpiData | BarChartData[] | ListData;
}

interface VisualizationCardProps {
  visualization: Visualization;
}


/**
 * Componente que renderiza um card com uma visualização de dados (KPI, Gráfico de Barras, ou Lista).
 * @param {VisualizationCardProps} props - As propriedades do componente.
 */
const VisualizationCard: React.FC<VisualizationCardProps> = ({ visualization }) => {
  const { type, title, data } = visualization;

  /**
   * Renderiza o conteúdo do card com base no tipo de visualização.
   */
  const renderContent = () => {
    switch (type) {
      case 'kpi':
        const kpiData = data as KpiData;
        return (
          <div className="p-4 text-center">
            <p className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-white">
              {kpiData.value}
              {kpiData.unit && <span className="text-2xl md:text-3xl font-medium text-gray-500 dark:text-gray-400 ml-1">{kpiData.unit}</span>}
            </p>
            {kpiData.change && (
              <p className={`mt-2 text-sm font-semibold ${kpiData.changeType === 'positive' ? 'text-green-500' : 'text-red-500'}`}>
                {kpiData.change} em relação ao período anterior
              </p>
            )}
          </div>
        );

      case 'bar_chart':
        const chartData = data as BarChartData[];
        return (
          <div className="p-4 h-64 md:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.2)" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(238, 242, 255, 0.5)' }}
                  contentStyle={{
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar dataKey="value" name="Valor" fill="rgb(79, 70, 229)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'list':
        const listData = data as ListData;
        return (
          <ul className="p-4 space-y-2">
            {listData.items.map((item, index) => (
              <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start">
                <span className="text-indigo-500 mr-2 mt-1">&#8227;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        );

      default:
        return <p className="p-4 text-red-500">Tipo de visualização desconhecido.</p>;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden my-4">
      <h3 className="text-md font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900/50 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        {title}
      </h3>
      {renderContent()}
    </div>
  );
};

export default VisualizationCard;
