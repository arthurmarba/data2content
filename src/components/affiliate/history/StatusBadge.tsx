'use client';
import React from 'react';
import {
  ClockIcon,
  CheckCircleIcon,
  ArrowUpRightIcon,
  XCircleIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/solid';
import { HistoryStatus } from '@/hooks/useAffiliateHistory';
import { STATUS_LABEL } from '@/copy/affiliateHistory';

const config: Record<HistoryStatus, { color: string; Icon: React.ElementType }> = {
  pending: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-300', Icon: ClockIcon },
  available: { color: 'bg-green-100 text-green-700 dark:bg-green-700/30 dark:text-green-300', Icon: CheckCircleIcon },
  paid: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-700/30 dark:text-blue-300', Icon: ArrowUpRightIcon },
  canceled: { color: 'bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300', Icon: XCircleIcon },
  reversed: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-700/30 dark:text-orange-300', Icon: ArrowUturnLeftIcon },
};

export interface StatusBadgeProps {
  status: HistoryStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const { color, Icon } = config[status];
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const label = STATUS_LABEL[status];
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${padding} ${textSize} ${color}`}
      aria-label={`Status: ${label}`}
    >
      <Icon className={`${iconSize} mr-1`} aria-hidden="true" />
      {label}
    </span>
  );
}
