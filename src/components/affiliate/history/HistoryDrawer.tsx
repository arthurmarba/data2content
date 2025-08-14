'use client';
import React, { useEffect, useRef } from 'react';
import { HistoryItem } from '@/hooks/useAffiliateHistory';
import StatusBadge from './StatusBadge';
import { humanizeReason } from '@/copy/affiliateHistory';
import { format } from 'date-fns';

interface Props {
  item: HistoryItem | null;
  onClose: () => void;
}

export default function HistoryDrawer({ item, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (item) ref.current?.focus();
  }, [item]);
    if (!item) return null;
    const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: item.currency }).format(
      item.amountCents / 100,
    );
    const sign = item.kind === 'redemption' && item.status === 'paid' ? '-' : '+';
  return (
    <div className="fixed inset-0 bg-black/30 flex justify-end" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="w-80 bg-white dark:bg-gray-800 h-full p-4 overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button className="mb-4" onClick={onClose} aria-label="Fechar">✕</button>
        <h2 className="text-lg font-bold mb-2">Detalhes</h2>
          <div className="mb-2"><StatusBadge status={item.status} size="md" /></div>
          <p className="mb-1">Valor: {sign}{formatted} ({item.currency})</p>
        {item.availableAt && (
          <p className="mb-1">Libera em: {format(new Date(item.availableAt), 'dd/MM/yyyy')}</p>
        )}
        {item.invoiceId && (
          <p className="mb-1">invoiceId: {item.invoiceId}</p>
        )}
        {item.subscriptionId && (
          <p className="mb-1">subscriptionId: {item.subscriptionId}</p>
        )}
        {item.transferId && (
          <p className="mb-1">transferId: {item.transferId}</p>
        )}
        {item.reasonCode && (
          <p className="mb-1">Motivo: {humanizeReason(item.reasonCode)}</p>
        )}
        {item.notes && <p className="mb-1">Obs: {item.notes}</p>}
      </div>
    </div>
  );
}
