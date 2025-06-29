'use client';

import React from 'react';

interface AverageMetricRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | number | null | undefined;
}

const AverageMetricRow: React.FC<AverageMetricRowProps> = ({ icon, label, value }) => {
  // Formata o valor para exibição, tratando nulos e indefinidos
  const formattedValue = typeof value === 'number'
    ? value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
    : 'N/A';

  return (
    <div className="flex justify-between items-center py-2.5 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center gap-3 text-gray-600">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-bold text-gray-900">{formattedValue}</span>
    </div>
  );
};

export default AverageMetricRow;