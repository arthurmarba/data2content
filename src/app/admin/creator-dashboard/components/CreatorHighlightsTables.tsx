"use client";

import React from 'react';
import TopCreatorsWidget from '../TopCreatorsWidget';

const CreatorHighlightsTables: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <TopCreatorsWidget
      title="Top Interações"
      metric="total_interactions"
      days={30}
      limit={5}
    />
    <TopCreatorsWidget
      title="Maior Engajamento"
      metric="engagement_rate_on_reach"
      metricLabel="%"
      days={30}
      limit={5}
    />
    <TopCreatorsWidget
      title="Mais Curtidas"
      metric="likes"
      days={30}
      limit={5}
    />
    <TopCreatorsWidget
      title="Mais Compartilhamentos"
      metric="shares"
      days={30}
      limit={5}
    />
  </div>
);

export default CreatorHighlightsTables;
