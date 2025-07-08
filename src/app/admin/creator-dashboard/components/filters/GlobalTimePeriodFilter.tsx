"use client";

import React from 'react';

interface GlobalTimePeriodFilterProps {
  selectedTimePeriod: string;
  onTimePeriodChange: (newTimePeriod: string) => void;
  options?: { value: string; label: string }[];
  label?: string;
  disabled?: boolean;
}

// Opções padrão se nenhuma for fornecida via props
const DEFAULT_TIME_PERIOD_OPTIONS = [
  { value: "last_7_days", label: "Últimos 7 dias" },
  { value: "last_30_days", label: "Últimos 30 dias" },
  { value: "last_90_days", label: "Últimos 90 dias" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  { value: "last_12_months", label: "Últimos 12 meses" },
  { value: "all_time", label: "Todo o período" },
];

const GlobalTimePeriodFilter: React.FC<GlobalTimePeriodFilterProps> = ({
  selectedTimePeriod,
  onTimePeriodChange,
  options = DEFAULT_TIME_PERIOD_OPTIONS,
  label = "Selecionar Período",
  disabled = false,
}) => {
  const selectedLabel =
    options.find((o) => o.value === selectedTimePeriod)?.label || "";
  return (
    <div className="flex items-center">
      {/* Placeholder text shown on small screens when the label is hidden */}
      <span className="sm:hidden text-sm text-gray-500 mr-2" aria-hidden="true">
        {selectedLabel}
      </span>
      <label
        htmlFor="globalTimePeriodSelector"
        className="hidden sm:block text-sm font-medium text-gray-700 mr-2 whitespace-nowrap"
      >
        {label}
      </label>
      <select
        id="globalTimePeriodSelector"
        aria-label={label}
        title={label}
        value={selectedTimePeriod}
        onChange={(e) => onTimePeriodChange(e.target.value)}
        disabled={disabled}
        className="p-2 pr-8 bg-brand-light border-0 border-b border-gray-200 rounded-none shadow-none focus:outline-none focus:border-gray-400 text-sm text-gray-700 disabled:bg-gray-100 disabled:cursor-not-allowed w-full sm:w-auto"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
};

export default React.memo(GlobalTimePeriodFilter);

