"use client";

import React from 'react';
import TopCreatorsWidget from '../TopCreatorsWidget';
import { useGlobalTimePeriod } from './filters/GlobalTimePeriodContext';

const CreatorHighlightsTables: React.FC = () => {
  const { timePeriod } = useGlobalTimePeriod();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <TopCreatorsWidget
        title="Top Interações"
        metric="total_interactions"
        timePeriod={timePeriod}
        limit={5}
      />
      <TopCreatorsWidget
        title="Maior Engajamento"
        metric="engagement_rate_on_reach"
        metricLabel="%"
        timePeriod={timePeriod}
        limit={5}
      />
      <TopCreatorsWidget
        title="Mais Curtidas"
        metric="likes"
        timePeriod={timePeriod}
        limit={5}
      />
      <TopCreatorsWidget
        title="Mais Compartilhamentos"
        metric="shares"
        timePeriod={timePeriod}
        limit={5}
      />
    </div>
  );
};

export default CreatorHighlightsTables;
