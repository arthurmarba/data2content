'use client';

import React from 'react';

// Define a interface para o objeto de intervalo de datas
interface DateRange {
  startDate: string;
  endDate: string;
}

// Define as propriedades que o componente de filtro de data aceita
interface GlobalDateRangeFilterProps {
  dateRange: DateRange;
  onDateChange: (newDateRange: DateRange) => void;
  // Poderia ser adicionada uma função para aplicar presets, ex: "Últimos 7 dias"
  // onSetPreset: (preset: string) => void; 
}

/**
 * Componente para um filtro de datas global, permitindo ao utilizador
 * selecionar um intervalo de início e fim.
 */
export default function GlobalDateRangeFilter({ dateRange, onDateChange }: GlobalDateRangeFilterProps) {
  
  // Função para lidar com a mudança nos campos de data
  const handleDateChange = (field: keyof DateRange, value: string) => {
    onDateChange({ ...dateRange, [field]: value });
  };

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-sm font-medium text-gray-700 whitespace-nowrap">Período de Análise:</h3>
      <div className="flex items-center gap-2">
        <label htmlFor="startDate" className="text-sm text-gray-500">De:</label>
        <input
          type="date"
          id="startDate"
          value={dateRange.startDate}
          onChange={(e) => handleDateChange('startDate', e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="endDate" className="text-sm text-gray-500">Até:</label>
        <input
          type="date"
          id="endDate"
          value={dateRange.endDate}
          onChange={(e) => handleDateChange('endDate', e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      {/* Aqui poderiam ser adicionados botões de atalho, como "Últimos 7 dias", "Este Mês", etc. */}
    </div>
  );
}
