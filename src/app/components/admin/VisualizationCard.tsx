/**
 * @fileoverview Componente dinâmico e robusto para renderizar diferentes
 * tipos de visualizações de dados na Central de Inteligência.
 * @version 2.1.0
 * @description
 * ## Principais Melhorias na Versão 2.1.0:
 * - **Correção de Erro:** Adicionada uma definição para `logger` para resolver o erro
 * "Cannot find name 'logger'", tornando o componente autocontido.
 * * ## Melhorias Anteriores:
 * - **União Discriminada:** Garante type-safety e elimina a necessidade de type casting.
 * - **Componentização:** Lógica de renderização dividida em subcomponentes otimizados.
 * - **UX Aprimorada:** Introdução de um tooltip customizado e mais elegante.
 */
'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ============================================================================
// --- DEFINIÇÃO DE MOCKS E HELPERS ---
// ============================================================================

/**
 * @mock logger
 * Simulação de um objeto logger para capturar avisos no console.
 */
const logger = {
  warn: (...args: any[]) => console.warn('[VisualizationCard]', ...args),
};

// ============================================================================
// --- SEÇÃO DE TIPOS E INTERFACES (União Discriminada) ---
// ============================================================================

interface KpiVisualization {
  type: 'kpi';
  title: string;
  data: {
    value: string | number;
    unit?: string;
    change?: string;
    changeType?: 'positive' | 'negative';
  };
}

interface BarChartVisualization {
  type: 'bar_chart';
  title:string;
  data: {
    name: string;
    value: number;
  }[];
}

interface ListVisualization {
  type: 'list';
  title: string;
  data: {
    items: string[];
  };
}

/**
 * Define o tipo de visualização usando uma união discriminada.
 */
export type Visualization = KpiVisualization | BarChartVisualization | ListVisualization;

// ============================================================================
// --- SUBCOMPONENTES DE VISUALIZAÇÃO (Otimizados com React.memo) ---
// ============================================================================

const KpiView: React.FC<{ data: KpiVisualization['data'] }> = React.memo(({ data }) => (
  <div className="p-6 text-center">
    <p className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
      {data.value}
      {data.unit && <span className="text-2xl md:text-3xl font-medium text-gray-500 dark:text-gray-400 ml-2">{data.unit}</span>}
    </p>
    {data.change && (
      <p className={`mt-2 text-sm font-semibold ${data.changeType === 'positive' ? 'text-green-500' : 'text-red-500'}`}>
        {data.changeType === 'positive' ? '↑' : '↓'} {data.change} em relação ao período anterior
      </p>
    )}
  </div>
));
KpiView.displayName = 'KpiView';

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg">
        <p className="font-bold text-gray-900 dark:text-white">{label}</p>
        <p className="text-sm text-indigo-500 dark:text-indigo-400 mt-1">
          <span className="font-semibold text-gray-700 dark:text-gray-300">Valor:</span> {payload[0].value.toLocaleString('pt-BR')}
        </p>
      </div>
    );
  }
  return null;
};

const CustomBarChart: React.FC<{ data: BarChartVisualization['data'] }> = React.memo(({ data }) => (
  <div className="p-4 h-64 md:h-80 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.1)" />
        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(value as number)} />
        <Tooltip cursor={{ fill: 'rgba(79, 70, 229, 0.1)' }} content={<CustomTooltip />} />
        <Bar dataKey="value" name="Valor" fill="rgb(79, 70, 229)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
));
CustomBarChart.displayName = 'CustomBarChart';

const ListView: React.FC<{ data: ListVisualization['data'] }> = React.memo(({ data }) => (
  <ul className="p-6 space-y-3">
    {data.items.map((item, index) => (
      <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start">
        <span className="text-indigo-500 mr-3 mt-1">&#8227;</span>
        <span>{item}</span>
      </li>
    ))}
  </ul>
));
ListView.displayName = 'ListView';


// ============================================================================
// --- COMPONENTE PRINCIPAL ---
// ============================================================================

const VisualizationCard: React.FC<{ visualization: Visualization }> = ({ visualization }) => {
  const { type, title, data } = visualization;

  const renderContent = () => {
    switch (type) {
      case 'kpi':
        return <KpiView data={data} />;
      case 'bar_chart':
        return <CustomBarChart data={data} />;
      case 'list':
        return <ListView data={data} />;
      default:
        // CORREÇÃO: O logger agora está definido e pode ser usado.
        const exhaustiveCheck: never = type;
        logger.warn(`Tipo de visualização desconhecido: ${exhaustiveCheck}`);
        return <p className="p-4 text-red-500">Tipo de visualização não suportado.</p>;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden my-4 animate-fade-in">
      <h3 className="text-md font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        {title}
      </h3>
      {renderContent()}
    </div>
  );
};

export default VisualizationCard;
