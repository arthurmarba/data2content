"use client";

import React from 'react';
import { Info } from 'lucide-react';

export interface PerformanceHighlightItem {
  name: string;
  metricName: string;
  value: number;
  valueFormatted: string;
  postsCount?: number;
}

export interface HighlightCardProps {
  title: string;
  highlight: PerformanceHighlightItem | null | undefined;
  icon?: React.ReactNode;
  bgColorClass?: string;
  textColorClass?: string;
}

const HighlightCard: React.FC<HighlightCardProps> = ({
  title,
  highlight,
  icon,
  bgColorClass = "bg-gray-50",
  textColorClass = "text-indigo-600",
}) => {
  if (!highlight) {
    return (
      <div className={`p-4 rounded-lg shadow ${bgColorClass} min-h-[100px]`}>
        <div className="flex items-center text-gray-500">
          {icon || <Info size={18} className="mr-2" />}
          <h4 className="text-sm font-medium">{title}</h4>
        </div>
        <p className="text-sm text-gray-400 mt-2">N/A</p>
      </div>
    );
  }
  return (
    <div className={`p-4 rounded-lg shadow ${bgColorClass} min-h-[100px]`}>
      <div className="flex items-center text-gray-600">
        {icon || <Info size={18} className="mr-2" />}
        <h4 className="text-sm font-medium ">{title}</h4>
      </div>
      <p className={`text-xl font-bold ${textColorClass} mt-1 truncate`} title={highlight.name}>
        {highlight.name}
      </p>
      <p className="text-xs text-gray-500">
        {highlight.valueFormatted} {highlight.metricName}
        {highlight.postsCount && (
          <span className="ml-1">({highlight.postsCount} posts)</span>
        )}
      </p>
    </div>
  );
};

export default HighlightCard;
