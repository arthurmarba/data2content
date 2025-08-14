'use client';
import React from 'react';
import { HistoryItem as Item, daysUntil } from '@/hooks/useAffiliateHistory';
import StatusBadge from './StatusBadge';
import { InformationCircleIcon } from '@heroicons/react/24/solid';
import { format } from 'date-fns';

interface Props {
  item: Item;
  onSelect: (item: Item) => void;
}

  function formatAmount(item: Item) {
    const amount = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: item.currency,
    }).format(item.amountCents / 100);
    const sign = item.kind === 'redemption' && item.status === 'paid' ? '-' : '+';
    return `${sign}${amount}`;
  }

export default function HistoryItem({ item, onSelect }: Props) {
  const pendingDays = item.status === 'pending' ? daysUntil(item.availableAt) : 0;
  const liberaEm = pendingDays > 0 ? `libera em ${pendingDays}d` : undefined;
  return (
    <li
      className="flex justify-between items-center border rounded p-3 mb-2 cursor-pointer" role="listitem" onClick={() => onSelect(item)}
    >
        <div className="flex flex-col">
          <span className="font-semibold">{formatAmount(item)}</span>
        <span className="text-xs text-gray-500">
          {format(new Date(item.createdAt), 'dd/MM/yyyy')}
          {liberaEm && <span className="ml-2 inline-block bg-gray-100 text-gray-600 px-1 rounded">{liberaEm}</span>}
        </span>
      </div>
      <div className="flex items-center space-x-2">
        <StatusBadge status={item.status} />
        <InformationCircleIcon className="w-5 h-5 text-gray-500" />
      </div>
    </li>
  );
}
