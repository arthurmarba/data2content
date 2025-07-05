'use client';

import React from 'react';
import TopCreatorsWidget from '../TopCreatorsWidget';
import { useGlobalTimePeriod } from './filters/GlobalTimePeriodContext';
import { TimePeriod } from '@/app/lib/constants/timePeriods'; // Importa o tipo específico

const CreatorHighlightsTables: React.FC = () => {
  const { timePeriod } = useGlobalTimePeriod();
  
  // A correção é aplicar uma asserção de tipo para garantir ao TypeScript
  // que a string 'timePeriod' é um dos valores permitidos pelo tipo TimePeriod.
  const validatedTimePeriod = timePeriod as TimePeriod;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <TopCreatorsWidget
        title="Top Interações"
        metric="total_interactions"
        timePeriod={validatedTimePeriod}
        limit={5}
      />
      <TopCreatorsWidget
        title="Maior Engajamento"
        metric="engagement_rate_on_reach"
        metricLabel="%"
        timePeriod={validatedTimePeriod}
        limit={5}
      />
      <TopCreatorsWidget
        title="Mais Curtidas"
        metric="likes"
        timePeriod={validatedTimePeriod}
        limit={5}
      />
      <TopCreatorsWidget
        title="Mais Compartilhamentos"
        metric="shares"
        timePeriod={validatedTimePeriod}
        limit={5}
      />
    </div>
  );
};

export default CreatorHighlightsTables;
