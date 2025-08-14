'use client';
import React, { useEffect, useRef } from 'react';
import { HistoryItem } from '@/hooks/useAffiliateHistory';
import StatusBadge from './StatusBadge';
import { humanizeReason } from '@/copy/affiliateHistory';
import { format } from 'date-fns';
import { useEscapeToClose, useFocusTrap, useReturnFocus } from '@/lib/a11y';

interface Props {
  item: HistoryItem | null;
  onClose: () => void;
}

export default function HistoryDrawer({ item, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { remember, restore } = useReturnFocus();
  const open = !!item;
  useEscapeToClose(() => open && onClose());
  useFocusTrap(ref);

  useEffect(() => {
    if (open) {
      remember();
      ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else {
      restore();
    }
  }, [open, remember, restore]);

  if (!item) return null;
  const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: item.currency }).format(
    item.amountCents / 100,
  );
  const sign = item.kind === 'redemption' && item.status === 'paid' ? '-' : '+';
  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        tabIndex={-1}
        className="fixed inset-0 sm:inset-y-0 sm:right-0 sm:w-[380px] w-full bg-white dark:bg-gray-800 h-full p-4 overflow-y-auto focus:outline-none"
      >
        <button
          className="mb-4 inline-flex items-center justify-center h-11 min-w-[44px] px-3"
          onClick={onClose}
          aria-label="Fechar"
        >
          ✕
        </button>
        <h2 id="history-title" className="text-lg font-bold mb-2" data-autofocus>
          Detalhes
        </h2>
        <div className="mb-2">
          <StatusBadge status={item.status} size="md" />
        </div>
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
