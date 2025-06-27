"use client";
import React from 'react';
import { useGlobalTimePeriod } from './GlobalTimePeriodContext';

interface Props {
  timePeriod?: string;
}

const LABELS: Record<string, string> = {
  last_7_days: 'Últimos 7 dias',
  last_30_days: 'Últimos 30 dias',
  last_90_days: 'Últimos 90 dias',
  last_6_months: 'Últimos 6 meses',
  last_12_months: 'Últimos 12 meses',
  all_time: 'Todo o período',
};

const GlobalPeriodIndicator: React.FC<Props> = ({ timePeriod }) => {
  const context = useGlobalTimePeriod();
  const period = timePeriod || context.globalTimePeriod;
  const label = LABELS[period] || 'Período Personalizado';

  return (
    <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
      {label}
    </span>
  );
};

export default GlobalPeriodIndicator;
